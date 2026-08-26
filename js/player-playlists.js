// ===== GERENCIADOR DE PLAYLISTS E FAVORITOS (com Supabase) =====

function renderPlaylists() {
    const likedCountTxt = document.getElementById('likedMusicsCountTxt');
    if (likedCountTxt) {
        const favSize = AppState.favorites ? AppState.favorites.size : 0;
        likedCountTxt.textContent = `${favSize} ${favSize === 1 ? 'música' : 'músicas'}`;
    }

    if (!DOM.playlistsContainer) return;
    DOM.playlistsContainer.innerHTML = '';

    if (!AppState.userPlaylists || AppState.userPlaylists.length === 0) {
        DOM.playlistsContainer.innerHTML = `<div class="empty-state-box"><span class="material-symbols-rounded">folder_open</span><p>Nenhuma playlist criada ainda.</p></div>`;
        return;
    }

    AppState.userPlaylists.forEach(playlist => {
        const item = document.createElement('div');
        item.className = 'playlist-row-item';
        const count = playlist.musics ? playlist.musics.length : 0;

        const coverHtml = playlist.cover 
            ? `<img src="${playlist.cover}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">`
            : `<span class="material-symbols-rounded">queue_music</span>`;

        item.innerHTML = `
            <div class="playlist-item-left">
                <div class="playlist-icon-box">
                    ${coverHtml}
                </div>
                <div class="playlist-item-info">
                    <h3>${escapeHtml(playlist.name)}</h3>
                    <p>${count} ${count === 1 ? 'música' : 'músicas'}</p>
                </div>
            </div>
            <button class="playlist-more-btn">
                <span class="material-symbols-rounded">more_vert</span>
            </button>
        `;

        item.querySelector('.playlist-item-left').addEventListener('click', () => { openPlaylistDetail(playlist); });
        item.querySelector('.playlist-more-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.openPlaylistContextMenu === 'function') window.openPlaylistContextMenu(playlist);
        });

        DOM.playlistsContainer.appendChild(item);
    });
}

async function openPlaylistDetail(playlist, skipPush = false) {
    AppState.currentPlaylistFilter = playlist.id;

    // Atualiza URL
    if (!skipPush && window.getUrlForState) {
        const url = window.getUrlForState({ tab: 'biblioteca', playlistId: playlist.id });
        history.pushState({ tab: 'biblioteca', playlistId: playlist.id }, '', url);
    }

    // Garante que a aba biblioteca está ativa
    const bibTab = document.getElementById('biblioteca');
    if (bibTab && !bibTab.classList.contains('active')) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        bibTab.classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.nav-btn[data-tab="biblioteca"]')?.classList.add('active');
    }

    const rootView = document.getElementById('playlistsRootView');
    const detailView = document.getElementById('playlistDetailView');
    if (rootView) rootView.style.display = 'none';
    if (detailView) { detailView.style.display = 'block'; detailView.style.removeProperty('display'); detailView.style.display = 'block'; }

    const titleEl = document.getElementById('playlistDetailName');
    const countEl = document.getElementById('playlistDetailCount');
    const tracksContainer = document.getElementById('playlistTracksList');
    const coverEl = document.getElementById('playlistDetailCover');

    if (titleEl) titleEl.textContent = playlist.name;
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    // Atualiza cover
    if (coverEl) {
        if (playlist.cover) {
            coverEl.innerHTML = `<img src="${playlist.cover}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            coverEl.innerHTML = '<span class="material-symbols-rounded">queue_music</span>';
        }
    }

    if (!playlist.musics) playlist.musics = [];
    const playlistMusics = AppState.musics.filter(m => playlist.musics.includes(m.id));
    if (countEl) countEl.textContent = `${playlistMusics.length} ${playlistMusics.length === 1 ? 'música' : 'músicas'}`;

    // Botão Tocar tudo
    const playAllBtn = document.getElementById('playlistPlayAllBtn');
    if (playAllBtn) {
        const btn = playAllBtn.cloneNode(true);
        playAllBtn.parentNode.replaceChild(btn, playAllBtn);
        btn.addEventListener('click', () => {
            if (playlistMusics.length === 0) return;
            if (typeof window.setPlayContext === 'function')
                window.setPlayContext('playlist', playlistMusics, playlist.id);
            playMusicTrack(playlistMusics[0]);
        });
    }

    // Botão Aleatório
    const shuffleBtn = document.getElementById('playlistShuffleBtn');
    if (shuffleBtn) {
        const btn = shuffleBtn.cloneNode(true);
        shuffleBtn.parentNode.replaceChild(btn, shuffleBtn);
        btn.addEventListener('click', () => {
            if (playlistMusics.length === 0) return;
            AppState.isShuffle = true;
            if (typeof window.setPlayContext === 'function')
                window.setPlayContext('playlist', playlistMusics, playlist.id);
            const shuffleOrder = typeof window.buildShuffleOrder === 'function'
                ? window.buildShuffleOrder(playlistMusics)
                : [...playlistMusics];
            const rand = shuffleOrder[0] || playlistMusics[0];
            playMusicTrack(rand);
        });
    }

    if (playlistMusics.length === 0) {
        tracksContainer.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">music_note</span><p>Playlist vazia.</p></div>`;
        return;
    }

    // NÃO seta contexto aqui: abrir a tela de uma playlist não pode trocar
    // a fila do que está tocando (Spotify: contexto muda só ao TOCAR algo).
    // O clique em cada faixa define o contexto via createMusicCardElement.

    for (const music of playlistMusics) {
        if (typeof window.createMusicCardElement === 'function') {
            tracksContainer.appendChild(await window.createMusicCardElement(music));
        }
    }
}

