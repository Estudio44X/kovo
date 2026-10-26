'use strict';
(async () => {
  const K = window.KOVO;
  const { h, $, msg, cover, fmtPrice, setDownload } = K;
  const root = $('#acc');
  let pending = '';

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
  function screen({ title, text, fields, extras = [], submit, onSubmit, links = [], notice = '', ok = false }) {
    const err = h('p', { class: 'form-msg' + (ok ? ' ok' : ''), role: 'alert', text: notice });
    const setMsg = (m, good) => { err.textContent = m || ''; err.classList.toggle('ok', !!good); };
    const btn = h('button', { class: 'btn primary block', type: 'submit', text: submit });
    const form = h('form', { class: 'panel', novalidate: 'novalidate' },
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
      title: 'Crear cuenta', fields: [user, email, pass, pass2], submit: 'Crear cuenta',
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
      if (r.ok) { rmsg.textContent = 'Código canjeado. El juego ya está en tu biblioteca.'; rmsg.className = 'form-msg ok'; redeemIn.input.value = ''; loadLibrary(); }
      else { rmsg.textContent = msg(r.error); rmsg.className = 'form-msg'; }
    });

    root.replaceChildren(h('div', { class: 'dash' },
      h('div', { class: 'panel' }, h('h1', { text: s.user.username }), h('p', { class: 'muted', text: s.user.email }),
        h('div', { class: 'row-btn' }, dl, s.user.isAdmin && h('a', { class: 'btn', href: 'admin.html', text: 'Administración Discord' }), h('button', { class: 'btn', type: 'button', text: 'Cerrar sesión', onclick: async () => { await K.auth.signOut(); location.reload(); } })), hint),
      h('div', { class: 'panel' }, h('h2', { text: 'Canjear código' }), redeemForm, rmsg),
      h('div', { class: 'panel wide' }, h('h2', { text: 'Mi biblioteca' }), libBox)));
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
  }

  /* ---------- Inicio ---------- */
  if (recoveryToken) resetScreen(recoveryToken);
  else if (K.session) dashboard();
  else signin(linkError);
})();
