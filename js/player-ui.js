// ===== INTERFACE DAS NOVAS ABAS (player-ui.js completo) =====

const FEATURED_RECOMMENDATION_TTL = 10 * 60 * 1000;

let _cachedMusicsSnapshot = null;
let _cachedMusicsSnapshotAt = 0;
let _cachedMusicsRequest = null;
async function _getCachedMusicsSnapshot(force = false) {
    const now = Date.now();
    if (!force && _cachedMusicsSnapshot && now - _cachedMusicsSnapshotAt < 5000) {
        return _cachedMusicsSnapshot;
    }
    if (_cachedMusicsRequest) return _cachedMusicsRequest;
    _cachedMusicsRequest = Promise.resolve(window.getAllCachedMusics?.() || [])
        .then(list => {
            _cachedMusicsSnapshot = Array.isArray(list) ? list : [];
            _cachedMusicsSnapshotAt = Date.now();
            return _cachedMusicsSnapshot;
        })
        .catch(() => _cachedMusicsSnapshot || [])
        .finally(() => { _cachedMusicsRequest = null; });
    return _cachedMusicsRequest;
}
window.addEventListener('fenda:offlineCacheChanged', () => {
    _cachedMusicsSnapshot = null;
    _cachedMusicsSnapshotAt = 0;
});

function featuredRecommendationKey() {
    return `fenda_featured_recommendation_${AppState?.userId || 'guest'}`;
}

function readFeaturedRecommendation() {
    try {
        const raw = localStorage.getItem(featuredRecommendationKey());
        const cached = raw ? JSON.parse(raw) : null;
        if (!cached?.musicId || !cached?.updatedAt) return null;
        if (Date.now() - Number(cached.updatedAt) >= FEATURED_RECOMMENDATION_TTL) return null;
        const music = AppState.musics.find(m => String(m.id) === String(cached.musicId));
        return music ? { music, updatedAt: Number(cached.updatedAt) } : null;
    } catch { return null; }
}

function saveFeaturedRecommendation(music, updatedAt = Date.now()) {
    try {
        localStorage.setItem(featuredRecommendationKey(), JSON.stringify({
            musicId: music.id,
            updatedAt,
        }));
    } catch {}
}

function scheduleFeaturedRecommendationRefresh(updatedAt) {
    if (window._featuredTimer) clearTimeout(window._featuredTimer);
    const remaining = Math.max(1000, FEATURED_RECOMMENDATION_TTL - (Date.now() - updatedAt) + 50);
    window._featuredTimer = setTimeout(() => {
        window._featuredTimer = null;
        updateFeaturedMusic();
    }, remaining);
}

function updateFeaturedMusic() {
    const titleEl = document.getElementById('featuredTitle');
    const artistEl = document.getElementById('featuredArtist');

    if (!AppState.musics.length) return;

    // A recomendação fica estável por 10 minutos, inclusive ao trocar de
    // aba, atualizar a home ou receber novos dados do catálogo.
    const cached = readFeaturedRecommendation();
    let music = cached?.music;
    let updatedAt = cached?.updatedAt;

    if (!music) {
        const recs = (typeof window.getRecommendations === 'function')
            ? window.getRecommendations(5, { discovery: 0.55 })
            : [];
        music = recs.length > 0
            ? recs[Math.floor(Math.random() * recs.length)]
            : AppState.musics[Math.floor(Math.random() * AppState.musics.length)];
        if (!music) return;
        updatedAt = Date.now();
        saveFeaturedRecommendation(music, updatedAt);
    }
    scheduleFeaturedRecommendationRefresh(updatedAt);

    const bg = document.getElementById('featuredBg');
    const banner = document.getElementById('featuredBanner');

    // Remove data-i18n="loading" antes de escrever o valor real, para que
    // atualizações de tradução não devolvam o título ao placeholder.
    if (titleEl) { titleEl.removeAttribute('data-i18n'); titleEl.textContent = music.title; }
    if (artistEl) artistEl.textContent = music.artist;

    if (bg && music.cover) {
        bg.style.backgroundImage = `url(${music.cover})`;
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center';
    }

    const featuredBtn = document.getElementById('featuredPlayBtn');
    if (featuredBtn) {
        const newBtn = featuredBtn.cloneNode(true);
        featuredBtn.parentNode.replaceChild(newBtn, featuredBtn);
        newBtn.addEventListener('click', (e) => { e.stopPropagation(); playMusicTrack(music); });
    }

    if (banner) {
        banner._featuredMusic = music;
        if (!banner._listenerAdded) {
            banner._listenerAdded = true;
            banner.addEventListener('click', () => {
                if (banner._featuredMusic) playMusicTrack(banner._featuredMusic);
            });
        }
    }
}

function captureHomeUiState() {
    const main = document.querySelector('.main-content');
    const selectors = ['.recent-grid', '.popular-track', '.carousel-track', '.recommended-track'];
    const tracks = [];
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((track, index) => {
            tracks.push({ key: `${selector}:${index}`, scrollLeft: track.scrollLeft });
        });
    });
    const active = document.activeElement;
    return {
        scrollTop: main?.scrollTop || 0,
        scrollLeft: main?.scrollLeft || 0,
        tracks,
        activeId: active?.id || null,
        capturedAt: Date.now(),
    };
}

function restoreHomeUiState(state = window._homeUiState) {
    if (!state) return;
    const main = document.querySelector('.main-content');
    if (main) {
        main.scrollTop = state.scrollTop;
        main.scrollLeft = state.scrollLeft;
    }
    const selectors = ['.recent-grid', '.popular-track', '.carousel-track', '.recommended-track'];
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((track, index) => {
            const saved = state.tracks.find(item => item.key === `${selector}:${index}`);
            if (saved) track.scrollLeft = saved.scrollLeft;
        });
    });
    if (state.activeId) {
        const active = document.getElementById(state.activeId);
        if (active && document.getElementById('inicio')?.contains(active)) {
            try { active.focus({ preventScroll: true }); } catch { active.focus(); }
        }
    }
}

function syncHomeTrackAlignment(trackOrSelector, { resetScroll = false } = {}) {
    const track = typeof trackOrSelector === 'string'
        ? document.querySelector(trackOrSelector)
        : trackOrSelector;
    if (!track) return;

    const apply = () => {
        // Trilhas inseridas dinamicamente podem ser medidas antes de o layout
        // terminar. Nesse caso, aguarda o próximo frame para não centralizar
        // uma trilha que ainda está com largura zero.
        if (!track.isConnected || track.clientWidth === 0) return;
        const overflowing = track.scrollWidth > track.clientWidth + 1;
        track.classList.toggle('track-centered', !overflowing);
        if (resetScroll) track.scrollLeft = 0;
    };
    if (window.requestAnimationFrame) {
        requestAnimationFrame(() => {
            apply();
            requestAnimationFrame(apply);
        });
    } else setTimeout(apply, 0);
}

let _homeRefreshQueued = false;
function queueHomeBackgroundRefresh() {
    if (_homeRefreshQueued) return;
    _homeRefreshQueued = true;
    const run = () => {
        _homeRefreshQueued = false;
        window.refreshHomeInBackground?.();
    };
    if (window.requestAnimationFrame) requestAnimationFrame(run);
    else setTimeout(run, 0);
}

window.syncHomeTrackAlignment = syncHomeTrackAlignment;
window.captureHomeUiState = captureHomeUiState;
window.restoreHomeUiState = restoreHomeUiState;
window.addEventListener('fenda:homeDataChanged', queueHomeBackgroundRefresh);
window.addEventListener('resize', () => {
    document.querySelectorAll('.recent-grid, .popular-track, .recommended-track').forEach(track =>
        syncHomeTrackAlignment(track, { resetScroll: false })
    );
});

