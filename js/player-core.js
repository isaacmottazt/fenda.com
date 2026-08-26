// ===== ESTADO GLOBAL COM FILA =====
const AppState = {
    musics: [],
    podcasts: [],
    currentMusicId: null,
    playing: false,
    currentTab: 'inicio',
    lyricsData: [],
    artists: [],           // lista de artistas vinda do Supabase
    favorites: new Set(),
    userPlaylists: [],
    isShuffle: false,
    repeatMode: 0,       // 0 = off, 1 = repeat-all, 2 = repeat-one
    _originalTrackList: [], // ordem original antes do shuffle
    currentPlaylistFilter: null,
    selectedTrackForMenu: null,
    selectedPlaylistForMenu: null,
    playlistModalMode: 'create',
    isUserScrolling: false,
    userScrollTimeout: null,
    history: [],        // array de { id, title, artist, cover, listenedSeconds, playedAt }
    MAX_HISTORY: 50,
    queue: [],           // fila manual (adicionada pelo usuário)
    autoQueue: [],       // fila automática (gerada pelo contexto)
    playContext: {       // de onde a música foi tocada
        source: 'library',
        playlistId: null,
        trackList: [],
        seedMusicId: null, // primeira música escolhida pelo usuário
    },
    userId: null,
    userProfile: { full_name: '', avatar_url: null, bio: '' }
};

function notifyHomeDataChanged(reason = 'data') {
    window._homeDataVersion = (window._homeDataVersion || 0) + 1;
    window.dispatchEvent(new CustomEvent('fenda:homeDataChanged', {
        detail: { reason, version: window._homeDataVersion }
    }));
}
window.notifyHomeDataChanged = notifyHomeDataChanged;

