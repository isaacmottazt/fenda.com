// Fenda Music — Service Worker v16
// Correção: fetch handler robusto (stale-while-revalidate),
// install com retry, recuperação de cache corrompido.
const CACHE_NAME = 'fenda-v43';

const PLAYER_ROUTES = new Set(['/player.html', '/player', '/inicio', '/busca', '/biblioteca', '/perfil']);
const LOGIN_ROUTES  = new Set(['/index.html', '/login', '/']);

// Caminhos atualizados após reorganização em pastas /css, /js, /images (v43).
const SHELL = [
  '/player.html', '/index.html', '/reset-password.html', '/manifest.json',
  '/termos.html', '/privacidade.html',
  '/css/base.css', '/css/inicio.css', '/css/busca.css', '/css/biblioteca.css',
  '/css/perfil.css', '/css/login.css', '/css/artist-detail.css', '/css/painel.css',
  '/js/supabase-config.js', '/js/search.js',
  '/js/player-core.js', '/js/player-ui.js', '/js/player-audio-lyrics.js',
  '/js/player-menus-core.js', '/js/player-music-actions.js', '/js/player-playlists.js',
  '/js/player-session.js', '/js/notifications.js', '/css/notifications.css', '/js/inicio-extras.js', '/js/settings.js',
];

// Mensagem de skip waiting (forçar atualização imediata)
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── INSTALL ──────────────────────────────────────────────────────────────────
// Ativa imediatamente (skipWaiting) e cacheia todos os arquivos do SHELL.
// Cada arquivo tem 1 retry após 800ms para absorver falhas de rede transitórias.
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        SHELL.map(url =>
          cache.add(url).catch(() =>
            // Retry único após 800ms
            new Promise(r => setTimeout(r, 800))
              .then(() => cache.add(url).catch(() => {}))
          )
        )
      )
    )
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
// Apaga TODOS os caches antigos e reivindica todos os clientes abertos.
// Isso garante que abas já abertas também recebam o novo SW imediatamente.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => {
            console.log('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          })
        )
      )
      .then(() => {
        console.log('[SW] Ativo:', CACHE_NAME);
        return self.clients.claim();
      })
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const path = url.pathname;

  // 1. Supabase: sempre rede direta (dados em tempo real)
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('[]', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // 2. CDN externo (jsdelivr, Google Fonts, gstatic): cache-first
  if (
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          if (r.ok) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
          }
          return r;
        });
      })
    );
    return;
  }

  // 3. Rotas do player (URLs limpas) → serve player.html
  //    STALE-WHILE-REVALIDATE, igual ao resto do site (seção 5) — não
  //    mais cache-first absoluto. O bug anterior aqui era grave: mesmo
  //    incrementando CACHE_NAME (que força um SW novo a instalar), se
  //    esse SW novo não tivesse ainda assumido o controle da aba no
  //    exato momento da navegação, essa rota continuava servindo o
  //    player.html do cache ANTIGO pra sempre, sem nunca checar a rede
  //    — dando a impressão de que atualizações "não pegavam", mesmo
  //    com o zip novo corretamente extraído no dispositivo.
  if (url.origin === self.location.origin && PLAYER_ROUTES.has(path)) {
    e.respondWith(
      caches.match('/player.html').then(cached => {
        const networkFetch = fetch('/player.html')
          .then(response => {
            if (response.ok) {
              caches.open(CACHE_NAME).then(c => c.put('/player.html', response.clone())).catch(() => {});
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          networkFetch.catch(() => {}); // atualiza em background, fire-and-forget
          return cached;
        }
        return networkFetch.then(r => r || new Response('Service Unavailable', { status: 503 }));
      })
    );
    return;
  }

  // 4. Rotas de login → serve index.html (mesmo tratamento de 3)
  if (url.origin === self.location.origin && LOGIN_ROUTES.has(path)) {
    e.respondWith(
      caches.match('/index.html').then(cached => {
        const networkFetch = fetch('/index.html')
          .then(response => {
            if (response.ok) {
              caches.open(CACHE_NAME).then(c => c.put('/index.html', response.clone())).catch(() => {});
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          networkFetch.catch(() => {});
          return cached;
        }
        return networkFetch.then(r => r || new Response('Service Unavailable', { status: 503 }));
      })
    );
    return;
  }

  // 5. Demais arquivos do próprio domínio: STALE-WHILE-REVALIDATE
  //    → Serve do cache IMEDIATAMENTE se disponível (zero delay)
  //    → Atualiza o cache em background com a versão da rede
  //    → Se não estiver em cache, busca na rede e cacheia
  //    → Nunca retorna undefined/null — fallback garante resposta válida
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request)
          .then(response => {
            if (response.ok) {
              // Atualiza cache em background (não bloqueia a resposta)
              caches.open(CACHE_NAME)
                .then(c => c.put(e.request, response.clone()))
                .catch(() => {});
            }
            return response;
          })
          .catch(err => {
            // Rede falhou: se tem cache, não é problema
            if (cached) return null; // será descartado abaixo
            // Sem cache e sem rede: retorna 503
            return new Response('Service Unavailable', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });

        if (cached) {
          // Serve do cache agora, atualiza em background
          networkFetch.catch(() => {}); // fire-and-forget
          return cached;
        }

        // Não está em cache: aguarda a rede
        return networkFetch;
      })
    );
    return;
  }

  // 6. Qualquer outra requisição: rede direta
  e.respondWith(fetch(e.request));
});

