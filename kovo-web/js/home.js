'use strict';
(async () => {
  const { h, $, fmtPrice, cover, setDownload } = window.KOVO;
  setDownload($('#dl'), $('#dl-hint'));

  const [g, n] = await Promise.all([window.KOVO.data.games(), window.KOVO.data.news()]);
  const gBox = $('#featured'), nBox = $('#news');

  if (!g.ok) gBox.replaceChildren(h('p', { class: 'muted', text: 'No pudimos cargar los juegos. Inténtalo más tarde.' }));
  else if (!g.items.length) gBox.replaceChildren(h('p', { class: 'muted', text: 'Pronto habrá juegos aquí.' }));
  else gBox.replaceChildren(...g.items.slice(0, 4).map((x) => h('a', { class: 'card', href: 'games.html' },
    h('div', { class: 'cover' }, cover(x), x.price === 0 && h('span', { class: 'badge free', text: 'Gratis' })),
    h('div', { class: 'body' }, h('h3', { text: x.title }), h('div', { class: 'meta', text: x.genre }), h('div', { class: 'price', text: fmtPrice(x.price) })))));

  if (!n.ok) nBox.replaceChildren(h('p', { class: 'muted', text: 'No pudimos cargar las noticias.' }));
  else if (!n.items.length) nBox.replaceChildren(h('p', { class: 'muted', text: 'Aún no hay noticias.' }));
  else nBox.replaceChildren(...n.items.slice(0, 3).map((x) => h('article', { class: 'news-item' },
    h('time', { text: x.date }), h('h3', { text: x.title }), h('p', { text: x.text }))));
})();