function renderHome({ preserveUi = true } = {}) {
    // Atualizações automáticas preservam a posição do usuário na home.
    const homeUiState = preserveUi ? captureHomeUiState() : null;
    window._homeUiState = homeUiState;

    // updateFeaturedMusic consulta o cache e só troca a faixa após 10 minutos.
    updateFeaturedMusic();

    // Retry de segurança: se o catálogo (AppState.musics) ainda não tiver
    // chegado no momento desta chamada, updateFeaturedMusic() sai sem
    // tocar o DOM e nada mais dispara renderHome() de novo sozinho — o
    // card "Recomendação do dia" ficava preso no placeholder "Carregando..."
    // até o usuário trocar de aba manualmente. Replicando o mesmo padrão
    // de retry de inicio-extras.js (linhas 686-689) para este card também.
    if (navigator.onLine && !AppState.musics.length && !window._featuredRetryScheduled) {
        window._featuredRetryScheduled = true;
        const retry = () => {
            updateFeaturedMusic();
            if (AppState.musics.length) {
                window._featuredRetryScheduled = false;
            } else if ((window._featuredRetryCount = (window._featuredRetryCount || 0) + 1) < 10) {
                setTimeout(retry, 1000); // tenta de novo a cada 1s, até 10x (~10s)
            } else {
                window._featuredRetryScheduled = false; // desiste, timer de 10min ainda cobre
            }
        };
        setTimeout(retry, 1000);
    }

    const recentContainer = document.getElementById('recentlyPlayedList');
    if (recentContainer) {
        // Mostra as últimas 20 músicas ouvidas — sem repetição
        // Cada música aparece só uma vez (a mais recente), mesmo que tenha
        // sido tocada várias vezes. Dedup por music ID.
        const _recentSeen = new Set();
        const recentMusics = AppState.history
            .filter(item => {
                const id = item.id ?? item.trackId;
                if (_recentSeen.has(id)) return false;
                _recentSeen.add(id);
                return true;
            })
            .slice(0, 20)
            .map(item => AppState.musics.find(m => m.id === (item.id ?? item.trackId)))
            .filter(Boolean);
        recentContainer.innerHTML = recentMusics.map(music => `
            <div class="music-card-horizontal" data-id="${music.id}">
                <img src="${sanitizeUrl(music.cover)}" loading="lazy">
                <h4>${escapeHtml(music.title)}</h4>
                <p>${escapeHtml(music.artist)}</p>
            </div>
        `).join('');
        syncHomeTrackAlignment(recentContainer, { resetScroll: false });
        document.querySelectorAll('#recentlyPlayedList .music-card-horizontal').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                const music = AppState.musics.find(m => m.id === id);
                if (music) {
                    if (typeof window.setPlayContext === 'function')
                        window.setPlayContext('history', recentMusics);
                    playMusicTrack(music);
                }
            });
        });
    }

    const favArtistsContainer = document.getElementById('favoriteArtistsList');
    if (favArtistsContainer) {
        // Usa contagem de plays (playCounts) para os 3 artistas mais ouvidos
        // Agrupa plays por artista com .trim() para evitar duplicatas
        // causadas por espaços invisíveis ou variações no banco de dados
        const artistPlays = new Map();
        AppState.musics.forEach(m => {
            const artist = (m.artist || '').trim();
            if (!artist) return;
            const plays = playCounts[m.id] || 0;
            if (plays > 0) {
                artistPlays.set(artist, (artistPlays.get(artist) || 0) + plays);
            }
        });
        // Fallback: se não há plays, usa favoritos
        if (artistPlays.size === 0) {
            const favMusics = AppState.musics.filter(m =>
                typeof window.isFavoriteTrack === 'function'
                    ? window.isFavoriteTrack(m.id)
                    : AppState.favorites.has(String(m.id))
            );
            favMusics.forEach(m => {
                const artist = (m.artist || '').trim();
                if (artist) artistPlays.set(artist, (artistPlays.get(artist) || 0) + 1);
            });
        }
        const topArtists = Array.from(artistPlays.entries())
            .sort((a,b) => b[1] - a[1])
            .slice(0, 3)
            .map(([artist, plays]) => ({ artist, plays }));

        if (!topArtists.length) {
            favArtistsContainer.innerHTML = `<div class="empty-state" style="background:none;padding:20px 0;"><span class="material-symbols-rounded">person</span><p style="font-size:13px;">Ouça músicas para ver seus artistas</p></div>`;
        } else {
            favArtistsContainer.innerHTML = topArtists.map(({ artist, plays }) => {
                const cover = AppState.musics.find(m => m.artist === artist)?.cover || '';
                const playsText = plays === 1 ? '1 play' : `${plays} plays`;
                return `
                    <div class="artist-card" data-artist="${escapeHtml(artist)}">
                        <div class="artist-avatar">
                            ${cover ? `<img src="${sanitizeUrl(cover)}" onerror="this.style.display='none'" loading="lazy">` : ''}
                            <span class="material-symbols-rounded" ${cover ? 'style="display:none"' : ''}>person</span>
                        </div>
                        <p>${escapeHtml(artist)}</p>
                        <span class="artist-card-plays">${playsText}</span>
                    </div>
                `;
            }).join('');
        }
        document.querySelectorAll('.artist-card').forEach(card => {
            card.addEventListener('click', () => {
                const artist = card.dataset.artist;
                if (typeof window.openArtistDetail === 'function') {
                    window.openArtistDetail(artist);
                } else {
                    const artistMusics = AppState.musics.filter(m => m.artist === artist);
                    if (artistMusics.length) playMusicTrack(artistMusics[0]);
                }
            });
        });
    }

    const popPlaylistsContainer = document.getElementById('popularPlaylistsList');
    if (popPlaylistsContainer) {
        // 10 últimas músicas adicionadas
        const newest = [...AppState.musics]
            .sort((a, b) => {
                if (a.created_at && b.created_at)
                    return new Date(b.created_at) - new Date(a.created_at);
                return (b.id || 0) - (a.id || 0);
            })
            .slice(0, 10);

        // Estrutura de carrossel
        popPlaylistsContainer.className = 'carousel-container';
        popPlaylistsContainer.innerHTML = `
            <div class="carousel-track" id="newestCarouselTrack">
                ${newest.map(music => `
                    <div class="music-card-horizontal newest-card" data-id="${music.id}">
                        <img src="${sanitizeUrl(music.cover)}" loading="lazy">
                        <h4>${escapeHtml(music.title)}</h4>
                        <p>${escapeHtml(music.artist)}</p>
                    </div>
                `).join('')}
            </div>
        `;

        // Clique nos cards
        popPlaylistsContainer.querySelectorAll('.newest-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                const music = AppState.musics.find(m => m.id === id);
                if (music) playMusicTrack(music);
            });
        });

        // Arrastar com mouse (desktop)
        const track = document.getElementById('newestCarouselTrack');
        if (track) {
            let isDown = false, startX = 0, scrollLeft = 0;
            track.addEventListener('mousedown', e => {
                isDown = true;
                startX = e.pageX - track.offsetLeft;
                scrollLeft = track.scrollLeft;
            });
            track.addEventListener('mouseleave', () => isDown = false);
            track.addEventListener('mouseup', () => isDown = false);
            track.addEventListener('mousemove', e => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - track.offsetLeft;
                track.scrollLeft = scrollLeft - (x - startX);
            });
        }
    }

    // ========== BOTÕES "VER TUDO/VER TODOS" ==========
    const seeAllRecent = document.getElementById('seeAllRecent');
    if (seeAllRecent) {
        seeAllRecent.addEventListener('click', () => {
            const bibliotecaNavBtn = document.querySelector('.nav-btn[data-tab="biblioteca"]');
            if (bibliotecaNavBtn) {
                bibliotecaNavBtn.click();
                setTimeout(() => {
                    const historyTab = document.querySelector('.lib-main-tab[data-filter="history"]');
                    if (historyTab) historyTab.click();
                    else showToast("Aba 'Histórico' não encontrada", "info");
                }, 200);
            } else {
                showToast("Aba 'Biblioteca' não encontrada", "danger");
            }
        });
    }

    const seeAllArtists = document.getElementById('seeAllArtists');
    if (seeAllArtists) {
        seeAllArtists.addEventListener('click', () => {
            const bibliotecaNavBtn = document.querySelector('.nav-btn[data-tab="biblioteca"]');
            if (bibliotecaNavBtn) {
                bibliotecaNavBtn.click();
                setTimeout(() => {
                    const artistsTab = document.querySelector('.lib-main-tab[data-filter="artists"]');
                    if (artistsTab) artistsTab.click();
                    else showToast("Aba 'Artistas' não encontrada", "info");
                }, 200);
            } else {
                showToast("Aba 'Biblioteca' não encontrada", "danger");
            }
        });
    }

    const seeAllNewest = document.getElementById('seeAllNewest');
    if (seeAllNewest) {
        seeAllNewest.addEventListener('click', () => {
            const bibliotecaNavBtn = document.querySelector('.nav-btn[data-tab="biblioteca"]');
            if (bibliotecaNavBtn) {
                bibliotecaNavBtn.click();
                setTimeout(() => {
                    const playlistsTab = document.querySelector('.lib-main-tab[data-filter="playlists"]');
                    if (playlistsTab) playlistsTab.click();
                    else showToast("Aba 'Playlists' não encontrada", "info");
                }, 200);
            } else {
                showToast("Aba 'Biblioteca' não encontrada", "danger");
            }
        });
    }

    // As seções extras dependem do catálogo e do histórico, que chegam de
    // forma assíncrona. Atualiza-as em segundo plano preservando a UI.
    window.__inicioExtras?.refresh?.();
    if (homeUiState) {
        restoreHomeUiState(homeUiState);
        requestAnimationFrame(() => restoreHomeUiState(homeUiState));
    }
}

// Atualização acionada por Realtime/polling. Fora da home, marca a tela
// como pendente e não altera a aba que o usuário está utilizando.
window.refreshHomeInBackground = function refreshHomeInBackground() {
    const home = document.getElementById('inicio');
    const isHomeVisible = home?.classList.contains('active');
    if (!isHomeVisible || document.visibilityState === 'hidden') {
        window._homeNeedsRefresh = true;
        return;
    }
    window._homeNeedsRefresh = false;
    return renderHome({ preserveUi: true });
};

// ========== ARTISTAS: estado de ordenação e favoritos ==========
let artistsSortMode = 'recent'; // 'recent' (mais ouvidos / padrão) | 'az'
function _favArtists() {
    try { return JSON.parse(localStorage.getItem('fenda_fav_artists') || '[]'); }
    catch { return []; }
}
function _isFavArtist(name) { return _favArtists().includes(name); }
function _toggleFavArtist(name) {
    const list = _favArtists();
    const idx = list.indexOf(name);
    if (idx >= 0) list.splice(idx, 1); else list.unshift(name);
    localStorage.setItem('fenda_fav_artists', JSON.stringify(list));
    return idx < 0; // true = acabou de favoritar
}

// ========== RENDERIZA GRID DE ARTISTAS (BANCO DE DADOS) ==========
let artistsFilterText = ''; // preserva a busca entre re-renders (troca de ordenação)

