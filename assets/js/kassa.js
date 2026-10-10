/* =============================================================
   Kassa — point of sale (sotish ekrani).
   Scan-first: mahsulotlar ro'yxati ko'rsatilmaydi.
   Shtrix kod / nom / SKU yoziladi → topilgan mahsulot pastda chiqadi →
   savatga qo'shiladi → SOTISH → chek.
   No sidebar, no tabs — selling only.
   ============================================================= */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9а-яё]+/g, ' ').trim();

  /* money: plain number, space-grouped — the house style */
  const money = (n) => {
    const v = Number(n) || 0;
    const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
    const dot = s.indexOf('.');
    const int = dot < 0 ? s : s.slice(0, dot);
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dot < 0 ? '' : s.slice(dot));
  };
  const n0 = (n) => (Number(n) || 0).toLocaleString('en-GB');
  const shortDT = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const CART_KEY = 'kassa-cart-v1';

  /* local icons — kassa.html does not load app.js, so the I.* set is absent */
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15"/></svg>';

  const state = { receipt: null, lastQuery: '', found: null, candidates: null };

  /* ---------- cart ---------- */
  let cart = new Map();                  /* productId -> qty */
  function saveCart() {
    try { sessionStorage.setItem(CART_KEY, JSON.stringify([...cart])); } catch (e) {}
  }
  function loadCart() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]');
      cart = new Map(raw.filter(([id, q]) => PRODUCTS.some(p => p.id === id) && q > 0));
    } catch (e) { cart = new Map(); }
  }
  const cartTotal = () => [...cart.entries()].reduce((a, [id, q]) => {
    const p = PRODUCTS.find(x => x.id === id);
    return a + (p ? p.price * q : 0);
  }, 0);

  function addToCart(productId, silent) {
    const p = PRODUCTS.find(x => x.id === productId);
    if (!p) return false;
    const rec = backingRecord(p);
    const have = cart.get(productId) || 0;
    if (!rec || rec.qty <= have) { UI.toast('Qoldiq yetarli emas: ' + p.name, 'warn'); return false; }
    cart.set(productId, have + 1);
    saveCart();
    renderCart();
    renderResult();                      /* refresh "savatda N ta" counters */
    return true;
  }

  /* the record a sale draws from: the product's home row, else its first record */
  function backingRecord(p) {
    return STOCK.find(r => r.id === p.id && (LOCATIONS.find(l => l.id === r.locationId) || {}).row === p.row)
        || STOCK.find(r => r.id === p.id);
  }

  function productByCode(code) {
    const c = String(code || '').trim();
    if (!c) return null;
    return PRODUCTS.find(p => p.barcode === c)
        || PRODUCTS.find(p => p.id.toLowerCase() === c.toLowerCase())
        || null;
  }

  /* ---------- scan / search ---------- */
  /* Aniq shtrix kod yoki SKU → darhol savatga (qoldiq bo'lsa) yoki
     karta chiqadi (qoldiq bo'lmasa). Nom yozilsa → mos kelganlar
     ro'yxati chiqadi (Enter bosilganda, ko'pi 8 ta).
     Mahsulotlarning to'liq ro'yxati ko'rsatilmaydi. */
  function fuzzy(q) {
    const nq = norm(q);
    if (!nq) return [];
    const terms = nq.split(' ').filter(Boolean);
    return PRODUCTS.filter(p => {
      const hay = norm(p.name + ' ' + (p.brand || '') + ' ' + p.id + ' ' + (p.barcode || ''));
      return terms.every(t => hay.includes(t));
    }).sort((a, b) => (backingRecord(b)?.qty || 0) - (backingRecord(a)?.qty || 0));
  }

  function resolveScan(raw) {
    const q = String(raw == null ? '' : raw).trim();
    state.lastQuery = q;
    state.found = null;
    state.candidates = null;
    if (!q) { renderResult(); return; }

    const exact = productByCode(q);
    if (exact) {
      const rec = backingRecord(exact);
      const have = cart.get(exact.id) || 0;
      if (rec && rec.qty > have) {
        if (addToCart(exact.id, true)) {
          state.lastQuery = '';
          setScan('');
          flashCartRow(exact.id);
        }
      } else {
        /* qoldiq yo'q — baribir ko'rsatish kerak */
        state.found = exact.id;
      }
      renderResult();
      return;
    }
    const list = fuzzy(q).slice(0, 8);
    state.candidates = list;
    renderResult();
    if (!list.length) UI.toast('Topilmadi: ' + q, 'warn');
  }

  function setScan(v) {
    const inp = $('[data-kas-scan]');
    if (inp) { inp.value = v; inp.focus(); }
  }

  function flashCartRow(id) {
    renderCart();
    const tr = document.querySelector(`[data-kas-row="${id}"]`);
    if (tr) { tr.classList.add('kas-flash'); setTimeout(() => tr.classList.remove('kas-flash'), 900); }
  }

  function foundRowHTML(p) {
    const rec = backingRecord(p);
    const left = rec ? rec.qty : 0;
    const inCart = cart.get(p.id) || 0;
    const canAdd = left > inCart;
    return `
        <div class="kas-found__row" data-kas-hit="${p.id}">
          <span class="kas-found__info">
            <b>${esc(p.name)}</b>
            <span class="t-barcode">${esc(p.barcode || p.id)}</span>
            ${p.brand ? `<span class="kas-found__brand">${esc(p.brand)}</span>` : ''}
          </span>
          <span class="kas-found__price">${money(p.price)}</span>
          <span class="kas-found__stock ${left <= 0 ? 'is-out' : ''}">${left > 0 ? n0(left) + ' ta' : 'qolmagan'}${inCart ? ' · savatda ' + n0(inCart) : ''}</span>
          ${canAdd
            ? `<button class="btn btn--blue btn--mini" type="button" data-kas-pick="${p.id}">Savatga +</button>`
            : `<span class="tag tag--red">Qoldiq yetarli emas</span>`}
        </div>`;
  }

  function renderResult() {
    const host = $('[data-kas-result]');
    if (!host) return;

    if (state.found) {
      const p = PRODUCTS.find(x => x.id === state.found);
      if (p) {
        host.innerHTML = `<div class="kas-found">${foundRowHTML(p)}</div>`;
        return;
      }
      state.found = null;
    }
    if (state.candidates) {
      if (!state.candidates.length) {
        host.innerHTML = `<div class="kas-empty">Topilmadi: <b>${esc(state.lastQuery)}</b> — kodni tekshiring</div>`;
        return;
      }
      host.innerHTML = `<div class="kas-found">${state.candidates.map(foundRowHTML).join('')}</div>`;
      return;
    }
    host.innerHTML = `<div class="kas-empty kas-empty--scan">
           <b>Shtrix kodni skanerlang, SKU yoki nom yozing</b>
           <span>Kod to‘liq mos kelsa, mahsulot darhol savatga tushadi.</span>
         </div>`;
  }

  /* ---------- cart ---------- */
  function renderCart() {
    const host = $('[data-kassa-cart]');
    if (!host) return;
    const rows = [...cart.entries()].map(([id, q]) => {
      const p = PRODUCTS.find(x => x.id === id);
      return p ? { p, q } : null;
    }).filter(Boolean);

    host.innerHTML = rows.length ? `
      <table class="t kas-cart">
        <thead><tr>
          <th>Mahsulot</th>
          <th style="width:120px">Miqdor</th>
          <th style="width:96px;text-align:right">Narx</th>
          <th style="width:100px;text-align:right">Summa</th>
          <th style="width:34px"></th>
        </tr></thead>
        <tbody>
          ${rows.map(({ p, q }) => {
            const rec = backingRecord(p);
            const max = rec ? rec.qty : 0;
            return `
            <tr data-kas-row="${p.id}">
              <td class="t-main__name">${esc(p.name)}<br><span class="t-barcode">${esc(p.barcode || p.id)}</span></td>
              <td>
                <span class="kas-stepper">
                  <button type="button" data-kas-dec="${p.id}" aria-label="Kamaytirish">−</button>
                  <input type="number" min="1" max="${max}" value="${q}" data-kas-qty="${p.id}" aria-label="Miqdor">
                  <button type="button" data-kas-inc="${p.id}" aria-label="Ko‘paytirish">+</button>
                </span>
              </td>
              <td class="num">${money(p.price)}</td>
              <td class="num">${money(p.price * q)}</td>
              <td><button class="icon-btn icon-btn--danger" type="button" data-kas-del="${p.id}" title="Olib tashlash" aria-label="Olib tashlash">${TRASH}</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`
    : `<div class="kas-empty">Savat bo‘sh — shtrix kodni skanerlang</div>`;

    const total = $('[data-kass-total]');
    if (total) total.textContent = money(cartTotal());
    const sellBtn = $('[data-kass-sell]');
    if (sellBtn) sellBtn.disabled = !rows.length;
  }

  /* ---------- receipt (chek) ---------- */
  function receiptHTML(r) {
    const d = r.date;
    const dt = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })
      + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `
<div class="kchk" id="kassa-receipt">
  <div class="kchk__head">
    <b>STOCK MANAGER</b>
    <span>Oddiy sotuv cheki</span>
  </div>
  <div class="kchk__meta">
    <span>Chek: <b>${r.id}</b></span>
    <span>Sana: ${dt}</span>
    <span>Kassiir: <b>${esc(r.user)}</b></span>
  </div>
  <div class="kchk__lines">
    ${r.lines.map(l => `
      <div class="kchk__line">
        <span class="kchk__lname">${esc(l.name)}</span>
        <span class="kchk__lqty">${n0(l.qty)} × ${money(l.price)}</span>
        <span class="kchk__ltotal">${money(l.total)}</span>
      </div>`).join('')}
  </div>
  <div class="kchk__total"><span>JAMI</span><b>${money(r.total)}</b></div>
  <div class="kchk__foot">Xaridingiz uchun rahmat — yana keling!</div>
</div>`;
  }

  function renderReceipt() {
    const host = $('[data-kass-receipt]');
    if (!host) return;
    const r = state.receipt;
    host.innerHTML = r ? receiptHTML(r) : `<div class="kas-empty">Hali sotuv yo‘q — birinchi chek shu yerda bo‘ladi</div>`;
  }

  function renderHistory() {
    const host = $('[data-kass-history]');
    if (!host) return;
    const list = RECEIPTS.slice(0, 10);
    host.innerHTML = list.length ? `
      <table class="t">
        <thead><tr>
          <th>Chek</th>
          <th>Sana</th>
          <th>Kassiir</th>
          <th style="width:80px;text-align:right">Qatorlar</th>
          <th style="width:110px;text-align:right">Jami</th>
          <th style="width:40px"></th>
        </tr></thead>
        <tbody>
          ${list.map(r => `
          <tr class="t-main ${state.receipt && state.receipt.id === r.id ? 'is-open' : ''}" data-kas-view="${r.id}" tabindex="0">
            <td><b>${r.id}</b></td>
            <td style="color:var(--muted);white-space:nowrap">${shortDT(r.date)}</td>
            <td>${esc(r.user)}</td>
            <td class="num">${r.lines.length}</td>
            <td class="num">${money(r.total)}</td>
            ${Auth.isBoss() ? `<td><button class="icon-btn icon-btn--danger" type="button" data-kas-del-receipt="${r.id}" title="Chekni o‘chirish" aria-label="Chekni o‘chirish">${TRASH}</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>`
    : '';
  }

  /* ---------- sale ---------- */
  function checkout() {
    if (!cart.size) return;
    const me = Auth.current();
    const receipt = Store.recordSale(
      [...cart.entries()].map(([productId, qty]) => ({ productId, qty })),
      me ? me.name : '—');
    if (!receipt) {
      /* find the offending product for a useful message */
      for (const [id, q] of cart) {
        const p = PRODUCTS.find(x => x.id === id);
        const rec = p && backingRecord(p);
        if (p && (!rec || rec.qty < q)) {
          UI.toast('Qoldiq yetarli emas: ' + p.name + ' (qoldi ' + (rec ? n0(rec.qty) : '0') + ' ta)', 'err');
          return;
        }
      }
      UI.toast('Sotuv amalga oshmadi', 'err');
      return;
    }
    cart.clear();
    saveCart();
    state.receipt = receipt;
    renderCart();
    renderResult();
    renderReceipt();
    renderHistory();
    UI.toast(receipt.id + ' — ' + money(receipt.total) + ' sotildi', 'ok');
    setScan('');
    const rc = $('[data-kass-receipt]');
    if (rc) rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- events ---------- */
  function wire() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-kas-find]')) {
        resolveScan($('[data-kas-scan]')?.value);
        return;
      }

      const pick = e.target.closest('[data-kas-pick]');
      if (pick) {
        if (addToCart(pick.dataset.kasPick, true)) {
          state.found = null;
          state.candidates = null;
          state.lastQuery = '';
          setScan('');
        }
        return;
      }

      const hit = e.target.closest('[data-kas-hit]');
      if (hit && !e.target.closest('button')) {
        if (addToCart(hit.dataset.kasHit, true)) {
          state.found = null;
          state.candidates = null;
          state.lastQuery = '';
          setScan('');
        }
        return;
      }

      const inc = e.target.closest('[data-kas-inc]');
      if (inc) {
        const id = inc.dataset.kasInc;
        const p = PRODUCTS.find(x => x.id === id);
        const rec = p && backingRecord(p);
        const have = cart.get(id) || 0;
        if (rec && rec.qty > have) { cart.set(id, have + 1); saveCart(); renderCart(); renderResult(); }
        else UI.toast('Qoldiq yetarli emas', 'warn');
        return;
      }

      const dec = e.target.closest('[data-kas-dec]');
      if (dec) {
        const id = dec.dataset.kasDec;
        const have = cart.get(id) || 0;
        if (have <= 1) cart.delete(id); else cart.set(id, have - 1);
        saveCart(); renderCart(); renderResult();
        return;
      }

      const del = e.target.closest('[data-kas-del]');
      if (del) {
        cart.delete(del.dataset.kasDel);
        saveCart(); renderCart(); renderResult();
        return;
      }

      const view = e.target.closest('[data-kas-view]');
      if (view) {
        state.receipt = RECEIPTS.find(r => r.id === view.dataset.kasView) || null;
        renderReceipt(); renderHistory();
        const rc = $('[data-kass-receipt]');
        if (rc && state.receipt) rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      const delR = e.target.closest('[data-kas-del-receipt]');
      if (delR) {
        const r = RECEIPTS.find(x => x.id === delR.dataset.kasDelReceipt);
        if (!r) return;
        UI.confirm({
          title: r.id + ' o‘chirilsinmi?',
          message: 'Chek tarixdan o‘chadi. Sotgan mahsulotlar tizimdan qaytarilmaydi.',
          confirmLabel: 'O‘chirish',
          danger: true
        }).then(ok => {
          if (!ok) return;
          Store.deleteReceipt(r.id);
          if (state.receipt && state.receipt.id === r.id) state.receipt = null;
          renderReceipt(); renderHistory();
          UI.toast(r.id + ' o‘chirildi', 'warn');
        });
        return;
      }

      if (e.target.closest('[data-kass-new]')) {
        state.receipt = null;
        renderReceipt();
        return;
      }
    });

    document.addEventListener('input', e => {
      const qty = e.target.closest('[data-kas-qty]');
      if (qty) {
        const id = qty.dataset.kasQty;
        const p = PRODUCTS.find(x => x.id === id);
        const rec = p && backingRecord(p);
        const max = rec ? rec.qty : 0;
        let v = Math.trunc(Number(qty.value) || 0);
        if (v < 1) v = 1;
        if (v > max) { v = max; UI.toast('Buncha qoldiq yo‘q — maksimum ' + n0(max), 'warn'); }
        cart.set(id, v);
        qty.value = v;
        saveCart(); renderCart(); renderResult();
      }
    });

    document.addEventListener('keydown', e => {
      const scan = e.target.closest('[data-kas-scan]');
      if (scan && e.key === 'Enter') { e.preventDefault(); resolveScan(scan.value); return; }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) {
        e.preventDefault();
        setScan($('[data-kas-scan]')?.value || '');
      }
    });

    const sellBtn = $('[data-kass-sell]');
    if (sellBtn) sellBtn.addEventListener('click', checkout);
  }

  /* ---------- clock ---------- */
  function tick() {
    const el = $('[data-kass-clock]');
    if (el) el.textContent = new Date().toLocaleTimeString('en-GB');
  }

  /* ---------- boot ---------- */
  function renderHeader() {
    const me = Auth.current();
    const who = $('[data-kass-user]');
    if (who) who.textContent = me ? (me.name + (me.role === 'Administrator' ? ' · boss' : me.role === 'Kassa' ? ' · kassa' : ' · ishchi')) : '—';
    const out = $('[data-kas-logout]');
    if (out && !out.dataset.bound) {
      out.dataset.bound = '1';
      out.addEventListener('click', () => Auth.logout());
    }
  }

  renderHeader();
  Store.load();                        /* kassa.html app.js ni yuklamaydi — saqlangan bazani o'zi o'qiydi */
  Store.onChange(() => { renderReceipt(); renderHistory(); });
  loadCart();
  renderResult();
  renderCart();
  renderReceipt();
  renderHistory();
  wire();
  tick();
  setInterval(tick, 1000 * 20);
})();
