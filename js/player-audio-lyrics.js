// ===== MOTOR DE ÁUDIO, SINCRONISMO E LETRAS .LRC (player-audio-lyrics.js) =====

// Animação de "curtir": pop elástico no ícone + pequenas partículas
// espalhando ao redor do botão. Efeito visual só, sem afetar o estado
// (toggleFavoriteTrack já foi chamado antes desta função rodar).
function _playFavPopAnimation(btn) {
    if (!btn) return;

    btn.classList.remove('fav-pop');
    void btn.offsetWidth; // reflow: garante replay mesmo em cliques bem rápidos
    btn.classList.add('fav-pop');
    setTimeout(() => btn.classList.remove('fav-pop'), 450);

    // Partículas: 6 pontinhos espalhando em círculo
    const existing = btn.querySelector('.fav-burst');
    if (existing) existing.remove();
    const burst = document.createElement('div');
    burst.className = 'fav-burst';
    const count = 6;
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        dot.style.setProperty('--angle', `${(360 / count) * i}deg`);
        dot.style.animationDelay = `${i * 0.02}s`;
        burst.appendChild(dot);
    }
    btn.appendChild(burst);
    setTimeout(() => burst.remove(), 600);
}

function initAudioAndLyricsEngine() {
    if (!DOM.audio) return;

    DOM.audio.addEventListener('timeupdate', () => {
        const current = DOM.audio.currentTime;
        const duration = DOM.audio.duration || 0;

        if (duration > 0) {
            const pct = current / duration;

            // Seek bar principal
            if (DOM.progressFill) DOM.progressFill.style.width = `${pct * 100}%`;
            const thumb = document.getElementById('progressThumb');
            if (thumb) thumb.style.left = `${pct * 100}%`;

            // Anel SVG circular da mini barra
            const ring = document.getElementById('miniRingFill');
            if (ring) {
                const circumference = 144.5;
                ring.style.strokeDashoffset = circumference * (1 - pct);
            }
        }

        if (DOM.currentTimeTxt) DOM.currentTimeTxt.textContent = formatTime(current);
        if (DOM.totalTimeTxt && duration > 0) DOM.totalTimeTxt.textContent = formatTime(duration);

        updateLyricsHighlight(current);
        
        if (navigator.mediaSession && navigator.mediaSession.setPositionState && duration && !DOM.audio.paused) {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: DOM.audio.playbackRate,
                position: current
            });
        }
    });

    DOM.audio.addEventListener('ended', () => {
        window._showFendaError?.('[DIAG] evento "ended" disparou. repeatMode=' + AppState.repeatMode);
        if (AppState.repeatMode === 2) {
            // repeat-one: fecha a sessão atual e inicia outra ao reiniciar.
            window.flushListenTime?.(1, true);
            window.resetListenPosition?.();
            DOM.audio.currentTime = 0;
            DOM.audio.play().catch(()=>{});
        } else {
            window._showFendaError?.('[DIAG] chamando handleNextTrack()');
            window.flushListenTime?.(1, true);
            handleNextTrack();
            // repeat-all é tratado no handleNextTrack (a fila se reconstrói ao esgotar)
        }
    });

    // ── Salva histórico ao pausar ──────────────────────────────────────────
    // Garante que o tempo ouvido seja registrado mesmo quando o usuário
    // pausa e fecha o app sem trocar de música. Mínimo de 10s para não
    // poluir o histórico com pausas acidentais.
    DOM.audio.addEventListener('pause', () => {
        // O core calcula somente o delta desde o último flush e atualiza a
        // mesma sessão no Supabase, sem duplicar a contagem.
        window.flushListenTime?.(10);
    });

    // ── Salva histórico ao ir para segundo plano ───────────────────────────
    // Captura o caso em que o usuário muda de app enquanto a música toca.
    // O evento 'pause' NÃO é disparado quando o app vai para background
    // continuando a reprodução (ex.: fone de ouvido bluetooth), então
    // tratamos visibilitychange como uma segunda camada de segurança.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'hidden') return;
        if (DOM.audio.paused) return; // já coberto pelo listener 'pause' acima
        window.flushListenTime?.(10);
    });

    if (DOM.playerBottomPlayBtn) DOM.playerBottomPlayBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlayMusic(); });
    if (DOM.bigPlayBtn) DOM.bigPlayBtn.addEventListener('click', () => togglePlayMusic());

    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) prevBtn.addEventListener('click', () => {
        const currentTime = DOM.audio ? DOM.audio.currentTime : 0;

        if (currentTime > 3) {
            // Passou de 3 segundos: reinicia a música atual
            DOM.audio.currentTime = 0;
        } else {
            // Menos de 3 segundos: vai para a música anterior
            handlePrevTrack();
        }
    });

    if (nextBtn) nextBtn.addEventListener('click', () => handleNextTrack());

    // ── Seek bar interativo (clique + arrastar) ──────────────────────
    const seekBar = document.getElementById('progressBar');
    const seekFill = document.getElementById('progressFill');
    const seekThumb = document.getElementById('progressThumb');

    function seekTo(clientX) {
        if (!seekBar || !DOM.audio) return;
        const rect = seekBar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const duration = DOM.audio.duration || 0;
        if (duration > 0) {
            DOM.audio.currentTime = pct * duration;
            if (seekFill) seekFill.style.width = (pct * 100) + '%';
            if (seekThumb) seekThumb.style.left = (pct * 100) + '%';
        }
    }

    if (seekBar) {
        let dragging = false;

        // Toque / mouse down — começa arrastar
        seekBar.addEventListener('mousedown', (e) => {
            dragging = true;
            seekBar.classList.add('dragging');
            seekTo(e.clientX);
        });
        seekBar.addEventListener('touchstart', (e) => {
            dragging = true;
            seekBar.classList.add('dragging');
            seekTo(e.touches[0].clientX);
        }, { passive: true });

        // Mover
        document.addEventListener('mousemove', (e) => {
            if (dragging) seekTo(e.clientX);
        });
        document.addEventListener('touchmove', (e) => {
            if (dragging) seekTo(e.touches[0].clientX);
        }, { passive: true });

        // Soltar
        document.addEventListener('mouseup', () => {
            if (dragging) { dragging = false; seekBar.classList.remove('dragging'); }
        });
        document.addEventListener('touchend', () => {
            if (dragging) { dragging = false; seekBar.classList.remove('dragging'); }
        });

        // Clique simples
        seekBar.addEventListener('click', (e) => seekTo(e.clientX));
    }

    // Compat com DOM.progressBar antigo
    if (DOM.progressBar && DOM.progressBar !== seekBar) {
        DOM.progressBar.addEventListener('click', (e) => {
            const rect = DOM.progressBar.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const duration = DOM.audio.duration || 0;
            if (duration > 0) DOM.audio.currentTime = pct * duration;
        });
    }

    if (DOM.shuffleBtn) {
        DOM.shuffleBtn.addEventListener('click', () => {
            AppState.isShuffle = !AppState.isShuffle;
            DOM.shuffleBtn.classList.toggle('active', AppState.isShuffle);

            DOM.shuffleBtn.classList.remove('ctrl-toggled');
            void DOM.shuffleBtn.offsetWidth;
            DOM.shuffleBtn.classList.add('ctrl-toggled');
            setTimeout(() => DOM.shuffleBtn.classList.remove('ctrl-toggled'), 450);

            const ctx = AppState.playContext;
            const originalList = AppState._originalTrackList?.length > 0
                ? AppState._originalTrackList
                : (ctx?.trackList?.length > 0 ? ctx.trackList : AppState.musics);
            if (!AppState._originalTrackList?.length) {
                AppState._originalTrackList = [...originalList];
            }
            const trackList = AppState.isShuffle
                ? originalList
                : (AppState._originalTrackList?.length > 0 ? AppState._originalTrackList : AppState.musics);

            AppState.autoQueue = buildAutoQueue(AppState.currentMusicId, trackList, AppState.isShuffle);
            if (typeof window.renderQueuePanel === 'function') window.renderQueuePanel();
            if (typeof window.savePlayerSession === 'function') window.savePlayerSession();
        });
    }
    if (DOM.repeatBtn) {
        DOM.repeatBtn.addEventListener('click', () => {
            // UX do botão: 0 (off) → 2 (repeat-one) → 1 (repeat-all) → 0.
            // O primeiro toque deve repetir a música atual, como o usuário espera.
            const repeatCycle = [0, 2, 1];
            const currentIndex = repeatCycle.indexOf(AppState.repeatMode);
            AppState.repeatMode = repeatCycle[(currentIndex + 1) % repeatCycle.length];
            const icon = DOM.repeatBtn.querySelector('.material-symbols-rounded');

            DOM.repeatBtn.classList.remove('ctrl-toggled');
            void DOM.repeatBtn.offsetWidth;
            DOM.repeatBtn.classList.add('ctrl-toggled');
            setTimeout(() => DOM.repeatBtn.classList.remove('ctrl-toggled'), 450);

            DOM.repeatBtn.classList.toggle('active', AppState.repeatMode !== 0);
            if (icon) icon.textContent = AppState.repeatMode === 2 ? 'repeat_one' : 'repeat';
            if (typeof window.savePlayerSession === 'function') window.savePlayerSession();
        });
    }

    // ── Mini barra — listeners ──────────────────────────────────────
    const miniBar       = document.getElementById('playerBottomBar');
    const miniCoverWrap = document.getElementById('miniCoverWrap');
    const miniInfoArea  = document.getElementById('miniInfoArea');
    const miniPlayBtn   = document.getElementById('playerBottomPlayBtn');
    const miniPrevBtn   = document.getElementById('miniPrevBtnBar');
    const miniNextBtn   = document.getElementById('miniNextBtnBar');

    // Cover → abre player expandido
    if (miniCoverWrap) {
        miniCoverWrap.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.expandLyricsScreen === 'function') window.expandLyricsScreen();
        });
    }

    // Info → abre player expandido
    if (miniInfoArea) {
        miniInfoArea.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.expandLyricsScreen === 'function') window.expandLyricsScreen();
        });
    }

    // Play/Pause
    if (miniPlayBtn) {
        miniPlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.togglePlayMusic === 'function') window.togglePlayMusic();
        });
    }

    // Anterior
    if (miniPrevBtn) {
        miniPrevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.handlePrevTrack === 'function') window.handlePrevTrack();
        });
    }

    // Próxima
    if (miniNextBtn) {
        miniNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.handleNextTrack === 'function') window.handleNextTrack();
        });
    }

    // Clique no resto da barra → abre player
    if (miniBar) {
        miniBar.addEventListener('click', () => {
            if (typeof window.expandLyricsScreen === 'function') window.expandLyricsScreen();
        });
    }

    // Detecta quando usuário rola manualmente (playerScrollArea é o scroll real)
    function attachScrollListener() {
        const scrollArea = document.getElementById('playerScrollArea');
        if (scrollArea && !scrollArea._userScrollListener) {
            scrollArea._userScrollListener = true;
            scrollArea.addEventListener('scroll', () => {
                AppState.isUserScrolling = true;
                clearTimeout(AppState.userScrollTimeout);
                AppState.userScrollTimeout = setTimeout(() => {
                    AppState.isUserScrolling = false;
                }, 5000); // 5s de pausa antes de retomar auto-scroll
            }, { passive: true });
        }
    }
    attachScrollListener();
    // Tenta novamente após render (player pode não estar no DOM ainda)
    setTimeout(attachScrollListener, 1000);

    // ===== Botão de compartilhar (novo sistema com preview 30s + imagem) =====
    ShareUIHandler.init();
}