async function renderArtistsGrid() {
    const grid = document.getElementById('artistsGrid');
    if (!grid) return;

    // ── Sempre constrói a lista a partir das músicas do catálogo ─────────────
    // Extrai TODOS os artistas de AppState.musics e enriquece com dados
    // da tabela artists (bio, imagem própria, verified) quando disponível.
    const artistMap = new Map();
    AppState.musics.forEach(m => {
        if (!m.artist) return;
        if (!artistMap.has(m.artist)) {
            artistMap.set(m.artist, { name: m.artist, image_url: m.cover || '' });
        }
    });
    if (AppState.artists && AppState.artists.length) {
        AppState.artists.forEach(a => {
            if (!a.name) return;
            if (artistMap.has(a.name)) {
                const base = artistMap.get(a.name);
                artistMap.set(a.name, {
                    ...base,
                    image_url: a.image_url || base.image_url,
                    bio: a.bio || '',
                    verified: !!a.image_url,
                });
            } else {
                artistMap.set(a.name, a);
            }
        });
    }
    const artists = [...artistMap.values()];

    if (!artists.length) {
        grid.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">person</span><p>Nenhum artista ainda</p></div>`;
        return;
    }

    // ── Métricas por artista ─────────────────────────────────────────────────
    // Tempo ouvido vem do HISTÓRICO (sincronizado com a conta via Supabase).
    // playCounts (localStorage) fica só como fallback/desempate — é por
    // dispositivo, então sozinho dava um top 3 diferente em cada aparelho.
    const trackCountByArtist = new Map();
    AppState.musics.forEach(m => {
        trackCountByArtist.set(m.artist, (trackCountByArtist.get(m.artist) || 0) + 1);
    });

    const artistIdx = new Map(); // musicId -> artist (evita find() por item do histórico)
    AppState.musics.forEach(m => artistIdx.set(String(m.id), m.artist));

    const artistSecs = new Map();
    (AppState.history || []).forEach(h => {
        const art = artistIdx.get(String(h.id));
        if (art) artistSecs.set(art, (artistSecs.get(art) || 0) + (h.listenedSeconds || 0));
    });

    const artistPlays = new Map();
    AppState.musics.forEach(m => {
        const plays = (typeof playCounts !== 'undefined' ? playCounts[m.id] : 0) || 0;
        if (plays > 0) artistPlays.set(m.artist, (artistPlays.get(m.artist) || 0) + plays);
    });

    const _score = (name) => (artistSecs.get(name) || 0) * 100000 + (artistPlays.get(name) || 0);
    const _fmtHrs = (secs) => {
        const mins = Math.floor(secs / 60);
        if (mins >= 60) { const h = Math.floor(mins/60), m = mins%60; return m > 0 ? `${h}h ${m}min` : `${h}h`; }
        return `${mins}min`;
    };
    const _norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Top 3: tempo ouvido primeiro; se ninguém tem histórico, cai para plays locais
    const top3 = artists
        .map(a => ({ name: a.name, secs: artistSecs.get(a.name) || 0, plays: artistPlays.get(a.name) || 0 }))
        .filter(a => a.secs > 0 || a.plays > 0)
        .sort((a, b) => _score(b.name) - _score(a.name))
        .slice(0, 3);

    grid.innerHTML = '';

    // ── Toolbar: contagem + ordenação + busca ──
    const toolbar = document.createElement('div');
    toolbar.className = 'artists-toolbar';
    toolbar.innerHTML = `
        <span class="artists-toolbar-count"><strong>${artists.length}</strong> artista${artists.length !== 1 ? 's' : ''}</span>
        <div class="artists-sort">
            <button class="artists-sort-btn ${artistsSortMode === 'recent' ? 'active' : ''}" data-sort="recent">Relevância</button>
            <button class="artists-sort-btn ${artistsSortMode === 'az' ? 'active' : ''}" data-sort="az">A-Z</button>
        </div>
    `;
    toolbar.querySelectorAll('.artists-sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            artistsSortMode = btn.dataset.sort;
            renderArtistsGrid();
        });
    });
    grid.appendChild(toolbar);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'artists-search';
    searchWrap.innerHTML = `
        <span class="material-symbols-rounded">search</span>
        <input type="search" placeholder="Buscar artista" value="${escapeHtml(artistsFilterText)}"
               autocomplete="off" autocorrect="off" spellcheck="false">
    `;
    grid.appendChild(searchWrap);

    // ── Top 3 mais ouvidos ──
    if (top3.length) {
        const topLabel = document.createElement('p');
        topLabel.className = 'lib-artists-top-label';
        topLabel.innerHTML = `<span class="material-symbols-rounded">local_fire_department</span> Mais ouvidos`;
        grid.appendChild(topLabel);

        const topWrap = document.createElement('div');
        topWrap.className = 'lib-artists-top';

        const rankClasses = ['gold', 'silver', 'bronze'];
        const rankIcons   = ['workspace_premium', null, null];
        const rankLabels  = ['#1', '#2', '#3'];

        top3.forEach(({ name, secs, plays }, i) => {
            const cover = AppState.musics.find(m => m.artist === name)?.cover || '';

            const card = document.createElement('div');
            card.className = `lib-top-artist-card rank-${i + 1}`;
            if (cover) {
                card.setAttribute('data-cover', '1');
                card.style.setProperty('--lib-top-bg', `url(${cover})`);
            }

            const rankHtml   = `<span class="lib-top-artist-rank ${rankClasses[i]}">${rankIcons[i] ? `<span class="material-symbols-rounded">${rankIcons[i]}</span>` : ''}${rankLabels[i]}</span>`;
            const avatarHtml = `<div class="lib-top-artist-avatar">${cover ? `<img src="${sanitizeUrl(cover)}" onerror="this.style.display='none'">` : ''}<span class="material-symbols-rounded artist-avatar-fallback">person</span></div>`;
            // Tempo ouvido (sincronizado). Sem histórico ainda → plays locais.
            const metricHtml = secs > 0
                ? `<span class="lib-top-artist-plays"><span class="material-symbols-rounded">schedule</span>${_fmtHrs(secs)}</span>`
                : `<span class="lib-top-artist-plays"><span class="material-symbols-rounded">play_arrow</span>${plays} plays</span>`;

            card.innerHTML = `
                ${rankHtml}
                ${avatarHtml}
                <div class="lib-top-artist-info">
                    <span class="lib-top-artist-name">${escapeHtml(name)}</span>
                    ${metricHtml}
                </div>
            `;
            topWrap.appendChild(card);
            card.addEventListener('click', () => openArtistDetail(name));
        });

        grid.appendChild(topWrap);
    }

    // ── Seus favoritos (coração dado na tela do artista) ──
    // Antes esse dado existia mas não aparecia em lugar nenhum da biblioteca.
    const favNames = _favArtists().filter(n => artistMap.has(n));
    if (favNames.length) {
        const favLabel = document.createElement('p');
        favLabel.className = 'lib-artists-top-label';
        favLabel.innerHTML = `<span class="material-symbols-rounded">favorite</span> Seus favoritos`;
        grid.appendChild(favLabel);

        const favRow = document.createElement('div');
        favRow.className = 'lib-all-artists-row';
        favNames.forEach(name => {
            const cover = artistMap.get(name)?.image_url || AppState.musics.find(m => m.artist === name)?.cover || '';
            const chip = document.createElement('button');
            chip.className = 'lib-all-artist-chip';
            chip.type = 'button';
            chip.innerHTML = `
                ${cover ? `<img src="${sanitizeUrl(cover)}" class="lib-all-artist-chip-img" alt="">` : `<div class="lib-all-artist-chip-img lib-all-artist-chip-ph"><span class="material-symbols-rounded">person</span></div>`}
                <span class="lib-all-artist-chip-name">${escapeHtml(name)}</span>
            `;
            chip.addEventListener('click', () => openArtistDetail(name));
            favRow.appendChild(chip);
        });
        grid.appendChild(favRow);
    }

    if (top3.length || favNames.length) {
        const divider = document.createElement('p');
        divider.className = 'artists-divider-label';
        divider.innerHTML = `<span class="material-symbols-rounded">people</span> Todos os artistas`;
        grid.appendChild(divider);
    }

    // ── Ordena lista completa ──
    let sortedArtists = [...artists];
    if (artistsSortMode === 'az') {
        sortedArtists.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else {
        sortedArtists.sort((a, b) => {
            const diff = _score(b.name) - _score(a.name);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name, 'pt-BR');
        });
    }

    // ── Grade completa (com índice de letras no modo A-Z) ──
    const allGrid = document.createElement('div');
    allGrid.className = 'artists-grid-lib';
    let lastLetter = '';
    sortedArtists.forEach(a => {
        if (artistsSortMode === 'az') {
            const letter = _norm(a.name).charAt(0).toUpperCase();
            const label  = /[A-Z]/.test(letter) ? letter : '#';
            if (label !== lastLetter) {
                lastLetter = label;
                const lh = document.createElement('div');
                lh.className = 'artists-letter-header';
                lh.dataset.letter = label;
                lh.textContent = label;
                allGrid.appendChild(lh);
            }
        }
        const card = document.createElement('div');
        card.className = 'artist-card-lib';
        card.dataset.artistName = _norm(a.name);
        const cover = a.image_url || AppState.musics.find(m => m.artist === a.name)?.cover || '';
        const trackCount = trackCountByArtist.get(a.name) || 0;
        const secs = artistSecs.get(a.name) || 0;
        const subParts = [`${trackCount} ${trackCount === 1 ? 'música' : 'músicas'}`];
        // Formato compacto: o card tem ~1/3 da largura da tela
        if (secs >= 60) {
            const mins = Math.floor(secs / 60);
            subParts.push(mins >= 60 ? `${Math.floor(mins/60)}h${mins%60 ? String(mins%60).padStart(2,'0') : ''}` : `${mins}min`);
        }
        card.innerHTML = `
            <div class="artist-avatar-lib">
                ${cover ? `<img src="${sanitizeUrl(cover)}" onerror="this.style.display='none'">` : ''}
                <span class="material-symbols-rounded artist-avatar-fallback">person</span>
            </div>
            <div class="artist-card-lib-info">
                <span class="artist-name-lib">${escapeHtml(a.name)}</span>
                <span class="artist-tracks-lib">${subParts.join(' · ')}</span>
            </div>
            <span class="artist-card-lib-arrow"><span class="material-symbols-rounded">chevron_right</span></span>
        `;
        card.addEventListener('click', () => openArtistDetail(a.name));
        allGrid.appendChild(card);
    });
    grid.appendChild(allGrid);

    // ── Filtro ao vivo (sem re-render: preserva o foco do teclado) ──
    const _emptyMsg = document.createElement('div');
    _emptyMsg.className = 'artists-search-empty';
    _emptyMsg.style.display = 'none';
    _emptyMsg.innerHTML = `<span class="material-symbols-rounded">search_off</span><p>Nenhum artista encontrado</p>`;
    grid.appendChild(_emptyMsg);

    const _applyFilter = () => {
        const q = _norm(artistsFilterText.trim());
        let visible = 0;
        allGrid.querySelectorAll('.artist-card-lib').forEach(c => {
            const show = !q || c.dataset.artistName.includes(q);
            c.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        // Esconde letras sem nenhum artista visível abaixo delas
        allGrid.querySelectorAll('.artists-letter-header').forEach(h => {
            let el = h.nextElementSibling, any = false;
            while (el && !el.classList.contains('artists-letter-header')) {
                if (el.classList.contains('artist-card-lib') && el.style.display !== 'none') { any = true; break; }
                el = el.nextElementSibling;
            }
            h.style.display = any ? '' : 'none';
        });
        // Enquanto filtra, esconde top 3 / favoritos / divisor pra não poluir
        const hideExtras = !!q;
        grid.querySelectorAll('.lib-artists-top, .lib-artists-top-label, .lib-all-artists-row, .artists-divider-label')
            .forEach(el => { el.style.display = hideExtras ? 'none' : ''; });
        _emptyMsg.style.display = (q && visible === 0) ? '' : 'none';
    };
    searchWrap.querySelector('input').addEventListener('input', (e) => {
        artistsFilterText = e.target.value;
        _applyFilter();
    });
    if (artistsFilterText) _applyFilter(); // reaplica após troca de ordenação
}

function openArtistDetail(artistName, skipPush = false) {
    const artistMusics = AppState.musics.filter(m => m.artist === artistName);
    if (!artistMusics.length) { showToast('Nenhuma música encontrada', 'danger'); return; }

    let overlay = document.getElementById('artistDetailOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'artistDetailOverlay';
        overlay.className = 'artist-detail-overlay';
        document.body.appendChild(overlay);
    }

    // Dados extras do artista cadastrado no banco (bio, image_url)
    const artistRecord = (AppState.artists || []).find(a => a.name === artistName);
    const cover = artistRecord?.image_url || artistMusics[0]?.cover || '';
    const bio = artistRecord?.bio && artistRecord.bio.trim() ? artistRecord.bio.trim() : '';
    const isVerified = !!artistRecord?.image_url;

    // Conta plays do artista e separa as faixas mais ouvidas
    const totalPlays = artistMusics.reduce((sum, m) => {
        return sum + ((typeof playCounts !== 'undefined' ? playCounts[m.id] : 0) || 0);
    }, 0);
    const playsOf = (m) => (typeof playCounts !== 'undefined' ? playCounts[m.id] : 0) || 0;
    const popularTracks = [...artistMusics].filter(m => playsOf(m) > 0).sort((a, b) => playsOf(b) - playsOf(a)).slice(0, 5);
    const popularIds = new Set(popularTracks.map(m => m.id));
    const restTracks = artistMusics.filter(m => !popularIds.has(m.id));
    // Ordem visual real (Populares primeiro, depois o resto) — é essa ordem,
    // não a ordem "crua" de artistMusics, que define o que é "próxima música"
    // ao clicar em qualquer faixa da tela do artista. Sem isso, uma música
    // popular que por acaso caísse no fim de artistMusics gerava fila vazia
    // mesmo havendo mais músicas do artista pra tocar depois dela.
    const displayOrder = popularTracks.length ? [...popularTracks, ...restTracks] : artistMusics;

    const isFav = _isFavArtist(artistName);

    overlay.innerHTML = `
        <div class="ado-hero">
            <div class="ado-hero-bg" ${cover ? `style="background-image:url(${sanitizeUrl(cover)})"` : ''}></div>
            <div class="ado-hero-gradient"></div>

            <div class="ado-top-bar">
                <button class="ado-back-btn"><span class="material-symbols-rounded">arrow_back</span></button>
                <button class="ado-fav-btn${isFav ? ' is-fav' : ''}" id="artistFavBtn">
                    <span class="material-symbols-rounded${isFav ? ' filled' : ''}">favorite</span>
                </button>
            </div>

            <div class="ado-hero-content">
                <div class="ado-avatar">
                    ${cover
                        ? `<img src="${sanitizeUrl(cover)}" alt="${escapeHtml(artistName)}">`
                        : `<span class="material-symbols-rounded">person</span>`}
                </div>
                ${isVerified ? `<div class="ado-verified"><span class="material-symbols-rounded">verified</span> Artista verificado</div>` : ''}
                <h1 class="ado-name">${escapeHtml(artistName)}</h1>
                <p class="ado-meta">${artistMusics.length} ${artistMusics.length === 1 ? 'música' : 'músicas'}${totalPlays > 0 ? ` · ${totalPlays} play${totalPlays !== 1 ? 's' : ''}` : ''}</p>

                ${bio ? `
                <div class="ado-bio-wrap">
                    <p class="ado-bio clamped" id="artistBioText">${escapeHtml(bio)}</p>
                    <button class="ado-bio-toggle" id="artistBioToggle">Ver mais</button>
                </div>` : ''}
            </div>
        </div>

        <div class="ado-actions">
            <button class="ado-btn-play" id="artistPlayAll">
                <span class="material-symbols-rounded">play_arrow</span>
                Tocar tudo
            </button>
            <button class="ado-btn-shuffle" id="artistShuffle">
                <span class="material-symbols-rounded">shuffle</span>
            </button>
        </div>

        ${popularTracks.length ? `
        <div class="ado-section-label">
            <span class="material-symbols-rounded">trending_up</span> Mais tocadas
        </div>
        <div class="ado-track-list" id="artistPopularList"></div>
        <div class="ado-section-label">
            <span class="material-symbols-rounded">queue_music</span> Catálogo
        </div>` : ''}
        <div class="ado-track-list" id="artistMusicList"></div>
        <div style="height:120px"></div>
    `;
    overlay.classList.add('active');
    // Atualiza URL
    if (!skipPush && window.getUrlForState) {
        const url = window.getUrlForState({ tab: 'biblioteca', artistName });
        history.pushState({ tab: 'biblioteca', artistName }, '', url);
    }

    overlay.querySelector('.ado-back-btn').addEventListener('click', () => {
        overlay.classList.remove('active');
        if (window.getUrlForState) {
            history.pushState({ tab: 'biblioteca' }, '', '/biblioteca');
        }
    });
    overlay.querySelector('#artistPlayAll').addEventListener('click', () => {
        if (typeof window.setPlayContext === 'function') window.setPlayContext('search', displayOrder);
        playMusicTrack(displayOrder[0]);
    });
    overlay.querySelector('#artistShuffle').addEventListener('click', () => {
        AppState.isShuffle = true;
        if (typeof window.setPlayContext === 'function') window.setPlayContext('search', displayOrder);
        playMusicTrack(displayOrder[Math.floor(Math.random() * displayOrder.length)]);
    });

    // Favoritar artista
    const favBtn = overlay.querySelector('#artistFavBtn');
    if (favBtn) {
        favBtn.addEventListener('click', () => {
            const nowFav = _toggleFavArtist(artistName);
            favBtn.classList.toggle('is-fav', nowFav);
            const icon = favBtn.querySelector('.material-symbols-rounded');
            icon.classList.toggle('filled', nowFav);
        });
    }

    // Bio expansível
    const bioToggle = overlay.querySelector('#artistBioToggle');
    if (bioToggle) {
        bioToggle.addEventListener('click', () => {
            const bioEl = overlay.querySelector('#artistBioText');
            const nowClamped = bioEl.classList.toggle('clamped');
            bioToggle.textContent = nowClamped ? 'Ver mais' : 'Ver menos';
        });
    }

    const renderTrackList = (container, tracks) => {
        tracks.forEach((music, idx) => {
            const isCurrent = AppState.currentMusicId === music.id;
            const item = document.createElement('div');
            item.className = `ado-track${isCurrent ? ' is-playing' : ''}`;
            item.dataset.id = music.id;
            const plays = playsOf(music);
            item.innerHTML = `
                <span class="ado-track-num">${isCurrent
                    ? '<span class="eq-bars"><span></span><span></span><span></span></span>'
                    : (idx + 1)}</span>
                ${music.cover
                    ? `<img class="ado-track-cover" src="${sanitizeUrl(music.cover)}" data-fallback="1">`
                    : `<div class="ado-track-cover-ph"><span class="material-symbols-rounded">music_note</span></div>`}
                <div class="ado-track-info">
                    <span class="ado-track-title">${escapeHtml(music.title)}</span>
                    <span class="ado-track-sub">${plays > 0 ? plays + ' plays' : escapeHtml(music.artist)}</span>
                </div>
                <button class="ado-track-more"><span class="material-symbols-rounded">more_vert</span></button>
            `;
            const coverImg = item.querySelector('.ado-track-cover[data-fallback]');
            if (coverImg) {
                coverImg.onerror = function() {
                    const ph = document.createElement('div');
                    ph.className = 'ado-track-cover-ph';
                    ph.innerHTML = '<span class="material-symbols-rounded">music_note</span>';
                    if (this.parentNode) this.parentNode.replaceChild(ph, this);
                };
            }
            item.addEventListener('click', (e) => {
                if (e.target.closest('.ado-track-more')) return;
                if (typeof window.setPlayContext === 'function') window.setPlayContext('search', displayOrder);
                playMusicTrack(music);
                overlay.querySelectorAll('.ado-track').forEach(el => el.classList.remove('is-playing'));
                item.classList.add('is-playing');
            });
            item.querySelector('.ado-track-more').addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
            });
            container.appendChild(item);
        });
    };

    if (popularTracks.length) {
        renderTrackList(overlay.querySelector('#artistPopularList'), popularTracks);
        renderTrackList(overlay.querySelector('#artistMusicList'), restTracks);
    } else {
        renderTrackList(overlay.querySelector('#artistMusicList'), artistMusics);
    }
}
window.openArtistDetail = openArtistDetail;


