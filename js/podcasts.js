// Fenda Music — catálogo e reprodução de podcasts
(function () {
    'use strict';

    function escapePodcastHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[char]));
    }

    function podcastToMusic(podcast) {
        return {
            id: `podcast:${podcast.id}`,
            podcastId: podcast.id,
            type: 'podcast',
            title: podcast.title,
            artist: podcast.author || podcast.show_name || 'Podcast',
            cover: podcast.cover_url || '',
            src: podcast.audio_url,
            lrc: null,
            description: podcast.description || ''
        };
    }

    function formatPodcastDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }

    function renderPodcastSection() {
        const grid = document.getElementById('podcastsGrid');
        if (!grid) return;
        const podcasts = Array.isArray(AppState.podcasts) ? AppState.podcasts : [];
        if (!podcasts.length) {
            grid.innerHTML = `
                <div class="podcast-empty">
                    <span class="material-symbols-rounded">podcasts</span>
                    <strong>Nenhum podcast publicado ainda</strong>
                    <span>Novos episódios aparecerão aqui.</span>
                </div>`;
            return;
        }

        grid.innerHTML = podcasts.map((podcast) => {
            const cover = podcast.cover_url
                ? `<img src="${escapePodcastHtml(podcast.cover_url)}" alt="" loading="lazy" decoding="async">`
                : `<span class="material-symbols-rounded podcast-cover-placeholder">podcasts</span>`;
            const date = formatPodcastDate(podcast.created_at);
            return `
                <button class="podcast-card" type="button" data-podcast-id="${escapePodcastHtml(podcast.id)}">
                    <span class="podcast-cover">${cover}<span class="podcast-play"><span class="material-symbols-rounded">play_arrow</span></span></span>
                    <span class="podcast-card-body">
                        <strong>${escapePodcastHtml(podcast.title)}</strong>
                        <span>${escapePodcastHtml(podcast.author || podcast.show_name || 'Podcast')}</span>
                        ${date ? `<small>${date}</small>` : ''}
                        ${podcast.description ? `<em>${escapePodcastHtml(podcast.description)}</em>` : ''}
                    </span>
                </button>`;
        }).join('');

        grid.querySelectorAll('.podcast-card').forEach(card => {
            card.addEventListener('click', () => {
                const podcast = podcasts.find(item => String(item.id) === String(card.dataset.podcastId));
                if (podcast) playPodcast(podcast);
            });
        });
    }

    function playPodcast(podcast) {
        const item = podcastToMusic(podcast);
        if (typeof window.setPlayContext === 'function') {
            window.setPlayContext('podcast', [item], `podcast-${podcast.id}`);
        }
        if (typeof window.playMusicTrack === 'function') {
            window.playMusicTrack(item);
        }
    }

    window.renderPodcastSection = renderPodcastSection;
    window.playPodcast = playPodcast;
    window.podcastToMusic = podcastToMusic;
})();
