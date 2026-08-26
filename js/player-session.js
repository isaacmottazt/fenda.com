// ============================================================
// Fenda Music — player-session.js  (v2)
// Persiste e restaura o estado do player entre aberturas do PWA.
//
// PROBLEMA: O Android sempre recarrega o PWA ao abrir pelo ícone.
// SOLUÇÃO:  Salvar qual música tocava e o tempo exato. Ao abrir,
//           restaurar e dar play automaticamente de onde parou.
// ============================================================

const SESSION_KEY = 'fenda_player_session';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// ── Salva o estado atual ──────────────────────────────────────
function savePlayerSession() {
    try {
        if (!AppState.currentMusicId) return;

        const audio = document.getElementById('audio');
        const currentTime = audio ? Math.floor(audio.currentTime) : 0;

        const session = {
            musicId:    AppState.currentMusicId,
            currentTime: currentTime,
            duration:   audio && Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0,
            wasPlaying: audio ? !audio.paused : AppState.playing,
            isShuffle:  AppState.isShuffle,
            repeatMode: AppState.repeatMode,
            // Mantido para compatibilidade com sessões antigas.
            isRepeat:   AppState.repeatMode === 1,
            // Salva só IDs para não pesar
            trackIds: (AppState.playContext?.trackList || []).map(m => m.id),
            source:     AppState.playContext?.source     || 'library',
            playlistId: AppState.playContext?.playlistId || null,
            seedMusicId: AppState.playContext?.seedMusicId || AppState.currentMusicId,
            seedProfile: AppState.playContext?.seedProfile || null,
            queueIds: (AppState.queue || []).map(m => m.id),
            autoQueueIds: (AppState.autoQueue || []).map(m => m.id),
            savedAt:    Date.now(),
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
        console.warn('[Session] Erro ao salvar:', e);
    }
}

// ── Lê a sessão salva ─────────────────────────────────────────
function loadPlayerSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        // A retomada fica disponível por até 12 horas, como uma sessão recente
        // de streaming. Depois disso, o player começa sem retomar automaticamente.
        if (s.savedAt && Date.now() - s.savedAt > SESSION_MAX_AGE_MS) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return s;
    } catch { return null; }
}