function parseLyrics(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    lines.forEach(line => {
        const match = timeReg.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const ms = parseInt(match[3]);
            const time = min * 60 + sec + (ms > 99 ? ms / 1000 : ms / 100);
            const lyric = line.replace(timeReg, '').trim();
            if (lyric) result.push({ time, text: lyric });
        }
    });
    return result.sort((a, b) => a.time - b.time);
}

function _getCurrentPlayerTrack() {
    const currentId = AppState.currentMusicId;
    return AppState.musics.find(m => m.id === currentId)
        || AppState.playContext?.trackList?.find(m => m.id === currentId)
        || null;
}

function _setLyricsSectionMode(isPodcast) {
    document.querySelectorAll('[data-player-lyrics-label]').forEach((label) => {
        label.textContent = isPodcast ? 'Descrição' : 'Letra';
    });
    document.querySelectorAll('[data-player-lyrics-icon]').forEach((icon) => {
        const iconName = isPodcast ? 'description' : 'lyrics';
        icon.textContent = iconName;
        icon.setAttribute('data-player-lyrics-icon', iconName);
    });
}

function _renderPodcastDescription(music) {
    const description = String(music?.description || '').trim();
    const wrapper = document.createElement('div');
    wrapper.className = 'podcast-description';

    const text = document.createElement('p');
    text.className = 'podcast-description-text';
    text.textContent = description || 'Este episódio não possui descrição.';

    wrapper.appendChild(text);
    DOM.lyricsContainer.appendChild(wrapper);
}

