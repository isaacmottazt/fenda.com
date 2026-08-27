(function () {
  'use strict';

  let overlay = null;
  let selectedSource = null;
  let lookupSerial = 0;

  function esc(value) {
    const fn = window.escapeHtml;
    if (typeof fn === 'function') return fn(value ?? '');
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function safeUrl(value) {
    if (typeof window.sanitizeUrl === 'function') return window.sanitizeUrl(value || '') || '';
    try {
      const url = new URL(value || '', window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function show(message, type = 'info') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
  }

  function getUserId() {
    try { return AppState?.userId || null; } catch (_) { return null; }
  }

  function injectStyles() {
    if (document.getElementById('musicRequestStyles')) return;
    const style = document.createElement('style');
    style.id = 'musicRequestStyles';
    style.textContent = `
      .music-request-overlay { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px; background: rgba(4, 8, 18, .78); backdrop-filter: blur(16px); opacity: 0; pointer-events: none; transition: opacity .22s ease; }
      .music-request-overlay.open { opacity: 1; pointer-events: auto; }
      .music-request-modal { width: min(560px, 100%); max-height: min(720px, calc(100vh - 30px)); overflow: auto; padding: 22px; color: #f7f9ff; background: linear-gradient(145deg, #131e34, #0b1222); border: 1px solid rgba(150, 181, 255, .2); border-radius: 24px; box-shadow: 0 30px 90px rgba(0, 0, 0, .45); transform: translateY(12px) scale(.98); transition: transform .24s cubic-bezier(.23,1,.32,1); }
      .music-request-overlay.open .music-request-modal { transform: none; }
      .music-request-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; }
      .music-request-kicker { color: #7ee8e1; font: 800 10px "DM Mono", monospace; letter-spacing: .13em; text-transform: uppercase; }
      .music-request-head h2 { margin-top: 7px; font-size: 24px; letter-spacing: -.05em; }
      .music-request-head p { margin-top: 7px; color: #9eacc5; font-size: 12px; line-height: 1.5; }
      .music-request-close { width: 34px; height: 34px; display: grid; place-items: center; flex: 0 0 auto; color: #b9c7dd; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 11px; }
      .music-request-close:hover { color: #fff; background: rgba(255,255,255,.12); }
      .music-request-form { display: grid; gap: 12px; margin-top: 18px; }
      .music-request-field { display: grid; gap: 6px; }
      .music-request-field label { color: #bac7dc; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .music-request-field input { width: 100%; height: 43px; padding: 0 12px; color: #f7f9ff; background: rgba(255,255,255,.055); border: 1px solid rgba(171,195,235,.15); border-radius: 12px; outline: none; font-size: 13px; }
      .music-request-field input:focus { border-color: rgba(126,232,225,.55); box-shadow: 0 0 0 3px rgba(126,232,225,.08); }
      .music-request-source { display: grid; gap: 8px; margin-top: 2px; }
      .music-request-source-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #7ee8e1; font-size: 11px; font-weight: 800; }
      .music-request-source-state { color: #7787a4; font-size: 10px; font-weight: 600; }
      .music-request-source-result { display: flex; align-items: center; gap: 10px; padding: 9px; color: #eef3ff; background: rgba(255,255,255,.045); border: 1px solid rgba(171,195,235,.12); border-radius: 13px; text-align: left; }
      .music-request-source-result:hover { background: rgba(126,232,225,.08); border-color: rgba(126,232,225,.28); }
      .music-request-source-result img, .music-request-source-art { width: 38px; height: 38px; display: grid; place-items: center; flex: 0 0 auto; object-fit: cover; color: #7ee8e1; background: #1b2c48; border-radius: 9px; }
      .music-request-source-result strong, .music-request-source-result small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .music-request-source-result strong { font-size: 11px; }
      .music-request-source-result small { margin-top: 3px; color: #91a2bd; font-size: 10px; }
      .music-request-note { display: flex; align-items: flex-start; gap: 8px; padding: 11px; color: #9eacc5; background: rgba(126,232,225,.06); border: 1px solid rgba(126,232,225,.13); border-radius: 12px; font-size: 10px; line-height: 1.5; }
      .music-request-note .material-symbols-rounded { color: #7ee8e1; font-size: 16px; }
      .music-request-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 4px; }
      .music-request-actions button { min-height: 40px; padding: 0 14px; border-radius: 11px; font-size: 11px; font-weight: 800; }
      .music-request-cancel { color: #b9c7dd; background: rgba(255,255,255,.05); border: 1px solid rgba(171,195,235,.15); }
      .music-request-submit { color: #07101e; background: linear-gradient(135deg, #7ee8e1, #77a9ff); border: 0; }
      .music-request-submit:disabled { cursor: wait; opacity: .55; }
      .search-request-cta { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; margin-top: 12px; background: linear-gradient(100deg, rgba(126,232,225,.08), rgba(119,169,255,.08)); border: 1px solid rgba(126,232,225,.2); border-radius: 15px; }
      .search-request-cta-copy strong, .search-request-cta-copy small { display: block; }
      .search-request-cta-copy strong { color: #edf3ff; font-size: 12px; }
      .search-request-cta-copy small { margin-top: 4px; color: #91a2bd; font-size: 10px; line-height: 1.4; }
      .search-request-cta button { min-height: 35px; display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; padding: 0 11px; color: #07101e; background: #7ee8e1; border: 0; border-radius: 10px; font-size: 10px; font-weight: 800; }
      @media (max-width: 540px) { .music-request-overlay { align-items: end; padding: 0; } .music-request-modal { max-height: 92vh; padding: 19px 16px 20px; border-bottom: 0; border-radius: 22px 22px 0 0; } .music-request-head h2 { font-size: 21px; } .music-request-actions { flex-direction: column-reverse; } .music-request-actions button { width: 100%; } .search-request-cta { align-items: flex-start; flex-direction: column; } .search-request-cta button { width: 100%; justify-content: center; } }
      @media (prefers-reduced-motion: reduce) { .music-request-overlay, .music-request-modal { transition: none; } }
    `;
    document.head.appendChild(style);
  }

  function renderSourceResults(results, state) {
    const target = document.getElementById('musicRequestSources');
    const stateEl = document.getElementById('musicRequestSourceState');
    if (!target || !stateEl) return;
    if (state === 'loading') {
      stateEl.textContent = 'consultando fontes de metadados…';
      target.innerHTML = '';
      return;
    }
    if (!results.length) {
      stateEl.textContent = 'nenhum metadado encontrado';
      target.innerHTML = '';
      return;
    }
    stateEl.textContent = `${results.length} resultado(s)`;
    target.innerHTML = results.slice(0, 4).map((item, index) => {
      const image = safeUrl(item.image);
      return `<button type="button" class="music-request-source-result" data-source-index="${index}">
        ${image ? `<img src="${esc(image)}" alt="">` : '<span class="music-request-source-art"><span class="material-symbols-rounded">music_note</span></span>'}
        <span><strong>${esc(item.title)}</strong><small>${esc(item.artist)} · ${esc(item.genre || item.source || 'Fonte externa')}</small></span>
      </button>`;
    }).join('');
    target.querySelectorAll('[data-source-index]').forEach(button => {
      button.addEventListener('click', () => {
        const item = results[Number(button.dataset.sourceIndex)];
        if (!item) return;
        selectedSource = item;
        const title = document.getElementById('musicRequestTitle');
        const artist = document.getElementById('musicRequestArtist');
        const genre = document.getElementById('musicRequestGenre');
        if (title) title.value = item.title || title.value;
        if (artist) artist.value = item.artist || artist.value;
        if (genre) genre.value = item.genre || genre.value;
        show('Metadados selecionados. Confira antes de solicitar.', 'success');
      });
    });
  }

  async function lookupExternalTrack(query) {
    const results = [];
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
      const data = await response.json();
      (data.results || []).forEach(item => results.push({
        title: item.trackName || '', artist: item.artistName || '', genre: item.primaryGenreName || '',
        album: item.collectionName || '', image: (item.artworkUrl100 || '').replace('100x100', '600x600'),
        source: 'iTunes', sourceUrl: item.trackViewUrl || '',
      }));
    } catch (_) {}
    if (results.length < 4) {
      try {
        const response = await fetch(`https://api.deezer.com/search/track?q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();
        (data.data || []).forEach(item => results.push({
          title: item.title || '', artist: item.artist?.name || '', genre: item.genre?.name || '',
          album: item.album?.title || '', image: item.album?.cover_big || '',
          source: 'Deezer', sourceUrl: item.link || '',
        }));
      } catch (_) {}
    }
    const unique = new Map();
    results.forEach(item => {
      const key = `${String(item.title).toLowerCase()}::${String(item.artist).toLowerCase()}`;
      if (item.title && item.artist && !unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()];
  }

  function close() {
    lookupSerial += 1;
    if (overlay) overlay.classList.remove('open');
  }

  function open(options = {}) {
    if (!window.supabaseClient || !getUserId()) {
      show('Faça login para solicitar uma música.', 'error');
      return;
    }
    injectStyles();
    selectedSource = null;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'music-request-overlay';
      overlay.innerHTML = `
        <div class="music-request-modal" role="dialog" aria-modal="true" aria-labelledby="musicRequestTitleHeading">
          <div class="music-request-head"><div><div class="music-request-kicker">Solicitação de inclusão</div><h2 id="musicRequestTitleHeading">Não encontrou a música?</h2><p>Envie os dados para análise manual. O áudio só entra no Fenda quando houver um arquivo autorizado.</p></div><button type="button" class="music-request-close" aria-label="Fechar"><span class="material-symbols-rounded">close</span></button></div>
          <form class="music-request-form">
            <div class="music-request-field"><label for="musicRequestTitle">Título da música</label><input id="musicRequestTitle" maxlength="160" required></div>
            <div class="music-request-field"><label for="musicRequestArtist">Artista</label><input id="musicRequestArtist" maxlength="160" placeholder="Ex.: Djavan" required></div>
            <div class="music-request-field"><label for="musicRequestGenre">Gênero ou estilo (opcional)</label><input id="musicRequestGenre" maxlength="100" placeholder="Ex.: MPB, Pop, Adoração"></div>
            <div class="music-request-source"><div class="music-request-source-head"><span>Encontrar metadados</span><span id="musicRequestSourceState" class="music-request-source-state">pronto para pesquisar</span></div><div id="musicRequestSources"></div></div>
            <div class="music-request-note"><span class="material-symbols-rounded">verified_user</span><span>O pedido guarda apenas título, artista e metadados. Não fazemos download automático de áudio de plataformas externas.</span></div>
            <div class="music-request-actions"><button type="button" class="music-request-cancel">Cancelar</button><button type="submit" class="music-request-submit"><span class="material-symbols-rounded">send</span>Enviar solicitação</button></div>
          </form>
        </div>`;
      document.body.appendChild(overlay);
      ['musicRequestTitle', 'musicRequestArtist', 'musicRequestGenre'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => { selectedSource = null; });
      });
      overlay.querySelector('.music-request-close').addEventListener('click', close);
      overlay.querySelector('.music-request-cancel').addEventListener('click', close);
      overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
      overlay.querySelector('form').addEventListener('submit', submit);
    }
    const title = document.getElementById('musicRequestTitle');
    const artist = document.getElementById('musicRequestArtist');
    const genre = document.getElementById('musicRequestGenre');
    const query = String(options.query || '').trim();
    const requestSerial = ++lookupSerial;
    if (title) title.value = options.title || (query && !query.includes(' ') ? query : '');
    if (artist) artist.value = options.artist || '';
    if (genre) genre.value = '';
    document.getElementById('musicRequestSources').innerHTML = '';
    document.getElementById('musicRequestSourceState').textContent = query ? 'consultando fontes…' : 'digite título e artista';
    overlay.classList.add('open');
    if (query) lookupExternalTrack(query).then(results => {
      if (requestSerial !== lookupSerial || !overlay?.classList.contains('open')) return;
      renderSourceResults(results, results.length ? 'ready' : 'empty');
      if (results[0]) {
        selectedSource = results[0];
        if (title && !title.value) title.value = results[0].title || '';
        if (artist && !artist.value) artist.value = results[0].artist || '';
        if (genre && !genre.value) genre.value = results[0].genre || '';
      }
    });
    window.setTimeout(() => title?.focus(), 60);
  }

  async function submit(event) {
    event.preventDefault();
    const title = document.getElementById('musicRequestTitle')?.value.trim();
    const artist = document.getElementById('musicRequestArtist')?.value.trim();
    const genre = document.getElementById('musicRequestGenre')?.value.trim() || null;
    if (!title || !artist) { show('Informe título e artista.', 'error'); return; }
    const userId = getUserId();
    if (!userId) { show('Faça login para enviar.', 'error'); return; }
    const button = overlay.querySelector('.music-request-submit');
    button.disabled = true;
    button.innerHTML = '<span class="material-symbols-rounded">progress_activity</span> Enviando…';
    const payload = {
      requested_by: userId,
      title,
      artist,
      genre,
      album: selectedSource?.album || null,
      search_query: document.getElementById('globalSearchInput')?.value.trim() || `${title} ${artist}`,
      source_provider: selectedSource?.source || null,
      source_url: selectedSource?.sourceUrl || null,
      cover_url: selectedSource?.image || null,
    };
    const { error } = await window.supabaseClient.from('music_requests').insert(payload);
    button.disabled = false;
    button.innerHTML = '<span class="material-symbols-rounded">send</span>Enviar solicitação';
    if (error) {
      if (error.code === '23505') show('Você já solicitou essa música e ela está em análise.', 'info');
      else show('Não foi possível enviar a solicitação agora.', 'error');
      return;
    }
    close();
    show('Solicitação enviada para análise!', 'success');
  }

  window.FendaMusicRequest = { open, close };
})();
