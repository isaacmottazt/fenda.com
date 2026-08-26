// Fenda Music — consentimento e dados de privacidade
// A coleta é opt-in: sem consentimento, o módulo não grava GPS, contexto
// técnico, analytics ou personalização no Supabase.
(function () {
    'use strict';

    const CONSENT_VERSION = '2026-08-26';
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

    window.FendaPrivacy = {
        CONSENT_VERSION,
        load,
        getPrefs,
        isEnabled,
        setConsent,
        clearAllCollectedData,
        onChange,
    };

    document.addEventListener('fenda:userLoaded', event => {
        const id = event.detail?.userId;
        if (id) void load(id);
    });
})();
