// ===== ABA BUSCAR — REDESIGN PREMIUM =====

let searchInput = null;
let recentSearches = [];

function syncSearchStartHint() {
    const hint = document.getElementById('searchStartHint');
    if (!hint) return;
    const hasRecent = recentSearches.length > 0;
    const artistsList = document.getElementById('featuredArtistsList');
    const artistsSection = document.getElementById('featuredArtistsSection');
    const hasFeaturedArtists = !!(artistsList?.children.length && artistsSection?.style.display !== 'none');
    hint.classList.toggle('is-visible', !hasRecent && !hasFeaturedArtists);
}

function initSearch() {
    searchInput = document.getElementById('globalSearchInput');
    if (!searchInput) return;

    const clearBtn    = document.getElementById('searchClearBtn');
    const backBtn     = document.getElementById('searchBackBtn');
    const clearAllBtn = document.getElementById('clearRecentSearchesBtn');

    searchInput.addEventListener('input', debounce(() => {
        const hasValue = searchInput.value.trim().length > 0;
        if (clearBtn) clearBtn.style.display = hasValue ? 'flex' : 'none';
        if (backBtn)  backBtn.style.display  = hasValue ? 'flex' : 'none';
        handleSearch();
    }, 250));

    searchInput.addEventListener('keypress', async (e) => {
        if (e.key !== 'Enter') return;
        const query = searchInput.value.trim().toLowerCase();
        if (query && AppState.userId) {
            await window.addToSearchHistory(AppState.userId, query);
            recentSearches = await window.loadSearchHistory(AppState.userId, 8);
            renderRecentSearches();
        }
    });

    if (clearBtn) clearBtn.addEventListener('click', resetSearch);
    if (backBtn)  backBtn.addEventListener('click', resetSearch);
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllRecentSearches);

    if (AppState.userId) {
        window.loadSearchHistory(AppState.userId, 8).then(terms => {
            recentSearches = terms;
            renderRecentSearches();
        });
    }

    renderFeaturedArtists();
    renderRecentSearches();
}

function resetSearch() {
    if (!searchInput) return;
    searchInput.value = '';
    const clearBtn = document.getElementById('searchClearBtn');
    const backBtn  = document.getElementById('searchBackBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    if (backBtn)  backBtn.style.display  = 'none';
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchDefaultView').style.display = 'block';
    searchInput.blur();
}

async function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('searchDefaultView').style.display = 'block';
        return;
    }

    document.getElementById('searchDefaultView').style.display = 'none';
    document.getElementById('searchResults').style.display = 'block';

    const musicResults = AppState.musics.filter(m =>
        m.title.toLowerCase().includes(query) ||
        m.artist.toLowerCase().includes(query)
    );

    let tableArtists = [];
    if (typeof window.searchArtists === 'function') {
        tableArtists = await window.searchArtists(query);
    }

    const artistSet = new Set(musicResults.map(m => m.artist));
    tableArtists.forEach(a => artistSet.delete(a.name));
    const musicArtists = [...artistSet].map(name => ({ id: null, name, image_url: null }));
    const allArtists = [...tableArtists, ...musicArtists];

    let html = '';

    // Artistas — row de pills compactos
    if (allArtists.length) {
        html += `
        <div class="search-results-section">
            <h3>Artistas</h3>
            <div class="search-artists-results-row">
                ${allArtists.map(a => `
                    <div class="search-artist-result-pill" data-type="artist" data-artist-name="${escapeHtml(a.name)}">
                        <div class="search-artist-result-pill-avatar">
                            ${a.image_url
                                ? `<img src="${a.image_url}" loading="lazy" onerror="this.remove()">`
                                : ''}
                            <span class="material-symbols-rounded">person</span>
                        </div>
                        <span class="search-artist-result-pill-name">${escapeHtml(a.name)}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // Músicas — lista de cards ricos
    if (musicResults.length) {
        html += `<div class="search-results-section"><h3>Músicas</h3>`;
        html += musicResults.map(m => {
            const isCurrent = AppState.currentMusicId === m.id;
            return `
            <div class="search-result-item${isCurrent ? ' is-playing' : ''}" data-type="music" data-id="${m.id}">
                <div class="result-icon">
                    ${m.cover ? `<img src="${typeof sanitizeUrl === 'function' ? sanitizeUrl(m.cover) : (m.cover || '')}" loading="lazy" onerror="this.remove()">` : ''}
                    <span class="material-symbols-rounded">music_note</span>
                </div>
                <div class="result-info">
                    <div class="result-title">${escapeHtml(m.title)}</div>
                    <div class="result-subtitle">
                        <span class="result-badge">Música</span>
                        ${escapeHtml(m.artist)}
                    </div>
                </div>
                <button class="result-more-btn" data-id="${m.id}">
                    <span class="material-symbols-rounded">more_vert</span>
                </button>
            </div>`;
        }).join('');
        html += `</div>`;
    }

    if (!html) {
        html = `
            <div class="search-empty">
                <span class="material-symbols-rounded">search_off</span>
                <p>Nenhum resultado</p>
                <span>Tente buscar por outro nome ou artista</span>
            </div>`;
    }

    const resultsEl = document.getElementById('searchResults');
    resultsEl.innerHTML = html;

    // Clique em músicas
    resultsEl.querySelectorAll('[data-type="music"]').forEach(el => {
        const id = parseInt(el.dataset.id);
        const music = AppState.musics.find(m => m.id === id);
        if (!music) return;
        el.addEventListener('click', (e) => {
            if (e.target.closest('.result-more-btn')) return;
            if (typeof window.setPlayContext === 'function')
                window.setPlayContext('search', musicResults);
            playMusicTrack(music);
            // Atualiza estado de playing inline
            resultsEl.querySelectorAll('.search-result-item').forEach(r => r.classList.remove('is-playing'));
            el.classList.add('is-playing');
            el.querySelector('.result-title').style.color = '#b07fff';
        });
        el.querySelector('.result-more-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.openContextMenu === 'function') window.openContextMenu(music);
        });
    });

    // Clique em artistas (pills)
    resultsEl.querySelectorAll('[data-type="artist"]').forEach(el => {
        const name = el.dataset.artistName;
        el.addEventListener('click', () => {
            if (typeof window.openArtistDetail === 'function') {
                window.openArtistDetail(name);
            } else {
                const artistMusics = AppState.musics.filter(m => m.artist === name);
                if (artistMusics.length) {
                    if (typeof window.setPlayContext === 'function')
                        window.setPlayContext('search', artistMusics);
                    playMusicTrack(artistMusics[0]);
                } else showToast('Nenhuma música de ' + name, 'danger');
            }
        });
    });
}