async function openLikedMusicsDetail(skipPush = false) {
    AppState.currentPlaylistFilter = 'favorites';

    // Atualiza URL
    if (!skipPush && window.getUrlForState) {
        const url = window.getUrlForState({ tab: 'biblioteca', playlistId: 'favorites' });
        history.pushState({ tab: 'biblioteca', playlistId: 'favorites' }, '', url);
    }

    const rootViewFav = document.getElementById('playlistsRootView');
    const detailViewFav = document.getElementById('playlistDetailView');
    if (rootViewFav) rootViewFav.style.display = 'none';
    if (detailViewFav) detailViewFav.style.display = 'block';

    const titleEl = document.getElementById('playlistDetailName');
    if (titleEl) titleEl.textContent = "Músicas Curtidas";

    const tracksContainer = document.getElementById('playlistTracksList');
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    const likedMusics = AppState.musics.filter(m =>
        typeof window.isFavoriteTrack === 'function'
            ? window.isFavoriteTrack(m.id)
            : AppState.favorites && AppState.favorites.has(String(m.id))
    );

    const countEl = document.getElementById('playlistDetailCount');
    if (countEl) countEl.textContent = `${likedMusics.length} ${likedMusics.length === 1 ? 'música' : 'músicas'}`;

    if (likedMusics.length === 0) {
        tracksContainer.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">favorite</span><p>Nenhum favorito.</p></div>`;
        return;
    }

    // Contexto definido no clique de cada faixa, não ao abrir a tela.

    for (const music of likedMusics) {
        if (typeof window.createMusicCardElement === 'function') {
            tracksContainer.appendChild(await window.createMusicCardElement(music));
        }
    }
}

function closePlaylistDetail(skipPush = false) {
    AppState.currentPlaylistFilter = null;
    const rootView3 = document.getElementById('playlistsRootView');
    const detailView3 = document.getElementById('playlistDetailView');
    if (rootView3) rootView3.style.display = 'block';
    if (detailView3) detailView3.style.display = 'none';

    if (!skipPush && window.getUrlForState) {
        history.pushState({ tab: 'biblioteca' }, '', '/biblioteca');
    }

    renderPlaylists();
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
}

// ========== MODAL DE CRIAÇÃO/RENOMEAR PLAYLIST (com Supabase) ==========
function openCreatePlaylistModal() {
    AppState.playlistModalMode = 'create';
    AppState.selectedPlaylistForMenu = null;
    const modalTitle = document.getElementById('modalPlaylistTitle');
    if (modalTitle) {
        modalTitle.setAttribute('data-i18n', 'modal_new_playlist');
        modalTitle.textContent = window.t ? window.t('modal_new_playlist') : "Nova Playlist";
    }
    if (DOM.newPlaylistName) {
        DOM.newPlaylistName.value = '';
        setTimeout(() => DOM.newPlaylistName.focus(), 200);
    }
    // Reset preview de capa
    const preview = document.getElementById('playlistCoverPreview');
    if (preview) {
        preview.innerHTML = `<span class="material-symbols-rounded">add_photo_alternate</span><span class="playlist-modal-cover-hint">Capa</span>`;
    }
    const coverInput = document.getElementById('playlistCoverFile');
    if (coverInput) coverInput.value = '';
    if (DOM.playlistModal) DOM.playlistModal.classList.add('active');
}
window.openCreatePlaylistModal = openCreatePlaylistModal;

