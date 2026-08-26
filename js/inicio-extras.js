/* ============================================================
   FENDA MUSIC — INICIO EXTRAS v7
   + "Atalhos rápidos" → "Seus clássicos"
   + "Populares entre usuários" (ordena por play_count ou proxy)
   ============================================================ */

(function() {
    'use strict';

    const TAB = document.getElementById('inicio');
    if (!TAB) return;

    // ============================================================
    // HELPERS
    // ============================================================

    function esc(str) {
        if (window.escapeHtml) return window.escapeHtml(str);
        return String(str || '').replace(/[&<>"']/g, c =>
            ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function safe(url) {
        if (window.sanitizeUrl) return window.sanitizeUrl(url);
        if (!url) return '';
        try {
            const u = new URL(url, window.location.origin);
            return ['http:','https:','data:','blob:'].includes(u.protocol) ? u.toString() : '';
        } catch { return ''; }
    }

    function greet(h) {
        if (h < 5)  return 'Boa madrugada';
        if (h < 12) return 'Bom dia';
        if (h < 18) return 'Boa tarde';
        return 'Boa noite';
    }

    function formatDate() {
        const days   = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
        const months = ['janeiro','fevereiro','março','abril','maio','junho','julho',
                        'agosto','setembro','outubro','novembro','dezembro'];
        const n = new Date();
        return `${days[n.getDay()]}, ${n.getDate()} de ${months[n.getMonth()]}`;
    }

    function fmtTime(secs) {
        const s = Math.floor(Math.max(0, secs));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function getUserId() {
        return window.AppState?.userId || window.AppState?.user?.id || null;
    }

    function getMusics() {
        const lib = window.AppState?.musics || [];
        return Array.isArray(lib) ? lib : [];
    }

    function resolveTrack(item) {
        if (!item) return null;
        const id  = item.id ?? item.trackId;
        const lib = getMusics();
        return lib.find(m => String(m.id) === String(id)) || item;
    }

    function play(item, options = {}) {
        const track = resolveTrack(item);
        if (track && window.playMusicTrack) window.playMusicTrack(track, options);
    }

    // ============================================================
    // REORDENAR — artistas acima de recentes
    // ============================================================

    function reorderHomeSections() {
        const recentEl  = document.getElementById('recentlyPlayedList');
        const artistsEl = document.getElementById('favoriteArtistsList');
        if (!recentEl || !artistsEl) return;

        const recentSec  = recentEl.closest('.home-section')  || recentEl.parentElement;
        const artistsSec = artistsEl.closest('.home-section') || artistsEl.parentElement;
        if (!recentSec || !artistsSec || recentSec === artistsSec) return;

        const parent = recentSec.parentElement;
        if (!parent) return;

        const kids     = Array.from(parent.children);
        const iRecent  = kids.indexOf(recentSec);
        const iArtists = kids.indexOf(artistsSec);
        if (iArtists > iRecent) parent.insertBefore(artistsSec, recentSec);
    }

    // ============================================================
    // 01 — HEADER PESSOAL
    // ============================================================

    async function renderHeader() {
        TAB.querySelectorAll('.inicio-header').forEach(el => el.remove());

        const hour = new Date().getHours();
        const header = document.createElement('div');
        header.className = 'inicio-header';
        header.innerHTML = `
            <div class="inicio-avatar fallback" id="ieAvatar">
                <span class="inicio-avatar-initial" id="ieInitial">…</span>
            </div>
            <div class="inicio-header-text">
                <p class="inicio-greeting">${greet(hour)},</p>
                <h1 class="inicio-name" id="ieName">…</h1>
                <p class="inicio-date">${formatDate()}</p>
            </div>
            <button class="inicio-notif-btn" id="notifBellBtn" aria-label="Notificações">
                <span class="material-symbols-rounded">notifications</span>
                <span class="inicio-notif-dot" id="notifDot"></span>
            </button>
        `;
        // Abre tela de notificações ao clicar no sino
        header.querySelector('#notifBellBtn')?.addEventListener('click', () => {
            window.FendaNotifications?.openNotifications();
        });
        // Atualiza bolinha imediatamente após criar o botão
        // (renderHeader pode ser chamado mais de uma vez — garantir dot sempre atualizado)
        window.FendaNotifications?.updateDot();
        TAB.prepend(header);

        try {
            const userId = getUserId();
            if (!userId) return;

            let profile = window.AppState?.userProfile;
            if (!profile?.full_name && window.getUserProfile) {
                profile = await window.getUserProfile(userId);
            }
            if (!profile) return;

            const firstName = String(profile.full_name || profile.nome || '').split(' ')[0] || 'Você';
            const initial   = firstName.charAt(0).toUpperCase();

            const nameEl    = document.getElementById('ieName');
            const initialEl = document.getElementById('ieInitial');
            const avatarEl  = document.getElementById('ieAvatar');

            if (nameEl)    nameEl.textContent    = firstName;
            if (initialEl) initialEl.textContent = initial;

            const rawUrl = profile.avatar_url;
            if (rawUrl && avatarEl && window.UserCacheDB) {
                const src = await window.UserCacheDB.getAvatarUrl(userId, rawUrl);
                if (src) {
                    const img    = document.createElement('img');
                    img.alt      = esc(firstName);
                    img.src      = src;
                    img.onload   = () => avatarEl.classList.remove('fallback');
                    img.onerror  = () => { img.remove(); avatarEl.classList.add('fallback'); };
                    avatarEl.appendChild(img);
                }
            }
        } catch (e) {
            console.warn('[inicio-extras] header:', e);
        }
    }

    // ============================================================
    // 02 — CONTINUE OUVINDO
    // ============================================================

    function renderContinue() {
        // A retomada agora acontece automaticamente no boot do player. O
        // mini-player continua sendo a indicação compacta da faixa atual;
        // não exibimos mais um card grande no topo da Home.
        TAB.querySelectorAll('.continue-section').forEach(el => el.remove());
        return;

        /* legado: mantido abaixo apenas para preservar o histórico do módulo.
        const audio = document.getElementById('audio');
        const savedSession = typeof window.loadPlayerSession === 'function'
            ? window.loadPlayerSession()
            : null;
        const sessionTrack = savedSession?.musicId
            ? getMusics().find(m => String(m.id) === String(savedSession.musicId))
            : null;
        const histItem = window.AppState?.history?.[0];
        const track = sessionTrack || resolveTrack(histItem);
        if (!track) return;

        // Em primeiro lugar usamos a sessão persistida: ela continua existindo
        // mesmo quando o áudio não está carregado após fechar o aplicativo.
        const time = sessionTrack
            ? Number(savedSession.currentTime) || 0
            : Number(audio?.currentTime) || 0;
        const duration = sessionTrack
            ? Number(savedSession.duration) || Number(track.duration) || Number(audio?.duration) || 0
            : Number(track.duration) || Number(audio?.duration) || 0;
        if (time <= 5 || (duration > 0 && time >= duration - 3)) return;

        const remaining = duration > 0 ? duration - time : 0;
        const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
        const remainTxt = remaining > 0 ? `Faltam ${fmtTime(remaining)}` : '';

        const sec = document.createElement('section');
        sec.className = 'home-section continue-section';
        sec.innerHTML = `
            <div class="continue-card" role="button" tabindex="0">
                <div class="continue-bg" style="background-image:url('${safe(track.cover)}')"></div>
                <div class="continue-dark"></div>
                <div class="continue-body">
                    <img class="continue-cover" src="${safe(track.cover)}" alt="${esc(track.title)}">
                    <div class="continue-info">
                        <span class="continue-label">CONTINUE OUVINDO</span>
                        <h3 class="continue-title">${esc(track.title)}</h3>
                        <p class="continue-artist">${esc(track.artist || '')}</p>
                        <div class="continue-progress-wrap">
                            <span class="continue-time">${fmtTime(time)}</span>
                            <div class="continue-bar">
                                <div class="continue-fill" style="width:${pct}%">
                                    <div class="continue-thumb"></div>
                                </div>
                            </div>
                            <span class="continue-time">${duration > 0 ? fmtTime(duration) : '—'}</span>
                        </div>
                        ${remainTxt ? `<span class="continue-remaining">${esc(remainTxt)}</span>` : ''}
                    </div>
                    <button class="continue-btn" aria-label="Continuar tocando">
                        <span class="material-symbols-rounded">play_arrow</span>
                    </button>
                </div>
            </div>
        `;
        sec.querySelector('.continue-card').addEventListener('click', () => {
            play(track, { resumeAt: time });
        });

        const banner = document.getElementById('featuredBanner');
        if (banner) banner.parentNode.insertBefore(sec, banner);
        else TAB.appendChild(sec);
        */
    }

    // ============================================================
    // 03 — SEUS CLÁSSICOS (antes: Atalhos rápidos)
    // ============================================================

    function renderQuickPicks() {
        TAB.querySelectorAll('.quick-picks-section').forEach(el => el.remove());

        const history = window.AppState?.history || [];
        if (!history.length) return;

        const counts = {}, lastItem = {};
        for (const item of history) {
            const id = String(item?.id ?? item?.trackId ?? '');
            if (!id) continue;
            counts[id] = (counts[id] || 0) + 1;
            if (!lastItem[id]) lastItem[id] = item;
        }

        const top = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([id]) => resolveTrack(lastItem[id]))
            .filter(t => t?.title);

        if (top.length < 4) return;

        const sec = document.createElement('section');
        sec.className = 'home-section quick-picks-section';
        sec.innerHTML = `
            <div class="section-header">
                <h2><span class="material-symbols-rounded">star</span>Seus clássicos</h2>
            </div>
            <div class="quick-picks-grid">
                ${top.map(t => `
                    <button class="quick-pick" type="button">
                        <img src="${safe(t.cover || '')}" alt="${esc(t.title)}">
                        <span class="quick-pick-title">${esc(t.title)}</span>
                    </button>
                `).join('')}
            </div>
        `;
        sec.querySelectorAll('.quick-pick').forEach((btn, i) => {
            btn.addEventListener('click', () => play(top[i]));
        });

        const banner = document.getElementById('featuredBanner');
        const after  = banner || TAB.querySelector('.continue-section');
        if (after) after.parentNode.insertBefore(sec, after.nextSibling);
        else TAB.appendChild(sec);
    }

    // ============================================================
    // 04 — TOP DA SEMANA
    // ============================================================

    let weeklyRankingRequest = 0;

    function buildWeeklySection(top5) {
        const ranks = ['🥇', '🥈', '🥉', '4', '5'];
        const sec = document.createElement('section');
        sec.className = 'home-section weekly-section';
        sec.innerHTML = `
            <div class="section-header">
                <h2><span class="material-symbols-rounded">trending_up</span>Top da semana</h2>
            </div>
            <div class="weekly-list">
                ${top5.map((t, i) => `
                    <button class="weekly-item" type="button">
                        <span class="weekly-rank">${i < 3 ? ranks[i] : i + 1}</span>
                        <img class="weekly-cover" src="${safe(t.cover || '')}" alt="${esc(t.title)}">
                        <div class="weekly-info">
                            <p class="weekly-title">${esc(t.title)}</p>
                            <p class="weekly-artist">${esc(t.artist || '')}</p>
                        </div>
                        <span class="weekly-plays">${t.weekPlays}×</span>
                    </button>
                `).join('')}
            </div>
        `;
        sec.querySelectorAll('.weekly-item').forEach((btn, i) => {
            btn.addEventListener('click', () => play(top5[i]));
        });
        return sec;
    }

    function insertWeeklySection(sec) {
        const anchor = TAB.querySelector('.quick-picks-section');
        if (anchor) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
        else TAB.appendChild(sec);
    }

    function renderWeeklyTop() {
        TAB.querySelectorAll('.weekly-section').forEach(el => el.remove());

        const history = window.AppState?.history || [];
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const counts = {}, lastItem = {};
        for (const item of history) {
            const id = String(item?.id ?? item?.trackId ?? '');
            const playedAt = item.playedAt ? new Date(item.playedAt).getTime() : Date.now();
            if (!id || playedAt < oneWeekAgo) continue;
            counts[id] = (counts[id] || 0) + 1;
            if (!lastItem[id]) lastItem[id] = item;
        }
        const localTop = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, plays]) => {
                const track = resolveTrack(lastItem[id]);
                return track ? { ...track, weekPlays: plays } : null;
            }).filter(Boolean);
        if (localTop.length) insertWeeklySection(buildWeeklySection(localTop));

        const requestId = ++weeklyRankingRequest;
        if (typeof window.loadGlobalMusicRanking !== 'function') return;
        window.loadGlobalMusicRanking(5, 7).then(rows => {
            if (requestId !== weeklyRankingRequest || !Array.isArray(rows)) return;
            const ranked = rows.map(row => {
                const local = resolveTrack({ id: row.music_id });
                const cover = row.cover || local?.cover || '';
                const title = row.title || local?.title || '';
                if (!cover || !title) return null;
                return {
                    ...(local || {}),
                    id: row.music_id,
                    title,
                    artist: row.artist || local?.artist || '',
                    cover,
                    weekPlays: Number(row.play_count) || 0,
                };
            }).filter(Boolean).slice(0, 5);
            if (!ranked.length) return;
            TAB.querySelectorAll('.weekly-section').forEach(el => el.remove());
            insertWeeklySection(buildWeeklySection(ranked));
        }).catch(() => {});
    }

    // ============================================================
    // 05 — DESCOBRIR
    // ============================================================

    function renderDiscover() {
        TAB.querySelectorAll('.discover-section').forEach(el => el.remove());

        const musics = getMusics().filter(t => t?.cover && t?.title);
        if (musics.length < 4) return;

        const history   = window.AppState?.history || [];
        const recentIds = new Set(
            history.slice(0, 20).map(h => String(h?.id ?? h?.trackId ?? '')).filter(Boolean)
        );

        // Prioriza músicas ainda não ouvidas, mas não deixa a seção sumir
        // quando o catálogo do usuário é pequeno ou todo o catálogo já foi ouvido.
        const unseen = musics.filter(t => !recentIds.has(String(t.id)));
        const candidates = unseen.length >= 4 ? unseen : musics;
        const picks = [...candidates].sort(() => Math.random() - 0.5).slice(0, 4);

        const sec = document.createElement('section');
        sec.className = 'home-section discover-section';
        sec.innerHTML = `
            <div class="section-header">
                <h2><span class="material-symbols-rounded">explore</span>Descobrir</h2>
                <button class="section-see-all" data-action="refresh">
                    <span class="material-symbols-rounded"
                          style="font-size:14px;vertical-align:-3px">refresh</span> Trocar
                </button>
            </div>
            <div class="discover-grid">
                ${picks.map(t => `
                    <button class="discover-card" type="button">
                        <img src="${safe(t.cover)}" alt="${esc(t.title)}">
                        <div class="discover-overlay">
                            <span class="discover-label">REDESCOBRIR</span>
                            <h4 class="discover-title">${esc(t.title)}</h4>
                            <p class="discover-artist">${esc(t.artist || '')}</p>
                        </div>
                        <span class="material-symbols-rounded discover-play">play_arrow</span>
                    </button>
                `).join('')}
            </div>
        `;
        sec.querySelectorAll('.discover-card').forEach((btn, i) => {
            btn.addEventListener('click', () => play(picks[i]));
        });
        sec.querySelector('[data-action="refresh"]')?.addEventListener('click', e => {
            e.stopPropagation(); renderDiscover();
        });

        const anchor = TAB.querySelector('.weekly-section') || TAB.querySelector('.quick-picks-section');
        if (anchor) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
        else TAB.appendChild(sec);
    }

    // ============================================================
    // 06 — POPULARES ENTRE USUÁRIOS
    // O Supabase fornece o ranking global agregado; o catálogo local
    // continua como fallback instantâneo/offline.
    // ============================================================

    let popularRankingRequest = 0;

    function buildPopularSection(sorted, isGlobal = false) {
        const badges = ['🔥', '🔥', '🔥'];
        const sec = document.createElement('section');
        sec.className = 'home-section popular-section';
        sec.innerHTML = `
            <div class="section-header">
                <h2><span class="material-symbols-rounded">local_fire_department</span>Populares entre os usuários</h2>
            </div>
            <div class="popular-track">
                ${sorted.map((t, i) => `
                    <button class="popular-card" type="button">
                        <div class="popular-cover-wrap">
                            <img src="${safe(t.cover)}" alt="${esc(t.title)}">
                            ${i < 3 ? `<span class="popular-fire">${badges[i]}</span>` : ''}
                        </div>
                        <p class="popular-title">${esc(t.title)}</p>
                        <p class="popular-artist">${esc(t.artist || '')}</p>
                        ${isGlobal && t.playCount > 0
                            ? `<span class="popular-count">${t.playCount.toLocaleString('pt-BR')} plays</span>`
                            : ''}
                    </button>
                `).join('')}
            </div>
        `;
        sec.querySelectorAll('.popular-card').forEach((btn, i) => {
            btn.addEventListener('click', () => play(sorted[i]));
        });
        return sec;
    }

    function insertPopularSection(sec) {
        const anchor = TAB.querySelector('.discover-section')
                    || TAB.querySelector('.weekly-section');
        if (anchor) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
        else TAB.appendChild(sec);
        window.syncHomeTrackAlignment?.(sec.querySelector('.popular-track'));
    }

    function renderPopular() {
        TAB.querySelectorAll('.popular-section').forEach(el => el.remove());

        const musics = getMusics().filter(m => m?.cover && m?.title);
        if (musics.length < 3) return;

        const history = window.AppState?.history || [];
        const counts = {};
        for (const item of history) {
            const id = String(item?.id ?? item?.trackId ?? '');
            if (id) counts[id] = (counts[id] || 0) + 1;
        }
        // Exibe todo o catálogo local, mantendo as mais ouvidas no início.
        const localSorted = [...musics]
            .sort((a, b) => (counts[String(b.id)] || 0) - (counts[String(a.id)] || 0));
        insertPopularSection(buildPopularSection(localSorted));

        // Atualiza com dados reais de todos os usuários quando autenticado.
        const requestId = ++popularRankingRequest;
        if (typeof window.loadGlobalMusicRanking !== 'function') return;
        // O RPC aceita até 50 itens; pedir o máximo disponível evita que o
        // carrossel seja artificialmente reduzido a dez faixas.
        const rankingLimit = Math.min(Math.max(musics.length, 10), 50);
        window.loadGlobalMusicRanking(rankingLimit, null).then(rows => {
            if (requestId !== popularRankingRequest || !Array.isArray(rows)) return;
            const ranked = rows.map(row => {
                const local = resolveTrack({ id: row.music_id });
                const cover = row.cover || local?.cover || '';
                const title = row.title || local?.title || '';
                if (!cover || !title) return null;
                return {
                    ...(local || {}),
                    id: row.music_id,
                    title,
                    artist: row.artist || local?.artist || '',
                    cover,
                    playCount: Number(row.play_count) || 0,
                };
            }).filter(Boolean);
            if (ranked.length < 3) return;
            TAB.querySelectorAll('.popular-section').forEach(el => el.remove());
            insertPopularSection(buildPopularSection(ranked, true));
        }).catch(() => {});
    }

    // ============================================================
    // 07 — PLAYLISTS EM DESTAQUE
    // ============================================================

    function getPlaylistCover(pl) {
        return pl?.cover || pl?.cover_url || pl?.image || pl?.image_url || pl?.thumbnail || '';
    }

    function getPlaylistTrackCount(pl) {
        const t = pl?.tracks ?? pl?.track_ids ?? pl?.musics ?? pl?.songs;
        if (Array.isArray(t)) return t.length;
        if (typeof pl?.track_count === 'number') return pl.track_count;
        return 0;
    }

    function openPlaylist(pl) {
        if (window.openPlaylistDetail) return window.openPlaylistDetail(pl);
        if (window.openPlaylist)       return window.openPlaylist(pl);
        if (window.setCurrentPlaylist) return window.setCurrentPlaylist(pl);
        const tracks = pl?.tracks ?? pl?.track_ids ?? [];
        if (Array.isArray(tracks) && tracks.length > 0) {
            play(typeof tracks[0] === 'object' ? tracks[0] : { id: tracks[0] });
        }
    }

    function renderPlaylists() {
        TAB.querySelectorAll('.playlists-section').forEach(el => el.remove());

        const playlists = window.AppState?.userPlaylists || [];
        if (!playlists.length) return;

        const sec = document.createElement('section');
        sec.className = 'home-section playlists-section';
        sec.innerHTML = `
            <div class="section-header">
                <h2><span class="material-symbols-rounded">queue_music</span>Suas playlists</h2>
            </div>
            <div class="playlists-track">
                ${playlists.map(pl => {
                    const coverUrl  = getPlaylistCover(pl);
                    const count     = getPlaylistTrackCount(pl);
                    const countText = count ? `${count} música${count !== 1 ? 's' : ''}` : 'Playlist';
                    return `
                        <button class="playlist-card" type="button">
                            <div class="playlist-cover-wrap">
                                ${coverUrl
                                    ? `<img src="${safe(coverUrl)}" alt="${esc(pl.name || '')}"
                                           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                                    : ''}
                                <div class="playlist-cover-placeholder" style="${coverUrl ? 'display:none' : ''}">
                                    <span class="material-symbols-rounded">queue_music</span>
                                </div>
                            </div>
                            <p class="playlist-name">${esc(pl.name || 'Playlist')}</p>
                            <p class="playlist-count">${countText}</p>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
        playlists.forEach((pl, i) => {
            sec.querySelectorAll('.playlist-card')[i]?.addEventListener('click', () => openPlaylist(pl));
        });

        const anchor = TAB.querySelector('.popular-section')
                    || TAB.querySelector('.discover-section');
        if (anchor) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
        else TAB.appendChild(sec);
    }

    // ============================================================
    // 08 — PRA TERMINAR O DIA
    // ============================================================

    function renderNight() {
        TAB.querySelectorAll('.night-section').forEach(el => el.remove());

        const h = new Date().getHours();
        if (h >= 5 && h < 19) return;

        const histItem = window.AppState?.history?.[0];
        if (!histItem) return;

        const track = resolveTrack(histItem);
        if (!track?.title) return;

        const sec = document.createElement('section');
        sec.className = 'home-section night-section';
        sec.innerHTML = `
            <div class="section-header">
                <h2><span class="material-symbols-rounded">nights_stay</span>Pra terminar o dia</h2>
            </div>
            <div class="night-card" role="button" tabindex="0">
                <img class="night-cover" src="${safe(track.cover)}" alt="${esc(track.title)}">
                <div class="night-info">
                    <span class="night-eyebrow">Boa noite, descanse</span>
                    <h3 class="night-title">${esc(track.title)}</h3>
                    <p class="night-artist">${esc(track.artist || '')}</p>
                </div>
                <button class="night-play" aria-label="Tocar">
                    <span class="material-symbols-rounded">play_arrow</span>
                </button>
            </div>
        `;
        sec.querySelector('.night-card').addEventListener('click', () => play(histItem));
        TAB.appendChild(sec);
    }

    // ============================================================
    // RECOMENDADAS PARA VOCÊ
    // Sistema de recomendação sem IA, 100% client-side.
    //
    // Algoritmo em 4 etapas:
    // 1. Calcula afinidade por artista (histórico + favoritos + playCounts)
    // 2. Calcula afinidade por gênero (se campo 'genre' existir na tabela)
    // 3. Exclui músicas ouvidas recentemente (últimas 15)
    // 4. Pontua candidatos e retorna os top-10 para exibição
    //
    // Pontuação de cada candidata:
    //  + artista afim × 10
    //  + gênero afim × 6   (se campo 'genre' existir)
    //  + favorita:   + 40
    //  + plays normalizados × 25
    //  + ruído ±8  (para variedade entre renders)
    // ============================================================

    function _getPlayCountsLocal() {
        // Lê o mesmo objeto que player-core.js mantém
        try { return JSON.parse(localStorage.getItem('play_counts') || '{}'); }
        catch { return {}; }
    }

    // Motor local de recomendação: usa o catálogo enriquecido pelo admin e
    // o histórico do usuário, sem depender de um segundo serviço externo.
    window.getRecommendations = function getRecommendations(limit = 10, options = {}) {
        const musics = getMusics();
        const history = window.AppState?.history || [];
        const playCounts = _getPlayCountsLocal();
        const recentIds = new Set(history.slice(0, 15).map(item => String(item.id ?? item.music_id)));
        const styleWeights = {};
        const rhythmWeights = {};
        let tempoTotal = 0;
        let tempoWeight = 0;
        let energyTotal = 0;
        let energyWeight = 0;

        history.forEach(entry => {
            const music = musics.find(item => String(item.id) === String(entry.id ?? entry.music_id));
            if (!music) return;
            const weight = Math.max(1, Number(entry.listenedSeconds || entry.listened_seconds || 1));
            const tags = [...(Array.isArray(music.style_tags) ? music.style_tags : []), music.style, music.genre]
                .map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
            tags.forEach(tag => { styleWeights[tag] = (styleWeights[tag] || 0) + weight; });
            const rhythm = String(music.rhythm_profile || '').trim().toLowerCase();
            if (rhythm) rhythmWeights[rhythm] = (rhythmWeights[rhythm] || 0) + weight;
            const bpm = Number(music.tempo_bpm);
            if (bpm > 0) { tempoTotal += bpm * weight; tempoWeight += weight; }
            const energy = Number(music.energy_score);
            if (Number.isFinite(energy)) { energyTotal += energy * weight; energyWeight += weight; }
        });

        const favoriteIds = new Set([...((window.AppState?.favorites) || [])].map(String));
        const averageTempo = tempoWeight ? tempoTotal / tempoWeight : null;
        const averageEnergy = energyWeight ? energyTotal / energyWeight : null;
        const maxStyleWeight = Math.max(1, ...Object.values(styleWeights));
        const maxRhythmWeight = Math.max(1, ...Object.values(rhythmWeights));
        const discovery = Number(options.discovery ?? 0.35);

        return musics.filter(music => !recentIds.has(String(music.id)))
            .map((music, index) => {
                const tags = [...(Array.isArray(music.style_tags) ? music.style_tags : []), music.style, music.genre]
                    .map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
                const styleScore = tags.reduce((best, tag) => Math.max(best, (styleWeights[tag] || 0) / maxStyleWeight), 0);
                const rhythm = String(music.rhythm_profile || '').trim().toLowerCase();
                const rhythmScore = rhythm ? (rhythmWeights[rhythm] || 0) / maxRhythmWeight : 0;
                const bpm = Number(music.tempo_bpm);
                const tempoScore = averageTempo && bpm ? Math.max(0, 1 - Math.abs(bpm - averageTempo) / 80) : 0;
                const energy = Number(music.energy_score);
                const energyScore = averageEnergy != null && Number.isFinite(energy) ? Math.max(0, 1 - Math.abs(energy - averageEnergy)) : 0;
                const artistScore = history.some(item => String(item.artist || '').toLowerCase() === String(music.artist || '').toLowerCase()) ? 1 : 0;
                const popularity = Math.min(Number(playCounts[music.id] || music.plays || 0) / 100, 1);
                const favoriteBonus = favoriteIds.has(String(music.id)) ? 0.08 : 0;
                const score = styleScore * 0.36 + tempoScore * 0.22 + energyScore * 0.14 + rhythmScore * 0.12 + artistScore * 0.08 + popularity * 0.08 + favoriteBonus;
                return { ...music, score: score * (1 - discovery * 0.04) + (index % 17) * 0.00001 };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.max(1, limit));
    };

    function renderRecommended() {
        // Remove render anterior
        TAB.querySelectorAll('.recommended-section').forEach(el => el.remove());

        const musics   = getMusics();
        const history  = window.AppState?.history  || [];

        // Sem dados suficientes: não exibe (usuário ainda não ouviu nada)
        if (musics.length < 5 || history.length < 3) return;

        // Fonte única de recomendação: getRecommendations (player-recommendations.js).
        // A lógica local antiga dava +40 para favoritas e +25 para muitos plays —
        // ou seja, "recomendava" o que o usuário JÁ ouve. discovery alto inverte:
        // prioriza faixas pouco/nunca ouvidas de artistas com afinidade.
        const recommendations = (typeof window.getRecommendations === 'function')
            ? window.getRecommendations(musics.length, { discovery: 0.7 })
            : [];

        // Não exibe se não há recomendações suficientes
        if (recommendations.length < 3) return;

        // ── Renderiza a seção ─────────────────────────────────────
        const sec = document.createElement('section');
        sec.className = 'home-section recommended-section';
        sec.innerHTML = `
            <div class="section-header">
                <h2><span class="material-symbols-rounded">recommend</span>Recomendadas para você</h2>
            </div>
            <div class="recommended-track">
                ${recommendations.map(t => `
                    <button class="recommended-card" type="button">
                        <div class="recommended-cover-wrap">
                            <img src="${safe(t.cover)}" alt="${esc(t.title)}" loading="lazy">
                        </div>
                        <p class="recommended-title">${esc(t.title)}</p>
                        <p class="recommended-artist">${esc(t.artist || '')}</p>
                    </button>
                `).join('')}
            </div>
        `;

        // Eventos de clique
        recommendations.forEach((t, i) => {
            sec.querySelectorAll('.recommended-card')[i]
               ?.addEventListener('click', () => play(t));
        });

        // Posiciona após playlists (ou após populares como fallback)
        const anchor = TAB.querySelector('.playlists-section')
                    || TAB.querySelector('.popular-section')
                    || TAB.querySelector('.discover-section');
        if (anchor) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
        else TAB.appendChild(sec);
        window.syncHomeTrackAlignment?.(sec.querySelector('.recommended-track'));
    }

    // ============================================================
    // INIT
    // ============================================================

    function renderDynamic() {
        try {
            renderContinue();
            renderQuickPicks();
            renderWeeklyTop();
            renderDiscover();
            renderPopular();
            renderPlaylists();
            renderRecommended();   // ← nova seção
            renderNight();
            reorderHomeSections();
        } catch (e) {
            console.warn('[inicio-extras] renderDynamic:', e);
        }
    }

    function init() {
        renderHeader();
        renderDynamic();
        // Apenas o cabeçalho pode precisar de uma segunda tentativa enquanto
        // a autenticação termina; as seções só mudam via atualização de dados.
        setTimeout(() => { renderHeader(); }, 2500);
        // Inicializa sistema de notificações (delay pequeno para aguardar DOM)
        setTimeout(() => {
            window.FendaNotifications?.init();
            window.FendaNotifications?.updateDot();
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('tab-switch', e => {
        if (e.detail?.tab === 'inicio') {
            // A troca de aba é apenas navegação. A atualização dos dados
            // acontece pelos eventos de catálogo/realtime em background.
            reorderHomeSections();
        }
    });

    window.__inicioExtras = {
        init,
        reorder: reorderHomeSections,
        refresh: renderDynamic,
        refreshDiscover: renderDiscover,
        refreshPopular: renderPopular,
        refreshRecommended: renderRecommended,
        diagnose() {
            const m = getMusics();
            console.log('[inicio-extras] musics:', m.length);
            console.log('[inicio-extras] musics[0] keys:', Object.keys(m[0] || {}));
            console.log('[inicio-extras] history:', (window.AppState?.history||[]).length);
            console.log('[inicio-extras] playlists:', (window.AppState?.userPlaylists||[]).length);
            console.log('[inicio-extras] userId:', getUserId());
            console.log('[inicio-extras] hasGenre:', m.some(x => x.genre));
            console.log('[inicio-extras] playCounts entries:', Object.keys(_getPlayCountsLocal()).length);
        }
    };

})();