let _summaryShareInProgress = false;

function _downloadSummaryImage(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function _canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar o PNG')), 'image/png');
    });
}

async function _shareSummaryImage(card, shareText, monthLabel) {
    if (_summaryShareInProgress || !card) return;
    _summaryShareInProgress = true;
    const shareButton = card.querySelector('.sc-share');
    if (shareButton) {
        shareButton.disabled = true;
        shareButton.setAttribute('aria-busy', 'true');
    }

    try {
        if (typeof window.html2canvas !== 'function') throw new Error('Captura de imagem indisponível');
        // Captura o elemento que o usuário vê, incluindo glow, gráfico, capas,
        // tipografia e o botão. Nenhum card paralelo é reconstruído.
        const canvas = await window.html2canvas(card, {
            backgroundColor: null,
            useCORS: true,
            allowTaint: false,
            scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
            logging: false,
            imageTimeout: 12000,
            onclone: clonedDocument => {
                const clonedCard = clonedDocument.querySelector('.sound-capsule--current') || clonedDocument.querySelector('.sound-capsule');
                if (clonedCard) clonedCard.classList.add('sc-share-capture');
            }
        });
        const blob = await _canvasToPngBlob(canvas);
        const monthSlug = String(monthLabel || 'resumo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resumo';
        const file = new File([blob], `fenda-resumo-${monthSlug}.png`, { type: 'image/png' });

        try {
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    title: 'Meu resumo no Fenda Music',
                    text: shareText,
                    files: [file]
                });
                showToast('Resumo compartilhado!', 'success');
                return;
            }
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.warn('[Share] Compartilhamento nativo indisponível:', error);
        }

        // Desktop e navegadores sem Web Share Files recebem a mesma imagem
        // por download, sem substituir o PNG por um resumo textual diferente.
        _downloadSummaryImage(blob, file.name);
        showToast('Imagem do resumo salva!', 'success');
    } catch (error) {
        console.warn('[Share] Falha ao gerar imagem do resumo:', error);
        let fallbackSucceeded = false;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Meu resumo no Fenda Music', text: shareText });
                fallbackSucceeded = true;
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
                fallbackSucceeded = true;
                showToast('Resumo copiado!', 'success');
            }
        } catch {}
        if (!fallbackSucceeded) showToast('Não foi possível gerar a imagem agora.', 'danger');
    } finally {
        _summaryShareInProgress = false;
        if (shareButton) {
            shareButton.disabled = false;
            shareButton.removeAttribute('aria-busy');
        }
    }
}