function buildLyricsMarkup() {
    if (!DOM.lyricsContainer) return;
    DOM.lyricsContainer.innerHTML = '';
    _lastLyricIndex = -1; // reseta ao trocar de música
    if (_lyricsScrollFrame) { cancelAnimationFrame(_lyricsScrollFrame); _lyricsScrollFrame = null; }

    const music = _getCurrentPlayerTrack();
    const isPodcast = music?.type === 'podcast'
        || String(AppState.currentMusicId || '').startsWith('podcast:')
        || (!music && AppState.playContext?.source === 'podcast');
    _setLyricsSectionMode(isPodcast);

    if (isPodcast) {
        _renderPodcastDescription(music);
        return;
    }

    if (AppState.lyricsData.length === 0) {
        DOM.lyricsContainer.innerHTML = `
            <div class="lyrics-unavailable">
                <span class="material-symbols-rounded">music_note</span>
                <p>Letra não disponível</p>
                <span>Esta música não tem letra sincronizada</span>
                ${music?.title ? `<div class="lyrics-unavailable-music">
                    <img src="${music.cover || ''}" onerror="this.style.display='none'">
                    <div>
                        <b>${music.title}</b>
                        <small>${music.artist}</small>
                    </div>
                </div>` : ''}
            </div>`;
        return;
    }

    AppState.lyricsData.forEach((line, index) => {
        const p = document.createElement('p');
        p.className = 'lyric-line';
        p.id = `lyric-line-${index}`;
        p.textContent = line.text;
        p.addEventListener('click', () => {
            if (DOM.audio) DOM.audio.currentTime = line.time;
        });
        DOM.lyricsContainer.appendChild(p);
    });
}

