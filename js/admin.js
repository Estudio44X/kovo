'use strict';
(async () => {
  const { h, $, auth, data } = window.KOVO;
  const status = $('#admin-status'), root = $('#admin-root');
  if (!window.KOVO.session) { location.replace('account.html'); return; }
  await auth.loadUsername();
  if (!window.KOVO.session || !window.KOVO.session.user.isAdmin) {
    status.textContent = 'Tu cuenta no tiene permisos para abrir este editor.';
    status.classList.add('err');
    root.replaceChildren(); return;
  }
  status.textContent = 'Permisos de KOVO confirmados. El bot verificará también tu rol Discord al procesar cada envío.';
  status.classList.add('ok');

  const channel = h('input', { class: 'field', inputmode: 'numeric', maxlength: '20', placeholder: 'ID del canal Discord' });
  const title = h('input', { class: 'field', maxlength: '256', placeholder: 'Título' });
  const description = h('textarea', { class: 'field embed-textarea', maxlength: '4000', placeholder: 'Descripción (Markdown de Discord)' });
  const color = h('input', { class: 'field color-field', type: 'color', value: '#4c8dff', 'aria-label': 'Color del embed' });
  const author = h('input', { class: 'field', maxlength: '256', placeholder: 'Autor' });
  const authorUrl = h('input', { class: 'field', type: 'url', placeholder: 'URL del autor (https)' });
  const authorIcon = h('input', { class: 'field', type: 'url', placeholder: 'URL del icono del autor (https)' });
  const footer = h('input', { class: 'field', maxlength: '2048', placeholder: 'Pie del embed' });
  const footerIcon = h('input', { class: 'field', type: 'url', placeholder: 'URL del icono del pie (https)' });
  const image = h('input', { class: 'field', type: 'url', placeholder: 'URL de imagen (https)' });
  const thumbnail = h('input', { class: 'field', type: 'url', placeholder: 'URL de miniatura (https)' });
  const link = h('input', { class: 'field', type: 'url', placeholder: 'URL del título (opcional)' });
  const timestamp = h('input', { type: 'checkbox' });
  const fieldRows = [];
  const preview = h('article', { class: 'discord-preview' });
  const message = h('p', { class: 'form-msg', role: 'status' });

  const label = (name, input) => h('label', { class: 'lbl admin-label' }, h('span', { text: name }), input);
  const makeField = () => {
    if (fieldRows.length >= 25) return;
    const name = h('input', { class: 'field', maxlength: '256', placeholder: 'Nombre del campo' });
    const value = h('textarea', { class: 'field embed-textarea', maxlength: '1024', placeholder: 'Contenido del campo' });
    const inline = h('input', { type: 'checkbox' });
    const row = h('div', { class: 'embed-field-row' }, name, value, h('label', { class: 'inline-check' }, inline, h('span', { text: 'En línea' })), h('button', { class: 'link remove-field', type: 'button', text: 'Quitar' }));
    const item = { name, value, inline, row };
    fieldRows.push(item);
    row.querySelector('.remove-field').addEventListener('click', () => { fieldRows.splice(fieldRows.indexOf(item), 1); row.remove(); update(); });
    $('#embed-fields').append(row); update();
  };

  const fieldList = h('div', { id: 'embed-fields', class: 'embed-fields' });
  const addField = h('button', { class: 'btn', type: 'button', text: 'Añadir campo' });
  addField.addEventListener('click', makeField);
  const form = h('form', { class: 'embed-editor' },
    h('section', { class: 'panel' }, h('h2', { text: 'Contenido' }), label('Canal destino', channel), label('Título', title), label('Enlace del título', link), label('Descripción', description),
      h('div', { class: 'admin-field-head' }, h('h3', { text: 'Campos' }), addField), fieldList,
      label('Color', color), label('Autor', author), label('Enlace del autor', authorUrl), label('Icono del autor', authorIcon),
      label('Imagen', image), label('Miniatura', thumbnail), label('Pie', footer), label('Icono del pie', footerIcon),
      h('label', { class: 'inline-check' }, timestamp, h('span', { text: 'Añadir fecha y hora actual' })),
      h('button', { class: 'btn primary', type: 'submit', text: 'Enviar al canal' }), message),
    h('aside', { class: 'preview-column' }, h('h2', { text: 'Vista previa en vivo' }), preview));

  function httpsUrl(input) {
    const value = input.value.trim();
    if (!value) return null;
    try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
  }
  function payload() {
    const out = {};
    if (title.value.trim()) out.title = title.value.trim();
    if (description.value.trim()) out.description = description.value.trim();
    if (link.value.trim() && httpsUrl(link)) out.url = httpsUrl(link);
    out.color = parseInt(color.value.slice(1), 16);
    if (author.value.trim()) {
      out.author = { name: author.value.trim() };
      if (httpsUrl(authorUrl)) out.author.url = httpsUrl(authorUrl);
      if (httpsUrl(authorIcon)) out.author.icon_url = httpsUrl(authorIcon);
    }
    if (footer.value.trim()) {
      out.footer = { text: footer.value.trim() };
      if (httpsUrl(footerIcon)) out.footer.icon_url = httpsUrl(footerIcon);
    }
    if (httpsUrl(image)) out.image = { url: httpsUrl(image) };
    if (httpsUrl(thumbnail)) out.thumbnail = { url: httpsUrl(thumbnail) };
    const fields = fieldRows.filter((f) => f.name.value.trim() && f.value.value.trim()).map((f) => ({ name: f.name.value.trim(), value: f.value.value.trim(), inline: f.inline.checked }));
    if (fields.length) out.fields = fields;
    if (timestamp.checked) out.timestamp = new Date().toISOString();
    return out;
  }
  function update() {
    const p = payload();
    const accent = '#' + p.color.toString(16).padStart(6, '0');
    const children = [];
    if (p.author) children.push(h('div', { class: 'discord-author', text: p.author.name }));
    if (p.title) children.push(h('h3', {}, p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer', text: p.title }) : p.title));
    if (p.description) children.push(h('p', { class: 'discord-description', text: p.description }));
    if (p.fields) children.push(h('div', { class: 'discord-preview-fields' }, p.fields.map((f) => h('div', { class: f.inline ? 'discord-preview-field inline' : 'discord-preview-field' }, h('b', { text: f.name }), h('span', { text: f.value })))));
    if (p.image) children.push(h('img', { class: 'discord-image', src: p.image.url, alt: 'Imagen del embed', referrerpolicy: 'no-referrer', loading: 'lazy' }));
    if (p.thumbnail) children.push(h('img', { class: 'discord-thumbnail', src: p.thumbnail.url, alt: 'Miniatura del embed', referrerpolicy: 'no-referrer', loading: 'lazy' }));
    if (p.footer) children.push(h('div', { class: 'discord-footer', text: p.footer.text }));
    if (p.timestamp) children.push(h('time', { class: 'discord-footer', text: new Date(p.timestamp).toLocaleString('es-CO') }));
    preview.style.setProperty('--embed-accent', accent);
    preview.replaceChildren(...(children.length ? children : [h('p', { class: 'muted', text: 'Tu embed aparecerá aquí mientras lo editas.' })]));
  }
  [title, description, color, author, authorUrl, authorIcon, footer, footerIcon, image, thumbnail, link, timestamp].forEach((el) => el.addEventListener('input', update));
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); message.textContent = '';
    if (!/^\d{17,20}$/.test(channel.value.trim())) { message.textContent = 'Escribe el ID numérico del canal Discord.'; return; }
    const currentPayload = payload();
    if (!currentPayload.title && !currentPayload.description && !currentPayload.fields) { message.textContent = 'Añade un título, una descripción o al menos un campo completo.'; return; }
    if ([link, authorUrl, authorIcon, footerIcon, image, thumbnail].some((x) => x.value.trim() && !httpsUrl(x))) { message.textContent = 'Los enlaces deben usar HTTPS.'; return; }
    const characterCount = [currentPayload.title, currentPayload.description, currentPayload.author && currentPayload.author.name, currentPayload.footer && currentPayload.footer.text, ...(currentPayload.fields || []).flatMap((f) => [f.name, f.value])].filter(Boolean).join('').length;
    if (characterCount > 6000) { message.textContent = 'Discord permite un máximo combinado de 6000 caracteres de texto por embed.'; return; }
    const result = await data.enqueueEmbed(channel.value.trim(), currentPayload);
    if (result.ok) {
      message.textContent = 'En cola. Comprobando el estado del envío…'; message.classList.add('ok');
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const state = await data.outboxStatus(result.id);
        if (state && state.status === 'sent') { message.textContent = 'Embed enviado correctamente.'; break; }
        if (state && state.status === 'failed') { message.textContent = state.result || 'El bot rechazó el envío. Confirma canal, permisos y rol Discord.'; message.classList.remove('ok'); break; }
        if (state && state.status === 'sending') message.textContent = 'El bot validó el trabajo y lo está enviando…';
      }
      if (message.textContent.startsWith('En cola.') || message.textContent.startsWith('El bot validó')) message.textContent = 'El trabajo sigue en cola. Comprueba que el bot está activo y vuelve a cargar para revisar su estado.';
    } else { message.textContent = 'No se pudo encolar. Confirma el SQL actualizado, tu conexión y el permiso de administrador.'; message.classList.remove('ok'); }
  });
  root.replaceChildren(form);
  update();
})();
