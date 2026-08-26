// ===== MENU DE CONTEXTO (completo e funcional) =====

let pendingMusicForPlaylist = null;

function initMenusAndSearch() {
    // Configuração da busca (se existir)
    if (DOM.searchInput) {
        // Evita duplicação de listeners
        const searchInputEl = document.getElementById('searchInput');
        if (searchInputEl && searchInputEl !== DOM.searchInput) {
            DOM.searchInput = searchInputEl;
        }
        
        DOM.searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll('#musicList .music-card');
            cards.forEach(card => {
                const title = card.querySelector('.music-card-details h3')?.textContent.toLowerCase() || '';
                const artist = card.querySelector('.music-card-details p')?.textContent.toLowerCase() || '';
                if (title.includes(term) || artist.includes(term)) {
                    card.style.setProperty('display', 'flex', 'important');
                } else {
                    card.style.setProperty('display', 'none', 'important');
                }
            });
        });

        DOM.searchInput.addEventListener('focus', () => {
            const navBar = document.querySelector('.nav-bar');
            if (navBar) navBar.style.setProperty('display', 'none', 'important');
            if (DOM.playerBottomBar) DOM.playerBottomBar.style.setProperty('display', 'none', 'important');
        });

        DOM.searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const navBar = document.querySelector('.nav-bar');
                if (navBar) navBar.style.setProperty('display', 'flex', 'important');
                if (DOM.playerBottomBar && AppState.currentMusicId) {
                    DOM.playerBottomBar.style.setProperty('display', 'flex', 'important');
                }
            }, 180);
        });
    }

    // Configuração do backdrop para fechar o menu
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (backdrop) {
        backdrop.removeEventListener('click', closeContextMenu);
        backdrop.addEventListener('click', closeContextMenu);
    }

    setupAddToPlaylistModalSpotify();
}

