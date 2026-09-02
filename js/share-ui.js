/* Fenda Music — compartilhamento de música com prévia e link profundo */
(function () {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const ShareUIHandler = {
    initialized: false,
    modal: null,

    init() {
      if (this.initialized) return;
      this.initialized = true;
      this.injectStyles();
      this.ensureModal();
      document.getElementById('playerShareBtn')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.open();
      });
      document.addEventListener('click', event => {
        const actionButton = event.target.closest?.('[data-share-action]');
        if (actionButton) this.handleAction(actionButton.dataset.shareAction);
        if (event.target === this.modal) this.close();
        if (event.target.closest?.('[data-share-close]')) this.close();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.modal?.classList.contains('is-open')) this.close();
      });
    },

    currentMusic() {
      const state = window.AppState;
      const id = state?.currentMusicId;
      return state?.musics?.find(music => String(music.id) === String(id)) || null;
    },

    getUrl(music) {
      const url = new URL('/share.html', window.location.origin);
      url.searchParams.set('music_id', String(music.id));
      url.searchParams.set('share', '1');
      return url.toString();
    },

    getText(music, url) {
      return `Ouvindo “${music.title || 'uma música'}” por ${music.artist || 'artista não informado'} no Fenda Music. ${url}`;
    },

    ensureModal() {
      if (document.getElementById('songShareModal')) {
        this.modal = document.getElementById('songShareModal');
        return;
      }
      this.modal = document.createElement('div');
      this.modal.id = 'songShareModal';
      this.modal.className = 'song-share-modal';
      this.modal.setAttribute('aria-hidden', 'true');
      this.modal.innerHTML = `<div class="song-share-dialog" role="dialog" aria-modal="true" aria-labelledby="songShareTitle"><button type="button" class="song-share-close" data-share-close aria-label="Fechar compartilhamento"><span class="material-symbols-rounded">close</span></button><div class="song-share-kicker"><span class="material-symbols-rounded">share</span>Compartilhar música</div><div class="song-share-preview"><div class="song-share-cover"><img id="songShareCover" alt=""><span id="songShareFallback" class="material-symbols-rounded">music_note</span></div><div class="song-share-copy"><h2 id="songShareTitle">Música</h2><p id="songShareArtist">Artista</p><span id="songShareMeta">Fenda Music</span></div></div><div class="song-share-actions"><button type="button" data-share-action="native"><span class="material-symbols-rounded">ios_share</span><span>Compartilhar</span></button><button type="button" data-share-action="whatsapp"><span class="material-symbols-rounded">chat</span><span>WhatsApp</span></button><button type="button" data-share-action="telegram"><span class="material-symbols-rounded">send</span><span>Telegram</span></button><button type="button" data-share-action="x"><span class="material-symbols-rounded">alternate_email</span><span>Postar no X</span></button><button type="button" data-share-action="copy"><span class="material-symbols-rounded">link</span><span>Copiar link</span></button></div><div class="song-share-link-row"><span class="material-symbols-rounded">link</span><span id="songShareUrl" title="Link da música"></span></div></div>`;
      const host = document.getElementById('lyricsFullScreen') || document.body;
      host.appendChild(this.modal);
    },

    open() {
      const music = this.currentMusic();
      if (!music) {
        window.showToast?.('Nenhuma música está selecionada.', 'error');
        return;
      }
      const url = this.getUrl(music);
      const cover = document.getElementById('songShareCover');
      const fallback = document.getElementById('songShareFallback');
      if (cover) { cover.src = music.cover || ''; cover.alt = `${music.title || 'Música'} — ${music.artist || 'Artista'}`; cover.hidden = !music.cover; }
      if (fallback) fallback.hidden = Boolean(music.cover);
      const title = document.getElementById('songShareTitle');
      const artist = document.getElementById('songShareArtist');
      const meta = document.getElementById('songShareMeta');
      const urlEl = document.getElementById('songShareUrl');
      if (title) title.textContent = music.title || 'Música sem título';
      if (artist) artist.textContent = music.artist || 'Artista não informado';
      if (meta) meta.textContent = [music.genre, music.style || music.style_tags].filter(Boolean).join(' · ') || 'Fenda Music';
      if (urlEl) urlEl.textContent = url.replace(/^https?:\/\//, '');
      this.modal.classList.add('is-open');
      this.modal.setAttribute('aria-hidden', 'false');
      this.modal.querySelector('[data-share-action="native"]')?.focus();
    },

    close() {
      if (!this.modal) return;
      this.modal.classList.remove('is-open');
      this.modal.setAttribute('aria-hidden', 'true');
    },

    async handleAction(action) {
      const music = this.currentMusic();
      if (!music) return;
      const url = this.getUrl(music);
      const text = this.getText(music, url);
      if (action === 'native') {
        if (!navigator.share) { await this.copy(url); return; }
        try { await navigator.share({ title: music.title || 'Fenda Music', text, url }); this.close(); } catch (error) { if (error?.name !== 'AbortError') window.showToast?.('Não foi possível abrir o compartilhamento.', 'error'); }
      } else if (action === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      } else if (action === 'telegram') {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      } else if (action === 'x') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      } else if (action === 'copy') {
        await this.copy(url);
      }
    },

    async copy(url) {
      try {
        await navigator.clipboard.writeText(url);
        window.showToast?.('Link da música copiado.', 'success');
        this.close();
      } catch (_) {
        window.showToast?.('Não foi possível copiar o link.', 'error');
      }
    },

    injectStyles() {
      if (document.getElementById('songShareStyles')) return;
      const style = document.createElement('style');
      style.id = 'songShareStyles';
      style.textContent = `.song-share-modal{position:absolute;inset:0;z-index:240;display:grid;place-items:center;padding:18px;background:color-mix(in srgb,var(--player-bg,#050810) 72%,transparent);backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:opacity .18s ease}.song-share-modal.is-open{opacity:1;pointer-events:auto}.song-share-dialog{position:relative;width:min(100%,460px);max-height:min(92%,640px);overflow:auto;padding:24px;background:linear-gradient(145deg,color-mix(in srgb,var(--player-surface,#13243b) 94%,var(--player-track-accent,var(--primary-base,#77a9ff))),var(--player-surface-2,#0d1525));border:1px solid color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 42%,transparent);border-radius:24px;box-shadow:0 28px 90px rgba(0,0,0,.48);transform:translateY(8px) scale(.98);transition:transform .2s cubic-bezier(.23,1,.32,1)}.song-share-modal.is-open .song-share-dialog{transform:none}.song-share-close{position:absolute;top:14px;right:14px;width:34px;height:34px;display:grid;place-items:center;color:var(--text-secondary,#b8c3d9);background:color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 10%,transparent);border:1px solid color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 24%,transparent);border-radius:10px;cursor:pointer}.song-share-close:hover{color:var(--player-track-accent,var(--primary-hi,#7ee8e1));border-color:color-mix(in srgb,var(--player-track-accent,var(--primary-hi,#7ee8e1)) 62%,transparent)}.song-share-kicker{display:flex;align-items:center;gap:8px;color:var(--player-track-accent,var(--primary-hi,#7ee8e1));font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.song-share-preview{display:flex;align-items:center;gap:15px;margin-top:22px;padding:13px;background:color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 8%,transparent);border:1px solid color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 22%,transparent);border-radius:17px}.song-share-cover{width:74px;height:74px;display:grid;place-items:center;flex:0 0 auto;overflow:hidden;color:var(--player-track-accent,var(--primary-hi,#7ee8e1));background:linear-gradient(145deg,color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 28%,#263e5c),#17263d);border-radius:14px}.song-share-cover img{width:100%;height:100%;object-fit:cover}.song-share-cover img[hidden],.song-share-cover span[hidden]{display:none}.song-share-copy{min-width:0;padding-right:25px}.song-share-copy h2,.song-share-copy p,.song-share-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.song-share-copy h2{font-size:18px;letter-spacing:-.04em}.song-share-copy p{margin-top:5px;color:var(--text-secondary,#b8c3d9);font-size:12px}.song-share-copy span{margin-top:8px;color:var(--text-muted,#73819b);font-size:10px}.song-share-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:17px}.song-share-actions button{min-height:68px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:var(--text-secondary,#c5dbff);background:color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 7%,transparent);border:1px solid color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 19%,transparent);border-radius:13px;font-size:10px;font-weight:800;cursor:pointer;transition:background .16s,border-color .16s,transform .16s}.song-share-actions button:hover{color:var(--player-track-accent,var(--primary-hi,#7ee8e1));background:color-mix(in srgb,var(--player-track-accent,var(--primary-hi,#7ee8e1)) 13%,transparent);border-color:color-mix(in srgb,var(--player-track-accent,var(--primary-hi,#7ee8e1)) 52%,transparent);transform:translateY(-1px)}.song-share-actions button:active{transform:scale(.97)}.song-share-actions .material-symbols-rounded{font-size:21px}.song-share-link-row{display:flex;align-items:center;gap:8px;min-width:0;margin-top:14px;padding:10px 11px;color:var(--text-muted,#73819b);background:color-mix(in srgb,var(--player-track-accent,var(--primary-base,#77a9ff)) 5%,transparent);border-radius:10px;font-size:10px}.song-share-link-row span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:520px){.song-share-dialog{padding:20px 15px}.song-share-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(prefers-reduced-motion:reduce){.song-share-modal,.song-share-dialog{transition:none}}`;
      document.head.appendChild(style);
    },
  };

  window.ShareUIHandler = ShareUIHandler;
})();
