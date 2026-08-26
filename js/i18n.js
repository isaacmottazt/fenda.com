// ============================================================
// i18n.js — tradução real da interface (PT-BR / EN-US / ES-ES)
//
// Como funciona:
//   1) Elementos estáticos do HTML marcados com data-i18n="chave"
//      têm o textContent trocado pela tradução.
//   2) Inputs/textareas com data-i18n-placeholder="chave" têm o
//      placeholder trocado.
//   3) Texto gerado dinamicamente em JS (toasts, listas, títulos
//      montados em runtime) usa window.t('chave') no lugar da string
//      literal em português.
//
// Cobertura: navegação principal, cabeçalhos de seção, player,
// perfil, modais e Configurações (incluindo as telas próprias).
// Conteúdo vindo do banco (nomes de música, artista, playlist do
// usuário) nunca é traduzido — só o texto de interface do próprio app.
//
// Chamado automaticamente:
//   - no carregamento do script (aplica o idioma já salvo)
//   - sempre que settings.js muda o idioma (evento fenda:languageChanged)
// ============================================================

(function () {
    'use strict';

    const DICT = {
        'pt-BR': {
            // Navegação inferior
            nav_home: 'Início', nav_search: 'Buscar', nav_library: 'Biblioteca', nav_profile: 'Perfil',
            // Início
            home_recommendation: 'Recomendação do dia', home_listen_now: 'Ouvir agora',
            home_fav_artists: 'Seus artistas favoritos', home_see_all: 'Ver todos',
            home_recent: 'Tocadas recentemente', home_see_all_2: 'Ver tudo',
            home_new: 'Adicionadas recentemente', loading: 'Carregando...',
            // Buscar
            search_placeholder: 'Músicas, artistas...', search_recent: 'Buscas recentes', search_start_title: 'Encontre sua próxima música', search_start_hint: 'Pesquise por uma música, artista ou estilo para começar.',
            search_clear: 'Limpar', search_artists: 'Artistas',
            // Biblioteca
            lib_title: 'Biblioteca', lib_all: 'Tudo', lib_playlists: 'Playlists',
            lib_history: 'Histórico', lib_artists: 'Artistas', lib_downloads: 'Downloads',
            lib_downloads_card: 'Downloads', lib_listened_card: 'Ouvidas',
            lib_play_all: 'Tocar tudo', lib_shuffle: 'Aleatório', lib_songs_suffix: 'músicas',
            // Perfil
            profile_edit: 'Editar', profile_playlists: 'Playlists', profile_likes: 'Curtidas',
            profile_listened: 'Ouvido', profile_liked_songs: 'Músicas curtidas',
            profile_liked_songs_sub: 'Ver todas as curtidas', profile_downloads_sub: 'Músicas salvas offline',
            profile_recent: 'Ouvidas recentemente', profile_recent_sub: 'Seu histórico',
            profile_submit: 'Enviar música', profile_submit_sub: 'Sugira uma música para o catálogo',
            profile_settings: 'Configurações', profile_settings_sub: 'Conta, tema, reprodução e mais',
            profile_passionate: 'Apaixonado por música.',
            // Player
            player_lyrics: 'Letra', player_next_songs: 'Próximas músicas',
            // Notificações
            notif_title: 'Notificações', notif_all: 'Todas', notif_unread: 'Não lidas',
            notif_enable_title: 'Ative as notificações', notif_enable_sub: 'Receba novidades e recomendações exclusivas no seu dia a dia.',
            notif_activate: 'Ativar',
            // Modais gerais
            modal_new_playlist: 'Nova Playlist', modal_playlist_name: 'Nome da playlist...',
            modal_cover: 'Capa', modal_cancel: 'Cancelar', modal_save: 'Salvar', modal_create: 'Criar',
            modal_add_to_playlist: 'Adicionar à playlist', modal_search_playlist: 'Procurar playlist...',
            modal_new_playlist_btn: 'Nova Playlist', modal_edit_profile: 'Editar perfil',
            modal_full_name: 'Nome completo', modal_email: 'E-mail', modal_bio: 'Bio / frase de destaque',
            modal_no_photo: 'Nenhuma foto', modal_confirm: 'Confirmar', modal_ok: 'OK',
            // Configurações — painel principal
            settings_title: 'Configurações', settings_account: 'Conta', settings_profile_section: 'Perfil público', settings_access_section: 'Acesso à conta', settings_security_section: 'Segurança da conta', settings_actions_section: 'Ações da conta', settings_email: 'E-mail',
            settings_new_password: 'Nova senha', settings_confirm_password: 'Confirmar nova senha',
            settings_change_password: 'Alterar senha', settings_logout: 'Sair da conta',
            settings_delete_account: 'Excluir conta', settings_delete_account_sub: 'Apaga sua conta e dados permanentemente',
            settings_appearance: 'Aparência', settings_appearance_hint: 'Escolha a cor principal do app. O Fenda Music usa sempre tema escuro.',
            settings_general: 'Geral', settings_playback: 'Reprodução', settings_playback_sub: 'Downloads offline, crossfade e dados móveis',
            settings_a11y: 'Idioma e acessibilidade', settings_a11y_sub: 'Idioma, tamanho de fonte, movimento',
            settings_notifications: 'Notificações locais', settings_notif_hint: 'Controla as notificações geradas no aparelho (sino do app).',
            settings_notif_daily: 'Recomendação diária', settings_notif_releases: 'Novidades de artistas',
            settings_notif_weekly: 'Resumo da semana', settings_notif_streak: 'Marcos de sequência',
            settings_storage: 'Armazenamento', settings_clear_downloads: 'Limpar downloads offline',
            settings_force_update: 'Forçar atualização do app', settings_force_update_sub: 'Limpa o cache e recarrega',
            settings_about: 'Sobre', settings_about_link: 'Sobre o Fenda Music', settings_about_link_sub: 'Versão, termos, privacidade e suporte',
            settings_version: 'versão',
            privacy_section: 'Privacidade e dados', privacy_intro: 'Escolha quais dados o Fenda Music pode usar. Você pode alterar ou revogar essas escolhas a qualquer momento.', privacy_analytics: 'Análise de uso', privacy_analytics_sub: 'Usa seu histórico de reprodução e buscas para medir o funcionamento e melhorar o app.', privacy_recommendations: 'Recomendações personalizadas', privacy_recommendations_sub: 'Usa seu histórico para adaptar sugestões, rankings pessoais e descobertas.', privacy_location: 'Localização precisa', privacy_location_sub: 'Permite usar o GPS para recursos baseados na sua região. O navegador pedirá permissão.', privacy_device: 'Dados técnicos do aparelho', privacy_device_sub: 'Usa idioma, fuso horário e plataforma, sem guardar o identificador bruto do navegador.', privacy_location_enabled: 'Localização autorizada', privacy_location_disabled: 'Localização desativada', privacy_saved: 'Preferência de privacidade atualizada.', privacy_load_error: 'Não foi possível carregar suas preferências.', privacy_location_error: 'Não foi possível autorizar a localização.', privacy_data_note: 'Os dados autorizados ficam vinculados à sua conta e são apagados quando a conta é excluída. O Fenda não grava um IP no seu perfil; registros técnicos de segurança podem existir nos provedores de infraestrutura conforme as políticas deles.',
            // Configurações — Reprodução
            playback_title: 'Reprodução', playback_section: 'Reprodução',
            playback_autoplay: 'Reprodução automática', playback_autoplay_sub: 'Continua tocando ao fim da fila', playback_auto_download: 'Baixar playlists automaticamente', playback_auto_download_sub: 'Salva as músicas das suas playlists para ouvir sem internet', playback_normalize: 'Normalização de volume', playback_normalize_sub: 'Mantém o volume equilibrado entre faixas',
            playback_transition: 'Transição entre músicas', playback_crossfade: 'Crossfade',
            playback_crossfade_sub: 'Uma música se funde suavemente na próxima', playback_duration: 'Duração',
            playback_mobile_data: 'Dados móveis', playback_data_saver: 'Economizar dados',
            playback_data_saver_sub: 'Não pré-carrega a próxima música fora do Wi-Fi',
            playback_no_quality_hint: 'O Fenda Music guarda só um arquivo por música — por isso ainda não existe opção de qualidade de áudio.',
            // Configurações — Idioma e acessibilidade
            a11y_title: 'Idioma e acessibilidade', a11y_language: 'Idioma',
            a11y_lang_hint_pt: 'A interface do app está toda em português por enquanto — a seleção de idioma muda textos de data/hora e é a base para outros idiomas no futuro.',
            a11y_lang_hint_other: 'A interface muda de idioma automaticamente conforme sua seleção.',
            a11y_section: 'Acessibilidade', a11y_font_size: 'Tamanho da fonte',
            a11y_smaller: 'Menor', a11y_bigger: 'Maior',
            a11y_reduce_motion: 'Reduzir animações', a11y_reduce_motion_sub: 'Diminui movimento e transições na interface',
            // Configurações — Sobre
            about_title: 'Sobre', about_legal: 'Legal', about_terms: 'Termos de uso',
            about_privacy: 'Política de privacidade', about_support: 'Suporte', about_contact: 'Fale conosco',
            about_description: 'Plataforma sem fins lucrativos para compartilhar músicas. O catálogo é formado por envios da comunidade e passa por análise manual; por isso, nem todas as músicas estarão disponíveis.',
            about_made_with: 'Feito para todos os estilos musicais',
            // Enviar música
            submit_title: 'Enviar música',
            submit_hint: 'Sua sugestão será analisada manualmente. Se aprovada, a música entra no catálogo do Fenda Music; por isso, nem todas as músicas estarão disponíveis.',
            submit_song_title: 'Título da música *', submit_artist: 'Artista *',
            submit_audio_file: 'Arquivo de áudio (opcional)', submit_choose_file: 'Escolher arquivo (MP3, M4A…)',
            submit_send: 'Enviar para análise',
            confirm_logout_title: 'Sair da conta', confirm_logout_msg: 'Deseja realmente sair da conta?',
            confirm_delete_title: 'Excluir conta', confirm_delete_msg: 'Essa ação é permanente e apaga todos os seus dados, favoritos e histórico. Tem certeza?',
            // Conta — edição de perfil
            account_photo: 'Foto de perfil', account_change_photo: 'Trocar foto',
            account_no_photo: 'Nenhuma foto', account_full_name: 'Nome completo',
            account_full_name_placeholder: 'Seu nome', account_username: 'Nome de usuário',
            account_username_placeholder: 'seu_usuario', account_username_hint: 'Só letras minúsculas, números e _. Entre 3 e 20 caracteres.',
            account_bio: 'Frase do perfil', account_bio_placeholder: 'Uma frase sobre você',
            account_save_profile: 'Salvar alterações', account_saving: 'Salvando…',
            account_saved: 'Perfil atualizado!', account_username_taken: 'Esse nome de usuário já está em uso.',
            account_username_invalid: 'Use só letras minúsculas, números e _ (3 a 20 caracteres).',
            account_name_required: 'O nome não pode ficar em branco.',
            settings_current_password: 'Senha atual', settings_confirm_current_password: 'Confirmar senha',
            settings_forgot_password: 'Esqueci minha senha', settings_current_password_required: 'Digite sua senha atual.',
            settings_checking: 'Verificando…', settings_current_password_wrong: 'Senha atual incorreta.',
            settings_current_password_ok: 'Senha confirmada!', settings_sending_reset: 'Enviando e-mail…',
            settings_reset_sent: 'E-mail de redefinição enviado! Confira sua caixa de entrada.',
        },
        'en-US': {
            nav_home: 'Home', nav_search: 'Search', nav_library: 'Library', nav_profile: 'Profile',
            home_recommendation: 'Recommendation of the day', home_listen_now: 'Listen now',
            home_fav_artists: 'Your favorite artists', home_see_all: 'See all',
            home_recent: 'Recently played', home_see_all_2: 'See all',
            home_new: 'Recently added', loading: 'Loading...',
            search_placeholder: 'Songs, artists...', search_recent: 'Recent searches', search_start_title: 'Find your next song', search_start_hint: 'Search for a song, artist, or style to get started.',
            search_clear: 'Clear', search_artists: 'Artists',
            lib_title: 'Library', lib_all: 'All', lib_playlists: 'Playlists',
            lib_history: 'History', lib_artists: 'Artists', lib_downloads: 'Downloads',
            lib_downloads_card: 'Downloads', lib_listened_card: 'Listened',
            lib_play_all: 'Play all', lib_shuffle: 'Shuffle', lib_songs_suffix: 'songs',
            profile_edit: 'Edit', profile_playlists: 'Playlists', profile_likes: 'Likes',
            profile_listened: 'Listened', profile_liked_songs: 'Liked songs',
            profile_liked_songs_sub: 'See all your likes', profile_downloads_sub: 'Songs saved offline',
            profile_recent: 'Recently played', profile_recent_sub: 'Your history',
            profile_submit: 'Submit a song', profile_submit_sub: 'Suggest a song for the catalog',
            profile_settings: 'Settings', profile_settings_sub: 'Account, theme, playback and more',
            profile_passionate: 'Passionate about music.',
            player_lyrics: 'Lyrics', player_next_songs: 'Next songs',
            notif_title: 'Notifications', notif_all: 'All', notif_unread: 'Unread',
            notif_enable_title: 'Enable notifications', notif_enable_sub: 'Get news and exclusive recommendations every day.',
            notif_activate: 'Enable',
            modal_new_playlist: 'New Playlist', modal_playlist_name: 'Playlist name...',
            modal_cover: 'Cover', modal_cancel: 'Cancel', modal_save: 'Save', modal_create: 'Create',
            modal_add_to_playlist: 'Add to playlist', modal_search_playlist: 'Search playlist...',
            modal_new_playlist_btn: 'New Playlist', modal_edit_profile: 'Edit profile',
            modal_full_name: 'Full name', modal_email: 'Email', modal_bio: 'Bio / tagline',
            modal_no_photo: 'No photo', modal_confirm: 'Confirm', modal_ok: 'OK',
            settings_title: 'Settings', settings_account: 'Account', settings_profile_section: 'Public profile', settings_access_section: 'Account access', settings_security_section: 'Account security', settings_actions_section: 'Account actions', settings_email: 'Email',
            settings_new_password: 'New password', settings_confirm_password: 'Confirm new password',
            settings_change_password: 'Change password', settings_logout: 'Log out',
            settings_delete_account: 'Delete account', settings_delete_account_sub: 'Permanently deletes your account and data',
            settings_appearance: 'Appearance', settings_appearance_hint: 'Choose the app\u2019s main color. Fenda Music always uses dark mode.',
            settings_general: 'General', settings_playback: 'Playback', settings_playback_sub: 'Offline downloads, crossfade and mobile data',
            settings_a11y: 'Language and accessibility', settings_a11y_sub: 'Language, font size, motion',
            settings_notifications: 'Local notifications', settings_notif_hint: 'Controls notifications generated on this device (app bell).',
            settings_notif_daily: 'Daily recommendation', settings_notif_releases: 'Artist news',
            settings_notif_weekly: 'Weekly summary', settings_notif_streak: 'Streak milestones',
            settings_storage: 'Storage', settings_clear_downloads: 'Clear offline downloads',
            settings_force_update: 'Force app update', settings_force_update_sub: 'Clears cache and reloads',
            settings_about: 'About', settings_about_link: 'About Fenda Music', settings_about_link_sub: 'Version, terms, privacy and support',
            settings_version: 'version',
            privacy_section: 'Privacy and data', privacy_intro: 'Choose which data Fenda Music may use. You can change or revoke these choices at any time.', privacy_analytics: 'Usage analytics', privacy_analytics_sub: 'Uses your listening history and searches to measure performance and improve the app.', privacy_recommendations: 'Personalized recommendations', privacy_recommendations_sub: 'Uses your history to adapt suggestions, personal rankings and discovery.', privacy_location: 'Precise location', privacy_location_sub: 'Allows GPS use for region-based features. Your browser will ask for permission.', privacy_device: 'Device technical data', privacy_device_sub: 'Uses language, time zone and platform without storing the browser raw identifier.', privacy_location_enabled: 'Location authorized', privacy_location_disabled: 'Location disabled', privacy_saved: 'Privacy preference updated.', privacy_load_error: 'Could not load your privacy preferences.', privacy_location_error: 'Could not authorize location.', privacy_data_note: 'Authorized data is linked to your account and deleted when the account is deleted. Fenda does not store an IP in your profile; technical security logs may exist with infrastructure providers under their own policies.',
            playback_title: 'Playback', playback_section: 'Playback',
            playback_autoplay: 'Autoplay', playback_autoplay_sub: 'Keeps playing when the queue ends', playback_auto_download: 'Download playlists automatically', playback_auto_download_sub: 'Saves playlist songs to listen without internet', playback_normalize: 'Volume normalization', playback_normalize_sub: 'Keeps volume balanced between tracks',
            playback_transition: 'Transition between songs', playback_crossfade: 'Crossfade',
            playback_crossfade_sub: 'One song smoothly blends into the next', playback_duration: 'Duration',
            playback_mobile_data: 'Mobile data', playback_data_saver: 'Save data',
            playback_data_saver_sub: 'Doesn\u2019t preload the next song off Wi-Fi',
            playback_no_quality_hint: 'Fenda Music only keeps one file per song — so there\u2019s no audio quality option yet.',
            a11y_title: 'Language and accessibility', a11y_language: 'Language',
            a11y_lang_hint_pt: 'The interface is fully translated. Enjoy!',
            a11y_lang_hint_other: 'The interface changes language automatically based on your selection.',
            a11y_section: 'Accessibility', a11y_font_size: 'Font size',
            a11y_smaller: 'Smaller', a11y_bigger: 'Bigger',
            a11y_reduce_motion: 'Reduce motion', a11y_reduce_motion_sub: 'Reduces movement and transitions in the interface',
            about_title: 'About', about_legal: 'Legal', about_terms: 'Terms of use',
            about_privacy: 'Privacy policy', about_support: 'Support', about_contact: 'Contact us',
            about_description: 'A nonprofit platform for sharing music. The catalog is built from community submissions and manually reviewed, so not every known song will be available.',
            about_made_with: 'Made for every music style',
            submit_title: 'Submit a song',
            submit_hint: 'Your suggestion is manually reviewed. If approved, the song joins the Fenda Music catalog; therefore, not every known song will be available.',
            submit_song_title: 'Song title *', submit_artist: 'Artist *',
            submit_audio_file: 'Audio file (optional)', submit_choose_file: 'Choose file (MP3, M4A…)',
            submit_send: 'Submit for review',
            confirm_logout_title: 'Log out', confirm_logout_msg: 'Are you sure you want to log out?',
            confirm_delete_title: 'Delete account', confirm_delete_msg: 'This is permanent and erases all your data, favorites and history. Are you sure?',
            account_photo: 'Profile photo', account_change_photo: 'Change photo',
            account_no_photo: 'No photo', account_full_name: 'Full name',
            account_full_name_placeholder: 'Your name', account_username: 'Username',
            account_username_placeholder: 'your_username', account_username_hint: 'Lowercase letters, numbers and _ only. 3 to 20 characters.',
            account_bio: 'Profile tagline', account_bio_placeholder: 'A line about you',
            account_save_profile: 'Save changes', account_saving: 'Saving…',
            account_saved: 'Profile updated!', account_username_taken: 'That username is already taken.',
            account_username_invalid: 'Use only lowercase letters, numbers and _ (3 to 20 characters).',
            account_name_required: 'Name can\u2019t be empty.',
            settings_current_password: 'Current password', settings_confirm_current_password: 'Confirm password',
            settings_forgot_password: 'Forgot my password', settings_current_password_required: 'Enter your current password.',
            settings_checking: 'Checking…', settings_current_password_wrong: 'Current password is wrong.',
            settings_current_password_ok: 'Password confirmed!', settings_sending_reset: 'Sending email…',
            settings_reset_sent: 'Reset email sent! Check your inbox.',
        },
        'es-ES': {
            nav_home: 'Inicio', nav_search: 'Buscar', nav_library: 'Biblioteca', nav_profile: 'Perfil',
            home_recommendation: 'Recomendación del día', home_listen_now: 'Escuchar ahora',
            home_fav_artists: 'Tus artistas favoritos', home_see_all: 'Ver todos',
            home_recent: 'Reproducidas recientemente', home_see_all_2: 'Ver todo',
            home_new: 'Añadidas recientemente', loading: 'Cargando...',
            search_placeholder: 'Canciones, artistas...', search_recent: 'Búsquedas recientes', search_start_title: 'Encuentra tu próxima canción', search_start_hint: 'Busca una canción, artista o estilo para comenzar.',
            search_clear: 'Borrar', search_artists: 'Artistas',
            lib_title: 'Biblioteca', lib_all: 'Todo', lib_playlists: 'Listas',
            lib_history: 'Historial', lib_artists: 'Artistas', lib_downloads: 'Descargas',
            lib_downloads_card: 'Descargas', lib_listened_card: 'Escuchadas',
            lib_play_all: 'Reproducir todo', lib_shuffle: 'Aleatorio', lib_songs_suffix: 'canciones',
            profile_edit: 'Editar', profile_playlists: 'Listas', profile_likes: 'Me gusta',
            profile_listened: 'Escuchado', profile_liked_songs: 'Canciones que te gustan',
            profile_liked_songs_sub: 'Ver todos tus me gusta', profile_downloads_sub: 'Canciones guardadas sin conexión',
            profile_recent: 'Reproducidas recientemente', profile_recent_sub: 'Tu historial',
            profile_submit: 'Enviar canción', profile_submit_sub: 'Sugiere una canción para el catálogo',
            profile_settings: 'Ajustes', profile_settings_sub: 'Cuenta, tema, reproducción y más',
            profile_passionate: 'Apasionado por la música.',
            player_lyrics: 'Letra', player_next_songs: 'Próximas canciones',
            notif_title: 'Notificaciones', notif_all: 'Todas', notif_unread: 'No leídas',
            notif_enable_title: 'Activa las notificaciones', notif_enable_sub: 'Recibe novedades y recomendaciones exclusivas cada día.',
            notif_activate: 'Activar',
            modal_new_playlist: 'Nueva lista', modal_playlist_name: 'Nombre de la lista...',
            modal_cover: 'Portada', modal_cancel: 'Cancelar', modal_save: 'Guardar', modal_create: 'Crear',
            modal_add_to_playlist: 'Añadir a la lista', modal_search_playlist: 'Buscar lista...',
            modal_new_playlist_btn: 'Nueva lista', modal_edit_profile: 'Editar perfil',
            modal_full_name: 'Nombre completo', modal_email: 'Correo electrónico', modal_bio: 'Bio / frase destacada',
            modal_no_photo: 'Sin foto', modal_confirm: 'Confirmar', modal_ok: 'OK',
            settings_title: 'Ajustes', settings_account: 'Cuenta', settings_profile_section: 'Perfil público', settings_access_section: 'Acceso a la cuenta', settings_security_section: 'Seguridad de la cuenta', settings_actions_section: 'Acciones de la cuenta', settings_email: 'Correo electrónico',
            settings_new_password: 'Nueva contraseña', settings_confirm_password: 'Confirmar nueva contraseña',
            settings_change_password: 'Cambiar contraseña', settings_logout: 'Cerrar sesión',
            settings_delete_account: 'Eliminar cuenta', settings_delete_account_sub: 'Elimina tu cuenta y datos de forma permanente',
            settings_appearance: 'Apariencia', settings_appearance_hint: 'Elige el color principal de la app. Fenda Music siempre usa tema oscuro.',
            settings_general: 'General', settings_playback: 'Reproducción', settings_playback_sub: 'Descargas sin conexión, crossfade y datos móviles',
            settings_a11y: 'Idioma y accesibilidad', settings_a11y_sub: 'Idioma, tamaño de fuente, movimiento',
            settings_notifications: 'Notificaciones locales', settings_notif_hint: 'Controla las notificaciones generadas en el dispositivo (campana de la app).',
            settings_notif_daily: 'Recomendación diaria', settings_notif_releases: 'Novedades de artistas',
            settings_notif_weekly: 'Resumen semanal', settings_notif_streak: 'Hitos de racha',
            settings_storage: 'Almacenamiento', settings_clear_downloads: 'Borrar descargas sin conexión',
            settings_force_update: 'Forzar actualización de la app', settings_force_update_sub: 'Borra la caché y recarga',
            settings_about: 'Acerca de', settings_about_link: 'Acerca de Fenda Music', settings_about_link_sub: 'Versión, términos, privacidad y soporte',
            settings_version: 'versión',
            privacy_section: 'Privacidad y datos', privacy_intro: 'Elige qué datos puede usar Fenda Music. Puedes cambiar o revocar estas opciones en cualquier momento.', privacy_analytics: 'Análisis de uso', privacy_analytics_sub: 'Usa tu historial de reproducción y búsquedas para medir el funcionamiento y mejorar la app.', privacy_recommendations: 'Recomendaciones personalizadas', privacy_recommendations_sub: 'Usa tu historial para adaptar sugerencias, rankings personales y descubrimiento.', privacy_location: 'Ubicación precisa', privacy_location_sub: 'Permite usar el GPS para funciones basadas en tu región. El navegador pedirá permiso.', privacy_device: 'Datos técnicos del dispositivo', privacy_device_sub: 'Usa idioma, zona horaria y plataforma sin guardar el identificador bruto del navegador.', privacy_location_enabled: 'Ubicación autorizada', privacy_location_disabled: 'Ubicación desactivada', privacy_saved: 'Preferencia de privacidad actualizada.', privacy_load_error: 'No se pudieron cargar tus preferencias de privacidad.', privacy_location_error: 'No se pudo autorizar la ubicación.', privacy_data_note: 'Los datos autorizados están vinculados a tu cuenta y se eliminan cuando eliminas la cuenta. Fenda no guarda una IP en tu perfil; pueden existir registros técnicos de seguridad en los proveedores de infraestructura según sus propias políticas.',
            playback_title: 'Reproducción', playback_section: 'Reproducción',
            playback_autoplay: 'Reproducción automática', playback_autoplay_sub: 'Sigue reproduciendo al terminar la cola', playback_auto_download: 'Descargar listas automáticamente', playback_auto_download_sub: 'Guarda las canciones de tus listas para escucharlas sin conexión', playback_normalize: 'Normalización de volumen', playback_normalize_sub: 'Mantiene el volumen equilibrado entre pistas',
            playback_transition: 'Transición entre canciones', playback_crossfade: 'Crossfade',
            playback_crossfade_sub: 'Una canción se funde suavemente con la siguiente', playback_duration: 'Duración',
            playback_mobile_data: 'Datos móviles', playback_data_saver: 'Ahorrar datos',
            playback_data_saver_sub: 'No precarga la siguiente canción fuera del Wi-Fi',
            playback_no_quality_hint: 'Fenda Music solo guarda un archivo por canción, así que aún no hay opción de calidad de audio.',
            a11y_title: 'Idioma y accesibilidad', a11y_language: 'Idioma',
            a11y_lang_hint_pt: 'La interfaz está totalmente traducida. ¡Disfrútala!',
            a11y_lang_hint_other: 'La interfaz cambia de idioma automáticamente según tu selección.',
            a11y_section: 'Accesibilidad', a11y_font_size: 'Tamaño de fuente',
            a11y_smaller: 'Menor', a11y_bigger: 'Mayor',
            a11y_reduce_motion: 'Reducir animaciones', a11y_reduce_motion_sub: 'Reduce el movimiento y las transiciones en la interfaz',
            about_title: 'Acerca de', about_legal: 'Legal', about_terms: 'Términos de uso',
            about_privacy: 'Política de privacidad', about_support: 'Soporte', about_contact: 'Contáctanos',
            about_description: 'Una plataforma sin fines de lucro para compartir música. El catálogo se forma con envíos de la comunidad y pasa por revisión manual; por eso, no todas las canciones estarán disponibles.',
            about_made_with: 'Hecho para todos los estilos musicales',
            submit_title: 'Enviar canción',
            submit_hint: 'Tu sugerencia pasa por revisión manual. Si se aprueba, la canción se une al catálogo de Fenda Music; por eso, no todas las canciones estarán disponibles.',
            submit_song_title: 'Título de la canción *', submit_artist: 'Artista *',
            submit_audio_file: 'Archivo de audio (opcional)', submit_choose_file: 'Elegir archivo (MP3, M4A…)',
            submit_send: 'Enviar para revisión',
            confirm_logout_title: 'Cerrar sesión', confirm_logout_msg: '¿Seguro que quieres cerrar sesión?',
            confirm_delete_title: 'Eliminar cuenta', confirm_delete_msg: 'Esta acción es permanente y borra todos tus datos, favoritos e historial. ¿Estás seguro?',
            account_photo: 'Foto de perfil', account_change_photo: 'Cambiar foto',
            account_no_photo: 'Sin foto', account_full_name: 'Nombre completo',
            account_full_name_placeholder: 'Tu nombre', account_username: 'Nombre de usuario',
            account_username_placeholder: 'tu_usuario', account_username_hint: 'Solo minúsculas, números y _. Entre 3 y 20 caracteres.',
            account_bio: 'Frase del perfil', account_bio_placeholder: 'Una frase sobre ti',
            account_save_profile: 'Guardar cambios', account_saving: 'Guardando…',
            account_saved: '¡Perfil actualizado!', account_username_taken: 'Ese nombre de usuario ya está en uso.',
            account_username_invalid: 'Usa solo minúsculas, números y _ (3 a 20 caracteres).',
            account_name_required: 'El nombre no puede quedar vacío.',
            settings_current_password: 'Contraseña actual', settings_confirm_current_password: 'Confirmar contraseña',
            settings_forgot_password: 'Olvidé mi contraseña', settings_current_password_required: 'Ingresa tu contraseña actual.',
            settings_checking: 'Verificando…', settings_current_password_wrong: 'Contraseña actual incorrecta.',
            settings_current_password_ok: '¡Contraseña confirmada!', settings_sending_reset: 'Enviando correo…',
            settings_reset_sent: '¡Correo de restablecimiento enviado! Revisa tu bandeja de entrada.',
        },
    };

    const APP_PREFS_KEY = 'fenda_app_prefs';

    function _currentLang() {
        try {
            const p = JSON.parse(localStorage.getItem(APP_PREFS_KEY) || '{}');
            return DICT[p.language] ? p.language : 'pt-BR';
        } catch { return 'pt-BR'; }
    }

    // Tradução para uso em JS: window.t('chave')
    function t(key) {
        const lang = _currentLang();
        return (DICT[lang] && DICT[lang][key]) ?? (DICT['pt-BR'][key] ?? key);
    }
    window.t = t;
    window.FendaI18n = { t, dict: DICT, currentLang: _currentLang };

    // Aplica traduções em todos os elementos marcados no DOM atual
    function applyTranslations() {
        const lang = _currentLang();
        const table = DICT[lang] || DICT['pt-BR'];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (table[key] !== undefined) el.textContent = table[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (table[key] !== undefined) el.placeholder = table[key];
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (table[key] !== undefined) el.title = table[key];
        });

        document.documentElement.setAttribute('lang', lang);
        window.dispatchEvent(new CustomEvent('fenda:translationsApplied', { detail: { lang } }));
    }
    window.applyTranslations = applyTranslations;

    // Aplica assim que o DOM estiver pronto e sempre que o idioma mudar
    // (settings.js dispara fenda:languageChanged ao trocar o seletor)
    function _init() {
        applyTranslations();
    }
    document.addEventListener('DOMContentLoaded', _init);
    if (document.readyState !== 'loading') _init();

    window.addEventListener('fenda:languageChanged', applyTranslations);

    // MutationObserver leve: reaplica traduções em nós inseridos
    // dinamicamente que já venham marcados com data-i18n (ex.: telas de
    // Configurações criadas em runtime pelo settings.js).
    //
    // IMPORTANTE: só traduz os elementos [data-i18n] DENTRO do(s) nó(s)
    // recém-adicionado(s), nunca a página inteira. A versão antiga chamava
    // applyTranslations() global a cada novo nó — isso reescrevia de volta
    // QUALQUER elemento com data-i18n já presente na página, incluindo
    // texto dinâmico que outro código já tinha preenchido (ex.: nome do
    // usuário, música em destaque), sempre que qualquer modal/tela nova
    // fosse aberta em qualquer lugar do app. Era a causa do "Carregando..."
    // reaparecer depois do nome real já ter sido exibido.
    function _translateWithin(root) {
        const lang = _currentLang();
        const table = DICT[lang] || DICT['pt-BR'];
        const nodes = root.hasAttribute?.('data-i18n') ? [root] : [];
        root.querySelectorAll?.('[data-i18n]').forEach(el => nodes.push(el));
        nodes.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (table[key] !== undefined) el.textContent = table[key];
        });
        (root.hasAttribute?.('data-i18n-placeholder') ? [root] : [])
            .concat([...(root.querySelectorAll?.('[data-i18n-placeholder]') || [])])
            .forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (table[key] !== undefined) el.placeholder = table[key];
            });
    }

    const _observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.hasAttribute?.('data-i18n') || node.querySelector?.('[data-i18n]')) {
                    _translateWithin(node);
                }
            }
        }
    });
    document.addEventListener('DOMContentLoaded', () => {
        _observer.observe(document.body, { childList: true, subtree: true });
    });
})();