function renderLibrary() {
    const favoritesCount = AppState.favorites.size;
    const recentCount = AppState.history.length;

    const rcEl = document.getElementById('recentCount');
    if (rcEl) rcEl.innerText = recentCount;
    if (window.getAllCachedMusics) {
        _getCachedMusicsSnapshot().then(list => {
            const el = document.getElementById('downloadsCount');
            if (el) el.innerText = list.length;
        });
    }

    function rebind(id, fn) {
        const el = document.getElementById(id);
        if (!el || el.dataset.fendaBound === '1') return;
        el.dataset.fendaBound = '1';
        el.addEventListener('click', fn);
    }

    rebind('libSearchBtn', () => {
        document.querySelector('.nav-btn[data-tab="buscar"]')?.click();
    });
    // libAddBtn removido (fix 5)

    // Summary cards: um listener por elemento, mesmo após vários renders.
    const dlCard = document.querySelector('.summary-card[data-type="downloads"]');
    if (dlCard && dlCard.dataset.fendaBound !== '1') {
        dlCard.dataset.fendaBound = '1';
        dlCard.addEventListener('click', () => document.querySelector('.lib-main-tab[data-filter="downloads"]')?.click());
    }
    const rcCard = document.querySelector('.summary-card[data-type="recent"]');
    if (rcCard && rcCard.dataset.fendaBound !== '1') {
        rcCard.dataset.fendaBound = '1';
        rcCard.addEventListener('click', () => document.querySelector('.lib-main-tab[data-filter="history"]')?.click());
    }

    // Podcasts públicos
    if (typeof window.renderPodcastSection === 'function') window.renderPodcastSection();

    // Playlists
    const playlistsGrid = document.getElementById('playlistsGrid');
    if (playlistsGrid) {
        playlistsGrid.innerHTML = '';
        const likedItem = document.createElement('div');
        likedItem.className = 'playlist-item-modern';
        likedItem.innerHTML = `
            <div class="playlist-left">
                <div class="playlist-icon"><span class="material-symbols-rounded">favorite</span></div>
                <div class="playlist-info">
                    <h4>Curtidas</h4>
                    <p>${favoritesCount} ${favoritesCount === 1 ? 'música' : 'músicas'}</p>
                </div>
            </div>
        `;
        likedItem.addEventListener('click', () => { if (typeof window.openLikedMusicsDetail === 'function') window.openLikedMusicsDetail(); });
        playlistsGrid.appendChild(likedItem);

        (AppState.userPlaylists || []).forEach(playlist => {
            const count = playlist.musics ? playlist.musics.length : 0;
            const item = document.createElement('div');
            item.className = 'playlist-item-modern';
            item.innerHTML = `
                <div class="playlist-left">
                    <div class="playlist-icon">
                        ${playlist.cover ? `<img src="${sanitizeUrl(playlist.cover)}">` : '<span class="material-symbols-rounded">queue_music</span>'}
                    </div>
                    <div class="playlist-info">
                        <h4>${escapeHtml(playlist.name)}</h4>
                        <p>${count} ${count === 1 ? 'música' : 'músicas'}</p>
                    </div>
                </div>
                <div class="playlist-more"><span class="material-symbols-rounded">more_vert</span></div>
            `;
            // Clique em qualquer parte do item (exceto o ⋮) abre a playlist
            item.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-more')) return;
                if (typeof window.openPlaylistDetail === 'function') {
                    window.openPlaylistDetail(playlist);
                } else if (typeof openPlaylistDetail === 'function') {
                    openPlaylistDetail(playlist);
                }
            });
            item.querySelector('.playlist-more').addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.openPlaylistContextMenu === 'function') window.openPlaylistContextMenu(playlist);
            });
            playlistsGrid.appendChild(item);
        });
    }



    // ── Máquina do Tempo — mês atual aberto, meses anteriores em accordion ────
    let histSection = document.getElementById('libHistorySection');
    if (histSection) histSection.remove();
    histSection = document.createElement('div');
    histSection.id   = 'libHistorySection';
    histSection.className = 'library-section';
    histSection.style.display = 'none';

    const _history = AppState.history || [];

    // Helpers de data
    function _histDateLabel(ts) {
        if (!ts) return '';
        const now = new Date(), d = new Date(ts);
        if (d.toDateString() === now.toDateString()) return 'Hoje';
        const yest = new Date(now); yest.setDate(yest.getDate() - 1);
        if (d.toDateString() === yest.toDateString()) return 'Ontem';
        const diff = Math.floor((now - d) / 86_400_000);
        if (diff < 7) return ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][d.getDay()];
        const mo = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        return d.getFullYear() !== now.getFullYear()
            ? `${d.getDate()} de ${mo[d.getMonth()]} de ${d.getFullYear()}`
            : `${d.getDate()} de ${mo[d.getMonth()]}`;
    }
    function _histTimeStr(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    function _fmtMin(mins) {
        if (!mins || mins <= 0) return '0min';
        if (mins >= 60) { const h = Math.floor(mins/60), m = mins%60; return m > 0 ? `${h}h ${m}min` : `${h}h`; }
        return `${mins}min`;
    }

    // ── Agrupa o histórico por mês (mais recente primeiro, máx. 6 meses) ──
    const _now     = new Date();
    const _moNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const _byMonth = new Map();
    _history.forEach(h => {
        const d = new Date(h.playedAt || 0);
        if (d.getFullYear() < 2020) return; // descarta timestamps inválidos
        const k = d.getFullYear() * 12 + d.getMonth();
        if (!_byMonth.has(k)) _byMonth.set(k, []);
        _byMonth.get(k).push(h);
    });
    const _monthKeys = [..._byMonth.keys()].sort((a, b) => b - a).slice(0, 6);

    _monthKeys.forEach((_mk, _mi) => {
        const _y     = Math.floor(_mk / 12);
        const _mIdx  = _mk % 12;
        const _items = _byMonth.get(_mk);
        const _isCur = _y === _now.getFullYear() && _mIdx === _now.getMonth();
        const _open  = _mi === 0; // só o mês mais recente começa aberto

        // Totais do mês
        const _totalSecs  = _items.reduce((a, h) => a + (h.listenedSeconds || 0), 0);
        const _totalMins  = Math.floor(_totalSecs / 60);
        const _unique     = new Set(_items.map(h => String(h.id))).size;
        const _daysSet    = new Set(_items.map(h => new Date(h.playedAt || 0).getDate()));
        const _activeDays = _daysSet.size;
        const _avgMin     = _activeDays > 0 ? Math.round(_totalMins / _activeDays) : 0;

        // Ritmo do mês: minutos por dia (barras)
        const _daysInMo = new Date(_y, _mIdx + 1, 0).getDate();
        const _perDay   = new Array(_daysInMo).fill(0);
        _items.forEach(h => { const d = new Date(h.playedAt || 0); _perDay[d.getDate() - 1] += (h.listenedSeconds || 0) / 60; });
        const _peakVal  = Math.max(..._perDay);
        const _peakIdx  = _perDay.indexOf(_peakVal);

        // Top artista e top música — rankeados por TEMPO ouvido (não por plays)
        const _artSecs = {}, _trkSecs = {}, _trkPlays = {};
        _items.forEach(h => {
            const m   = AppState.musics.find(m => String(m.id) === String(h.id));
            const art = m?.artist || h.artist;
            if (art) _artSecs[art] = (_artSecs[art] || 0) + (h.listenedSeconds || 0);
            const tid = String(h.id);
            _trkSecs[tid]  = (_trkSecs[tid]  || 0) + (h.listenedSeconds || 0);
            _trkPlays[tid] = (_trkPlays[tid] || 0) + 1;
        });
        const _topArt   = Object.entries(_artSecs).sort((a, b) => b[1] - a[1])[0] || null;
        const _topTid   = (Object.entries(_trkSecs).sort((a, b) => b[1] - a[1])[0] || [])[0];
        const _topMus   = AppState.musics.find(m => String(m.id) === String(_topTid));
        const _artCov   = _topArt ? (AppState.musics.find(m => m.artist === _topArt[0])?.cover || '') : '';

        // Maior sequência de dias consecutivos dentro do mês
        let _bestStreak = 0, _run = 0;
        for (let d = 1; d <= _daysInMo; d++) {
            if (_daysSet.has(d)) { _run++; _bestStreak = Math.max(_bestStreak, _run); }
            else _run = 0;
        }

        const _cap = document.createElement('div');
        _cap.className = 'sound-capsule'
            + (_isCur ? ' sound-capsule--current' : '')
            + (_open  ? ' sc-open' : '');
        _cap.innerHTML = `
            <div class="sc-glow"></div>
            <button class="sc-head" type="button" aria-expanded="${_open}">
                <div class="sc-head-txt">
                    <span class="sc-eyebrow"><span class="material-symbols-rounded">${_isCur ? 'bar_chart' : 'history'}</span>${_isCur ? 'ESTE MÊS' : 'MÁQUINA DO TEMPO'}</span>
                    <h3 class="sc-month">${_moNames[_mIdx]}${_y !== _now.getFullYear() ? ` ${_y}` : ''}</h3>
                </div>
                <div class="sc-head-right">
                    <span class="sc-head-mins">${_fmtMin(_totalMins)}</span>
                    <span class="material-symbols-rounded sc-chevron">expand_more</span>
                </div>
            </button>

            <div class="sc-body">
                <div class="sc-hero">
                    <span class="sc-hero-label">Tempo ouvido</span>
                    <span class="sc-hero-value">${_fmtMin(_totalMins)}</span>
                    ${_avgMin > 0 ? `<span class="sc-hero-sub">média de ${_avgMin} min por dia ativo</span>` : ''}
                </div>

                <div class="sc-rhythm" aria-hidden="true">
                    ${_perDay.map((v, i) => `<span class="sc-bar${i === _peakIdx && v > 0 ? ' sc-bar--peak' : ''}" style="height:${v > 0 ? Math.max(10, Math.round(v / _peakVal * 100)) : 4}%"></span>`).join('')}
                </div>
                <div class="sc-rhythm-legend">
                    <span>dia 1</span>
                    <span class="sc-rhythm-peak">${_peakVal > 0 ? `pico: dia ${_peakIdx + 1} · ${_fmtMin(Math.round(_peakVal))}` : ''}</span>
                    <span>dia ${_daysInMo}</span>
                </div>

                <div class="sc-marcos">
                    <span class="sc-pill"><span class="material-symbols-rounded">calendar_month</span>${_activeDays} ${_activeDays === 1 ? 'dia ativo' : 'dias ativos'}</span>
                    <span class="sc-pill"><span class="material-symbols-rounded">music_note</span>${_unique} ${_unique === 1 ? 'música' : 'músicas'}</span>
                    ${_bestStreak >= 2 ? `<span class="sc-pill sc-pill--fire"><span class="material-symbols-rounded">local_fire_department</span>${_bestStreak} dias seguidos</span>` : ''}
                </div>

                ${_topArt || _topMus ? '<div class="sc-divider"></div>' : ''}
                ${_topArt ? `
                <div class="sc-top" data-action="open-artist" role="button" tabindex="0">
                    ${_artCov ? `<img class="sc-top-img sc-top-img--round" src="${sanitizeUrl(_artCov)}" loading="lazy" alt="">` : `<div class="sc-top-img sc-top-img--round sc-top-ph"><span class="material-symbols-rounded">person</span></div>`}
                    <div class="sc-top-info">
                        <span class="sc-top-label">Artista mais ouvido</span>
                        <span class="sc-top-name">${escapeHtml(_topArt[0])}</span>
                        <span class="sc-top-sub">${_fmtMin(Math.floor(_topArt[1] / 60))} no mês</span>
                    </div>
                    <span class="material-symbols-rounded sc-arrow">chevron_right</span>
                </div>` : ''}
                ${_topMus ? `
                <div class="sc-top" data-action="play-top" role="button" tabindex="0">
                    ${_topMus.cover ? `<img class="sc-top-img" src="${sanitizeUrl(_topMus.cover)}" loading="lazy" alt="">` : `<div class="sc-top-img sc-top-ph"><span class="material-symbols-rounded">music_note</span></div>`}
                    <div class="sc-top-info">
                        <span class="sc-top-label">Música mais ouvida</span>
                        <span class="sc-top-name">${escapeHtml(_topMus.title)}</span>
                        <span class="sc-top-sub">${escapeHtml(_topMus.artist || '')} · ${_trkPlays[String(_topTid)] || 1}×</span>
                    </div>
                    <span class="material-symbols-rounded sc-arrow">play_arrow</span>
                </div>` : ''}

                <button class="sc-share" type="button">
                    <span class="material-symbols-rounded">share</span>Compartilhar resumo
                </button>
            </div>
        `;

        // Accordion: cabeçalho abre/fecha o corpo
        _cap.querySelector('.sc-head').addEventListener('click', () => {
            const nowOpen = _cap.classList.toggle('sc-open');
            _cap.querySelector('.sc-head').setAttribute('aria-expanded', String(nowOpen));
        });

        _cap.querySelector('[data-action="play-top"]')?.addEventListener('click', () => {
            if (!_topMus) return;
            if (typeof window.setPlayContext === 'function') window.setPlayContext('history', [_topMus]);
            playMusicTrack(_topMus);
        });
        _cap.querySelector('[data-action="open-artist"]')?.addEventListener('click', () => {
            if (_topArt && typeof window.openArtistDetail === 'function') window.openArtistDetail(_topArt[0]);
        });
        _cap.querySelector('.sc-share')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const _txt = `🎧 Minha Máquina do Tempo — ${_moNames[_mIdx]}${_y !== _now.getFullYear() ? ` ${_y}` : ''}
⏱ ${_fmtMin(_totalMins)} de música
🎵 ${_unique} músicas em ${_activeDays} ${_activeDays === 1 ? 'dia' : 'dias'}${_topArt ? `
🎤 Artista do mês: ${_topArt[0]}` : ''}${_topMus ? `
🔁 No repeat: ${_topMus.title}` : ''}

fendamusic.com.br`;
            await _shareSummaryImage(_cap, _txt, `${_moNames[_mIdx]}-${_y}`);
        });
        histSection.appendChild(_cap);
    });

    // Cabeçalho da lista
    const _listHeader = document.createElement('div');
    _listHeader.className = 'section-header';
    _listHeader.innerHTML = `<h2><span class="material-symbols-rounded">history</span>Histórico</h2>`;
    histSection.appendChild(_listHeader);

    // Lista agrupada por data — 30 linhas visíveis, resto sob "Mostrar mais"
    if (_history.length === 0) {
        const _empty = document.createElement('div');
        _empty.className = 'history-empty';
        _empty.innerHTML = `<span class="material-symbols-rounded">history</span><p>Nenhuma música ouvida ainda</p>`;
        histSection.appendChild(_empty);
    } else {
        const _listWrap = document.createElement('div');
        _listWrap.className = 'history-list';
        const _DEDUP_MS = 30 * 60 * 1000;
        const _groups   = [];
        const _dateMap  = new Map();
        _history.forEach(item => {
            const key = new Date(item.playedAt || 0).toDateString();
            if (!_dateMap.has(key)) {
                _dateMap.set(key, _groups.length);
                _groups.push({ label: _histDateLabel(item.playedAt || 0), items: [], lastSeen: new Map() });
            }
            const _group    = _groups[_dateMap.get(key)];
            const _lastTime = _group.lastSeen.get(item.id) || 0;
            if (Math.abs((item.playedAt||0) - _lastTime) > _DEDUP_MS) {
                _group.lastSeen.set(item.id, item.playedAt||0);
                _group.items.push(item);
            }
        });

        const _VISIBLE  = 30;   // linhas exibidas de início
        const _STEP     = 40;   // linhas reveladas por clique
        let   _rowCount = 0;
        const _hiddenEls = [];  // elementos (headers + linhas) além do limite

        _groups.forEach(group => {
            const _dh = document.createElement('div');
            _dh.className = 'history-date-header';
            _dh.innerHTML = `<span class="hdh-line"></span><span class="hdh-label">${escapeHtml(group.label)}</span><span class="hdh-line"></span>`;
            if (_rowCount >= _VISIBLE) { _dh.style.display = 'none'; _hiddenEls.push(_dh); }
            _listWrap.appendChild(_dh);
            group.items.forEach(item => {
                const _m = AppState.musics.find(m => m.id === item.id);
                if (!_m) return;
                const _row = document.createElement('div');
                _row.className = 'history-track-row';
                const _timeStr = _histTimeStr(item.playedAt);
                const _dur = item.listenedSeconds > 0 ? `${Math.floor(item.listenedSeconds/60)}:${String(item.listenedSeconds%60).padStart(2,'0')} ouvidos` : '';
                _row.innerHTML = `
                    <img class="htr-cover" src="${sanitizeUrl(_m.cover)}" loading="lazy" alt="">
                    <div class="htr-meta">
                        <span class="htr-title">${escapeHtml(_m.title)}</span>
                        <span class="htr-artist">${escapeHtml(_m.artist||'')}</span>
                        ${_dur ? `<span class="htr-dur">${_dur}</span>` : ''}
                    </div>
                    ${_timeStr ? `<span class="htr-time">${_timeStr}</span>` : ''}
                `;
                _row.addEventListener('click', () => {
                    if (typeof window.setPlayContext === 'function') window.setPlayContext('history', [_m]);
                    playMusicTrack(_m);
                });
                _rowCount++;
                if (_rowCount > _VISIBLE) { _row.style.display = 'none'; _hiddenEls.push(_row); }
                _listWrap.appendChild(_row);
            });
        });
        histSection.appendChild(_listWrap);

        if (_hiddenEls.length > 0) {
            const _moreBtn = document.createElement('button');
            _moreBtn.className = 'history-more-btn';
            _moreBtn.type = 'button';
            _moreBtn.innerHTML = `<span class="material-symbols-rounded">expand_more</span>Mostrar mais`;
            _moreBtn.addEventListener('click', () => {
                let revealed = 0;
                while (_hiddenEls.length > 0 && revealed < _STEP) {
                    const el = _hiddenEls.shift();
                    el.style.display = '';
                    if (el.classList.contains('history-track-row')) revealed++;
                }
                if (_hiddenEls.length === 0) _moreBtn.remove();
            });
            histSection.appendChild(_moreBtn);
        }
    }
    document.getElementById('artistsSection')?.insertAdjacentElement('afterend', histSection);

    // Downloads (dinâmico)
    let dlSection = document.getElementById('libDownloadsSection');
    if (dlSection) dlSection.remove();
    dlSection = document.createElement('div');
    dlSection.id = 'libDownloadsSection';
    dlSection.className = 'library-section';
    dlSection.style.display = 'none';
    dlSection.innerHTML = '<div class="section-header"><h2>Downloads</h2></div>';
    const dlList = document.createElement('div');
    dlList.className = 'playlist-tracks-list';
    dlSection.appendChild(dlList);
    histSection.insertAdjacentElement('afterend', dlSection);

    // ── Seção "Tudo" — stats + top artistas + favoritas ─────────────────────
    let libAllSection = document.getElementById('libAllSection');
    if (libAllSection) libAllSection.remove();
    libAllSection = document.createElement('div');
    libAllSection.id = 'libAllSection';
    libAllSection.style.display = 'none';

    const _totalMusics  = AppState.musics.length;
    const _totalArtists = new Set(AppState.musics.map(m => m.artist).filter(Boolean)).size;
    const _favCount     = AppState.favorites.size;
    let   _totalPlays   = 0;
    try { const _pc = JSON.parse(localStorage.getItem('play_counts')||'{}'); _totalPlays = Object.values(_pc).reduce((a,b)=>a+Number(b),0); } catch {}

    const _artPlays = {};
    const _pcAll = (() => { try { return JSON.parse(localStorage.getItem('play_counts')||'{}'); } catch { return {}; } })();
    AppState.musics.forEach(m => { if (!m.artist) return; const p = Number(_pcAll[String(m.id)]||0); _artPlays[m.artist] = (_artPlays[m.artist]||0)+p; });
    const _topArtists3 = Object.entries(_artPlays).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([name])=>({ name, cover: AppState.musics.find(m=>m.artist===name)?.cover||'' }));

    const _favMusics = AppState.musics.filter(m => AppState.favorites.has(m.id)||AppState.favorites.has(String(m.id))).slice(0,20);

    libAllSection.innerHTML = `
        <div class="lib-all-stats">
            <div class="lib-stat-pill"><span class="material-symbols-rounded">library_music</span><span class="lib-stat-num">${_totalMusics}</span><span class="lib-stat-lbl">músicas</span></div>
            <div class="lib-stat-pill"><span class="material-symbols-rounded">person</span><span class="lib-stat-num">${_totalArtists}</span><span class="lib-stat-lbl">artistas</span></div>
            <div class="lib-stat-pill"><span class="material-symbols-rounded">favorite</span><span class="lib-stat-num">${_favCount}</span><span class="lib-stat-lbl">curtidas</span></div>
            <div class="lib-stat-pill"><span class="material-symbols-rounded">play_circle</span><span class="lib-stat-num">${_totalPlays.toLocaleString('pt-BR')}</span><span class="lib-stat-lbl">plays</span></div>
        </div>
        ${_topArtists3.length > 0 ? `
        <div class="section-header" style="margin-top:28px"><h2><span class="material-symbols-rounded">trending_up</span>Mais ouvidos</h2></div>
        <div class="lib-all-artists-row">
            ${_topArtists3.map(a=>`
                <button class="lib-all-artist-chip" data-artist="${escapeHtml(a.name)}" type="button">
                    ${a.cover?`<img src="${sanitizeUrl(a.cover)}" class="lib-all-artist-chip-img" alt="">`:`<div class="lib-all-artist-chip-img lib-all-artist-chip-ph"><span class="material-symbols-rounded">person</span></div>`}
                    <span class="lib-all-artist-chip-name">${escapeHtml(a.name)}</span>
                </button>
            `).join('')}
        </div>` : ''}
        ${_favMusics.length > 0 ? `
        <div class="section-header" style="margin-top:28px">
            <h2><span class="material-symbols-rounded">favorite</span>Curtidas</h2>
            <button class="text-btn" data-action="open-liked">Ver tudo</button>
        </div>
        <div class="lib-all-favs-carousel">
            ${_favMusics.map(m=>`
                <button class="lib-all-fav-card" data-id="${m.id}" type="button">
                    <div class="lib-all-fav-cover-wrap"><img src="${sanitizeUrl(m.cover)}" alt="${escapeHtml(m.title)}"></div>
                    <span class="lib-all-fav-title">${escapeHtml(m.title)}</span>
                    <span class="lib-all-fav-artist">${escapeHtml(m.artist||'')}</span>
                </button>
            `).join('')}
        </div>` : ''}
    `;

    libAllSection.querySelectorAll('.lib-all-artist-chip').forEach(btn=>{
        btn.addEventListener('click',()=>{ const a=btn.dataset.artist; if(a&&typeof window.openArtistDetail==='function') window.openArtistDetail(a); });
    });
    libAllSection.querySelectorAll('.lib-all-fav-card').forEach(btn=>{
        btn.addEventListener('click',()=>{ const id=Number(btn.dataset.id)||btn.dataset.id; const m=AppState.musics.find(m=>m.id===id||String(m.id)===String(id)); if(m) playMusicTrack(m); });
    });
    libAllSection.querySelector('[data-action="open-liked"]')?.addEventListener('click',()=>{ if(typeof window.openLikedMusicsDetail==='function') window.openLikedMusicsDetail(); });
    dlSection.insertAdjacentElement('afterend', libAllSection);

    // Controle de abas
    const summaryCards = document.getElementById('summaryCards');
    const playlistsSEl = document.getElementById('playlistsSection');
    const podcastsSEl = document.getElementById('podcastsSection');
    const artistsSEl = document.getElementById('artistsSection');

    function showOnly(...show) {
        [summaryCards, playlistsSEl, podcastsSEl, artistsSEl, histSection, dlSection, libAllSection].forEach(el => {
            if (el) el.style.display = 'none';
        });
        show.forEach(el => {
            if (el) el.style.display = el === summaryCards ? 'grid' : 'block';
        });
    }

    function filterLibrary(filter) {
        switch (filter) {
            case 'all':      showOnly(summaryCards, playlistsSEl, podcastsSEl, libAllSection); break;
            case 'playlists': showOnly(playlistsSEl); break;
            case 'podcasts': showOnly(podcastsSEl); if (typeof window.renderPodcastSection === 'function') window.renderPodcastSection(); break;
            case 'artists':  showOnly(artistsSEl); renderArtistsGrid(); break;
            case 'history':  showOnly(histSection); break;
            case 'downloads':
                showOnly(dlSection);
                if (dlList.children.length === 0 && window.getAllCachedMusics) {
                    dlList.innerHTML = '<p style="text-align:center;padding:24px;color:rgba(255,255,255,0.3)">Carregando...</p>';
                    _getCachedMusicsSnapshot().then(async metas => {
                        dlList.innerHTML = '';
                        if (!metas.length) {
                            dlList.innerHTML = '<div class="empty-state"><span class="material-symbols-rounded">download</span><p>Nenhuma música baixada</p></div>';
                            return;
                        }
                        const cards = await Promise.all(metas.map(meta => {
                            const music = AppState.musics.find(m => m.id === meta.musicId) || {
                                id: meta.musicId, title: meta.title, artist: meta.artist, cover: meta.cover, src: meta.url
                            };
                            return typeof window.createMusicCardElement === 'function'
                                ? window.createMusicCardElement(music)
                                : null;
                        }));
                        const fragment = document.createDocumentFragment();
                        cards.filter(Boolean).forEach(card => fragment.appendChild(card));
                        dlList.replaceChildren(fragment);
                    });
                }
                break;
        }
    }

    // Abas — listeners delegados no container, sem clonar o DOM em cada render.
    const tabsContainer = document.querySelector('.library-main-tabs');
    if (tabsContainer) {
        tabsContainer._fendaFilterLibrary = filterLibrary;
    }
    if (tabsContainer && tabsContainer.dataset.fendaBound !== '1') {
        tabsContainer.dataset.fendaBound = '1';
        tabsContainer.addEventListener('click', (event) => {
            const tab = event.target.closest('.lib-main-tab');
            if (!tab || !tabsContainer.contains(tab)) return;
            tabsContainer.querySelectorAll('.lib-main-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tabsContainer._fendaFilterLibrary?.(tab.dataset.filter);
            const url = window.getUrlForState
                ? window.getUrlForState({ tab: 'biblioteca', libFilter: tab.dataset.filter })
                : '/biblioteca';
            history.pushState({ tab: 'biblioteca', libFilter: tab.dataset.filter }, '', url);
        });
    }

    const activeTab = document.querySelector('.lib-main-tab.active');
    filterLibrary(activeTab ? activeTab.dataset.filter : 'all');
    if (!activeTab) document.querySelector('.lib-main-tab[data-filter="all"]')?.classList.add('active');
}