const DOM = {
    audio: document.getElementById('audio'),
    searchInput: document.getElementById('searchInput'),
    musicList: document.getElementById('musicList'),
    playlistsContainer: document.getElementById('playlistsContainer'),
    playlistsRootView: document.getElementById('playlistsRootView'),
    playlistDetailView: document.getElementById('playlistDetailView'),
    backToPlaylistsBtn: document.getElementById('backToPlaylistsBtn'),
    playerBottomBar: document.getElementById('playerBottomBar'),
    playerBottomCover: document.getElementById('playerBottomCover'),
    playerBottomTitle: document.getElementById('playerBottomTitle'),
    playerBottomArtist: document.getElementById('playerBottomArtist'),
    playerBottomPlayBtn: document.getElementById('playerBottomPlayBtn'),
    miniProgressBar: document.getElementById('miniProgressBar'),
    lyricsFullScreen: document.getElementById('lyricsFullScreen'),
    lyricsTrackTitle: document.getElementById('lyricsTrackTitle'),
    lyricsTrackArtist: document.getElementById('lyricsTrackArtist'),
    lyricsContainer: document.getElementById('lyricsContainer'),
    bigPlayBtn: document.getElementById('bigPlayBtn'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    repeatBtn: document.getElementById('repeatBtn'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    currentTimeTxt: document.getElementById('currentTime'),
    totalTimeTxt: document.getElementById('totalTime'),
    playlistModal: document.getElementById('playlistModal'),
    newPlaylistName: document.getElementById('newPlaylistName'),
    confirmModalBtn: document.getElementById('confirmModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    homeTitle: document.getElementById('homeTitle')
};

// ===== HISTÓRICO LOCAL + SUPABASE =====

// Chave do localStorage por usuário
function _historyKey() { return `fenda_history_${AppState.userId}`; }
function _totalTimeKey() { return `fenda_totaltime_${AppState.userId}`; }
function _userNameKey() { return `fenda_username_${AppState.userId}`; }

// Carrega histórico local
function loadLocalHistory() {
    try {
        const raw = localStorage.getItem(_historyKey());
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

// Salva histórico local
function saveLocalHistory(history) {
    try {
        localStorage.setItem(_historyKey(), JSON.stringify(history.slice(0, 50)));
    } catch(e) { console.warn('[Cache] Erro ao salvar histórico:', e); }
}

function _pendingListenKey() {
    return `${_historyKey()}_pending_sessions`;
}

function queuePendingListenSession(entry) {
    try {
        const raw = localStorage.getItem(_pendingListenKey());
        const pending = raw ? JSON.parse(raw) : [];
        const index = pending.findIndex(item => item.sessionId === entry.sessionId);
        if (index >= 0) pending[index] = { ...pending[index], ...entry };
        else pending.push(entry);
        localStorage.setItem(_pendingListenKey(), JSON.stringify(pending.slice(-100)));
    } catch (e) { console.warn('[Cache] Não foi possível enfileirar escuta offline:', e); }
}

async function syncPendingListenSessions() {
    if (!navigator.onLine || !AppState.userId || typeof window.addToListeningHistory !== 'function') return;
    try {
        const raw = localStorage.getItem(_pendingListenKey());
        const pending = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(pending) || !pending.length) return;
        const remaining = [];
        for (const entry of pending) {
            const ok = await window.addToListeningHistory(
                AppState.userId, entry.id, entry.listenedSeconds,
                Boolean(entry.completed), entry.sessionId
            );
            if (!ok) remaining.push(entry);
        }
        localStorage.setItem(_pendingListenKey(), JSON.stringify(remaining));
    } catch (e) { console.warn('[Cache] Sincronização de escutas pendentes falhou:', e); }
}

window.addEventListener('online', () => { void syncPendingListenSessions(); });

// Salva tempo total ouvido (em segundos)
function addToTotalTime(seconds) {
    try {
        const key = _totalTimeKey();
        const current = parseInt(localStorage.getItem(key) || '0');
        localStorage.setItem(key, String(current + seconds));
    } catch {}
}

// Retorna tempo total ouvido formatado
function getTotalListenedTime() {
    try {
        const secs = parseInt(localStorage.getItem(_totalTimeKey()) || '0');
        const hours = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}min`;
        return `${mins}min`;
    } catch { return '0min'; }
}

// Salva nome do usuário localmente
function saveLocalUserName(name, email) {
    try {
        if (AppState.userId) {
            localStorage.setItem(_userNameKey(), JSON.stringify({ name, email, savedAt: Date.now() }));
        }
    } catch {}
}

// Carrega nome do usuário local
function loadLocalUserName() {
    try {
        const raw = localStorage.getItem(_userNameKey());
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function addToHistory(music, listenedSeconds = 0, options = {}) {
    if (!music) return;

    const cumulativeSeconds = Math.max(0, Math.floor(Number(listenedSeconds) || 0));
    const deltaSeconds = Math.max(0, Math.floor(Number(options.deltaSeconds ?? listenedSeconds) || 0));
    const sessionId = options.sessionId || null;
    const playedAt = Number(options.playedAt) || Date.now();
    const completed = Boolean(options.completed);
    if (cumulativeSeconds < 1) return;

    // Uma entrada representa uma sessão de reprodução. Flushes sucessivos
    // atualizam a mesma sessão em vez de criar plays duplicados.
    const history = loadLocalHistory();
    const existingIndex = sessionId
        ? history.findIndex(h => h.sessionId === sessionId)
        : -1;
    const entry = {
        id: music.id,
        title: music.title,
        artist: music.artist,
        cover: music.cover,
        listenedSeconds: Math.max(cumulativeSeconds, existingIndex >= 0 ? Number(history[existingIndex].listenedSeconds) || 0 : 0),
        playedAt,
        sessionId,
        completed,
    };
    if (existingIndex >= 0) history.splice(existingIndex, 1);
    history.unshift(entry);
    saveLocalHistory(history);

    // O total local recebe somente o delta novo, nunca o acumulado da sessão.
    if (deltaSeconds > 0) addToTotalTime(deltaSeconds);

    AppState.history = history;
    notifyHomeDataChanged('listening-history');

    const syncEntry = {
        id: music.id,
        listenedSeconds: entry.listenedSeconds,
        completed,
        sessionId,
    };
    if (AppState.userId && window.addToListeningHistory) {
        if (navigator.onLine) {
            window.addToListeningHistory(
                AppState.userId,
                syncEntry.id,
                syncEntry.listenedSeconds,
                syncEntry.completed,
                syncEntry.sessionId
            ).then(ok => { if (!ok) queuePendingListenSession(syncEntry); })
             .catch(() => queuePendingListenSession(syncEntry));
        } else {
            queuePendingListenSession(syncEntry);
        }
    }
}

window.getTotalListenedTime = getTotalListenedTime;
window.loadLocalHistory = loadLocalHistory;
window.saveLocalUserName = saveLocalUserName;
window.loadLocalUserName = loadLocalUserName;

let playCounts = JSON.parse(localStorage.getItem('play_counts') || '{}');
function incrementPlayCount(musicId) {
    playCounts[musicId] = (playCounts[musicId] || 0) + 1;
    localStorage.setItem('play_counts', JSON.stringify(playCounts));
}


// ===================================================
// ===== SISTEMA DE CACHE LOCAL (localStorage) =======
// ===================================================
// Simples e confiável — sem IndexedDB complexo

function _cacheKey(name) {
    return `fenda_cache_${name}`;
}

const CacheDB = {
    save(name, data) {
        try {
            const str = JSON.stringify(data);
            localStorage.setItem(_cacheKey(name), str);
            return true;
        } catch(e) {
            console.warn('[Cache] Erro ao salvar ' + name + ' (' + (e.name || '') + '):', e.message || e);
            return false;
        }
    },

    load(name) {
        try {
            const raw = localStorage.getItem(_cacheKey(name));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    },

    async saveAll({ playlists, favorites, history, profile, searchHistory, userId }) {
        // Músicas NÃO são salvas — só as baixadas ficam no IndexedDB de áudio
        const results = {
            playlists: this.save('playlists_' + userId, playlists || []),
            favorites: this.save('favorites_' + userId, favorites || []),
            history:   this.save('history_'   + userId, (history || []).slice(0, 30)),
            profile:   this.save('profile_'   + userId, profile || {}),
            userId:    this.save('meta_userId', userId),
        };
        const allOk = Object.values(results).every(Boolean);
        console.log('[Cache] ' + (allOk ? 'Dados do usuário salvos' : 'Alguns itens falharam'));
        return allOk;
    },

    async loadAll(userId) {
        try {
            return {
                musics:        [],   // músicas sempre vêm do Supabase ou do áudio offline
                artists:       [],
                playlists:     this.load('playlists_' + userId)  || [],
                favorites:     this.load('favorites_' + userId)  || [],
                history:       this.load('history_'   + userId)  || [],
                profile:       this.load('profile_'   + userId)  || {},
                searchHistory: this.load('search_'    + userId)  || [],
            };
        } catch(e) {
            console.warn('[Cache] loadAll erro:', e);
            return null;
        }
    },

    hasCached(userId) {
        return !!this.load('meta_userId') && this.load('meta_userId') === userId;
    },

    async clear() {
        Object.keys(localStorage)
            .filter(k => k.startsWith('fenda_cache_'))
            .forEach(k => localStorage.removeItem(k));
    }
};

window.CacheDB = CacheDB;

// ===== CACHE OFFLINE DE ÁUDIO =====
const DB_NAME = 'FendaMusicAudio_v4'; // nome novo = banco novo, sem conflito com versões antigas
const DB_VERSION = 1;
let db = null;

function openCacheDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            // Out-of-line keys: put(value, key) — chave passada separada do objeto
            if (!database.objectStoreNames.contains('audio'))
                database.createObjectStore('audio');
            if (!database.objectStoreNames.contains('metadata'))
                database.createObjectStore('metadata');
        };
    });
}

// Verifica se uma música está salva offline
async function isMusicCached(musicId) {
    try {
        const database = await openCacheDB();
        return new Promise((resolve) => {
            const tx = database.transaction('metadata', 'readonly');
            const req = tx.objectStore('metadata').get(musicId);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    } catch { return false; }
}

// Baixa e salva a música no IndexedDB com progresso
// silent=true suprime toasts internos — usado no download em lote de playlists
async function cacheAudio(music, silent = false) {
    const url = music.src;
    const musicId = music.id;
    try {
        if (!silent) showToast('Baixando música...', 'success');

        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao baixar áudio');

        // Lê com progresso se possível
        const contentLength = response.headers.get('Content-Length');
        let blob;
        if (contentLength && response.body) {
            const total = parseInt(contentLength);
            const reader = response.body.getReader();
            const chunks = [];
            let received = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (!silent) {
                    const pct = Math.round((received / total) * 100);
                    showToast(`Baixando... ${pct}%`, 'success');
                }
            }
            blob = new Blob(chunks);
        } else {
            blob = await response.blob();
        }

        const database = await openCacheDB();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(['audio', 'metadata'], 'readwrite');
            // put(value, key) — chave fora do objeto, funciona com int e UUID
            tx.objectStore('audio').put({ blob }, musicId);
            tx.objectStore('metadata').put({
                musicId,
                title: music.title,
                artist: music.artist,
                cover: music.cover,
                url,
                size: blob.size,
                cachedAt: Date.now()
            }, musicId);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });

        if (!silent) showToast(`"${music.title}" salva para ouvir offline!`, 'success');
        // Atualiza ícone do botão de download na UI
        _updateDownloadBtn(musicId, true);
        return true;
    } catch (err) {
        if (!silent) showToast('Erro ao salvar: ' + err.message, 'danger');
        return false;
    }
}

// Remove música do cache offline
async function removeCachedAudio(musicId) {
    try {
        const database = await openCacheDB();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(['audio', 'metadata'], 'readwrite');
            tx.objectStore('audio').delete(musicId);
            tx.objectStore('metadata').delete(musicId);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
        showToast('Música removida do armazenamento offline', 'success');
        _updateDownloadBtn(musicId, false);
        return true;
    } catch (err) {
        showToast('Erro ao remover: ' + err.message, 'danger');
        return false;
    }
}

// Retorna todas as músicas salvas offline (para tela de gerenciamento)
async function getAllCachedMusics() {
    try {
        const database = await openCacheDB();
        return new Promise((resolve) => {
            const tx = database.transaction('metadata', 'readonly');
            const req = tx.objectStore('metadata').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch { return []; }
}

// Retorna o blob URL da música cacheada (para reprodução)
async function getCachedAudioUrl(music) {
    try {
        const database = await openCacheDB();
        const record = await new Promise((resolve) => {
            const tx = database.transaction('audio', 'readonly');
            const req = tx.objectStore('audio').get(music.id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        if (record && record.blob) return URL.createObjectURL(record.blob);
        // Compatibilidade: algumas versões salavam o blob direto
        if (record instanceof Blob) return URL.createObjectURL(record);
        return null;
    } catch { return null; }
}

// Atualiza visualmente o botão de download na tela
function _updateDownloadBtn(musicId, isCached) {
    const btn = document.querySelector(`[data-download-id="${musicId}"]`);
    if (!btn) return;
    btn.innerHTML = isCached
        ? '<span class="material-symbols-rounded">download_done</span>'
        : '<span class="material-symbols-rounded">download</span>';
    btn.title = isCached ? 'Remover download' : 'Baixar para ouvir offline';
    btn.dataset.cached = isCached ? '1' : '0';
}

// Toggle: baixa se não tem, remove se já tem
async function toggleOfflineMusic(music) {
    const cached = await isMusicCached(music.id);
    if (cached) {
        await removeCachedAudio(music.id);
    } else {
        await cacheAudio(music);
    }
}


// ===== FILA AUTOMÁTICA =====

// Histórico da sessão: além de alimentar o botão "Anterior", ele ajuda o
// shuffle a não devolver imediatamente as mesmas faixas.
const _playbackHistory = [];
const _HISTORY_MAX = 50;

function _trackId(trackOrId) {
    return String(trackOrId?.id ?? trackOrId);
}

function _artistKey(track) {
    const artist = String(track?.artist || '').trim().toLowerCase();
    return artist || `track:${_trackId(track)}`;
}

function _uniqueTracks(tracks) {
    const seen = new Set();
    return (Array.isArray(tracks) ? tracks : []).filter(track => {
        if (!track) return false;
        const id = _trackId(track);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

function _randomUnit() {
    try {
        if (window.crypto?.getRandomValues) {
            const values = new Uint32Array(1);
            window.crypto.getRandomValues(values);
            return values[0] / 0x100000000;
        }
    } catch {}
    return Math.random();
}

function _recentTrackIds(limit = 8) {
    const ids = [];
    const add = (id) => {
        if (id === null || id === undefined) return;
        const normalized = _trackId(id);
        if (!ids.includes(normalized)) ids.push(normalized);
    };

    for (let i = _playbackHistory.length - 1; i >= 0 && ids.length < limit; i--) {
        add(_playbackHistory[i]);
    }
    for (const item of (AppState.history || []).slice(0, limit * 2)) {
        if (ids.length >= limit) break;
        add(item?.id);
    }
    return new Set(ids);
}

function _recentArtistKeys(trackList, limit = 5) {
    const byId = new Map();
    [...(AppState.musics || []), ...(trackList || [])].forEach(track => {
        if (track) byId.set(_trackId(track), track);
    });

    const artists = [];
    const add = (track) => {
        if (!track) return;
        const key = _artistKey(track);
        if (!artists.includes(key)) artists.push(key);
    };

    for (let i = _playbackHistory.length - 1; i >= 0 && artists.length < limit; i--) {
        add(byId.get(_trackId(_playbackHistory[i])));
    }
    for (const item of (AppState.history || []).slice(0, limit * 2)) {
        if (artists.length >= limit) break;
        add(byId.get(_trackId(item?.id)) || item);
    }
    return new Set(artists);
}

function _pickWeightedTrack(scoredTracks) {
    const total = scoredTracks.reduce((sum, entry) => sum + entry.weight, 0);
    if (!Number.isFinite(total) || total <= 0) return scoredTracks[0]?.track || null;

    let cursor = _randomUnit() * total;
    for (const entry of scoredTracks) {
        cursor -= entry.weight;
        if (cursor <= 0) return entry.track;
    }
    return scoredTracks[scoredTracks.length - 1]?.track || null;
}

// Shuffle inteligente: continua aleatório, mas evita os padrões que parecem
// artificiais no shuffle puro — mesma faixa recém-ouvida, artista repetido e
// músicas muito reproduzidas recebem menos probabilidade.
function _shuffleSpread(tracks) {
    const remaining = _uniqueTracks(tracks);
    if (remaining.length <= 1) return remaining;

    const recentIds = _recentTrackIds();
    const recentArtists = _recentArtistKeys(remaining);
    const currentTrack = (AppState.musics || []).find(
        music => _trackId(music) === _trackId(AppState.currentMusicId)
    );

    const result = [];
    let lastArtist = currentTrack ? _artistKey(currentTrack) : null;
    let lastTrackId = _trackId(AppState.currentMusicId);

    while (remaining.length > 0) {
        // Se houver outro artista disponível, ele sempre vence a repetição
        // imediata. A repetição só é permitida quando não há alternativa.
        const differentArtist = remaining.filter(track => {
            return _artistKey(track) !== lastArtist && _trackId(track) !== lastTrackId;
        });
        const candidates = differentArtist.length > 0
            ? differentArtist
            : remaining.filter(track => _trackId(track) !== lastTrackId);
        const pool = candidates.length > 0 ? candidates : remaining;

        const scored = pool.map(track => {
            const id = _trackId(track);
            const artist = _artistKey(track);
            const playCount = Number(playCounts[id] || 0);
            let weight = 1;

            // A memória recente é uma preferência, não uma exclusão: se o
            // catálogo for pequeno, nenhuma faixa fica bloqueada para sempre.
            if (recentIds.has(id)) weight *= 0.32;
            if (recentArtists.has(artist)) weight *= 0.68;
            if (artist === lastArtist) weight *= 0.08;
            if (playCount > 0) weight *= 1 / (1 + Math.min(playCount, 8) * 0.06);

            return { track, weight: Math.max(weight, 0.01) };
        });

        const selected = _pickWeightedTrack(scored) || pool[0];
        const index = remaining.indexOf(selected);
        if (index >= 0) remaining.splice(index, 1);
        result.push(selected);
        lastArtist = _artistKey(selected);
        lastTrackId = _trackId(selected);
    }

    return result;
}

function _normalizeMusicText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9&]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const MUSIC_CATEGORY_RULES = [
    ['gospel', ['gospel', 'christian', 'cristao', 'crista', 'adoracao', 'adoracao', 'worship', 'louvor', 'hino', 'hymn', 'evangelico', 'evangelica', 'religioso']],
    ['sertanejo', ['sertanejo', 'sertaneja', 'country brasileiro']],
    ['mpb', ['mpb', 'musica popular brasileira']],
    ['samba', ['samba', 'pagode']],
    ['forro', ['forro', 'xote', 'baião', 'baiao']],
    ['funk', ['funk brasileiro', 'funk carioca', 'funk']],
    ['rap', ['rap', 'hip hop', 'hiphop', 'trap']],
    ['pop', ['pop']],
    ['rock', ['rock', 'punk', 'metal', 'indie']],
    ['eletronica', ['eletronica', 'electronic', 'house', 'techno', 'trance', 'dance']],
    ['rnb', ['r&b', 'r b', 'rnb', 'soul', 'rhythm and blues']],
    ['jazz', ['jazz', 'blues']],
    ['reggae', ['reggae', 'ska']],
    ['classica', ['classica', 'classical', 'orquestra', 'instrumental']],
];

function _musicCategory(music) {
    if (!music) return null;
    const genre = _normalizeMusicText(music.genre);
    const styleText = _normalizeMusicText([
        music.style,
        ...(Array.isArray(music.style_tags) ? music.style_tags : []),
    ].filter(Boolean).join(' '));
    const text = genre && !['unknown', 'outro', 'outros', 'nao informado'].includes(genre)
        ? genre
        : styleText;
    if (!text) return null;

    for (const [category, terms] of MUSIC_CATEGORY_RULES) {
        if (terms.some(term => {
            const normalizedTerm = _normalizeMusicText(term);
            return text === normalizedTerm
                || text.includes(` ${normalizedTerm} `)
                || text.startsWith(`${normalizedTerm} `)
                || text.endsWith(` ${normalizedTerm}`);
        })) {
            return category;
        }
    }

    return genre && text === genre ? `genre:${genre}` : null;
}

const CATEGORY_FALLBACKS = {
    gospel: ['rnb', 'pop', 'classica'],
    sertanejo: ['forro', 'samba', 'pop'],
    mpb: ['samba', 'rnb', 'pop', 'jazz'],
    samba: ['mpb', 'forro', 'rnb', 'pop'],
    forro: ['sertanejo', 'samba', 'mpb'],
    funk: ['rap', 'rnb', 'pop'],
    rap: ['funk', 'rnb', 'pop', 'rock'],
    pop: ['rnb', 'rock', 'eletronica', 'mpb'],
    rock: ['pop', 'rnb', 'eletronica'],
    eletronica: ['pop', 'rnb', 'rock'],
    rnb: ['gospel', 'pop', 'jazz', 'mpb'],
    jazz: ['rnb', 'mpb', 'classica'],
    reggae: ['rnb', 'pop', 'samba'],
    classica: ['jazz', 'rnb', 'mpb'],
};

function _categoryOrderForProfile(profile) {
    const base = Array.isArray(profile?.categoryOrder) && profile.categoryOrder.length
        ? profile.categoryOrder
        : [_musicCategory(profile)].filter(Boolean);
    const order = [];
    const add = category => {
        if (category && !order.includes(category)) order.push(category);
    };
    base.forEach(add);
    base.forEach(category => (CATEGORY_FALLBACKS[category] || []).forEach(add));
    return order;
}

function _buildCollectionProfile(trackList) {
    const tracks = _uniqueTracks(trackList || []);
    if (!tracks.length) return null;

    const countValues = (values) => {
        const counts = new Map();
        values.forEach(value => {
            const normalized = _normalizeMusicText(value);
            if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
        });
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
    };

    const genres = countValues(tracks.map(track => track.genre));
    const styles = countValues(tracks.flatMap(track => [
        track.style,
        ...(Array.isArray(track.style_tags) ? track.style_tags : []),
    ]));
    const rhythms = countValues(tracks.map(track => track.rhythm_profile));
    const categoryCounts = new Map();
    tracks.map(_musicCategory).filter(Boolean).forEach(category => {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
    const categoryOrder = [...categoryCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category]) => category);
    const average = (field) => {
        const values = tracks.map(track => Number(track[field])).filter(Number.isFinite);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };

    return {
        genre: genres[0] || '',
        style: styles[0] || '',
        style_tags: styles.slice(0, 8),
        rhythm_profile: rhythms[0] || '',
        tempo_bpm: average('tempo_bpm'),
        energy_score: average('energy_score'),
        danceability_score: average('danceability_score'),
        allowedCategories: categoryOrder,
        categoryOrder,
    };
}

function _musicTextSet(music) {
    return new Set([
        music?.genre,
        music?.style,
        ...(Array.isArray(music?.style_tags) ? music.style_tags : []),
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
}

function _musicRhythmSet(music) {
    return new Set(String(music?.rhythm_profile || '')
        .split(/[,|/;]+/)
        .map(value => value.trim().toLowerCase())
        .filter(Boolean));
}

function _affinityScore(candidate, seed) {
    if (!candidate || !seed) return 0;
    const seedTags = _musicTextSet(seed);
    const candidateTags = _musicTextSet(candidate);
    const tagMatches = [...candidateTags].filter(tag => seedTags.has(tag)).length;
    const tagScore = seedTags.size && candidateTags.size
        ? Math.min(1, tagMatches / Math.max(1, Math.min(seedTags.size, candidateTags.size)))
        : 0;

    const seedGenre = String(seed.genre || '').trim().toLowerCase();
    const candidateGenre = String(candidate.genre || '').trim().toLowerCase();
    const genreScore = seedGenre && candidateGenre
        ? (seedGenre === candidateGenre || seedTags.has(candidateGenre) ? 1 : 0)
        : 0;

    const seedRhythm = _musicRhythmSet(seed);
    const candidateRhythm = _musicRhythmSet(candidate);
    const rhythmScore = seedRhythm.size && candidateRhythm.size
        ? ([...candidateRhythm].some(value => seedRhythm.has(value)) ? 1 : 0)
        : 0;

    const seedBpm = Number(seed.tempo_bpm);
    const candidateBpm = Number(candidate.tempo_bpm);
    const bpmScore = seedBpm > 0 && candidateBpm > 0
        ? Math.max(0, 1 - Math.abs(seedBpm - candidateBpm) / 70)
        : 0;

    const seedEnergy = Number(seed.energy_score);
    const candidateEnergy = Number(candidate.energy_score);
    const energyScore = Number.isFinite(seedEnergy) && Number.isFinite(candidateEnergy)
        ? Math.max(0, 1 - Math.abs(seedEnergy - candidateEnergy))
        : 0;

    const seedDance = Number(seed.danceability_score);
    const candidateDance = Number(candidate.danceability_score);
    const danceScore = seedDance > 0 && candidateDance > 0
        ? Math.max(0, 1 - Math.abs(seedDance - candidateDance))
        : 0;

    // Gênero e estilo têm maior peso; ritmo e BPM refinam a sequência.
    return genreScore * 0.34
        + tagScore * 0.30
        + rhythmScore * 0.14
        + bpmScore * 0.12
        + energyScore * 0.06
        + danceScore * 0.04;
}

function buildAffinityQueue(currentMusicId, trackList, isShuffle, seedMusicId = currentMusicId, seedProfile = null, categoryOverride = null) {
    const cleanList = _uniqueTracks(trackList?.length ? trackList : AppState.musics);
    const currentId = _trackId(currentMusicId);
    const seedId = _trackId(seedMusicId || currentMusicId);
    const seed = seedProfile || _uniqueTracks([...(AppState.musics || []), ...cleanList])
        .find(track => _trackId(track) === seedId);
    const allPool = cleanList.filter(track => _trackId(track) !== currentId);
    if (!allPool.length) return [];

    // Categoria da música-semente é uma barreira: uma faixa Gospel/Adoração
    // não pode puxar Pop, Rock ou MPB, e o inverso também é verdadeiro.
    // Quando a semente tem categoria conhecida, somente a mesma categoria
    // entra; faixas sem gênero ficam fora até serem catalogadas.
    const categoryOrder = categoryOverride
        ? [categoryOverride]
        : _categoryOrderForProfile(seed);
    const allowedCategories = categoryOrder.length
        ? [categoryOrder[0]]
        : (Array.isArray(seed?.allowedCategories) ? seed.allowedCategories.slice(0, 1).filter(Boolean) : []);
    const pool = allowedCategories.length
        ? allPool.filter(track => allowedCategories.includes(_musicCategory(track)))
        : allPool;
    if (!pool.length) return [];

    const scored = pool.map((track, index) => ({
        track,
        score: _affinityScore(track, seed),
        index,
    }));

    if (!isShuffle) {
        return scored
            .sort((a, b) => (b.score - a.score) || (a.index - b.index))
            .map(entry => entry.track);
    }

    const remaining = [...scored];
    const result = [];
    while (remaining.length) {
        const weighted = remaining.map(entry => ({
            track: entry.track,
            weight: Math.max(0.08, 0.12 + entry.score * 1.4),
        }));
        const selected = _pickWeightedTrack(weighted) || remaining[0].track;
        const index = remaining.findIndex(entry => _trackId(entry.track) === _trackId(selected));
        result.push(selected);
        if (index >= 0) remaining.splice(index, 1);
        else remaining.shift();
    }
    return result;
}

function _queueListForContext() {
    const ctx = AppState.playContext || {};
    const contextList = _uniqueTracks(ctx.trackList || []);
    // Playlists são contextos fechados; busca, histórico e biblioteca seguem
    // pela afinidade global para nunca terminarem em uma única faixa.
    if (ctx.source === 'playlist' || ctx.playlistId) return contextList;
    return _uniqueTracks(AppState.musics || []);
}

// Gera a fila automática baseada no contexto atual
function buildAutoQueue(currentMusicId, trackList, isShuffle, wrap = false) {
    const cleanList = _uniqueTracks(trackList);
    if (cleanList.length === 0) return [];

    // Comparação tolerante a tipo (IDs vindos da URL/estado salvo podem ser
    // strings, enquanto os IDs do Supabase normalmente são números).
    const currentId = _trackId(currentMusicId);
    const currentIdx = cleanList.findIndex(m => _trackId(m) === currentId);

    if (isShuffle) {
        const remaining = cleanList.filter(m => _trackId(m) !== currentId);
        // Repeat-all com apenas uma faixa precisa recriar a própria faixa.
        if (wrap && remaining.length === 0 && currentIdx !== -1) return [cleanList[currentIdx]];
        return _shuffleSpread(remaining);
    }

    // Música atual não está nesse contexto: a fila vira o contexto inteiro,
    // menos ela, se por acaso estiver presente.
    if (currentIdx === -1) {
        return cleanList.filter(m => _trackId(m) !== currentId);
    }

    // Com repeat OFF, a fila é somente o que vem depois da faixa atual.
    // O wrap só é usado pelo repeat-all.
    const after = cleanList.slice(currentIdx + 1);
    if (!wrap) return after;
    const before = cleanList.slice(0, currentIdx);
    if (wrap && after.length === 0 && before.length === 0) return [cleanList[currentIdx]];
    return [...after, ...before];
}

// Garante que a fila nunca acabe enquanto houver músicas válidas no catálogo.
// Primeiro respeita o contexto atual (busca, playlist, histórico etc.); depois
// acrescenta as demais faixas do catálogo para o autoplay continuar sem tela vazia.
function ensureAutoQueue() {
    const allMusics = _uniqueTracks(AppState.musics || []);
    if (!allMusics.length || !AppState.currentMusicId) return;

    const currentId = _trackId(AppState.currentMusicId);
    const queuedIds = new Set([
        ...((AppState.queue || []).map(_trackId)),
        ...((AppState.autoQueue || []).map(_trackId)),
        currentId,
    ]);
    const contextList = _uniqueTracks(AppState.playContext?.trackList || []);
    const contextIds = new Set(contextList.map(_trackId));
    const playedIds = new Set(_playbackHistory.map(_trackId));
    const seedId = _trackId(AppState.playContext?.seedMusicId || currentId);
    const seedTrack = allMusics.find(track => _trackId(track) === seedId);
    const seedProfile = AppState.playContext?.seedProfile || seedTrack;
    const categoryOrder = _categoryOrderForProfile(seedProfile);
    const currentCategoryIndex = Number(AppState.playContext?.fallbackCategoryIndex || 0);
    const activeCategory = categoryOrder[currentCategoryIndex] || null;
    const isCompatible = track => {
        const candidateCategory = _musicCategory(track);
        return !activeCategory || candidateCategory === activeCategory;
    };

    // Se o contexto atual não deixou nenhuma próxima faixa, ele é curto
    // (por exemplo, uma busca com uma única música). Nesse caso, o catálogo
    // restante da mesma categoria vira a fila de continuidade.
    const source = AppState.playContext?.source || 'library';
    // Enquanto ainda existem faixas na playlist, não antecipa recomendações
    // externas. Elas só entram depois que a última faixa da playlist acabar.
    if ((source === 'playlist' || AppState.playContext?.playlistId)
        && (AppState.autoQueue || []).length > 0) return;
    if ((AppState.autoQueue || []).length > 0) return;
    if (AppState.repeatMode === 1 && (source === 'playlist' || AppState.playContext?.playlistId)) return;
    const candidates = allMusics.filter(track => {
        const id = _trackId(track);
        const outsideShortContext = !contextIds.size || !contextIds.has(id);
        const broadContext = source === 'library' || source === 'autoplay' || contextIds.size >= allMusics.length;
        return id !== currentId && !queuedIds.has(id)
            && isCompatible(track)
            && (broadContext || outsideShortContext);
    });
    let refillCandidates = candidates;
    let nextCategoryIndex = currentCategoryIndex;
    let activeCategoryForQueue = activeCategory;
    if (!refillCandidates.length && categoryOrder.length > currentCategoryIndex + 1) {
        // O gênero atual acabou: avança para o próximo gênero do perfil da
        // playlist, sem repetir a categoria anterior imediatamente.
        nextCategoryIndex = currentCategoryIndex + 1;
        const nextCategory = categoryOrder[nextCategoryIndex];
        activeCategoryForQueue = nextCategory;
        refillCandidates = allMusics.filter(track => {
            const id = _trackId(track);
            return id !== currentId && !queuedIds.has(id) && _musicCategory(track) === nextCategory;
        });
        if (refillCandidates.length && AppState.playContext) {
            AppState.playContext.fallbackCategoryIndex = nextCategoryIndex;
        }
    }
    if (!refillCandidates.length) return;

    const unplayed = refillCandidates.filter(track => !playedIds.has(_trackId(track)));
    const orderedPool = unplayed.length ? unplayed : refillCandidates;
    const ordered = typeof buildAffinityQueue === 'function'
        ? buildAffinityQueue(currentId, orderedPool, AppState.isShuffle, seedId, seedProfile, activeCategoryForQueue)
        : (AppState.isShuffle ? _shuffleSpread(orderedPool) : [...orderedPool]);
    AppState.autoQueue.push(...ordered);
}

// Atualiza o contexto e regenera a fila automática.
// A ordem original fica preservada para desligar o shuffle sem perder o
// contexto escolhido pelo usuário.
function setPlayContext(source, trackList, playlistId = null) {
    const cleanList = _uniqueTracks(trackList);
    AppState._originalTrackList = [...cleanList];
    AppState.playContext = { source, playlistId, trackList: [...cleanList], seedMusicId: null };
    AppState.autoQueue = buildAutoQueue(AppState.currentMusicId, cleanList, AppState.isShuffle);
    ensureAutoQueue();
    if (typeof window.renderQueuePanel === 'function') window.renderQueuePanel();
}

function _pushPlaybackHistory(musicId) {
    const normalizedId = _trackId(musicId);
    const lastId = _trackId(_playbackHistory[_playbackHistory.length - 1]);
    if (normalizedId === lastId) return;
    _playbackHistory.push(musicId);
    if (_playbackHistory.length > _HISTORY_MAX) _playbackHistory.shift();
}

// Retorna a próxima música (fila manual tem prioridade sobre automática)
function getNextMusic() {
    if (AppState.queue.length > 0) return AppState.queue.shift();
    if (AppState.autoQueue.length > 0) return AppState.autoQueue.shift();
    return null;
}

// Retorna a música anterior com base no histórico de reprodução real
function getPrevMusic() {
    if (_playbackHistory.length > 0 &&
        _trackId(_playbackHistory[_playbackHistory.length - 1]) === _trackId(AppState.currentMusicId)) {
        _playbackHistory.pop();
    }
    if (_playbackHistory.length === 0) return null;
    const prevId = _trackId(_playbackHistory[_playbackHistory.length - 1]);
    return AppState.musics.find(m => _trackId(m) === prevId) || null;
}

window.setPlayContext = setPlayContext;
window._queueListForContext = _queueListForContext;
window.buildCollectionProfile = _buildCollectionProfile;
window.buildAffinityQueue = buildAffinityQueue;
window.ensureAutoQueue = ensureAutoQueue;
window.buildAutoQueue = buildAutoQueue;
window.buildShuffleOrder = _shuffleSpread;
window.getNextMusic = getNextMusic;

// ===== FILA (sem mudanças) =====
function addToQueue(music, insertNext = false) {
    if (!music) return;
    if (insertNext) {
        const currentIndex = AppState.queue.findIndex(m => m.id === AppState.currentMusicId);
        AppState.queue.splice(currentIndex + 1, 0, music);
    } else {
        AppState.queue.push(music);
    }
    if (typeof window.renderQueue === 'function') window.renderQueue();
    showToast(`${music.title} adicionado${insertNext ? ' à seguir' : ' à fila'}`, "success");
}

function removeFromQueue(index) {
    if (index >= 0 && index < AppState.queue.length) {
        const removed = AppState.queue.splice(index, 1)[0];
        if (typeof window.renderQueue === 'function') window.renderQueue();
        showToast(`${removed.title} removido da fila`, "danger");
    }
}

function clearQueue() {
    AppState.queue = [];
    if (typeof window.renderQueue === 'function') window.renderQueue();
    showToast("Fila limpa", "success");
}

function playNextFromQueue() {
    if (AppState.queue.length > 0) {
        const next = AppState.queue.shift();
        if (typeof window.renderQueue === 'function') window.renderQueue();
        playMusicTrack(next, { advance: true });
        return true;
    }
    return false;
}

// ===== REPRODUÇÃO =====
let currentListenStartTime = 0;
let currentListenMusicId = null;
let currentListenLoggedSecs = 0; // posição já contabilizada nesta sessão de escuta
let currentListenSessionId = null;

function createListenSessionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `listen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Loga só o DELTA desde o último flush. Antes, 'pause',
// 'visibilitychange' e a troca de faixa logavam cada um o
// currentTime INTEIRO — pausar e depois trocar de música contava o
// mesmo tempo 2-3x, inflando a Máquina do Tempo e as recomendações.
const MIN_MEANINGFUL_LISTEN_SECONDS = 10;

async function flushListenTime(minDelta = 1, completed = false) {
    if (!currentListenMusicId || !DOM.audio) return;
    const pos   = Math.floor(DOM.audio.currentTime || 0);
    const delta = pos - currentListenLoggedSecs;
    if (delta < minDelta) return;
    // Ignora toques acidentais; a sessão passa a contar a partir de 10s.
    if (pos < MIN_MEANINGFUL_LISTEN_SECONDS && !completed) return;
    currentListenLoggedSecs = pos;
    const music = AppState.musics.find(m => m.id === currentListenMusicId);
    if (music) await addToHistory(music, pos, {
        sessionId: currentListenSessionId,
        deltaSeconds: delta,
        completed,
        playedAt: currentListenStartTime || Date.now(),
    });
}
// Chamar quando currentTime volta a 0 sem trocar de faixa (repeat-one)
function resetListenPosition() {
    currentListenLoggedSecs = 0;
    currentListenSessionId = createListenSessionId();
}
window.flushListenTime     = flushListenTime;
window.resetListenPosition = resetListenPosition;

async function playMusicTrack(music, opts = {}) {
    if (!DOM.audio || !music) return;

    // Se havia uma retomada pendente por bloqueio de autoplay, a escolha
    // explícita do usuário passa a ser a única autoridade da reprodução.
    window.cancelPendingPlayerResume?.();

    // Nunca bloqueia o gesto do usuário com rede, IndexedDB ou histórico.
    // Em celulares, qualquer await antes de play() pode fazer o navegador
    // rejeitar a reprodução por perda da user activation.
    flushListenTime(1).catch(() => {});

    const isDifferentTrack = AppState.currentMusicId !== music.id;
    AppState.currentMusicId = music.id;
    AppState.playing = true;
    currentListenMusicId = music.id;
    currentListenStartTime = Date.now();
    currentListenLoggedSecs = 0;
    if (isDifferentTrack || !currentListenSessionId) currentListenSessionId = createListenSessionId();

    // Registra no histórico de navegação para o botão ◀️
    _pushPlaybackHistory(music.id);

    // ── Alinhamento da fila (semântica Spotify) ─────────────────────────
    // Play iniciado pelo USUÁRIO: a fila automática vira o que vem DEPOIS
    // desta música no contexto atual.
    // Play de AVANÇO ({advance:true} = next/prev/fim de faixa): NUNCA
    // reconstrói — a fila precisa esgotar para repeat-all e o autoplay
    // inteligente serem alcançáveis.
    if (!opts.advance) {
        const _ctx = AppState.playContext || {};
        const _isPlaylistContext = (_ctx.source === 'playlist' || _ctx.playlistId)
            && (_ctx.trackList || []).some(track => _trackId(track) === _trackId(music.id));
        const _list = _isPlaylistContext
            ? _ctx.trackList
            : AppState.musics;
        // Toda nova escolha do usuário vira a nova música-semente; uma escolha
        // fora da playlist anterior também começa um contexto global novo.
        if (_isPlaylistContext) {
            _ctx.seedMusicId = music.id;
            _ctx.seedProfile = _ctx.seedProfile || _buildCollectionProfile(_ctx.trackList);
            // Enquanto ainda há faixas da playlist, preserva sua ordem. O
            // perfil da coleção só será usado quando ela acabar.
            AppState.autoQueue = buildAutoQueue(music.id, _list, AppState.isShuffle);
        } else {
            AppState.playContext = {
                source: 'library',
                playlistId: null,
                trackList: [...AppState.musics],
                seedMusicId: music.id,
                seedProfile: null,
            };
            AppState.autoQueue = buildAffinityQueue(music.id, _list, AppState.isShuffle, music.id, music);
        }
        ensureAutoQueue();
    }

    incrementPlayCount(music.id);

    let audioUrl = music.src;
    // Online: usa a URL remota imediatamente para preservar o gesto do toque.
    // Offline: consulta o IndexedDB antes do play, pois não há rede disponível.
    if (navigator.onLine === false || !audioUrl) {
        const cachedBlobUrl = await getCachedAudioUrl(music);
        if (cachedBlobUrl) audioUrl = cachedBlobUrl;
    }

    if (isDifferentTrack) {
        DOM.audio.src = audioUrl || '';
        DOM.audio.load();
        DOM.audio.muted = false;
        DOM.audio.volume = 1;
    }

    // O card Continue ouvindo pode pedir uma posição salva. Aplicamos antes
    // do play para que a retomada preserve o ponto em que a faixa parou.
    const resumeAt = Number(opts.resumeAt);
    if (Number.isFinite(resumeAt) && resumeAt > 0) {
        const applyResumePosition = () => {
            const duration = Number(DOM.audio.duration);
            if (!Number.isFinite(duration) || resumeAt < Math.max(0, duration - 3)) {
                DOM.audio.currentTime = resumeAt;
            }
        };
        if (DOM.audio.readyState >= 1) applyResumePosition();
        else DOM.audio.addEventListener('loadedmetadata', applyResumePosition, { once: true });
    }

    // Inicia a reprodução antes de buscar letra ou atualizar histórico/UI.
    // Esta chamada precisa ficar diretamente no caminho do clique do usuário.
    DOM.audio.play()
        .then(() => {
            if (typeof window.updatePlayerVisibility === 'function') window.updatePlayerVisibility(music);
            if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
            if (typeof window.updateMediaSession === 'function') window.updateMediaSession(music);
            if (typeof window.renderQueuePanel === 'function') window.renderQueuePanel();
        })
        .catch((err) => {
            window._showFendaError?.('[DIAG] DOM.audio.play() REJEITADO: ' + (err?.name || '') + ' — ' + (err?.message || err));
            AppState.playing = false;
            if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
        });

    // Letras são secundárias: carregam depois que o áudio já começou.
    if (!isDifferentTrack) return;
    const loadLyrics = async () => {
        let rawLyricsText = "";
        if (music.lrc && (music.lrc.startsWith('http://') || music.lrc.startsWith('https://'))) {
            try {
                const response = await fetch(music.lrc);
                rawLyricsText = response.ok ? await response.text() : "[00:00.00] Letra indisponível.";
            } catch {
                rawLyricsText = "[00:00.00] Erro ao carregar letra.";
            }
        } else {
            rawLyricsText = music.lrc || "";
        }
        if (AppState.currentMusicId !== music.id) return;
        if (typeof window.parseLyrics === 'function') AppState.lyricsData = window.parseLyrics(rawLyricsText);
        if (typeof window.buildLyricsMarkup === 'function') window.buildLyricsMarkup();
    };
    loadLyrics().catch(() => {});
}

function togglePlayMusic(music) {
    if (!DOM.audio) return;
    if (!music) music = AppState.musics.find(m => m.id === AppState.currentMusicId);
    if (!music) return;
    if (AppState.currentMusicId !== music.id) { playMusicTrack(music); return; }
    if (AppState.playing) { DOM.audio.pause(); AppState.playing = false; }
    else { DOM.audio.play().catch(()=>{}); AppState.playing = true; }
    if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
}

function handleNextTrack() {
    window._showFendaError?.('[DIAG] handleNextTrack: queue=' + AppState.queue.length + ' autoQueue=' + AppState.autoQueue.length + ' repeatMode=' + AppState.repeatMode + ' musics=' + AppState.musics.length);
    // Reabastece antes de decidir o próximo passo, para nunca deixar o
    // autoplay sem faixa quando o catálogo ainda possui músicas válidas.
    ensureAutoQueue();
    // 1. Fila manual tem prioridade absoluta
    if (AppState.queue.length > 0) {
        window._showFendaError?.('[DIAG] ramo 1: fila manual');
        const next = AppState.queue.shift();
        if (typeof window.renderQueue === 'function') window.renderQueue();
        if (typeof window.renderQueuePanel === 'function') window.renderQueuePanel();
        playMusicTrack(next, { advance: true });
        return;
    }

    const { source, trackList } = AppState.playContext;
    const allMusics = AppState.musics;

    // 2. Tem próxima na autoQueue → toca
    if (AppState.autoQueue.length > 0) {
        window._showFendaError?.('[DIAG] ramo 2: autoQueue tem ' + AppState.autoQueue.length + ' músicas');
        playMusicTrack(AppState.autoQueue.shift(), { advance: true });
        return;
    }

    // 3. Fila esgotou — repeat-all reinicia o contexto atual
    if (AppState.repeatMode === 1) {
        window._showFendaError?.('[DIAG] ramo 3: repeat-all, reconstruindo autoQueue');
        const list = trackList?.length > 0 ? trackList : allMusics;
        AppState.autoQueue = buildAutoQueue(AppState.currentMusicId, list, AppState.isShuffle, true);
        if (AppState.autoQueue.length > 0) playMusicTrack(AppState.autoQueue.shift(), { advance: true });
        return;
    }

    // 4. Autoplay universal: continua com músicas que ainda não tocaram no contexto atual
    if (allMusics.length === 0) {
        window._showFendaError?.('[DIAG] catálogo vazio durante avanço');
        return;
    }
    window._showFendaError?.('[DIAG] ramo 4: autoplay universal, montando pool de ' + allMusics.length + ' músicas');
    const contextIds = new Set((trackList || []).map(m => m.id));
    const played = new Set(_playbackHistory);
    // Prefere músicas fora do contexto que ainda não tocaram; fallback para qualquer uma
    let pool = allMusics.filter(m => m.id !== AppState.currentMusicId && !contextIds.has(m.id) && !played.has(m.id));
    if (pool.length === 0) pool = allMusics.filter(m => m.id !== AppState.currentMusicId && !contextIds.has(m.id));
    if (pool.length === 0) pool = allMusics.filter(m => m.id !== AppState.currentMusicId);
    window._showFendaError?.('[DIAG] pool final tem ' + pool.length + ' músicas');
    const carriedProfile = AppState.playContext?.seedProfile || null;
    AppState.autoQueue = buildAffinityQueue(
        AppState.currentMusicId,
        pool,
        AppState.isShuffle,
        AppState.currentMusicId,
        carriedProfile
    );
    AppState.playContext = {
        source: 'autoplay',
        playlistId: null,
        trackList: [...pool],
        seedMusicId: AppState.currentMusicId,
        seedProfile: carriedProfile,
    };
    AppState._originalTrackList = [...pool];
    if (AppState.autoQueue.length > 0) {
        window._showFendaError?.('[DIAG] chamando playMusicTrack com a próxima do pool');
        playMusicTrack(AppState.autoQueue.shift(), { advance: true });
    } else {
        window._showFendaError?.('[DIAG] pool ficou vazio, NADA vai tocar');
    }
}

function handlePrevTrack() {
    // Regra Spotify: mais de 3s dentro da faixa → volta ao início dela;
    // só vai para a anterior se estiver no comecinho.
    if (DOM.audio && DOM.audio.currentTime > 3) {
        DOM.audio.currentTime = 0;
        return;
    }
    const prev = getPrevMusic();
    if (prev) {
        playMusicTrack(prev, { advance: true });
        return;
    }
    // Sem histórico: reinicia a música atual do início
    if (DOM.audio) DOM.audio.currentTime = 0;
}

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function showToast(message, type = 'success') {
    // Favoritar/desfavoritar é uma ação visual silenciosa por decisão de UX.
    if (/favorit/i.test(String(message || ''))) return;
    const container = document.getElementById('toastContainer');
    if (!container) return;
    container.innerHTML = ''; 
    const toast = document.createElement('div');
    toast.className = `premium-toast ${type}`;
    const icon = type === 'success' ? 'check_circle' : 'error';
    toast.innerHTML = `<span class="material-symbols-rounded">${icon}</span><p style="margin:0;">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// ===== ROTEADOR DE URL =====
const _TAB_URL = {
    '/inicio':    'inicio',
    '/busca':     'buscar',
    '/biblioteca':'biblioteca',
    '/perfil':    'perfil',
};
const _LIB_FILTER_URL = {
    '/biblioteca/playlists':  'playlists',
    '/biblioteca/historico':  'history',
    '/biblioteca/artistas':   'artists',
    '/biblioteca/downloads':  'downloads',
};

window.getUrlForState = function({ tab, libFilter, playlistId, artistName } = {}) {
    if (tab === 'inicio')     return '/inicio';
    if (tab === 'buscar')     return '/busca';
    if (tab === 'perfil')     return '/perfil';
    if (tab === 'biblioteca') {
        if (artistName)  return '/biblioteca/artista/' + encodeURIComponent(artistName);
        if (playlistId)  return '/biblioteca/playlist/' + encodeURIComponent(playlistId);
        if (libFilter === 'playlists')  return '/biblioteca/playlists';
        if (libFilter === 'history')    return '/biblioteca/historico';
        if (libFilter === 'artists')    return '/biblioteca/artistas';
        if (libFilter === 'downloads')  return '/biblioteca/downloads';
        return '/biblioteca';
    }
    return '/inicio';
};

// Flag: após o boot, _activateTab já pode renderizar normalmente
let _bootDone = false;

// A restauração pode ser chamada pelo boot e pelo carregamento remoto. Evita
// duas execuções concorrentes, mas libera nova tentativa quando a anterior
// terminou sem encontrar a faixa no catálogo.
let _playerSessionRestoreInFlight = null;
async function restorePlayerSessionWhenReady() {
    if (AppState.currentMusicId || typeof window.restorePlayerSession !== 'function') return false;
    if (_playerSessionRestoreInFlight) return _playerSessionRestoreInFlight;

    const attempt = Promise.resolve()
        .then(() => window.restorePlayerSession())
        .catch(error => {
            console.warn('[Session] Falha ao restaurar sessão:', error);
            return false;
        });
    _playerSessionRestoreInFlight = attempt;
    try {
        return await attempt;
    } finally {
        if (_playerSessionRestoreInFlight === attempt) _playerSessionRestoreInFlight = null;
    }
}

window.restoreStateFromUrl = function() {
    const path = window.location.pathname;
    const playlistMatch = path.match(/^\/biblioteca\/playlist\/(.+)$/);
    if (playlistMatch) {
        const id = decodeURIComponent(playlistMatch[1]);
        _activateTab('biblioteca', true);
        const tryOpen = (attempts = 0) => {
            const playlist = (AppState.userPlaylists || []).find(p => String(p.id) === String(id));
            if (playlist && typeof window.openPlaylistDetail === 'function') {
                window.openPlaylistDetail(playlist, true);
            } else if (attempts < 20) { setTimeout(() => tryOpen(attempts + 1), 150); }
        };
        setTimeout(() => tryOpen(), 300);
        return;
    }
    const artistMatch = path.match(/^\/biblioteca\/artista\/(.+)$/);
    if (artistMatch) {
        const name = decodeURIComponent(artistMatch[1]);
        _activateTab('biblioteca', true);
        const tryOpen = (attempts = 0) => {
            if (AppState.musics && AppState.musics.length && typeof window.openArtistDetail === 'function') {
                window.openArtistDetail(name, true);
            } else if (attempts < 20) { setTimeout(() => tryOpen(attempts + 1), 150); }
        };
        setTimeout(() => tryOpen(), 300);
        return;
    }
    if (_LIB_FILTER_URL[path]) {
        _activateTab('biblioteca', true);
        setTimeout(() => {
            const btn = document.querySelector(`.lib-main-tab[data-filter="${_LIB_FILTER_URL[path]}"]`);
            if (btn) btn.click();
        }, 200);
        return;
    }
    _activateTab(_TAB_URL[path] || 'inicio', !_bootDone);
};

function _activateTab(tabId, noRender = false) {
    const navButtons = document.querySelectorAll('.nav-bar .nav-btn');
    const tabContents = document.querySelectorAll('.main-content .tab-content');
    navButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.add('active');
    AppState.currentTab = tabId;
    if (noRender) return;
    // A navegação inicial já é renderizada pelo boot. Trocar de aba não
    // deve reconstruir a home nem mover o scroll do usuário.
    if (tabId === 'inicio' && window._homeNeedsRefresh) {
        window.refreshHomeInBackground?.();
    }
    if (tabId === 'buscar'     && typeof window.initSearch    === 'function') window.initSearch();
    if (tabId === 'biblioteca' && typeof window.renderLibrary === 'function') window.renderLibrary();
    if (tabId === 'perfil'     && typeof window.renderProfile === 'function') window.renderProfile();
}

// ===== NAVEGAÇÃO POR ABAS =====
function initTabs() {
    const navButtons = document.querySelectorAll('.nav-bar .nav-btn');
    const tabContents = document.querySelectorAll('.main-content .tab-content');
    if (navButtons.length === 0) return;

    function switchTab(tabId, btn) {
        if (!tabId) return;
        if (typeof window.closePlaylistDetail === 'function') window.closePlaylistDetail(true);
        const wasHomeActive = document.getElementById('inicio')?.classList.contains('active');
        navButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const activeTab = document.getElementById(tabId);
        if (activeTab) activeTab.classList.add('active');
        AppState.currentTab = tabId;
        // Só atualiza ao retornar se uma atualização ocorreu enquanto a home
        // estava fora da tela. Clicar novamente em Início não faz nada.
        if (tabId === 'inicio' && !wasHomeActive && window._homeNeedsRefresh) {
            window.refreshHomeInBackground?.();
        }
        if (tabId === 'buscar'     && typeof window.initSearch    === 'function') window.initSearch();
        if (tabId === 'biblioteca' && typeof window.renderLibrary === 'function') window.renderLibrary();
        if (tabId === 'perfil'     && typeof window.renderProfile === 'function') window.renderProfile();
        history.pushState({ tab: tabId }, '', window.getUrlForState({ tab: tabId }));
    }

    navButtons.forEach(btn => {
        const tabId = btn.getAttribute('data-tab');
        const handler = (e) => { e.preventDefault(); e.stopPropagation(); switchTab(tabId, btn); };
        btn.removeEventListener('click', handler);
        btn.removeEventListener('touchstart', handler);
        btn.addEventListener('click', handler);
        btn.addEventListener('touchstart', handler, { passive: false });
    });

    window.addEventListener('popstate', () => window.restoreStateFromUrl());
}

function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        switch(e.key) {
            case ' ': case 'Space': e.preventDefault(); togglePlayMusic(); break;
            case 'ArrowLeft': e.preventDefault(); handlePrevTrack(); break;
            case 'ArrowRight': e.preventDefault(); handleNextTrack(); break;
            case 'f': case 'F': if (typeof window.expandLyricsScreen === 'function') window.expandLyricsScreen(); break;
            case 'Escape': const lyricsScreen = document.getElementById('lyricsFullScreen'); if (lyricsScreen && lyricsScreen.classList.contains('expanded') && typeof window.collapseLyricsScreen === 'function') window.collapseLyricsScreen(); break;
        }
    });
}

// ===== CARREGAR DADOS INICIAIS DO USUÁRIO =====
async function loadInitialData() {
    // ── PASSO 1: carrega o que tiver no cache IMEDIATAMENTE ─────────
    // (Independente de estar online ou offline, e independente do TTL)
    await _loadAllFromCache();

    // Define contexto padrão: todas as músicas da biblioteca
    if (AppState.musics.length > 0 && typeof setPlayContext === 'function') {
        setPlayContext('library', AppState.musics);
    }

    // ── PASSO 2: se online, atualiza em background ──────────────────
    if (navigator.onLine) {
        console.log('[Cache]  Online — atualizando dados em background...');
        _fetchAllFromSupabase().then(() => {
            if (typeof window.refreshHomeInBackground === 'function') window.refreshHomeInBackground();
            if (typeof window.renderLibrary === 'function') window.renderLibrary();
            if (typeof window.renderProfile === 'function') window.renderProfile();
        }).catch(e => console.warn('[Cache] Falha ao atualizar online:', e));
    } else {
        console.log('[Cache]  Offline — usando dados do cache');
    }
}

async function _fetchAllFromSupabase() {
    if (!navigator.onLine) {
        console.log('[Cache] Offline — usando cache local');
        await _loadAllFromCache();
        return;
    }

    // ── Helper: adiciona timeout para não travar em Supabase lento ────
    function _withTimeout(promise, ms = 10_000, fallback = null) {
        return Promise.race([
            promise,
            new Promise(resolve => setTimeout(() => resolve(fallback), ms))
        ]);
    }

    // ── Renderiza telas com os dados disponíveis no momento ───────────
    function _rerender() {
        if (typeof window.refreshHomeInBackground === 'function') window.refreshHomeInBackground();
        if (typeof window.renderLibrary  === 'function') window.renderLibrary();
        if (typeof window.renderProfile  === 'function') window.renderProfile();
    }

    // ── TODAS as buscas em paralelo — nenhuma espera outra ───────────
    // Histórico NÃO vai ao Supabase: o localStorage é mais atualizado
    // e já está carregado por _loadAllFromCache() antes desta função.
    const [musicsResult, artistsResult, podcastsResult, userResult] = await Promise.allSettled([

        // 1. Músicas do catálogo + fallback local
        _withTimeout((async () => {
            const remote = typeof window.loadMusicsFromSupabase === 'function'
                ? await window.loadMusicsFromSupabase().catch(() => [])
                : [];
            const local  = (() => {
                try { return JSON.parse(localStorage.getItem('supabase_player_fallback') || '[]'); }
                catch { return []; }
            })();
            const all = [...remote, ...local];
            const ids = new Set();
            return all.filter(m => !ids.has(m.id) && ids.add(m.id));
        })(), 12_000, []),

        // 2. Artistas (antes era serial — agora paralelo com músicas)
        _withTimeout(
            typeof window.loadAllArtists === 'function'
                ? window.loadAllArtists().catch(() => [])
                : Promise.resolve([]),
            8_000, []
        ),

        // 3. Podcasts públicos publicados pelo admin
        _withTimeout(
            typeof window.loadPodcastsFromSupabase === 'function'
                ? window.loadPodcastsFromSupabase().catch(() => [])
                : Promise.resolve([]),
            8_000, []
        ),

        // 4. Dados do usuário: perfil, playlists, favoritos, busca recente
        //    Timeout INDIVIDUAL por chamada — antes era um único timeout
        //    coletivo no Promise.all inteiro, então se só o perfil demorasse
        //    (RLS lenta, rede ruim), TUDO era descartado (playlists e
        //    favoritos que já tinham voltado rápido inclusive), e o nome
        //    ficava preso em "Carregando..." pra sempre, sem retry.
        AppState.userId
            ? Promise.all([
                _withTimeout(window.getUserProfile(AppState.userId).catch(() => ({})), 10_000, null),
                _withTimeout(window.loadUserPlaylists(AppState.userId).catch(() => []), 10_000, []),
                _withTimeout(window.loadUserFavorites(AppState.userId).catch(() => []), 10_000, []),
                // Histórico do Supabase — essencial para sincronizar entre
                // dispositivos e após limpar o cache local
                _withTimeout(window.loadListeningHistory(AppState.userId, 500).catch(() => []), 10_000, []),
                _withTimeout(
                    (window.loadSearchHistory
                        ? window.loadSearchHistory(AppState.userId, 5).catch(() => [])
                        : Promise.resolve([])),
                    10_000, []
                ),
              ])
            : Promise.resolve(null),
    ]);

    // ── Aplica músicas — re-renderiza imediatamente ───────────────────
    if (musicsResult.status === 'fulfilled' && musicsResult.value?.length) {
        AppState.musics = musicsResult.value;
        // Primeiro render: mostra catálogo assim que chegar
        _rerender();

        // Em uma instalação sem cache, a sessão pode ser lida antes de as
        // músicas chegarem. Tenta restaurar novamente quando o catálogo online
        // terminar de carregar, sem sobrescrever uma reprodução iniciada pelo usuário.
        const restored = await restorePlayerSessionWhenReady();
        if (restored) _rerender();
        console.log('[Cache] Músicas carregadas:', AppState.musics.length);
    }

    // ── Aplica artistas ───────────────────────────────────────────────
    if (artistsResult.status === 'fulfilled') {
        AppState.artists = artistsResult.value || [];
    }

    // ── Aplica podcasts públicos ───────────────────────────────────────
    if (podcastsResult.status === 'fulfilled') {
        AppState.podcasts = podcastsResult.value || [];
        _rerender();
    }

    // ── Aplica dados do usuário — segundo render com tudo ─────────────
    if (userResult.status === 'fulfilled' && userResult.value) {
        const [profile, playlists, favorites, supabaseHistory, searchTerms] = userResult.value;
        // profile pode vir null se essa chamada específica estourou o timeout
        // individual — nesse caso mantém o que já estava em AppState (cache
        // local ou o nome carregado no login) em vez de apagar com {}.
        if (profile) AppState.userProfile = profile;
        AppState.userPlaylists = playlists || [];
        AppState.favorites     = new Set((favorites || []).map(id => String(id)));
        window.recentSearchesGlobal = searchTerms || [];
        if (typeof window.renderRecentSearches === 'function') window.renderRecentSearches();

        // ── Merge de histórico: Supabase + localStorage ───────────────
        // O Supabase tem histórico de OUTROS dispositivos / sessões antigas.
        // O localStorage tem os plays mais recentes desta sessão.
        // Resultado: histórico unificado da conta, sem duplicatas.
        if (supabaseHistory && supabaseHistory.length > 0) {
            // Converte registros do Supabase para o formato interno
            const remoteHistory = supabaseHistory.map(h => ({
                id:              h.music_id,
                title:           AppState.musics.find(m => m.id === h.music_id)?.title  || h.title  || '',
                artist:          AppState.musics.find(m => m.id === h.music_id)?.artist || h.artist || '',
                cover:           AppState.musics.find(m => m.id === h.music_id)?.cover  || h.cover  || '',
                listenedSeconds: h.listened_seconds || 0,
                playedAt:        new Date(h.played_at).getTime(),
                sessionId:       h.session_id || null,
                completed:       Boolean(h.completed),
            }));

            // Merge com histórico local (local = mais recente e preciso)
            const localHistory = AppState.history || [];
            const merged = [...localHistory, ...remoteHistory]
                .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
                .filter((() => {
                    // Dedup: mesma música com timestamps a menos de 2 min de
                    // distância = mesmo play (cópia local + linha do Supabase).
                    // Plays distintos da mesma música no mesmo dia são MANTIDOS
                    // — antes eram descartados, o que subcontava minutos e
                    // plays na Máquina do Tempo. Idempotente entre boots.
                    const seenSessions = new Set();
                    const seenByTrack = new Map(); // legado sem sessionId -> [timestamps]
                    const NEAR_MS = 2 * 60 * 1000;
                    return h => {
                        if (h.sessionId) {
                            if (seenSessions.has(h.sessionId)) return false;
                            seenSessions.add(h.sessionId);
                            return true;
                        }
                        const id = String(h.id);
                        const ts = h.playedAt || 0;
                        const kept = seenByTrack.get(id) || [];
                        if (kept.some(t => Math.abs(t - ts) < NEAR_MS)) return false;
                        kept.push(ts);
                        seenByTrack.set(id, kept);
                        return true;
                    };
                })())
                .slice(0, 500);

            AppState.history = merged;
            saveLocalHistory(merged); // persiste localmente para boot offline

            // Soma autoritativa da conta (sem cap de 500). Fire-and-forget:
            // corrige o contador local e a stat do perfil se estiver na tela.
            window.loadTotalListenedSeconds?.().then(secs => {
                if (secs == null) return;
                const cur = parseInt(localStorage.getItem(_totalTimeKey()) || '0') || 0;
                // max(): escuta offline ainda não enviada pode deixar o
                // contador local à frente do Supabase
                const best = Math.max(secs, cur);
                localStorage.setItem(_totalTimeKey(), String(best));
                const el = document.getElementById('totalTimeStat');
                if (el) {
                    const m = Math.floor(best / 60);
                    el.innerText = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m} min`;
                }
            }).catch(() => {});
            console.log('[Cache] Histórico sincronizado:', merged.length, 'entradas');
        }

        // Salva tudo no cache para o próximo boot offline
        CacheDB.saveAll({
            playlists:     AppState.userPlaylists,
            favorites:     [...AppState.favorites],
            history:       AppState.history,
            profile:       AppState.userProfile,
            searchHistory: searchTerms || [],
            userId:        AppState.userId,
        });

        // Segundo render: agora com dados completos do usuário
        _rerender();
        console.log('[Cache] Dados do usuário carregados:', {
            perfil:    AppState.userProfile?.full_name || '—',
            playlists: AppState.userPlaylists.length,
            favoritos: AppState.favorites.size,
            histórico: AppState.history.length,
        });
    } else if (userResult.status === 'rejected') {
        console.warn('[Cache] Dados do usuário falharam:', userResult.reason);
    }
}