let _lastLyricIndex = -1;
let _lyricsScrollFrame = null;
let _lyricsScrollTarget = null;
let _lyricsCurrentScroll = null;

function updateLyricsHighlight(currentTime) {
    if (AppState.lyricsData.length === 0) return;

    let activeIndex = -1;
    for (let i = 0; i < AppState.lyricsData.length; i++) {
        if (currentTime >= AppState.lyricsData[i].time) activeIndex = i;
        else break;
    }

    if (activeIndex === -1) return;

    // Destaca a linha ativa
    if (activeIndex !== _lastLyricIndex) {
        _lastLyricIndex = activeIndex;
        document.querySelectorAll('.lyric-line').forEach(el => el.classList.remove('active'));
        const activeLine = document.getElementById(`lyric-line-${activeIndex}`);
        if (activeLine) {
            activeLine.classList.add('active');
            _scrollToLyricLine(activeLine);
        }
    }
}

function _scrollToLyricLine(lineEl) {
    if (AppState.isUserScrolling) return;

    const scrollArea = document.getElementById('playerScrollArea');
    if (!scrollArea) return;

    const pageH = scrollArea.clientHeight;
    const isOnLyrics = scrollArea.scrollTop > pageH * 0.5;
    if (!isOnLyrics) return;

    // Posição absoluta da linha dentro do scrollArea
    const scrollAreaRect = scrollArea.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();
    const lineAbsTop = lineRect.top - scrollAreaRect.top + scrollArea.scrollTop;

    // Alvo: linha no terço superior da tela
    const target = lineAbsTop - pageH * 0.30;

    _smoothScrollTo(scrollArea, target);
}