async function renderProfile() {
    try {
        const profile = AppState.userProfile || {};
        const userEmail = localStorage.getItem('user_email') || '';
        // Nunca deixa "Carregando..." travado: se o perfil ainda não voltou
        // do Supabase (timeout, offline, RLS lenta), usa a parte do e-mail
        // como nome provisório em vez do placeholder estático do HTML.
        const userName = profile.full_name || userEmail.split('@')[0] || 'Usuário';
        const userBio = profile.bio || 'Apaixonado por música. Vivendo uma música de cada vez.';
        // username é o handle de verdade (coluna própria); só cai para o
        // e-mail se a conta ainda não tiver um definido (ex.: antes da
        // migração ADD_USERNAME.sql rodar, ou usuário recém-criado).
        const userHandle = profile.username || userEmail.split('@')[0] || 'usuario';

        const nameEl = document.getElementById('profileName');
        // Remove data-i18n antes de escrever o nome real, senão o
        // MutationObserver do i18n.js reescreve "Carregando..." aqui de
        // novo na próxima vez que qualquer elemento com data-i18n for
        // adicionado à página.
        if (nameEl) { nameEl.removeAttribute('data-i18n'); nameEl.textContent = userName; }
        const userEl = document.getElementById('profileUsername');
        if (userEl) userEl.textContent = '@' + userHandle;
        const bioEl = document.getElementById('profileBio');
        if (bioEl) { bioEl.removeAttribute('data-i18n'); bioEl.textContent = userBio; }

        // Avatar
        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarIcon = document.getElementById('profileAvatarIcon');
        const avatarUrl = window.UserCacheDB && AppState.userId
            ? await window.UserCacheDB.getAvatarUrl(AppState.userId, profile.avatar_url)
            : profile.avatar_url;
        if (avatarUrl && avatarImg) {
            avatarImg.src = avatarUrl;
            // Tamanho/formato vêm 100% do CSS (.profile-avatar-wrap img em
            // perfil.css) — não fixar px aqui evita o avatar "descolar" do
            // wrapper toda vez que o design do cartão de perfil mudar.
            avatarImg.style.display = 'block';
            if (avatarIcon) avatarIcon.style.display = 'none';
        } else {
            if (avatarImg) avatarImg.style.display = 'none';
            if (avatarIcon) avatarIcon.style.display = 'block';
        }

        // Stats
        const totalPlaylists = AppState.userPlaylists.length;
        const totalFavorites = AppState.favorites.size;
        const totalMinutes = calculateTotalMinutesListened();
        const timeDisplay = totalMinutes >= 60
            ? Math.floor(totalMinutes / 60) + 'h ' + (totalMinutes % 60) + 'min'
            : totalMinutes + ' min';
        const plEl = document.getElementById('totalPlaylists');
        if (plEl) plEl.innerText = totalPlaylists;
        const favEl = document.getElementById('totalFavorites');
        if (favEl) favEl.innerText = totalFavorites;
        const timeEl = document.getElementById('totalTimeStat');
        if (timeEl) timeEl.innerText = timeDisplay;

        function rebind(id, fn) {
            const el = document.getElementById(id);
            if (!el) return;
            const clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
            clone.addEventListener('click', fn);
        }

        rebind('likedSongsNavBtn', () => {
            document.querySelector('.nav-btn[data-tab="biblioteca"]')?.click();
            setTimeout(() => openLikedMusicsDetail(), 200);
        });
        rebind('recentNavBtn', () => {
            document.querySelector('.nav-btn[data-tab="biblioteca"]')?.click();
            setTimeout(() => document.querySelector('.lib-main-tab[data-filter="history"]')?.click(), 200);
        });
        rebind('downloadsNavBtn', () => {
            document.querySelector('.nav-btn[data-tab="biblioteca"]')?.click();
            setTimeout(() => document.querySelector('.lib-main-tab[data-filter="downloads"]')?.click(), 200);
        });
        rebind('settingsNavBtn', () => window.FendaSettings?.open());
        rebind('submitMusicNavBtn', () => window.FendaSubmit?.open());

        // Retry de segurança: se o full_name real ainda não chegou (só
        // temos o fallback do e-mail), tenta buscar o perfil direto do
        // Supabase e re-renderiza — mesmo padrão de resiliência usado em
        // inicio-extras.js para o header "Boa tarde, Nome". Sem isso, se
        // renderProfile() rodasse uma vez antes de AppState.userProfile
        // estar completo, o nome ficava preso no fallback pra sempre
        // (ou pior, sem esse fallback, preso em "Carregando...").
        if (!profile.full_name && AppState.userId && !window._profileRetryScheduled) {
            window._profileRetryScheduled = true;
            const retry = async () => {
                try {
                    const fresh = await window.getUserProfile?.(AppState.userId);
                    if (fresh?.full_name) {
                        AppState.userProfile = fresh;
                        window._profileRetryScheduled = false;
                        renderProfile();
                        return;
                    }
                } catch {}
                if ((window._profileRetryCount = (window._profileRetryCount || 0) + 1) < 8) {
                    setTimeout(retry, 1500); // tenta de novo a cada 1.5s, até 8x (~12s)
                } else {
                    window._profileRetryScheduled = false;
                }
            };
            setTimeout(retry, 1500);
        }

    } catch (err) {
        console.error('Erro no renderProfile:', err);
    }
}