// ── PERIODIC BACKGROUND SYNC ─────────────────────────────────────────────────
// Sincroniza novos lançamentos e dados do usuário em segundo plano.
// O browser dispara isso automaticamente no intervalo registrado pelo cliente
// (mínimo definido no registro — normalmente 24h).
// Requer permissão de "Periodic Background Sync" (Android Chrome/Edge).
self.addEventListener('periodicsync', event => {
    if (event.tag === 'fenda-sync-catalog') {
        // Verifica novos lançamentos e atualiza o cache
        event.waitUntil(syncCatalog());
    }
    if (event.tag === 'fenda-sync-user') {
        // Sincroniza favoritos e playlists em background
        event.waitUntil(syncUserData());
    }
});

async function syncCatalog() {
    try {
        console.log('[SW] Sincronizando catálogo em background...');
        // Recarrega o app shell para pegar atualizações de CSS/JS
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
            SHELL.map(url => fetch(url, { cache: 'no-cache' })
                .then(r => { if (r.ok) cache.put(url, r); })
                .catch(() => {})
            )
        );
        console.log('[SW] Catálogo sincronizado');
    } catch (e) {
        console.warn('[SW] Erro na sync de catálogo:', e);
    }
}

async function syncUserData() {
    try {
        console.log('[SW] Sincronizando dados do usuário em background...');
        // Notifica o cliente para sincronizar com o Supabase
        const allClients = await self.clients.matchAll({ type: 'window' });
        allClients.forEach(client => {
            client.postMessage({ type: 'BACKGROUND_SYNC', payload: 'user-data' });
        });
    } catch (e) {
        console.warn('[SW] Erro na sync de usuário:', e);
    }
}

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
// Recebe notificações push do servidor (Supabase Edge Functions ou similar).
// Para ativar: gere chaves VAPID com `npx web-push generate-vapid-keys`
// e configure o envio pelo seu backend.
self.addEventListener('push', event => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: 'Fenda Music', body: event.data.text() };
    }

    const title   = payload.title || 'Fenda Music';
    const options = {
        body:    payload.body    || 'Você tem uma nova notificação',
        icon:    payload.icon    || '/images/icons/icon-192.png',
        badge:   payload.badge   || '/images/icons/icon-96.png',
        image:   payload.image   || undefined,
        tag:     payload.tag     || 'fenda-notification',
        data: {
            url:    payload.url    || '/inicio',
            musicId: payload.musicId || null,
        },
        actions: payload.actions || [
            { action: 'open',    title: 'Abrir' },
            { action: 'dismiss', title: 'Dispensar' },
        ],
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
    };

    event.waitUntil(
        Promise.all([
            self.registration.showNotification(title, options),
            // Envia para todos os clientes abertos adicionarem na lista
            self.clients.matchAll({ type: 'window' }).then(clients =>
                clients.forEach(c => c.postMessage({
                    type: 'PUSH_NOTIFICATION',
                    title,
                    body:    options.body,
                    image:   options.image,
                    musicId: payload.musicId || null,
                }))
            )
        ])
    );
});

// Trata clique na notificação
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const targetUrl = event.notification.data?.url || '/inicio';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                // Se o app já está aberto, foca nele e navega
                for (const client of clients) {
                    if (client.url.includes('fendamusic.com.br') && 'focus' in client) {
                        client.focus();
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            url: targetUrl,
                            musicId: event.notification.data?.musicId,
                        });
                        return;
                    }
                }
                // Senão, abre uma nova janela
                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl);
                }
            })
    );
});

// Notificação fechada (analytics/tracking se necessário)
self.addEventListener('notificationclose', event => {
    console.log('[SW] Notificação fechada:', event.notification.tag);
});
