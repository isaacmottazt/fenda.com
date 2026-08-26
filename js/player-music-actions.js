// ===== AÇÕES DE MÚSICA (EXCLUSÃO) =====

async function deleteMusicPermanently(music) {
    try {
        if (typeof window.deleteMusicFromSupabase === 'function') {
            const ok = await window.deleteMusicFromSupabase(music.id);
            if (!ok) throw new Error("Falha na exclusão do Supabase");
        }
        AppState.musics = AppState.musics.filter(m => m.id !== music.id);
        localStorage.setItem('supabase_player_fallback', JSON.stringify(AppState.musics));
        AppState.favorites.delete(music.id);
        saveFavorites(Array.from(AppState.favorites));
        AppState.userPlaylists.forEach(pl => {
            pl.musics = pl.musics.filter(id => id !== music.id);
        });
        savePlaylists(AppState.userPlaylists);
        renderMusicList();
        renderPlaylists();
        showToast("Música excluída com sucesso", "success");
        if (AppState.currentMusicId === music.id) {
            DOM.audio.pause();
            DOM.audio.removeAttribute('src');
            DOM.audio.load();
            window.clearPlayerSession?.();
            AppState.currentMusicId = null;
            AppState.playing = false;
            AppState.queue = (AppState.queue || []).filter(item => item.id !== music.id);
            AppState.autoQueue = (AppState.autoQueue || []).filter(item => item.id !== music.id);
            if (AppState.playContext) {
                AppState.playContext.trackList = (AppState.playContext.trackList || [])
                    .filter(item => item.id !== music.id);
            }
            AppState._originalTrackList = (AppState._originalTrackList || [])
                .filter(item => item.id !== music.id);
            DOM.playerBottomBar.style.display = 'none';
            document.body.classList.remove('player-active');
        }
    } catch (err) {
        showToast("Erro ao excluir: " + err.message, "danger");
    }
}

window.deleteMusicPermanently = deleteMusicPermanently;