(function () {
  'use strict';

  const DESIGN_KEY = 'fenda-design';
  const VALID_DESIGNS = new Set(['classic', 'admin']);
  const DESIGN_META = {
    classic: { label: 'Fenda atual', shortLabel: 'Visual atual' },
    admin: { label: 'Workspace Admin', shortLabel: 'Visual Admin' },
  };
  const TAB_META = {
    inicio: { label: 'Início', icon: 'space_dashboard', hint: 'Visão geral do Fenda' },
    buscar: { label: 'Buscar', icon: 'search', hint: 'Encontre músicas e artistas' },
    biblioteca: { label: 'Biblioteca', icon: 'library_music', hint: 'Playlists, curtidas e downloads' },
    perfil: { label: 'Perfil', icon: 'person', hint: 'Sua conta e preferências' },
  };

  const root = document.documentElement;
  let current = readSavedDesign();
  let paletteItems = [];

  function readSavedDesign() {
    try {
      const saved = localStorage.getItem(DESIGN_KEY);
      return VALID_DESIGNS.has(saved) ? saved : 'classic';
    } catch (_) {
      return 'classic';
    }
  }

  function applyDesign(design, persist = true) {
    current = VALID_DESIGNS.has(design) ? design : 'classic';
    root.dataset.fendaDesign = current;
    root.classList.toggle('fenda-admin-theme', current === 'admin');
    if (persist) {
      try { localStorage.setItem(DESIGN_KEY, current); } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent('fenda:designChanged', { detail: { design: current } }));
    window.requestAnimationFrame(() => {
      syncActiveTab();
      syncDesignButtons();
    });
  }

  function getDesign() { return current; }

  function setDesign(design) {
    applyDesign(design, true);
    return current;
  }

  function isEditing() {
    const active = document.activeElement;
    if (!active) return false;
    return ['input', 'textarea', 'select'].includes(active.tagName.toLowerCase()) || active.isContentEditable;
  }

  function activateTab(tabId) {
    const button = document.querySelector(`.nav-bar .nav-btn[data-tab="${CSS.escape(tabId)}"]`);
    if (button) button.click();
    else document.querySelector(`.admin-rail-link[data-tab="${CSS.escape(tabId)}"]`)?.classList.add('active');
  }

  function openSearch() {
    activateTab('buscar');
    window.setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 60);
  }

  function openSettings() {
    if (window.FendaSettings?.open) window.FendaSettings.open();
    else document.getElementById('settingsNavBtn')?.click();
  }

  function toggleDesign() {
    setDesign(current === 'admin' ? 'classic' : 'admin');
  }

  function syncActiveTab() {
    const active = document.querySelector('.nav-bar .nav-btn.active')?.dataset.tab || 'inicio';
    document.querySelectorAll('.admin-rail-link').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === active);
      button.setAttribute('aria-current', button.dataset.tab === active ? 'page' : 'false');
    });
    const meta = TAB_META[active] || TAB_META.inicio;
    const title = document.getElementById('adminDesignTopbarTitle');
    const hint = document.getElementById('adminDesignTopbarHint');
    if (title) title.textContent = meta.label;
    if (hint) hint.textContent = meta.hint;
  }

  function syncDesignButtons() {
    const selected = getDesign();
    document.querySelectorAll('[data-design-option]').forEach((button) => {
      const isSelected = button.dataset.designOption === selected;
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }

  function commandItems() {
    return [
      ...Object.entries(TAB_META).map(([tab, meta], index) => ({
        id: `tab-${tab}`, type: 'tab', tab, icon: meta.icon, title: meta.label, meta: meta.hint, key: String(index + 1),
      })),
      { id: 'settings', type: 'settings', icon: 'settings', title: 'Abrir configurações', meta: 'Conta, visual, reprodução e acessibilidade', key: 'S' },
      { id: 'design', type: 'design', icon: 'palette', title: current === 'admin' ? 'Usar visual atual' : 'Usar visual Admin', meta: 'Alternar a organização e a paleta do app', key: 'V' },
    ];
  }

  function renderPalette(query = '') {
    const container = document.getElementById('fendaCommandResults');
    if (!container) return;
    const normalized = String(query || '').trim().toLowerCase();
    paletteItems = commandItems().filter((item) => !normalized || `${item.title} ${item.meta}`.toLowerCase().includes(normalized));
    container.innerHTML = paletteItems.length ? paletteItems.map((item, index) => `
      <button type="button" class="fenda-command-item${index === 0 ? ' selected' : ''}" data-command-index="${index}">
        <span class="material-symbols-rounded">${item.icon}</span>
        <span class="fenda-command-copy"><strong>${item.title}</strong><small>${item.meta}</small></span>
        <kbd>${item.key}</kbd>
      </button>`).join('') : '<div class="fenda-command-empty">Nenhum atalho encontrado.</div>';
    container.querySelectorAll('.fenda-command-item').forEach((button) => {
      button.addEventListener('click', () => executeCommand(Number(button.dataset.commandIndex)));
    });
  }

  function executeCommand(index) {
    const item = paletteItems[index];
    if (!item) return;
    closePalette();
    if (item.type === 'tab') activateTab(item.tab);
    if (item.type === 'settings') openSettings();
    if (item.type === 'design') toggleDesign();
  }

  function openPalette() {
    const palette = document.getElementById('fendaCommandPalette');
    const input = document.getElementById('fendaCommandInput');
    if (!palette || !input) return;
    palette.hidden = false;
    palette.setAttribute('aria-hidden', 'false');
    input.value = '';
    renderPalette('');
    window.setTimeout(() => input.focus(), 0);
  }

  function closePalette() {
    const palette = document.getElementById('fendaCommandPalette');
    if (!palette) return;
    palette.hidden = true;
    palette.setAttribute('aria-hidden', 'true');
  }

  function buildChrome() {
    const app = document.querySelector('.app-container');
    if (!app || document.querySelector('.admin-design-rail')) return;

    const rail = document.createElement('aside');
    rail.className = 'admin-design-rail';
    rail.setAttribute('aria-label', 'Navegação do visual Admin');
    rail.innerHTML = `
      <div class="admin-rail-brand">
        <span class="admin-rail-mark"><span class="material-symbols-rounded">graphic_eq</span></span>
        <span class="admin-rail-brand-copy"><strong>Fenda</strong><small>Music workspace</small></span>
      </div>
      <div class="admin-rail-label">Workspace</div>
      <nav class="admin-rail-nav">
        ${Object.entries(TAB_META).map(([tab, meta]) => `<button type="button" class="admin-rail-link" data-tab="${tab}"><span class="material-symbols-rounded">${meta.icon}</span><span>${meta.label}</span><kbd>${tab === 'inicio' ? '1' : tab === 'buscar' ? '2' : tab === 'biblioteca' ? '3' : '4'}</kbd></button>`).join('')}
      </nav>
      <div class="admin-rail-divider"></div>
      <button type="button" class="admin-rail-command" id="adminDesignSearchBtn"><span class="material-symbols-rounded">search</span><span>Busca global</span><kbd>⌘K</kbd></button>
      <button type="button" class="admin-rail-command" id="adminDesignSettingsBtn"><span class="material-symbols-rounded">settings</span><span>Configurações</span></button>
      <div class="admin-rail-footer"><span class="admin-rail-status-dot"></span><span>Modo Admin ativo</span></div>`;
    app.prepend(rail);

    const topbar = document.createElement('header');
    topbar.className = 'admin-design-topbar';
    topbar.innerHTML = `
      <div class="admin-design-breadcrumb"><small id="adminDesignTopbarHint">Visão geral do Fenda</small><strong id="adminDesignTopbarTitle">Início</strong></div>
      <div class="admin-design-topbar-actions">
        <button type="button" class="admin-design-topbar-search" id="adminDesignTopSearch"><span class="material-symbols-rounded">search</span><span>Buscar no Fenda</span><kbd>⌘K</kbd></button>
        <button type="button" class="admin-design-topbar-icon" id="adminDesignTopSettings" aria-label="Abrir configurações"><span class="material-symbols-rounded">settings</span></button>
      </div>`;
    app.insertBefore(topbar, app.querySelector('.main-content'));

    const palette = document.createElement('div');
    palette.id = 'fendaCommandPalette';
    palette.className = 'fenda-command-palette';
    palette.hidden = true;
    palette.setAttribute('aria-hidden', 'true');
    palette.innerHTML = `
      <div class="fenda-command-dialog" role="dialog" aria-modal="true" aria-labelledby="fendaCommandTitle">
        <div class="fenda-command-head"><div><span class="fenda-command-eyebrow">FENDA MUSIC</span><h2 id="fendaCommandTitle">Atalhos rápidos</h2></div><button type="button" class="fenda-command-close" id="fendaCommandClose" aria-label="Fechar atalhos"><span class="material-symbols-rounded">close</span></button></div>
        <label class="fenda-command-search"><span class="material-symbols-rounded">search</span><input id="fendaCommandInput" type="search" autocomplete="off" placeholder="Buscar uma seção ou ação…"><kbd>Esc</kbd></label>
        <div id="fendaCommandResults" class="fenda-command-results"></div>
        <p class="fenda-command-footer"><span><kbd>1</kbd>–<kbd>4</kbd> navegar</span><span><kbd>⌘</kbd><kbd>K</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></p>
      </div>`;
    document.body.appendChild(palette);

    rail.querySelectorAll('.admin-rail-link').forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tab)));
    rail.querySelector('#adminDesignSearchBtn')?.addEventListener('click', openPalette);
    rail.querySelector('#adminDesignSettingsBtn')?.addEventListener('click', openSettings);
    topbar.querySelector('#adminDesignTopSearch')?.addEventListener('click', openPalette);
    topbar.querySelector('#adminDesignTopSettings')?.addEventListener('click', openSettings);
    palette.querySelector('#fendaCommandClose')?.addEventListener('click', closePalette);
    palette.addEventListener('click', (event) => { if (event.target === palette) closePalette(); });
    palette.querySelector('#fendaCommandInput')?.addEventListener('input', (event) => renderPalette(event.target.value));
    document.querySelectorAll('.nav-bar .nav-btn').forEach((button) => button.addEventListener('click', syncActiveTab));

    const observer = new MutationObserver(syncActiveTab);
    document.querySelector('.nav-bar') && observer.observe(document.querySelector('.nav-bar'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    syncActiveTab();
  }

  function init() {
    applyDesign(current, false);
    buildChrome();
    syncDesignButtons();

    document.addEventListener('click', (event) => {
      const themeButton = event.target.closest('[data-design-option]');
      if (themeButton) setDesign(themeButton.dataset.designOption);
    });

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const palette = document.getElementById('fendaCommandPalette');
        if (palette?.hidden) openPalette(); else closePalette();
        return;
      }
      const palette = document.getElementById('fendaCommandPalette');
      if (palette && !palette.hidden) {
        if (event.key === 'Escape') closePalette();
        if (event.key === 'Enter') {
          const selected = palette.querySelector('.fenda-command-item.selected');
          if (selected) executeCommand(Number(selected.dataset.commandIndex));
        }
        return;
      }
      if (isEditing() || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === '/') { event.preventDefault(); openSearch(); return; }
      const shortcuts = { '1': 'inicio', '2': 'buscar', '3': 'biblioteca', '4': 'perfil' };
      if (shortcuts[event.key]) { event.preventDefault(); activateTab(shortcuts[event.key]); }
    });

    document.addEventListener('fenda:designChanged', syncDesignButtons);
  }

  applyDesign(current, false);
  window.FendaDesign = { get: getDesign, set: setDesign, toggle: toggleDesign, openPalette, closePalette, openSearch, openSettings, options: DESIGN_META };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
