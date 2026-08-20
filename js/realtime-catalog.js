// Sincronização contínua do catálogo sem tocar no estado do player.
// Mudanças chegam por Realtime; uma atualização leve em primeiro plano serve
// como contingência quando o canal é temporariamente interrompido.
(function () {
  const TABLES = ['musics', 'podcasts', 'artists'];
  let refreshTimer = null;
  let fallbackTimer = null;
  let channel = null;

  function scheduleRefresh(delay = 400) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshCatalog, delay);
  }

  async function refreshCatalog() {
    if (document.visibilityState !== 'visible' || !window.supabaseClient || !window.AppState) return;
    try {
      const [musics, podcasts, artists] = await Promise.all([
        window.loadMusicsFromSupabase?.(),
        window.loadPodcastsFromSupabase?.(),
        window.loadAllArtists?.(),
      ]);

      // Não chama playMusicTrack nem reatribui currentMusicId: a reprodução
      // em curso e sua posição continuam intactas durante a atualização.
      if (Array.isArray(musics)) window.AppState.musics = musics;
      if (Array.isArray(podcasts)) window.AppState.podcasts = podcasts;
      if (Array.isArray(artists)) window.AppState.artists = artists;

      window.renderHome?.();
      window.renderLibrary?.();
      window.renderSearch?.();
      window.renderArtistList?.();
      window.dispatchEvent(new CustomEvent('fenda:catalogRefreshed'));
    } catch (error) {
      console.warn('[Realtime] Catálogo será tentado novamente:', error);
    }
  }

  function connect() {
    const client = window.supabaseClient;
    if (!client || channel) return;

    channel = client.channel('fenda-web-catalog');
    TABLES.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => scheduleRefresh()
      );
    });
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        channel = null;
      }
    });
  }

  function start() {
    connect();
    scheduleRefresh(1000);
    fallbackTimer = setInterval(() => {
      if (document.visibilityState === 'visible') scheduleRefresh(0);
    }, 60000);

    window.addEventListener('online', () => scheduleRefresh(0));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        connect();
        scheduleRefresh(0);
      }
    });
    window.addEventListener('beforeunload', () => {
      clearInterval(fallbackTimer);
      if (channel && window.supabaseClient) window.supabaseClient.removeChannel(channel);
    }, { once: true });
  }

  window.addEventListener('load', start, { once: true });
})();