// Carrega tudo do cache local (localStorage)
async function _loadAllFromCache() {
    const userId = AppState.userId;
    if (!userId) {
        console.warn('[Cache] userId não definido ainda');
        return;
    }

    const cached = await CacheDB.loadAll(userId);
    if (cached) {
        // Músicas não vêm do cache — só playlists, favoritos, perfil e histórico
        if (cached.playlists.length)     AppState.userPlaylists = cached.playlists;
        if (cached.favorites.length)     AppState.favorites     = new Set(cached.favorites);
        if (cached.profile?.full_name)   AppState.userProfile   = cached.profile;
        if (cached.searchHistory.length) {
            window.recentSearchesGlobal = cached.searchHistory;
            if (typeof window.renderRecentSearches === 'function') window.renderRecentSearches();
        }
    }

    // Histórico local (localStorage — sempre mais atualizado que o cache)
    const localHistory = loadLocalHistory();
    if (localHistory.length > 0) AppState.history = localHistory;
    else if (cached?.history?.length)  AppState.history = cached.history;

    // Nome do usuário
    const localUser = loadLocalUserName();
    if (localUser?.name && !AppState.userProfile?.full_name) {
        AppState.userProfile = { ...AppState.userProfile, full_name: localUser.name };
        localStorage.setItem('user_email', localUser.email || '');
    }

    // Músicas baixadas offline
    if (window.getAllCachedMusics) {
        try {
            const cachedMusics = await window.getAllCachedMusics();
            cachedMusics.forEach(meta => {
                if (!AppState.musics.find(m => m.id === meta.musicId)) {
                    AppState.musics.push({
                        id: meta.musicId,
                        title: meta.title,
                        artist: meta.artist,
                        cover: meta.cover,
                        src: meta.url,
                        _offlineOnly: true
                    });
                }
            });
        } catch(e) { console.warn('[Cache] Erro ao carregar músicas offline:', e); }
    }

    console.log('[Cache]  Cache carregado:', {
        músicas: AppState.musics.length,
        playlists: AppState.userPlaylists.length,
        favoritos: AppState.favorites.size,
        histórico: AppState.history.length,
        nome: AppState.userProfile?.full_name || '(sem nome)'
    });
}