// ── Restaura e dá play de onde parou ─────────────────────────
// Chamado após AppState.musics estar preenchido.
async function restorePlayerSession() {
    const session = loadPlayerSession();
    if (!session) return false;

    const music = AppState.musics.find(m => String(m.id) === String(session.musicId));
    if (!music) {
        localStorage.removeItem(SESSION_KEY);
        return false;
    }

    console.log('[Session] Restaurando:', music.title, '@', session.currentTime + 's');

    // Restaura flags
    AppState.isShuffle = session.isShuffle === true;
    AppState.repeatMode = Number.isInteger(session.repeatMode)
        ? Math.max(0, Math.min(2, session.repeatMode))
        : (session.isRepeat ? 1 : 0);

    // Reconstrói trackList
    const restoredList = session.trackIds?.length
        ? session.trackIds.map(id => AppState.musics.find(m => String(m.id) === String(id))).filter(Boolean)
        : AppState.musics;

    AppState.playContext = {
        source:     session.source,
        playlistId: session.playlistId,
        trackList:  restoredList,
        seedMusicId: session.seedMusicId || music.id,
        seedProfile: session.seedProfile || null,
    };
    // Necessário para desligar o shuffle depois de uma restauração sem
    // perder o contexto (por exemplo, uma playlist).
    AppState._originalTrackList = [...restoredList];

    AppState.currentMusicId = music.id;

    const shuffleBtn = document.getElementById('shuffleBtn');
    if (shuffleBtn) shuffleBtn.classList.toggle('active', AppState.isShuffle);
    const repeatBtn = document.getElementById('repeatBtn');
    const repeatIcon = repeatBtn?.querySelector('.material-symbols-rounded');
    if (repeatBtn) repeatBtn.classList.toggle('active', AppState.repeatMode !== 0);
    if (repeatIcon) repeatIcon.textContent = AppState.repeatMode === 2 ? 'repeat_one' : 'repeat';

    const audio = document.getElementById('audio');
    if (!audio) return false;

    // URL: offline cache tem prioridade
    let audioUrl = music.src;
    if (typeof window.getCachedAudioUrl === 'function') {
        const cached = await window.getCachedAudioUrl(music);
        if (cached) audioUrl = cached;
    }

    audio.src = audioUrl;

    // Aplica o tempo exato antes de retomar. O play é tentado depois que o
    // navegador conhece a duração; assim a retomada não começa do zero.
    const targetTime = Math.max(0, Number(session.currentTime) || 0);
    let resumeHandled = false;
    const resumeAutomatically = async () => {
        if (resumeHandled) return;
        resumeHandled = true;

        if (targetTime > 0 && (!Number.isFinite(audio.duration) || targetTime < (audio.duration - 3))) {
            try { audio.currentTime = targetTime; } catch {}
        }

        try {
            await audio.play();
            AppState.playing = true;
            if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
            if (typeof window.updateMediaSession === 'function') window.updateMediaSession(music);
            console.log('[Session] Retomada automática iniciada em', targetTime + 's');
        } catch (error) {
            // Alguns navegadores bloqueiam autoplay sem gesto do usuário. Nesse
            // caso, mantemos a música e a posição prontas no mini-player, sem
            // recriar o card grande da Home.
            AppState.playing = false;
            audio.pause();
            if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
            console.warn('[Session] Autoplay bloqueado; aguardando interação:', error?.name || error);
        }
    };
    audio.addEventListener('loadedmetadata', resumeAutomatically, { once: true });
    if (audio.readyState >= 1) void resumeAutomatically();

    // Atualiza UI (mini barra aparece imediatamente)
    if (typeof window.updatePlayerVisibility === 'function') {
        window.updatePlayerVisibility(music);
    }

    const resolveIds = (ids) => Array.isArray(ids)
        ? ids.map(id => AppState.musics.find(m => String(m.id) === String(id))).filter(Boolean)
        : [];
    const savedQueue = resolveIds(session.queueIds);
    const savedAutoQueue = resolveIds(session.autoQueueIds);

    // Primeiro restaura a sequência exata que estava pendente. Para sessões
    // antigas sem IDs de fila, usa o gerador contextual como fallback.
    AppState.queue = savedQueue;
    if (savedAutoQueue.length || Array.isArray(session.autoQueueIds)) {
        AppState.autoQueue = savedAutoQueue;
    } else if (typeof window.buildAffinityQueue === 'function') {
        const queueList = window._queueListForContext?.() || restoredList;
        AppState.autoQueue = window.buildAffinityQueue(
            music.id,
            queueList,
            AppState.isShuffle,
            AppState.playContext.seedMusicId,
            AppState.playContext.seedProfile
        );
    } else if (typeof window.buildAutoQueue === 'function') {
        AppState.autoQueue = window.buildAutoQueue(
            music.id, restoredList, AppState.isShuffle
        );
    }
    // Se o contexto restaurado for curto, continua com o restante do catálogo.
    window.ensureAutoQueue?.();

    // A retomada automática já foi agendada acima. Enquanto o metadado não
    // chega, a interface mostra a faixa carregada e preserva a fila restaurada.
    AppState.playing = false;
    if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
    if (typeof window.updateMediaSession === 'function') window.updateMediaSession(music);
    console.log('[Session] Música e posição restauradas; retomada automática agendada');

    return true;
}

// ── Inicia os listeners de persistência ──────────────────────
function initSessionPersistence() {
    const audio = document.getElementById('audio');
    if (!audio) return;

    // Salva assim que uma música começa a tocar
    audio.addEventListener('play', savePlayerSession);

    // Quando uma faixa termina, deixa de ser uma retomada pendente. O próximo
    // avanço salvará a nova música assim que começar.
    audio.addEventListener('ended', () => {
        try { localStorage.removeItem(SESSION_KEY); } catch {}
    });

    // Salva também quando o usuário pausa manualmente, para o card
    // continuar ouvindo refletir o ponto exato sem depender do próximo intervalo.
    audio.addEventListener('pause', savePlayerSession);

    // Salva periodicamente enquanto toca (a cada 5s)
    setInterval(() => {
        if (!audio.paused && AppState.currentMusicId) {
            savePlayerSession();
        }
    }, 5_000);

    // Salva ao ir para background (usuário muda de app)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') savePlayerSession();
    });

    // Salva ao fechar/navegar para fora
    window.addEventListener('pagehide', savePlayerSession);
    window.addEventListener('beforeunload', savePlayerSession);

    console.log('[Session] Persistência ativa.');
}

window.savePlayerSession      = savePlayerSession;
window.loadPlayerSession      = loadPlayerSession;
window.restorePlayerSession   = restorePlayerSession;
window.initSessionPersistence = initSessionPersistence;
