/* =============================================================
   UI — modal dialogs, toasts, confirms, CSV export
   Everything the toolbar and row buttons need to actually do
   something. No dependencies.
   ============================================================= */
const UI = (function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- host elements ---------------- */
  let layer, toastBox;

  function ensure() {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ui-layer';
      layer.setAttribute('aria-live', 'polite');
      document.body.appendChild(layer);
    }
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'ui-toasts';
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
  }

  /* ---------------- toast ---------------- */
  function toast(message, tone, action) {
    ensure();
    const el = document.createElement('div');
    el.className = 'ui-toast' + (tone ? ' ui-toast--' + tone : '');
    el.innerHTML = `<span>${esc(message)}</span>`;

    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ui-toast__btn';
      b.textContent = action.label;
      b.addEventListener('click', () => { action.onClick(); dismiss(); });
      el.appendChild(b);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'ui-toast__x';
    x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = '&times;';
    x.addEventListener('click', dismiss);
    el.appendChild(x);

    toastBox.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));

    let timer = setTimeout(dismiss, action ? 7000 : 3800);
    function dismiss() {
      clearTimeout(timer);
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 250);
    }
    return dismiss;
  }

  /* ---------------- confirm ---------------- */
  function confirm({ title, message, confirmLabel, danger, detail }) {
    return new Promise(resolve => {
      ensure();
      let done = false;
      const finish = (v) => { if (done) return; done = true; close(); resolve(v); };

      const back = document.createElement('div');
      back.className = 'ui-backdrop';
      back.innerHTML = `
<div class="ui-dialog ui-dialog--sm" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="ui-dialog__head"><h3>${esc(title)}</h3></div>
  <div class="ui-dialog__body">
    <p>${esc(message)}</p>
    ${detail ? `<p class="ui-dialog__detail">${detail}</p>` : ''}
  </div>
  <div class="ui-dialog__foot">
    <button class="btn btn--ghost" type="button" data-no>Cancel</button>
    <button class="btn ${danger ? 'btn--danger' : ''}" type="button" data-yes>${esc(confirmLabel || 'Confirm')}</button>
  </div>
</div>`;

      back.addEventListener('click', e => { if (e.target === back) finish(false); });
      $('[data-no]', back).addEventListener('click', () => finish(false));
      $('[data-yes]', back).addEventListener('click', () => finish(true));
      layer.appendChild(back);
      requestAnimationFrame(() => back.classList.add('is-in'));
      $('[data-yes]', back).focus();

      function onKey(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); finish(false); }
      }
      document.addEventListener('keydown', onKey);
      function close() {
        document.removeEventListener('keydown', onKey);
        back.classList.remove('is-in');
        setTimeout(() => back.remove(), 200);
      }
    });
  }

  /* ---------------- modal form ---------------- */
  function modal(opts) {
    ensure();
    const fields = opts.fields || [];
    const values = opts.values || {};
    const titleId = 'ui-dlg-' + Math.random().toString(36).slice(2, 8);

    const fieldHTML = (f) => {
      const v = values[f.key] !== undefined ? values[f.key] : (f.value !== undefined ? f.value : '');
      const id = 'f-' + f.key + '-' + Math.random().toString(36).slice(2, 6);
      const req = f.required ? ' required' : '';
      const wide = f.half ? '' : ' ui-field--full';

      let control;
      if (f.type === 'select') {
        control = `<select id="${id}" name="${f.key}"${req}>${
          (f.options || []).map(o => `<option value="${esc(o.value)}"${String(o.value) === String(v) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')
        }</select>`;
      } else if (f.type === 'datalist') {
        /* searchable pick-list for very long option sets (whole catalogue) */
        const listId = id + '-dl';
        control = `<input id="${id}" name="${f.key}" type="text" list="${listId}"${req} autocomplete="off"${
          f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''} value="${esc(v)}">
<datalist id="${listId}">${(f.options || []).map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</datalist>`;
      } else if (f.type === 'textarea') {
        control = `<textarea id="${id}" name="${f.key}" rows="3"${req}>${esc(v)}</textarea>`;
      } else {
        const attrs = [
          f.min !== undefined ? ` min="${f.min}"` : '',
          f.max !== undefined ? ` max="${f.max}"` : '',
          f.step !== undefined ? ` step="${f.step}"` : '',
          f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''
        ].join('');
        control = `<input id="${id}" name="${f.key}" type="${f.type || 'text'}" value="${esc(v)}"${req}${attrs}>`;
      }

      return `
<div class="ui-field${wide}">
  <label for="${id}">${esc(f.label)}${f.required ? ' <span class="ui-req">*</span>' : ''}</label>
  ${control}
  ${f.hint ? `<small>${esc(f.hint)}</small>` : ''}
  <span class="ui-err" data-err></span>
</div>`;
    };

    const back = document.createElement('div');
    back.className = 'ui-backdrop';
    back.innerHTML = `
<div class="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
  <div class="ui-dialog__head">
    <div>
      <h3 id="${titleId}">${esc(opts.title || '')}</h3>
      ${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ''}
    </div>
    <button class="icon-btn" type="button" data-x aria-label="Close">&times;</button>
  </div>
  <form class="ui-form" novalidate>
    <div class="ui-dialog__body">
      ${opts.intro ? `<p class="ui-dialog__intro">${opts.intro}</p>` : ''}
      <div class="ui-grid">${fields.map(fieldHTML).join('')}</div>
    </div>
    <div class="ui-dialog__foot">
      <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
      <button class="btn btn--blue" type="submit">${esc(opts.submitLabel || 'Save')}</button>
    </div>
  </form>
</div>`;

    const form = $('form', back);
    const dialog = $('.ui-dialog', back);

    function close() {
      document.removeEventListener('keydown', onKey);
      back.classList.remove('is-in');
      setTimeout(() => back.remove(), 200);
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
        e.preventDefault(); form.requestSubmit();
      }
    }

    $('[data-x]', back).addEventListener('click', close);
    $('[data-cancel]', back).addEventListener('click', close);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);

    form.addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      fields.forEach(f => {
        const input = form.elements[f.key];
        if (!input) return;
        const err = input.closest('.ui-field').querySelector('[data-err]');
        let msg = '';
        const val = String(input.value).trim();
        if (f.required && !val) msg = 'Required';
        else if (f.type === 'number' && val !== '' && isNaN(Number(val))) msg = 'Must be a number';
        else if (f.type === 'number' && val !== '' && f.min !== undefined && Number(val) < f.min) msg = 'Minimum ' + f.min;
        else if (f.type === 'number' && val !== '' && f.max !== undefined && Number(val) > f.max) msg = 'Maximum ' + f.max;
        else if (f.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) msg = 'Enter a valid email';

        input.closest('.ui-field').classList.toggle('is-bad', !!msg);
        if (err) err.textContent = msg;
        if (msg) ok = false;
      });

      if (!ok) {
        const firstBad = $('.ui-field.is-bad input, .ui-field.is-bad select, .ui-field.is-bad textarea', form);
        if (firstBad) firstBad.focus();
        return;
      }

      const data = {};
      fields.forEach(f => {
        const input = form.elements[f.key];
        if (input) data[f.key] = f.type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value;
      });

      const result = opts.onSubmit(data);
      if (result === false) return;      /* handler said "not yet" */
      close();
    });

    layer.appendChild(back);
    requestAnimationFrame(() => back.classList.add('is-in'));
    const firstField = form.querySelector('input, select, textarea');
    if (firstField) firstField.focus();

    return { close, form, dialog };
  }

  /* ---------------- CSV export ---------------- */
  function toCsv(rows) {
    return rows.map(r => r.map(cell => {
      const s = cell === null || cell === undefined ? '' : String(cell);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  }

  function downloadCsv(filename, rows) {
    const csv = toCsv(rows);
    /* BOM so Excel opens UTF-8 currency correctly */
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Downloaded ' + filename, 'ok');
  }

  return { toast, confirm, modal, downloadCsv, toCsv, esc };
})();