function setupPlaylistModal() {
    const modal = DOM.playlistModal || document.getElementById('playlistModal');
    const nameInput = DOM.newPlaylistName || document.getElementById('newPlaylistName');

    if (!modal || !nameInput) {
        console.warn('Elementos do modal de playlist não encontrados');
        return;
    }

    // Evita registrar a lógica de confirmação mais de uma vez
    if (window._playlistModalConfirmBound) {
        // Ainda assim garante os listeners auxiliares (capa, enter, clique fora)
    } else {
        window._playlistModalConfirmBound = true;

        // Delegação de evento no document: funciona mesmo que o botão seja
        // recriado/clonado por outro trecho do código, pois não depende de
        // uma referência fixa ao elemento.
        document.addEventListener('click', async (e) => {
            const confirmBtn = e.target.closest('#confirmModalBtn');
            const cancelBtn = e.target.closest('#cancelModalBtn');

            if (cancelBtn) {
                modal.classList.remove('active');
                return;
            }

            if (!confirmBtn) return;

            const currentNameInput = document.getElementById('newPlaylistName');
            const name = (currentNameInput?.value || '').trim();
            if (!name) {
                if (currentNameInput) {
                    currentNameInput.focus();
                    currentNameInput.style.borderColor = '#f87171';
                    currentNameInput.style.boxShadow = '0 0 0 3px rgba(248,113,113,0.2)';
                    setTimeout(() => { currentNameInput.style.borderColor = ''; currentNameInput.style.boxShadow = ''; }, 1500);
                }
                return;
            }

            // Fecha o modal IMEDIATAMENTE para feedback instantâneo
            modal.classList.remove('active');

            // Feedback visual imediato com toast
            if (AppState.playlistModalMode === 'create') {
                showToast(`Playlist "${name}" criada!`, 'success');
            } else {
                showToast(`Playlist atualizada!`, 'success');
            }

            // Cria/atualiza localmente AGORA (sem esperar upload de capa)
            let coverUrl = null;
            const coverFile = document.getElementById('playlistCoverFile')?.files?.[0];

            try {
                if (AppState.playlistModalMode === 'create') {
                    const newPlaylist = {
                        id: Date.now(),
                        name,
                        musics: [],
                        cover: null,  // capa será atualizada depois se houver
                        user_id: AppState.userId
                    };
                    if (!AppState.userPlaylists) AppState.userPlaylists = [];
                    AppState.userPlaylists.push(newPlaylist);
                    window.notifyHomeDataChanged?.('playlists');

                    // Atualiza UI imediatamente
                    if (typeof window.renderLibrary === 'function') window.renderLibrary();
                    if (typeof window.renderPlaylists === 'function') window.renderPlaylists();

                    // Salva em background (não bloqueia UI)
                    (async () => {
                        if (coverFile && typeof window.uploadFileToSupabase === 'function') {
                            try {
                                coverUrl = await window.uploadFileToSupabase(coverFile, `playlist-covers/${AppState.userId || 'anonymous'}`);
                                newPlaylist.cover = coverUrl;
                            } catch(e) { console.warn(e); }
                        }
                        if (AppState.userId && typeof window.saveUserPlaylist === 'function') {
                            await window.saveUserPlaylist({
                                id: newPlaylist.id,
                                user_id: AppState.userId,
                                name,
                                cover: coverUrl,
                                musics: []
                            });
                        }
                        await savePlaylists(AppState.userPlaylists);
                        if (coverUrl) {
                            if (typeof window.renderLibrary === 'function') window.renderLibrary();
                            if (typeof window.renderPlaylists === 'function') window.renderPlaylists();
                        }
                    })();
                }
                else if (AppState.playlistModalMode === 'rename' && AppState.selectedPlaylistForMenu) {
                    const oldPlaylist = AppState.selectedPlaylistForMenu;
                    oldPlaylist.name = name;
                    window.notifyHomeDataChanged?.('playlists');

                    // Atualiza UI imediatamente
                    if (typeof window.renderLibrary === 'function') window.renderLibrary();
                    if (typeof window.renderPlaylists === 'function') window.renderPlaylists();

                    // Salva em background
                    (async () => {
                        if (coverFile && typeof window.uploadFileToSupabase === 'function') {
                            try {
                                coverUrl = await window.uploadFileToSupabase(coverFile, `playlist-covers/${AppState.userId || 'anonymous'}`);
                                oldPlaylist.cover = coverUrl;
                            } catch(e) { console.warn(e); }
                        }
                        if (AppState.userId && typeof window.saveUserPlaylist === 'function') {
                            await window.saveUserPlaylist({
                                id: oldPlaylist.id,
                                user_id: AppState.userId,
                                name,
                                cover: coverUrl || oldPlaylist.cover,
                                musics: oldPlaylist.musics || []
                            });
                        }
                        await savePlaylists(AppState.userPlaylists);
                        if (coverUrl) {
                            if (typeof window.renderLibrary === 'function') window.renderLibrary();
                        }
                    })();
                }
            } catch (err) {
                console.error('[Playlist] Erro ao criar/atualizar playlist:', err);
                showToast('Não foi possível salvar a playlist', 'danger');
            }

            // Limpa formulário
            if (currentNameInput) currentNameInput.value = '';
            const coverInputEl = document.getElementById('playlistCoverFile');
            if (coverInputEl) coverInputEl.value = '';
            const previewEl = document.getElementById('playlistCoverPreview');
            if (previewEl) previewEl.innerHTML = `<span class="material-symbols-rounded">add_photo_alternate</span><span class="playlist-modal-cover-hint">Capa</span>`;
        });

        // Enter no campo de nome confirma rapidamente
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const activeModal = document.getElementById('playlistModal');
            if (!activeModal || !activeModal.classList.contains('active')) return;
            if (e.target.id !== 'newPlaylistName') return;
            document.getElementById('confirmModalBtn')?.click();
        });

        // Clique fora do conteúdo fecha o modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    // Preview ao escolher capa (pode ser religado com segurança a cada chamada)
    const coverInput = document.getElementById('playlistCoverFile');
    const coverPreview = document.getElementById('playlistCoverPreview');
    if (coverPreview && !coverPreview._boundClick) {
        coverPreview._boundClick = true;
        coverPreview.addEventListener('click', () => document.getElementById('playlistCoverFile')?.click());
    }
    if (coverInput && !coverInput._boundChange) {
        coverInput._boundChange = true;
        coverInput.addEventListener('change', () => {
            if (coverInput.files.length > 0 && coverPreview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    coverPreview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;"><span class="playlist-modal-cover-hint">Trocar</span>`;
                };
                reader.readAsDataURL(coverInput.files[0]);
            }
        });
    }
}

