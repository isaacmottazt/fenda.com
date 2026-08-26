// notifications-follow.js - Notificações de novos lançamentos de artistas

class FendaArtistNotifications {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.userId = null;
    this.followedArtists = [];
    this.checkInterval = null;
  }

  async init(userId) {
    this.userId = userId;
    await this.loadFollowedArtists();
    this.startNotificationCheck();
  }

  async followArtist(artistId, artistName) {
    if (!this.userId) {
      alert('Faça login primeiro');
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from('artist_follows')
        .insert({
          user_id: this.userId,
          artist_id: artistId,
          artist_name: artistName,
          followed_at: new Date().toISOString(),
        });

      if (error) throw error;

      this.followedArtists.push({
        id: artistId,
        name: artistName,
        lastCheckDate: new Date().toISOString(),
      });

      localStorage.setItem('fenda-followed-artists', JSON.stringify(this.followedArtists));
      return true;
    } catch (error) {
      console.error('Erro ao seguir artista:', error);
      return false;
    }
  }

  async unfollowArtist(artistId) {
    try {
      const { error } = await this.supabase
        .from('artist_follows')
        .delete()
        .eq('user_id', this.userId)
        .eq('artist_id', artistId);

      if (error) throw error;

      this.followedArtists = this.followedArtists.filter(a => a.id !== artistId);
      localStorage.setItem('fenda-followed-artists', JSON.stringify(this.followedArtists));
      return true;
    } catch (error) {
      console.error('Erro ao deixar de seguir artista:', error);
      return false;
    }
  }

  async loadFollowedArtists() {
    try {
      const { data } = await this.supabase
        .from('artist_follows')
        .select('*')
        .eq('user_id', this.userId);

      this.followedArtists = data || [];
      localStorage.setItem('fenda-followed-artists', JSON.stringify(this.followedArtists));
    } catch (error) {
      console.error('Erro ao carregar artistas seguidos:', error);
      const saved = localStorage.getItem('fenda-followed-artists');
      this.followedArtists = saved ? JSON.parse(saved) : [];
    }
  }

  async checkNewReleases() {
    if (this.followedArtists.length === 0) return;

    const notifications = [];

    for (const artist of this.followedArtists) {
      try {
        const lastCheck = new Date(artist.lastCheckDate || 0);
        
        const { data: newSongs } = await this.supabase
          .from('musics')
          .select('id, title, artist, created_at')
          .eq('artist', artist.name)
          .gt('created_at', lastCheck.toISOString())
          .order('created_at', { ascending: false })
          .limit(5);

        if (newSongs && newSongs.length > 0) {
          newSongs.forEach(song => {
            notifications.push({
              artistId: artist.id,
              artistName: artist.name,
              songTitle: song.title,
              songId: song.id,
              releaseDate: song.created_at,
            });
          });

          // Atualizar data de check
          artist.lastCheckDate = new Date().toISOString();
        }
      } catch (error) {
        console.error(`Erro ao verificar novos lançamentos de ${artist.name}:`, error);
      }
    }

    localStorage.setItem('fenda-followed-artists', JSON.stringify(this.followedArtists));

    // Enviar notificações
    notifications.forEach(notif => {
      this.sendNotification(notif);
      this.saveNotificationToDb(notif);
    });

    return notifications;
  }

  sendNotification(notification) {
    const title = `${notification.artistName} lançou uma nova música!`;
    const options = {
      body: notification.songTitle,
      icon: '/imagens/logo.png',
      badge: '/imagens/logo.png',
      tag: `release-${notification.songId}`,
      requireInteraction: false,
      actions: [
        {
          action: 'play',
          title: 'Ouvir agora',
        },
        {
          action: 'close',
          title: 'Fechar',
        },
      ],
    };

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification_obj = new Notification(title, options);
      
      notification_obj.onclick = () => {
        window.focus();
        this.playSong(notification.songId);
        notification_obj.close();
      };
    } else {
      // Fallback: mostrar no UI
      this.showInAppNotification(notification);
    }
  }

  showInAppNotification(notification) {
    const container = document.getElementById('notifications-container') || 
                     this.createNotificationsContainer();

    const notifEl = document.createElement('div');
    notifEl.className = 'new-release-notification';
    notifEl.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">🎵</span>
        <div class="notification-text">
          <strong>${notification.artistName}</strong>
          <p>${notification.songTitle}</p>
        </div>
        <button class="notification-play" onclick="fendaArtistNotifications.playSong('${notification.songId}')">
          ▶️
        </button>
      </div>
    `;

    container.appendChild(notifEl);

    // Remover após 5 segundos
    setTimeout(() => {
      notifEl.classList.add('fade-out');
      setTimeout(() => notifEl.remove(), 300);
    }, 5000);
  }

  createNotificationsContainer() {
    const container = document.createElement('div');
    container.id = 'notifications-container';
    container.className = 'notifications-container';
    document.body.appendChild(container);
    return container;
  }

  async saveNotificationToDb(notification) {
    try {
      await this.supabase
        .from('artist_release_notifications')
        .insert({
          user_id: this.userId,
          artist_id: notification.artistId,
          song_id: notification.songId,
          read: false,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Erro ao salvar notificação:', error);
    }
  }

  playSong(songId) {
    // Trigger play do player
    if (window.AppState) {
      window.AppState.currentMusicId = songId;
      window.AppState.isPlaying = true;
      
      if (window.playerCore) {
        window.playerCore.loadAndPlay(songId);
      }
    }
  }

  startNotificationCheck() {
    // Verificar a cada 30 minutos
    this.checkInterval = setInterval(() => {
      this.checkNewReleases();
    }, 30 * 60 * 1000);

    // Verificar também ao iniciar
    this.checkNewReleases();
  }

  stopNotificationCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }

  renderFollowedArtists() {
    if (this.followedArtists.length === 0) {
      return `
        <div class="followed-artists-empty">
          <p>Você não está seguindo nenhum artista ainda</p>
          <p style="font-size: 12px; color: #999;">
            Siga seus artistas favoritos para receber notificações de novos lançamentos
          </p>
        </div>
      `;
    }

    return `
      <div class="followed-artists-list">
        <h3>Artistas que você segue</h3>
        ${this.followedArtists.map(artist => `
          <div class="followed-artist-item">
            <span class="artist-name">${artist.name}</span>
            <button 
              class="unfollow-btn"
              onclick="fendaArtistNotifications.unfollowArtist('${artist.id}')"
            >
              Deixar de seguir
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  getCSS() {
    return `
      .notifications-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .new-release-notification {
        background: var(--color-primary);
        color: white;
        padding: 12px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
      }

      .new-release-notification.fade-out {
        animation: fadeOut 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes fadeOut {
        to {
          opacity: 0;
          transform: translateX(400px);
        }
      }

      .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .notification-icon {
        font-size: 24px;
      }

      .notification-text {
        flex: 1;
        min-width: 0;
      }

      .notification-text strong {
        display: block;
        margin-bottom: 4px;
      }

      .notification-text p {
        margin: 0;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .notification-play {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
      }

      .notification-play:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .followed-artists-list {
        padding: 20px;
        background: var(--color-surface);
        border-radius: 12px;
      }

      .followed-artists-list h3 {
        margin: 0 0 15px 0;
      }

      .followed-artist-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: var(--color-background);
        border-radius: 8px;
        margin-bottom: 8px;
      }

      .artist-name {
        font-weight: 500;
        flex: 1;
      }

      .unfollow-btn {
        background: var(--color-accent);
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .unfollow-btn:hover {
        opacity: 0.8;
      }

      .followed-artists-empty {
        padding: 30px 20px;
        text-align: center;
        color: var(--color-text);
        opacity: 0.7;
      }

      @media (max-width: 600px) {
        .notifications-container {
          left: 10px;
          right: 10px;
          max-width: none;
        }
      }
    `;
  }
}

// Inicializar
const fendaArtistNotifications = new FendaArtistNotifications(supabase);

// Injetar CSS
const notifStyle = document.createElement('style');
notifStyle.textContent = fendaArtistNotifications.getCSS();
document.head.appendChild(notifStyle);
