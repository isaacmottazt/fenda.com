// Fenda Music — consentimento e dados de privacidade
// A coleta é opt-in: sem consentimento, o módulo não grava GPS, contexto
// técnico, analytics ou personalização no Supabase.
(function () {
    'use strict';

    const CONSENT_VERSION = '2026-08-26-consent-prompt-v1';
    const LOCAL_PREFIX = 'fenda_privacy_prefs_';
    const DEFAULTS = Object.freeze({
        analytics: false,
        recommendations: false,
        location: false,
        device: false,
        locationLatitude: null,
        locationLongitude: null,
        locationAccuracy: null,
        locationCapturedAt: null,
        locationSource: null,
        deviceTimezone: null,
        deviceLanguage: null,
        devicePlatform: null,
        consentVersion: CONSENT_VERSION,
        consentedAt: null,
        revokedAt: null,
    });

    let currentUserId = null;
    let prefs = { ...DEFAULTS };
    let loadPromise = null;
    const listeners = new Set();
    let consentPromptEl = null;
    let consentPromptPromise = null;

    function _storageKey(userId = currentUserId) {
        return userId ? `${LOCAL_PREFIX}${userId}` : `${LOCAL_PREFIX}anonymous`;
    }

    function _readLocal(userId) {
        try {
            const raw = localStorage.getItem(_storageKey(userId));
            return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
        } catch {
            return { ...DEFAULTS };
        }
    }

    function _writeLocal(userId, next) {
        try { localStorage.setItem(_storageKey(userId), JSON.stringify(next)); } catch {}
    }

    function _normalize(row) {
        return {
            ...DEFAULTS,
            analytics: row?.analytics_consent === true,
            recommendations: row?.recommendations_consent === true,
            location: row?.location_consent === true,
            device: row?.device_data_consent === true,
            locationLatitude: row?.location_latitude ?? null,
            locationLongitude: row?.location_longitude ?? null,
            locationAccuracy: row?.location_accuracy_m ?? null,
            locationCapturedAt: row?.location_captured_at ?? null,
            locationSource: row?.location_source ?? null,
            deviceTimezone: row?.device_timezone ?? null,
            deviceLanguage: row?.device_language ?? null,
            devicePlatform: row?.device_platform ?? null,
            consentVersion: row?.consent_version || CONSENT_VERSION,
            consentedAt: row?.consented_at ?? null,
            revokedAt: row?.revoked_at ?? null,
        };
    }

    function _toRow(userId, next) {
        return {
            user_id: userId,
            analytics_consent: Boolean(next.analytics),
            recommendations_consent: Boolean(next.recommendations),
            location_consent: Boolean(next.location),
            device_data_consent: Boolean(next.device),
            location_latitude: next.location ? next.locationLatitude : null,
            location_longitude: next.location ? next.locationLongitude : null,
            location_accuracy_m: next.location ? next.locationAccuracy : null,
            location_captured_at: next.location ? next.locationCapturedAt : null,
            location_source: next.location ? next.locationSource : null,
            device_timezone: next.device ? next.deviceTimezone : null,
            device_language: next.device ? next.deviceLanguage : null,
            device_platform: next.device ? next.devicePlatform : null,
            consent_version: CONSENT_VERSION,
            consented_at: next.consentedAt,
            revoked_at: next.revokedAt,
        };
    }

    function _emit() {
        const snapshot = { ...prefs };
        listeners.forEach(fn => { try { fn(snapshot); } catch {} });
        window.dispatchEvent(new CustomEvent('fenda:privacyChanged', { detail: snapshot }));
    }

    async function _resolveUserId() {
        if (currentUserId) return currentUserId;
        if (window.AppState?.userId) {
            currentUserId = window.AppState.userId;
            return currentUserId;
        }
        try {
            const { data } = await window.supabaseClient?.auth.getUser();
            currentUserId = data?.user?.id || null;
        } catch {}
        return currentUserId;
    }

    async function load(userId = null) {
        const id = userId || await _resolveUserId();
        if (!id) {
            prefs = _readLocal(null);
            _emit();
            return { ...prefs };
        }
        if (loadPromise && currentUserId === id) return loadPromise;
        currentUserId = id;
        loadPromise = (async () => {
            const local = _readLocal(id);
            try {
                const { data, error } = await window.supabaseClient
                    .from('user_privacy_settings')
                    .select('analytics_consent,recommendations_consent,location_consent,device_data_consent,location_latitude,location_longitude,location_accuracy_m,location_captured_at,location_source,device_timezone,device_language,device_platform,consent_version,consented_at,revoked_at')
                    .eq('user_id', id)
                    .maybeSingle();
                if (error) throw error;
                prefs = data ? _normalize(data) : local;
            } catch (error) {
                console.warn('[FendaPrivacy] Não foi possível carregar preferências:', error);
                prefs = local;
            }
            _writeLocal(id, prefs);
            _emit();
            return { ...prefs };
        })();
        try { return await loadPromise; } finally { loadPromise = null; }
    }

    function getPrefs() { return { ...prefs }; }
    function isEnabled(kind) { return prefs[kind] === true; }

    async function _persist(next) {
        const id = await _resolveUserId();
        if (!id) throw new Error('Sessão não encontrada.');
        const { error } = await window.supabaseClient
            .from('user_privacy_settings')
            .upsert(_toRow(id, next), { onConflict: 'user_id' });
        if (error) throw error;
        prefs = { ...DEFAULTS, ...next };
        _writeLocal(id, prefs);
        _emit();
        return { ...prefs };
    }

    function _deviceContext() {
        let timezone = null;
        try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch {}
        const platform = navigator.userAgentData?.platform || navigator.platform || null;
        return {
            timezone: timezone ? String(timezone).slice(0, 80) : null,
            language: String(navigator.language || '').slice(0, 20) || null,
            platform: platform ? String(platform).slice(0, 80) : null,
        };
    }

    function _locationError(error) {
        const messages = {
            1: 'Permissão de localização recusada. Você pode ativá-la nas permissões do navegador.',
            2: 'Não foi possível determinar sua localização.',
            3: 'A localização demorou demais para responder. Tente novamente.',
        };
        return new Error(messages[error?.code] || 'Não foi possível obter sua localização.');
    }

    function _getPreciseLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Este navegador não oferece localização.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            });
        });
    }

    async function setConsent(kind, enabled) {
        if (!['analytics', 'recommendations', 'location', 'device'].includes(kind)) {
            throw new Error('Consentimento desconhecido.');
        }
        const next = { ...prefs };
        if (!enabled) {
            next[kind] = false;
            if (kind === 'location') {
                next.locationLatitude = null;
                next.locationLongitude = null;
                next.locationAccuracy = null;
                next.locationCapturedAt = null;
                next.locationSource = null;
            }
            if (kind === 'device') {
                next.deviceTimezone = null;
                next.deviceLanguage = null;
                next.devicePlatform = null;
            }
            next.revokedAt = new Date().toISOString();
            return _persist(next);
        }

        if (kind === 'location') {
            const position = await _getPreciseLocation().catch(error => { throw _locationError(error); });
            next.location = true;
            next.locationLatitude = Number(position.coords.latitude.toFixed(6));
            next.locationLongitude = Number(position.coords.longitude.toFixed(6));
            next.locationAccuracy = Number.isFinite(position.coords.accuracy) ? Number(position.coords.accuracy.toFixed(2)) : null;
            next.locationCapturedAt = new Date().toISOString();
            next.locationSource = 'browser-geolocation';
        } else if (kind === 'device') {
            const context = _deviceContext();
            next.device = true;
            next.deviceTimezone = context.timezone;
            next.deviceLanguage = context.language;
            next.devicePlatform = context.platform;
        } else {
            next[kind] = true;
        }
        next.consentedAt = next.consentedAt || new Date().toISOString();
        next.revokedAt = null;
        return _persist(next);
    }

    async function clearAllCollectedData() {
        const id = await _resolveUserId();
        if (!id) return false;
        try {
            await window.supabaseClient.from('user_privacy_settings').delete().eq('user_id', id);
            prefs = { ...DEFAULTS };
            _writeLocal(id, prefs);
            _emit();
            return true;
        } catch (error) {
            console.warn('[FendaPrivacy] Falha ao apagar dados de privacidade:', error);
            return false;
        }
    }

    function onChange(fn) {
        if (typeof fn !== 'function') return () => {};
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    function hasDecision() {
        // Preferências criadas antes do aviso inicial precisam ser revisadas uma vez.
        return Boolean((prefs.consentedAt || prefs.revokedAt) && prefs.consentVersion === CONSENT_VERSION);
    }

    async function saveChoices(selection = {}) {
        const next = { ...prefs };
        next.analytics = Boolean(selection.analytics);
        next.recommendations = Boolean(selection.recommendations);
        next.location = Boolean(selection.location);
        next.device = Boolean(selection.device);

        if (next.location) {
            const position = await _getPreciseLocation().catch(error => { throw _locationError(error); });
            next.locationLatitude = Number(position.coords.latitude.toFixed(6));
            next.locationLongitude = Number(position.coords.longitude.toFixed(6));
            next.locationAccuracy = Number.isFinite(position.coords.accuracy) ? Number(position.coords.accuracy.toFixed(2)) : null;
            next.locationCapturedAt = new Date().toISOString();
            next.locationSource = 'browser-geolocation';
        } else {
            next.locationLatitude = null;
            next.locationLongitude = null;
            next.locationAccuracy = null;
            next.locationCapturedAt = null;
            next.locationSource = null;
        }

        if (next.device) {
            const context = _deviceContext();
            next.deviceTimezone = context.timezone;
            next.deviceLanguage = context.language;
            next.devicePlatform = context.platform;
        } else {
            next.deviceTimezone = null;
            next.deviceLanguage = null;
            next.devicePlatform = null;
        }

        next.consentedAt = new Date().toISOString();
        next.revokedAt = next.analytics || next.recommendations || next.location || next.device ? null : next.consentedAt;
        return _persist(next);
    }

    function _promptText(key, fallback) {
        try {
            const translated = window.t?.(key);
            return translated && translated !== key ? translated : fallback;
        } catch { return fallback; }
    }

    function _injectConsentPromptCss() {
        if (document.getElementById('fenda-consent-prompt-css')) return;
        const style = document.createElement('style');
        style.id = 'fenda-consent-prompt-css';
        style.textContent = `
          .fenda-consent-backdrop{position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(3,2,8,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
          .fenda-consent-card{width:min(560px,100%);max-height:calc(100vh - 28px);overflow:auto;background:linear-gradient(145deg,#1c1230,#0d0918 72%);border:1px solid rgba(192,132,252,.42);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.55),0 0 45px rgba(146,76,255,.16);padding:22px 18px 18px;color:#fff}
          .fenda-consent-card h2{font-size:20px;line-height:1.15;margin:0 0 8px;font-weight:900;letter-spacing:-.25px}
          .fenda-consent-card>p{font-size:13px;line-height:1.5;color:rgba(255,255,255,.68);margin:0 0 15px}
          .fenda-consent-options{display:grid;gap:8px}
          .fenda-consent-option{display:flex;align-items:flex-start;gap:11px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:rgba(255,255,255,.045);cursor:pointer}
          .fenda-consent-option:has(input:checked){border-color:rgba(192,132,252,.55);background:rgba(146,76,255,.13)}
          .fenda-consent-option input{width:18px;height:18px;accent-color:#924cff;flex:0 0 auto;margin:1px 0 0}
          .fenda-consent-option strong{display:block;font-size:13px;margin-bottom:3px}
          .fenda-consent-option small{display:block;color:rgba(255,255,255,.55);font-size:11.5px;line-height:1.4}
          .fenda-consent-status{min-height:18px;margin:12px 0 0;color:#fbbf24;font-size:12px;line-height:1.4}
          .fenda-consent-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
          .fenda-consent-actions button{flex:1;min-width:130px;border-radius:14px;padding:12px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:#fff;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07)}
          .fenda-consent-actions button.primary{border:none;background:linear-gradient(135deg,#924cff,#6a2ad4)}
          .fenda-consent-actions button:disabled{opacity:.5;cursor:wait}
          .fenda-consent-foot{font-size:10.5px;line-height:1.45;color:rgba(255,255,255,.38);margin:12px 2px 0}
        `;
        document.head.appendChild(style);
    }

    function _closeConsentPrompt() {
        if (consentPromptEl) consentPromptEl.remove();
        consentPromptEl = null;
    }

    function maybePrompt() {
        if (hasDecision()) return Promise.resolve(false);
        if (consentPromptPromise) return consentPromptPromise;
        consentPromptPromise = new Promise(resolve => {
            _injectConsentPromptCss();
            const t = _promptText;
            const backdrop = document.createElement('div');
            backdrop.className = 'fenda-consent-backdrop';
            backdrop.setAttribute('role', 'dialog');
            backdrop.setAttribute('aria-modal', 'true');
            backdrop.setAttribute('aria-labelledby', 'fendaConsentTitle');
            backdrop.innerHTML = `
              <section class="fenda-consent-card">
                <h2 id="fendaConsentTitle">${t('privacy_prompt_title', 'Escolha como seus dados serão usados')}</h2>
                <p>${t('privacy_prompt_intro', 'Antes de continuar, escolha quais informações o Fenda Music pode usar. Nenhuma dessas opções é ativada sem a sua decisão.')}</p>
                <div class="fenda-consent-options">
                  <label class="fenda-consent-option"><input type="checkbox" data-consent-kind="analytics"><span><strong>${t('privacy_analytics', 'Análise de uso')}</strong><small>${t('privacy_analytics_sub', 'Usa histórico de reprodução e buscas para melhorar o app.')}</small></span></label>
                  <label class="fenda-consent-option"><input type="checkbox" data-consent-kind="recommendations"><span><strong>${t('privacy_recommendations', 'Recomendações personalizadas')}</strong><small>${t('privacy_recommendations_sub', 'Usa seu histórico para adaptar sugestões e descobertas.')}</small></span></label>
                  <label class="fenda-consent-option"><input type="checkbox" data-consent-kind="location"><span><strong>${t('privacy_location', 'Localização precisa')}</strong><small>${t('privacy_location_sub', 'Solicita o GPS preciso somente depois que você confirmar esta opção.')}</small></span></label>
                  <label class="fenda-consent-option"><input type="checkbox" data-consent-kind="device"><span><strong>${t('privacy_device', 'Dados técnicos do aparelho')}</strong><small>${t('privacy_device_sub', 'Usa idioma, fuso horário e plataforma, sem identificador bruto do navegador.')}</small></span></label>
                </div>
                <div class="fenda-consent-status" id="fendaConsentStatus" aria-live="polite"></div>
                <div class="fenda-consent-actions">
                  <button type="button" data-consent-decline>${t('privacy_prompt_decline', 'Não aceitar agora')}</button>
                  <button type="button" data-consent-all>${t('privacy_prompt_all', 'Aceitar tudo')}</button>
                  <button type="button" class="primary" data-consent-save>${t('privacy_prompt_save', 'Salvar escolhas')}</button>
                </div>
                <p class="fenda-consent-foot">${t('privacy_prompt_footer', 'Você pode mudar ou revogar essas escolhas em Configurações → Privacidade e dados. A localização precisa só é lida com a permissão do navegador.')}</p>
              </section>`;
            document.body.appendChild(backdrop);
            consentPromptEl = backdrop;
            const status = backdrop.querySelector('#fendaConsentStatus');
            const controls = [...backdrop.querySelectorAll('[data-consent-kind]')];
            const setBusy = busy => backdrop.querySelectorAll('button').forEach(button => { button.disabled = busy; });
            const finish = accepted => { _closeConsentPrompt(); resolve(accepted); };
            const save = async all => {
                const selected = Object.fromEntries(controls.map(control => [control.dataset.consentKind, all ? true : control.checked]));
                setBusy(true);
                status.textContent = selected.location ? t('privacy_prompt_location_wait', 'Aguardando a permissão de localização…') : t('privacy_prompt_saving', 'Salvando suas escolhas…');
                try {
                    await saveChoices(selected);
                    finish(true);
                } catch (error) {
                    setBusy(false);
                    status.textContent = error?.message || t('privacy_prompt_error', 'Não foi possível salvar agora. Tente novamente.');
                }
            };
            backdrop.querySelector('[data-consent-all]').addEventListener('click', () => save(true));
            backdrop.querySelector('[data-consent-save]').addEventListener('click', () => save(false));
            backdrop.querySelector('[data-consent-decline]').addEventListener('click', async () => {
                try { await saveChoices({}); }
                catch {
                    const now = new Date().toISOString();
                    prefs = { ...DEFAULTS, consentedAt: now, revokedAt: now };
                    _writeLocal(currentUserId, prefs);
                    _emit();
                }
                finish(false);
            });
            controls[0]?.focus();
        });
        return consentPromptPromise.finally(() => { consentPromptPromise = null; });
    }

    window.FendaPrivacy = {
        CONSENT_VERSION,
        load,
        getPrefs,
        isEnabled,
        setConsent,
        clearAllCollectedData,
        onChange,
        hasDecision,
        saveChoices,
        maybePrompt,
    };

    document.addEventListener('fenda:userLoaded', event => {
        const id = event.detail?.userId;
        if (id) void load(id);
    });
})();