// ========== MODAL ADICIONAR À PLAYLIST ==========
function setupAddToPlaylistModalSpotify() {
    const modal = document.getElementById('addToPlaylistModal');
    const subModal = document.getElementById('createPlaylistSubModal');
    const searchInput = document.getElementById('playlistSearchInput');
    const listContainer = document.getElementById('playlistSelectList');
    const openCreateBtn = document.getElementById('openCreatePlaylistFromAddBtn');
    const subNameInput = document.getElementById('subNewPlaylistName');
    const cancelSubBtn = document.getElementById('cancelSubModalBtn');
    const confirmSubBtn = document.getElementById('confirmSubModalBtn');

    if (!modal) return;

    function renderPlaylistList(filterText = '') {
        if (!listContainer) return;
        const filtered = AppState.userPlaylists.filter(p => 
            p.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        if (filtered.length === 0) {
            listContainer.innerHTML = `<div style="padding:24px; text-align:center; color:rgba(255,255,255,0.4);">Nenhuma playlist encontrada</div>`;
            return;
        }

        listContainer.innerHTML = '';
        filtered.forEach(playlist => {
            const count = playlist.musics ? playlist.musics.length : 0;
            const alreadyIn = !!(pendingMusicForPlaylist && playlist.musics?.includes(pendingMusicForPlaylist.id));
            const item = document.createElement('div');
            item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px; border-radius:12px; cursor:pointer; transition:0.1s; margin-bottom:4px;';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:44px; height:44px; background:rgba(146,76,255,0.2); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                        <span class="material-symbols-rounded" style="color:#b07fff;">playlist_play</span>
                    </div>
                    <div>
                        <div style="font-weight:600;">${escapeHtml(playlist.name)}</div>
                        <div style="font-size:12px; color:rgba(255,255,255,0.5);">${count} ${count === 1 ? 'música' : 'músicas'}</div>
                    </div>
                </div>
                <span class="material-symbols-rounded" style="color:${alreadyIn ? '#f87171' : 'rgba(255,255,255,0.3)'};">${alreadyIn ? 'remove_circle' : 'add_circle'}</span>
            `;
            item.addEventListener('click', () => {
                if (!pendingMusicForPlaylist) return;
                if (playlist.musics?.includes(pendingMusicForPlaylist.id)) {
                    removeTrackFromPlaylistById(pendingMusicForPlaylist.id, playlist.id);
                } else {
                    addTrackToPlaylist(pendingMusicForPlaylist, playlist.id);
                }
                // Re-renderiza a lista (não fecha o modal) para o ícone
                // atualizar na hora — o usuário pode querer marcar/desmarcar
                // a mesma música em várias playlists em sequência.
                renderPlaylistList(searchInput ? searchInput.value : '');
            });
            listContainer.appendChild(item);
        });
    }

    function openAddToPlaylistModal(music) {
        pendingMusicForPlaylist = music;
        renderPlaylistList('');
        if (searchInput) searchInput.value = '';
        modal.classList.add('active');
    }

    function closeAddToPlaylistModal() {
        modal.classList.remove('active');
        pendingMusicForPlaylist = null;
        if (searchInput) searchInput.value = '';
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderPlaylistList(e.target.value);
        });
    }

    if (openCreateBtn) {
        openCreateBtn.addEventListener('click', () => {
            if (subModal) subModal.classList.add('active');
        });
    }

    if (confirmSubBtn && subNameInput && subModal) {
        confirmSubBtn.addEventListener('click', () => {
            const name = subNameInput.value.trim();
            if (!name) return;
            
            const newPlaylist = { id: Date.now(), name: name, musics: [] };
            if (!AppState.userPlaylists) AppState.userPlaylists = [];
            AppState.userPlaylists.push(newPlaylist);
            savePlaylists(AppState.userPlaylists);
            
            if (pendingMusicForPlaylist) {
                addTrackToPlaylist(pendingMusicForPlaylist, newPlaylist.id);
                closeAddToPlaylistModal();
            } else {
                renderPlaylistList('');
                showToast(`Playlist "${name}" criada!`, "success");
            }
            
            subNameInput.value = '';
            subModal.classList.remove('active');
            renderPlaylists();
        });
    }

    if (cancelSubBtn && subModal) {
        cancelSubBtn.addEventListener('click', () => {
            subModal.classList.remove('active');
            if (subNameInput) subNameInput.value = '';
        });
        subModal.addEventListener('click', (e) => {
            if (e.target === subModal) {
                subModal.classList.remove('active');
                if (subNameInput) subNameInput.value = '';
            }
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAddToPlaylistModal();
    });

    window.openAddToPlaylistModal = openAddToPlaylistModal;
}

// ========== ABRIR MENU (TRÊS PONTINHOS) ==========
function openContextMenu(music) {
    if (!music) return;
    AppState.selectedTrackForMenu = music;
    const menu = document.getElementById('contextMenuModal');
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (!menu || !backdrop) return;

    const inPlaylist = AppState.currentPlaylistFilter && AppState.currentPlaylistFilter !== 'favorites';
    const isFav = typeof window.isFavoriteTrack === 'function'
        ? window.isFavoriteTrack(music.id)
        : AppState.favorites && AppState.favorites.has(String(music.id));

    menu.innerHTML = `
        <div class="ctx-header">
            <img class="ctx-cover" src="${typeof sanitizeUrl === 'function' ? sanitizeUrl(music.cover) : (music.cover || '')}" onerror="this.style.display='none'">
            <div class="ctx-header-info">
                <span class="ctx-title">${escapeHtml(music.title)}</span>
                <span class="ctx-artist">${escapeHtml(music.artist)}</span>
            </div>
        </div>
        <div class="ctx-divider"></div>
        <div class="ctx-options">
            <button id="menuAddToQueue" class="ctx-btn">
                <div class="ctx-icon ctx-icon-purple"><span class="material-symbols-rounded">add_to_queue</span></div>
                <span>Adicionar à fila</span>
            </button>
            <button id="menuAddToPlaylist" class="ctx-btn">
                <div class="ctx-icon ctx-icon-blue"><span class="material-symbols-rounded">playlist_add</span></div>
                <span>Adicionar à playlist</span>
            </button>
            <button id="menuFavoriteTrack" class="ctx-btn">
                <div class="ctx-icon ctx-icon-pink"><span class="material-symbols-rounded">${isFav ? 'favorite' : 'favorite_border'}</span></div>
                <span>${isFav ? 'Desfavoritar' : 'Favoritar'}</span>
            </button>
            <button id="menuDownloadTrack" class="ctx-btn">
                <div class="ctx-icon ctx-icon-green"><span class="material-symbols-rounded">download</span></div>
                <span>Baixar música</span>
            </button>
            ${inPlaylist ? `
            <button id="menuRemoveFromPlaylist" class="ctx-btn ctx-btn-danger">
                <div class="ctx-icon ctx-icon-red"><span class="material-symbols-rounded">remove_circle</span></div>
                <span>Remover desta playlist</span>
            </button>` : ''}
        </div>
    `;

    menu.classList.add('active');
    backdrop.classList.add('active');
}


function closeContextMenu() {
    const menu = document.getElementById('contextMenuModal');
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (menu) menu.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    AppState.selectedTrackForMenu = null;
}

// ========== AÇÕES DO MENU ==========
function addTrackToPlaylist(music, playlistId) {
    const playlist = AppState.userPlaylists.find(p => p.id === playlistId);
    if (playlist && !playlist.musics.includes(music.id)) {
        playlist.musics.push(music.id);
        savePlaylists(AppState.userPlaylists);
        renderPlaylists();
        showToast(`Adicionado à playlist "${playlist.name}"`, "success");
    } else if (playlist) {
        showToast("Música já está na playlist", "danger");
    }
}

// Remove uma música de uma playlist específica, por id — usado pelo botão
// "−" do modal "Adicionar à playlist" quando a música já está lá dentro.
// Diferente de removeTrackFromCurrentPlaylist: não depende da playlist
// estar aberta/em foco (AppState.currentPlaylistFilter), recebe o id direto.
function removeTrackFromPlaylistById(musicId, playlistId) {
    const playlist = AppState.userPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;
    playlist.musics = playlist.musics.filter(id => id !== musicId);
    savePlaylists(AppState.userPlaylists);
    renderPlaylists();
    showToast(`Removido da playlist "${playlist.name}"`, "danger");
}

function removeTrackFromCurrentPlaylist(musicId) {
    if (!AppState.currentPlaylistFilter || AppState.currentPlaylistFilter === 'favorites') return;
    const playlist = AppState.userPlaylists.find(p => p.id === AppState.currentPlaylistFilter);
    if (playlist) {
        playlist.musics = playlist.musics.filter(id => id !== musicId);
        savePlaylists(AppState.userPlaylists);
        openPlaylistDetail(playlist);
        showToast("Música removida da playlist", "danger");
    }
}

function openPlaylistContextMenu(playlist) {
    AppState.selectedPlaylistForMenu = playlist;
    const menu = document.getElementById('contextMenuModal');
    const backdrop = document.getElementById('contextMenuBackdrop');
    if (menu && backdrop) {
        menu.innerHTML = `
            <div class="ctx-header">
                <div class="ctx-icon ctx-icon-purple" style="width:48px;height:48px;border-radius:12px;flex-shrink:0;">
                    <span class="material-symbols-rounded" style="font-size:26px;">queue_music</span>
                </div>
                <div class="ctx-header-info">
                    <span class="ctx-title">${escapeHtml(playlist.name)}</span>
                    <span class="ctx-artist">${(playlist.musics?.length || 0)} músicas</span>
                </div>
            </div>
            <div class="ctx-divider"></div>
            <div class="ctx-options">
                <button id="menuRenamePlaylist" class="ctx-btn">
                    <div class="ctx-icon ctx-icon-blue">
                        <span class="material-symbols-rounded">edit</span>
                    </div>
                    <span>Renomear playlist</span>
                </button>
                <button id="menuDownloadPlaylist" class="ctx-btn">
                    <div class="ctx-icon ctx-icon-green">
                        <span class="material-symbols-rounded">download_for_offline</span>
                    </div>
                    <span>Baixar todas as músicas</span>
                </button>
                <button id="menuDeletePlaylist" class="ctx-btn ctx-btn-danger">
                    <div class="ctx-icon ctx-icon-red">
                        <span class="material-symbols-rounded">delete</span>
                    </div>
                    <span>Excluir playlist</span>
                </button>
            </div>
        `;
        menu.classList.add('active');
        backdrop.classList.add('active');
        
        const renameBtn = document.getElementById('menuRenamePlaylist');
        const deleteBtn = document.getElementById('menuDeletePlaylist');
        
        if (renameBtn) {
            renameBtn.addEventListener('click', () => { 
                triggerRenamePlaylistForm(); 
                closeContextMenu(); 
            });
        }

        // ── Baixar todas as músicas da playlist ──────────────────────────────
        const downloadBtn = document.getElementById('menuDownloadPlaylist');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                closeContextMenu();
                const pl = AppState.selectedPlaylistForMenu;
                if (!pl?.musics?.length) {
                    showToast('Playlist vazia', 'danger');
                    return;
                }

                // Resolve objetos completos das músicas da playlist
                const plMusics = AppState.musics.filter(m =>
                    pl.musics.includes(m.id) || pl.musics.includes(String(m.id))
                );
                if (!plMusics.length) {
                    showToast('Nenhuma música encontrada na playlist', 'danger');
                    return;
                }

                showToast(`Iniciando download de ${plMusics.length} músicas…`, 'success');

                let done = 0, failed = 0;
                for (const music of plMusics) {
                    try {
                        // Verifica se já está em cache (evita re-download)
                        const db = await window.openCacheDB?.();
                        if (db) {
                            const alreadyCached = await new Promise(res => {
                                const tx = db.transaction(['audio'], 'readonly');
                                const req = tx.objectStore('audio').get(music.id);
                                req.onsuccess = () => res(!!req.result);
                                req.onerror   = () => res(false);
                            });
                            if (alreadyCached) { done++; continue; }
                        }

                        // silent=true: suprime toasts individuais de progresso
                        const ok = await window.cacheAudio(music, true);
                        if (ok) done++;
                        else    failed++;
                    } catch {
                        failed++;
                    }
                }

                if (failed === 0) {
                    showToast(`✅ ${done} músicas salvas para ouvir offline!`, 'success');
                } else {
                    showToast(`${done} salvas · ${failed} com erro`, 'danger');
                }
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => { 
                // Usa o modal estilizado em vez de confirm nativo
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
                closeContextMenu(); // Fecha o menu de contexto antes do modal
            });
        }
    }
}

function triggerRenamePlaylistForm() {
    if (!AppState.selectedPlaylistForMenu) return;
    AppState.playlistModalMode = 'rename';
    const modalTitle = document.getElementById('modalPlaylistTitle');
    if (modalTitle) { modalTitle.removeAttribute('data-i18n'); modalTitle.textContent = "Renomear Playlist"; }
    const nameInput = document.getElementById('newPlaylistName');
    if (nameInput) nameInput.value = AppState.selectedPlaylistForMenu.name;
    const modal = document.getElementById('playlistModal');
    if (modal) modal.classList.add('active');
    closeContextMenu();
}

function deletePlaylist() {
    if (!AppState.selectedPlaylistForMenu) return;
    if (confirm(`Tem certeza que deseja excluir a playlist "${AppState.selectedPlaylistForMenu.name}"?`)) {
        AppState.userPlaylists = AppState.userPlaylists.filter(p => p.id !== AppState.selectedPlaylistForMenu.id);
        savePlaylists(AppState.userPlaylists);
        renderPlaylists();
        showToast("Playlist excluída", "danger");
        if (AppState.currentPlaylistFilter === AppState.selectedPlaylistForMenu.id) closePlaylistDetail();
    }
    closeContextMenu();
}

// Evento global para capturar cliques nos botões do menu
// Suporta tanto .ctx-btn (novo) quanto .menu-option-btn (compat)
document.addEventListener('click', (e) => {
    const button = e.target.closest('.ctx-btn, .menu-option-btn');
    if (!button) return;

    const music = AppState.selectedTrackForMenu;
    const action = button.id;
    if (!action) return;

    e.stopPropagation();

    switch (action) {
        case 'menuAddToQueue':
            if (music) {
                if (!AppState.queue) AppState.queue = [];
                AppState.queue.push(music);
                showToast(`"${music.title}" adicionada à fila`, 'success');
                if (typeof window.renderQueuePanel === 'function') window.renderQueuePanel();
            }
            closeContextMenu();
            break;

        case 'menuAddToPlaylist':
            if (music && typeof window.openAddToPlaylistModal === 'function') {
                window.openAddToPlaylistModal(music);
            }
            closeContextMenu();
            break;

        case 'menuFavoriteTrack':
            if (music && typeof window.toggleFavoriteTrack === 'function') {
                window.toggleFavoriteTrack(music.id);
            }
            closeContextMenu();
            break;

        case 'menuDownloadTrack':
            if (music && typeof window.toggleOfflineMusic === 'function') {
                window.toggleOfflineMusic(music);
            } else if (music && typeof window.cacheAudio === 'function') {
                window.cacheAudio(music);
            }
            closeContextMenu();
            break;

        case 'menuRemoveFromPlaylist':
            if (music) removeTrackFromCurrentPlaylist(music.id);
            closeContextMenu();
            break;

        case 'menuDeleteMusic':
            if (music && confirm('Excluir esta música permanentemente?')) {
                if (typeof deleteMusicPermanently === 'function') deleteMusicPermanently(music);
            }
            closeContextMenu();
            break;

        case 'menuRenamePlaylist':
            triggerRenamePlaylistForm();
            break;

        case 'menuDeletePlaylist':
            deletePlaylist();
            break;

        default:
            break;
    }
});

// Fechar com tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeContextMenu();
    }
});

// ========== PAINEL DE FILA ==========
function openQueuePanel() {
    const panel = document.getElementById('queuePanel');
    const backdrop = document.getElementById('queueBackdrop');
    if (!panel) return;
    renderQueuePanel();
    panel.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
}

function closeQueuePanel() {
    const panel = document.getElementById('queuePanel');
    const backdrop = document.getElementById('queueBackdrop');
    if (panel) panel.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
}

function renderQueuePanel() {
    const list = document.getElementById('queuePanelList');
    if (!list) return;

    // Se há uma música tocando, mantém uma fila contínua antes de renderizar.
    window.ensureAutoQueue?.();
    const manualQueue = AppState.queue || [];
    const autoQueue = AppState.autoQueue || [];
    const hasAnything = manualQueue.length > 0 || autoQueue.length > 0;

    if (!hasAnything) {
        list.innerHTML = `
            <div class="qp-empty">
                <span class="material-symbols-rounded">queue_music</span>
                <p>Fila vazia</p>
                <span>Toque em uma música para começar</span>
            </div>`;
        return;
    }

    list.innerHTML = '';

    function makeItem(music, idx, isManual) {
        const isCurrent = AppState.currentMusicId === music.id;
        const item = document.createElement('div');
        item.className = `qp-item${isCurrent ? ' qp-item--current' : ''}`;
        const cover = typeof sanitizeUrl === 'function' ? sanitizeUrl(music.cover) : (music.cover || '');
        item.innerHTML = `
            <span class="qp-index">${isCurrent
                ? `<span class="qp-eq"><span></span><span></span><span></span></span>`
                : (idx + 1)}</span>
            ${cover
                ? `<img src="${cover}" class="qp-cover" onerror="this.style.display='none'">`
                : `<div class="qp-cover qp-cover--ph"><span class="material-symbols-rounded">music_note</span></div>`}
            <div class="qp-info">
                <p class="qp-title">${escapeHtml(music.title)}</p>
                <p class="qp-artist">${escapeHtml(music.artist)}</p>
            </div>
            ${isManual
                ? `<button class="qp-remove" aria-label="Remover"><span class="material-symbols-rounded">close</span></button>`
                : ''}
        `;
        if (isManual) {
            item.querySelector('.qp-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                AppState.queue.splice(idx, 1);
                renderQueuePanel();
            });
        }
        item.addEventListener('click', (e) => {
            if (e.target.closest('.qp-remove')) return;
            if (isManual) AppState.queue = AppState.queue.slice(idx);
            else AppState.autoQueue = AppState.autoQueue.slice(idx);
            playMusicTrack(music);
            closeQueuePanel();
        });
        return item;
    }

    if (manualQueue.length > 0) {
        const label = document.createElement('p');
        label.className = 'qp-label';
        label.textContent = 'Na fila';
        list.appendChild(label);
        manualQueue.forEach((music, idx) => list.appendChild(makeItem(music, idx, true)));
    }

    if (autoQueue.length > 0) {
        const label = document.createElement('p');
        label.className = 'qp-label';
        label.textContent = 'A seguir';
        list.appendChild(label);
        // A fila completa é exibida para o usuário saber todas as músicas
        // que serão reproduzidas nesta sequência.
        autoQueue.forEach((music, idx) => list.appendChild(makeItem(music, idx, false)));
    }
}

// Exposição global
window.initMenusAndSearch = initMenusAndSearch;
window.openContextMenu = openContextMenu;
window.openPlaylistContextMenu = openPlaylistContextMenu;
window.closeContextMenu = closeContextMenu;
window.addTrackToPlaylist = addTrackToPlaylist;
window.removeTrackFromPlaylistById = removeTrackFromPlaylistById;
window.removeTrackFromCurrentPlaylist = removeTrackFromCurrentPlaylist;
window.triggerRenamePlaylistForm = triggerRenamePlaylistForm;
window.openQueuePanel = openQueuePanel;
window.closeQueuePanel = closeQueuePanel;
window.renderQueuePanel = renderQueuePanel;