function setupPlaylistDetailEvents() {
    const backBtn = document.getElementById('backToPlaylistsBtn');
    if (backBtn) {
        backBtn.addEventListener('click', closePlaylistDetail);
    }
}

// Salvar playlists localmente e no Supabase (usado como fallback)
async function savePlaylists(playlists) {
    localStorage.setItem('supabase_player_playlists', JSON.stringify(playlists));
    window.notifyHomeDataChanged?.('playlists');
    // O download é iniciado depois do salvamento local, sem bloquear a UI.
    window.schedulePlaylistAutoDownloads?.(250);
    if (AppState.userId && typeof window.saveUserPlaylist === 'function') {
        // Não podemos salvar todas de uma vez sem loop, mas vamos apenas garantir que cada playlist exista
        for (const pl of playlists) {
            await window.saveUserPlaylist({
                id: pl.id,
                user_id: AppState.userId,
                name: pl.name,
                cover: pl.cover || null,
                musics: pl.musics || []
            });
        }
    }
}

function saveFavorites(favs) {
    localStorage.setItem('supabase_player_favorites', JSON.stringify(favs));
    // Supabase já lida com favoritos via toggleFavorite, não precisa salvar aqui
}

// Sobrescrever a exclusão de playlist para usar Supabase
async function deletePlaylist() {
    if (!AppState.selectedPlaylistForMenu) return;
    
    const playlistName = AppState.selectedPlaylistForMenu.name;
    
    showConfirmDialog('Excluir playlist', `Tem certeza que deseja excluir a playlist "${playlistName}"?`, async () => {
        if (AppState.userId && typeof window.deleteUserPlaylist === 'function') {
            const success = await window.deleteUserPlaylist(AppState.selectedPlaylistForMenu.id, AppState.userId);
            if (success) {
                AppState.userPlaylists = AppState.userPlaylists.filter(p => p.id !== AppState.selectedPlaylistForMenu.id);
                renderPlaylists();
                showToast("Playlist excluída", "danger");
                if (AppState.currentPlaylistFilter === AppState.selectedPlaylistForMenu.id) closePlaylistDetail();
            } else {
                showToast("Erro ao excluir playlist", "danger");
            }
        } else {
            // Fallback local
            AppState.userPlaylists = AppState.userPlaylists.filter(p => p.id !== AppState.selectedPlaylistForMenu.id);
            savePlaylists(AppState.userPlaylists);
            renderPlaylists();
            showToast("Playlist excluída", "danger");
            if (AppState.currentPlaylistFilter === AppState.selectedPlaylistForMenu.id) closePlaylistDetail();
        }
        closeContextMenu();
    });
}

// Redirecionar a exclusão antiga para a nova
window.deletePlaylist = deletePlaylist;

// Remover a função antiga se existir
if (typeof window.oldDeletePlaylist !== 'undefined') {
    window.oldDeletePlaylist = deletePlaylist;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Exportações globais
window.renderPlaylists = renderPlaylists;
window.openPlaylistDetail = openPlaylistDetail;
window.openLikedMusicsDetail = openLikedMusicsDetail;
window.closePlaylistDetail = closePlaylistDetail;
window.setupPlaylistModal = setupPlaylistModal;
window.setupPlaylistDetailEvents = setupPlaylistDetailEvents;
window.savePlaylists = savePlaylists;
window.saveFavorites = saveFavorites;
window.openCreatePlaylistModal = openCreatePlaylistModal;