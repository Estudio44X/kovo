'use strict';
(async () => {
  const { h, $, fmtPrice, cover, msg } = window.KOVO;
  const box = $('#games'), note = $('#note');
  let filter = 'all', items = [], owned = new Set();
  const signed = () => !!window.KOVO.session;

  function toast(text, bad) {
    note.textContent = text; note.className = 'note ' + (bad ? 'err' : 'ok');
    setTimeout(() => { note.textContent = ''; note.className = 'note'; }, 4000);
  }

  async function claim(g, btn) {
    if (!signed()) { location.href = 'account.html'; return; }
    btn.disabled = true;
    const r = await window.KOVO.data.claim(g.id);
    if (r.ok || r.error === 'already_owned') { owned.add(g.id); toast(g.title + ' agregado a tu biblioteca. Ábrelo desde el launcher.'); render(); }
    else { btn.disabled = false; toast(msg(r.error), true); }
  }

  function card(g) {
    let action;
    if (owned.has(g.id)) action = h('span', { class: 'tag', text: 'En tu biblioteca' });
    else if (g.price === 0) { const b = h('button', { class: 'btn primary small', type: 'button', text: signed() ? 'Obtener' : 'Inicia sesión' }); b.addEventListener('click', () => claim(g, b)); action = b; }
    else action = h('span', { class: 'tag', text: 'Compra próximamente' });
    return h('article', { class: 'card' },
      h('div', { class: 'cover' }, cover(g), g.price === 0 && h('span', { class: 'badge free', text: 'Gratis' })),
      h('div', { class: 'body' }, h('h3', { text: g.title }), h('div', { class: 'meta', text: g.genre + (g.size ? ' · ' + g.size : '') }),
        h('p', { class: 'desc', text: g.desc }), h('div', { class: 'row' }, h('span', { class: 'price', text: fmtPrice(g.price) }), action)));
  }

  function render() {
    const list = items.filter((g) => filter === 'all' || (filter === 'free' ? g.price === 0 : g.price > 0));
    box.replaceChildren(...(list.length ? list.map(card) : [h('p', { class: 'muted', text: 'No hay juegos en esta categoría.' })]));
  }

  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('on', x === b));
    render();
  }));

  const r = await window.KOVO.data.games();
  if (!r.ok) { box.replaceChildren(h('p', { class: 'muted', text: 'No pudimos cargar los juegos. Inténtalo más tarde.' })); return; }
  items = r.items;
  if (signed()) { const l = await window.KOVO.data.library(); if (l.ok) owned = new Set(l.ids); }
  render();
})();
