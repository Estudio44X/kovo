'use strict';
(() => {
  const motionAllowed = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { h, $, fmtPrice, setDownload } = window.KOVO;
  const palette = ['#d96d41', '#9a7762', '#6c9a62', '#769ad6', '#b491dd', '#df8e43'];
  const featured = $('#featured'), news = $('#news');
  const downloadLinks = [$('#dl'), $('#header-dl')];
  downloadLinks.forEach((link, index) => {
    if (index === 0) setDownload(link, $('#dl-hint'));
    else setDownload(link);
  });

  function observe(root = document) {
    const elements = root.querySelectorAll('[data-reveal]:not(.is-visible)');
    if (!motionAllowed || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.16, rootMargin: '0px 0px -7% 0px' });
    elements.forEach((element) => observer.observe(element));
  }

  function gameImage(game) { return game.cover || 'assets/games/' + game.id + '.svg'; }
  function renderWorld(game, index) {
    const image = h('div', { class: 'world-image', 'aria-hidden': 'true' },
      h('img', { src: gameImage(game), alt: '', loading: 'lazy', draggable: 'false' }));
    image.querySelector('img').addEventListener('error', (event) => { event.currentTarget.hidden = true; }, { once: true });
    const copy = h('div', { class: 'world-copy' },
      h('p', { class: 'world-genre', text: game.genre || 'Disponible en KOVO' }),
      h('h3', { text: game.title }),
      h('p', { class: 'world-description', text: game.desc || 'Descubre este juego en el catálogo de KOVO.' }),
      h('div', { class: 'world-bottom' },
        h('span', { class: 'world-price', text: fmtPrice(game.price) }),
        h('a', { class: 'text-action compact', href: 'games.html#' + encodeURIComponent(game.id) }, 'Ver juego ', h('span', { 'aria-hidden': 'true', text: '↗' }))));
    return h('article', { class: 'world-feature art-tone-' + (index % palette.length) + (index % 2 ? ' reverse' : ''), 'data-reveal': '' }, image, h('div', { class: 'world-shade', 'aria-hidden': 'true' }), copy);
  }

  function renderNews(items, games) {
    if (!items.length) {
      news.replaceChildren(h('p', { class: 'catalog-message', text: 'Pronto compartiremos noticias y novedades de KOVO.' }));
      return;
    }
    const gameById = new Map(games.map((game) => [game.id, game]));
    const primary = items[0], primaryGame = gameById.get(primary.cover);
    const lead = h('article', { class: 'dispatch-lead', 'data-reveal': '' },
      h('div', { class: 'dispatch-art', 'aria-hidden': 'true' }, primaryGame && h('img', { src: gameImage(primaryGame), alt: '', loading: 'lazy' })),
      h('div', { class: 'dispatch-lead-copy' }, h('time', { text: primary.date }), h('h3', { text: primary.title }), h('p', { text: primary.text })));
    const rest = h('div', { class: 'dispatch-rest' }, ...items.slice(1, 4).map((item, index) =>
      h('article', { class: 'dispatch-item', 'data-reveal': '' },
        h('span', { class: 'dispatch-index', text: String(index + 2).padStart(2, '0') }),
        h('div', { class: 'dispatch-main' }, h('time', { text: item.date }), h('h3', { text: item.title }), h('p', { text: item.text })),
        h('span', { class: 'dispatch-arrow', 'aria-hidden': 'true', text: '↗' }))));
    news.replaceChildren(lead, rest);
  }

  async function init() {
    const [gamesResult, newsResult] = await Promise.all([window.KOVO.data.games(), window.KOVO.data.news()]);
    const games = gamesResult.ok ? gamesResult.items : [];
    if (games.length) {
      featured.replaceChildren(...games.slice(0, 4).map(renderWorld));
    } else {
      featured.replaceChildren(h('p', { class: 'catalog-message', text: gamesResult.ok ? 'Estamos preparando los primeros lanzamientos. Vuelve pronto.' : 'El catálogo no está disponible ahora. Inténtalo de nuevo más tarde.' }));
    }
    renderNews(newsResult.ok ? newsResult.items : [], games);
    if (motionAllowed) document.body.classList.add('motion-ready');
    observe();
  }

  init();
})();