// Edição de perfil (nome, username, bio, avatar, senha) agora mora
// inteiramente em Configurações → Conta (settings.js). Essas funções
// existiam para o antigo modal "Editar" do topo do Perfil, removido
// para centralizar tudo num único lugar.

async function createMusicCardElement(music) {
    const card = document.createElement('div');
    card.className = 'music-card';
    const isCurrent = AppState.currentMusicId === music.id;
    const inlineIcon = (isCurrent && AppState.playing) ? 'pause' : 'play_arrow';
    card.innerHTML = `
        <div class="music-card-left-wrapper">
            <button class="inline-play-btn ${isCurrent ? 'active-inline' : ''}" data-id="${music.id}">
                <span class="material-symbols-rounded">${inlineIcon}</span>
            </button>
            <img src="${sanitizeUrl(music.cover)}" class="music-card-cover" onerror="this.style.opacity='0'">
            <div class="music-card-details">
                <h3>${escapeHtml(music.title)}</h3>
                <p>${escapeHtml(music.artist)}</p>
            </div>
        </div>
        <div class="music-card-actions">
            <button class="more-btn"><span class="material-symbols-rounded">more_vert</span></button>
        </div>
    `;
    card.querySelector('.music-card-left-wrapper').addEventListener('click', () => {
        if (typeof window.setPlayContext === 'function') {
            const _filter = AppState.currentPlaylistFilter;
            let source = 'library';
            let trackList = [...AppState.musics];
            if (_filter === 'favorites') {
                // Antes: userPlaylists.find(id==='favorites') → undefined →
                // trackList VAZIA → tocar uma curtida caía no catálogo inteiro
                source = 'favorites';
                trackList = AppState.musics.filter(m =>
                    AppState.favorites.has(m.id) || AppState.favorites.has(String(m.id)));
            } else if (_filter) {
                source = 'playlist';
                const pl = AppState.userPlaylists.find(p => p.id === _filter);
                trackList = pl?.musics
                    ? AppState.musics.filter(m => pl.musics.includes(m.id))
                    : [...AppState.musics];
            }
            window.setPlayContext(source, trackList, _filter || null);
        }
        togglePlayMusic(music);
    });
    card.querySelector('.more-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
        else openContextMenu(music);
    });
    return card;
}

