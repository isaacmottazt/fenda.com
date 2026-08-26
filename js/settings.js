// ============================================================
// CONFIGURAÇÕES DO USUÁRIO + ENVIO DE MÚSICA PARA ANÁLISE
//
// Auto-contido de propósito: cria o próprio DOM e injeta o próprio CSS
// em runtime — se um HTML/CSS velho ficar preso no cache do SW, o painel
// funciona mesmo assim (mesmo padrão do botão Limpar das notificações).
//
// Estrutura: painel principal (menu) + telas cheias próprias para
// Reprodução, Idioma/Acessibilidade e Sobre — cada uma com header e
// botão voltar, empilhadas por cima do painel principal.
//
//   Conta          → e-mail, trocar senha, sair, excluir conta
//   Aparência      → cor do app (sempre modo escuro, sem toggle claro/escuro)
    //   Reprodução*    → downloads automáticos, crossfade, normalização, economia de dados

//   Notificações   → liga/desliga cada tipo local (lido pelo notifications.js)
//   Idioma e acessibilidade* → idioma da interface, tamanho de fonte, reduzir movimento
//   Armazenamento  → limpar downloads offline, forçar atualização do app
//   Sobre*         → versão, termos, privacidade, suporte
//   (* = tela própria, aberta a partir do menu principal)
//
// Qualidade de áudio NÃO está aqui de propósito: o catálogo só tem um
// arquivo por música no Supabase Storage, então uma opção de "qualidade"
// não teria efeito real — reintroduzir só quando existirem variantes.
//
// Envio de música (FendaSubmit): título* + artista* + arquivo opcional →
// tabela music_submissions (status pending) → aparece no painel admin.
// Arquivo vai para o bucket 'submissions', NUNCA para 'music-files':
// submissão recusada não pode virar arquivo público do catálogo.
// ============================================================

