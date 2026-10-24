'use strict';
// Cliente mínimo de Supabase para la web. Sin librerías externas, sin innerHTML.
(() => {
  const C = window.KOVO_WEB;
  const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  const USER_RE = /^[A-Za-z0-9_]{3,20}$/;
  const GAME_RE = /^[a-z0-9_-]{2,40}$/;
  const CODE_RE = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/;
  const OTP_RE = /^[0-9]{6,10}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const UUID_RE = /^[0-9a-f-]{36}$/i;
  const SKEY = 'kovo_session';
  const BASE = String(C.SUPABASE_URL).replace(/\/+$/, '');

  // Anti-clickjacking (GitHub Pages no permite cabeceras): si alguien enmarca la web, se sale.
  try { if (window.top !== window.self) window.top.location = window.self.location; } catch { document.documentElement.hidden = true; }

  /* ---------- DOM seguro ---------- */
  function h(tag, p = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const $ = (s) => document.querySelector(s);

  /* ---------- Sesión (solo esta pestaña: sessionStorage) ---------- */
  let session = null;
  try { const s = JSON.parse(sessionStorage.getItem(SKEY)); if (s && typeof s.access_token === 'string') session = s; } catch { /* sin sesión */ }
  const save = () => { try { session ? sessionStorage.setItem(SKEY, JSON.stringify(session)) : sessionStorage.removeItem(SKEY); } catch { /* ignorar */ } };

  async function http(method, path, { token, body } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const headers = { apikey: C.SUPABASE_KEY, 'Content-Type': 'application/json' };
      const bearer = token || (C.SUPABASE_KEY.startsWith('eyJ') ? C.SUPABASE_KEY : null);
      if (bearer) headers.Authorization = 'Bearer ' + bearer;
      const res = await fetch(BASE + path, { method, headers, signal: ctrl.signal, redirect: 'error', credentials: 'omit', body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await res.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
      return { ok: res.ok, status: res.status, data, network: false };
    } catch { return { ok: false, status: 0, data: null, network: true }; } finally { clearTimeout(timer); }
  }

  function mapError(r) {
    if (r.network) return 'network';
    const d = r.data || {};
    const code = String(d.error_code || d.code || d.error || '');
    const msg = String(d.msg || d.error_description || d.message || '').toLowerCase();
    if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'invalid_credentials';
    if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'email_not_confirmed';
    if (code === 'user_already_exists' || msg.includes('already registered')) return 'user_exists';
    if (code === 'weak_password') return 'weak_password';
    if (code === 'same_password') return 'same_password';
    if (code === 'otp_expired' || msg.includes('invalid or has expired') || msg.includes('token has expired')) return 'invalid_otp';
    if (r.status === 429 || code.includes('rate_limit')) return 'rate_limited';
    if (r.status === 401) return 'unauthorized';
    return 'unknown';
  }

  const MESSAGES = {
    network: 'No hay conexión con el servidor.', invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_confirmed: 'Confirma tu correo antes de iniciar sesión.', user_exists: 'Ese correo ya está registrado.',
    weak_password: 'La contraseña debe tener al menos 8 caracteres.', same_password: 'La nueva contraseña debe ser distinta a la anterior.',
    invalid_otp: 'Código incorrecto o vencido.', rate_limited: 'Demasiados intentos. Espera un momento.',
    unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo.', invalid_input: 'Revisa los datos ingresados.',
    invalid_username: 'Usuario de 3 a 20 letras, números o guion bajo.', username_taken: 'Ese nombre de usuario ya existe.',
    invalid_code: 'Código inválido o ya usado.', already_owned: 'Ya tienes este juego.', not_free: 'Este juego no es gratuito.',
    not_found: 'Juego no encontrado.', locked: 'Demasiados intentos fallidos. Espera 30 segundos.', unknown: 'Ocurrió un error. Inténtalo de nuevo.'
  };
  const msg = (e) => MESSAGES[e] || MESSAGES.unknown;

  /* ---------- Frenos locales ---------- */
  let fails = 0, lockUntil = 0;
  const locked = () => Date.now() < lockUntil;
  const strike = () => { fails += 1; if (fails >= 5) { fails = 0; lockUntil = Date.now() + 30000; } };

  /* ---------- Sesión ---------- */
  function applyTokens(d, username) {
    const u = d.user || {}, meta = u.user_metadata || {}, email = String(u.email || '');
    session = {
      access_token: String(d.access_token), refresh_token: String(d.refresh_token || ''),
      expires_at: Date.now() + (Number(d.expires_in) || 3600) * 1000,
      user: { id: String(u.id || ''), email, username: String(username || meta.username || email.split('@')[0]).slice(0, 20) }
    };
    save();
  }

  let refreshing = null;
  async function ensureToken() {
    if (!session) return null;
    if (Date.now() < session.expires_at - 60000) return session.access_token;
    if (!refreshing) {
      refreshing = (async () => {
        const r = await http('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } });
        if (r.ok && r.data && r.data.access_token) { applyTokens(r.data, session.user.username); return; }
        if (r.status === 400 || r.status === 401 || r.status === 403) { session = null; save(); }
      })().finally(() => { refreshing = null; });
    }
    await refreshing;
    return session && Date.now() < session.expires_at ? session.access_token : null;
  }
  async function authed(method, path, body) {
    const token = await ensureToken();
    if (!token) return { ok: false, status: 401, data: null, network: false };
    return http(method, path, { token, body });
  }

  async function loadUsername() {
    if (!session) return;
    const r = await authed('GET', '/rest/v1/profiles?select=username&id=eq.' + encodeURIComponent(session.user.id));
    if (r.ok && Array.isArray(r.data) && r.data[0] && USER_RE.test(String(r.data[0].username))) { session.user.username = r.data[0].username; save(); }
  }

  /* ---------- Cuenta ---------- */
  async function signIn(email, password) {
    if (!EMAIL_RE.test(email) || !password || password.length > 72) return { ok: false, error: 'invalid_input' };
    if (locked()) return { ok: false, error: 'locked' };
    const r = await http('POST', '/auth/v1/token?grant_type=password', { body: { email: email.toLowerCase(), password } });
    if (!r.ok || !r.data || !r.data.access_token) { const error = mapError(r); if (error === 'invalid_credentials') strike(); return { ok: false, error }; }
    fails = 0; applyTokens(r.data); await loadUsername();
    return { ok: true };
  }
  async function signUp(email, password, username) {
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid_input' };
    if (!USER_RE.test(username)) return { ok: false, error: 'invalid_username' };
    if (password.length < 8 || password.length > 72) return { ok: false, error: 'weak_password' };
    const av = await http('POST', '/rest/v1/rpc/username_available', { body: { p_username: username } });
    if (av.ok && av.data === false) return { ok: false, error: 'username_taken' };
    const r = await http('POST', '/auth/v1/signup', { body: { email: email.toLowerCase(), password, data: { username } } });
    if (!r.ok) return { ok: false, error: mapError(r) };
    const d = r.data || {};
    if (Array.isArray(d.identities) && d.identities.length === 0) return { ok: false, error: 'user_exists' };
    if (d.access_token) { applyTokens(d, username); return { ok: true }; }
    return { ok: true, needsConfirm: true };
  }
  async function verify(email, code) {
    const c = String(code || '').replace(/\s/g, '');
    if (!EMAIL_RE.test(email) || !OTP_RE.test(c)) return { ok: false, error: 'invalid_otp' };
    if (locked()) return { ok: false, error: 'locked' };
    const r = await http('POST', '/auth/v1/verify', { body: { type: 'signup', email: email.toLowerCase(), token: c } });
    if (!r.ok || !r.data || !r.data.access_token) {
      let error = mapError(r);
      if (error === 'unknown' && [400, 403, 422].includes(r.status)) error = 'invalid_otp';
      if (error === 'invalid_otp') strike();
      return { ok: false, error };
    }
    fails = 0; applyTokens(r.data); await loadUsername();
    return { ok: true };
  }
  async function resend(email) {
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid_input' };
    const r = await http('POST', '/auth/v1/resend', { body: { type: 'signup', email: email.toLowerCase() } });
    if (r.network) return { ok: false, error: 'network' };
    if (r.status === 429) return { ok: false, error: 'rate_limited' };
    return { ok: true };
  }
  async function recover(email) {
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid_input' };
    const redirect = location.origin + location.pathname.replace(/[^/]*$/, '') + 'account.html';
    const r = await http('POST', '/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), { body: { email: email.toLowerCase() } });
    if (r.network) return { ok: false, error: 'network' };
    if (r.status === 429) return { ok: false, error: 'rate_limited' };
    return { ok: true };
  }
  // Nueva contraseña con el token que llega en el enlace de recuperación (#access_token=...).
  async function setPassword(token, password) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return { ok: false, error: 'unauthorized' };
    if (password.length < 8 || password.length > 72) return { ok: false, error: 'weak_password' };
    const r = await http('PUT', '/auth/v1/user', { token, body: { password } });
    return r.ok ? { ok: true } : { ok: false, error: mapError(r) };
  }
  async function signOut() {
    const token = session && session.access_token;
    if (token) await http('POST', '/auth/v1/logout?scope=local', { token });
    session = null; save();
  }

  /* ---------- Datos ---------- */
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const coverOk = (u) => (typeof u === 'string' && u.length < 400 && u.startsWith(BASE + '/storage/v1/object/public/') ? u : null);
  const normGame = (x) => (!x || !GAME_RE.test(String(x.id)) ? null : {
    id: x.id, title: str(x.title, 60), genre: str(x.genre, 30), price: Math.max(0, parseInt(x.price_cop, 10) || 0),
    size: str(x.size_label, 20), version: str(x.version, 20), desc: str(x.desc_es, 300), cover: coverOk(x.cover_url)
  });
  const normNews = (x) => (!x || !UUID_RE.test(String(x.id)) || !DATE_RE.test(String(x.published_at)) ? null : {
    id: x.id, date: x.published_at, title: str(x.title_es, 90), text: str(x.text_es, 400), cover: GAME_RE.test(String(x.cover_game_id)) ? x.cover_game_id : null
  });

  async function games() {
    const r = await http('GET', '/rest/v1/games?select=id,title,genre,desc_es,price_cop,size_label,version,cover_url&published=eq.true&order=created_at.asc');
    return r.ok && Array.isArray(r.data) ? { ok: true, items: r.data.map(normGame).filter(Boolean) } : { ok: false, error: r.network ? 'network' : 'unknown' };
  }
  async function news() {
    const r = await http('GET', '/rest/v1/news?select=id,published_at,title_es,text_es,cover_game_id&published=eq.true&order=published_at.desc&limit=6');
    return r.ok && Array.isArray(r.data) ? { ok: true, items: r.data.map(normNews).filter(Boolean) } : { ok: false, error: r.network ? 'network' : 'unknown' };
  }
  async function library() {
    const r = await authed('GET', '/rest/v1/library?select=game_id');
    return r.ok && Array.isArray(r.data) ? { ok: true, ids: r.data.map((x) => String(x.game_id)).filter((i) => GAME_RE.test(i)) } : { ok: false, error: r.network ? 'network' : 'unauthorized' };
  }
  async function rpc(name, body) {
    const r = await authed('POST', '/rest/v1/rpc/' + name, body);
    if (r.network) return { ok: false, error: 'network' };
    if (!r.ok) return { ok: false, error: r.status === 401 ? 'unauthorized' : 'unknown' };
    const d = r.data;
    if (!d || typeof d !== 'object') return { ok: false, error: 'unknown' };
    return { ok: d.ok === true, error: d.error ? String(d.error) : undefined };
  }
  const claim = (id) => (GAME_RE.test(id) ? rpc('claim_free_game', { p_game_id: id }) : Promise.resolve({ ok: false, error: 'invalid_input' }));
  const redeem = (code) => { const c = String(code || '').trim().toUpperCase(); return CODE_RE.test(c) ? rpc('redeem_code', { p_code: c }) : Promise.resolve({ ok: false, error: 'invalid_code' }); };

  /* ---------- Utilidades de interfaz ---------- */
  const fmtPrice = (n) => (n === 0 ? 'Gratis' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n));
  function cover(g) {
    const img = h('img', { src: g.cover || 'assets/games/' + g.id + '.svg', alt: '', loading: 'lazy', draggable: 'false' });
    img.addEventListener('error', () => img.replaceWith(h('div', { class: 'ph', text: (g.title || '?').charAt(0) })), { once: true });
    return img;
  }
  function setDownload(a, hint) {
    if (!a) return;
    if (C.DOWNLOAD_URL && /^https:\/\//.test(C.DOWNLOAD_URL)) { a.href = C.DOWNLOAD_URL; a.rel = 'noopener noreferrer'; }
    else { a.removeAttribute('href'); a.classList.add('disabled'); a.setAttribute('aria-disabled', 'true'); if (hint) hint.textContent = 'La descarga estará disponible muy pronto.'; }
  }
  function fixNav() {
    const link = $('#nav-account');
    if (link && session) link.textContent = session.user.username;
    const d = $('#discord-link');
    if (d) { if (C.DISCORD_URL && /^https:\/\//.test(C.DISCORD_URL)) { d.href = C.DISCORD_URL; d.rel = 'noopener noreferrer'; d.target = '_blank'; } else d.remove(); }
  }

  window.KOVO = Object.freeze({
    h, $, msg, fmtPrice, cover, setDownload, fixNav, config: C,
    get session() { return session; },
    auth: { signIn, signUp, verify, resend, recover, setPassword, signOut, loadUsername },
    data: { games, news, library, claim, redeem }
  });
  document.addEventListener('DOMContentLoaded', fixNav);
})();
