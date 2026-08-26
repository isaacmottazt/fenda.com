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