function renderRecentSearches() {
    const container = document.getElementById('recentSearchesList');
    const section   = document.getElementById('recentSearchesSection');
    if (!container) return;

    if (!recentSearches.length) {
        if (section) section.style.display = 'none';
        syncSearchStartHint();
        return;
    }
    if (section) section.style.display = 'block';

    container.innerHTML = recentSearches.map(term => `
        <div class="recent-item" data-term="${escapeHtml(term)}">
            <div class="recent-item-icon">
                <span class="material-symbols-rounded">history</span>
            </div>
            <div class="recent-info">
                <span class="recent-text">${escapeHtml(term)}</span>
            </div>
            <button class="remove-search" data-term="${escapeHtml(term)}">
                <span class="material-symbols-rounded">close</span>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.remove-search')) return;
            searchInput.value = item.dataset.term;
            searchInput.dispatchEvent(new Event('input'));
        });
        item.querySelector('.remove-search')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            recentSearches = recentSearches.filter(t => t !== item.dataset.term);
            renderRecentSearches();
        });
    });
    syncSearchStartHint();
}

async function clearAllRecentSearches() {
    if (AppState.userId) await window.clearSearchHistory(AppState.userId);
    recentSearches = [];
    renderRecentSearches();
}

function renderFeaturedArtists() {
    const container = document.getElementById('featuredArtistsList');
    const section   = document.getElementById('featuredArtistsSection');
    if (!container) return;

    const artistMap = new Map();
    AppState.musics.forEach(m => {
        if (!artistMap.has(m.artist)) artistMap.set(m.artist, m.cover || '');
    });

    const artists = [...artistMap.entries()].slice(0, 12);
    if (!artists.length) {
        if (section) section.style.display = 'none';
        syncSearchStartHint();
        return;
    }
    if (section) section.style.display = 'block';

    container.innerHTML = artists.map(([name, cover]) => `
        <div class="search-artist-card" data-artist="${escapeHtml(name)}">
            <div class="search-artist-avatar">
                ${cover
                    ? `<img src="${typeof sanitizeUrl === 'function' ? sanitizeUrl(cover) : (cover || '')}" alt="${escapeHtml(name)}" loading="lazy">`
                    : `<span class="material-symbols-rounded">person</span>`}
            </div>
            <span class="search-artist-name">${escapeHtml(name)}</span>
        </div>
    `).join('');

    container.querySelectorAll('.search-artist-card').forEach(card => {
        card.addEventListener('click', () => {
            if (typeof window.openArtistDetail === 'function') {
                window.openArtistDetail(card.dataset.artist);
            } else {
                searchInput.value = card.dataset.artist;
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    });
    syncSearchStartHint();
}

function makeAvatar(src, fallbackIcon) {
    if (!src) return `<span class="material-symbols-rounded">${fallbackIcon}</span>`;
    return `<span class="material-symbols-rounded">${fallbackIcon}</span><img src="${src}" loading="lazy" onerror="this.remove()">`;
}

function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// escapeHtml é definida em player-ui.js que carrega antes
// Fallback para uso isolado:
if (typeof window.escapeHtml === 'undefined') {
    window.escapeHtml = function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    };
}
// Alias local
const _escHtml = typeof escapeHtml !== 'undefined' ? escapeHtml : window.escapeHtml;

window.initSearch = initSearch;
window.renderRecentSearches = renderRecentSearches;
window.renderFeaturedArtists = renderFeaturedArtists;
