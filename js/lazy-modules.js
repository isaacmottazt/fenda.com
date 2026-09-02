// Fenda Music — carregamento sob demanda de áreas secundárias.
(function () {
  'use strict';

  const modulePromises = new Map();
  const MODULES = {
    library: {
      styles: ['/css/biblioteca.css?v=lazy-v1'],
      scripts: ['/js/player-playlists.js?v=offline-downloads-v1'],
      afterLoad() {
        window.setupPlaylistModal?.();
        window.setupPlaylistDetailEvents?.();
      }
    },
    podcasts: {
      styles: ['/css/podcasts.css?v=lazy-v1'],
      scripts: ['/js/podcasts.js?v=lazy-v1']
    },
    settings: {
      styles: [],
      scripts: ['/js/settings.js?v=design-switch-v2']
    }
  };

  function loadAsset(url, type) {
    const selector = type === 'css' ? `link[href="${url}"]` : `script[src="${url}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      return existing.dataset.loaded === '1'
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${url}`)), { once: true });
          });
    }

    return new Promise((resolve, reject) => {
      const element = document.createElement(type === 'css' ? 'link' : 'script');
      if (type === 'css') {
        element.rel = 'stylesheet';
        element.href = url;
      } else {
        element.src = url;
        element.async = true;
      }
      element.addEventListener('load', () => { element.dataset.loaded = '1'; resolve(); }, { once: true });
      element.addEventListener('error', () => reject(new Error(`Falha ao carregar ${url}`)), { once: true });
      document.head.appendChild(element);
    });
  }

  function loadAppModule(name) {
    if (modulePromises.has(name)) return modulePromises.get(name);
    const config = MODULES[name];
    if (!config) return Promise.reject(new Error(`Módulo desconhecido: ${name}`));

    const promise = Promise.all([
      ...config.styles.map(url => loadAsset(url, 'css')),
      ...config.scripts.map(url => loadAsset(url, 'js'))
    ]).then(() => config.afterLoad?.());
    modulePromises.set(name, promise);
    return promise;
  }

  window.loadAppModule = loadAppModule;
  window.openLazySettings = () => loadAppModule('settings').then(() => window.FendaSettings?.open?.());
})();
