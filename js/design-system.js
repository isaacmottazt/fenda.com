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

  function readSavedDesign() {
    try {
      const saved = localStorage.getItem(DESIGN_KEY);
      return VALID_DESIGNS.has(saved) ? saved : 'classic';
    } catch (_) {
      return 'classic';
    }
  }

  function syncLegacyTheme() {
    const themes = window.fendaThemes;
    if (!themes) return;
    if (current === 'admin' && typeof themes.applyAdmin === 'function') {
      themes.applyAdmin();
      return;
    }
    if (typeof themes.apply === 'function') themes.apply(themes.savedColor, themes.savedMode);
  }

  function applyDesign(design, persist = true) {
    current = VALID_DESIGNS.has(design) ? design : 'classic';
    root.dataset.fendaDesign = current;
    root.classList.toggle('fenda-admin-theme', current === 'admin');
    if (persist) {
      try { localStorage.setItem(DESIGN_KEY, current); } catch (_) {}
    }
    syncLegacyTheme();
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

  function activateTab(tabId) {
    const button = document.querySelector(`.nav-bar .nav-btn[data-tab="${tabId}"]`);
    if (button) button.click();
  }

  function openSearch() {
    activateTab('buscar');
    window.setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 60);
  }

  function openSettings() {
    if (window.FendaSettings?.open) window.FendaSettings.open();
    else document.getElementById('settingsNavBtn')?.click();
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
    document.querySelectorAll('[data-design-option]').forEach((button) => {
      const active = button.dataset.designOption === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
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
        ${Object.entries(TAB_META).map(([tab, meta]) => `<button type="button" class="admin-rail-link" data-tab="${tab}"><span class="material-symbols-rounded">${meta.icon}</span><span>${meta.label}</span></button>`).join('')}
      </nav>
      <div class="admin-rail-divider"></div>
      <button type="button" class="admin-rail-utility" id="adminDesignSearchBtn"><span class="material-symbols-rounded">search</span><span>Buscar</span></button>
      <button type="button" class="admin-rail-utility" id="adminDesignSettingsBtn"><span class="material-symbols-rounded">settings</span><span>Configurações</span></button>
      <div class="admin-rail-footer"><span class="admin-rail-status-dot"></span><span>Workspace ativo</span></div>`;
    app.prepend(rail);

    const topbar = document.createElement('header');
    topbar.className = 'admin-design-topbar';
    topbar.innerHTML = `
      <div class="admin-design-breadcrumb"><small id="adminDesignTopbarHint">Visão geral do Fenda</small><strong id="adminDesignTopbarTitle">Início</strong></div>
      <div class="admin-design-topbar-actions">
        <button type="button" class="admin-design-topbar-search" id="adminDesignTopSearch"><span class="material-symbols-rounded">search</span><span>Buscar no Fenda</span></button>
        <button type="button" class="admin-design-topbar-icon" id="adminDesignTopSettings" aria-label="Abrir configurações"><span class="material-symbols-rounded">settings</span></button>
      </div>`;
    app.insertBefore(topbar, app.querySelector('.main-content'));

    rail.querySelectorAll('.admin-rail-link').forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tab)));
    rail.querySelector('#adminDesignSearchBtn')?.addEventListener('click', openSearch);
    rail.querySelector('#adminDesignSettingsBtn')?.addEventListener('click', openSettings);
    topbar.querySelector('#adminDesignTopSearch')?.addEventListener('click', openSearch);
    topbar.querySelector('#adminDesignTopSettings')?.addEventListener('click', openSettings);
    document.querySelectorAll('.nav-bar .nav-btn').forEach((button) => button.addEventListener('click', syncActiveTab));

    const navBar = document.querySelector('.nav-bar');
    if (navBar) new MutationObserver(syncActiveTab).observe(navBar, { subtree: true, attributes: true, attributeFilter: ['class'] });
    syncActiveTab();
  }

  function init() {
    applyDesign(current, false);
    buildChrome();
    syncDesignButtons();
    document.addEventListener('fenda:designChanged', syncDesignButtons);
  }

  applyDesign(current, false);
  window.FendaDesign = {
    get: getDesign,
    set: setDesign,
    openSearch,
    openSettings,
    options: DESIGN_META,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