// Animação de scroll suave com requestAnimationFrame
function _smoothScrollTo(el, target) {
    if (_lyricsScrollFrame) cancelAnimationFrame(_lyricsScrollFrame);

    const start = el.scrollTop;
    const distance = target - start;
    const duration = 600; // ms — suave mas não lento demais
    let startTime = null;

    function ease(t) {
        // Curva easeInOutCubic
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        el.scrollTop = start + distance * ease(progress);

        if (progress < 1) {
            _lyricsScrollFrame = requestAnimationFrame(step);
        } else {
            _lyricsScrollFrame = null;
        }
    }

    _lyricsScrollFrame = requestAnimationFrame(step);
}

function updatePlayerVisibility(music) {
    if (!music) return;

    // Mini barra
    if (DOM.playerBottomBar) DOM.playerBottomBar.style.display = 'flex';
    if (DOM.playerBottomCover) DOM.playerBottomCover.src = music.cover || '';
    if (DOM.playerBottomTitle) DOM.playerBottomTitle.textContent = music.title;
    if (DOM.playerBottomArtist) DOM.playerBottomArtist.textContent = music.artist;
    // Empurra conteúdo pra cima para não sobrepor cards
    document.body.classList.add('player-active');

    // Player expandido — header
    if (DOM.lyricsTrackTitle) DOM.lyricsTrackTitle.textContent = music.title;
    if (DOM.lyricsTrackArtist) DOM.lyricsTrackArtist.textContent = music.artist;

    // Cover
    const cover = document.getElementById('playerExpandedCover');
    if (cover) cover.src = music.cover || '';

    // Mini cover (player expandido)
    const miniCover = document.getElementById('playerMiniCover');
    if (miniCover) miniCover.src = music.cover || '';

    // Botão favorito da mini barra
    const miniFavBtn = document.getElementById('miniFavBtn');
    if (miniFavBtn && AppState.favorites) {
        const isFav = typeof window.isFavoriteTrack === 'function'
            ? window.isFavoriteTrack(music.id)
            : AppState.favorites.has(String(music.id));
        miniFavBtn.classList.toggle('active', isFav);
        miniFavBtn.querySelector('.material-symbols-rounded').textContent = isFav ? 'favorite' : 'favorite_border';
        const newFav = miniFavBtn.cloneNode(true);
        miniFavBtn.parentNode.replaceChild(newFav, miniFavBtn);
        newFav.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.toggleFavoriteTrack === 'function') window.toggleFavoriteTrack(music.id);
            setTimeout(() => updatePlayerVisibility(music), 100);
        });
    }

    // Botão ⋮ da mini barra
    const miniMoreBtn = document.getElementById('playerBottomMoreBtn');
    if (miniMoreBtn) {
        const newMore = miniMoreBtn.cloneNode(true);
        miniMoreBtn.parentNode.replaceChild(newMore, miniMoreBtn);
        newMore.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
        });
    }

    // Botão play/pause no cover da mini barra
    const miniPlayBtn = document.getElementById('playerBottomPlayBtn');
    if (miniPlayBtn) {
        const newBtn = miniPlayBtn.cloneNode(true);
        miniPlayBtn.parentNode.replaceChild(newBtn, miniPlayBtn);
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.togglePlayMusic === 'function') window.togglePlayMusic();
        });
    }

    // Títulos
    const title = document.getElementById('playerExpandedTitle');
    if (title) title.textContent = music.title;
    const artist = document.getElementById('playerExpandedArtist');
    if (artist) artist.textContent = music.artist;
    const headerTitle = document.getElementById('lyricsTrackTitle');
    if (headerTitle) headerTitle.textContent = music.title;
    const miniTitle = document.getElementById('playerMiniTitle');
    if (miniTitle) miniTitle.textContent = music.title;
    const miniArtist = document.getElementById('playerMiniArtist');
    if (miniArtist) miniArtist.textContent = music.artist;

    // Contexto (playlist ou biblioteca)
    const ctxEl = document.getElementById('playerContext');
    if (ctxEl) {
        const source = AppState.playContext?.source;
        const ctx = source === 'playlist'
            ? 'TOCANDO DA PLAYLIST'
            : source === 'podcast' ? 'PODCASTS' : 'FENDA MUSIC';
        ctxEl.textContent = ctx;
    }

    // Fundo dinâmico com cor da capa
    if (music.cover) {
        _extractColorFromCover(music.cover).then(color => {
            const bg = document.getElementById('playerBg');
            if (bg) bg.style.background = `linear-gradient(160deg, ${color} 0%, #0c0916 65%)`;
        });
    }

    // Botão favorito
    const favBtn = document.getElementById('playerExpandedFavBtn');
    if (favBtn && AppState.favorites) {
        const isFav = typeof window.isFavoriteTrack === 'function'
            ? window.isFavoriteTrack(music.id)
            : AppState.favorites.has(String(music.id));
        favBtn.classList.toggle('active', isFav);
        favBtn.querySelector('.material-symbols-rounded').textContent = isFav ? 'favorite' : 'favorite_border';
        const newFav = favBtn.cloneNode(true);
        favBtn.parentNode.replaceChild(newFav, favBtn);
        newFav.addEventListener('click', () => {
            const wasFav = typeof window.isFavoriteTrack === 'function'
                ? window.isFavoriteTrack(music.id)
                : AppState.favorites.has(String(music.id));
            if (typeof window.toggleFavoriteTrack === 'function') window.toggleFavoriteTrack(music.id);
            // Só anima o "curtir" (false → true), não o "descurtir"
            if (!wasFav) _playFavPopAnimation(newFav);
            setTimeout(() => updatePlayerVisibility(music), 100);
        });
    }

    // Botão ⋮ no player
    const moreBtn = document.getElementById('playerMoreBtn');
    if (moreBtn) {
        const newMore = moreBtn.cloneNode(true);
        moreBtn.parentNode.replaceChild(newMore, moreBtn);
        newMore.addEventListener('click', () => {
            if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
        });
    }

    // Setup scroll para mostrar mini controles ao ver letras
    _setupPlayerScroll();
}

