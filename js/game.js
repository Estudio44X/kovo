'use strict';
(async () => {
  const { h, $, fmtPrice } = window.KOVO;
  const root = $('#game-detail');
  const id = new URLSearchParams(location.search).get('id') || '';
  if (!/^[a-z0-9_-]{2,40}$/.test(id)) { root.replaceChildren(h('h1', { text: 'Juego no encontrado' }), h('a', { class: 'btn game-detail-back', href: 'games.html', text: 'Volver a juegos' })); return; }
  const r = await window.KOVO.data.games();
  const g = r.ok && r.items.find(x => x.id === id);
  if (!g) { root.replaceChildren(h('h1', { text: 'No encontramos este juego' }), h('p', { class: 'muted', text: 'Puede que ya no esté publicado.' }), h('a', { class: 'btn game-detail-back', href: 'games.html', text: 'Volver a juegos' })); return; }
  document.title = g.title + ' · KOVO Interactive';
  const art = g.banner || g.cover || 'assets/games/' + g.id + '.svg';
  const hero = h('section', { class: 'game-detail-hero' }, h('img', { src: art, alt: 'Arte de ' + g.title }), h('div', { class: 'game-detail-title' }, h('span', { class: 'tag', text: g.genre }), h('h1', { text: g.title }), h('p', { text: g.desc || 'Descubre este juego de KOVO Interactive.' })));
  const facts = h('aside', { class: 'game-detail-facts' }, g.icon && h('img', { class: 'game-detail-icon', src: g.icon, alt: 'Icono de ' + g.title }), h('div', {}, h('small', { text: 'Tamaño de descarga' }), h('strong', { text: g.size || 'Por anunciar' })), h('div', {}, h('small', { text: 'Versión' }), h('strong', { text: g.version || 'Próximamente' })), h('div', {}, h('small', { text: 'Precio' }), h('strong', { text: g.price === 0 ? 'Gratis' : fmtPrice(g.price) })), g.music && h('div', {}, h('small', { text: 'Música del juego' }), h('audio', { class: 'game-detail-audio', src: g.music, controls: 'controls', preload: 'none' })), h('p', { class: 'muted', text: 'Esta página es una ficha informativa. La instalación se realiza desde el launcher.' }));
  root.replaceChildren(h('a', { class: 'btn small game-detail-back', href: 'games.html', text: '← Todos los juegos' }), hero, h('div', { class: 'game-detail-content' }, h('section', {}, h('h2', { text: 'Acerca del juego' }), h('p', { class: 'game-detail-description', text: g.desc || 'Pronto habrá más información.' })), facts));
})();
