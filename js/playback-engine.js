// ============================================================
// PLAYBACK ENGINE — aplica de verdade as prefs de Reprodução
// definidas em Configurações (settings.js).
//
// Por que um arquivo separado: o motor de áudio principal
// (player-audio-lyrics.js) já tem o listener de 'ended' que decide
// o próximo passo (repeat-one vs handleNextTrack). Interceptar
// autoplay/crossfade ali dentro criaria uma dependência de ordem de
// carregamento frágil. Aqui a gente registra os PRÓPRIOS listeners,
// coordenando com os já existentes através de flags em AppState, sem
// reescrever nada do motor original.
//
// O que cada pref faz de verdade:
//   autoplay      → se desligado, a música simplesmente pausa ao
//                    terminar em vez de chamar handleNextTrack().
//   normalize     → liga um DynamicsCompressorNode via Web Audio API
//                    no <audio>, suavizando picos de volume entre faixas.
//   crossfade     → nos últimos N segundos da faixa, o volume desce
//                    enquanto a próxima é chamada, criando a transição.
//                    (Sem crossfade real de 2 faixas simultâneas — o
//                    <audio> é um elemento só — mas o efeito percebido
//                    de "sumir uma e entrar a outra" é o fade + troca.)
//   dataSaver     → preload do <audio> vira 'none' em vez do
//                    'metadata' padrão do browser, evitando os
//                    primeiros segundos de buffer antes de tocar.
// ============================================================