function updatePlayerUIState() {
    const icon = AppState.playing ? 'pause' : 'play_arrow';
    // Botão play principal (player expandido)
    if (DOM.bigPlayBtn) DOM.bigPlayBtn.innerHTML = `<span class="material-symbols-rounded">${icon}</span>`;
    // Mini play no cover da barra inferior
    const bottomPlayBtn = document.getElementById('playerBottomPlayBtn');
    if (bottomPlayBtn) bottomPlayBtn.innerHTML = `<span class="material-symbols-rounded">${icon}</span>`;
    // Mini play no player de letras
    const miniPlay = document.getElementById('miniPlayBtn');
    if (miniPlay) miniPlay.innerHTML = `<span class="material-symbols-rounded">${icon}</span>`;

    document.querySelectorAll('.inline-play-btn').forEach(btn => {
        const cardId = parseInt(btn.getAttribute('data-id'));
        const card = btn.closest('.music-card');
        if (cardId === AppState.currentMusicId) {
            btn.classList.add('active-inline');
            if (AppState.playing) {
                btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px;">pause</span>`;
                card?.classList.add('playing');
                card?.classList.remove('paused');
            } else {
                btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px;">play_arrow</span>`;
                card?.classList.remove('playing');
                card?.classList.add('paused');
            }
        } else {
            btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px;">play_arrow</span>`;
            btn.classList.remove('active-inline');
            card?.classList.remove('playing');
            card?.classList.remove('paused');
        }
    });
}