function renderQueue() {
    const container = document.getElementById('queueList');
    if (!container) return;
    if (!AppState.queue.length) {
        container.innerHTML = `<div class="queue-empty"><span class="material-symbols-rounded">queue_music</span><span>Fila vazia</span><span style="font-size: 11px;">Adicione músicas para tocar em seguida</span></div>`;
        return;
    }
    container.innerHTML = '';
    AppState.queue.forEach((music, idx) => {
        const isCurrent = AppState.currentMusicId === music.id && AppState.playing;
        const item = document.createElement('div');
        item.className = `queue-item ${isCurrent ? 'current' : ''}`;
        item.innerHTML = `
            <div class="queue-item-info">
                <div class="queue-item-title">${escapeHtml(music.title)}</div>
                <div class="queue-item-artist">${escapeHtml(music.artist)}</div>
            </div>
            <button class="queue-item-remove" data-index="${idx}"><span class="material-symbols-rounded">close</span></button>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.queue-item-remove')) return;
            const remaining = AppState.queue.slice(idx);
            AppState.queue = remaining;
            renderQueue();
            playMusicTrack(music);
        });
        item.querySelector('.queue-item-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromQueue(idx);
        });
        container.appendChild(item);
    });
}

function _favoriteId(musicId) {
    return String(musicId ?? '');
}

function isFavoriteTrack(musicId) {
    const id = _favoriteId(musicId);
    return !!id && AppState.favorites instanceof Set && AppState.favorites.has(id);
}

async function toggleFavoriteTrack(musicId) {
    const id = _favoriteId(musicId);
    if (!id) return false;
    if (!(AppState.favorites instanceof Set)) AppState.favorites = new Set();

    // Atualiza localmente primeiro; o coração funciona mesmo sem rede ou
    // enquanto a sessão ainda termina de carregar.
    const wasFav = isFavoriteTrack(id);
    if (wasFav) AppState.favorites.delete(id);
    else AppState.favorites.add(id);
    const isFavNow = isFavoriteTrack(id);

    document.querySelectorAll('.favorite-btn').forEach(btn => {
        if (_favoriteId(btn.dataset.id) !== id) return;
        btn.classList.toggle('active', isFavNow);
        const icon = btn.querySelector('span');
        if (icon) icon.innerText = isFavNow ? 'favorite' : 'favorite_border';
        btn.classList.remove('pop');
        void btn.offsetWidth;
        btn.classList.add('pop');
        setTimeout(() => btn.classList.remove('pop'), 300);
    });

    const expandedFav = document.getElementById('playerExpandedFavBtn');
    if (expandedFav && _favoriteId(AppState.currentMusicId) === id) {
        const span = expandedFav.querySelector('span');
        if (span) span.innerText = isFavNow ? 'favorite' : 'favorite_border';
        expandedFav.style.setProperty('color', isFavNow ? '#f472b6' : '', 'important');
        expandedFav.classList.remove('pop');
        void expandedFav.offsetWidth;
        expandedFav.classList.add('pop');
        setTimeout(() => expandedFav.classList.remove('pop'), 300);
    }

    localStorage.setItem('supabase_player_favorites', JSON.stringify(Array.from(AppState.favorites)));
    window.notifyHomeDataChanged?.('favorites');

    // Sincronização remota em background, sem toast e sem reverter o estado
    // local se a rede/RLS estiver indisponível.
    if (AppState.userId && typeof window.toggleFavorite === 'function') {
        try { await window.toggleFavorite(AppState.userId, id); }
        catch (e) { console.warn('Erro ao sincronizar favorito:', e); }
    }
    return isFavNow;
}

window.isFavoriteTrack = isFavoriteTrack;

function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('blob:')) {
        return trimmed;
    }
    return ''; // rejeita javascript:, data:, etc.
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
window.renderHome = renderHome;
window.renderLibrary = renderLibrary;
window.renderProfile = renderProfile;
window.renderQueue = renderQueue;
window.renderArtistsGrid = renderArtistsGrid;  // nova exportação
window.createMusicCardElement = createMusicCardElement;
window.toggleFavoriteTrack = toggleFavoriteTrack;