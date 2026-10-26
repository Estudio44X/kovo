'use strict';
(async () => {
  const K = window.KOVO;
  const { h, $, msg, cover, fmtPrice, setDownload } = K;
  const root = $('#acc');
  let pending = '';
  function celebrate(node) {
    if (node) { node.classList.remove('success-flash'); void node.offsetWidth; node.classList.add('success-flash'); }
    const sound = new Audio('assets/audio/success.wav');
    sound.volume = 0.52;
    sound.play().catch(() => {});
  }

  /* Enlace de recuperación: el token llega en el hash (#access_token=...&type=recovery). Se borra de la URL al leerlo. */
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const recoveryToken = hash.get('type') === 'recovery' ? hash.get('access_token') : null;
  const linkError = hash.get('error_description') || hash.get('error_code') ? 'El enlace es inválido o venció. Solicita uno nuevo.' : '';
  if (location.hash) history.replaceState(null, '', location.pathname);

  function field(label, attrs) {
    const input = h('input', Object.assign({ class: 'field', autocomplete: 'off', spellcheck: 'false' }, attrs));
    return { input, node: h('label', { class: 'lbl' }, h('span', { text: label }), input) };
  }

  // Formulario genérico: título, texto, campos, botón principal y enlaces.
  function screen({ title, text, fields, extras = [], submit, onSubmit, links = [], notice = '', ok = false, formClass = '' }) {
    const err = h('p', { class: 'form-msg' + (ok ? ' ok' : ''), role: 'alert', text: notice });
    const setMsg = (m, good) => { err.textContent = m || ''; err.classList.toggle('ok', !!good); };
    const btn = h('button', { class: 'btn primary block', type: 'submit', text: submit });
    const form = h('form', { class: 'panel auth-form ' + formClass, novalidate: 'novalidate' },
      h('h1', { text: title }), text && h('p', { class: 'muted', text }), ...fields.map((f) => f.node), ...extras, err, btn,
      links.length ? h('div', { class: 'links' }, ...links) : null);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); setMsg(''); btn.disabled = true;
      try { await onSubmit(setMsg); } finally { btn.disabled = false; }
    });
    root.replaceChildren(form);
    if (fields[0]) fields[0].input.focus();
  }
  const link = (text, fn) => h('button', { class: 'link', type: 'button', text, onclick: fn });

  /* ---------- Pantallas ---------- */
  function signin(notice = '', ok = false) {
    const email = field('Correo electrónico', { type: 'email', maxlength: '254' });
    const pass = field('Contraseña', { type: 'password', maxlength: '72', autocomplete: 'current-password' });
    screen({
      title: 'Iniciar sesión', fields: [email, pass], submit: 'Iniciar sesión', notice, ok,
      links: [link('¿Olvidaste tu contraseña?', recover), link('Crear cuenta', signup)],
      onSubmit: async (setMsg) => {
        const r = await K.auth.signIn(email.input.value.trim(), pass.input.value);
        if (r.ok) { pass.input.value = ''; dashboard(); return; }
        if (r.error === 'email_not_confirmed') { pending = email.input.value.trim().toLowerCase(); K.auth.resend(pending); verifyScreen('Tu cuenta aún no está confirmada. Te enviamos un código nuevo.'); return; }
        setMsg(msg(r.error));
      }
    });
  }

  function signup() {
    const user = field('Nombre de usuario', { type: 'text', maxlength: '20' });
    const email = field('Correo electrónico', { type: 'email', maxlength: '254' });
    const pass = field('Contraseña (mínimo 8)', { type: 'password', maxlength: '72', autocomplete: 'new-password' });
    const pass2 = field('Repite la contraseña', { type: 'password', maxlength: '72', autocomplete: 'new-password' });
    const acceptTerms = h('input', { type: 'checkbox', required: 'required' });
    const acceptPrivacy = h('input', { type: 'checkbox', required: 'required' });
    const legalChecks = h('div', { class: 'legal-checks' },
      h('label', { class: 'legal-check' }, acceptTerms,
        h('span', {}, 'Acepto los ', h('a', { href: 'legal.html#terminos', target: '_blank', rel: 'noopener noreferrer' }, 'términos y condiciones'), '.')),
      h('label', { class: 'legal-check' }, acceptPrivacy,
        h('span', {}, 'Autorizo el tratamiento descrito en la ', h('a', { href: 'legal.html#privacidad', target: '_blank', rel: 'noopener noreferrer' }, 'política de privacidad'), '.')));
    screen({
      title: 'Crear cuenta', fields: [user, email, pass, pass2], submit: 'Crear cuenta', formClass: 'signup-form',
      extras: [legalChecks],
      links: [link('Ya tengo cuenta', () => signin())],
      onSubmit: async (setMsg) => {
        if (!acceptTerms.checked || !acceptPrivacy.checked) { setMsg('Acepta por separado los términos y la política de privacidad para crear la cuenta.'); return; }
        if (pass.input.value !== pass2.input.value) { setMsg('Las contraseñas no coinciden.'); return; }
        const r = await K.auth.signUp(email.input.value.trim(), pass.input.value, user.input.value.trim(), { acceptedTerms: acceptTerms.checked, acceptedPrivacy: acceptPrivacy.checked, source: 'web' });
        if (!r.ok) { setMsg(msg(r.error)); return; }
        pass.input.value = ''; pass2.input.value = '';
        if (r.needsConfirm) { pending = email.input.value.trim().toLowerCase(); verifyScreen('Cuenta creada. Te enviamos un código a tu correo.', true); return; }
        dashboard();
      }
    });
  }

  function verifyScreen(notice = '', ok = false) {
    const code = field('Código de verificación', { type: 'text', inputmode: 'numeric', maxlength: '10', placeholder: '••••••' });
    code.input.classList.add('code');
    code.input.addEventListener('input', () => { code.input.value = code.input.value.replace(/\D/g, ''); });
    let left = 0;
    const resend = link('Reenviar código', async () => {
      if (left > 0) return; left = 60; tick();
      const r = await K.auth.resend(pending);
      const m = $('.form-msg'); if (m) { m.textContent = r.ok ? 'Te enviamos un código nuevo.' : msg(r.error); m.classList.toggle('ok', r.ok); }
    });
    const tick = () => {
      if (!resend.isConnected) return;
      resend.disabled = left > 0; resend.textContent = left > 0 ? 'Reenviar en ' + left + ' s' : 'Reenviar código';
      if (left > 0) { left -= 1; setTimeout(tick, 1000); }
    };
    screen({
      title: 'Confirma tu cuenta', text: 'Ingresa el código que enviamos a ' + pending + '.', fields: [code], submit: 'Confirmar', notice, ok,
      links: [link('Ya tengo cuenta', () => signin()), resend],
      onSubmit: async (setMsg) => {
        const r = await K.auth.verify(pending, code.input.value);
        if (r.ok) dashboard(); else setMsg(msg(r.error));
      }
    });
  }

  function recover() {
    const email = field('Correo electrónico', { type: 'email', maxlength: '254' });
    screen({
      title: 'Recuperar contraseña', text: 'Te enviaremos un enlace para crear una contraseña nueva.', fields: [email], submit: 'Enviar enlace',
      links: [link('Volver', () => signin())],
      onSubmit: async (setMsg) => {
        const r = await K.auth.recover(email.input.value.trim());
        if (r.ok) setMsg('Si el correo existe, recibirás un enlace para restablecer tu contraseña.', true); else setMsg(msg(r.error));
      }
    });
  }

  function resetScreen(token) {
    const p1 = field('Contraseña nueva (mínimo 8)', { type: 'password', maxlength: '72', autocomplete: 'new-password' });
    const p2 = field('Repite la contraseña', { type: 'password', maxlength: '72', autocomplete: 'new-password' });
    screen({
      title: 'Crea tu contraseña nueva', fields: [p1, p2], submit: 'Guardar contraseña',
      onSubmit: async (setMsg) => {
        if (p1.input.value !== p2.input.value) { setMsg('Las contraseñas no coinciden.'); return; }
        const r = await K.auth.setPassword(token, p1.input.value);
        if (r.ok) signin('Contraseña actualizada. Ya puedes iniciar sesión.', true); else setMsg(msg(r.error));
      }
    });
  }

  async function dashboard() {
    await K.auth.loadUsername();
    const s = K.session;
    if (!s) { signin(); return; }
    const nav = $('#nav-account'); if (nav) nav.textContent = s.user.username;
    const redeemIn = field('Código de juego o regalo', { type: 'text', maxlength: '14', placeholder: 'XXXX-XXXX-XXXX' });
    redeemIn.input.classList.add('code', 'upper');
    const rmsg = h('p', { class: 'form-msg', role: 'alert' });
    const libBox = h('div', { class: 'grid small' }, h('p', { class: 'muted', text: 'Cargando tu biblioteca…' }));
    const dl = h('a', { class: 'btn primary', id: 'dl', text: 'Descargar launcher' });
    const hint = h('p', { class: 'muted' });

    const redeemForm = h('form', { class: 'inline', novalidate: 'novalidate' }, redeemIn.node, h('button', { class: 'btn', type: 'submit', text: 'Canjear' }));
    redeemForm.addEventListener('submit', async (e) => {
      e.preventDefault(); rmsg.textContent = '';
      const r = await K.data.redeem(redeemIn.input.value);
      if (r.ok) { rmsg.textContent = 'Código canjeado. El juego ya está en tu biblioteca.'; rmsg.className = 'form-msg ok'; redeemIn.input.value = ''; celebrate(rmsg); loadLibrary(); }
      else { rmsg.textContent = msg(r.error); rmsg.className = 'form-msg'; }
    });

    const bio = field('Biografía (máximo 280 caracteres)', { type: 'text', maxlength: '280' });
    const avatarFile = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'field' });
    const bannerFile = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'field' });
    const profilePublic = h('input', { type: 'checkbox' });
    const profileMsg = h('p', { class: 'form-msg', role: 'status' });
    const profileForm = h('form', { class: 'profile-form wide' },
      bio.node,
      h('label', { class: 'lbl' }, h('span', { text: 'Foto de perfil · PNG, JPG o WebP · máximo 3 MB' }), avatarFile),
      h('label', { class: 'lbl' }, h('span', { text: 'Banner · PNG, JPG o WebP · máximo 3 MB' }), bannerFile),
      h('label', { class: 'legal-check' }, profilePublic, h('span', { text: 'Permitir que otros usuarios encuentren y vean este perfil.' })),
      h('p', { class: 'muted privacy-hint', text: 'El perfil empieza privado. No publiques tu correo, ubicación, colegio ni información que permita identificarte.' }),
      profileMsg, h('button', { class: 'btn primary', type: 'submit', text: 'Guardar perfil' }));
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault(); profileMsg.textContent = 'Guardando…';
      let avatarUrl = '', bannerUrl = '';
      if (avatarFile.files && avatarFile.files[0]) {
        const up = await K.data.uploadProfileImage(avatarFile.files[0], 'avatar');
        if (!up.ok) { profileMsg.textContent = up.error === 'invalid_image' ? 'La imagen debe ser PNG, JPG o WebP y pesar hasta 3 MB.' : 'No se pudo subir la foto. Revisa la conexión y el almacenamiento.'; return; }
        avatarUrl = up.path;
      }
      if (bannerFile.files && bannerFile.files[0]) {
        const up = await K.data.uploadProfileImage(bannerFile.files[0], 'banner');
        if (!up.ok) { profileMsg.textContent = up.error === 'invalid_image' ? 'La imagen debe ser PNG, JPG o WebP y pesar hasta 3 MB.' : 'No se pudo subir el banner. Revisa la conexión y el almacenamiento.'; return; }
        bannerUrl = up.path;
      }
      const current = await K.data.myProfile();
      const saved = await K.data.saveProfile({ bio: bio.input.value, profile_public: profilePublic.checked,
        avatar_url: avatarUrl || (current.ok ? current.profile.avatar_url : ''),
        banner_url: bannerUrl || (current.ok ? current.profile.banner_url : '') });
      profileMsg.textContent = saved.ok ? 'Perfil guardado.' : 'No se pudo guardar. Revisa la conexión o vuelve a iniciar sesión.';
      profileMsg.classList.toggle('ok', saved.ok);
    });
    const search = field('Buscar por nombre de usuario', { type: 'search', maxlength: '20', placeholder: 'Mínimo 3 caracteres' });
    const searchMsg = h('p', { class: 'form-msg', role: 'status' });
    const searchResults = h('div', { class: 'social-list' });
    const searchForm = h('form', { class: 'inline' }, search.node, h('button', { class: 'btn', type: 'submit', text: 'Buscar' }));
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault(); searchResults.replaceChildren(); searchMsg.textContent = '';
      const query = search.input.value.trim();
      if (query.length < 3) { searchMsg.textContent = 'Escribe al menos 3 caracteres.'; return; }
      searchMsg.textContent = 'Buscando…';
      const found = await K.data.searchProfiles(query);
      if (!found.ok) { searchMsg.textContent = 'No se pudieron cargar los perfiles. Inténtalo de nuevo.'; return; }
      searchMsg.textContent = found.items.length ? 'Perfiles encontrados' : 'No hay perfiles públicos con ese nombre.';
      for (const p of found.items) {
        const requestButton = h('button', { class: 'btn small', type: 'button', text: 'Agregar amigo' });
        requestButton.addEventListener('click', async () => {
          requestButton.disabled = true;
          const sent = await K.data.sendFriendRequest(p.id);
          requestButton.textContent = sent.ok ? 'Solicitud enviada' : sent.error === 'request_exists' ? 'Solicitud pendiente' : 'No se pudo enviar';
          if (!sent.ok) requestButton.disabled = false;
          loadSocial();
        });
        searchResults.append(h('article', { class: 'social-item profile-result' },
          p.banner_url ? h('img', { class: 'social-banner', src: p.banner_url, alt: '', loading: 'lazy' }) : null,
          p.avatar_url ? h('img', { class: 'social-avatar', src: p.avatar_url, alt: '' }) : h('span', { class: 'social-avatar placeholder', text: p.username.slice(0,1).toUpperCase() }),
          h('div', { class: 'social-copy' }, h('strong', { text: p.username }), h('p', { text: p.bio || 'Sin biografía.' })), requestButton));
      }
    });
    const friendList = h('div', { class: 'social-list' });
    async function loadSocial() {
      const own = await K.data.myProfile();
      if (own.ok) { bio.input.value = own.profile.bio || ''; profilePublic.checked = own.profile.profile_public === true; }
      const data = await K.data.friendRequests();
      friendList.replaceChildren();
      if (!data.ok) { friendList.append(h('p', { class: 'muted', text: 'No se pudieron cargar las solicitudes. Inténtalo de nuevo.' })); return; }
      const me = s.user.id;
      const accepted = data.items.filter(x => x.status === 'accepted');
      const incoming = data.items.filter(x => x.status === 'pending' && x.recipient === me);
      const outgoing = data.items.filter(x => x.status === 'pending' && x.requester === me);
      for (const req of incoming) {
        const other = req.requester_profile || {};
        friendList.append(h('article', { class: 'social-item' }, h('div', { class: 'social-copy' }, h('strong', { text: other.username || 'Usuario' }), h('p', { text: 'Quiere agregarte como amigo.' })),
          h('button', { class: 'btn small', type: 'button', text: 'Aceptar', onclick: async () => { await K.data.respondFriendRequest(req.id, true); loadSocial(); } }),
          h('button', { class: 'btn small', type: 'button', text: 'Rechazar', onclick: async () => { await K.data.respondFriendRequest(req.id, false); loadSocial(); } })));
      }
      for (const req of accepted) {
        const other = req.requester === me ? req.recipient_profile : req.requester_profile;
        friendList.append(h('article', { class: 'social-item' }, h('div', { class: 'social-copy' }, h('strong', { text: (other && other.username) || 'Amigo' }), h('p', { text: 'Amigos' }))));
      }
      for (const req of outgoing) {
        const other = req.recipient_profile || {};
        friendList.append(h('article', { class: 'social-item' }, h('div', { class: 'social-copy' }, h('strong', { text: other.username || 'Usuario' }), h('p', { text: 'Solicitud enviada' }))));
      }
      if (!friendList.children.length) friendList.append(h('p', { class: 'muted', text: 'Todavía no tienes solicitudes ni amigos.' }));
    }
    const accountIntro = h('header', { class: 'account-intro' },
      h('div', {}, h('p', { class: 'eyebrow', text: 'KOVO ACCOUNT' }), h('h1', { text: 'Tu espacio KOVO' }),
        h('p', { class: 'muted', text: 'Tu biblioteca, perfil y amistades, organizados en un solo lugar.' })));
    const overviewView = h('section', { class: 'account-view account-grid', role: 'tabpanel', id: 'account-view-overview', 'aria-labelledby': 'account-tab-overview' },
      h('section', { class: 'panel account-card account-identity', 'aria-labelledby': 'account-profile-title' },
        h('div', { class: 'account-card-heading' }, h('p', { class: 'eyebrow', text: 'TU CUENTA' }), h('h2', { id: 'account-profile-title', text: s.user.username }), h('p', { class: 'muted', text: s.user.email })),
        h('div', { class: 'row-btn' }, dl, s.user.isAdmin && h('a', { class: 'btn', href: 'admin.html', text: 'Administración Discord' }), h('button', { class: 'btn', type: 'button', text: 'Cerrar sesión', onclick: async () => { await K.auth.signOut(); location.reload(); } })), hint),
      h('section', { class: 'panel account-card account-redeem', 'aria-labelledby': 'redeem-title' },
        h('div', { class: 'account-card-heading' }, h('p', { class: 'eyebrow', text: 'AMPLÍA TU BIBLIOTECA' }), h('h2', { id: 'redeem-title', text: 'Canjear un código' }), h('p', { class: 'muted', text: 'Añade un código de juego o regalo a tu cuenta.' })), redeemForm, rmsg),
      h('section', { class: 'panel account-card account-library wide', 'aria-labelledby': 'library-title' },
        h('div', { class: 'account-card-heading' }, h('p', { class: 'eyebrow', text: 'TUS JUEGOS' }), h('h2', { id: 'library-title', text: 'Mi biblioteca' }), h('p', { class: 'muted', text: 'Todos tus juegos, listos para descubrir.' })), libBox));
    const profileView = h('section', { class: 'account-view account-grid', role: 'tabpanel', id: 'account-view-profile', 'aria-labelledby': 'account-tab-profile', hidden: true },
      h('section', { class: 'panel account-card account-profile wide', 'aria-labelledby': 'profile-title' },
        h('div', { class: 'account-card-heading' }, h('p', { class: 'eyebrow', text: 'TU IDENTIDAD' }), h('h2', { id: 'profile-title', text: 'Personaliza tu perfil' }), h('p', { class: 'muted', text: 'Elige cómo te ven otros jugadores.' })), profileForm));
    const friendsView = h('section', { class: 'account-view account-grid', role: 'tabpanel', id: 'account-view-friends', 'aria-labelledby': 'account-tab-friends', hidden: true },
      h('section', { class: 'panel account-card account-friends wide', 'aria-labelledby': 'friends-title' },
        h('div', { class: 'account-card-heading' }, h('p', { class: 'eyebrow', text: 'TU CÍRCULO' }), h('h2', { id: 'friends-title', text: 'Amigos y solicitudes' }), h('p', { class: 'muted', text: 'Acepta solicitudes y consulta tus amistades.' })), friendList));
    const searchView = h('section', { class: 'account-view account-grid', role: 'tabpanel', id: 'account-view-search', 'aria-labelledby': 'account-tab-search', hidden: true },
      h('section', { class: 'panel account-card account-search wide', 'aria-labelledby': 'search-title' },
        h('div', { class: 'account-card-heading' }, h('p', { class: 'eyebrow', text: 'COMUNIDAD' }), h('h2', { id: 'search-title', text: 'Buscar jugadores' }), h('p', { class: 'muted', text: 'Encuentra perfiles públicos por su nombre de usuario.' })), searchForm, searchMsg, searchResults));
    const tabInfo = [
      ['overview', 'Resumen', overviewView], ['profile', 'Personalizar perfil', profileView],
      ['friends', 'Amigos', friendsView], ['search', 'Buscar usuarios', searchView]
    ];
    const tabButtons = tabInfo.map(([id, label]) => h('button', { class: 'account-tab', id: 'account-tab-' + id, type: 'button', role: 'tab', 'aria-controls': 'account-view-' + id, 'aria-selected': String(id === 'overview'), tabindex: id === 'overview' ? '0' : '-1', text: label }));
    const tabList = h('div', { class: 'account-tabs', role: 'tablist', 'aria-label': 'Secciones de tu cuenta' }, ...tabButtons);
    const selectAccountTab = (index, focus) => {
      const next = (index + tabInfo.length) % tabInfo.length;
      tabInfo.forEach(([, , view], i) => { view.hidden = i !== next; });
      tabButtons.forEach((button, i) => { button.setAttribute('aria-selected', String(i === next)); button.tabIndex = i === next ? 0 : -1; });
      if (focus) tabButtons[next].focus();
    };
    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => selectAccountTab(index, false));
      button.addEventListener('keydown', (event) => {
        const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? tabInfo.length - 1 : null;
        if (next === null) return;
        event.preventDefault(); selectAccountTab(next, true);
      });
    });
    root.replaceChildren(accountIntro, tabList, overviewView, profileView, friendsView, searchView);
    setDownload(dl, hint);

    async function loadLibrary() {
      const [g, l] = await Promise.all([K.data.games(), K.data.library()]);
      if (!l.ok) { libBox.replaceChildren(h('p', { class: 'muted', text: l.error === 'unauthorized' ? 'Tu sesión expiró. Inicia sesión de nuevo.' : 'No pudimos cargar tu biblioteca.' })); return; }
      const mine = g.ok ? g.items.filter((x) => l.ids.includes(x.id)) : [];
      libBox.replaceChildren(...(mine.length ? mine.map((x) => h('div', { class: 'card' }, h('div', { class: 'cover' }, cover(x)),
        h('div', { class: 'body' }, h('h3', { text: x.title }), h('div', { class: 'meta', text: x.price === 0 ? 'Gratis' : fmtPrice(x.price) }))))
        : [h('p', { class: 'muted', text: 'Tu biblioteca está vacía. Consigue juegos gratis en la sección Juegos.' })]));
    }
    loadLibrary();
    loadSocial();
  }

  /* ---------- Inicio ---------- */
  if (recoveryToken) resetScreen(recoveryToken);
  else if (K.session) dashboard();
  else signin(linkError);
})();