// Atualiza silenciosamente em background sem travar a UI
async function _refreshFromSupabaseInBackground() {
    try {
        await _fetchAllFromSupabase();
        // Re-renderiza as telas com dados frescos
        if (typeof window.refreshHomeInBackground === 'function') window.refreshHomeInBackground();
        if (typeof window.renderLibrary === 'function') window.renderLibrary();
        if (typeof window.renderProfile === 'function') window.renderProfile();
        console.log('[Cache]  Dados atualizados em background');
    } catch(e) {
        console.warn('[Cache] Background refresh falhou (offline?):', e);
    }
}

async function initApp() {
    await loadInitialData();
    void syncPendingListenSessions();
    _bootDone = true;
    if (typeof window.renderHome === 'function') window.renderHome();
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderProfile === 'function') window.renderProfile();
    if (typeof window.renderQueue === 'function') window.renderQueue();
    if (typeof window.initSearch === 'function') window.initSearch();
}

function checkDeepLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const musicId = urlParams.get('music_id');
    const timestamp = parseInt(urlParams.get('t')) || 0;
    const isShared = urlParams.get('share') === '1';
    
    if (musicId && AppState.musics.length > 0) {
        const targetMusic = AppState.musics.find(m => m.id == musicId);
        if (targetMusic) {
            setTimeout(() => {
                playMusicTrack(targetMusic);
                if (timestamp > 0 && DOM.audio) { 
                    DOM.audio.addEventListener('loadedmetadata', () => { 
                        DOM.audio.currentTime = timestamp;
                        // Se é link compartilhado, iniciar modo preview
                        if (isShared && typeof PreviewManager !== 'undefined') {
                            PreviewManager.initializePreview(DOM.audio, timestamp);
                        }
                    }, { once: true }); 
                } else if (isShared && typeof PreviewManager !== 'undefined') {
                    // Preview do início se não houver timestamp
                    PreviewManager.initializePreview(DOM.audio, 0);
                }
                showToast(`Tocando: ${targetMusic.title}${timestamp ? ` a partir de ${formatTime(timestamp)}` : ''}`, "success");
            }, 500);
        } else showToast("Música não encontrada", "danger");
    }
}

