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

  /* ---------- Sesión persistente en este dispositivo; se borra al cerrar sesión ---------- */
  let session = null;
  try {
    let raw = localStorage.getItem(SKEY);
    if (!raw) {
      raw = sessionStorage.getItem(SKEY);
      if (raw) { localStorage.setItem(SKEY, raw); sessionStorage.removeItem(SKEY); }
    }
    const saved = JSON.parse(raw || 'null');
    if (saved && typeof saved.access_token === 'string' && typeof saved.refresh_token === 'string') session = saved;
  } catch { /* el almacenamiento puede estar deshabilitado */ }
  const save = () => {
    try {
      if (session) localStorage.setItem(SKEY, JSON.stringify(session));
      else localStorage.removeItem(SKEY);
      sessionStorage.removeItem(SKEY);
    } catch { /* la sesión sigue viva en memoria */ }
  };
  async function http(method, path, { token, body, extraHeaders = {} } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const headers = { apikey: C.SUPABASE_KEY, 'Content-Type': 'application/json' };
      Object.assign(headers, extraHeaders);
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
    if (msg.includes('legal_acceptance_required')) return 'schema_update_required';
    if (r.status === 500 && (msg.includes('email') || msg.includes('smtp') || code === 'unexpected_failure')) return 'email_delivery_failed';
    if (code === 'same_password') return 'same_password';
    if (code === 'otp_expired' || msg.includes('invalid or has expired') || msg.includes('token has expired')) return 'invalid_otp';
    if (r.status === 429 || code.includes('rate_limit')) return 'rate_limited';
    if (r.status === 401) return 'unauthorized';
    return 'unknown';
  }

  const MESSAGES = {
    network: 'No hay conexión con el servidor.', invalid_credentials: 'Correo o contraseña incorrectos.', consent_required: 'Acepta por separado los términos y la política de privacidad.', email_delivery_failed: 'El correo de confirmacion de KOVO no pudo enviarse. La cuenta puede haberse creado. Corrige el servicio de correo y luego usa la opcion Reenviar codigo; no registres otra vez el mismo correo.',
    schema_update_required: 'Falta aplicar la migración legal v3 de Supabase. Ejecuta 20261026_privacy_v3.sql y vuelve a crear la cuenta. Si ya la aplicaste, publica la versión actual de la web y recarga la página.', email_not_confirmed: 'Confirma tu correo antes de iniciar sesión.', user_exists: 'Ese correo ya está registrado.',
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
  async function authed(method, path, body, options = {}) {
    const token = await ensureToken();
    if (!token) return { ok: false, status: 401, data: null, network: false };
    return http(method, path, { ...options, token, body });
  }

  async function loadUsername() {
    if (!session) return;
    const r = await authed('GET', '/rest/v1/profiles?select=username,is_admin&id=eq.' + encodeURIComponent(session.user.id));
    if (r.ok && Array.isArray(r.data) && r.data[0] && USER_RE.test(String(r.data[0].username))) { session.user.username = r.data[0].username; session.user.isAdmin = r.data[0].is_admin === true; save(); }
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
  async function signUp(email, password, username, consent) {
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid_input' };
    if (!USER_RE.test(username)) return { ok: false, error: 'invalid_username' };
    if (password.length < 8 || password.length > 72) return { ok: false, error: 'weak_password' };
    if (!consent || consent.acceptedTerms !== true || consent.acceptedPrivacy !== true || consent.source !== 'web') return { ok: false, error: 'consent_required' };
    const av = await http('POST', '/rest/v1/rpc/username_available', { body: { p_username: username } });
    if (av.ok && av.data === false) return { ok: false, error: 'username_taken' };
    const r = await http('POST', '/auth/v1/signup', { body: { email: email.toLowerCase(), password, data: {
      username, accepted_terms: true, accepted_privacy: true,
      terms_version: '2026-10-26-v2', privacy_version: '2026-10-26-v3', acceptance_source: 'web'
    } } });
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
    size: str(x.size_label, 20), version: str(x.version, 20), desc: str(x.desc_es, 300), cover: coverOk(x.cover_url),
    banner: coverOk(x.banner_url), icon: coverOk(x.icon_url), music: coverOk(x.music_url)
  });
  const normNews = (x) => (!x || !UUID_RE.test(String(x.id)) || !DATE_RE.test(String(x.published_at)) ? null : {
    id: x.id, date: x.published_at, title: str(x.title_es, 90), text: str(x.text_es, 400), cover: GAME_RE.test(String(x.cover_game_id)) ? x.cover_game_id : null
  });

  async function games() {
    const r = await http('GET', '/rest/v1/games?select=id,title,genre,desc_es,price_cop,size_label,version,cover_url,banner_url,icon_url,music_url&published=eq.true&order=created_at.asc');
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

  async function myProfile() {
    if (!session) return {ok:false,error:'unauthorized'};
    const r=await authed('GET','/rest/v1/profiles?select=id,username,avatar_url,banner_url,bio,profile_public&id=eq.'+encodeURIComponent(session.user.id));
    return r.ok && Array.isArray(r.data) && r.data[0] ? {ok:true,profile:r.data[0]} : {ok:false,error:r.network?'network':'unknown'};
  }
  async function saveProfile(profile) {
    if (!session) return {ok:false,error:'unauthorized'};
    const bio=String(profile.bio||'').trim().slice(0,280);
    const body={bio,profile_public:profile.profile_public===true,avatar_url:profile.avatar_url||null,banner_url:profile.banner_url||null};
    const r=await authed('PATCH','/rest/v1/profiles?id=eq.'+encodeURIComponent(session.user.id)+'&select=id,username,avatar_url,banner_url,bio,profile_public',body,{extraHeaders:{Prefer:'return=representation'}});
    return r.ok?{ok:true}:{ok:false,error:r.network?'network':r.status===401?'unauthorized':'unknown'};
  }
  async function uploadProfileImage(file,kind) {
    if (!session || !file || !['avatar','banner'].includes(kind)) return {ok:false,error:'invalid_input'};
    const allowed={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
    if (!allowed[file.type] || file.size>3145728) return {ok:false,error:'invalid_image'};
    const token=await ensureToken(); if(!token)return {ok:false,error:'unauthorized'};
    const path=String(session.user.id)+'/'+kind+'.'+allowed[file.type];
    const url=BASE+'/storage/v1/object/profile-media/'+path;
    try {
      const res=await fetch(url,{method:'POST',headers:{apikey:C.SUPABASE_KEY,Authorization:'Bearer '+token,'Content-Type':file.type,'x-upsert':'true'},body:file,credentials:'omit',redirect:'error'});
      if(!res.ok)return {ok:false,error:res.status===413?'invalid_image':'upload_failed'};
      return {ok:true,path};
    } catch { return {ok:false,error:'network'}; }
  }
  async function signedProfileImage(path) {
    const clean=String(path||'');
    if(!/^[0-9a-f-]{36}\/(avatar|banner)\.(png|jpg|webp)$/i.test(clean))return '';
    const r=await authed('POST','/storage/v1/object/sign/profile-media/'+clean,{expiresIn:900});
    if(!r.ok||!r.data||typeof r.data.signedURL!=='string')return '';
    return /^https:\/\//i.test(r.data.signedURL)?r.data.signedURL:BASE+'/storage/v1'+(r.data.signedURL.startsWith('/')?r.data.signedURL:'/'+r.data.signedURL);
  }
  async function searchProfiles(query) {
    if(!session)return {ok:false,error:'unauthorized',items:[]};
    const q=String(query||'').trim();
    if(q.length<3)return {ok:true,items:[]};
    const r=await authed('GET','/rest/v1/profiles?select=id,username,avatar_url,banner_url,bio&profile_public=eq.true&username=ilike.*'+encodeURIComponent(q)+'*&limit=15&order=username.asc');
    if(!r.ok||!Array.isArray(r.data))return {ok:false,error:r.network?'network':'unknown',items:[]};
    const items=await Promise.all(r.data.filter(x=>x.id!==session.user.id).map(async x=>({...x,avatar_url:await signedProfileImage(x.avatar_url),banner_url:await signedProfileImage(x.banner_url)})));
    return {ok:true,items};
  }
  async function friendRequests() {
    if(!session)return {ok:false,error:'unauthorized',items:[]};
    const select='select=id,requester,recipient,status,created_at,requester_profile:profiles!friend_requests_requester_fkey(username,avatar_url),recipient_profile:profiles!friend_requests_recipient_fkey(username,avatar_url)';
    const filter='&or=(requester.eq.'+encodeURIComponent(session.user.id)+',recipient.eq.'+encodeURIComponent(session.user.id)+')&order=created_at.desc&limit=80';
    const r=await authed('GET','/rest/v1/friend_requests?'+select+filter);
    if(!r.ok||!Array.isArray(r.data))return {ok:false,error:r.network?'network':'unknown',items:[]};
    const items=await Promise.all(r.data.map(async item=>({ ...item,
      requester_profile:item.requester_profile?{...item.requester_profile,avatar_url:await signedProfileImage(item.requester_profile.avatar_url)}:null,
      recipient_profile:item.recipient_profile?{...item.recipient_profile,avatar_url:await signedProfileImage(item.recipient_profile.avatar_url)}:null
    })));
    return {ok:true,items};
  }
  async function sendFriendRequest(target) {
    if(!session||!UUID_RE.test(String(target)))return {ok:false,error:'invalid_input'};
    const r=await authed('POST','/rest/v1/friend_requests',{requester:session.user.id,recipient:target,status:'pending'},{extraHeaders:{Prefer:'return=minimal'}});
    if(r.ok)return {ok:true};
    const m=String((r.data||{}).message||'').toLowerCase();
    return {ok:false,error:r.status===409||m.includes('duplicate')?'request_exists':r.status===401?'unauthorized':r.network?'network':'unknown'};
  }
  async function respondFriendRequest(id,accept) {
    if(!session||!UUID_RE.test(String(id)))return {ok:false,error:'invalid_input'};
    const r=await authed('PATCH','/rest/v1/friend_requests?id=eq.'+encodeURIComponent(id)+'&recipient=eq.'+encodeURIComponent(session.user.id)+'&status=eq.pending',{status:accept?'accepted':'declined',updated_at:new Date().toISOString()},{extraHeaders:{Prefer:'return=representation'}});
    return r.ok&&Array.isArray(r.data)&&r.data.length?{ok:true}:{ok:false,error:r.status===401?'unauthorized':r.network?'network':'unknown'};
  }
  async function enqueueEmbed(channelId, payload) {
    if (!session || !/^\d{17,20}$/.test(String(channelId))) return { ok: false, error: 'invalid_input' };
    const r = await authed('POST', '/rest/v1/bot_outbox?select=id', { requested_by: session.user.id, kind: 'embed', target_channel: String(channelId), payload, status: 'queued' }, { extraHeaders: { Prefer: 'return=representation' } });
    return r.ok && Array.isArray(r.data) && r.data[0] ? { ok: true, id: r.data[0].id } : { ok: false, error: r.status === 401 ? 'unauthorized' : 'forbidden' };
  }

  async function outboxStatus(id) {
    if (!UUID_RE.test(String(id))) return null;
    const r = await authed('GET', '/rest/v1/bot_outbox?select=status,result&id=eq.' + encodeURIComponent(id));
    return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
  }

  /* ---------- Utilidades de interfaz ---------- */
  const fmtPrice = (n) => (n === 0 ? 'Gratis' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n));
  function cover(g) {
    const img = h('img', { src: g.cover || 'assets/games/' + g.id + '.svg', alt: '', loading: 'lazy', draggable: 'false' });
    img.addEventListener('error', () => img.replaceWith(h('div', { class: 'ph', text: (g.title || '?').charAt(0) })), { once: true });
    return img;
  }
  function setDownload(a, hint) {
    if (!a) return;
    if (C.DOWNLOAD_URL && /^https:\/\//.test(C.DOWNLOAD_URL)) { a.hidden = false; a.href = C.DOWNLOAD_URL; a.rel = 'noopener noreferrer'; }
    else { a.hidden = true; a.removeAttribute('href'); a.classList.add('disabled'); a.setAttribute('aria-disabled', 'true'); if (hint) hint.textContent = 'El enlace oficial de descarga del launcher estará disponible pronto.'; }
  }
  function fixNav() {
    const link = $('#nav-account');
    if (link) {
      const label = session ? session.user.username : 'Iniciar sesión';
      const arrow = link.querySelector('span');
      if (arrow) link.replaceChildren(document.createTextNode(label + ' '), arrow);
      else link.textContent = label;
    }
    const d = $('#discord-link');
    if (d) { if (C.DISCORD_URL && /^https:\/\//.test(C.DISCORD_URL)) { d.href = C.DISCORD_URL; d.rel = 'noopener noreferrer'; d.target = '_blank'; } else d.remove(); }
  }

  window.KOVO = Object.freeze({
    h, $, msg, fmtPrice, cover, setDownload, fixNav, config: C,
    get session() { return session; },
    auth: { signIn, signUp, verify, resend, recover, setPassword, signOut, loadUsername },
    data: { games, news, library, claim, redeem, enqueueEmbed, outboxStatus, myProfile, saveProfile, uploadProfileImage, signedProfileImage, searchProfiles, friendRequests, sendFriendRequest, respondFriendRequest }
  });
  document.addEventListener('DOMContentLoaded', fixNav);
})();