(function () {
    'use strict';

    let _prefs = null;
    let _audioCtx = null;
    let _sourceNode = null;
    let _compressorNode = null;
    let _crossfadeTimer = null;
    let _fading = false;
    let _audioGraphPending = false;
    let _audioGraphDisabled = false;

    function _getPrefs() {
        if (window.FendaSettings?.getPlaybackPrefs) return window.FendaSettings.getPlaybackPrefs();
        try { return JSON.parse(localStorage.getItem('fenda_playback_prefs') || '{}'); }
        catch { return {}; }
    }

    function _applyDataSaver() {
        if (!DOM.audio) return;
        DOM.audio.preload = _prefs.dataSaver ? 'none' : 'metadata';
    }

    // ── Normalização de volume via Web Audio API ──
    // O <audio> só é conectado ao grafo depois que o AudioContext está
    // realmente 'running'. Alguns WebViews deixam o contexto 'suspended'
    // mesmo após o play(), e conectar antes disso silencia a saída inteira.
    // Enquanto o contexto não estiver pronto, o áudio permanece nativo.
    function _shouldKeepNativeAudio() {
        const userAgent = window.navigator?.userAgent || '';
        const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
        const coarsePointer = typeof window.matchMedia === 'function'
            && window.matchMedia('(pointer: coarse)').matches;
        return mobileUserAgent || coarsePointer;
    }

    function _disableAudioGraph(context = _audioCtx) {
        _audioGraphPending = false;
        _audioGraphDisabled = true;
        if (context && typeof context.close === 'function') {
            context.close().catch(() => {});
        }
        if (_audioCtx === context) _audioCtx = null;
    }

    function _ensureAudioGraph() {
        // Em celulares/WebViews, a saída nativa é mais confiável que
        // MediaElementSource. O progresso pode continuar mesmo quando o
        // AudioContext está ativo, mas não entrega som ao alto-falante.
        if (_shouldKeepNativeAudio()) {
            _audioGraphDisabled = true;
            return;
        }
        if (_sourceNode || _audioGraphPending || _audioGraphDisabled || !DOM.audio || !_prefs.normalize) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) {
                _audioGraphDisabled = true;
                return; // navegador sem suporte — áudio nativo continua ativo
            }

            const context = new Ctx();
            _audioCtx = context;
            _audioGraphPending = true;

            const activateGraph = () => {
                if (_audioCtx !== context) return;
                if (context.state !== 'running') {
                    // Não criamos MediaElementSource enquanto suspenso:
                    // assim o browser mantém a saída nativa do <audio>.
                    _disableAudioGraph(context);
                    return;
                }
                try {
                    _sourceNode = context.createMediaElementSource(DOM.audio);
                    _compressorNode = context.createDynamicsCompressor();
                    _compressorNode.threshold.value = -24;
                    _compressorNode.knee.value = 24;
                    _compressorNode.ratio.value = 4;
                    _compressorNode.attack.value = 0.02;
                    _compressorNode.release.value = 0.25;
                    _audioGraphPending = false;
                    _wireGraph();
                } catch {
                    // Se outro módulo já conectou o elemento, o fallback
                    // nativo fica preservado porque o source não foi criado.
                    _sourceNode = null;
                    _compressorNode = null;
                    _disableAudioGraph(context);
                }
            };

            const resumePromise = context.state === 'suspended'
                ? context.resume()
                : Promise.resolve();
            Promise.resolve(resumePromise).then(activateGraph).catch(() => _disableAudioGraph(context));
        } catch {
            // Qualquer falha na Web Audio API não pode impedir o <audio>
            // nativo de continuar carregando e reproduzindo.
            _disableAudioGraph();
        }
    }

    function _wireGraph() {
        if (!_sourceNode || !_audioCtx || _audioCtx.state !== 'running') return false;
        _sourceNode.disconnect();
        if (_prefs.normalize && _compressorNode) {
            _sourceNode.connect(_compressorNode);
            _compressorNode.connect(_audioCtx.destination);
        } else {
            _sourceNode.connect(_audioCtx.destination);
        }
        return true;
    }

    function _applyNormalize() {
        // O contexto de áudio só pode iniciar após gesto do usuário
        // (política dos navegadores) — por isso criamos no primeiro play.
        // Em dispositivos touch, manter o <audio> nativo evita silêncio.
        if (_shouldKeepNativeAudio()) return;
        if (_sourceNode) _wireGraph();
    }

    // ── Crossfade ──
    // Antes disso, o "crossfade" só reduzia o volume a 0 nos últimos
    // segundos e deixava a música tocar em silêncio até o fim natural —
    // a troca de faixa só acontecia depois, no evento 'ended', sem
    // nenhuma transição real. Na prática parecia que a opção não fazia
    // nada. Agora, quando o fade termina (volume chega a 0), a próxima
    // faixa é chamada imediatamente — a sensação de "uma se funde na
    // outra" vem do fade-out finalizando bem no momento da troca.
    let _crossfadeTriggered = false;

    function _clearCrossfadeWatch() {
        if (_crossfadeTimer) { clearInterval(_crossfadeTimer); _crossfadeTimer = null; }
        _fading = false;
        _crossfadeTriggered = false;
        if (DOM.audio) DOM.audio.volume = 1;
    }

    function _watchForCrossfade() {
        _clearCrossfadeWatch();
        if (!_prefs.crossfade || !DOM.audio) return;

        _crossfadeTimer = setInterval(() => {
            if (!DOM.audio || DOM.audio.paused || _crossfadeTriggered) return;
            const dur = DOM.audio.duration || 0;
            const remaining = dur - DOM.audio.currentTime;
            const fadeSec = Math.max(1, Math.min(12, _prefs.crossfadeSec || 4));

            if (dur > 0 && remaining <= fadeSec && remaining > 0) {
                _fading = true;
                const vol = Math.max(0, remaining / fadeSec);
                DOM.audio.volume = vol;

                // O fade nunca decide a próxima faixa. Deixar o evento
                // `ended` fazer essa troca evita avançar duas vezes e mantém
                // repeat-one, repeat-all e shuffle com uma única autoridade.
                if (vol <= 0.02) _crossfadeTriggered = true;
            } else if (!_fading || remaining > fadeSec) {
                DOM.audio.volume = 1;
            }
        }, 150);
    }

    // ── Autoplay: intercepta o fim da faixa ──
    // player-audio-lyrics.js já escuta 'ended' e chama handleNextTrack().
    // Aqui a gente escuta em fase de captura, ANTES do outro listener,
    // e se autoplay estiver desligado, para a propagação do evento —
    // assim o listener original nunca dispara handleNextTrack().
    function _installAutoplayGuard() {
        if (!DOM.audio) return;
        DOM.audio.addEventListener('ended', (e) => {
            window._showFendaError?.('[DIAG] autoplayGuard viu "ended". prefs.autoplay=' + _prefs.autoplay + ' repeatMode=' + AppState.repeatMode);
            if (_prefs.autoplay === false && AppState.repeatMode === 0) {
                window._showFendaError?.('[DIAG] autoplayGuard BLOQUEOU o avanço (autoplay desligado)');
                e.stopImmediatePropagation();
                AppState.playing = false;
                DOM.audio.volume = 1;
                if (typeof window.updatePlayerUIState === 'function') window.updatePlayerUIState();
                if (typeof window.flushListenTime === 'function') window.flushListenTime(1);
            }
        }, true); // capture: roda antes do listener em bubble de player-audio-lyrics.js
    }

    function _onPlay() {
        _ensureAudioGraph();
        _applyNormalize();
        _watchForCrossfade();
        if (DOM.audio) DOM.audio.volume = 1;
    }

    function _refresh(newPrefs) {
        _prefs = newPrefs || _getPrefs();
        if (_prefs.normalize) _audioGraphDisabled = false;
        _applyDataSaver();
        _ensureAudioGraph();
        _applyNormalize();
        _watchForCrossfade();
    }

    function _init() {
        if (!DOM.audio) { setTimeout(_init, 300); return; } // DOM ainda não montado
        _prefs = _getPrefs();
        _applyDataSaver();
        _installAutoplayGuard();
        DOM.audio.addEventListener('play', _onPlay);
        DOM.audio.addEventListener('pause', () => { if (!_fading) DOM.audio.volume = 1; });

        window.addEventListener('fenda:playbackPrefsChanged', (e) => _refresh(e.detail));
    }

    document.addEventListener('DOMContentLoaded', _init);
    if (document.readyState !== 'loading') _init();
})();