function calculateTotalMinutesListened() {
    // Duas fontes, nenhuma completa sozinha:
    // - contador local (fenda_totaltime_): zera na limpeza de cache e em
    //   outro aparelho — era usado com prioridade absoluta ("if secs > 0
    //   return"), então após um reset ele MASCARAVA o histórico sincronizado
    //   para sempre (o "5 min" no perfil vinha daí);
    // - soma do histórico: sincronizada com a conta, mas capada em 500
    //   entradas.
    // Usa o MAIOR dos dois; o valor autoritativo do Supabase (RPC, sem cap)
    // sobrescreve o contador de forma assíncrona quando disponível.
    let counterSecs = 0;
    if (AppState.userId) {
        counterSecs = parseInt(localStorage.getItem(_totalTimeKey()) || '0') || 0;
    }
    let historySecs = 0;
    (AppState.history || []).forEach(item => historySecs += item.listenedSeconds || 0);
    return Math.floor(Math.max(counterSecs, historySecs) / 60);
}

// ===== INICIALIZAÇÃO PRINCIPAL (COM CRIAÇÃO DE PERFIL AUTOMÁTICA) =====
document.addEventListener('DOMContentLoaded', async () => {

    //  PASSO 1: inicializa abas e UI imediatamente, sem esperar nada
    try { initTabs(); } catch (e) { console.error('[Init] initTabs falhou:', e); }
    try { window.restoreStateFromUrl(); } catch (e) { console.error('[Init] restoreStateFromUrl falhou:', e); }
    try { initKeyboardShortcuts(); } catch (e) { console.error('[Init] initKeyboardShortcuts falhou:', e); }
    try { if (typeof window.initMenusAndSearch === 'function') window.initMenusAndSearch(); } catch (e) { console.error('[Init] initMenusAndSearch falhou:', e); }
    try { if (typeof window.setupPlaylistModal === 'function') window.setupPlaylistModal(); } catch (e) { console.error('[Init] setupPlaylistModal falhou:', e); }
    try { if (typeof window.setupPlaylistDetailEvents === 'function') window.setupPlaylistDetailEvents(); } catch (e) { console.error('[Init] setupPlaylistDetailEvents falhou:', e); }
    try { if (typeof window.initAudioAndLyricsEngine === 'function') window.initAudioAndLyricsEngine(); } catch (e) { console.error('[Init] initAudioAndLyricsEngine falhou:', e); }

    // Configura botão da fila (se existir)
    const queueBtn = document.getElementById('playerBottomQueueBtn');
    if (queueBtn) {
        queueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const modal = document.getElementById('queueModal');
            if (modal) {
                if (typeof window.renderQueue === 'function') window.renderQueue();
                modal.classList.add('active');
            }
        });
    }

    // Botão de três pontinhos na mini barra do player
    const moreBtn = document.getElementById('playerBottomMoreBtn');
    if (moreBtn) {
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentMusic = AppState.musics.find(m => m.id === AppState.currentMusicId);
            if (currentMusic && typeof window.openContextMenu === 'function') {
                window.openContextMenu(currentMusic);
            }
        });
    }

    //  PASSO 2: agora verifica sessão em paralelo
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (sessionError) {
        console.error('Erro ao obter sessão:', sessionError);
        window.location.replace('/index.html');
        return;
    }
    
    if (!session) {
        window.location.replace('/index.html');
        return;
    }
    
    // Armazena o ID do usuário logado
    AppState.userId = session.user.id;

    // Ativa a persistência antes de qualquer reprodução. Assim pausas,
    // mudanças de app e fechamento do navegador guardam o ponto atual.
    if (typeof window.initSessionPersistence === 'function') {
        window.initSessionPersistence();
    }
    
    // === GARANTE QUE O PERFIL EXISTE (CRIA SE NÃO EXISTIR) ===
    const userEmail = session.user.email;
    // Nome vindo do Google (ou outro provider) - fallback para parte do email
    const userName = session.user.user_metadata?.full_name || 
                     session.user.user_metadata?.name || 
                     userEmail.split('@')[0];
    
    async function ensureProfileExists() {
        try {
            // Verifica se já existe um perfil para este usuário
            const { data: existing, error: selectError } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('id', AppState.userId)
                .maybeSingle(); // não lança erro se não achar
            
            if (selectError && selectError.code !== 'PGRST116') {
                console.error('Erro ao verificar perfil:', selectError);
                return false;
            }
            
            if (!existing) {
                // Cria o perfil
                const { error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert([{
                        id: AppState.userId,
                        full_name: userName,
                        email: userEmail,
                        bio: 'Apaixonado por música.',
                        avatar_url: null,
                        created_at: new Date(),
                        updated_at: new Date()
                    }]);
                
                if (insertError) {
                    console.error('Erro ao criar perfil:', insertError);
                    return false;
                }
                console.log(' Perfil criado para:', userName);
                return true;
            }
            return true;
        } catch (err) {
            console.error('Falha inesperada em ensureProfileExists:', err);
            return false;
        }
    }
    
    //  PASSO 3: salva userId e email no localStorage para acesso offline
    localStorage.setItem('user_email', userEmail);
    localStorage.setItem('fenda_userId', AppState.userId);

    // Carrega histórico local imediatamente (antes de qualquer chamada de rede)
    const localHistory = loadLocalHistory();
    if (localHistory.length > 0) {
        AppState.history = localHistory;
    }

    // Carrega nome do usuário do cache local imediatamente
    const localUser = loadLocalUserName();
    if (localUser) {
        AppState.userProfile = { full_name: localUser.name, email: localUser.email };
        localStorage.setItem('user_name', localUser.name);
    }

    if (navigator.onLine) {
        // Online: garante perfil e carrega dados frescos
        try {
            await ensureProfileExists();
            const profileData = await window.getUserProfile(AppState.userId);
            AppState.userProfile = profileData;
            localStorage.setItem('user_name', profileData.full_name || userName);
            saveLocalUserName(profileData.full_name || userName, userEmail);
        } catch(e) {
            console.warn('[Cache] Não foi possível carregar perfil online:', e);
            if (!AppState.userProfile?.full_name) {
                AppState.userProfile = { full_name: userName, email: userEmail };
            }
        }
    } else {
        // Offline: usa dados locais
        console.log('[Cache]  Offline no login — usando dados locais');
        if (!AppState.userProfile?.full_name) {
            AppState.userProfile = { full_name: userName, email: userEmail };
        }
    }

    await initApp();

    // O catálogo já está disponível: restaura a última faixa e sua posição
    // e tenta retomar automaticamente dentro da janela de 12 horas.
    const restored = await restorePlayerSessionWhenReady();
    if (restored) window.refreshHomeInBackground?.();
    checkDeepLink();
});