function updateMediaSession(music) {
    if (!navigator.mediaSession) return;
    
    navigator.mediaSession.metadata = new MediaMetadata({
        title: music.title,
        artist: music.artist,
        album: 'Fenda Music',
        artwork: [
            { src: music.cover, sizes: '96x96', type: 'image/jpeg' },
            { src: music.cover, sizes: '128x128', type: 'image/jpeg' },
            { src: music.cover, sizes: '192x192', type: 'image/jpeg' },
            { src: music.cover, sizes: '256x256', type: 'image/jpeg' }
        ]
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayMusic());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayMusic());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => handleNextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (DOM.audio) DOM.audio.currentTime = details.seekTime;
    });
}

function expandLyricsScreen() {
    const el = document.getElementById('lyricsFullScreen');
    if (el) el.classList.add('expanded');
}
function collapseLyricsScreen() {
    const el = document.getElementById('lyricsFullScreen');
    if (el) el.classList.remove('expanded');
}

// Exportações (sem handleNextTrack/handlePrevTrack, pois já vêm do core)
// Extrai cor dominante da capa via canvas
async function _extractColorFromCover(src) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 10; canvas.height = 10;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 10, 10);
                const d = ctx.getImageData(0, 0, 10, 10).data;
                let r = 0, g = 0, b = 0;
                for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
                const n = d.length / 4;
                // Escurece um pouco para não ficar muito vibrante
                resolve(`rgb(${Math.floor(r/n*0.6)}, ${Math.floor(g/n*0.6)}, ${Math.floor(b/n*0.6)})`);
            };
            img.onerror = () => resolve('#1a1040');
            img.src = src;
        } catch { resolve('#1a1040'); }
    });
}

// Configura scroll do player para mostrar mini controles ao ver letras
function _setupPlayerScroll() {
    const scrollArea = document.getElementById('playerScrollArea');
    const miniControls = document.getElementById('playerMiniControls');
    const miniPlay = document.getElementById('miniPlayBtn');
    const miniPrev = document.getElementById('miniPrevBtn');
    const miniNext = document.getElementById('miniNextBtn');

    if (!scrollArea) return;

    // Remove listener anterior
    scrollArea._scrollHandler && scrollArea.removeEventListener('scroll', scrollArea._scrollHandler);

    scrollArea._scrollHandler = () => {
        const scrolled = scrollArea.scrollTop;
        const pageH = scrollArea.clientHeight;
        // Mostra mini controles quando estiver na página de letras (scrolled > 80% da altura)
        const showMini = scrolled > pageH * 0.8;
        if (miniControls) miniControls.classList.toggle('visible', showMini);
    };
    scrollArea.addEventListener('scroll', scrollArea._scrollHandler, { passive: true });

    // Botões do mini controle
    if (miniPlay) {
        const newBtn = miniPlay.cloneNode(true);
        miniPlay.parentNode.replaceChild(newBtn, miniPlay);
        newBtn.addEventListener('click', () => togglePlayMusic());
    }
    if (miniPrev) {
        const newBtn = miniPrev.cloneNode(true);
        miniPrev.parentNode.replaceChild(newBtn, miniPrev);
        newBtn.addEventListener('click', () => handlePrevTrack());
    }
    if (miniNext) {
        const newBtn = miniNext.cloneNode(true);
        miniNext.parentNode.replaceChild(newBtn, miniNext);
        newBtn.addEventListener('click', () => handleNextTrack());
    }
}

// Atualizar ícone do mini play quando estado muda
const _origUpdateUIState = window.updatePlayerUIState;

window.initAudioAndLyricsEngine = initAudioAndLyricsEngine; 
window.parseLyrics = parseLyrics; 
window.buildLyricsMarkup = buildLyricsMarkup; 
window.updatePlayerVisibility = updatePlayerVisibility; 
window.updatePlayerUIState = updatePlayerUIState; 
window.expandLyricsScreen = expandLyricsScreen; 
window.collapseLyricsScreen = collapseLyricsScreen; 
window.updateMediaSession = updateMediaSession;