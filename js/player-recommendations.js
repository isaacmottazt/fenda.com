/**
 * FENDA MUSIC - RECOMENDAÇÕES
 * 
 * Features:
 * - Análise de listening history
 * - Algoritmo de score (gênero + artista + popularidade)
 * - Geração diária de recomendações
 * - Aba "Para Você" na home
 */

class RecommendationEngine {
  constructor() {
    this.recommendations = [];
    this.userPreferences = null;
    this.initialized = false;
  }

  /**
   * Inicializa o motor de recomendações
   */
  async init(userId) {
    if (!userId || (this.initialized && this.userId === userId)) return;

    try {
      this.userId = userId;
      if (window.FendaPrivacy) await window.FendaPrivacy.load(userId);
      if (window.FendaPrivacy && !window.FendaPrivacy.isEnabled('recommendations')) {
        this.recommendations = [];
        this.initialized = false;
        return;
      }
      await this.loadUserPreferences();
      await this.generateRecommendations();
      this.initialized = true;

      Logger.log('RecommendationEngine inicializado');
    } catch (err) {
      Logger.error('Erro ao inicializar RecommendationEngine:', err);
    }
  }

  /**
   * Carrega preferências do usuário
   */
  async loadUserPreferences() {
    try {
      const { data: prefs } = await supabaseClient
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      this.userPreferences = prefs || {
        user_id: this.userId,
        genre_weights: {},
        artist_weights: {}
      };
    } catch (err) {
      Logger.warn('Erro ao carregar preferências:', err);
      this.userPreferences = {
        user_id: this.userId,
        genre_weights: {},
        artist_weights: {}
      };
    }
  }

  /**
   * Gera recomendações baseado em listening history
   */
  async generateRecommendations() {
    try {
      // Buscar últimas 100 escutas
      const { data: listeningHistory } = await supabaseClient
        .from('listening_history')
        .select('*, musics(id, name, genre, artist_id, artists(name))')
        .eq('user_id', this.userId)
        .order('played_at', { ascending: false })
        .limit(100);

      if (!listeningHistory || listeningHistory.length === 0) {
        Logger.warn('Nenhum histórico de escuta disponível');
        return;
      }

      // Calcular pesos de gênero e artista
      this.calculateWeights(listeningHistory);

      // Buscar músicas não ouvidas
      const heardIds = listeningHistory.map(h => h.music_id);
      const { data: allMusics } = await supabaseClient
        .from('musics')
        .select('id, name, genre, artist_id, artists(name), plays')
        .not('id', 'in', `(${heardIds.join(',')})`)
        .limit(500);

      if (!allMusics || allMusics.length === 0) {
        Logger.warn('Nenhuma música nova para recomendar');
        return;
      }

      // Calcular score para cada música
      const scored = allMusics
        .map(music => ({
          ...music,
          score: this.calculateScore(music)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      // Salvar recomendações
      for (const music of scored) {
        await supabaseClient
          .from('recommendations')
          .upsert({
            user_id: this.userId,
            music_id: music.id,
            score: music.score,
            reason: this.getRecommendationReason(music)
          });
      }

      this.recommendations = scored;
      Logger.log(`${scored.length} recomendações geradas`);
    } catch (err) {
      Logger.error('Erro ao gerar recomendações:', err);
    }
  }

  /**
   * Calcula pesos de gênero e artista
   */
  calculateWeights(listeningHistory) {
    const genreWeights = {};
    const artistWeights = {};
    let totalDuration = 0;

    listeningHistory.forEach(item => {
      const music = item.musics;
      if (!music) return;

      const duration = item.listened_seconds || 0;
      const genre = music.genre || 'Unknown';
      const artistId = music.artist_id;

      genreWeights[genre] = (genreWeights[genre] || 0) + duration;
      artistWeights[artistId] = (artistWeights[artistId] || 0) + 1;
      totalDuration += duration;
    });

    // Normalizar pesos
    Object.keys(genreWeights).forEach(genre => {
      genreWeights[genre] = genreWeights[genre] / totalDuration;
    });

    this.userPreferences.genre_weights = genreWeights;
    this.userPreferences.artist_weights = artistWeights;

    // Salvar preferências
    this.saveUserPreferences();
  }

  /**
   * Salva preferências do usuário no banco
   */
  async saveUserPreferences() {
    try {
      await supabaseClient
        .from('user_preferences')
        .upsert({
          user_id: this.userId,
          genre_weights: this.userPreferences.genre_weights,
          artist_weights: this.userPreferences.artist_weights
        });
    } catch (err) {
      Logger.warn('Erro ao salvar preferências:', err);
    }
  }

  /**
   * Calcula score de uma música (0-1)
   */
  calculateScore(music) {
    let score = 0;

    // Score por gênero (40%)
    if (this.userPreferences?.genre_weights && music.genre) {
      const genreWeight = this.userPreferences.genre_weights[music.genre] || 0;
      score += Math.min(genreWeight * 10, 1) * 0.4; // normalizar
    }

    // Score por artista (30%)
    if (this.userPreferences?.artist_weights && music.artist_id) {
      const artistWeight = this.userPreferences.artist_weights[music.artist_id] || 0;
      score += Math.min(artistWeight / 10, 1) * 0.3; // normalizar
    }

    // Score por popularidade (30%)
    if (music.plays) {
      const popularity = Math.min(music.plays / 1000, 1);
      score += popularity * 0.3;
    }

    return Math.min(score, 1);
  }

  /**
   * Gera motivo da recomendação
   */
  getRecommendationReason(music) {
    const genreWeight = this.userPreferences?.genre_weights[music.genre] || 0;
    const artistWeight = this.userPreferences?.artist_weights[music.artist_id] || 0;

    if (genreWeight > 0.1 && artistWeight > 0) {
      return `Similar ao que você segue`;
    }

    if (genreWeight > 0.05) {
      return `Artista do seu gênero favorito`;
    }

    if (music.plays && music.plays > 100) {
      return `Popular entre seus artistas`;
    }

    return `Recomendação personalizada`;
  }

  /**
   * Retorna recomendações
   */
  getRecommendations() {
    return this.recommendations;
  }

  /**
   * Obtém recomendações do banco (para refrescar)
   */
  async fetchRecommendationsFromDB() {
    try {
      const { data: recs } = await supabaseClient
        .from('recommendations')
        .select('*, musics(*)')
        .eq('user_id', this.userId)
        .order('score', { ascending: false })
        .limit(20);

      return recs || [];
    } catch (err) {
      Logger.error('Erro ao buscar recomendações do banco:', err);
      return [];
    }
  }
}

// Instanciar globalmente
let recommendationEngine;

document.addEventListener('DOMContentLoaded', () => {
  if (!recommendationEngine) {
    recommendationEngine = new RecommendationEngine();
  }
});

document.addEventListener('fenda:privacyChanged', (event) => {
  if (!recommendationEngine?.userId) return;
  recommendationEngine.initialized = false;
  if (event.detail?.recommendations) {
    void recommendationEngine.init(recommendationEngine.userId);
  } else {
    recommendationEngine.recommendations = [];
  }
});
