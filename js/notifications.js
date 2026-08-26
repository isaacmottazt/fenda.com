/* ============================================================
   FENDA MUSIC — NOTIFICATIONS (notifications.js)
   Gerencia notificações locais geradas pelo app e notificações
   push recebidas pelo Service Worker.

   Armazenamento: localStorage 'fenda_notifications'
   Cada notificação: { id, type, title, body, image, icon,
                       iconBg, time, read, musicId }
   ============================================================ */

const FendaNotifications = (() => {
    'use strict';

    const KEY = 'fenda_notifications';
    const MAX = 100; // máximo de notificações guardadas

    // ── Tipos e visual ──────────────────────────────────────────
    const TYPE_META = {
        recommendation: { icon: 'recommend',             bg: '#7c3aed' },
        achievement:    { icon: 'emoji_events',          bg: '#f59e0b' },
        release:        { icon: 'new_releases',          bg: '#059669' },
        social:         { icon: 'favorite',              bg: '#ec4899' },
        playlist:       { icon: 'queue_music',           bg: '#6d28d9' },
        admin:          { icon: 'campaign',              bg: '#7c3aed' },
        system:         { icon: 'notifications',         bg: '#475569' },
        fire:           { icon: 'local_fire_department', bg: '#ea580c' },
        trending:       { icon: 'trending_up',           bg: '#7c3aed' },
    };

    // ── Storage ─────────────────────────────────────────────────
    function getAll() {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
    }

    function save(list) {
        localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    }

    function add(notif) {
        const meta = TYPE_META[notif.type] || TYPE_META.system;
        const entry = {
            id:     `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            type:   notif.type  || 'system',
            title:  notif.title || '',
            body:   notif.body  || '',
            image:  notif.image || null,
            icon:   notif.icon  || meta.icon,
            iconBg: notif.iconBg || meta.bg,
            time:   Date.now(),
            read:   false,
            musicId: notif.musicId || null,
            adminNotificationId: notif.adminNotificationId || null,
        };
        const all = getAll();
        // Evita duplicata nas últimas 24h (mesmo título)
        const recent = all.filter(n => Date.now() - n.time < 86_400_000);
        if (entry.adminNotificationId) {
            if (all.some(n => n.adminNotificationId === entry.adminNotificationId)) return;
        } else if (recent.some(n => n.title === entry.title)) return;

        all.unshift(entry);
        save(all);
        _updateDot();
    }

    function clearAll() {
        save([]);
        _updateDot();
        renderScreen(document.querySelector('.notif-tab.active')?.dataset.tab || 'all');
    }

    function markAllRead() {
        save(getAll().map(n => ({ ...n, read: true })));
        _updateDot();
    }

    function markRead(id) {
        save(getAll().map(n => n.id === id ? { ...n, read: true } : n));
        _updateDot();
    }

    function getUnreadCount() {
        return getAll().filter(n => !n.read).length;
    }

    // ── Dot no sino ─────────────────────────────────────────────
    function _updateDot() {
        const dot   = document.getElementById('notifDot');
        const count = getUnreadCount();
        if (!dot) return;
        dot.style.display = count > 0 ? 'flex' : 'none';
        dot.textContent   = count > 9 ? '9+' : (count > 0 ? String(count) : '');
    }

    // ── Geração de notificações locais ──────────────────────────
    function _dayKey(ts) {
        return new Date(ts || Date.now()).toDateString();
    }

    function checkAndGenerate() {
        const musics     = window.AppState?.musics     || [];
        const history    = window.AppState?.history    || [];
        const favorites  = window.AppState?.favorites  || new Set();
        const playlists  = window.AppState?.userPlaylists || [];
        let   playCounts = {};
        try { playCounts = JSON.parse(localStorage.getItem('play_counts') || '{}'); } catch {}

        // Preferências do usuário (Configurações → Notificações locais)
        let _prefs = { rec: true, release: true, weekly: true, streak: true };
        try { _prefs = { ..._prefs, ...JSON.parse(localStorage.getItem('fenda_notif_prefs') || '{}') }; } catch {}

        if (_prefs.rec)    _checkRecommendation(musics, history);
        if (_prefs.weekly) _checkWeeklySummary(musics);
        if (_prefs.streak) _checkStreak(history);
        if (_prefs.release) _checkNewReleases(musics);
    }

    function _checkRecommendation(musics, history) {
        const lsKey = 'fenda_notif_rec_day';
        if (localStorage.getItem(lsKey) === _dayKey()) return;
        // Sem histórico não há recomendação honesta — não notifica
        if (!history || history.length < 3) return;

        // Mesma fonte do banner e da home: perfil de escuta, viés de descoberta
        const recs = (typeof window.getRecommendations === 'function')
            ? window.getRecommendations(3, { discovery: 0.75 })
            : [];
        if (!recs.length) return;

        const pick = recs[Math.floor(Math.random() * recs.length)];
        add({
            type:    'recommendation',
            title:   pick.title,
            body:    pick.artist ? `de ${pick.artist} combina com o que você ouve` : 'foi recomendada para você',
            image:   pick.cover,
            musicId: pick.id,
        });
        localStorage.setItem(lsKey, _dayKey());
    }

    function _isoWeekKey(d = new Date()) {
        // Chave estável de semana ISO. A versão antiga usava a opção
        // inexistente {week:'numeric'} no toLocaleDateString — o navegador
        // ignora chaves desconhecidas, então a "semana" era só o ano:
        // a notificação disparava uma vez por ANO, com total de plays de
        // todos os tempos rotulado de "esta semana".
        const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const day = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - day);
        const y = t.getUTCFullYear();
        const w = Math.ceil((((t - Date.UTC(y, 0, 1)) / 86_400_000) + 1) / 7);
        return `${y}-w${w}`;
    }

    function _checkWeeklySummary(musics) {
        const lsKey = 'fenda_notif_week_summary';
        const thisWeek = _isoWeekKey();
        if (localStorage.getItem(lsKey) === thisWeek) return;

        const weekAgo = Date.now() - 7 * 86_400_000;
        const week = (window.AppState?.history || [])
            .filter(h => (h.playedAt || 0) > weekAgo);
        const mins = Math.floor(week.reduce((a, h) => a + (h.listenedSeconds || 0), 0) / 60);
        if (mins < 15) return; // semana fraca não vira notificação

        const byArtist = {};
        week.forEach(h => {
            const m = musics.find(x => String(x.id) === String(h.id));
            if (m?.artist) byArtist[m.artist] = (byArtist[m.artist] || 0) + (h.listenedSeconds || 0);
        });
        const top = Object.entries(byArtist).sort((a, b) => b[1] - a[1])[0];
        const timeStr = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}min` : `${mins}min`;

        add({
            type:  'trending',
            title: 'Sua semana no Fenda',
            body:  `${timeStr} de música${top ? ` · artista top: ${top[0]}` : ''}`,
        });
        localStorage.setItem(lsKey, thisWeek);
    }

    function _checkStreak(history) {
        const lsKey = 'fenda_notif_streak_day';
        if (localStorage.getItem(lsKey) === _dayKey()) return;

        const daySet = new Set((history || []).map(h => new Date(h.playedAt || 0).toDateString()));
        let streak = 0;
        const d = new Date();
        while (daySet.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }

        // Antes notificava TODO dia com streak>=3 (o título muda com o
        // número, então o dedup de 24h não segurava). Agora só nos marcos.
        const MARCOS = [3, 7, 14, 30, 50, 100];
        if (MARCOS.includes(streak)) {
            const doneKey = 'fenda_notif_streak_done';
            let done = [];
            try { done = JSON.parse(localStorage.getItem(doneKey) || '[]'); } catch {}
            if (!done.includes(streak)) {
                add({
                    type:  'fire',
                    title: `${streak} dias seguidos ouvindo! 🔥`,
                    body:  'Você está em sequência no Fenda Music. Continue assim!',
                });
                done.push(streak);
                localStorage.setItem(doneKey, JSON.stringify(done));
            }
        }
        localStorage.setItem(lsKey, _dayKey());
    }

    function _checkNewReleases(musics) {
        const lsKey = 'fenda_notif_release_day';
        if (localStorage.getItem(lsKey) === _dayKey()) return;

        // Faixas já notificadas — a versão antiga renotificava a MESMA
        // música dia após dia enquanto ela tivesse <7 dias (o dedup do
        // add() só segura 24h)
        const seenKey = 'fenda_notif_release_seen';
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch {}
        const seenSet = new Set(seen.map(String));

        const sevenDaysAgo = Date.now() - 7 * 86_400_000;
        const newOnes = musics.filter(m =>
            m.created_at &&
            new Date(m.created_at).getTime() > sevenDaysAgo &&
            !seenSet.has(String(m.id)));
        if (!newOnes.length) return;

        // Afinidade primeiro: novidade de artista que o usuário OUVE vale
        // mais que novidade de artista aleatório (era newOnes[0] cru)
        const history   = window.AppState?.history   || [];
        const favorites = window.AppState?.favorites || new Set();
        const affArtists = new Set();
        history.slice(0, 60).forEach(h => {
            const m = musics.find(x => String(x.id) === String(h.id));
            if (m?.artist) affArtists.add(m.artist);
        });
        musics.forEach(m => {
            if (m.artist && (favorites.has(m.id) || favorites.has(String(m.id))))
                affArtists.add(m.artist);
        });

        const affine = newOnes.filter(m => m.artist && affArtists.has(m.artist));
        const pick   = affine[0] || newOnes[0];
        const isAff  = affine.includes(pick);

        add({
            type:  'release',
            title: `${pick.artist} lançou "${pick.title}"`,
            body:  isAff ? 'novidade de um artista que você ouve' : 'já disponível no Fenda Music',
            image: pick.cover,
            musicId: pick.id,
        });
        seen.push(String(pick.id));
        localStorage.setItem(seenKey, JSON.stringify(seen.slice(-200)));
        localStorage.setItem(lsKey, _dayKey());
    }

    // ── Recebe push do SW ────────────────────────────────────────
    function addFromPush(data) {
        add({
            type:    data.type    || 'system',
            title:   data.title   || 'Fenda Music',
            body:    data.body    || '',
            image:   data.image   || null,
            musicId: data.musicId || null,
        });
        _showInAppToast(data.title, data.body);
    }

    // ── Comunicados administrativos dentro do Fenda ──────────────
    // A lista vem de uma RPC SECURITY DEFINER que expõe apenas avisos
    // já enviados. Dessa forma a central do Fenda funciona mesmo sem
    // permissão de notificação do navegador/Android e sem expor quem criou
    // os comunicados ou dados administrativos.
    let _adminSyncTimer = null;

    async function syncAdminAnnouncements() {
        const client = window.supabaseClient;
        const userId = window.AppState?.userId;
        if (!client?.rpc || !userId || !navigator.onLine) return [];

        try {
            const { data, error } = await client.rpc('list_fenda_in_app_announcements');
            if (error) throw error;

            const received = [];
            (Array.isArray(data) ? data : []).slice().reverse().forEach(item => {
                const alreadyAdded = getAll().some(n => n.adminNotificationId === item.id);
                if (alreadyAdded) return;
                add({
                    type: 'admin',
                    title: item.title || 'Comunicado do Fenda Music',
                    body: item.body || '',
                    image: item.image_url || null,
                    adminNotificationId: item.id,
                });
                received.push(item);
            });

            if (received.length) {
                if (document.getElementById('notificationsOverlay')?.classList.contains('active')) {
                    renderScreen(document.querySelector('.notif-tab.active')?.dataset.tab || 'all');
                }
                const latest = received[received.length - 1];
                _showInAppToast('Novo aviso do Fenda', latest.title || 'Você recebeu um comunicado');
            }
            return received;
        } catch (error) {
            console.warn('[FendaNotifications] Não foi possível sincronizar avisos administrativos:', error);
            return [];
        }
    }

    function startAdminAnnouncementSync() {
        if (_adminSyncTimer) clearInterval(_adminSyncTimer);
        void syncAdminAnnouncements();
        _adminSyncTimer = setInterval(() => { void syncAdminAnnouncements(); }, 60_000);
    }

    function _showInAppToast(title, body) {
        if (typeof window.showToast === 'function') {
            window.showToast(`🔔 ${title}: ${body}`, 'success');
        }
    }

    // ── Renderização da tela ─────────────────────────────────────
    function _timeLabel(ts) {
        if (!ts) return '';
        const now  = new Date();
        const d    = new Date(ts);
        const diff = now - d;
        if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}min atrás`;
        if (d.toDateString() === now.toDateString())
            return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const yest = new Date(now); yest.setDate(yest.getDate() - 1);
        if (d.toDateString() === yest.toDateString()) return 'Ontem';
        const mo = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        return `${d.getDate()} de ${mo[d.getMonth()]}`;
    }

    function _groupLabel(ts) {
        const now  = new Date();
        const d    = new Date(ts);
        if (d.toDateString() === now.toDateString()) return 'Hoje';
        const yest = new Date(now); yest.setDate(yest.getDate() - 1);
        if (d.toDateString() === yest.toDateString()) return 'Ontem';
        const diff = Math.floor((now - d) / 86_400_000);
        if (diff < 7) return 'Esta semana';
        return 'Mais antigas';
    }

    function renderScreen(filter = 'all') {
        const list = document.getElementById('notifList');
        if (!list) return;

        let notifs = getAll();
        if (filter === 'unread') notifs = notifs.filter(n => !n.read);

        if (!notifs.length) {
            list.innerHTML = `
                <div class="notif-empty">
                    <span class="material-symbols-rounded">notifications_off</span>
                    <p>${filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação ainda'}</p>
                </div>`;
            return;
        }

        // Agrupa por data
        const groups = [];
        const seen   = new Map();
        notifs.forEach(n => {
            const g = _groupLabel(n.time);
            if (!seen.has(g)) { seen.set(g, groups.length); groups.push({ label: g, items: [] }); }
            groups[seen.get(g)].items.push(n);
        });

        list.innerHTML = groups.map(g => `
            <div class="notif-group">
                <div class="notif-group-label">${g.label}</div>
                ${g.items.map(n => `
                    <div class="notif-card ${n.read ? '' : 'notif-unread'}" data-id="${n.id}" data-music="${n.musicId || ''}">
                        <div class="notif-thumb">
                            ${n.image
                                ? `<img src="${n.image}" alt="" class="notif-thumb-img">`
                                : `<div class="notif-thumb-icon" style="background:${n.iconBg}">
                                       <span class="material-symbols-rounded">${n.icon}</span>
                                   </div>`}
                        </div>
                        <div class="notif-content">
                            <p class="notif-title"><strong>${_esc(n.title)}</strong> ${_esc(n.body)}</p>
                            <span class="notif-time">${_timeLabel(n.time)}</span>
                        </div>
                        ${!n.read ? `<span class="notif-dot-indicator"></span>` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('');

        // Cliques nas notificações
        list.querySelectorAll('.notif-card').forEach(card => {
            card.addEventListener('click', () => {
                const id      = card.dataset.id;
                const musicId = card.dataset.music;
                markRead(id);
                card.classList.remove('notif-unread');
                card.querySelector('.notif-dot-indicator')?.remove();
                _updateDot();

                if (musicId) {
                    const music = (window.AppState?.musics || []).find(
                        m => String(m.id) === String(musicId)
                    );
                    if (music && typeof window.playMusicTrack === 'function') {
                        closeNotifications();
                        window.playMusicTrack(music);
                    }
                }
            });
        });
    }

    function _esc(str) {
        return String(str || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Abrir / fechar overlay ───────────────────────────────────
    function openNotifications() {
        const overlay = document.getElementById('notificationsOverlay');
        if (!overlay) return;
        overlay.classList.add('active');
        const list = overlay.querySelector('.notif-list');
        if (list) list.scrollTop = 0;
        document.body.style.overflow = 'hidden';
        // Renderiza PRIMEIRO com o estado real (não lidas visíveis)
        // Marca como lidas apenas ao FECHAR — evita inconsistência visual
        renderScreen('all');
        void syncAdminAnnouncements();
        // Verifica permissão de push para mostrar/ocultar prompt
        _checkPushPermission();
    }

    function closeNotifications() {
        const overlay = document.getElementById('notificationsOverlay');
        if (!overlay) return;
        // Marca tudo como lido ao fechar (não ao abrir)
        markAllRead();
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        _updateDot();
    }

    // ── Permissão push e visibilidade do prompt ───────────────────
    function _checkPushPermission() {
        const card = document.getElementById('notifPromptCard');
        if (!card) return;
        // Sem suporte → esconde
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            card.style.display = 'none'; return;
        }
        // Já decidido (granted ou denied) → esconde
        if (Notification.permission !== 'default') {
            card.style.display = 'none';
        } else {
            card.style.display = 'flex'; // só mostra se ainda não decidiu
        }
    }

    function _requestPushPermission() {
        if (!('Notification' in window)) {
            window.showToast?.('Seu navegador não suporta notificações', 'danger');
            return;
        }
        // Usa função do player-core.js se disponível
        if (typeof window.subscribePushNotifications === 'function') {
            window.subscribePushNotifications().then(sub => {
                if (sub) {
                    document.getElementById('notifPromptCard')?.remove();
                    window.showToast?.('✅ Notificações ativadas!', 'success');
                    _updateDot();
                }
            });
            return;
        }
        // Fallback: solicita permissão diretamente
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                document.getElementById('notifPromptCard')?.remove();
                window.showToast?.('✅ Notificações ativadas!', 'success');
            } else {
                window.showToast?.('Permissão negada pelo navegador', 'danger');
            }
        });
    }

    // ── Init ─────────────────────────────────────────────────────
    function init() {
        _updateDot();

        // Botão de fechar dentro do overlay
        document.getElementById('notifCloseBtn')
            ?.addEventListener('click', closeNotifications);

        // Botão "Limpar" no cabeçalho (criado via JS para não depender de
        // player.html novo escapar do cache velho)
        const _header = document.querySelector('.notif-header');
        if (_header && !document.getElementById('notifClearBtn')) {
            const b = document.createElement('button');
            b.id = 'notifClearBtn';
            b.className = 'notif-clear-btn';
            b.type = 'button';
            b.textContent = 'Limpar';
            b.addEventListener('click', () => {
                if (!getAll().length) return;
                clearAll();
                window.showToast?.('Notificações limpas', 'success');
            });
            _header.insertBefore(b, document.getElementById('notifCloseBtn'));
        }

        // Tabs Todas / Não lidas
        document.querySelectorAll('.notif-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderScreen(tab.dataset.tab);
            });
        });

        // Botão ativar notificações push
        document.getElementById('notifActivateBtn')?.addEventListener('click', () => {
            _requestPushPermission();
        });

        // Atualiza bolinha imediatamente no init
        _updateDot();

        // Gera notificações locais após 3s (aguarda dados do app)
        setTimeout(() => {
            checkAndGenerate();
            _updateDot();
            startAdminAnnouncementSync();
        }, 3000);
    }

    return {
        init,
        add,
        clearAll,
        addFromPush,
        openNotifications,
        closeNotifications,
        checkAndGenerate,
        syncAdminAnnouncements,
        getAll,
        getUnreadCount,
        updateDot: _updateDot,
    };
})();

window.FendaNotifications = FendaNotifications;