(function () {
    'use strict';

    const PREFS_KEY = 'fenda_notif_prefs';
    const PLAYBACK_KEY = 'fenda_playback_prefs';
    const APP_PREFS_KEY = 'fenda_app_prefs';
    const SUBMISSIONS_BUCKET = 'submissions';
    const MAX_FILE_MB = 25;
    const APP_VERSION = '3.0.0';

    // ── CSS injetado ──
    function _injectCss() {
        if (document.getElementById('fenda-settings-css')) return;
        const st = document.createElement('style');
        st.id = 'fenda-settings-css';
        st.textContent = `
.fs-overlay{position:fixed;inset:0;background:#0a0812;z-index:9000;display:none;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;zoom:var(--fs-font-scale,1)}
.fs-overlay.open{display:flex}
.fs-overlay.fs-screen{z-index:9100}
.fs-header{display:flex;align-items:center;gap:12px;padding:52px 18px 14px;position:sticky;top:0;background:rgba(10,8,18,.94);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.06);z-index:2}
.fs-header h1{font-size:19px;font-weight:900;flex:1}
.fs-close,.fs-back{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.fs-body{padding:16px 16px 60px;max-width:560px;width:100%;margin:0 auto}
.fs-section{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(192,132,252,.8);margin:22px 4px 8px}
.fs-section:first-child{margin-top:0}
.fs-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden}
.fs-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.05);width:100%;background:none;border-left:none;border-right:none;border-top:none;color:#fff;text-align:left;font:inherit;cursor:pointer}
.fs-row:last-child{border-bottom:none}
.fs-row .material-symbols-rounded{font-size:20px;color:rgba(192,132,252,.85);flex-shrink:0}
.fs-row-text{flex:1;min-width:0}
.fs-row-title{font-size:14px;font-weight:700;display:block}
.fs-row-sub{font-size:12px;color:rgba(255,255,255,.45);display:block;margin-top:1px;overflow-wrap:anywhere}
.fs-row.danger .material-symbols-rounded,.fs-row.danger .fs-row-title{color:#f87171}
.fs-row-arrow{font-size:18px !important;opacity:.35;color:rgba(255,255,255,.5) !important}
.fs-switch{position:relative;width:44px;height:26px;flex-shrink:0}
.fs-switch input{opacity:0;width:0;height:0}
.fs-switch i{position:absolute;inset:0;border-radius:20px;background:rgba(255,255,255,.12);transition:background .2s}
.fs-switch i:before{content:'';position:absolute;width:20px;height:20px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s}
.fs-switch input:checked+i{background:#924cff}
.fs-switch input:checked+i:before{transform:translateX(18px)}
.fs-switch input:disabled+i{opacity:.4}
.fs-form{padding:14px 16px}.fs-subsection-title{padding:16px 16px 7px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(192,132,252,.72)}.fs-account-card>.fs-subsection-title:first-child{padding-top:15px}.fs-account-card>.fs-form{padding-top:8px}.fs-account-card>.fs-subsection-title~.fs-subsection-title{border-top:1px solid rgba(255,255,255,.05)}
.fs-form label{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);margin:10px 0 6px}
.fs-form input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px;color:#fff;font-size:14px;outline:none;box-sizing:border-box}
.fs-form input:focus{border-color:rgba(146,76,255,.4)}
.fs-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:14px;padding:13px 0;border-radius:16px;border:none;background:linear-gradient(135deg,#924cff,#6a2ad4);color:#fff;font-size:14px;font-weight:800;cursor:pointer}
.fs-btn:disabled{opacity:.5}
.fs-btn.ghost{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.75)}
.fs-btn-link{background:none !important;border:none !important;color:rgba(192,132,252,.85) !important;margin-top:8px !important;font-size:12.5px !important;font-weight:700 !important;text-decoration:underline;text-underline-offset:2px}
.fs-hint{font-size:11.5px;color:rgba(255,255,255,.4);margin-top:8px;line-height:1.5}
.fs-file{display:flex;align-items:center;gap:10px;margin-top:6px;background:rgba(255,255,255,.05);border:1px dashed rgba(146,76,255,.4);border-radius:14px;padding:14px;cursor:pointer;color:rgba(255,255,255,.7);font-size:13px;font-weight:700}
.fs-file .material-symbols-rounded{color:rgba(192,132,252,.9)}
.fs-file span.name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fs-status{margin-top:10px;font-size:12.5px;color:rgba(255,255,255,.6)}
.fs-status.err{color:#f87171;user-select:text}
.fs-status.ok{color:#4ade80}
.fs-colors{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;padding:16px}
.fs-color-dot{width:100%;aspect-ratio:1;border-radius:50%;border:3px solid transparent;cursor:pointer;padding:0;background-clip:padding-box}
.fs-color-dot.active{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
.fs-select{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px;color:#fff;font-size:14px;outline:none;box-sizing:border-box;-webkit-appearance:none;appearance:none}
.fs-row-link,.fs-row-link *{color:rgba(255,255,255,.85);text-decoration:none!important}
.fs-row .fs-row-value{font-size:13px;color:rgba(255,255,255,.4);flex-shrink:0}
.fs-slider-row{padding:14px 16px}
.fs-slider-row .fs-row-title{display:block;margin-bottom:10px}
.fs-slider-row input[type=range]{width:100%;accent-color:#924cff}
.fs-slider-labels{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.4);margin-top:4px}
.fs-app-version{text-align:center;font-size:12px;color:rgba(255,255,255,.3);margin-top:24px;padding-bottom:10px}
.fs-avatar-row{display:flex;align-items:center;gap:14px;padding:16px}
.fs-avatar-wrap{position:relative;width:64px;height:64px;flex-shrink:0;cursor:pointer}
.fs-avatar-wrap img{width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;background:rgba(255,255,255,.08)}
.fs-avatar-wrap .fs-avatar-fallback{width:64px;height:64px;border-radius:50%;background:rgba(146,76,255,.18);display:flex;align-items:center;justify-content:center}
.fs-avatar-wrap .fs-avatar-fallback .material-symbols-rounded{font-size:32px;color:rgba(192,132,252,.9)}
.fs-avatar-wrap .fs-avatar-edit{position:absolute;bottom:-2px;right:-2px;width:24px;height:24px;border-radius:50%;background:#924cff;display:flex;align-items:center;justify-content:center;border:2px solid #0a0812}
.fs-avatar-wrap .fs-avatar-edit .material-symbols-rounded{font-size:13px;color:#fff}
.fs-avatar-text{flex:1;min-width:0}
.fs-avatar-text b{display:block;font-size:14px;font-weight:800}
.fs-avatar-text span{display:block;font-size:12px;color:rgba(255,255,255,.45);margin-top:2px}
.fs-input-prefix{position:relative}
.fs-input-prefix .fs-at{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,.4);font-size:14px;pointer-events:none}
.fs-input-prefix input{padding-left:26px !important}
.fs-about-hero{text-align:center;margin-bottom:10px;padding:8px 0 4px}
.fs-about-mark{position:relative;width:76px;height:76px;margin:0 auto 16px;border-radius:22px;background:linear-gradient(135deg,#924cff,#6a2ad4);box-shadow:0 10px 28px rgba(146,76,255,.35);display:flex;align-items:center;justify-content:center;overflow:hidden}
.fs-about-mark-img{width:100%;height:100%;object-fit:cover;display:block}
.fs-about-mark-icon{display:none;font-size:34px;color:#fff}
.fs-about-mark.fallback .fs-about-mark-img{display:none}
.fs-about-mark.fallback .fs-about-mark-icon{display:block}
.fs-about-hero h2{font-size:20px;font-weight:900;letter-spacing:-.2px;margin-bottom:8px}
.fs-about-version-badge{display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap;font-size:12px;font-weight:700;color:rgba(192,132,252,.9);background:rgba(146,76,255,.12);border:1px solid rgba(146,76,255,.25);border-radius:30px;padding:4px 12px}.fs-about-version-number{font-variant-numeric:tabular-nums}.fs-about-description{max-width:360px;margin:14px auto 0;font-size:12px;line-height:1.55;color:rgba(255,255,255,.48)}
.fs-about-footer{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;text-align:center;font-size:12px;line-height:1.35;color:rgba(255,255,255,.35);margin-top:26px;padding:0 8px 10px}
.fs-about-footer-main{display:inline-flex;align-items:center;justify-content:center;gap:6px;max-width:100%}
.fs-about-footer-main .material-symbols-rounded{font-size:15px;color:#f472b6;flex:0 0 auto}
.fs-about-footer-copyright{font-size:11px;color:rgba(255,255,255,.26)}
.fs-about-footer-dot{display:none;opacity:.5}
@media (min-width:520px){.fs-about-footer{flex-direction:row;gap:8px}.fs-about-footer-copyright{font-size:12px}.fs-about-footer-dot{display:inline}}
.open_in_new_icon{font-size:16px !important;opacity:.3}
`;
        document.head.appendChild(st);
    }

    // ── Prefs de notificação ──
    function getPrefs() {
        const def = { rec: true, release: true, weekly: true, streak: true };
        try { return { ...def, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
        catch { return def; }
    }
    function setPref(key, val) {
        const p = getPrefs(); p[key] = val;
        localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    }

    // ── Prefs de reprodução ──
    // Lidas de verdade pelo player: ver hook em player-core.js
    // (window.FendaSettings.getPlaybackPrefs() + evento fenda:playbackPrefsChanged)
    function getPlaybackPrefs() {
        const def = { autoplay: true, autoDownloadPlaylists: true, crossfade: false, crossfadeSec: 4, normalize: true, dataSaver: false, wifiDownloadsOnly: true, sleepTimerMinutes: 0 };
        try { return { ...def, ...JSON.parse(localStorage.getItem(PLAYBACK_KEY) || '{}') }; }
        catch { return def; }
    }
    function setPlaybackPref(key, val) {
        const p = getPlaybackPrefs(); p[key] = val;
        localStorage.setItem(PLAYBACK_KEY, JSON.stringify(p));
        window.dispatchEvent(new CustomEvent('fenda:playbackPrefsChanged', { detail: p }));
        return p;
    }

    // ── Prefs de app (idioma/acessibilidade) ──
    function getAppPrefs() {
        const def = { language: 'pt-BR', fontScale: 1, reduceMotion: false };
        try { return { ...def, ...JSON.parse(localStorage.getItem(APP_PREFS_KEY) || '{}') }; }
        catch { return def; }
    }
    function setAppPref(key, val) {
        const p = getAppPrefs(); p[key] = val;
        localStorage.setItem(APP_PREFS_KEY, JSON.stringify(p));
        _applyAppPrefs(p);
        return p;
    }
    function _applyAppPrefs(p) {
        document.documentElement.style.setProperty('--fs-font-scale', p.fontScale);
        document.documentElement.classList.toggle('fenda-reduce-motion', !!p.reduceMotion);
        document.documentElement.setAttribute('lang', p.language);
    }

    function _esc(s) {
        return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    // aplica prefs salvas assim que o script carrega, mesmo sem abrir o painel
    _applyAppPrefs(getAppPrefs());
    window.dispatchEvent(new CustomEvent('fenda:playbackPrefsChanged', { detail: getPlaybackPrefs() }));

    // ============================================================
    // TELA: REPRODUÇÃO
    // ============================================================
    let _playbackScreen = null;

    function _buildPlaybackScreen() {
        if (_playbackScreen) return _playbackScreen;
        _injectCss();
        const pb = getPlaybackPrefs();

        _playbackScreen = document.createElement('div');
        _playbackScreen.className = 'fs-overlay fs-screen';
        _playbackScreen.innerHTML = `
          <div class="fs-header">
            <button class="fs-back" id="fsPlaybackBack"><span class="material-symbols-rounded">arrow_back</span></button>
            <h1 data-i18n="playback_title">Reprodução</h1>
          </div>
          <div class="fs-body">
            <div class="fs-section" data-i18n="playback_section">Reprodução</div>
            <div class="fs-card">
              <label class="fs-row">
                <span class="material-symbols-rounded">equalizer</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="playback_normalize">Normalização de volume</span><span class="fs-row-sub" data-i18n="playback_normalize_sub">Mantém o volume equilibrado entre faixas</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsNormalize" ${pb.normalize ? 'checked' : ''}><i></i></span>
              </label>
            </div>

            <div class="fs-section" data-i18n="playback_transition">Transição entre músicas</div>
            <div class="fs-card">
              <label class="fs-row">
                <span class="material-symbols-rounded">swap_horiz</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="playback_crossfade">Crossfade</span><span class="fs-row-sub" data-i18n="playback_crossfade_sub">Uma música se funde suavemente na próxima</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsCrossfade" ${pb.crossfade ? 'checked' : ''}><i></i></span>
              </label>
              <div class="fs-slider-row" id="fsCrossfadeRow" style="${pb.crossfade ? '' : 'display:none'}">
                <span class="fs-row-title" style="font-size:13px;opacity:.7"><span data-i18n="playback_duration">Duração</span>: <span id="fsCrossfadeVal">${pb.crossfadeSec}s</span></span>
                <input type="range" id="fsCrossfadeSec" min="1" max="12" step="1" value="${pb.crossfadeSec}">
                <div class="fs-slider-labels"><span>1s</span><span>12s</span></div>
              </div>
            </div>

            <div class="fs-section" data-i18n="playback_mobile_data">Dados móveis</div>
            <div class="fs-card">
              <label class="fs-row">
                <span class="material-symbols-rounded">data_saver_off</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="playback_data_saver">Economizar dados</span><span class="fs-row-sub" data-i18n="playback_data_saver_sub">Não pré-carrega a próxima música fora do Wi-Fi</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsDataSaver" ${pb.dataSaver ? 'checked' : ''}><i></i></span>
              </label>
            </div>

            <div class="fs-section">Downloads offline</div>
            <div class="fs-card">
              <label class="fs-row">
                <span class="material-symbols-rounded">playlist_play</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="playback_auto_download">Baixar playlists automaticamente</span><span class="fs-row-sub" data-i18n="playback_auto_download_sub">Salva as músicas das suas playlists para ouvir sem internet</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsAutoDownloadPlaylists" ${pb.autoDownloadPlaylists !== false ? 'checked' : ''}><i></i></span>
              </label>
              <label class="fs-row">
                <span class="material-symbols-rounded">wifi</span>
                <div class="fs-row-text"><span class="fs-row-title">Baixar somente em Wi‑Fi</span><span class="fs-row-sub">Evita usar seus dados móveis nos downloads</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsWifiDownloads" ${pb.wifiDownloadsOnly ? 'checked' : ''}><i></i></span>
              </label>
            </div>

            <div class="fs-section">Temporizador de desligamento</div>
            <div class="fs-card"><div class="fs-form">
              <label for="fsSleepTimer">Parar a reprodução em</label>
              <select class="fs-select" id="fsSleepTimer">
                <option value="0" ${!pb.sleepTimerMinutes ? 'selected' : ''}>Desativado</option>
                <option value="15" ${pb.sleepTimerMinutes === 15 ? 'selected' : ''}>15 minutos</option>
                <option value="30" ${pb.sleepTimerMinutes === 30 ? 'selected' : ''}>30 minutos</option>
                <option value="45" ${pb.sleepTimerMinutes === 45 ? 'selected' : ''}>45 minutos</option>
                <option value="60" ${pb.sleepTimerMinutes === 60 ? 'selected' : ''}>1 hora</option>
              </select>
              <p class="fs-hint">A música será pausada automaticamente ao fim do período escolhido.</p>
            </div></div>
            <p class="fs-hint" data-i18n="playback_no_quality_hint">O Fenda Music guarda só um arquivo por música — por isso ainda não existe opção de qualidade de áudio.</p>
          </div>
        `;
        document.body.appendChild(_playbackScreen);

        _playbackScreen.querySelector('#fsPlaybackBack').addEventListener('click', () => _playbackScreen.classList.remove('open'));

        _playbackScreen.querySelector('#fsNormalize').addEventListener('change', (e) => setPlaybackPref('normalize', e.target.checked));
        _playbackScreen.querySelector('#fsAutoDownloadPlaylists').addEventListener('change', (e) => setPlaybackPref('autoDownloadPlaylists', e.target.checked));
        _playbackScreen.querySelector('#fsDataSaver').addEventListener('change', (e) => setPlaybackPref('dataSaver', e.target.checked));
        _playbackScreen.querySelector('#fsWifiDownloads').addEventListener('change', (e) => setPlaybackPref('wifiDownloadsOnly', e.target.checked));
        _playbackScreen.querySelector('#fsSleepTimer').addEventListener('change', (e) => setPlaybackPref('sleepTimerMinutes', Number(e.target.value)));
        _playbackScreen.querySelector('#fsCrossfade').addEventListener('change', (e) => {
            setPlaybackPref('crossfade', e.target.checked);
            _playbackScreen.querySelector('#fsCrossfadeRow').style.display = e.target.checked ? '' : 'none';
        });
        _playbackScreen.querySelector('#fsCrossfadeSec').addEventListener('input', (e) => {
            _playbackScreen.querySelector('#fsCrossfadeVal').textContent = e.target.value + 's';
        });
        _playbackScreen.querySelector('#fsCrossfadeSec').addEventListener('change', (e) => setPlaybackPref('crossfadeSec', Number(e.target.value)));

        return _playbackScreen;
    }

    // ============================================================
    // TELA: IDIOMA E ACESSIBILIDADE
    // ============================================================
    let _a11yScreen = null;

    function _buildA11yScreen() {
        if (_a11yScreen) return _a11yScreen;
        _injectCss();
        const ap = getAppPrefs();

        _a11yScreen = document.createElement('div');
        _a11yScreen.className = 'fs-overlay fs-screen';
        _a11yScreen.innerHTML = `
          <div class="fs-header">
            <button class="fs-back" id="fsA11yBack"><span class="material-symbols-rounded">arrow_back</span></button>
            <h1 data-i18n="a11y_title">Idioma e acessibilidade</h1>
          </div>
          <div class="fs-body">
            <div class="fs-section" data-i18n="a11y_language">Idioma</div>
            <div class="fs-card">
              <div class="fs-row" style="cursor:default;align-items:flex-start;flex-direction:column;gap:6px">
                <select class="fs-select" id="fsLanguage">
                  <option value="pt-BR" ${ap.language === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option>
                  <option value="en-US" ${ap.language === 'en-US' ? 'selected' : ''}>English (US)</option>
                  <option value="es-ES" ${ap.language === 'es-ES' ? 'selected' : ''}>Español</option>
                </select>
              </div>
            </div>
            <p class="fs-hint" id="fsLangHint">${(window.t ? window.t(ap.language === 'pt-BR' ? 'a11y_lang_hint_pt' : 'a11y_lang_hint_other') : '')}</p>

            <div class="fs-section" data-i18n="a11y_section">Acessibilidade</div>
            <div class="fs-card">
              <div class="fs-slider-row">
                <span class="fs-row-title" style="font-size:13px;opacity:.7"><span data-i18n="a11y_font_size">Tamanho da fonte</span>: <span id="fsFontVal">${Math.round(ap.fontScale * 100)}%</span></span>
                <input type="range" id="fsFontScale" min="0.85" max="1.3" step="0.05" value="${ap.fontScale}">
                <div class="fs-slider-labels"><span data-i18n="a11y_smaller">Menor</span><span data-i18n="a11y_bigger">Maior</span></div>
              </div>
              <label class="fs-row">
                <span class="material-symbols-rounded">motion_photos_off</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="a11y_reduce_motion">Reduzir animações</span><span class="fs-row-sub" data-i18n="a11y_reduce_motion_sub">Diminui movimento e transições na interface</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsReduceMotion" ${ap.reduceMotion ? 'checked' : ''}><i></i></span>
              </label>
            </div>
          </div>
        `;
        document.body.appendChild(_a11yScreen);

        _a11yScreen.querySelector('#fsA11yBack').addEventListener('click', () => _a11yScreen.classList.remove('open'));

        _a11yScreen.querySelector('#fsLanguage').addEventListener('change', (e) => {
            setAppPref('language', e.target.value);
            window.dispatchEvent(new CustomEvent('fenda:languageChanged'));
            const hint = _a11yScreen.querySelector('#fsLangHint');
            hint.textContent = window.t(e.target.value === 'pt-BR' ? 'a11y_lang_hint_pt' : 'a11y_lang_hint_other');
        });
        _a11yScreen.querySelector('#fsFontScale').addEventListener('input', (e) => {
            _a11yScreen.querySelector('#fsFontVal').textContent = Math.round(e.target.value * 100) + '%';
        });
        _a11yScreen.querySelector('#fsFontScale').addEventListener('change', (e) => setAppPref('fontScale', Number(e.target.value)));
        _a11yScreen.querySelector('#fsReduceMotion').addEventListener('change', (e) => setAppPref('reduceMotion', e.target.checked));

        return _a11yScreen;
    }

    // ============================================================
    // TELA: SOBRE
    // ============================================================
    let _aboutScreen = null;
    let _legalScreen = null;

    const LEGAL_CONTENT = {
        terms: {
            title: 'Termos de uso', icon: 'description',
            intro: 'Estes termos explicam as regras para usar o Fenda Music com segurança e respeito à comunidade.',
            sections: [
                ['Uso do Fenda Music', 'O Fenda Music é uma plataforma sem fins lucrativos para compartilhamento de músicas. O catálogo é formado por envios da comunidade e passa por análise manual; por isso, nem todas as músicas conhecidas estarão disponíveis. Use o app de maneira responsável e de acordo com a legislação aplicável.'],
                ['Sua conta', 'Mantenha seu acesso protegido e informe dados corretos. Você é responsável pelas ações realizadas em sua conta.'],
                ['Catálogo e downloads', 'As músicas e os downloads offline são destinados ao seu uso pessoal dentro do aplicativo. O catálogo é colaborativo e pode não conter todas as músicas existentes. Não é permitido redistribuir ou explorar o conteúdo sem autorização.'],
                ['Convivência', 'Não envie conteúdo ofensivo, ilegal ou que viole direitos de terceiros. Podemos moderar ou remover conteúdo que descumpra estas regras.'],
                ['Atualizações', 'Podemos atualizar estes termos quando houver mudanças importantes no serviço. Se tiver dúvidas, fale conosco pelo suporte.'],
            ],
        },
        privacy: {
            title: 'Política de privacidade', icon: 'privacy_tip',
            intro: 'Esta política descreve, em linguagem simples, como cuidamos das informações necessárias para oferecer sua experiência no Fenda Music.',
            sections: [
                ['Informações usadas', 'Usamos os dados de conta que você fornece, como e-mail, nome e foto, além de favoritos, playlists e histórico quando você autoriza análise de uso ou recomendações. Esses dados ajudam a manter os recursos disponíveis e adaptar sua experiência.'],
                ['Consentimentos opcionais', 'Nas Configurações → Privacidade e dados, você escolhe separadamente análise de uso, recomendações personalizadas, localização precisa e dados técnicos do aparelho. O GPS só é lido depois da permissão do navegador; se você revogar a autorização, a localização armazenada é removida.'],
                ['Localização e dados técnicos', 'Quando autorizados, guardamos as coordenadas aproximadas ao nível de precisão fornecido pelo navegador, a precisão informada, a data da captura, o idioma, o fuso horário e a plataforma. Não guardamos a senha, tokens ou o identificador bruto do navegador.'],
                ['IP e registros de segurança', 'O Fenda não grava um IP no perfil do usuário nem o usa para criar um cadastro pessoal. Provedores de infraestrutura podem processar registros técnicos temporários para segurança, disponibilidade e prevenção de abuso, conforme as políticas aplicáveis deles.'],
                ['Uso e controle', 'Você pode editar os dados do perfil, alterar e-mail e senha, ajustar os consentimentos, limpar downloads e excluir sua conta nas Configurações.'],
                ['Dados no dispositivo', 'Parte das informações e dos downloads pode ficar no seu aparelho para permitir acesso mais rápido e uso offline. Você pode limpar esses dados nas Configurações.'],
                ['Compartilhamento', 'Não vendemos suas informações pessoais. O acesso às informações é restrito ao necessário para suporte, segurança e funcionamento do Fenda Music.'],
                ['Segurança e contato', 'Usamos medidas de proteção compatíveis com o serviço e conexões seguras. Para dúvidas ou solicitações sobre privacidade, entre em contato pelo suporte.'],
            ],
        },
    };

    function _openLegalScreen(kind) {
        const content = LEGAL_CONTENT[kind];
        if (!content) return;
        _injectCss();
        if (!_legalScreen) {
            _legalScreen = document.createElement('div');
            _legalScreen.className = 'fs-overlay fs-screen';
            document.body.appendChild(_legalScreen);
        }
        _legalScreen.innerHTML = `
          <div class="fs-header">
            <button class="fs-back" id="fsLegalBack"><span class="material-symbols-rounded">arrow_back</span></button>
            <h1>${_esc(content.title)}</h1>
          </div>
          <div class="fs-body">
            <div class="fs-about-hero" style="margin-top:10px"><div class="fs-about-mark fallback"><span class="material-symbols-rounded fs-about-mark-icon">${content.icon}</span></div><h2>${_esc(content.title)}</h2></div>
            <p class="fs-hint" style="margin:0 0 18px;font-size:13px;color:rgba(255,255,255,.65)">${_esc(content.intro)}</p>
            ${content.sections.map(([heading, text]) => `<div class="fs-card" style="margin-bottom:10px"><div class="fs-form"><strong style="font-size:14px">${_esc(heading)}</strong><p class="fs-hint" style="margin:7px 0 0">${_esc(text)}</p></div></div>`).join('')}
            <div class="fs-card"><a class="fs-row fs-row-link" href="mailto:contato@fendamusic.com.br"><span class="material-symbols-rounded">mail</span><div class="fs-row-text"><span class="fs-row-title">Fale conosco</span><span class="fs-row-sub">contato@fendamusic.com.br</span></div><span class="material-symbols-rounded fs-row-arrow">open_in_new</span></a></div>
          </div>`;
        _legalScreen.querySelector('#fsLegalBack').addEventListener('click', () => _legalScreen.classList.remove('open'));
        _legalScreen.classList.add('open');
    }

    function _buildAboutScreen() {
        if (_aboutScreen) return _aboutScreen;
        _injectCss();

        _aboutScreen = document.createElement('div');
        _aboutScreen.className = 'fs-overlay fs-screen';
        _aboutScreen.innerHTML = `
          <div class="fs-header">
            <button class="fs-back" id="fsAboutBack"><span class="material-symbols-rounded">arrow_back</span></button>
            <h1 data-i18n="about_title">Sobre</h1>
          </div>
          <div class="fs-body">
            <div class="fs-about-hero">
              <div class="fs-about-mark">
                <img src="/imagens/logo.png" alt="" class="fs-about-mark-img" onerror="this.style.display='none'; this.parentElement.classList.add('fallback')">
                <span class="material-symbols-rounded fs-about-mark-icon">graphic_eq</span>
              </div>
              <h2>Fenda Music</h2>
              <span class="fs-about-version-badge"><span data-i18n="settings_version">versão</span><span class="fs-about-version-number">${APP_VERSION}</span></span>
              <p class="fs-about-description" data-i18n="about_description">Plataforma sem fins lucrativos para compartilhar músicas. O catálogo é formado por envios da comunidade e passa por análise manual; por isso, nem todas as músicas estarão disponíveis.</p>
            </div>

            <div class="fs-section" data-i18n="about_legal">Legal</div>
            <div class="fs-card">
              <button class="fs-row fs-row-link" type="button" data-legal="terms">
                <span class="material-symbols-rounded">description</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="about_terms">Termos de uso</span></div>
                <span class="material-symbols-rounded fs-row-arrow">chevron_right</span>
              </button>
              <button class="fs-row fs-row-link" type="button" data-legal="privacy">
                <span class="material-symbols-rounded">privacy_tip</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="about_privacy">Política de privacidade</span></div>
                <span class="material-symbols-rounded fs-row-arrow">chevron_right</span>
              </button>
            </div>

            <div class="fs-section" data-i18n="about_support">Suporte</div>
            <div class="fs-card">
              <a class="fs-row fs-row-link" href="mailto:contato@fendamusic.com.br" target="_blank" rel="noopener">
                <span class="material-symbols-rounded">support_agent</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="about_contact">Fale conosco</span><span class="fs-row-sub">contato@fendamusic.com.br</span></div>
                <span class="material-symbols-rounded fs-row-arrow open_in_new_icon">open_in_new</span>
              </a>
              <button class="fs-row fs-row-link" type="button" id="fsAboutOpenHome">
                <span class="material-symbols-rounded">public</span>
                <div class="fs-row-text"><span class="fs-row-title">Abrir Fenda Music</span><span class="fs-row-sub">Voltar para a tela inicial</span></div>
                <span class="material-symbols-rounded fs-row-arrow">chevron_right</span>
              </button>
            </div>

            <div class="fs-about-footer">
              <div class="fs-about-footer-main">
                <span class="material-symbols-rounded">favorite</span>
                <span data-i18n="about_made_with">Feito para todos os estilos musicais</span>
              </div>
              <span class="fs-about-footer-dot">·</span>
              <span class="fs-about-footer-copyright">Fenda Music © ${new Date().getFullYear()}</span>
            </div>
          </div>
        `;
        document.body.appendChild(_aboutScreen);
        _aboutScreen.querySelector('#fsAboutBack').addEventListener('click', () => _aboutScreen.classList.remove('open'));
        _aboutScreen.querySelectorAll('[data-legal]').forEach((button) => button.addEventListener('click', () => _openLegalScreen(button.dataset.legal)));
        _aboutScreen.querySelector('#fsAboutOpenHome').addEventListener('click', () => {
            _aboutScreen.classList.remove('open');
            _overlay?.classList.remove('open');
            document.querySelector('.nav-btn[data-tab="inicio"]')?.click();
        });
        return _aboutScreen;
    }

    // ============================================================
    // PAINEL PRINCIPAL DE CONFIGURAÇÕES
    // ============================================================
    let _overlay = null;

    function _buildOverlay() {
        if (_overlay) return _overlay;
        _injectCss();

        const p = getPrefs();
        const email = localStorage.getItem('user_email') || window.AppState?.userEmail || '';

        _overlay = document.createElement('div');
        _overlay.className = 'fs-overlay';
        _overlay.innerHTML = `
          <div class="fs-header">
            <h1 data-i18n="settings_title">Configurações</h1>
            <button class="fs-close" id="fsCloseBtn"><span class="material-symbols-rounded">close</span></button>
          </div>
          <div class="fs-body">

            <div class="fs-section" data-i18n="settings_account">Conta</div>
            <div class="fs-card fs-account-card">
              <div class="fs-subsection-title" data-i18n="settings_profile_section">Perfil público</div>
              <label class="fs-avatar-row" for="fsAvatarFile">
                <div class="fs-avatar-wrap">
                  <img id="fsAvatarPreview" alt="" style="display:none">
                  <div class="fs-avatar-fallback" id="fsAvatarFallback"><span class="material-symbols-rounded">account_circle</span></div>
                  <div class="fs-avatar-edit"><span class="material-symbols-rounded">photo_camera</span></div>
                </div>
                <div class="fs-avatar-text">
                  <b data-i18n="account_photo">Foto de perfil</b>
                  <span data-i18n="account_change_photo">Trocar foto</span>
                </div>
              </label>
              <input type="file" id="fsAvatarFile" accept="image/*" style="display:none">

              <div class="fs-form">
                <label data-i18n="account_full_name">Nome completo</label>
                <input type="text" id="fsFullName" maxlength="80" placeholder="Seu nome" data-i18n-placeholder="account_full_name_placeholder">

                <label data-i18n="account_username">Nome de usuário</label>
                <div class="fs-input-prefix">
                  <span class="fs-at">@</span>
                  <input type="text" id="fsUsername" maxlength="20" placeholder="seu_usuario" data-i18n-placeholder="account_username_placeholder">
                </div>
                <p class="fs-hint" style="margin-top:6px" data-i18n="account_username_hint">Só letras minúsculas, números e _. Entre 3 e 20 caracteres.</p>

                <label data-i18n="account_bio">Frase do perfil</label>
                <input type="text" id="fsBio" maxlength="140" placeholder="Uma frase sobre você" data-i18n-placeholder="account_bio_placeholder">

                <button class="fs-btn" id="fsSaveProfileBtn" data-i18n="account_save_profile">Salvar alterações</button>
                <div class="fs-status" id="fsProfileStatus"></div>
              </div>

              <div class="fs-subsection-title" data-i18n="settings_access_section">Acesso à conta</div>
              <div class="fs-row" style="cursor:default">
                <span class="material-symbols-rounded">mail</span>
                <div class="fs-row-text">
                  <span class="fs-row-title" data-i18n="settings_email">E-mail</span>
                  <span class="fs-row-sub" id="fsEmail">${_esc(email) || '…'}</span>
                </div>
              </div>

              <div class="fs-form" id="fsEmailForm">
                <label>Novo e-mail</label>
                <input type="email" id="fsNewEmail" autocomplete="email" inputmode="email" placeholder="nome@exemplo.com">
                <p class="fs-hint">Enviaremos uma confirmação para concluir a alteração com segurança.</p>
                <button class="fs-btn ghost" id="fsEmailBtn" type="button">Alterar e-mail</button>
                <div class="fs-status" id="fsEmailStatus"></div>
              </div>

              <div class="fs-subsection-title" data-i18n="settings_security_section">Segurança da conta</div>
              <!-- Etapa 1: confirma a senha atual antes de liberar a troca -->
              <div class="fs-form" id="fsCurrentPassStep">
                <label data-i18n="settings_current_password">Senha atual</label>
                <input type="password" id="fsPassCurrent" autocomplete="current-password" placeholder="Digite sua senha atual">
                <button class="fs-btn ghost" id="fsCheckPassBtn" data-i18n="settings_confirm_current_password">Confirmar senha</button>
                <button class="fs-btn ghost fs-btn-link" id="fsForgotPassBtn" data-i18n="settings_forgot_password">Esqueci minha senha</button>
                <div class="fs-status" id="fsCurrentPassStatus"></div>
              </div>

              <!-- Etapa 2: só aparece depois da senha atual confirmada -->
              <div class="fs-form" id="fsPassForm" style="display:none">
                <label data-i18n="settings_new_password">Nova senha</label>
                <input type="password" id="fsPass1" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
                <label data-i18n="settings_confirm_password">Confirmar nova senha</label>
                <input type="password" id="fsPass2" autocomplete="new-password">
                <button class="fs-btn ghost" id="fsPassBtn" data-i18n="settings_change_password">Alterar senha</button>
                <div class="fs-status" id="fsPassStatus"></div>
              </div>
              <div class="fs-subsection-title" data-i18n="settings_actions_section">Ações da conta</div>
              <button class="fs-row" id="fsLogoutBtn">
                <span class="material-symbols-rounded">logout</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="settings_logout">Sair da conta</span></div>
              </button>
              <button class="fs-row danger" id="fsDeleteAccount">
                <span class="material-symbols-rounded">person_remove</span>
                <div class="fs-row-text">
                  <span class="fs-row-title" data-i18n="settings_delete_account">Excluir conta</span>
                  <span class="fs-row-sub" data-i18n="settings_delete_account_sub">Apaga sua conta e dados permanentemente</span>
                </div>
              </button>
            </div>

            <div class="fs-section" data-i18n="privacy_section">Privacidade e dados</div>
            <div class="fs-card" id="fsPrivacyCard">
              <div class="fs-form">
                <p class="fs-hint" style="margin-top:0" data-i18n="privacy_intro">Escolha quais dados o Fenda Music pode usar. Você pode alterar ou revogar essas escolhas a qualquer momento.</p>
              </div>
              <label class="fs-row">
                <span class="material-symbols-rounded">analytics</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="privacy_analytics">Análise de uso</span><span class="fs-row-sub" data-i18n="privacy_analytics_sub">Usa seu histórico de reprodução e buscas para medir o funcionamento e melhorar o app.</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsPrivacyAnalytics"><i></i></span>
              </label>
              <label class="fs-row">
                <span class="material-symbols-rounded">auto_awesome</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="privacy_recommendations">Recomendações personalizadas</span><span class="fs-row-sub" data-i18n="privacy_recommendations_sub">Usa seu histórico para adaptar sugestões, rankings pessoais e descobertas.</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsPrivacyRecommendations"><i></i></span>
              </label>
              <label class="fs-row">
                <span class="material-symbols-rounded">location_on</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="privacy_location">Localização precisa</span><span class="fs-row-sub" data-i18n="privacy_location_sub">Permite usar o GPS para recursos baseados na sua região. O navegador pedirá permissão.</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsPrivacyLocation"><i></i></span>
              </label>
              <label class="fs-row">
                <span class="material-symbols-rounded">devices</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="privacy_device">Dados técnicos do aparelho</span><span class="fs-row-sub" data-i18n="privacy_device_sub">Usa idioma, fuso horário e plataforma, sem guardar o identificador bruto do navegador.</span></div>
                <span class="fs-switch"><input type="checkbox" id="fsPrivacyDevice"><i></i></span>
              </label>
              <div class="fs-form">
                <div class="fs-status" id="fsPrivacyStatus" aria-live="polite"></div>
                <p class="fs-hint" data-i18n="privacy_data_note">Os dados autorizados ficam vinculados à sua conta e são apagados quando a conta é excluída. O Fenda não grava um IP no seu perfil; registros técnicos de segurança podem existir nos provedores de infraestrutura conforme as políticas deles.</p>
              </div>
            </div>

            <div class="fs-section" data-i18n="settings_general">Geral</div>
            <div class="fs-card">
              <button class="fs-row" id="fsOpenPlayback">
                <span class="material-symbols-rounded">play_circle</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="settings_playback">Reprodução</span><span class="fs-row-sub" data-i18n="settings_playback_sub">Downloads offline, crossfade e dados móveis</span></div>
                <span class="material-symbols-rounded fs-row-arrow">chevron_right</span>
              </button>
              <button class="fs-row" id="fsOpenA11y">
                <span class="material-symbols-rounded">accessibility_new</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="settings_a11y">Idioma e acessibilidade</span><span class="fs-row-sub" data-i18n="settings_a11y_sub">Idioma, tamanho de fonte, movimento</span></div>
                <span class="material-symbols-rounded fs-row-arrow">chevron_right</span>
              </button>
            </div>

            <div class="fs-section" data-i18n="settings_notifications">Notificações locais</div>
            <div class="fs-card" id="fsNotifCard">
              ${[
                ['rec',     'auto_awesome',          'settings_notif_daily',   'Recomendação diária'],
                ['release', 'new_releases',          'settings_notif_releases','Novidades de artistas'],
                ['weekly',  'insights',              'settings_notif_weekly',  'Resumo da semana'],
                ['streak',  'local_fire_department', 'settings_notif_streak',  'Marcos de sequência'],
              ].map(([key, icon, i18nKey, label]) => `
                <label class="fs-row">
                  <span class="material-symbols-rounded">${icon}</span>
                  <div class="fs-row-text"><span class="fs-row-title" data-i18n="${i18nKey}">${label}</span></div>
                  <span class="fs-switch">
                    <input type="checkbox" data-pref="${key}" ${p[key] ? 'checked' : ''}>
                    <i></i>
                  </span>
                </label>`).join('')}
            </div>
            <p class="fs-hint" data-i18n="settings_notif_hint">Controla as notificações geradas no aparelho (sino do app).</p>

            <div class="fs-section" data-i18n="settings_storage">Armazenamento</div>
            <div class="fs-card">
              <button class="fs-row" id="fsClearDl">
                <span class="material-symbols-rounded">download_for_offline</span>
                <div class="fs-row-text">
                  <span class="fs-row-title" data-i18n="settings_clear_downloads">Limpar downloads offline</span>
                  <span class="fs-row-sub" id="fsDlInfo">…</span>
                </div>
              </button>
              <button class="fs-row danger" id="fsForceUpdate">
                <span class="material-symbols-rounded">refresh</span>
                <div class="fs-row-text">
                  <span class="fs-row-title" data-i18n="settings_force_update">Forçar atualização do app</span>
                  <span class="fs-row-sub" data-i18n="settings_force_update_sub">Limpa o cache e recarrega</span>
                </div>
              </button>
            </div>

            <div class="fs-section" data-i18n="settings_about">Sobre</div>
            <div class="fs-card">
              <button class="fs-row" id="fsOpenAbout">
                <span class="material-symbols-rounded">info</span>
                <div class="fs-row-text"><span class="fs-row-title" data-i18n="settings_about_link">Sobre o Fenda Music</span><span class="fs-row-sub" data-i18n="settings_about_link_sub">Versão, termos, privacidade e suporte</span></div>
                <span class="material-symbols-rounded fs-row-arrow">chevron_right</span>
              </button>
            </div>
            <div class="fs-app-version"><span data-i18n="settings_version">versão</span> ${APP_VERSION}</div>
          </div>
        `;
        document.body.appendChild(_overlay);

        _overlay.querySelector('#fsCloseBtn').addEventListener('click', close);

        // e-mail da sessão
        window.supabaseClient?.auth.getSession().then(({ data }) => {
            const em = data?.session?.user?.email;
            if (em) _overlay.querySelector('#fsEmail').textContent = em;
        }).catch(() => {});

        // ── Perfil: popular campos com os dados atuais ──
        const profile = window.AppState?.userProfile || {};
        _overlay.querySelector('#fsFullName').value = profile.full_name || '';
        _overlay.querySelector('#fsUsername').value = profile.username || '';
        _overlay.querySelector('#fsBio').value = profile.bio || '';

        const avatarImg = _overlay.querySelector('#fsAvatarPreview');
        const avatarFallback = _overlay.querySelector('#fsAvatarFallback');
        function _showAvatar(url) {
            if (url) {
                avatarImg.src = url;
                avatarImg.style.display = 'block';
                avatarFallback.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarFallback.style.display = 'flex';
            }
        }
        _showAvatar(profile.avatar_url || null);

        let _pendingAvatarFile = null;
        const avatarFileInput = _overlay.querySelector('#fsAvatarFile');
        avatarFileInput.addEventListener('change', () => {
            const f = avatarFileInput.files[0];
            if (!f) return;
            _pendingAvatarFile = f;
            _showAvatar(URL.createObjectURL(f)); // preview local, some ao salvar
        });

        // ── Perfil: salvar alterações ──
        _overlay.querySelector('#fsSaveProfileBtn').addEventListener('click', async () => {
            const btn = _overlay.querySelector('#fsSaveProfileBtn');
            const status = _overlay.querySelector('#fsProfileStatus');
            const nameInput = _overlay.querySelector('#fsFullName');
            const userInput = _overlay.querySelector('#fsUsername');
            const bioInput = _overlay.querySelector('#fsBio');

            const newName = nameInput.value.trim();
            const newUsernameRaw = userInput.value.trim().toLowerCase();
            const newBio = bioInput.value.trim();

            status.className = 'fs-status';
            if (!newName) { status.classList.add('err'); status.textContent = window.t('account_name_required'); return; }
            if (newUsernameRaw && !/^[a-z0-9_]{3,20}$/.test(newUsernameRaw)) {
                status.classList.add('err');
                status.textContent = window.t('account_username_invalid');
                return;
            }
            if (!window.AppState?.userId) { status.classList.add('err'); status.textContent = 'Erro: sessão não encontrada.'; return; }

            btn.disabled = true;
            status.textContent = window.t('account_saving');

            // 1) foto (opcional) — reusa o mesmo helper do fluxo antigo
            let avatarUrl = profile.avatar_url || null;
            if (_pendingAvatarFile) {
                try {
                    const uploaded = await window.uploadFileToSupabase(_pendingAvatarFile, `avatars/${window.AppState.userId}`);
                    if (uploaded) avatarUrl = uploaded;
                } catch (e) {
                    btn.disabled = false;
                    status.classList.add('err');
                    status.textContent = 'Falha ao enviar a foto: ' + (e.message || e);
                    return;
                }
            }

            // 2) grava no perfil
            const updates = { full_name: newName, bio: newBio, avatar_url: avatarUrl };
            if (newUsernameRaw) updates.username = newUsernameRaw;

            const success = await window.updateUserProfile(window.AppState.userId, updates);
            btn.disabled = false;

            if (!success) {
                // updateUserProfile engole o erro do Supabase — a causa mais provável
                // com username é colisão (índice único), já que o formato foi
                // validado acima.
                status.classList.add('err');
                status.textContent = newUsernameRaw ? window.t('account_username_taken') : 'Erro ao salvar.';
                return;
            }

            window.AppState.userProfile.full_name = newName;
            window.AppState.userProfile.bio = newBio;
            window.AppState.userProfile.avatar_url = avatarUrl;
            if (newUsernameRaw) window.AppState.userProfile.username = newUsernameRaw;
            profile.full_name = newName;
            profile.bio = newBio;
            profile.avatar_url = avatarUrl;
            if (newUsernameRaw) profile.username = newUsernameRaw;
            _pendingAvatarFile = null;

            status.classList.add('ok');
            status.textContent = window.t('account_saved');
            window.renderProfile?.();
        });

        // ── Etapa 1: confirmar senha atual ──
        // Supabase Auth não tem endpoint de "verificar senha" isolado — o
        // jeito correto é chamar signInWithPassword com a senha digitada.
        // Se ela bater, o Supabase apenas reafirma a sessão já ativa (não
        // desloga nem cria uma sessão nova); se errar, retorna erro sem
        // efeito colateral nenhum na sessão atual.
        _overlay.querySelector('#fsCheckPassBtn').addEventListener('click', async () => {
            const btn = _overlay.querySelector('#fsCheckPassBtn');
            const s = _overlay.querySelector('#fsCurrentPassStatus');
            const currentPass = _overlay.querySelector('#fsPassCurrent').value;

            s.className = 'fs-status';
            if (!currentPass) { s.classList.add('err'); s.textContent = window.t('settings_current_password_required'); return; }
            if (!email) { s.classList.add('err'); s.textContent = 'Erro: e-mail não encontrado.'; return; }

            btn.disabled = true;
            s.textContent = window.t('settings_checking');
            const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password: currentPass });
            btn.disabled = false;

            if (error) {
                s.classList.add('err');
                s.textContent = window.t('settings_current_password_wrong');
                return;
            }

            // Senha confirmada — libera a etapa 2 e esconde a etapa 1
            s.classList.add('ok');
            s.textContent = window.t('settings_current_password_ok');
            _overlay.querySelector('#fsPassCurrent').value = '';
            setTimeout(() => {
                _overlay.querySelector('#fsCurrentPassStep').style.display = 'none';
                _overlay.querySelector('#fsPassForm').style.display = '';
                _overlay.querySelector('#fsPass1')?.focus();
            }, 500);
        });

        // ── Esqueci minha senha: manda e-mail de redefinição ──
        _overlay.querySelector('#fsForgotPassBtn').addEventListener('click', async () => {
            const btn = _overlay.querySelector('#fsForgotPassBtn');
            const s = _overlay.querySelector('#fsCurrentPassStatus');
            if (!email) { s.classList.add('err'); s.textContent = 'Erro: e-mail não encontrado.'; return; }

            btn.disabled = true;
            s.className = 'fs-status';
            s.textContent = window.t('settings_sending_reset');
            const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: new URL('reset-password.html', window.location.href).href,
            });
            btn.disabled = false;

            if (error) {
                s.classList.add('err');
                s.textContent = 'Erro: ' + error.message;
            } else {
                s.classList.add('ok');
                s.textContent = window.t('settings_reset_sent');
            }
        });

        // ── Etapa 2: definir a nova senha (só acessível após confirmar a atual) ──
        _overlay.querySelector('#fsPassBtn').addEventListener('click', async () => {
            const s = _overlay.querySelector('#fsPassStatus');
            const p1 = _overlay.querySelector('#fsPass1').value;
            const p2 = _overlay.querySelector('#fsPass2').value;
            s.className = 'fs-status';
            if (p1.length < 6) { s.classList.add('err'); s.textContent = 'A senha precisa de pelo menos 6 caracteres.'; return; }
            if (p1 !== p2)     { s.classList.add('err'); s.textContent = 'As senhas não coincidem.'; return; }
            s.textContent = 'Salvando…';
            const { error } = await window.supabaseClient.auth.updateUser({ password: p1 });
            if (error) { s.classList.add('err'); s.textContent = 'Erro: ' + error.message; }
            else {
                s.classList.add('ok'); s.textContent = 'Senha alterada!';
                _overlay.querySelector('#fsPass1').value = '';
                _overlay.querySelector('#fsPass2').value = '';
                // Volta pro estado inicial (etapa 1) pra próxima vez que abrir
                setTimeout(() => {
                    _overlay.querySelector('#fsPassForm').style.display = 'none';
                    _overlay.querySelector('#fsCurrentPassStep').style.display = '';
                    _overlay.querySelector('#fsCurrentPassStatus').className = 'fs-status';
                    _overlay.querySelector('#fsCurrentPassStatus').textContent = '';
                }, 1200);
            }
        });

        // toggles de notificação
        _overlay.querySelectorAll('[data-pref]').forEach(cb => {
            cb.addEventListener('change', () => setPref(cb.dataset.pref, cb.checked));
        });

        // ── Privacidade e dados ──
        const privacy = window.FendaPrivacy;
        if (privacy) {
            const privacyStatus = _overlay.querySelector('#fsPrivacyStatus');
            const privacyControls = [
                ['analytics', '#fsPrivacyAnalytics'],
                ['recommendations', '#fsPrivacyRecommendations'],
                ['location', '#fsPrivacyLocation'],
                ['device', '#fsPrivacyDevice'],
            ];

            const refreshPrivacyControls = async () => {
                const current = await privacy.load(window.AppState?.userId || null);
                privacyControls.forEach(([key, selector]) => {
                    const control = _overlay.querySelector(selector);
                    if (control) control.checked = privacy.isEnabled(key);
                });
                return current;
            };

            privacyControls.forEach(([key, selector]) => {
                const control = _overlay.querySelector(selector);
                if (!control) return;
                control.addEventListener('change', async () => {
                    const requested = control.checked;
                    privacyControls.forEach(([, otherSelector]) => {
                        const other = _overlay.querySelector(otherSelector);
                        if (other) other.disabled = true;
                    });
                    privacyStatus.className = 'fs-status';
                    privacyStatus.textContent = key === 'location' && requested
                        ? 'Aguardando a permissão de localização…'
                        : 'Salvando…';
                    try {
                        await privacy.setConsent(key, requested);
                        privacyStatus.classList.add('ok');
                        privacyStatus.textContent = window.t('privacy_saved');
                    } catch (error) {
                        control.checked = privacy.isEnabled(key);
                        privacyStatus.classList.add('err');
                        privacyStatus.textContent = key === 'location'
                            ? window.t('privacy_location_error')
                            : (error?.message || 'Não foi possível salvar essa preferência.');
                    } finally {
                        privacyControls.forEach(([, otherSelector]) => {
                            const other = _overlay.querySelector(otherSelector);
                            if (other) other.disabled = false;
                        });
                    }
                });
            });

            void refreshPrivacyControls().catch(() => {
                privacyStatus.className = 'fs-status err';
                privacyStatus.textContent = window.t('privacy_load_error');
            });
        }

        // ── Alteração de e-mail ──
        _overlay.querySelector('#fsEmailBtn').addEventListener('click', async () => {
            const btn = _overlay.querySelector('#fsEmailBtn');
            const input = _overlay.querySelector('#fsNewEmail');
            const status = _overlay.querySelector('#fsEmailStatus');
            const newEmail = input.value.trim().toLowerCase();
            status.className = 'fs-status';
            if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
                status.classList.add('err'); status.textContent = 'Digite um e-mail válido.'; return;
            }
            if (newEmail === String(_overlay.querySelector('#fsEmail').textContent || '').trim().toLowerCase()) {
                status.classList.add('err'); status.textContent = 'Este já é o e-mail atual da conta.'; return;
            }
            btn.disabled = true;
            status.textContent = 'Enviando confirmação…';
            try {
                const { error } = await window.supabaseClient.auth.updateUser({ email: newEmail });
                if (error) throw error;
                status.classList.add('ok');
                status.textContent = 'Confira seu e-mail para confirmar a alteração.';
                input.value = '';
            } catch (_) {
                status.classList.add('err');
                status.textContent = 'Não foi possível solicitar a alteração agora. Tente novamente mais tarde.';
            } finally {
                btn.disabled = false;
            }
        });

        // ── Navegação para telas próprias ──
        _overlay.querySelector('#fsOpenPlayback').addEventListener('click', () => _buildPlaybackScreen().classList.add('open'));
        _overlay.querySelector('#fsOpenA11y').addEventListener('click', () => _buildA11yScreen().classList.add('open'));
        _overlay.querySelector('#fsOpenAbout').addEventListener('click', () => _buildAboutScreen().classList.add('open'));

        // ── Sair da conta ──
        _overlay.querySelector('#fsLogoutBtn').addEventListener('click', () => {
            window.showConfirmDialog(window.t('confirm_logout_title'), window.t('confirm_logout_msg'), async () => {
                try {
                    AppState._sessionDisabled = true;
                    window.clearPlayerSession?.();
                    if (window.CacheDB) await window.CacheDB.clear();
                    await window.supabaseClient.auth.signOut();
                    localStorage.clear();
                } finally {
                    window.location.replace('index.html');
                }
            });
        });

        // ── Excluir conta ──
        _overlay.querySelector('#fsDeleteAccount').addEventListener('click', () => {
            window.showConfirmDialog(window.t('confirm_delete_title'), window.t('confirm_delete_msg'), async () => {
                const btn = _overlay.querySelector('#fsDeleteAccount');
                btn.style.opacity = '.6'; btn.style.pointerEvents = 'none';
                try {
                    AppState._sessionDisabled = true;
                    window.clearPlayerSession?.();
                    const { error } = await window.supabaseClient.rpc('delete_user_account');
                    if (error) throw error;
                    if (window.CacheDB) await window.CacheDB.clear();
                    localStorage.clear();
                    window.location.replace('index.html');
                } catch (e) {
                    btn.style.opacity = ''; btn.style.pointerEvents = '';
                    window.showToast('Não deu para excluir agora: ' + (e.message || e), 'error');
                }
            });
        });

        // downloads offline
        _refreshDlInfo();
        _overlay.querySelector('#fsClearDl').addEventListener('click', () => {
            window.showConfirmDialog('Limpar downloads', 'Apagar todas as músicas baixadas para offline?', async () => {
                try {
                    await new Promise((res, rej) => {
                        const req = indexedDB.deleteDatabase('FendaMusicAudio_v4');
                        req.onsuccess = res; req.onerror = rej;
                        req.onblocked = res; // apagará quando as abas soltarem
                    });
                    window.showToast?.('Downloads apagados — recarregando…', 'success');
                    setTimeout(() => location.reload(), 900); // player recria o banco no boot
                } catch {
                    window.showToast?.('Não deu para apagar agora — feche e reabra o app', 'error');
                }
            });
        });

        // forçar atualização (mesma lógica do limpar-cache.html, inline)
        _overlay.querySelector('#fsForceUpdate').addEventListener('click', () => {
            window.showConfirmDialog('Forçar atualização', 'Limpar o cache do app e recarregar?', async () => {
                try {
                    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
                    await Promise.all(regs.map(r => r.unregister()));
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                } catch {}
                location.reload();
            });
        });

        return _overlay;
    }

    async function _refreshDlInfo() {
        const el = _overlay?.querySelector('#fsDlInfo');
        if (!el) return;
        try {
            const est = await navigator.storage?.estimate?.();
            if (est?.usage) {
                const mb = (est.usage / (1024 * 1024)).toFixed(0);
                el.textContent = `~${mb} MB usados pelo app`;
                return;
            }
        } catch {}
        el.textContent = 'Músicas salvas para ouvir offline';
    }

    function open() {
        const panel = _buildOverlay();
        panel.scrollTop = 0;
        panel.classList.add('open');
        requestAnimationFrame(() => { if (panel.classList.contains('open')) panel.scrollTop = 0; });
    }
    function close() { _overlay?.classList.remove('open'); }

    window.FendaSettings = { open, close, getPrefs, getPlaybackPrefs, getAppPrefs };

    // ============================================================
    // ENVIAR MÚSICA PARA ANÁLISE
    // ============================================================
    let _subOverlay = null;

    function _buildSubmit() {
        if (_subOverlay) return _subOverlay;
        _injectCss();

        _subOverlay = document.createElement('div');
        _subOverlay.className = 'fs-overlay';
        _subOverlay.innerHTML = `
          <div class="fs-header">
            <h1 data-i18n="submit_title">Enviar música</h1>
            <button class="fs-close" id="fsSubClose"><span class="material-symbols-rounded">close</span></button>
          </div>
          <div class="fs-body">
            <p class="fs-hint" style="margin-top:0" data-i18n="submit_hint">
              Sua sugestão será analisada manualmente. Se aprovada, a música entra no catálogo do Fenda Music; por isso, nem todas as músicas estarão disponíveis.
            </p>
            <div class="fs-card"><div class="fs-form">
              <label data-i18n="submit_song_title">Título da música *</label>
              <input type="text" id="fsSubTitle" maxlength="120" placeholder="Ex.: Oceano">
              <label data-i18n="submit_artist">Artista *</label>
              <input type="text" id="fsSubArtist" maxlength="120" placeholder="Ex.: Djavan">
              <label data-i18n="submit_audio_file">Arquivo de áudio (opcional)</label>
              <label class="fs-file" for="fsSubFile">
                <span class="material-symbols-rounded">audio_file</span>
                <span class="name" id="fsSubFileName" data-i18n="submit_choose_file">Escolher arquivo (MP3, M4A…)</span>
              </label>
              <input type="file" id="fsSubFile" accept="audio/*" style="display:none">
              <button class="fs-btn" id="fsSubSend">
                <span class="material-symbols-rounded">send</span> <span data-i18n="submit_send">Enviar para análise</span>
              </button>
              <div class="fs-status" id="fsSubStatus"></div>
            </div></div>
          </div>
        `;
        document.body.appendChild(_subOverlay);

        _subOverlay.querySelector('#fsSubClose').addEventListener('click', () => _subOverlay.classList.remove('open'));

        const fileInput = _subOverlay.querySelector('#fsSubFile');
        fileInput.addEventListener('change', () => {
            const f = fileInput.files[0];
            _subOverlay.querySelector('#fsSubFileName').textContent = f ? f.name : window.t('submit_choose_file');
        });

        _subOverlay.querySelector('#fsSubSend').addEventListener('click', async () => {
            const btn    = _subOverlay.querySelector('#fsSubSend');
            const status = _subOverlay.querySelector('#fsSubStatus');
            const title  = _subOverlay.querySelector('#fsSubTitle').value.trim();
            const artist = _subOverlay.querySelector('#fsSubArtist').value.trim();
            const file   = fileInput.files[0] || null;

            status.className = 'fs-status';
            if (!title || !artist) { status.classList.add('err'); status.textContent = 'Título e artista são obrigatórios.'; return; }
            if (file && file.size > MAX_FILE_MB * 1024 * 1024) {
                status.classList.add('err');
                status.textContent = `Arquivo acima de ${MAX_FILE_MB} MB.`;
                return;
            }
            if (!window.AppState?.userId) { status.classList.add('err'); status.textContent = 'Faça login para enviar.'; return; }

            btn.disabled = true;

            // 1) arquivo (opcional) → bucket separado de submissões
            let fileUrl = null;
            if (file) {
                status.textContent = 'Enviando arquivo…';
                try {
                    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                    const path = `${window.AppState.userId}/${Date.now()}-${safe}`;
                    const { error } = await window.supabaseClient.storage
                        .from(SUBMISSIONS_BUCKET)
                        .upload(path, file, { cacheControl: '3600', upsert: false });
                    if (error) throw error;
                    const { data } = window.supabaseClient.storage.from(SUBMISSIONS_BUCKET).getPublicUrl(path);
                    fileUrl = data.publicUrl;
                } catch (e) {
                    btn.disabled = false;
                    status.classList.add('err');
                    status.textContent = 'Falha no arquivo: ' + (e.message || e);
                    return; // não insere registro pela metade
                }
            }

            // 2) registro da submissão
            status.textContent = 'Registrando…';
            const { error } = await window.supabaseClient.from('music_submissions').insert([{
                user_id: window.AppState.userId,
                title, artist,
                file_url: fileUrl,
            }]);
            btn.disabled = false;
            if (error) {
                status.classList.add('err');
                status.textContent = 'Erro: ' + error.message;
                return;
            }
            status.classList.add('ok');
            status.textContent = 'Enviado! Você será avisado se for aprovada.';
            _subOverlay.querySelector('#fsSubTitle').value = '';
            _subOverlay.querySelector('#fsSubArtist').value = '';
            fileInput.value = '';
            _subOverlay.querySelector('#fsSubFileName').textContent = window.t('submit_choose_file');
        });

        return _subOverlay;
    }

    window.FendaSubmit = { open: () => _buildSubmit().classList.add('open') };
})();
