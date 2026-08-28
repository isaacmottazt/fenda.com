// themes.js v6 - Sistema de variáveis CSS dinâmicas

class FendaThemes {
  constructor() {
    this.savedColor = localStorage.getItem('fenda-color') || '#7c3aed';
    this.savedMode = localStorage.getItem('fenda-mode') || 'dark';
    this.root = document.documentElement;
    this.init();
  }

  hexToHSL(hex) {
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max) {
        case r: h = ((g-b)/d + (g<b?6:0))/6; break;
        case g: h = ((b-r)/d + 2)/6; break;
        case b: h = ((r-g)/d + 4)/6; break;
      }
    }
    return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
  }

  generatePalette(hex) {
    const { h, s } = this.hexToHSL(hex);
    return {
      base: hex,
      hi:   `hsl(${h},${Math.min(s+5,100)}%,65%)`,
      up:   `hsl(${h},${Math.min(s+5,100)}%,75%)`,
      dark: `hsl(${h},${Math.min(s+5,100)}%,28%)`,
      darker: `hsl(${h},${Math.min(s+5,100)}%,20%)`,
      glow: `hsla(${h},${Math.min(s+5,100)}%,50%,0.45)`,
      soft: `hsla(${h},${Math.min(s+5,100)}%,50%,0.15)`,
      line: `hsla(${h},${Math.min(s+5,100)}%,50%,0.25)`,
      grad: `linear-gradient(135deg, hsl(${h},${Math.min(s+5,100)}%,38%), hsl(${(h+30)%360},${Math.min(s+5,100)}%,55%))`,
      gradDark: `linear-gradient(135deg, hsl(${h},${Math.min(s+5,100)}%,35%), hsl(${h},${Math.min(s+5,100)}%,20%), hsl(${h},${Math.min(s+5,100)}%,10%))`,
      gradProfile: `linear-gradient(145deg, hsl(${h},${Math.min(s+5,100)}%,40%), hsl(${h},${Math.min(s+5,100)}%,20%), hsl(${h},${Math.min(s+5,100)}%,5%))`,
      gradMagenta: `linear-gradient(135deg, hsl(${(h-30+360)%360},${Math.min(s+5,100)}%,35%), hsl(${h},${Math.min(s+5,100)}%,40%))`,
      gradHero: `linear-gradient(120deg, hsl(0,0%,100%) 25%, hsl(${h},${Math.min(s+5,100)}%,60%) 65%, hsl(${(h+60)%360},100%,50%) 100%)`,
    };
  }

  apply(color, mode) {
    if (this.root.dataset.fendaDesign === 'admin') {
      this.applyAdmin();
      return;
    }
    mode = 'dark'; // modo claro removido do app — sempre escuro
    const p = this.generatePalette(color);
    const L = mode === 'light';

    // Cores base da aplicação
    const bg     = L ? '#f8f8fc' : '#0a0a0f';
    const bg2    = L ? '#f2f2f8' : '#0f0f1a';
    const bg3    = L ? '#e8e8f0' : '#07070c';
    const surf   = L ? '#ffffff' : '#1c1826';
    const surf2  = L ? '#f5f5fb' : '#12101c';
    const navBg  = L ? 'rgba(248,248,252,0.95)' : 'rgba(10,10,15,0.92)';
    const ink    = L ? '#111118' : '#ffffff';
    const inkMid = L ? 'rgba(17,17,24,0.62)' : 'rgba(255,255,255,0.65)';
    const inkLow = L ? 'rgba(17,17,24,0.42)' : 'rgba(255,255,255,0.40)';
    const inkFnt = L ? 'rgba(17,17,24,0.26)' : 'rgba(255,255,255,0.22)';
    const border = L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    const cardBg = L ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';
    const inptBg = L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)';
    const playerBg = L
      ? `linear-gradient(145deg, hsl(${this.hexToHSL(color).h},30%,92%), #f8f8fc)`
      : `linear-gradient(145deg, hsl(${this.hexToHSL(color).h},40%,8%), #050305)`;

    // ATUALIZA AS VARIÁVEIS CSS GLOBAIS
    this.root.style.setProperty('--primary-base', p.base);
    this.root.style.setProperty('--primary-hi', p.hi);
    this.root.style.setProperty('--primary-up', p.up);
    this.root.style.setProperty('--primary-dark', p.dark);
    this.root.style.setProperty('--primary-darker', p.darker);
    this.root.style.setProperty('--primary-glow', p.glow);
    this.root.style.setProperty('--primary-soft', p.soft);
    this.root.style.setProperty('--primary-line', p.line);
    this.root.style.setProperty('--primary-grad', p.grad);
    this.root.style.setProperty('--primary-grad-dark', p.gradDark);
    this.root.style.setProperty('--primary-grad-light', p.gradMagenta);
    this.root.style.setProperty('--grad-hero', p.gradHero);
    this.root.style.setProperty('--grad-profile', p.gradProfile);
    this.root.style.setProperty('--grad-magenta', p.gradMagenta);

    // Cores secundárias
    this.root.style.setProperty('--secondary-hi', p.up);
    this.root.style.setProperty('--secondary-glow', p.glow);
    this.root.style.setProperty('--secondary-soft', p.soft);

    // INJETA CSS PARA ELEMENTOS ESPECÍFICOS QUE NÃO USAM VARIÁVEIS
    const styleEl = document.getElementById('fenda-theme-inject') || (() => {
      const el = document.createElement('style');
      el.id = 'fenda-theme-inject';
      document.head.appendChild(el);
      return el;
    })();

    styleEl.textContent = `
      /* APLICAÇÃO DE TEMA EM TODOS OS ELEMENTOS */
      body{background:${bg}!important;color:${ink}!important}
      .app-container{background:linear-gradient(180deg,${bg2} 0%,${bg3} 100%)!important}

      .nav-bar{background:${navBg}!important;border-top-color:${border}!important}
      .nav-btn{color:${inkFnt}!important}
      .nav-btn.active{color:${p.base}!important}
      .nav-btn p,.nav-btn span{color:inherit!important}

      .player-bottom-bar{background:${L?'rgba(255,255,255,0.9)':'rgba(18,12,30,0.75)'}!important;box-shadow:0 8px 32px rgba(0,0,0,0.2),0 0 0 1px ${p.base}20!important}
      .mini-ring-fill{stroke:${p.hi}!important}
      .mini-ctrl-play{background:${p.base}!important;box-shadow:0 2px 12px ${p.glow}!important}
      .mini-info h4{color:${ink}!important}
      .mini-info p{color:${inkMid}!important}

      .lyrics-full-screen{background:${playerBg}!important}
      .player-bg{background:${p.grad}!important}
      .ctrl-play{background:${p.grad}!important;box-shadow:0 4px 20px ${p.glow}!important}
      .player-seek-fill{background:${p.base}!important}
      .player-seek-thumb{background:${p.base}!important}
      .player-mini-controls{background:${L?surf+'f5':'rgba(6,4,14,0.97)'}!important;border-top-color:${p.base}14!important}
      .player-mini-play{background:${p.grad}!important}
      .player-mini-info span:first-child{color:${ink}!important}
      .player-mini-info span:last-child{color:${inkLow}!important}
      #playerExpandedTitle{color:${L?ink:'#fff'}!important}
      #playerExpandedArtist{color:${L?inkMid:'rgba(255,255,255,0.6)'}!important}
      #currentTime,#totalTime{color:${inkLow}!important}
      .ctrl-extra,.ctrl-main{color:${L?inkMid:'rgba(255,255,255,0.7)'}!important}
      .player-fav-big,.player-action-btn{color:${L?inkLow:'rgba(255,255,255,0.5)'}!important}
      .player-fav-big.active,.player-action-btn.active{color:#f472b6!important}
      .player-lyrics-header{color:${inkMid}!important}
      .lyrics-container-content p{color:${L?'rgba(28,24,40,0.46)':'rgba(255,255,255,0.30)'}!important}
      .lyrics-container-content p.past{color:${L?'rgba(28,24,40,0.62)':'rgba(255,255,255,0.43)'}!important}
      .lyrics-container-content p.upcoming{color:${L?'rgba(28,24,40,0.38)':'rgba(255,255,255,0.27)'}!important}
      .lyrics-container-content p.active{color:${L?'#1c1828':'#fff'}!important}
      .player-top-context,.player-top-playlist{color:${inkMid}!important}

      .modal-content-box{background:${surf}!important;color:${ink}!important}
      .modal-content-box h3{color:${ink}!important}
      .context-menu-modal{background:${surf2}!important}
      .modal-btn-ok{background:${p.grad}!important;color:#fff!important}
      .modal-btn-cancel{background:${cardBg}!important;color:${inkMid}!important}
      input,textarea{background:${inptBg}!important;color:${ink}!important;border-color:${border}!important}
      input::placeholder,textarea::placeholder{color:${inkFnt}!important}

      .ctx-title{color:${ink}!important}
      .ctx-artist{color:${inkLow}!important}
      .ctx-btn{color:${ink}!important}
      .ctx-btn:active{background:${p.soft}!important}
      .ctx-icon-purple{background:${p.soft}!important;color:${p.hi}!important}
      .ctx-divider{background:${border}!important}
      .context-menu-modal::before{background:${border}!important}

      .featured-card{background:${p.grad}!important}
      .featured-badge{background:rgba(255,255,255,0.2)!important;border-color:rgba(255,255,255,0.3)!important;color:#fff!important}
      .featured-content h2{color:#fff!important}
      .featured-content p{color:rgba(255,255,255,0.75)!important}
      .featured-play-btn{background:#fff!important;color:${p.dark}!important}

      .section-header h2{color:${ink}!important}
      .section-see-all{color:${p.hi}!important}

      #biblioteca{
        --lib-violet:${p.base};--lib-violet-hi:${p.hi};--lib-violet-up:${p.up};
        --lib-violet-glow:${p.glow};--lib-ink:${ink};--lib-ink-mid:${inkMid};
        --lib-ink-low:${inkLow};--lib-ink-faint:${inkFnt};--lib-surface:${L?'rgba(255,255,255,0.9)':'rgba(22,18,38,0.78)'};
        --lib-surface-2:${surf};--lib-border:${border};--lib-border-hi:${p.line};
        --lib-surface-hi:${cardBg};
      }
      .lib-main-tab{color:${inkLow}!important;background:${cardBg}!important}
      .lib-main-tab.active{background:${p.base}!important;color:#fff!important}
      .library-header h1{color:${ink}!important}
      .lib-icon-btn{color:${inkMid}!important}
      .summary-card{background:${cardBg}!important}
      .summary-card h3{color:${p.base}!important}
      .summary-card p{color:${inkLow}!important}
      .playlist-play-all-btn{background:${p.base}!important;color:#fff!important}
      .playlist-shuffle-btn{border-color:${p.base}!important;color:${p.hi}!important;background:${p.soft}!important}
      #playlistDetailName,#playlistDetailCount{color:${ink}!important}

      .search-top{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      .search-bar-new{background:${inptBg}!important;border-color:${border}!important}
      .search-bar-new:focus-within{border-color:${p.base}!important}
      #globalSearchInput{color:${ink}!important}
      #globalSearchInput::placeholder{color:${inkFnt}!important}
      .search-icon-static{color:${inkLow}!important}
      .search-section-header span:first-child{color:${inkLow}!important}
      .search-section-header button{color:${p.hi}!important}
      .recent-search-item{color:${ink}!important;background:${cardBg}!important;border-color:${border}!important}

      .profile-hero{background:${p.gradProfile}!important}
      .profile-stat{background:${cardBg}!important;border-color:${border}!important}
      .profile-stat .material-symbols-rounded{color:${p.hi}!important}
      .profile-stat-num{color:${ink}!important}
      .profile-stat-label{color:${inkLow}!important}
      .profile-edit-chip{border-color:${p.base}44!important;color:${p.base}!important;background:${p.soft}!important}
      .profile-menu-item{background:${cardBg}!important;border-color:${border}!important}
      .profile-menu-item:active{background:${p.soft}!important}
      .profile-menu-title{color:${ink}!important}
      .profile-menu-sub{color:${inkLow}!important}
      .profile-menu-arrow{color:${inkFnt}!important}
      #profileName{color:${ink}!important}
      #profileUsername{color:${inkLow}!important}
      #profileBio{color:rgba(255,255,255,0.88)!important}
      .profile-logout-btn{background:rgba(239,68,68,0.08)!important;color:#dc2626!important}

      .notifications-overlay{background:${bg}!important}
      .notif-header{border-bottom-color:${border}!important}
      .notif-header-icon{color:${p.hi}!important}
      .notif-header h1{color:${ink}!important}
      .notif-tab{color:${inkLow}!important}
      .notif-tab.active{color:${p.hi}!important;border-bottom-color:${p.hi}!important}
      .notif-close-btn{color:${inkMid}!important;background:${cardBg}!important}
      .notif-prompt-card{background:${p.soft}!important;border-color:${p.line}!important}
      .notif-activate-btn{background:${p.grad}!important;color:#fff!important}

      .queue-panel{background:${L?surf2:playerBg}!important;border-left-color:${p.base}28!important}
      .queue-panel-header h3{color:${ink}!important}
      .qp-playing-bar{background:${p.grad}!important}

      .premium-toast{background:${surf}!important;color:${ink}!important}

      /* SUBSTITUIÇÕES DE CORES ROXO HARDCODED */
      /* Colors em estado padrão serão substituídos por variáveis */
      [style*="#7c3aed"],
      [style*="#a855f7"],
      [style*="#c084fc"],
      [style*="#9333ea"],
      [style*="#5b21b6"],
      [style*="#d8b4fe"] {
        /* Herança de cor será aplicada via variáveis CSS */
      }
    `;

    localStorage.setItem('fenda-color', color);
    localStorage.setItem('fenda-mode', mode);
    this.savedColor = color;
    this.savedMode = mode;
  }

  applyAdmin() {
    const admin = {
      base: '#77a9ff',
      hi: '#7ee8e1',
      up: '#c5dbff',
      dark: '#2f5fb3',
      darker: '#16396f',
      glow: 'rgba(119,169,255,.42)',
      soft: 'rgba(119,169,255,.14)',
      line: 'rgba(119,169,255,.25)',
      grad: 'linear-gradient(135deg,#7ee8e1,#77a9ff)',
      gradDark: 'linear-gradient(135deg,#28549b,#16396f,#0b1b38)',
      gradProfile: 'linear-gradient(145deg,#28549b,#16396f,#07101e)',
      gradMagenta: 'linear-gradient(135deg,#496ea8,#7ee8e1)',
      gradHero: 'linear-gradient(120deg,#f6f8ff 25%,#77a9ff 65%,#7ee8e1 100%)',
    };
    const root = this.root;
    const set = (name, value) => root.style.setProperty(name, value);
    set('--primary-base', admin.base);
    set('--primary-hi', admin.hi);
    set('--primary-up', admin.up);
    set('--primary-dark', admin.dark);
    set('--primary-darker', admin.darker);
    set('--primary-glow', admin.glow);
    set('--primary-soft', admin.soft);
    set('--primary-line', admin.line);
    set('--primary-grad', admin.grad);
    set('--primary-grad-dark', admin.gradDark);
    set('--primary-grad-light', admin.gradMagenta);
    set('--grad-hero', admin.gradHero);
    set('--grad-profile', admin.gradProfile);
    set('--grad-magenta', admin.gradMagenta);
    set('--secondary-hi', admin.up);
    set('--secondary-glow', admin.glow);
    set('--secondary-soft', admin.soft);

    const styleEl = document.getElementById('fenda-theme-inject') || (() => {
      const el = document.createElement('style');
      el.id = 'fenda-theme-inject';
      document.head.appendChild(el);
      return el;
    })();
    styleEl.textContent = `
      body{background:#070b14!important;color:#f6f8ff!important}
      .app-container{background:linear-gradient(180deg,#0a1020 0%,#070b14 100%)!important}
      .nav-bar{background:rgba(8,13,24,.94)!important;border-top-color:rgba(173,196,232,.12)!important}
      .nav-btn{color:rgba(184,195,217,.42)!important}.nav-btn.active{color:#7ee8e1!important}.nav-btn p,.nav-btn span{color:inherit!important}
      .player-bottom-bar{background:rgba(8,13,24,.9)!important;box-shadow:0 18px 40px rgba(0,0,0,.28),0 0 0 1px rgba(119,169,255,.25)!important}
      .mini-ring-fill{stroke:#7ee8e1!important}.mini-ctrl-play,.player-mini-play,.ctrl-play{background:linear-gradient(135deg,#7ee8e1,#77a9ff)!important;box-shadow:0 8px 22px rgba(119,169,255,.28)!important}
      .mini-info h4,.player-mini-info span:first-child{color:#f6f8ff!important}.mini-info p,.player-mini-info span:last-child{color:#73819b!important}
      .lyrics-full-screen{background:linear-gradient(145deg,#0b1324 0%,#050810 100%)!important}.player-bg{background:linear-gradient(135deg,#28549b,#16396f,#07101e)!important}
      .player-seek-fill,.player-seek-thumb{background:#77a9ff!important}.player-mini-controls{background:rgba(7,11,20,.98)!important;border-top-color:rgba(126,232,225,.2)!important}
      .player-lyrics-header,.player-top-context,.player-top-playlist{color:rgba(184,195,217,.82)!important}
      .modal-content-box,.context-menu-modal{background:#0e1524!important;color:#f6f8ff!important}.modal-btn-ok{background:linear-gradient(135deg,#7ee8e1,#77a9ff)!important;color:#07101e!important}
      input,textarea,select{background:rgba(14,21,36,.78)!important;color:#f6f8ff!important;border-color:rgba(173,196,232,.12)!important}
      input::placeholder,textarea::placeholder{color:rgba(184,195,217,.42)!important}
      .featured-card{background:linear-gradient(125deg,#132646 0%,#111b30 56%,#171d3b 100%)!important}.featured-badge{background:rgba(126,232,225,.1)!important;border-color:rgba(126,232,225,.2)!important;color:#7ee8e1!important}.featured-play-btn{background:linear-gradient(135deg,#7ee8e1,#77a9ff)!important;color:#07101e!important}
      .section-header h2{color:#f6f8ff!important}.section-see-all{color:#7ee8e1!important}
      #biblioteca{--lib-violet:#77a9ff;--lib-violet-hi:#7ee8e1;--lib-violet-up:#c5dbff;--lib-violet-glow:rgba(119,169,255,.42);--lib-ink:#f6f8ff;--lib-ink-mid:rgba(184,195,217,.72);--lib-ink-low:#73819b;--lib-ink-faint:rgba(184,195,217,.42);--lib-surface:rgba(14,21,36,.78);--lib-surface-2:#0e1524;--lib-border:rgba(173,196,232,.12);--lib-border-hi:rgba(119,169,255,.25);--lib-surface-hi:rgba(255,255,255,.05)}
      .lib-main-tab{color:#73819b!important;background:rgba(255,255,255,.035)!important}.lib-main-tab.active{background:#4c83f1!important;color:#f6f8ff!important}.library-header h1{color:#f6f8ff!important}.summary-card{background:rgba(14,21,36,.82)!important}.summary-card h3{color:#77a9ff!important}.summary-card p{color:#73819b!important}.playlist-play-all-btn{background:#4c83f1!important;color:#f6f8ff!important}.playlist-shuffle-btn{border-color:rgba(119,169,255,.25)!important;color:#7ee8e1!important;background:rgba(119,169,255,.14)!important}
      .search-top{background:transparent!important}.search-bar-new{background:rgba(14,21,36,.78)!important;border-color:rgba(173,196,232,.12)!important}.search-bar-new:focus-within{border-color:rgba(126,232,225,.42)!important}.search-icon-static{color:#73819b!important}.search-section-header button{color:#7ee8e1!important}
      .profile-hero{background:linear-gradient(145deg,#28549b,#16396f,#07101e)!important}.profile-stat,.profile-menu-item{background:rgba(14,21,36,.82)!important;border-color:rgba(173,196,232,.12)!important}.profile-stat .material-symbols-rounded{color:#7ee8e1!important}.profile-stat-num,.profile-menu-title,#profileName{color:#f6f8ff!important}.profile-stat-label,.profile-menu-sub,#profileUsername{color:#73819b!important}.profile-edit-chip{border-color:rgba(119,169,255,.25)!important;color:#77a9ff!important;background:rgba(119,169,255,.14)!important}
      .notifications-overlay{background:#070b14!important}.notif-header{border-bottom-color:rgba(173,196,232,.12)!important}.notif-header-icon,.notif-tab.active{color:#7ee8e1!important}.notif-tab.active{border-bottom-color:#7ee8e1!important}.notif-prompt-card{background:rgba(119,169,255,.14)!important;border-color:rgba(119,169,255,.25)!important}.notif-activate-btn{background:linear-gradient(135deg,#7ee8e1,#77a9ff)!important;color:#07101e!important}
      .queue-panel{background:#0e1524!important;border-left-color:rgba(119,169,255,.25)!important}.qp-playing-bar{background:linear-gradient(135deg,#7ee8e1,#77a9ff)!important}.premium-toast{background:#0e1524!important;color:#f6f8ff!important}
      [style*="background"][style*="#7c3aed"],[style*="background"][style*="#a855f7"],[style*="background"][style*="#c084fc"],[style*="background"][style*="#9333ea"],[style*="background"][style*="#5b21b6"],[style*="background"][style*="#d8b4fe"],[style*="background"][style*="#924cff"]{background:linear-gradient(135deg,#7ee8e1,#77a9ff)!important}
      [style*="color"][style*="#7c3aed"],[style*="color"][style*="#a855f7"],[style*="color"][style*="#c084fc"],[style*="color"][style*="#9333ea"],[style*="color"][style*="#5b21b6"],[style*="color"][style*="#d8b4fe"],[style*="color"][style*="#924cff"]{color:#7ee8e1!important}
    `;
  }

  applyPlayerTrackPalette(color) {
    const normalized = /^#[0-9a-f]{6}$/i.test(String(color || ''))
      ? String(color).toLowerCase()
      : '#1a1040';
    const { h, s } = this.hexToHSL(normalized);
    const sat = Math.min(54, Math.max(24, Math.round(s * 0.72)));
    const accent = `hsl(${h}, ${sat}%, 58%)`;
    const accentHi = `hsl(${h}, ${Math.min(64, sat + 8)}%, 76%)`;
    const deep = `hsl(${h}, ${sat}%, 11%)`;
    const deeper = `hsl(${h}, ${sat}%, 6%)`;
    const glow = `hsla(${h}, ${sat}%, 54%, 0.42)`;
    const styleEl = document.getElementById('fenda-track-theme-inject') || (() => {
      const el = document.createElement('style');
      el.id = 'fenda-track-theme-inject';
      document.head.appendChild(el);
      return el;
    })();

    styleEl.textContent = `
      /* Tema transitório da faixa: não altera a preferência global salva. */
      .lyrics-full-screen {
        background:
          radial-gradient(circle at 84% 4%, hsla(${h}, ${sat}%, 42%, 0.18), transparent 44%),
          linear-gradient(180deg, ${deep} 0%, ${deeper} 58%, #030207 100%) !important;
      }
      .player-bg {
        background:
          linear-gradient(160deg, hsla(${h}, ${sat}%, 34%, 0.9) 0%,
          hsl(${h}, ${Math.max(18, sat - 10)}%, 14%) 48%, #05030a 100%) !important;
      }
      .player-bg::after {
        background: linear-gradient(to bottom,
          rgba(5, 3, 10, 0.02) 0%, rgba(5, 3, 10, 0.28) 38%,
          rgba(5, 3, 10, 0.88) 76%, rgba(5, 3, 10, 1) 100%) !important;
      }
      .player-page-lyrics {
        background:
          radial-gradient(circle at 88% 0%, hsla(${h}, ${sat}%, 48%, 0.16), transparent 42%),
          linear-gradient(180deg, hsla(${h}, ${Math.max(16, sat - 12)}%, 13%, 0.98) 0%,
          ${deeper} 58%, #030207 100%) !important;
      }
      .player-lyrics-header {
        color: rgba(255, 255, 255, 0.82) !important;
        background: linear-gradient(180deg, hsla(${h}, ${sat}%, 8%, 0.94) 0%, hsla(${h}, ${sat}%, 8%, 0.68) 72%, transparent 100%) !important;
      }
      .player-lyrics-header .material-symbols-rounded {
        color: ${accentHi} !important;
        filter: drop-shadow(0 0 8px ${glow}) !important;
      }
      .ctrl-play,
      .player-mini-play {
        background: linear-gradient(135deg, ${accentHi}, ${accent}) !important;
        box-shadow: 0 4px 18px ${glow} !important;
      }
      .player-seek-fill,
      .player-seek-thumb {
        background: ${accent} !important;
      }
      .player-mini-controls {
        background: linear-gradient(180deg, hsla(${h}, ${sat}%, 8%, 0.98), #05030a 100%) !important;
        border-top-color: hsla(${h}, ${sat}%, 70%, 0.20) !important;
      }
      .lyrics-container-content p {
        color: rgba(255, 255, 255, 0.30) !important;
      }
      .lyrics-container-content p.past {
        color: rgba(255, 255, 255, 0.48) !important;
      }
      .lyrics-container-content p.upcoming {
        color: rgba(255, 255, 255, 0.28) !important;
      }
      .lyrics-container-content p.active {
        color: #fff !important;
      }
      .lyric-line.active::before {
        background: linear-gradient(180deg, ${accentHi}, ${accent}) !important;
        box-shadow: 0 0 15px ${glow} !important;
      }
    `;
    this.root.style.setProperty('--player-track-color', normalized);
    this.root.style.setProperty('--player-track-accent', accent);
  }

  init() {
    // Injeta o CSS de variáveis globais se ainda não estiver
    if (!document.getElementById('theme-variables-css')) {
      const link = document.createElement('link');
      link.id = 'theme-variables-css';
      link.rel = 'stylesheet';
      link.href = 'theme-variables.css';
      document.head.insertBefore(link, document.head.firstChild);
    }

    // Modo claro foi removido do app — força escuro mesmo se ficou salvo de uma versão antiga
    if (this.savedMode !== 'dark') {
      this.savedMode = 'dark';
      localStorage.setItem('fenda-mode', 'dark');
    }

    // Aplica o tema salvo
    this.apply(this.savedColor, this.savedMode);
  }
}

const fendaThemes = new FendaThemes();
window.fendaThemes = fendaThemes;
window.applyFendaPlayerTrackTheme = (color) => fendaThemes.applyPlayerTrackPalette(color);
