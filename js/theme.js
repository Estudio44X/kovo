'use strict';
(() => {
  const doc = document;
  const root = doc.documentElement;
  let stored = '';
  try { stored = sessionStorage.getItem('kovo_theme') || ''; } catch (_) {}
  const systemTheme = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  let activeTheme = stored === 'light' || stored === 'dark' ? stored : systemTheme();
  const paint = (theme, remember) => {
    activeTheme = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = activeTheme;
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = activeTheme === 'light' ? '#f4f2ed' : '#0c0d10';
    const button = doc.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-label', activeTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      button.setAttribute('aria-pressed', String(activeTheme === 'light'));
      button.textContent = activeTheme === 'dark' ? '☼' : '☾';
    }
    if (remember) { try { sessionStorage.setItem('kovo_theme', activeTheme); } catch (_) {} }
  };
  paint(activeTheme, false);
  const ready = () => {
    const right = doc.querySelector('.top .right');
    if (right && !doc.getElementById('theme-toggle')) {
      const toggle = doc.createElement('button');
      toggle.type = 'button'; toggle.id = 'theme-toggle'; toggle.className = 'theme-toggle';
      toggle.setAttribute('aria-label', activeTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      toggle.setAttribute('aria-pressed', String(activeTheme === 'light'));
      toggle.title = 'Cambiar apariencia'; toggle.textContent = activeTheme === 'dark' ? '☼' : '☾';
      toggle.addEventListener('click', () => paint(activeTheme === 'dark' ? 'light' : 'dark', true));
      right.prepend(toggle);
    }
    if (stored === 'light' || stored === 'dark') return;
    const dialog = doc.createElement('dialog');
    dialog.className = 'theme-dialog';
    dialog.setAttribute('aria-labelledby', 'theme-dialog-title');
    const content = doc.createElement('div'); content.className = 'theme-dialog-content';
    const eyebrow = doc.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'KOVO INTERACTIVE';
    const title = doc.createElement('h2'); title.id = 'theme-dialog-title'; title.textContent = '¿Claro u oscuro?';
    const copy = doc.createElement('p'); copy.className = 'muted'; copy.textContent = 'Elige cómo quieres explorar KOVO. Puedes cambiarlo cuando quieras desde la barra superior.';
    const actions = doc.createElement('div'); actions.className = 'theme-dialog-actions';
    for (const [label, value, icon] of [['Claro', 'light', '☼'], ['Oscuro', 'dark', '☾']]) {
      const choice = doc.createElement('button'); choice.type = 'button'; choice.className = 'theme-choice';
      const mark = doc.createElement('span'); mark.className = 'theme-choice-icon'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = icon;
      const text = doc.createElement('span'); text.textContent = label;
      choice.append(mark, text);
      choice.addEventListener('click', () => { paint(value, true); dialog.close(); dialog.remove(); });
      actions.append(choice);
    }
    content.append(eyebrow, title, copy, actions); dialog.append(content); doc.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
})();