function showConfirmDialog(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const okBtn = document.getElementById('confirmModalOkBtn');
    
    if (!modal) return;

    // Título é dinâmico por natureza (Excluir conta, Sair, Apagar
    // playlist...) — remove data-i18n para o MutationObserver do i18n.js
    // nunca reverter para "Confirmar" depois de outro texto ser escrito.
    titleEl.removeAttribute('data-i18n');
    titleEl.innerText = title;
    messageEl.innerText = message;
    
    function closeModal() {
        modal.classList.remove('active');
        cancelBtn.removeEventListener('click', cancelHandler);
        okBtn.removeEventListener('click', okHandler);
    }
    
    function cancelHandler() {
        if (onCancel) onCancel();
        closeModal();
    }
    
    function okHandler() {
        if (onConfirm) onConfirm();
        closeModal();
    }
    
    cancelBtn.addEventListener('click', cancelHandler);
    okBtn.addEventListener('click', okHandler);
    
    modal.classList.add('active');
}

window.showConfirmDialog = showConfirmDialog;


window.AppState = AppState;
window.DOM = DOM;
window.playMusicTrack = playMusicTrack;
window.togglePlayMusic = togglePlayMusic;
window.showToast = showToast;
window.handleNextTrack = handleNextTrack;
window.handlePrevTrack = handlePrevTrack;
window.formatTime = formatTime;
window.cacheAudio  = cacheAudio;
window.openCacheDB  = openCacheDB;
window.getCachedAudioUrl = getCachedAudioUrl;
window.isMusicCached = isMusicCached;
window.removeCachedAudio = removeCachedAudio;
window.getAllCachedMusics = getAllCachedMusics;
window.toggleOfflineMusic = toggleOfflineMusic;
window.addToQueue = addToQueue;
window.removeFromQueue = removeFromQueue;
window.clearQueue = clearQueue;
window.calculateTotalMinutesListened = calculateTotalMinutesListened;
window.addToHistory = addToHistory; // expor para outras funções
window.CacheDB = CacheDB;
window.clearAppCache = async () => {
    await CacheDB.clear();
    console.log('[Cache]  Cache apagado');
};
// ── Integração com notificações push ───────────────────────────────────────
// Ouve mensagens do Service Worker e repassa para o sistema de notificações
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data || {};
        if (data.type === 'PUSH_NOTIFICATION') {
            window.FendaNotifications?.addFromPush(data);
        }
        if (data.type === 'NOTIFICATION_CLICK' && data.musicId) {
            const music = AppState.musics.find(m => String(m.id) === String(data.musicId));
            if (music) playMusicTrack(music);
        }
    });
}
