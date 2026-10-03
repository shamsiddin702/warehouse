/* =============================================================
   Stock Manager — app logic
   - expandable rows: location is hidden until you click a product
   - animated counters, meters, donut and line charts
   ============================================================= */
(function () {
  'use strict';

  /* ---------------- helpers ---------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CAT  = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

  const n0   = (n) => n.toLocaleString('en-GB');
  /* Prices are kept in so'm (UZS) in the data, but shown as a bare
     number — no currency text on screen. Thousands grouped with spaces:
     1450000 -> "1 450 000", 0.62 -> "0.62" */
  const money = (n) => {
    const v = Number(n) || 0;
    const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
    const dot = s.indexOf('.');
    const int = dot < 0 ? s : s.slice(0, dot);
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dot < 0 ? '' : s.slice(dot));
  };
  const pct   = (a, b) => (b ? (a / b) * 100 : 0);
  const norm  = (s) => String(s).toLowerCase().replace(/[^a-z0-9а-яё]+/g, ' ').trim();
  const shortDate = (d) => d.toLocaleDateString('en-GB', { day:'numeric', month:'numeric', year:'numeric' });
  const daysAgo = (d) => {
    const n = Math.round((TODAY.getTime() - d.getTime()) / 864e5);
    if (n <= 0) return 'today';
    if (n === 1) return 'yesterday';
    if (n < 31) return n + ' days ago';
    if (n < 365) return Math.round(n / 30) + ' months ago';
    return Math.round(n / 365) + 'y ago';
  };
  const longDate  = (d) => d.toLocaleDateString('en-GB', { month:'numeric', day:'numeric', year:'numeric' }) +
                           ', ' + d.toLocaleTimeString('en-GB', { hour:'numeric', minute:'2-digit' });

  const MAX_SHELF = Math.max(...PRODUCTS.map(p => p.shelf));

  const locName = (l) => l ? l.name.replace(/^Row \d+ — /, '') : '—';
  const isLow   = (r) => r.qty <= r.min;
  const isOut   = (r) => r.qty <= 0;

  /* Every page registers a repaint so an edit made anywhere shows up everywhere.
     The wrapper also re-rolls the counters and re-fills the meters, because a
     re-render replaces those elements with fresh ones still showing "0". */
  const repaint = [];
  const onRepaint = (fn) => repaint.push(() => {
    try { fn(); } catch (e) { console.error(e); }
    rollAll(document);
    fillMeters(document);
  });

  /* Units sitting at a location, counting both shelf stock and — for the
     back room — the overflow that records point at as their reserve. */
  function unitsAt(locId) {
    let n = 0;
    for (const r of STOCK) {
      if (r.locationId === locId) n += r.qty;
      else if (r.reserveLocationId === locId) n += r.reserveQty;
    }
    return n;
  }
  /* How many stock records touch this location (shelf records + reserves). */
  function skusAt(locId) {
    let n = 0;
    for (const r of STOCK) {
      if (r.locationId === locId) n++;
      else if (r.reserveLocationId === locId) n++;
    }
    return n;
  }
  function valueAt(locId) {
    let v = 0;
    for (const r of STOCK) {
      if (r.locationId === locId && r.product) v += r.qty * r.product.cost;
      else if (r.reserveLocationId === locId && r.product) v += r.reserveQty * r.product.cost;
    }
    return v;
  }

  const locationOptions = (allLabel) =>
    (allLabel ? `<option value="all">${allLabel}</option>` : '') +
    LOCATIONS.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');

  const stockPill = (r) => isOut(r)
    ? '<span class="pill pill--out">Out of stock</span>'
    : isLow(r)  ? '<span class="pill pill--low">Low stock</span>'
                : '<span class="pill pill--ok">Normal</span>';

  /* ---------------- expiry & velocity ---------------- */
  const DAY = 864e5;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  /** How many days ago this line expired. Negative = still good. */
  function daysToExpiry(pr) {
    if (!pr.expires) return null;
    return Math.round((startOfDay(pr.expires) - startOfDay(TODAY)) / DAY);
  }
  function expiryStatus(pr) {
    const d = daysToExpiry(pr);
    if (d === null) return 'none';        /* ambient, never expires */
    if (d < 0) return 'expired';
    if (d <= 3) return 'soon';
    return 'ok';
  }
  const EXPIRY_LABEL = { expired: 'Expired', soon: 'Expiring soon', ok: 'In date', none: 'No expiry' };

  /** Days of stock left at the current sales rate. */
  const daysOfCover = (pr) => (pr.sold30 > 0 ? (pr.stock / pr.sold30) * 30 : Infinity);

  /** How lazy is this line selling? */
  function velocity(pr) {
    if (pr.sold30 === 0) return 'dead';
    const doc = daysOfCover(pr);
    if (doc > 120) return 'dead';         /* over 4 months of cover */
    if (doc > 60) return 'slow';
    if (doc < 14) return 'fast';
    return 'steady';
  }
  const VELOCITY_LABEL = { dead: 'Not selling', slow: 'Slow', steady: 'Steady', fast: 'Fast' };

  const isExpired = (pr) => expiryStatus(pr) === 'expired';
  const isSlow    = (pr) => velocity(pr) === 'slow';
  const isDead    = (pr) => velocity(pr) === 'dead';
  const expiryPill = (pr) => {
    const s = expiryStatus(pr);
    const d = daysToExpiry(pr);
    const cls = s === 'expired' ? 'pill--out' : s === 'soon' ? 'pill--low' : 'pill--ok';
    const txt = s === 'expired' ? `Expired ${Math.abs(d)}d ago`
              : s === 'soon'    ? (d === 0 ? 'Expires today' : `${d}d left`)
              : s === 'none'    ? 'Ambient'
              : `${d}d left`;
    return `<span class="pill ${cls}">${txt}</span>`;
  };
  const velocityPill = (pr) => {
    const v = velocity(pr);
    const cls = v === 'dead' ? 'pill--out' : v === 'slow' ? 'pill--low' : 'pill--ok';
    return `<span class="pill ${cls}">${VELOCITY_LABEL[v]}</span>`;
  };

  /* ---------------- icons ---------------- */
  const I = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    warehouse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-5 9 5v12"/><path d="M8 21v-7h8v7"/><path d="M3 21h18"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l8 4.2v9.9l-8 4.3-8-4.3V7z"/><path d="M4 7.1l8 4.2 8-4.2M12 11.3V21"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17.5l9 5 9-5"/></svg>',
    transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5L2.8 19.5h18.4z"/><path d="M12 9.5v4M12 16.6v.2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.8" y="5" width="18.4" height="14" rx="2"/><path d="M3 6.5l9 6 9-6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h4l2 5-2.5 1.5a12 12 0 0 0 5.5 5.5L15.5 13l5 2v4a1.5 1.5 0 0 1-1.7 1.5C10.6 19.6 4.4 13.4 3.5 5.2A1.5 1.5 0 0 1 5 3.5z"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 6.5h10.4v10H2.8z"/><path d="M13.2 10h3.6l3.4 3.2v3.3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    merge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M6 8.4v7.2M8.2 7c3.8 1.3 6.2 3 7.4 4M8.2 17c3.8-1.3 6.2-3 7.4-4"/></svg>'
  };

  /* ---------------- animated number roll ---------------- */
  function rollTo(el) {
    if (el.dataset.rolled) return;
    el.dataset.rolled = '1';
    const target = parseFloat(el.dataset.value);
    if (!isFinite(target)) { el.textContent = el.dataset.value; return; }
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const group  = el.dataset.group !== 'false';   /* thousands separators on by default */
    const dp     = el.dataset.dp !== undefined ? Number(el.dataset.dp) : (String(target).includes('.') ? 2 : 0);
    const dur    = 900;
    const t0     = performance.now();
    const show   = (v) => {
      const fixed = v.toFixed(dp);
      const body = group
        ? Number(fixed).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
        : fixed;
      return prefix + body + suffix;
    };

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = show(target); return; }

    let done = false;
    const finish = () => { if (!done) { done = true; el.textContent = show(target); } };

    /* rAF is paused in background tabs, so guarantee the final value arrives
       even if the animation never gets a frame */
    setTimeout(finish, dur + 150);

    (function step(now) {
      if (done) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = show(target * e);
      if (t < 1) requestAnimationFrame(step);
      else finish();
    })(t0);
  }
  const rollAll = (root) => $$('[data-value]', root || document).forEach(rollTo);

  /* fill every .meter__fill from its data-to attribute
     replay=true resets to zero first so the transition always plays
     (needed for bars inside a hidden tabpanel, which have no box to animate) */
  function fillMeters(root, replay) {
    $$('.meter__fill', root || document).forEach(el => {
      const to = Math.max(0, Math.min(100, parseFloat(el.dataset.to || '0')));
      if (replay) { el.style.width = '0%'; }
      void el.offsetWidth;                       /* force reflow */
      el.style.width = to + '%';
    });
  }

  /* ---------------- location detail (shown only when a row is clicked) ---- */
  function locationDetail(rec) {
    const pr  = rec.product;
    const main = rec.location;
    const d   = CAT[pr.cat] || {};
    const res = rec.reserveLocation
      ? `<div class="detail__cell">
           <span>Also in</span>
           <b>${esc(rec.reserveLocation.name)}</b>
           <span style="text-transform:none;letter-spacing:0;color:var(--muted)">${n0(rec.reserveQty)} units back stock</span>
         </div>`
      : '';

    const shelfMap = Array.from({ length: MAX_SHELF }, (_, i) => {
      const s = i + 1;
      const on = s === pr.shelf;
      return `<div class="shelfmap__s" data-on="${on}">S${s}${on ? '<small>' + n0(rec.qty) + ' units</small>' : ''}</div>`;
    }).join('');

    const fill = Math.round(pct(rec.qty, pr.cap));

    return `
<div class="detail">
  <div class="detail__head">
    <h4>Where this product is</h4>
    <span class="tag tag--blue">${esc(d.name || '')}</span>
    ${isLow(rec) ? '<span class="pill pill--low">' + (isOut(rec) ? 'Out of stock' : 'Low stock') + '</span>' : ''}
  </div>

  <div class="detail__body" style="display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;padding:1rem">
    <div class="locplate">
      <div class="locplate__box locplate__box--row">
        <small>Row</small><b>${main.row}</b>
      </div>
      <div class="locplate__box locplate__box--shelf">
        <small>Shelf</small><b>${pr.shelf}</b>
      </div>
      <div class="locplate__info">
        <b>${esc(main.name)}</b>
        <p>${esc(main.zone)} &middot; ${esc(locName(main))}</p>
      </div>
    </div>

    <div>
      <span style="display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.4rem">Shelf map for row ${main.row}</span>
      <div class="shelfmap">${shelfMap}</div>
    </div>

    <div class="detail__grid" style="padding:0">
      <div class="detail__cell"><span>On shelf</span><b>${n0(rec.qty)} units</b></div>
      <div class="detail__cell"><span>Shelf capacity</span><b>${n0(pr.cap)} units</b></div>
      <div class="detail__cell ${isLow(rec) ? 'detail__cell--bad' : ''}"><span>Minimum level</span><b>${n0(rec.min)} units</b></div>
      <div class="detail__cell"><span>Reorder quantity</span><b>${n0(rec.reorder)} units</b></div>
      <div class="detail__cell"><span>Supplier</span><b>${esc(SUPPLIERS[pr.sup] || pr.sup)}</b></div>
      <div class="detail__cell"><span>Last restock</span><b>${shortDate(rec.lastRestock)}</b></div>
      <div class="detail__cell"><span>Cost / shelf price</span><b>${money(pr.cost)} &middot; ${money(pr.price)}</b></div>
      <div class="detail__cell"><span>Margin</span><b>${Math.round(((pr.price - pr.cost) / pr.price) * 100)}%</b></div>
      ${pr.sd ? `<div class="detail__cell"><span>Shelf life</span><b>${pr.sd} days</b></div>` : ''}
      ${res}
    </div>

    ${isLow(rec) ? `
    <div class="note">
      ${I.warn}
      <span><b>${esc(pr.name)}</b> is at ${n0(rec.qty)} units against a minimum of ${n0(rec.min)}.
      Reorder ${n0(rec.reorder)} units from ${esc(SUPPLIERS[pr.sup] || pr.sup)}.</span>
    </div>` : `
    <div class="note note--info">
      ${I.pin}
      <span>${esc(pr.name)} is stocked in <b>row ${main.row}, shelf ${pr.shelf}</b>
      (${esc(locName(main))})${rec.reserveLocation ? `, with <b>${n0(rec.reserveQty)}</b> more in the back room` : ''}.</span>
    </div>`}
  </div>
</div>`;
  }

  /* wire up click-to-expand for any table with [data-expand] */
  function wireExpand(scope) {
    $$('[data-expand]', scope || document).forEach(tr => {
      if (tr.dataset.wired) return;
      tr.dataset.wired = '1';
      tr.tabIndex = 0;
      tr.setAttribute('aria-expanded', 'false');

      const toggle = () => {
        const open = tr.classList.toggle('is-open');
        tr.setAttribute('aria-expanded', open ? 'true' : 'false');
        const det = tr.nextElementSibling;
        if (det && det.classList.contains('detail')) {
          det.hidden = !open;
          if (open) {
            /* restart the entrance animation each time */
            const inner = det.firstElementChild;
            inner.style.animation = 'none';
            void inner.offsetWidth;
            inner.style.animation = '';
          }
        }
      };

      tr.addEventListener('click', e => {
        if (e.target.closest('.actions') || e.target.closest('button') || e.target.closest('a')) return;
        toggle();
      });
      tr.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  /* =====================================================================
     DASHBOARD
     ===================================================================== */
  function initDashboard() {
    const host = $('[data-dash]');
    if (!host) return;

    const statHTML = (label, value, sub, icon, tone) => `
<div class="card stat">
  <div class="stat__top">
    <span class="stat__label">${label}</span>
    <span class="stat__icon ${tone ? 'stat__icon--' + tone : ''}">${icon}</span>
  </div>
  <div class="stat__value" ${typeof value === 'number' ? `data-value="${value}"` : ''}>${typeof value === 'number' ? '0' : value}</div>
  <div class="stat__sub">${sub}</div>
</div>`;

    function render() {
      const lowRecs = STOCK.filter(isLow);
      const units   = STOCK.reduce((a, r) => a + r.qty, 0);

      $('[data-kpis]').innerHTML = [
        statHTML('Total Warehouses', LOCATIONS.length, 'Active locations', I.warehouse, 'blue'),
        statHTML('Total Products',   PRODUCTS.length, 'In catalog',       I.box, 'blue'),
        statHTML('Total Stock',      units,          'Units across all locations', I.trend),
        statHTML('Low Stock Alerts', lowRecs.length, 'Require attention', I.warn, lowRecs.length ? 'amber' : '')
      ].join('');

      /* low stock alerts */
      $('[data-alerts]').innerHTML = lowRecs.length
        ? lowRecs.map(r => `
<div class="note" style="align-items:center">
  ${I.warn}
  <div style="flex:1;min-width:0">
    <div style="font-weight:600">${esc(r.product.name)} at ${esc(locName(r.location))}</div>
    <div style="font-size:.84rem;color:#92400e">
      Current: <b>${n0(r.qty)}</b> units &nbsp;|&nbsp; Minimum: <b>${n0(r.min)}</b> units &nbsp;|&nbsp; Reorder: <b>${n0(r.reorder)}</b> units
    </div>
  </div>
  <span class="pill pill--low" style="flex:none">${isOut(r) ? 'Out of stock' : 'Low stock'}</span>
</div>`).join('')
        : '<div class="empty"><b>Nothing low</b><p>Every line is above its minimum level.</p></div>';

      /* warehouse (row) utilization */
      $('[data-util]').innerHTML = LOCATIONS.filter(l => !l.reserve).map(l => {
        const qty = unitsAt(l.id);
        const p   = pct(qty, l.capacity);
        return `
<div class="meter">
  <div class="meter__row">
    <span class="name">${esc(l.name)}</span>
    <span class="val">${n0(qty)} / ${n0(l.capacity)} &nbsp;(${p.toFixed(1)}%)</span>
  </div>
  <div class="meter__fill" data-to="${p.toFixed(2)}"></div>
</div>`;
      }).join('');

      /* recent activity */
      $('[data-activity]').innerHTML = ACTIVITY.map(a => `
<div class="line-item">
  <span class="line-item__ic">${I[a.icon] || I.box}</span>
  <div style="min-width:0">
    <div class="line-item__t">${esc(a.title)}</div>
    <div class="line-item__m">${esc(a.sub)}<br>${longDate(a.at)}</div>
  </div>
  <span class="line-item__r">${a.delta > 0 ? '+' : ''}${a.delta}</span>
</div>`).join('');

      fillMeters(host, true);
    }

    onRepaint(render);
    render();
  }

  /* =====================================================================
     LOCATIONS (the "Warehouses" page)
     ===================================================================== */
  function initLocations() {
    const host = $('[data-locations]');
    if (!host) return;

    function render() {
    host.innerHTML = LOCATIONS.map(l => {
      const qty  = unitsAt(l.id);
      const skus = skusAt(l.id);
      const val  = valueAt(l.id);
      const u    = pct(qty, l.capacity);
      const lowN = STOCK.filter(r => r.locationId === l.id && isLow(r)).length;

      return `
<article class="card" style="padding:1.1rem 1.25rem">
  <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.9rem">
    <h3 style="font-size:1rem">${esc(l.name)}</h3>
    <span style="margin-left:auto;display:flex;gap:.2rem">
      <button class="icon-btn" type="button" data-action="edit-location" data-id="${l.id}" title="Edit ${esc(l.name)}" aria-label="Edit ${esc(l.name)}">${I.edit}</button>
      <button class="icon-btn icon-btn--danger" type="button" data-action="delete-location" data-id="${l.id}" title="Delete ${esc(l.name)}" aria-label="Delete ${esc(l.name)}">${I.trash}</button>
    </span>
  </div>

  <div class="wcard__contact">
    <div>${I.pin}<span>${esc(l.zone)}</span></div>
    <div>${I.mail}<span>${esc(l.email)}</span></div>
    <div>${I.phone}<span>${esc(l.phone)}</span></div>
  </div>

  <div style="border-top:1px solid var(--line);padding-top:.9rem">
    <div class="kv"><span class="kv__k">Contact Person</span><span class="kv__v">${esc(l.contact)}</span></div>
    <div class="kv"><span class="kv__k">Stock Items</span><span class="kv__v">${n0(skus)}</span></div>
    <div class="kv"><span class="kv__k">Units on Shelf</span><span class="kv__v">${n0(qty)}</span></div>
    <div class="kv"><span class="kv__k">Stock Value</span><span class="kv__v">${money(val)}</span></div>
    <div class="kv"><span class="kv__k">Capacity</span><span class="kv__v">${n0(l.capacity)}</span></div>
    <div class="kv" style="margin-top:.8rem"><span class="kv__k">Utilization</span><span class="kv__v">${u.toFixed(1)}%</span></div>
  </div>

  <div class="meter" style="margin-top:.5rem"><div class="meter__fill" data-to="${u.toFixed(2)}"></div></div>

  <div style="display:flex;gap:.4rem;margin-top:1rem;flex-wrap:wrap">
    <span class="tag">${skus} SKUs</span>
    ${l.reserve ? '<span class="tag tag--blue">Overflow stock</span>'
                : `<span class="tag">Shelves 1&ndash;${MAX_SHELF}</span>`}
    ${lowN ? `<span class="tag tag--amber">${lowN} low</span>` : ''}
    <span class="tag">Created ${l.created}</span>
  </div>
</article>`;
    }).join('');

    fillMeters(host, true);
    }

    onRepaint(render);
    render();
  }

  /* =====================================================================
     PRODUCTS  (click a row to reveal its location)
     ===================================================================== */
  function initProducts() {
    const host = $('[data-products]');
    if (!host) return;

    /* one filter per column */
    const state = {
      product: '', sku: '', desc: '', cat: 'all', brand: 'all',
      stockMin: '', stockMax: '', locMin: '', locMax: '',
      stockStatus: 'all', row: 'all', shelf: 'all'
    };

    const panel   = $('[data-filter-panel]');
    const toggle  = $('[data-filter-toggle]');
    const badge   = $('[data-filter-count]');
    const summary = $('[data-filter-summary]');

    const fields = {};
    $$('[data-f]', panel).forEach(el => { fields[el.dataset.f] = el; });

    const locCount = (r) => 1 + (r.reserveLocationId ? 1 : 0);
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const inRange = (v, lo, hi) => {
      const a = num(lo), b = num(hi);
      if (a !== null && v < a) return false;
      if (b !== null && v > b) return false;
      return true;
    };

    function list() {
      let out = STOCK.slice();

      /* Product name — also covers SKU and brand, which is the quickest way in */
      const q = norm(state.product);
      if (q) {
        const terms = q.split(' ').filter(Boolean);
        out = out.filter(r => {
          const pr = r.product;
          const hay = norm(pr.name + ' ' + pr.brand + ' ' + pr.id + ' ' + pr.desc + ' ' +
                          (CAT[pr.cat] || {}).name + ' ' + (SUPPLIERS[pr.sup] || ''));
          return terms.every(t => hay.includes(t));
        }).sort((a, b) => {
          const qa = norm(a.product.name).startsWith(q) ? 1 : 0;
          const qb = norm(b.product.name).startsWith(q) ? 1 : 0;
          return qb - qa || a.product.name.localeCompare(b.product.name);
        });
      }

      /* SKU — accepts the full code or just the digits */
      const sq = norm(state.sku).replace(/\s+/g, '');
      if (sq) {
        out = out.filter(r => {
          const id = norm(r.product.id).replace(/\s+/g, '');
          return id === sq || id.indexOf(sq) > -1;
        });
      }

      /* Description */
      const dq = norm(state.desc);
      if (dq) {
        const terms = dq.split(' ').filter(Boolean);
        out = out.filter(r => terms.every(t => norm(r.product.desc).includes(t)));
      }

      if (state.cat   !== 'all') out = out.filter(r => r.product.cat === state.cat);
      if (state.brand !== 'all') out = out.filter(r => r.product.brand === state.brand);

      /* Total stock and locations held, both min–max */
      if (state.stockMin !== '' || state.stockMax !== '')
        out = out.filter(r => inRange(r.qty, state.stockMin, state.stockMax));
      if (state.locMin !== '' || state.locMax !== '')
        out = out.filter(r => inRange(locCount(r), state.locMin, state.locMax));

      /* Stock status */
      if (state.stockStatus === 'low') out = out.filter(r => isLow(r) && r.qty > 0);
      if (state.stockStatus === 'out') out = out.filter(isOut);
      if (state.stockStatus === 'ok')  out = out.filter(r => !isLow(r));

      /* Physical position */
      if (state.row   !== 'all') out = out.filter(r => String(r.product.row) === state.row);
      if (state.shelf !== 'all') out = out.filter(r => String(r.product.shelf) === state.shelf);

      return out;
    }

    const STATUS_TEXT = { ok: 'In stock', low: 'Low stock', out: 'Out of stock' };

    function activeFilters() {
      const out = [];
      if (state.product) out.push({ k: 'product', t: 'Name/SKU: ' + state.product });
      if (state.sku)     out.push({ k: 'sku', t: 'SKU: ' + state.sku });
      if (state.desc)    out.push({ k: 'desc', t: 'Description: ' + state.desc });
      if (state.cat !== 'all')   out.push({ k: 'cat', t: 'Category: ' + ((CAT[state.cat] || {}).name || state.cat) });
      if (state.brand !== 'all') out.push({ k: 'brand', t: 'Brand: ' + state.brand });
      if (state.stockMin !== '' || state.stockMax !== '')
        out.push({ k: 'stockMin', k2: 'stockMax', t: 'Stock ' + (state.stockMin || '0') + '–' + (state.stockMax || '∞') });
      if (state.locMin !== '' || state.locMax !== '')
        out.push({ k: 'locMin', k2: 'locMax', t: 'Locations ' + (state.locMin || '0') + '–' + (state.locMax || '∞') });
      if (state.stockStatus !== 'all') out.push({ k: 'stockStatus', t: 'Status: ' + STATUS_TEXT[state.stockStatus] });
      if (state.row !== 'all')   out.push({ k: 'row', t: 'Row ' + state.row });
      if (state.shelf !== 'all') out.push({ k: 'shelf', t: 'Shelf ' + state.shelf });
      return out;
    }

    function paintSummary() {
      const list_ = activeFilters();
      if (badge) { badge.textContent = list_.length; badge.hidden = list_.length === 0; }
      if (!summary) return;
      summary.innerHTML = list_.length
        ? list_.map(f => `<span class="tag tag--blue">${esc(f.t)}<button type="button"
             data-clear="${f.k}" data-clear2="${f.k2 || ''}" aria-label="Remove filter">&times;</button></span>`).join('')
        : '<span class="none">No filters applied &mdash; showing the whole catalogue</span>';
    }

    function render() {
      const rows = list();
      host.innerHTML = rows.length ? `
<div class="card card--flush">
  <div class="tablewrap">
    <table class="t t--fit">
      <thead>
        <tr>
          <th style="width:34px"></th>
          <th>Product Name</th>
          <th style="width:100px">SKU</th>
          <th style="width:120px">Category</th>
          <th>Description</th>
          <th style="width:78px;text-align:right">Total Stock</th>
          <th style="width:78px;text-align:right">Locations</th>
          <th class="actions" style="width:106px">Actions</th>
        </tr>
      </thead>
      <tbody>
      ${rows.map(r => {
        const pr = r.product;
        const c  = CAT[pr.cat] || {};
        const locCount = 1 + (r.reserveLocation ? 1 : 0);
        return `
<tr class="t-main ${isLow(r) ? 'is-low' : ''}" data-expand tabindex="0"
    aria-label="${esc(pr.name)} — show location">
  <td><span class="chev">${I.chev}</span></td>
  <td class="t-main__name">${esc(pr.name)}<br><span class="t-main__sku">${esc(pr.brand)}</span></td>
  <td><span class="tag tag--sku">${pr.id}</span></td>
  <td><span class="tag tag--cat" style="background:hsl(${c.hue} 85% 96%);color:hsl(${c.hue} 55% 32%)">${esc(c.name || '')}</span></td>
  <td style="color:var(--muted);max-width:280px">${esc(pr.desc)}</td>
  <td class="num">${n0(r.qty)}</td>
  <td class="num">${locCount}</td>
  <td class="actions">
    <button class="icon-btn" type="button" data-action="copy-product" data-id="${pr.id}" title="Duplicate ${esc(pr.name)}" aria-label="Duplicate ${esc(pr.name)}">${I.copy}</button>
    <button class="icon-btn" type="button" data-action="edit-product" data-id="${pr.id}" title="Edit ${esc(pr.name)}" aria-label="Edit ${esc(pr.name)}">${I.edit}</button>
    <button class="icon-btn icon-btn--danger" type="button" data-action="delete-product" data-id="${pr.id}" title="Delete ${esc(pr.name)}" aria-label="Delete ${esc(pr.name)}">${I.trash}</button>
  </td>
</tr>
<tr class="detail" hidden><td colspan="8">${locationDetail(r)}</td></tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>
  <div class="pager">
    <span>Showing <b>${rows.length}</b> of ${STOCK.length} catalogue lines</span>
  </div>
</div>` : `<div class="card"><div class="empty"><b>No products match</b><p>Every active filter is listed above the table &mdash; remove one, or use <b>Clear all filters</b>.</p></div></div>`;

      paintSummary();
      wireExpand(host);
    }

    /* ---- populate the select options ---- */
    if (fields.cat) {
      fields.cat.innerHTML = '<option value="all">All categories</option>' +
        CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    }
    if (fields.brand) {
      const brands = [...new Set(PRODUCTS.map(p => p.brand).filter(Boolean))].sort();
      fields.brand.innerHTML = '<option value="all">All brands</option>' +
        brands.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    }
    if (fields.row) {
      const rows_ = [...new Set(PRODUCTS.map(p => p.row))].sort((a, b) => a - b);
      fields.row.innerHTML = '<option value="all">Any row</option>' +
        rows_.map(r => `<option value="${r}">Row ${r}</option>`).join('');
    }
    if (fields.shelf) {
      const shelves = [...new Set(PRODUCTS.map(p => p.shelf))].sort((a, b) => a - b);
      fields.shelf.innerHTML = '<option value="all">Any shelf</option>' +
        shelves.map(s => `<option value="${s}">Shelf ${s}</option>`).join('');
    }

    /* ---- every control writes straight into state ---- */
    $$('[data-f]', panel).forEach(el => {
      const key = el.dataset.f;
      const ev  = el.type === 'search' ? 'input' : 'change';
      el.addEventListener(ev, () => { state[key] = el.value; render(); });
    });

    /* ---- open / close the panel ---- */
    toggle?.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && fields.product) fields.product.focus();
    });

    /* ---- clear one chip, or everything ---- */
    summary?.addEventListener('click', e => {
      const b = e.target.closest('[data-clear]');
      if (!b) return;
      [b.dataset.clear, b.dataset.clear2].filter(Boolean).forEach(k => {
        state[k] = (k === 'cat' || k === 'brand' || k === 'row' || k === 'shelf' || k === 'stockStatus') ? 'all' : '';
        if (fields[k]) fields[k].value = state[k];
      });
      render();
    });

    $('[data-filter-clear]')?.addEventListener('click', () => {
      Object.keys(state).forEach(k => {
        state[k] = (k === 'cat' || k === 'brand' || k === 'row' || k === 'shelf' || k === 'stockStatus') ? 'all' : '';
      });
      Object.keys(fields).forEach(k => { if (fields[k]) fields[k].value = state[k]; });
      render();
    });

    /* "/" opens the panel and focuses the product box */
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && fields.product) {
        e.preventDefault();
        if (panel.hidden) { panel.hidden = false; toggle?.setAttribute('aria-expanded', 'true'); }
        fields.product.focus();
        fields.product.select();
      }
    });

    onRepaint(render);
    render();
  }

  /* =====================================================================
     STOCK MANAGEMENT  (click a row to reveal its location)
     ===================================================================== */
  function initStock() {
    const host = $('[data-stock]');
    if (!host) return;

    /* one filter per table column */
    const state = {
      product: '', location: 'all',
      qtyMin: '', qtyMax: '', minMin: '', minMax: '',
      reorderMin: '', reorderMax: '',
      status: 'all', date: 'all', from: '', to: ''
    };

    const panel    = $('[data-filter-panel]');
    const toggle   = $('[data-filter-toggle]');
    const badge    = $('[data-filter-count]');
    const summary  = $('[data-filter-summary]');
    const rangeBox = $('[data-daterange]');
    const tabLow   = $('[data-tab-low]');
    const tabOut   = $('[data-tab-out]');
    const tabAll   = $('[data-tab-all]');

    const fields = {};
    $$('[data-f]', panel || document).forEach(el => { fields[el.dataset.f] = el; });

    let page = 1;
    const PER = 12;

    /* --- date filter, anchored to the demo's "today" so presets make sense --- */
    const ANCHOR = TODAY.getTime();
    let fromMs = null, toMs = null;

    function applyDates() {
      fromMs = toMs = null;
      if (state.date === 'custom') {
        if (state.from) fromMs = new Date(state.from + 'T00:00:00').getTime();
        if (state.to)   toMs   = new Date(state.to + 'T23:59:59').getTime();
      } else {
        const days = { d7: 7, d30: 30, d90: 90, old90: 90 }[state.date];
        if (days) {
          toMs = ANCHOR;
          fromMs = ANCHOR - days * 864e5;
          if (state.date === 'old90') fromMs = 0;
        }
      }
      if (rangeBox) rangeBox.hidden = state.date !== 'custom';
    }

    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const inRange = (v, lo, hi) => {
      const a = num(lo), b = num(hi);
      if (a !== null && v < a) return false;
      if (b !== null && v > b) return false;
      return true;
    };

    function list() {
      let out = STOCK.slice();

      /* Product — free text over name, brand, SKU, supplier and location */
      const q = norm(state.product);
      if (q) {
        const terms = q.split(' ').filter(Boolean);
        out = out.filter(r => {
          const pr = r.product;
          const hay = norm(pr.name + ' ' + pr.brand + ' ' + pr.id + ' ' +
                          (SUPPLIERS[pr.sup] || '') + ' ' + locName(r.location));
          return terms.every(t => hay.includes(t));
        });
      }

      if (state.location !== 'all') out = out.filter(r => r.locationId === state.location);

      /* Quantity / Min threshold / Reorder qty — numeric ranges */
      if (state.qtyMin !== '' || state.qtyMax !== '')      out = out.filter(r => inRange(r.qty, state.qtyMin, state.qtyMax));
      if (state.minMin !== '' || state.minMax !== '')      out = out.filter(r => inRange(r.min, state.minMin, state.minMax));
      if (state.reorderMin !== '' || state.reorderMax !== '') out = out.filter(r => inRange(r.reorder, state.reorderMin, state.reorderMax));

      /* Status */
      if (state.status === 'low') out = out.filter(r => isLow(r) && r.qty > 0);
      if (state.status === 'out') out = out.filter(isOut);
      if (state.status === 'ok')  out = out.filter(r => !isLow(r));

      /* Last restock date */
      if (fromMs !== null || toMs !== null) {
        out = out.filter(r => {
          const t = r.lastRestock.getTime();
          if (fromMs !== null && t < fromMs) return false;
          if (toMs   !== null && t > toMs)   return false;
          return true;
        });
      }

      return out.sort((a, b) => a.location.row - b.location.row ||
                                a.product.shelf - b.product.shelf ||
                                a.product.name.localeCompare(b.product.name));
    }

    /* --- the removable summary chips --- */
    const STATUS_TEXT = { ok: 'Normal', low: 'Low stock', out: 'Out of stock' };
    const DATE_TEXT   = { d7: 'Restocked last 7 days', d30: 'Restocked last 30 days',
                           d90: 'Restocked last 90 days', old90: 'No delivery in 90+ days',
                           custom: 'Custom date range' };

    function activeFilters() {
      const out = [];
      if (state.product)  out.push({ k: 'product',  t: 'Product: ' + state.product });
      if (state.location !== 'all') out.push({ k: 'location', t: 'Location: ' + locName(Store.locationById(state.location)) });
      if (state.qtyMin !== '' || state.qtyMax !== '')
        out.push({ k: 'qtyMin', k2: 'qtyMax', t: 'Qty ' + (state.qtyMin || '0') + '–' + (state.qtyMax || '∞') });
      if (state.minMin !== '' || state.minMax !== '')
        out.push({ k: 'minMin', k2: 'minMax', t: 'Min ' + (state.minMin || '0') + '–' + (state.minMax || '∞') });
      if (state.reorderMin !== '' || state.reorderMax !== '')
        out.push({ k: 'reorderMin', k2: 'reorderMax', t: 'Reorder ' + (state.reorderMin || '0') + '–' + (state.reorderMax || '∞') });
      if (state.status !== 'all') out.push({ k: 'status', t: 'Status: ' + STATUS_TEXT[state.status] });
      if (state.date !== 'all') {
        const label = state.date === 'custom'
          ? 'Restocked ' + (state.from || '…') + ' → ' + (state.to || '…')
          : DATE_TEXT[state.date];
        out.push({ k: 'date', k2: 'from', k3: 'to', t: label });
      }
      return out;
    }

    function paintSummary() {
      const list = activeFilters();
      if (badge) { badge.textContent = list.length; badge.hidden = list.length === 0; }
      if (!summary) return;
      summary.innerHTML = list.length
        ? list.map(f => `<span class="tag tag--blue">${esc(f.t)}<button type="button" data-clear="${f.k}"
             data-clear2="${f.k2 || ''}" data-clear3="${f.k3 || ''}" aria-label="Remove filter">&times;</button></span>`).join('')
        : '<span class="none">No filters applied &mdash; showing everything</span>';
    }

    function render() {
      const rows = list();
      const pages = Math.max(1, Math.ceil(rows.length / PER));
      if (page > pages) page = pages;
      const slice = rows.slice((page - 1) * PER, page * PER);

      /* chip labels */
      if (tabAll) tabAll.innerHTML = `All Stock (${STOCK.length})`;
      if (tabLow) tabLow.innerHTML = `${I.warn} Low Stock (${STOCK.filter(r => isLow(r) && r.qty > 0).length})`;
      if (tabOut) tabOut.innerHTML = `${I.warn} Out of Stock (${STOCK.filter(isOut).length})`;

      host.innerHTML = slice.length ? `
<div class="card card--flush">
  <div class="tablewrap">
    <table class="t">
      <thead>
        <tr>
          <th style="width:34px"></th>
          <th>Product</th>
          <th>Location</th>
          <th style="text-align:right">Quantity</th>
          <th style="text-align:right">Min Threshold</th>
          <th style="text-align:right">Reorder Qty</th>
          <th>Status</th>
          <th>Last Restock</th>
          <th class="actions">Actions</th>
        </tr>
      </thead>
      <tbody>
      ${slice.map(r => `
<tr class="t-main ${isLow(r) ? 'is-low' : ''}" data-expand tabindex="0"
    aria-label="${esc(r.product.name)} at ${esc(locName(r.location))} — show full location">
  <td><span class="chev">${I.chev}</span></td>
  <td><span class="t-main__name">${esc(r.product.name)}</span><br><span class="t-main__sku">${r.product.id}</span></td>
  <td>${esc(locName(r.location))}${r.reserveLocation ? ` <span class="tag tag--grey" style="background:var(--line-2)">+1</span>` : ''}</td>
  <td class="num" style="${isLow(r) ? 'color:var(--amber);font-weight:600' : ''}">${n0(r.qty)}</td>
  <td class="num">${n0(r.min)}</td>
  <td class="num">${n0(r.reorder)}</td>
  <td>${stockPill(r)}</td>
  <td style="color:var(--muted);white-space:nowrap">${shortDate(r.lastRestock)}<br><span style="font-size:.72rem">${daysAgo(r.lastRestock)}</span></td>
  <td class="actions">
    <button class="icon-btn" type="button" data-action="restock" data-id="${r.id}" title="Record a delivery" aria-label="Record a delivery for ${esc(r.product.name)}">${I.copy}</button>
    <button class="icon-btn" type="button" data-action="copy-record" data-id="${r.id}" title="Copy to another location" aria-label="Copy ${esc(r.product.name)} to another location">${I.layers}</button>
    ${STOCK.some(x => x.id === r.id && x.locationId !== r.locationId) ? `
    <button class="icon-btn" type="button" data-action="merge-record" data-id="${r.id}" data-loc="${r.locationId}" title="Birlashtirish — bu yozuvni boshqa joydagisiga qo'shish" aria-label="Merge ${esc(r.product.name)} into its other location">${I.merge}</button>` : ''}
    <button class="icon-btn" type="button" data-action="edit-record" data-id="${r.id}" title="Edit" aria-label="Edit stock for ${esc(r.product.name)}">${I.edit}</button>
    <button class="icon-btn icon-btn--danger" type="button" data-action="delete-record" data-id="${r.id}" title="Delete" aria-label="Delete stock for ${esc(r.product.name)}">${I.trash}</button>
  </td>
</tr>
<tr class="detail" hidden><td colspan="10">${locationDetail(r)}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="pager">
    <span>Page <b>${page}</b> of <b>${pages}</b> &middot; ${rows.length} of ${STOCK.length} records</span>
    <span class="right">
      <button type="button" data-page="prev" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">&#8249;</button>
      <button type="button" data-page="next" ${page === pages ? 'disabled' : ''} aria-label="Next page">&#8250;</button>
    </span>
  </div>
</div>` : `<div class="card"><div class="empty"><b>No stock records match</b><p>Every active filter is listed above the table &mdash; remove one, or use <b>Clear all filters</b>.</p></div></div>`;

      paintSummary();
      wireExpand(host);

      $$('[data-page]', host).forEach(b => b.addEventListener('click', () => {
        page += b.dataset.page === 'next' ? 1 : -1;
        render();
        host.scrollIntoView({ block: 'nearest' });
      }));
    }

    /* ---- populate the select options ---- */
    if (fields.location) {
      fields.location.innerHTML = locationOptions('All locations');
    }

    /* ---- every control writes straight into state ---- */
    let t;
    $$('[data-f]', panel).forEach(el => {
      const key = el.dataset.f;
      const ev  = el.type === 'search' ? 'input' : 'change';
      el.addEventListener(ev, () => {
        state[key] = el.value;
        if (key === 'date') {
          if (state.date !== 'custom') { state.from = ''; state.to = ''; if (fields.from) fields.from.value = ''; if (fields.to) fields.to.value = ''; }
          else if (fields.from) fields.from.focus();
        }
        if (key === 'from' || key === 'to') { state.date = 'custom'; if (fields.date) fields.date.value = 'custom'; }
        if (key === 'status') syncChips();
        page = 1;
        applyDates();
        render();
      });
    });

    /* ---- status chips are a shortcut for the same filter ---- */
    function syncChips() {
      const map = { all: tabAll, low: tabLow, out: tabOut };
      Object.keys(map).forEach(k => {
        if (map[k]) map[k].setAttribute('aria-pressed', state.status === k ? 'true' : 'false');
      });
      if (fields.status) fields.status.value = state.status;
    }
    tabAll?.addEventListener('click', () => { state.status = 'all'; syncChips(); page = 1; render(); });
    tabLow?.addEventListener('click', () => { state.status = 'low'; syncChips(); page = 1; render(); });
    tabOut?.addEventListener('click', () => { state.status = 'out'; syncChips(); page = 1; render(); });

    /* ---- open / close the panel ---- */
    toggle?.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && fields.product) fields.product.focus();
    });

    /* ---- clear one chip, or everything ---- */
    summary?.addEventListener('click', e => {
      const b = e.target.closest('[data-clear]');
      if (!b) return;
      [b.dataset.clear, b.dataset.clear2, b.dataset.clear3].filter(Boolean).forEach(k => {
        if (k === 'date' || k === 'from' || k === 'to') state[k] = k === 'date' ? 'all' : '';
        else if (k === 'location' || k === 'status') state[k] = 'all';
        else state[k] = '';
        if (fields[k]) fields[k].value = state[k];
      });
      syncChips();
      page = 1; applyDates(); render();
    });

    $('[data-filter-clear]')?.addEventListener('click', () => {
      Object.keys(state).forEach(k => {
        state[k] = (k === 'location' || k === 'status' || k === 'date') ? 'all' : '';
      });
      Object.keys(fields).forEach(k => { if (fields[k]) fields[k].value = state[k]; });
      syncChips();
      page = 1; applyDates(); render();
    });

    /* "/" focuses the product box whether the panel is open or not */
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && fields.product) {
        e.preventDefault();
        if (panel.hidden) { panel.hidden = false; toggle?.setAttribute('aria-expanded', 'true'); }
        fields.product.focus();
        fields.product.select();
      }
    });

    applyDates();
    syncChips();

    onRepaint(render);
    render();
  }

  /* =====================================================================
     TRANSFERS
     ===================================================================== */
  function initTransfers() {
    const host = $('[data-transfers]');
    const kpis = $('[data-kpis]');
    if (!host || !kpis) return;

    function kpi(label, value, sub, icon) {
      return `<div class="card stat">
        <div class="stat__top"><span class="stat__label">${label}</span><span class="stat__icon">${icon}</span></div>
        <div class="stat__value" data-value="${value}">0</div>
        <div class="stat__sub">${sub}</div>
      </div>`;
    }

    function render() {
      const done = TRANSFERS.filter(t => t.status === 'completed');
      const today = done.filter(t => t.date.toDateString() === new Date(2024, 8, 26).toDateString());
      const units = done.reduce((a, t) => a + t.qty, 0);

      kpis.innerHTML =
        kpi('Total Transfers', TRANSFERS.length, 'All time', I.transfer) +
        kpi('Completed Today', today.length, 'Since midnight', I.box) +
        kpi('Total Units Transferred', units, 'All time', I.truck);

      host.innerHTML = `
<div class="card card--flush">
  <div class="card__head"><h2>Transfer History</h2></div>
  <div class="tablewrap">
    <table class="t">
      <thead>
        <tr>
          <th>Date</th><th>Product</th><th>From</th><th>To</th>
          <th style="text-align:right">Quantity</th><th>Status</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>
      ${TRANSFERS.length ? TRANSFERS.map(t => `
        <tr>
          <td style="white-space:nowrap">${shortDate(t.date)}</td>
          <td>${esc(t.product)}</td>
          <td>${esc(Store.locationById(t.from) ? Store.locationById(t.from).name : t.from)}</td>
          <td>${esc(Store.locationById(t.to) ? Store.locationById(t.to).name : t.to)}</td>
          <td class="num">${n0(t.qty)}</td>
          <td>${t.status === 'completed'
              ? '<span class="pill pill--ok">Completed</span>'
              : '<span class="pill pill--low">Pending</span>'}</td>
          <td style="color:var(--muted)">${esc(t.notes)}</td>
        </tr>`).join('')
      : '<tr><td colspan="7"><div class="empty"><b>No transfers yet</b><p>Create your first transfer to get started.</p></div></td></tr>'}
      </tbody>
    </table>
  </div>
</div>`;
    }

    onRepaint(render);
    render();
    rollAll(kpis);
    rollAll(host);
  }

  /* =====================================================================
     REPORTS  (animated charts)
     ===================================================================== */
  function initReports() {
    const host = $('[data-reports]');
    if (!host) return;

    /* the tab strip is static markup, so wire it once outside render() */
    const tabs = $$('[data-tab]');
    tabs.forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.tab;
      const panel = document.getElementById(id);
      if (!panel) return;                 /* stale markup: ignore, don't break the rest */

      tabs.forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      $$('.tabpanel').forEach(p => { p.hidden = p !== panel; });

      /* replay the animations for the panel we just revealed */
      requestAnimationFrame(() => {
        fillMeters(panel, true);
        $$('.line-path, .bar, .line-dot', panel).forEach(el => {
          el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        });
        rollAll(panel);
      });
    }));

    function render() {
    const totalUnits = STOCK.reduce((a, r) => a + r.qty, 0);
    const totalValue  = STOCK.reduce((a, r) => a + r.qty * r.product.cost, 0);
    const lowCount    = STOCK.filter(isLow).length;
    const shopRows    = LOCATIONS.filter(l => !l.reserve);
    const avgUtil     = shopRows.reduce((a, l) => {
      const q = STOCK.filter(r => r.locationId === l.id).reduce((x, r) => x + r.qty, 0);
      return a + pct(q, l.capacity);
    }, 0) / shopRows.length;

    $('[data-kpis]').innerHTML =
      kpi('Total Products', PRODUCTS.length, 'Active SKUs', I.box, '') +
      kpi('Total Stock Value', totalValue, 'Units across all locations', I.trend, '', 2) +
      kpi('Low Stock Items', lowCount, 'Require attention', I.warn, 'amber') +
      kpi('Avg Warehouse Util.', avgUtil.toFixed(1) + '%', 'Capacity usage', I.warehouse, '', 1, '', '%');

    function kpi(label, value, sub, icon, tone, dp, prefix, suffix) {
      const isNum = typeof value === 'number';
      return `<div class="card stat">
        <div class="stat__top">
          <span class="stat__label">${label}</span>
          <span class="stat__icon ${tone ? 'stat__icon--' + tone : ''}">${icon}</span>
        </div>
        <div class="stat__value" ${isNum ? `data-value="${value}" data-dp="${dp || 0}" data-prefix="${prefix || ''}" data-suffix="${suffix || ''}"` : ''}>${isNum ? '0' : value}</div>
        <div class="stat__sub">${sub}</div>
      </div>`;
    }

    /* --- stock by category (donut) --- */
    const byCat = CATEGORIES.map(c => ({
      name: c.name, hue: c.hue,
      value: STOCK.filter(r => r.product.cat === c.id).reduce((a, r) => a + r.qty, 0)
    })).filter(x => x.value > 0);
    const catTotal = byCat.reduce((a, x) => a + x.value, 0);
    const top5 = byCat.slice().sort((a, b) => b.value - a.value).slice(0, 5);

    $('[data-donut]').innerHTML = donut(byCat, catTotal);
    $('[data-donut-legend]').innerHTML = top5.map(x => `
      <div>
        <i style="background:hsl(${x.hue} 70% 55%)"></i>
        <span>${esc(x.name)}</span>
        <span class="v">${n0(x.value)} &middot; ${((x.value / catTotal) * 100).toFixed(1)}%</span>
      </div>`).join('');

    /* --- activity trend (line) --- */
    $('[data-trend]').innerHTML = lineChart(TREND);

    /* --- stock analysis tab --- */
    const catUnits = byCat.slice().sort((a, b) => b.value - a.value);
    $('[data-cat-bars]').innerHTML   = barChart(catUnits, 'units');
    $('[data-value-bars]').innerHTML = barChart(
      byCat.map(c => ({
        name: c.name, hue: c.hue,
        value: STOCK.filter(r => r.product.cat === c.id)
                    .reduce((a, r) => a + r.qty * r.product.cost, 0)
      })).sort((a, b) => b.value - a.value), 'value');

    /* slowest movers = oldest restock, or fewest units on a big shelf */
    $('[data-slow]').innerHTML = `
<div class="tablewrap">
  <table class="t">
    <thead><tr><th>Product</th><th>Location</th><th style="text-align:right">On shelf</th>
    <th style="text-align:right">Last restock</th><th>Status</th></tr></thead>
    <tbody>
    ${STOCK.slice()
      .sort((a, b) => a.lastRestock - b.lastRestock)
      .slice(0, 8)
      .map(r => `<tr>
        <td><span class="t-main__name">${esc(r.product.name)}</span><br><span class="t-main__sku">${r.product.id}</span></td>
        <td>${esc(locName(r.location))}</td>
        <td class="num">${n0(r.qty)}</td>
        <td style="color:var(--muted);white-space:nowrap">${shortDate(r.lastRestock)}</td>
        <td>${stockPill(r)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;

    /* --- warehouse performance tab --- */
    $('[data-util-bars]').innerHTML = shopRows.map((l, i) => {
      const q = STOCK.filter(r => r.locationId === l.id).reduce((a, r) => a + r.qty, 0);
      const p = pct(q, l.capacity);
      return `
<div class="meter">
  <div class="meter__row">
    <span class="name">${esc(l.name)}</span>
    <span class="val">${n0(q)} / ${n0(l.capacity)} &nbsp;(${p.toFixed(1)}%)</span>
  </div>
  <div class="meter__fill" data-to="${p.toFixed(2)}" style="transition-delay:${i * 55}ms"></div>
</div>`;
    }).join('');

    $('[data-loc-table]').innerHTML = `
<div class="tablewrap">
  <table class="t">
    <thead><tr><th>Warehouse</th><th>Contact</th><th style="text-align:right">SKUs</th>
    <th style="text-align:right">Units</th><th style="text-align:right">Capacity</th>
    <th style="text-align:right">Utilization</th></tr></thead>
    <tbody>
    ${shopRows.map(l => {
      const recs = STOCK.filter(r => r.locationId === l.id);
      const q = recs.reduce((a, r) => a + r.qty, 0);
      return `<tr>
        <td class="t-main__name">${esc(l.name)}<br><span class="t-main__sku">${esc(l.zone)}</span></td>
        <td style="color:var(--muted)">${esc(l.contact)}</td>
        <td class="num">${recs.length}</td>
        <td class="num">${n0(q)}</td>
        <td class="num">${n0(l.capacity)}</td>
        <td class="num">${pct(q, l.capacity).toFixed(1)}%</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
</div>`;

    /* --- alerts tab --- */
    const lows = STOCK.filter(isLow).sort((a, b) => a.qty - a.min - (b.qty - b.min));
    $('[data-alert-table]').innerHTML = lows.length ? `
<div class="tablewrap">
  <table class="t">
    <thead><tr><th>Product</th><th>Location</th><th style="text-align:right">Current</th>
    <th style="text-align:right">Minimum</th><th style="text-align:right">Reorder</th>
    <th>Supplier</th><th>Status</th></tr></thead>
    <tbody>
    ${lows.map(r => `<tr class="${isLow(r) ? 'is-low' : ''}">
      <td><span class="t-main__name">${esc(r.product.name)}</span><br><span class="t-main__sku">${r.product.id}</span></td>
      <td>${esc(locName(r.location))}</td>
      <td class="num" style="color:var(--amber);font-weight:600">${n0(r.qty)}</td>
      <td class="num">${n0(r.min)}</td>
      <td class="num">${n0(r.reorder)}</td>
      <td style="color:var(--muted)">${esc(SUPPLIERS[r.product.sup] || r.product.sup)}</td>
      <td>${stockPill(r)}</td>
    </tr>`).join('')}
    </tbody>
  </table>
</div>` : '<div class="empty"><b>No alerts</b><p>Every line is above its minimum.</p></div>';
    }

    onRepaint(render);
    render();
  }

  function donut(items, total) {
    const R = 68, C = 2 * Math.PI * R, GAP = 3;
    let acc = 0;
    const arcs = items.map((x, i) => {
      const frac = x.value / total;
      const len  = Math.max(0, frac * C - GAP);
      const off  = -acc * C;
      acc += frac;
      return `<circle class="donut__arc" r="${R}" cx="80" cy="80" fill="none"
        stroke="hsl(${x.hue} 70% 55%)" stroke-width="26"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${off}"
        style="transition-delay:${(i * 90)}ms"><title>${esc(x.name)}: ${n0(x.value)}</title></circle>`;
    }).join('');

    return `
<div class="donut-wrap">
  <div class="donut">
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle r="${R}" cx="80" cy="80" fill="none" stroke="var(--line-2)" stroke-width="26"/>
      ${arcs}
    </svg>
    <div class="donut__center">
      <b data-value="${total}">0</b>
      <span>units on shelves</span>
    </div>
  </div>
  <div class="legend" data-donut-legend></div>
</div>`;
  }

  function lineChart(t) {
    const W = 620, H = 230, PL = 34, PR = 12, PT = 14, PB = 28;
    const iw = W - PL - PR, ih = H - PT - PB;
    const max = Math.max(...t.restocks, ...t.orders, ...t.transfers) * 1.15;
    const x = (i) => PL + (t.labels.length === 1 ? iw / 2 : (i / (t.labels.length - 1)) * iw);
    const y = (v) => PT + ih - (v / max) * ih;

    const series = [
      { key: 'restocks',  name: 'Restocks',  color: 'var(--green-chart)' },
      { key: 'orders',    name: 'Orders',    color: '#ef4444' },
      { key: 'transfers', name: 'Transfers', color: 'var(--blue)' }
    ];

    const grid = Array.from({ length: 5 }, (_, i) => {
      const v = (max / 4) * i;
      return `
<line x1="${PL}" y1="${y(v)}" x2="${W - PR}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/>
<text x="${PL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted-2)">${Math.round(v)}</text>`;
    }).join('');

    const xlab = t.labels.map((l, i) =>
      `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted-2)">${l}</text>`).join('');

    const paths = series.map(s => {
      const d = t[s.key].map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
      const dots = t[s.key].map((v, i) => `
        <circle class="line-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.4"
          fill="#fff" stroke="${s.color}" stroke-width="2"
          style="animation-delay:${700 + i * 90}ms"><title>${s.name} ${l(i)}: ${v}</title></circle>`).join('');
      /* rough path length for the draw-in animation */
      const len = 1400;
      return `
<path class="line-path" d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round"
      style="--len:${len};animation-delay:${series.indexOf(s) * 220}ms"/>
${dots}`;
    }).join('');

    const legend = series.map(s => `
<div><i style="background:${s.color}"></i><span>${s.name}</span></div>`).join('');

    return `
<div class="chartbox">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Activity trend, last 7 days">
    ${grid}
    ${paths}
    ${xlab}
  </svg>
  <div class="legend" style="margin-top:.6rem;justify-content:center;grid-auto-flow:column">${legend}</div>
</div>`;
  }

  function l(i) { return TREND.labels[i]; }

  /* horizontal bars, animated on reveal */
  function barChart(items, kind) {
    const max = Math.max(...items.map(x => x.value)) || 1;
    const fmt = (v) => kind === 'value' ? money(v) : n0(v);
    return items.map((x, i) => `
<div class="meter" style="margin-bottom:.85rem">
  <div class="meter__row">
    <span class="name">${esc(x.name)}</span>
    <span class="val">${fmt(x.value)}</span>
  </div>
  <div class="meter__fill" data-to="${((x.value / max) * 100).toFixed(2)}"
       style="background:hsl(${x.hue} 70% 52%);transition-delay:${i * 55}ms"></div>
</div>`).join('');
  }

  /* =====================================================================
     EXPIRY & DEAD STOCK  (own page, not part of Reports)
     ===================================================================== */
  function initExpiry() {
    const host = $('[data-expiry]');
    if (!host) return;

    function render() {
    const expired  = STOCK.filter(r => isExpired(r.product))
                           .sort((a, b) => daysToExpiry(a.product) - daysToExpiry(b.product));
    const expiring = STOCK.filter(r => expiryStatus(r.product) === 'soon')
                           .sort((a, b) => daysToExpiry(a.product) - daysToExpiry(b.product));
    const lazy     = STOCK.filter(r => isSlow(r.product) || isDead(r.product))
                           .sort((a, b) => a.product.sold30 - b.product.sold30);
    const deadVal  = lazy.reduce((a, r) => a + r.qty * r.product.cost, 0);
    const lostVal  = expired.reduce((a, r) => a + r.qty * r.product.cost, 0);

    /* headline numbers */
    $('[data-kpis]').innerHTML = [
      kpi('Expired Lines', expired.length, 'Pull from the shelf now', I.warn, 'amber'),
      kpi('Value Written Off', lostVal, 'At cost price', I.box, '', 2),
      kpi('Expiring in 3 Days', expiring.length, 'Discount or move them', I.trend, 'amber'),
      kpi('Tied Up in Dead Stock', deadVal, 'No real movement in 30 days', I.layers, '', 2)
    ].join('');

    function kpi(label, value, sub, icon, tone, dp, prefix, suffix) {
      const isNum = typeof value === 'number';
      return `<div class="card stat">
        <div class="stat__top">
          <span class="stat__label">${label}</span>
          <span class="stat__icon ${tone ? 'stat__icon--' + tone : ''}">${icon}</span>
        </div>
        <div class="stat__value" ${isNum ? `data-value="${value}" data-dp="${dp || 0}" data-prefix="${prefix || ''}" data-suffix="${suffix || ''}"` : ''}>${isNum ? '0' : value}</div>
        <div class="stat__sub">${sub}</div>
      </div>`;
    }

    /* ---- expired ---- */
    $('[data-expired]').innerHTML = `
<div class="card">
  <div class="card__head">
    <h2>Expired Products</h2>
    <span class="right">
      <span class="pill pill--out">${expired.length} line${expired.length === 1 ? '' : 's'}</span>
    </span>
  </div>
  <div class="card__body" style="padding-bottom:0">
    <div class="note">${I.warn}
      <span>These are past their use-by date and should come off the shelf today.
      <b>${money(lostVal)}</b> of stock at cost is affected.</span>
    </div>
  </div>
  ${expired.length ? `
  <div class="tablewrap">
    <table class="t t--dense">
      <thead><tr>
        <th>Product</th><th>Location</th><th>SKU</th>
        <th style="text-align:right">Expired</th><th style="text-align:right">Units</th>
        <th style="text-align:right">Value Lost</th><th>Supplier</th><th>Status</th>
      </tr></thead>
      <tbody>
      ${expired.map(r => `<tr class="is-low">
        <td><span class="t-main__name">${esc(r.product.name)}</span><br><span class="t-main__sku">${esc(r.product.brand)}</span></td>
        <td>${esc(locName(r.location))}</td>
        <td><span class="tag tag--sku">${r.product.id}</span></td>
        <td class="num" style="color:var(--red);font-weight:600">${Math.abs(daysToExpiry(r.product))}d ago</td>
        <td class="num">${n0(r.qty)}</td>
        <td class="num">${money(r.qty * r.product.cost)}</td>
        <td style="color:var(--muted)">${esc(SUPPLIERS[r.product.sup] || r.product.sup)}</td>
        <td>${expiryPill(r.product)}</td>
      </tr>`).join('')}
      </tbody>
    </table>
  </div>` : '<div class="empty"><b>Nothing expired</b><p>Every dated line is still within its shelf life.</p></div>'}
</div>`;

    /* ---- expiring soon ---- */
    $('[data-expiring]').innerHTML = `
<div class="card">
  <div class="card__head">
    <h2>Expiring Within 3 Days</h2>
    <span class="right">
      <span class="pill pill--low">${expiring.length} line${expiring.length === 1 ? '' : 's'}</span>
    </span>
  </div>
  ${expiring.length ? `
  <div class="tablewrap">
    <table class="t t--dense">
      <thead><tr>
        <th>Product</th><th>Location</th><th>SKU</th>
        <th style="text-align:right">Days Left</th><th style="text-align:right">Units</th>
        <th style="text-align:right">Takes To Clear</th><th>Status</th>
      </tr></thead>
      <tbody>
      ${expiring.map(r => {
        const perDay = r.product.sold30 / 30;
        const toClear = perDay > 0 ? Math.ceil(r.qty / perDay) : Infinity;
        const risky = isFinite(toClear) && toClear > daysToExpiry(r.product);
        return `<tr class="${risky ? 'is-low' : ''}">
          <td><span class="t-main__name">${esc(r.product.name)}</span><br><span class="t-main__sku">${esc(r.product.brand)}</span></td>
          <td>${esc(locName(r.location))}</td>
          <td><span class="tag tag--sku">${r.product.id}</span></td>
          <td class="num" style="color:var(--amber);font-weight:600">${daysToExpiry(r.product)}d</td>
          <td class="num">${n0(r.qty)}</td>
          <td class="num" style="color:${risky ? 'var(--red)' : 'var(--muted)'};font-weight:${risky ? 600 : 400}">
            ${isFinite(toClear) ? toClear + 'd' : 'no sales'}${risky ? ' &mdash; won\'t clear' : ''}</td>
          <td>${expiryPill(r.product)}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>` : '<div class="empty"><b>Nothing expiring soon</b><p>No dated line expires within three days.</p></div>'}
</div>`;

    /* ---- slow movers / dead stock ---- */
    $('[data-dead]').innerHTML = `
<div class="card">
  <div class="card__head">
    <h2>Slow Moving &amp; Dead Stock</h2>
    <span class="right">
      <span class="tag tag--amber">${money(deadVal)} tied up</span>
      <span class="tag">${lazy.length} line${lazy.length === 1 ? '' : 's'}</span>
    </span>
  </div>
  <div class="card__body" style="padding-bottom:0">
    <div class="note">${I.warn}
      <span>Lines selling slowly or not at all. &ldquo;Days of cover&rdquo; is how long the
      current stock lasts at the last 30 days&rsquo; rate &mdash; anything over 120 days
      is worth discounting, bundling or writing down.</span>
    </div>
  </div>
  ${lazy.length ? `
  <div class="tablewrap">
    <table class="t t--dense">
      <thead><tr>
        <th>Product</th><th>Location</th><th>SKU</th>
        <th style="text-align:right">Sold (30d)</th><th style="text-align:right">On Shelf</th>
        <th style="text-align:right">Days of Cover</th><th style="text-align:right">Tied Up</th>
        <th>Last Restock</th><th>Status</th>
      </tr></thead>
      <tbody>
      ${lazy.map(r => {
        const doc = daysOfCover(r.product);
        return `<tr class="${r.product.sold30 === 0 ? 'is-low' : ''}">
          <td><span class="t-main__name">${esc(r.product.name)}</span><br><span class="t-main__sku">${esc(r.product.brand)}</span></td>
          <td>${esc(locName(r.location))}</td>
          <td><span class="tag tag--sku">${r.product.id}</span></td>
          <td class="num" style="color:${r.product.sold30 === 0 ? 'var(--red)' : 'var(--amber)'};font-weight:600">${n0(r.product.sold30)}</td>
          <td class="num">${n0(r.qty)}</td>
          <td class="num">${isFinite(doc) ? Math.round(doc) + 'd' : '&infin;'}</td>
          <td class="num">${money(r.qty * r.product.cost)}</td>
          <td style="color:var(--muted);white-space:nowrap">${shortDate(r.lastRestock)}</td>
          <td>${velocityPill(r.product)}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>` : '<div class="empty"><b>Everything is moving</b><p>No line has excessive days of cover.</p></div>'}
</div>`;
    }

    onRepaint(render);
    render();
    rollAll(host);
  }

  /* =====================================================================
     INVENTORY  (tizimdagi qoldiq vs amaldagi qoldiq)
     ===================================================================== */
  function initInventory() {
    const host = $('[data-inventory]');
    if (!host) return;

    const PER = 25;
    const state = { q: '', loc: 'all', flag: 'all', tab: 'count', page: 1, open: null };
    /* productId -> { actual, system, corrected }
       `system` is captured when the count is first typed in, so the saved
       audit line keeps the discrepancy that was found, even after the
       record is corrected to the counted figure. */
    const counts = new Map();

    const tabCount  = $('[data-inv-tab="count"]', host);
    const tabHist   = $('[data-inv-tab="history"]', host);
    const paneCount = $('[data-inv-count]', host);
    const paneHist  = $('[data-inv-history]', host);
    const searchIn  = $('[data-search]', host);
    const locSel    = $('[data-loc]', host);
    const kpiBox    = $('[data-inv-kpis]', host);
    const tableHost = $('[data-inv-table]', host);
    const saveBtn   = $('[data-inv-save]', host);
    const applyAllBtn = $('[data-inv-apply-all]', host);
    const hintEl    = $('[data-inv-hint]', host);

    const STATUS_UZ = {
      mos: { t: 'Mos',      cls: 'pill--ok'   },
      kam: { t: 'Kamomad',  cls: 'pill--out'  },
      ort: { t: 'Ortiqcha', cls: 'pill--info' }
    };
    const stKey = (diff) => diff === 0 ? 'mos' : diff < 0 ? 'kam' : 'ort';
    const pill  = (diff) => { const s = STATUS_UZ[stKey(diff)]; return `<span class="pill ${s.cls}">${s.t}</span>`; };
    const fmtDT = (d) => d.toLocaleDateString('en-GB', { day:'numeric', month:'numeric', year:'numeric' }) +
      ', ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const DOWN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/></svg>';

    /* ---------- toolbar ---------- */
    if (locSel) {
      locSel.innerHTML = '<option value="all">Barcha joylar</option>' +
        LOCATIONS.filter(l => !l.reserve).map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
      locSel.addEventListener('change', () => { state.loc = locSel.value; state.page = 1; render(); });
    }
    searchIn?.addEventListener('input', () => { state.q = searchIn.value; state.page = 1; render(); });
    $$('[data-flag]', host).forEach(ch => ch.addEventListener('click', () => {
      state.flag = ch.dataset.flag;
      state.page = 1;
      $$('[data-flag]', host).forEach(c => c.setAttribute('aria-pressed', String(c === ch)));
      render();
    }));
    [tabCount, tabHist].forEach(b => b?.addEventListener('click', () => {
      state.tab = b.dataset.invTab;
      render();
    }));

    function syncTabs() {
      tabCount?.setAttribute('aria-selected', String(state.tab === 'count'));
      tabHist?.setAttribute('aria-selected', String(state.tab === 'history'));
      if (tabHist) tabHist.textContent = 'Tarix' + (INVENTORIES.length ? ' (' + INVENTORIES.length + ')' : '');
      if (paneCount) paneCount.hidden = state.tab !== 'count';
      if (paneHist)  paneHist.hidden  = state.tab !== 'history';
    }

    /* ---------- count list ---------- */
    function list() {
      let rows = STOCK.slice();
      const q = norm(state.q);
      if (q) {
        const terms = q.split(' ').filter(Boolean);
        rows = rows.filter(r => {
          const hay = norm(r.product.name + ' ' + r.product.brand + ' ' + r.product.id + ' ' + locName(r.location));
          return terms.every(t => hay.includes(t));
        });
      }
      if (state.loc !== 'all') rows = rows.filter(r => r.locationId === state.loc);
      if (state.flag === 'counted') rows = rows.filter(r => counts.has(r.id));
      if (state.flag === 'diff')    rows = rows.filter(r => { const c = counts.get(r.id); return c && c.actual !== c.system; });
      return rows;
    }

    function stat(label, value, sub) {
      return `<div class="card stat">
        <div class="stat__top"><span class="stat__label">${label}</span></div>
        <div class="stat__value">${value}</div>
        <div class="stat__sub">${sub || ''}</div>
      </div>`;
    }

    function totals() {
      let mos = 0, kam = 0, ort = 0, kamU = 0, ortU = 0;
      counts.forEach(c => {
        const d = c.actual - c.system;
        if (d === 0) mos++;
        else if (d < 0) { kam++; kamU += -d; }
        else { ort++; ortU += d; }
      });
      return { mos, kam, ort, kamU, ortU };
    }

    function paintKpis() {
      if (!kpiBox) return;
      const t = totals();
      kpiBox.innerHTML =
        stat('Sanalgan', n0(counts.size), 'qator kiritildi') +
        stat('Mos', n0(t.mos), 'farq yo‘q') +
        stat('Kamomad', n0(t.kam), t.kamU ? '−' + n0(t.kamU) + ' dona' : 'farq yo‘q') +
        stat('Ortiqcha', n0(t.ort), t.ortU ? '+' + n0(t.ortU) + ' dona' : 'farq yo‘q');
    }

    function syncFoot() {
      const pending = [...counts.values()].filter(c => !c.corrected && c.actual !== c.system).length;
      if (saveBtn) saveBtn.disabled = counts.size === 0;
      if (applyAllBtn) applyAllBtn.disabled = pending === 0;
      if (hintEl) hintEl.textContent = counts.size
        ? n0(counts.size) + ' ta mahsulot sanaldi' + (pending ? ' · ' + n0(pending) + ' ta farq hali tuzatilmagan' : ' · barcha farqlar tuzatilgan')
        : 'Amaldagi sonni kiriting — farq va holat avtomatik hisoblanadi';
    }

    /* update just the cells of one row, so the input keeps its focus */
    function paintRow(tr, r) {
      const c = counts.get(r.id);
      const diffEl = $('[data-diff]', tr);
      const stEl   = $('[data-st]', tr);
      const actEl  = $('[data-act]', tr);
      if (!c) {
        if (diffEl) { diffEl.textContent = '—'; diffEl.className = 'num'; }
        if (stEl) stEl.innerHTML = '<span class="none">—</span>';
        if (actEl) actEl.innerHTML = '';
        return;
      }
      const d = c.actual - c.system;
      if (diffEl) {
        diffEl.textContent = (d > 0 ? '+' : '') + n0(d);
        diffEl.className = 'num ' + (d === 0 ? '' : d < 0 ? 'neg' : 'pos');
      }
      if (stEl) stEl.innerHTML = pill(d) + (c.corrected ? ' <span class="tag tag--blue">tuzatildi</span>' : '');
      if (actEl) actEl.innerHTML = (!c.corrected && d !== 0)
        ? `<button class="btn btn--mini" type="button" data-inv-apply="${r.id}"
             title="Tizimni ${n0(c.actual)} ga o‘zgartirish">→ ${n0(c.actual)}</button>`
        : '';
    }

    function render() {
      syncTabs();
      if (state.tab === 'history') { renderHistory(); return; }

      const rows = list();
      const pages = Math.max(1, Math.ceil(rows.length / PER));
      if (state.page > pages) state.page = pages;
      const slice = rows.slice((state.page - 1) * PER, state.page * PER);

      tableHost.innerHTML = `
<div class="card card--flush">
  <div class="tablewrap">
    <table class="t t--fit">
      <thead>
        <tr>
          <th>Mahsulot</th>
          <th style="width:100px">SKU</th>
          <th style="width:140px">Joylashuv</th>
          <th style="width:86px;text-align:right">Tizimda</th>
          <th style="width:104px;text-align:right">Amalda</th>
          <th style="width:78px;text-align:right">Farq</th>
          <th style="width:132px">Holat</th>
          <th class="actions" style="width:86px"></th>
        </tr>
      </thead>
      <tbody>
      ${slice.map(r => {
        const c = counts.get(r.id);
        return `
<tr data-row="${r.id}">
  <td class="t-main__name">${esc(r.product.name)}<br><span class="t-main__sku">${esc(r.product.brand)}</span></td>
  <td><span class="tag tag--sku">${r.id}</span></td>
  <td style="color:var(--muted)">${esc(locName(r.location))}</td>
  <td class="num">${n0(r.qty)}</td>
  <td class="num"><input class="input inv-input" type="number" min="0" step="1" inputmode="numeric"
       data-count-input="${r.id}" value="${c ? c.actual : ''}" placeholder="—" aria-label="Amaldagi soni"></td>
  <td class="num" data-diff>—</td>
  <td data-st><span class="none">—</span></td>
  <td class="actions" data-act></td>
</tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>
  <div class="pager">
    <span><b>${n0(slice.length)}</b> / ${n0(rows.length)} qator</span>
    <span class="pager__btns">
      <button type="button" data-page="prev" ${state.page === 1 ? 'disabled' : ''} aria-label="Oldingi">&#8249;</button>
      <span>${state.page} / ${pages}</span>
      <button type="button" data-page="next" ${state.page === pages ? 'disabled' : ''} aria-label="Keyingi">&#8250;</button>
    </span>
  </div>
</div>`;
      slice.forEach(r => { const tr = $(`tr[data-row="${r.id}"]`, tableHost); if (tr) paintRow(tr, r); });
      paintKpis();
      syncFoot();
    }

    /* ---------- history ---------- */
    function renderHistory() {
      if (!paneHist) return;
      if (!INVENTORIES.length) {
        paneHist.innerHTML = '<div class="card"><div class="empty"><b>Tarix bo‘sh</b><p>Birinchi sanov saqlangach, shu yerda ko‘rinadi.</p></div></div>';
        return;
      }
      paneHist.innerHTML = INVENTORIES.map(s => {
        let mos = 0, kam = 0, ort = 0, kamU = 0, ortU = 0, corr = 0;
        s.lines.forEach(l => {
          if (l.diff === 0) mos++;
          else if (l.diff < 0) { kam++; kamU += -l.diff; }
          else { ort++; ortU += l.diff; }
          if (l.corrected) corr++;
        });
        const open = state.open === s.id;
        return `
<div class="card inv-card">
  <div class="inv-card__head" data-hist-open="${s.id}" role="button" tabindex="0"
       aria-expanded="${open}" aria-label="${s.id} tafsilotlari">
    <span class="chev">${I.chev}</span>
    <b>${s.id}</b>
    <span class="inv-card__date">${fmtDT(s.date)}</span>
    <span class="tag">${n0(s.lines.length)} qator</span>
    <span class="pill pill--ok">Mos ${n0(mos)}</span>
    <span class="pill pill--out">Kamomad ${n0(kam)}${kamU ? ' (−' + n0(kamU) + ')' : ''}</span>
    <span class="pill pill--info">Ortiqcha ${n0(ort)}${ortU ? ' (+' + n0(ortU) + ')' : ''}</span>
    ${corr ? `<span class="tag tag--blue">${n0(corr)} tuzatilgan</span>` : ''}
    <span class="inv-card__btns">
      <button class="icon-btn" type="button" data-hist-csv="${s.id}" title="CSV yuklab olish" aria-label="CSV yuklab olish">${DOWN_SVG}</button>
      <button class="icon-btn icon-btn--danger" type="button" data-hist-del="${s.id}" title="O‘chirish" aria-label="O‘chirish">${I.trash}</button>
    </span>
  </div>
  ${open ? `
  <div class="tablewrap"><table class="t t--fit">
    <thead><tr>
      <th>Mahsulot</th>
      <th style="width:100px">SKU</th>
      <th style="width:130px">Joylashuv</th>
      <th style="width:86px;text-align:right">Tizimda</th>
      <th style="width:86px;text-align:right">Amalda</th>
      <th style="width:78px;text-align:right">Farq</th>
      <th style="width:120px">Holat</th>
      <th style="width:100px">Tuzatilgan</th>
    </tr></thead>
    <tbody>
      ${s.lines.map(l => `<tr>
        <td class="t-main__name">${esc(l.name)}</td>
        <td><span class="tag tag--sku">${l.productId}</span></td>
        <td style="color:var(--muted)">${esc(l.location)}</td>
        <td class="num">${n0(l.system)}</td>
        <td class="num">${n0(l.actual)}</td>
        <td class="num ${l.diff === 0 ? '' : l.diff < 0 ? 'neg' : 'pos'}">${(l.diff > 0 ? '+' : '') + n0(l.diff)}</td>
        <td>${pill(l.diff)}</td>
        <td>${l.corrected ? '<span class="tag tag--blue">ha</span>' : '<span class="none">—</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>` : ''}
</div>`;
      }).join('');
    }

    function exportCsv(s) {
      UI.downloadCsv(s.id + '.csv', [
        ['Inventarizatsiya', s.id, 'Sana', fmtDT(s.date)],
        [],
        ['Mahsulot', 'SKU', 'Joylashuv', 'Tizimda', 'Amalda', 'Farq', 'Holat', 'Tuzatilgan'],
        ...s.lines.map(l => [l.name, l.productId, l.location, l.system, l.actual, l.diff,
          STATUS_UZ[stKey(l.diff)].t, l.corrected ? 'ha' : "yo'q"])
      ]);
    }

    function saveSession() {
      if (!counts.size) { UI.toast('Hech qanday sanov kiritilmagan', 'warn'); return; }
      const lines = [...counts.entries()].map(([id, c]) => {
        const r = Store.recordById(id);
        return {
          productId: id,
          name: r && r.product ? r.product.name : id,
          location: r ? locName(r.location) : '',
          system: c.system,
          actual: c.actual,
          diff: c.actual - c.system,
          corrected: !!c.corrected
        };
      });
      const s = Store.saveInventory({ lines });
      counts.clear();
      UI.toast(s.id + ' saqlandi — ' + n0(lines.length) + ' ta qator', 'ok');
      state.tab = 'history';
      render();
    }

    /* ---------- events ---------- */
    host.addEventListener('input', e => {
      const inp = e.target.closest('[data-count-input]');
      if (!inp) return;
      const r = Store.recordById(inp.dataset.countInput);
      const tr = inp.closest('tr');
      if (!r || !tr) return;

      if (inp.value === '') {
        counts.delete(r.id);
      } else {
        const actual = Math.max(0, Math.trunc(Number(inp.value) || 0));
        const prev = counts.get(r.id);
        if (prev && prev.corrected && actual !== prev.actual) {
          counts.set(r.id, { actual, system: r.qty, corrected: false });  /* fresh re-count */
        } else if (prev) {
          prev.actual = actual;
        } else {
          counts.set(r.id, { actual, system: r.qty, corrected: false });
        }
      }
      paintRow(tr, r);
      paintKpis();
      syncFoot();
    });

    host.addEventListener('click', e => {
      const pg = e.target.closest('[data-page]');
      if (pg && tableHost.contains(pg)) {
        state.page += pg.dataset.page === 'next' ? 1 : -1;
        render();
        return;
      }

      const ap = e.target.closest('[data-inv-apply]');
      if (ap) {
        const id = ap.dataset.invApply;
        const c = counts.get(id);
        const r = Store.recordById(id);
        if (!c || !r) return;
        c.corrected = true;                 /* set before emit — the repaint reads it */
        Store.applyInventoryCorrection(id, c.actual);
        UI.toast(r.product.name + ': ' + n0(c.system) + ' → ' + n0(c.actual) + ' ga tuzatildi', 'ok');
        return;
      }

      if (e.target.closest('[data-inv-apply-all]')) {
        const pend = [...counts.entries()].filter(([, c]) => !c.corrected && c.actual !== c.system);
        if (!pend.length) return;
        UI.confirm({
          title: 'Farqlarni tuzatish?',
          message: pend.length + ' ta mahsulotning tizimdagi soni amaldagi songa o‘zgartiriladi.',
          detail: pend.slice(0, 6).map(([id, c]) => {
            const r = Store.recordById(id);
            return esc(r ? r.product.name : id) + ': ' + n0(c.system) + ' → ' + n0(c.actual);
          }).join('<br>') + (pend.length > 6 ? '<br>…' : ''),
          confirmLabel: 'Tuzatish'
        }).then(ok => {
          if (!ok) return;
          pend.forEach(([, c]) => { c.corrected = true; });   /* before emit — repaint reads it */
          const done = Store.applyInventoryCorrections(pend.map(([productId, c]) => ({ productId, actual: c.actual })));
          UI.toast(n0(done) + ' ta qoldiq tuzatildi', 'ok');
        });
        return;
      }

      if (e.target.closest('[data-inv-save]')) { saveSession(); return; }

      const hx = e.target.closest('[data-hist-open]');
      if (hx) {
        state.open = state.open === hx.dataset.histOpen ? null : hx.dataset.histOpen;
        renderHistory();
        return;
      }
      const hd = e.target.closest('[data-hist-del]');
      if (hd) {
        const s = INVENTORIES.find(x => x.id === hd.dataset.histDel);
        if (!s) return;
        UI.confirm({
          title: s.id + ' o‘chirilsinmi?',
          message: 'Bu inventarizatsiya yozuvi tarixdan butunlay o‘chadi.',
          confirmLabel: 'O‘chirish',
          danger: true
        }).then(ok => { if (ok) { Store.deleteInventory(s.id); UI.toast(s.id + ' o‘chirildi', 'warn'); } });
        return;
      }
      const hc = e.target.closest('[data-hist-csv]');
      if (hc) {
        const s = INVENTORIES.find(x => x.id === hc.dataset.histCsv);
        if (s) exportCsv(s);
      }
    });

    /* Enter toggles the history card like a button */
    paneHist?.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const h = e.target.closest('[data-hist-open]');
      if (h) { e.preventDefault(); h.click(); }
    });

    onRepaint(render);
    render();
  }

  /* =====================================================================
     LOW STOCK  (its own page, under Expiry & Dead Stock)
     ===================================================================== */
  function initLowStock() {
    const host = $('[data-lowstock]');
    if (!host) return;

    const state = { q: '', sup: 'all', flag: 'all' };
    const input = $('[data-search]');
    const supSel = $('[data-sup]');

    const kpi = (label, value, sub, icon, tone, dp, prefix) => {
      const isNum = typeof value === 'number';
      return `<div class="card stat">
        <div class="stat__top">
          <span class="stat__label">${label}</span>
          <span class="stat__icon ${tone ? 'stat__icon--' + tone : ''}">${icon}</span>
        </div>
        <div class="stat__value" ${isNum ? `data-value="${value}" data-dp="${dp || 0}" data-prefix="${prefix || ''}"` : ''}>${isNum ? '0' : value}</div>
        <div class="stat__sub">${sub}</div>
      </div>`;
    };

    function build() {
      const q = norm(state.q);
      let rows = STOCK.filter(isLow).sort((a, b) => {
        const rank = { out: 0, low: 1 };
        return rank[statusOf(a)] - rank[statusOf(b)] || a.qty - a.min - (b.qty - b.min);
      });

      if (state.sup !== 'all') rows = rows.filter(r => r.product.sup === state.sup);
      if (state.flag === 'out') rows = rows.filter(isOut);
      if (state.flag === 'expiring') rows = rows.filter(r => {
        const s = expiryStatus(r.product);
        return s === 'expired' || s === 'soon';
      });
      if (q) {
        const terms = q.split(' ').filter(Boolean);
        rows = rows.filter(r => {
          const hay = norm(r.product.name + ' ' + r.product.brand + ' ' + r.product.id + ' ' + locName(r.location));
          return terms.every(t => hay.includes(t));
        });
      }
      return rows;
    }

    function render() {
      const all = STOCK.filter(isLow);
      const outOnly = all.filter(isOut);
      const unitsToOrder = all.reduce((a, r) => a + Math.max(r.reorder - r.qty, 0), 0);
      const orderValue = all.reduce((a, r) => a + Math.max(r.reorder - r.qty, 0) * r.product.cost, 0);

      $('[data-kpis]').innerHTML =
        kpi('Lines Below Minimum', all.length, 'Need reordering', I.warn, all.length ? 'amber' : 'green') +
        kpi('Out of Stock', outOnly.length, 'Shelf is empty', I.box, outOnly.length ? 'amber' : 'green') +
        kpi('Units to Order', unitsToOrder, 'Topping up to reorder qty', I.trend) +
        kpi('Order Value', orderValue, 'At cost price', I.warehouse, '', 2);

      /* group the whole list by supplier so it reads like an order sheet */
      const bySup = {};
      all.forEach(r => {
        const k = r.product.sup;
        (bySup[k] = bySup[k] || []).push(r);
      });
      const supRows = Object.entries(bySup)
        .map(([code, list]) => {
          const units = list.reduce((a, r) => a + Math.max(r.reorder - r.qty, 0), 0);
          const cost  = list.reduce((a, r) => a + Math.max(r.reorder - r.qty, 0) * r.product.cost, 0);
          return { code, name: SUPPLIERS[code] || code, lines: list.length, units, cost };
        })
        .sort((a, b) => b.cost - a.cost);

      $('[data-suppliers]').innerHTML = supRows.length ? `
<div class="tablewrap">
  <table class="t">
    <thead><tr>
      <th>Supplier</th><th style="text-align:right">Lines</th>
      <th style="text-align:right">Units to order</th>
      <th style="text-align:right">Order value</th>
      <th style="text-align:right">Share</th>
    </tr></thead>
    <tbody>
    ${supRows.map(s => {
      const share = pct(s.cost, orderValue);
      return `<tr>
        <td class="t-main__name">${esc(s.name)}</td>
        <td class="num">${s.lines}</td>
        <td class="num">${n0(s.units)}</td>
        <td class="num">${money(s.cost)}</td>
        <td class="num" style="min-width:120px">
          <div class="meter" style="margin:0">
            <div class="meter__fill" data-to="${share.toFixed(1)}"></div>
          </div>
          <small style="font-family:var(--mono);font-size:.72rem;color:var(--muted)">${share.toFixed(1)}%</small>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
</div>` : '<div class="empty"><b>Nothing on order</b><p>Every line is above its minimum level.</p></div>';

      const rows = build();
      if (countEl) {
        countEl.innerHTML = `<b>${rows.length}</b> line${rows.length === 1 ? '' : 's'}` +
          (rows.length !== all.length ? ` &middot; of ${all.length} needing action` : '');
      }

      $('[data-list]').innerHTML = rows.length ? `
<div class="card card--flush">
  <div class="tablewrap">
    <table class="t t--dense">
      <thead><tr>
        <th style="width:30px"></th>
        <th>Product</th><th>Location</th><th>Supplier</th>
        <th style="text-align:right">On hand</th><th style="text-align:right">Min</th>
        <th style="text-align:right">Order</th><th style="text-align:right">Cost</th>
        <th>Last restock</th><th>Status</th><th class="actions">Actions</th>
      </tr></thead>
      <tbody>
      ${rows.map(r => {
        const order = Math.max(r.reorder - r.qty, 0);
        const gap = r.qty - r.min;
        return `
<tr class="t-main ${isOut(r) ? 'is-low' : ''}" data-expand tabindex="0"
    aria-label="${esc(r.product.name)} at ${esc(locName(r.location))} — show location">
  <td><span class="chev">${I.chev}</span></td>
  <td><span class="t-main__name">${esc(r.product.name)}</span><br><span class="t-main__sku">${esc(r.product.brand)} &middot; ${r.product.id}</span></td>
  <td>${esc(locName(r.location))}</td>
  <td style="color:var(--muted)">${esc(SUPPLIERS[r.product.sup] || r.product.sup)}</td>
  <td class="num" style="color:var(--amber);font-weight:700">${n0(r.qty)}</td>
  <td class="num">${n0(r.min)}</td>
  <td class="num"><b>${n0(order)}</b></td>
  <td class="num">${money(order * r.product.cost)}</td>
  <td style="color:var(--muted);white-space:nowrap">${shortDate(r.lastRestock)}</td>
  <td>${stockPill(r)}</td>
  <td class="actions">
    <button class="icon-btn" type="button" data-action="restock" data-id="${r.id}" title="Record a delivery" aria-label="Record a delivery for ${esc(r.product.name)}">${I.check}</button>
    <button class="icon-btn icon-btn--danger" type="button" data-action="delete-record" data-id="${r.id}" title="Remove" aria-label="Remove ${esc(r.product.name)} from stock">${I.trash}</button>
  </td>
</tr>
<tr class="detail" hidden><td colspan="11">${locationDetail(r)}</td></tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>
</div>` : `<div class="card"><div class="empty"><b>Nothing matches</b>
  <p>No line is below its minimum with these filters applied.</p></div></div>`;

      wireExpand(host);
      fillMeters(host, true);
    }

    const countEl = $('[data-count]');

    if (supSel) {
      const used = [...new Set(STOCK.map(r => r.product.sup))].sort();
      supSel.innerHTML = '<option value="all">All suppliers</option>' +
        used.map(c => `<option value="${c}">${esc(SUPPLIERS[c] || c)}</option>`).join('');
      supSel.addEventListener('change', () => { state.sup = supSel.value; render(); });
    }

    $$('[data-flag]').forEach(btn => btn.addEventListener('click', () => {
      state.flag = btn.dataset.flag;
      $$('[data-flag]').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      render();
    }));

    let t;
    input?.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = input.value; render(); }, 160);
    });

    onRepaint(render);
    render();
  }

  /* =====================================================================
     global + actions
     ===================================================================== */
  function initGlobal() {
    /* "/" jumps to the search box, the way every internal tool behaves */
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        const s = $('[data-search]');
        if (s) { e.preventDefault(); s.focus(); s.select(); }
      }
    });

    /* every button that edits data carries data-action; handle them centrally */
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const fn = ACTIONS[btn.dataset.action];
      if (fn) fn(btn);
      else console.warn('No handler for action:', btn.dataset.action);
    });

    $$('[data-today]').forEach(el => {
      el.textContent = new Date().toLocaleDateString('en-GB',
        { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    });
  }

  /* ---------------- shared field builders ---------------- */
  const catOptions = () => CATEGORIES.map(c => ({ value: c.id, label: c.name }));
  const supOptions = () => Object.entries(SUPPLIERS).map(([k, v]) => ({ value: k, label: v }));
  const rowOptions = () => LOCATIONS.filter(l => !l.reserve)
    .map(l => ({ value: String(l.row), label: 'Row ' + l.row }));

  function productFields(includeStock) {
    const f = [
      { key: 'name',  label: 'Product name', required: true, placeholder: 'Wholemeal Bread 800g' },
      { key: 'brand', label: 'Brand',        required: true, placeholder: 'Mill Rise' },
      { key: 'cat',   label: 'Category',     type: 'select', options: catOptions(), required: true },
      { key: 'sup',   label: 'Supplier',     type: 'select', options: supOptions() },
      { key: 'cost',  label: 'Cost price',   type: 'number', step: '0.01', min: 0, required: true },
      { key: 'price', label: 'Shelf price',  type: 'number', step: '0.01', min: 0, required: true },
      { key: 'row',   label: 'Row',          type: 'select', options: rowOptions(), required: true,
        hint: 'Which aisle it lives in' },
      { key: 'shelf', label: 'Shelf',        type: 'number', min: 1, max: 5, required: true,
        hint: '1 = top, 5 = bottom' },
      { key: 'sd',    label: 'Shelf life (days)', type: 'number', min: 0,
        hint: '0 = never expires' },
      { key: 'desc',  label: 'Description',  type: 'textarea', placeholder: 'Short note for staff' }
    ];
    if (includeStock) f.push(
      { key: 'stock',   label: 'Units on shelf', type: 'number', min: 0, required: true },
      { key: 'cap',     label: 'Shelf capacity',  type: 'number', min: 1, required: true },
      { key: 'reorder', label: 'Reorder level',   type: 'number', min: 0, required: true },
      { key: 'sold30',  label: 'Sold last 30 days', type: 'number', min: 0 }
    );
    return f;
  }

  function productValues(p) {
    if (!p) return {};
    return {
      name: p.name, brand: p.brand, cat: p.cat, desc: p.desc, sup: p.sup,
      cost: p.cost, price: p.price, row: p.row, shelf: p.shelf, sd: p.sd,
      stock: p.stock, cap: p.cap, reorder: p.reorder, sold30: p.sold30
    };
  }

  function recordFields() {
    return [
      { key: 'productId', label: 'Product', type: 'select', required: true,
        options: PRODUCTS.map(p => ({ value: p.id, label: p.name })) },
      { key: 'locationId', label: 'Location', type: 'select', required: true,
        options: LOCATIONS.map(l => ({ value: l.id, label: l.name })) },
      { key: 'qty',     label: 'Quantity on hand', type: 'number', min: 0, required: true },
      { key: 'min',     label: 'Minimum level',    type: 'number', min: 0, required: true,
        hint: 'Flags as low stock at or below' },
      { key: 'reorder', label: 'Reorder quantity', type: 'number', min: 0, required: true }
    ];
  }

  const statusOf = (r) => (isOut(r) ? 'out' : isLow(r) ? 'low' : 'ok');

  /* ---------------- Excel / CSV import ----------------
     A 1C-style export: Name · (2 skipped cols) · Stock · Sale price · Buy price.
     Price cells look like "27000 UZS" — the currency text is stripped here,
     the value itself is stored in so'm and shown on screen as a bare number. */
  function parsePriceCell(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const m = String(v).trim().replace(/[\s ]+/g, '')
      .match(/^(\d+(?:[.,]\d+)?)(UZS|SUM|SO'?M|USD|EUR|RUB)?$/i);
    if (!m) return null;
    const n = parseFloat(m[1].replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  /* Brands that actually appear in the shop's price lists; anything else
     is a product-type word (Люстра, Светильник…) and stays brandless. */
  const IMPORT_BRANDS = ['Panasonic', 'Karreplus', 'Karre', 'Oydin', 'Tess', 'Rova', 'Touran',
    'Linnera', 'Viko', 'Вико', 'Gewiss', 'Elburg', 'Asfora', 'Arkedia', 'Palmiye', 'Nilson',
    'Carmen', 'Simon', 'Gamma', 'Novella', 'Vera', 'Alegra', 'Flash', 'Vents', 'Plus',
    'Makel', 'Legrand', 'Schneider', 'IEK', 'EKF', 'TDM', 'Feron', 'Gauss', 'Citilux',
    'Denkirs', 'Arte', 'Werkel', 'ABB', 'Lezard', 'Volpe', 'Horoz', 'Pelsan', 'Chint',
    'Hager', 'Osram', 'Philips', 'Camelion', 'Lin'];

  function guessBrand(name) {
    const n = String(name).trim().replace(/^["'«»]+/, '').toLowerCase();
    for (const b of IMPORT_BRANDS) {
      const bl = b.toLowerCase();
      if (n === bl || n.startsWith(bl + ' ') || n.startsWith(bl + '-') || n.startsWith(bl + '_')) return b;
    }
    return '';
  }

  /* Pull product rows out of the first worksheet.
     Returns [{ name, stock, cost, price }] with prices already in so'm. */
  function rowsFromSheet(wb) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (!grid.length) return [];

    /* find the header row ("Номенклатура" in the 1C export, or similar) */
    let head = 0;
    for (let i = 0; i < Math.min(grid.length, 10); i++) {
      const a = String((grid[i] || [])[0] || '').toLowerCase();
      if (/номенклатура|товар|наименование|nomen|mahsulot|tovar|product/.test(a)) { head = i + 1; break; }
    }
    /* column positions: fall back to the 1C layout A / D / E / F */
    const col = { name: 0, qty: 3, sale: 4, buy: 5, min: -1 };
    if (head > 0) {
      const h = grid[head - 1].map(c => String(c).toLowerCase().trim());
      const find = (re, dflt) => { const i = h.findIndex(c => re.test(c)); return i < 0 ? dflt : i; };
      /* anchored: "Минимальный остаток" must not win over plain "Остаток" */
      col.qty  = find(/^остаток$|^qoldiq|^stock$|^qty$|^remainder$/, 3);
      col.sale = find(/sotuv|sale|продаж|retail/, 4);
      col.buy  = find(/xarid|buy|закуп|purchase|cost/, 5);
      col.min  = find(/минимальн|minimum|^min$/, -1);
    }

    const out = [];
    for (let i = head; i < grid.length; i++) {
      const r = grid[i] || [];
      const name = String(r[col.name] || '').trim();
      if (!name) continue;
      const rawQty = r[col.qty];
      const stock = (rawQty === '' || rawQty === null || rawQty === undefined)
        ? 0 : Math.trunc(Number(rawQty) || 0);
      const sale = parsePriceCell(r[col.sale]);
      const buy = parsePriceCell(r[col.buy]);
      const min = col.min >= 0 ? (Math.trunc(Number(r[col.min])) || 0) : 0;
      out.push({
        name,
        stock,
        min: Math.max(0, min),
        price: sale !== null ? sale : (buy || 0),
        cost: buy !== null ? buy : (sale || 0)
      });
    }
    return out;
  }

  /* Adds the "import from file" block on top of the Add product modal. */
  function attachImport(m) {
    const body = m.dialog.querySelector('.ui-dialog__body');
    const grid = m.dialog.querySelector('.ui-grid');
    if (!body || !grid) return;

    const zone = document.createElement('div');
    zone.className = 'import-zone';
    zone.innerHTML = `
      <div class="import-zone__head">
        <b>Import from file</b>
        <span>Excel (.xlsx, .xls) or CSV — columns: Name · Stock · Sale price · Buy price. Prices are read as so'm (UZS) and shown as plain numbers.</span>
      </div>
      <div class="import-zone__row">
        <input type="file" id="import-file" accept=".xlsx,.xls,.csv" hidden>
        <label for="import-file" class="btn btn--ghost import-zone__pick">Choose file…</label>
        <span class="import-zone__file" data-file>No file chosen</span>
      </div>
      <div class="import-zone__summary" data-summary hidden></div>
      <div class="import-zone__or"><span>or add one product manually below</span></div>`;
    body.insertBefore(zone, grid);

    const input = zone.querySelector('#import-file');
    const fileEl = zone.querySelector('[data-file]');
    const sumEl = zone.querySelector('[data-summary]');

    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) return;
      fileEl.textContent = f.name;
      sumEl.hidden = false;

      if (typeof XLSX === 'undefined') {
        sumEl.innerHTML = '<span class="import-zone__err">The spreadsheet reader (xlsx.full.min.js) is not loaded on this page.</span>';
        return;
      }
      sumEl.innerHTML = '<span class="import-zone__busy">Reading file…</span>';

      const reader = new FileReader();
      reader.onerror = () => { sumEl.innerHTML = '<span class="import-zone__err">Could not read the file.</span>'; };
      reader.onload = () => {
        let items;
        try {
          const wb = XLSX.read(reader.result, { type: 'array' });
          items = rowsFromSheet(wb);
        } catch (err) {
          console.error(err);
          sumEl.innerHTML = '<span class="import-zone__err">Could not parse this file. Make sure it is an .xlsx, .xls or .csv export.</span>';
          return;
        }
        if (!items.length) {
          sumEl.innerHTML = '<span class="import-zone__err">No product rows found. Expected columns: Name · Stock · Sale price · Buy price.</span>';
          return;
        }

        const withPrice = items.filter(x => x.price > 0).length;
        const inStock = items.filter(x => x.stock > 0).length;
        const outStock = items.length - inStock;
        sumEl.innerHTML = `
          <div class="import-zone__stats">
            <span><b>${n0(items.length)}</b> products found</span>
            <span><b>${n0(withPrice)}</b> with a price</span>
            <span><b>${n0(inStock)}</b> in stock</span>
            <span><b>${n0(outStock)}</b> out of stock</span>
          </div>
          <div class="import-zone__go">
            <button type="button" class="btn btn--blue" data-do-import>Import ${n0(items.length)} products</button>
          </div>
          <small>They land in <b>Row 13 — Electrical &amp; Lighting</b> under the “File import” supplier. Nothing is uploaded — the file is read in this browser only.</small>`;

        sumEl.querySelector('[data-do-import]').addEventListener('click', (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Importing…';
          /* let the button paint before the heavy insert + re-render */
          setTimeout(() => {
            const n = Store.importProducts(items.map((x, i) => ({
              name: x.name,
              brand: guessBrand(x.name),
              cat: 'electrical',
              sup: 'IM',
              row: 13,
              shelf: (i % 5) + 1,
              stock: x.stock,
              reorder: x.min || 0,
              cost: x.cost,
              price: x.price,
              sd: 0,
              sold30: 0,
              desc: ''
            })));
            m.close();
            UI.toast(n0(n) + ' products imported from ' + f.name, 'ok');
          }, 30);
        });
      };
      reader.readAsArrayBuffer(f);
    });
  }

  /* After a merge frees a spot (row + shelf), offer to move another product
     into it. The moved product's old spot becomes free in turn. */
  function placeInSpot(spot) {
    UI.modal({
      title: 'Row ' + spot.row + ', Shelf ' + spot.shelf + ' ga joylashtirish',
      subtitle: 'Tanlangan mahsulot shu joyga ko‘chadi — eski joyi bo‘shab qoladi',
      fields: [{
        key: 'pick', label: 'Mahsulot', type: 'datalist', required: true,
        placeholder: 'Nom yoki SKU yozib qidiring…',
        options: PRODUCTS
          .filter(x => !(x.row === spot.row && x.shelf === spot.shelf))
          .map(x => ({
            value: x.id + ' — ' + x.name,
            label: 'hozir: Row ' + x.row + ', Shelf ' + x.shelf + ' · ' + n0(x.stock) + ' dona'
          }))
      }],
      submitLabel: 'Joylashtirish',
      onSubmit(d) {
        const sku = String(d.pick).split(' — ')[0].trim();
        const p2 = Store.productById(sku);
        if (!p2) { UI.toast('Mahsulot topilmadi — ro‘yxatdan tanlang', 'warn'); return false; }
        const from = 'Row ' + p2.row + ', Shelf ' + p2.shelf;
        Store.updateProduct(p2.id, { row: spot.row, shelf: spot.shelf });
        UI.toast(p2.name + ' ko‘chirildi: ' + from + ' → Row ' + spot.row + ', Shelf ' + spot.shelf, 'ok');
      }
    });
  }

  /* ---------------- the actions ---------------- */
  const ACTIONS = {

    'add-product'() {
      const m = UI.modal({
        title: 'Add product',
        subtitle: 'Import a whole file, or create one catalogue line by hand',
        fields: productFields(true),
        values: { row: 1, shelf: 1, stock: 0, cap: 20, reorder: 5, cost: 0, price: 0, sd: 0, sold30: 0 },
        submitLabel: 'Add product',
        onSubmit(d) {
          const p = Store.addProduct(d);
          UI.toast(p.name + ' added as ' + p.id, 'ok');
        }
      });
      attachImport(m);
    },

    'edit-product'(btn) {
      const p = Store.productById(btn.dataset.id);
      if (!p) return;
      UI.modal({
        title: 'Edit product',
        subtitle: p.id + ' \u00b7 ' + locName(LOCATIONS.find(l => l.row === p.row)),
        fields: productFields(true),
        values: productValues(p),
        onSubmit(d) {
          Store.updateProduct(p.id, d);
          UI.toast(p.name + ' updated', 'ok');
        }
      });
    },

    'copy-product'(btn) {
      const p = Store.productById(btn.dataset.id);
      if (!p) return;
      UI.confirm({
        title: 'Duplicate this product?',
        message: 'Creates a second, independent catalogue line for ' + p.name + '.',
        detail: p.id + ' \u00b7 ' + p.stock + ' units \u00b7 ' + money(p.cost) + ' cost',
        confirmLabel: 'Duplicate product'
      }).then(ok => {
        if (!ok) return;
        const copy = Store.addProduct({ ...productValues(p), name: p.name + ' (copy)' });
        UI.toast('Duplicated as ' + copy.id, 'ok');
      });
    },
    'delete-product'(btn) {
      const p = Store.productById(btn.dataset.id);
      if (!p) return;
      UI.confirm({
        title: 'Delete this product?',
        message: p.name + ' will be removed from the catalogue along with its stock record.',
        detail: p.id + ' &middot; ' + p.stock + ' units &middot; ' + money(p.stock * p.cost) + ' at cost',
        confirmLabel: 'Delete product',
        danger: true
      }).then(ok => {
        if (!ok) return;
        const back = { ...p };
        Store.deleteProduct(p.id);
        UI.toast(p.name + ' deleted', 'warn', {
          label: 'Undo',
          onClick: () => { Store.addProduct(back); UI.toast('Restored ' + back.name, 'ok'); }
        });
      });
    },

    'add-record'() {
      if (!PRODUCTS.length) return UI.toast('No products to stock yet', 'warn');
      UI.modal({
        title: 'Add stock record',
        subtitle: 'Stock a product into a location',
        fields: recordFields(),
        values: { productId: PRODUCTS[0].id, locationId: LOCATIONS[0].id, qty: 0, min: 0, reorder: 0 },
        submitLabel: 'Add record',
        onSubmit(d) {
          const rec = Store.addRecord(d);
          if (rec) UI.toast((rec.product ? rec.product.name : 'Record') + ' stocked into ' + locName(rec.location), 'ok');
        }
      });
    },

    'restock'(btn) {
      const r = Store.recordById(btn.dataset.id);
      if (!r) return;
      const p = r.product;
      UI.modal({
        title: 'Record a delivery',
        subtitle: (p ? p.name : r.id) + ' at ' + locName(r.location),
        fields: [
          { key: 'qty', label: 'Units on hand now', type: 'number', min: 0, required: true, half: true },
          { key: 'min', label: 'Minimum level', type: 'number', min: 0, required: true, half: true },
          { key: 'reorder', label: 'Reorder quantity', type: 'number', min: 0, required: true, half: true },
          { key: 'cap',  label: 'Shelf capacity', type: 'number', min: 1, required: true, half: true,
            hint: p ? 'Currently ' + p.cap : '' }
        ],
        values: { qty: r.qty, min: r.min, reorder: r.reorder, cap: p ? p.cap : 20 },
        submitLabel: 'Save delivery',
        onSubmit(d) {
          Store.updateRecord(r.id, { qty: d.qty, min: d.min, reorder: d.reorder, datestamp: true });
          if (p) Store.updateProduct(p.id, { cap: d.cap });
          UI.toast('Delivery recorded for ' + (p ? p.name : r.id), 'ok');
        }
      });
    },

    'copy-record'(btn) {
      const r = Store.recordById(btn.dataset.id);
      if (!r) return;
      const others = LOCATIONS.filter(l => l.id !== r.locationId);
      if (!others.length) return UI.toast('No other location to copy into', 'warn');
      UI.modal({
        title: 'Copy stock to another location',
        subtitle: (r.product ? r.product.name : r.id) + ' is at ' + locName(r.location),
        fields: [
          { key: 'to', label: 'Copy into', type: 'select', required: true,
            options: others.map(l => ({ value: l.id, label: l.name })) },
          { key: 'qty', label: 'Units to copy', type: 'number', min: 1, max: r.qty, required: true,
            hint: 'Up to ' + r.qty + ' currently on hand' }
        ],
        values: { to: others[0].id, qty: Math.max(1, Math.round(r.qty / 2)) },
        submitLabel: 'Copy stock',
        onSubmit(d) {
          const made = Store.copyRecord(r.id, d.to, d.qty);
          if (!made) UI.toast('Could not copy to that location', 'err');
          else UI.toast(d.qty + ' units copied to ' + locName(made.location), 'ok');
        }
      });
    },

    'merge-record'(btn) {
      const productId = btn.dataset.id;
      const fromLocId = btn.dataset.loc;
      const p = Store.productById(productId);
      const src = STOCK.find(x => x.id === productId && x.locationId === fromLocId);
      if (!p || !src) return;
      const others = STOCK.filter(x => x.id === productId && x.locationId !== fromLocId);
      if (!others.length) { UI.toast('Bu mahsulot faqat bitta joyda', 'warn'); return; }

      UI.modal({
        title: 'Birlashtirish',
        subtitle: p.name,
        intro: '<b>' + esc(locName(src.location)) + '</b> dagi <b>' + n0(src.qty) + '</b> dona tanlangan joyga qo‘shiladi — bu yozuv o‘chib, joy bo‘shaydi.',
        fields: [{
          key: 'to', label: 'Qaysi joyga birlashtirasiz?', type: 'select', required: true,
          options: others.map(o => ({ value: o.locationId, label: locName(o.location) + ' — ' + n0(o.qty) + ' dona' }))
        }],
        submitLabel: 'Birlashtirish',
        onSubmit(d) {
          const res = Store.mergeRecord(productId, fromLocId, d.to);
          if (!res) { UI.toast('Birlashtirib bo‘lmadi', 'warn'); return false; }
          const spot = 'Row ' + res.freed.row + ', Shelf ' + res.freed.shelf;
          UI.toast(n0(res.moved) + ' dona birlashtirildi — ' + spot + ' bo‘shadi', 'ok', {
            label: 'Undo',
            onClick() {
              Store.unmergeRecord(productId, res.to, res.moved, res.snapshot);
              UI.toast('Birlashtirish bekor qilindi', 'ok');
            }
          });
          /* freed spot → offer to place another product there */
          UI.confirm({
            title: 'Yangi mahsulot joylashtirish',
            message: spot + ' bo‘shadi. Shu yerga boshqa mahsulot ko‘chirasizmi?',
            detail: 'Ko‘chirilgan mahsulotning eski joyi ham bo‘shab qoladi.',
            confirmLabel: 'Mahsulot tanlash'
          }).then(ok => { if (ok) placeInSpot(res.freed); });
        }
      });
    },

    'edit-record'(btn) {
      const r = Store.recordById(btn.dataset.id);
      if (!r) return;
      UI.modal({
        title: 'Edit stock record',
        subtitle: r.id + ' at ' + locName(r.location),
        fields: recordFields(),
        values: { productId: r.id, locationId: r.locationId, qty: r.qty, min: r.min, reorder: r.reorder },
        onSubmit(d) {
          Store.updateRecord(r.id, d);
          UI.toast('Stock record updated', 'ok');
        }
      });
    },

    'delete-record'(btn) {
      const r = Store.recordById(btn.dataset.id);
      if (!r) return;
      UI.confirm({
        title: 'Delete this stock record?',
        message: (r.product ? r.product.name : r.id) + ' will be removed from ' + locName(r.location) + '.',
        detail: r.qty + ' units on hand &middot; minimum ' + r.min,
        confirmLabel: 'Delete record',
        danger: true
      }).then(ok => {
        if (!ok) return;
        const name = r.product ? r.product.name : r.id;
        Store.deleteRecord(r.id);
        UI.toast(name + ' removed from stock', 'warn');
      });
    },

    'add-location'() {
      UI.modal({
        title: 'Add location',
        subtitle: 'A new aisle or storage area',
        fields: [
          { key: 'name',     label: 'Name', required: true, placeholder: 'Row 13 \u2014 Seasonal' },
          { key: 'row',      label: 'Row number', type: 'number', min: 1, max: 99, required: true },
          { key: 'capacity', label: 'Unit capacity', type: 'number', min: 1, required: true },
          { key: 'zone',     label: 'Where in the shop', placeholder: 'Back wall, far end' },
          { key: 'contact',  label: 'Responsible person' },
          { key: 'email',    label: 'Email', type: 'email' },
          { key: 'phone',    label: 'Phone', placeholder: '+1 (555) 000-0000' }
        ],
        values: { row: LOCATIONS.filter(l => !l.reserve).length + 1, capacity: 1000 },
        submitLabel: 'Add location',
        onSubmit(d) {
          const l = Store.addLocation(d);
          UI.toast(l.name + ' added', 'ok');
        }
      });
    },

    'edit-location'(btn) {
      const l = Store.locationById(btn.dataset.id);
      if (!l) return;
      UI.modal({
        title: 'Edit location',
        subtitle: l.id,
        fields: [
          { key: 'name',     label: 'Name', required: true },
          { key: 'zone',     label: 'Where in the shop' },
          { key: 'contact',  label: 'Responsible person' },
          { key: 'email',    label: 'Email', type: 'email' },
          { key: 'phone',    label: 'Phone' },
          { key: 'capacity', label: 'Unit capacity', type: 'number', min: 1, required: true }
        ],
        values: { name: l.name, zone: l.zone, contact: l.contact, email: l.email, phone: l.phone, capacity: l.capacity },
        onSubmit(d) { Store.updateLocation(l.id, d); UI.toast(l.name + ' updated', 'ok'); }
      });
    },

    'delete-location'(btn) {
      const l = Store.locationById(btn.dataset.id);
      if (!l) return;
      UI.confirm({
        title: 'Delete this location?',
        message: l.name + ' will be removed. Any stock filed there moves to Row 1 so nothing is orphaned.',
        detail: skusAt(l.id) + ' SKUs &middot; ' + n0(unitsAt(l.id)) + ' units &middot; capacity ' + n0(l.capacity),
        confirmLabel: 'Delete location',
        danger: true
      }).then(ok => {
        if (!ok) return;
        Store.deleteLocation(l.id);
        UI.toast(l.name + ' deleted', 'warn');
      });
    },

    'new-transfer'() {
      if (!PRODUCTS.length) return UI.toast('Nothing in stock to move', 'warn');
      UI.modal({
        title: 'New transfer',
        subtitle: 'Move units between locations and log it',
        fields: [
          { key: 'productId', label: 'Product', type: 'select', required: true,
            options: PRODUCTS.map(p => ({ value: p.id, label: p.name })) },
          { key: 'from', label: 'From', type: 'select', required: true,
            options: LOCATIONS.map(l => ({ value: l.id, label: l.name })) },
          { key: 'to',   label: 'To',   type: 'select', required: true,
            options: LOCATIONS.map(l => ({ value: l.id, label: l.name })) },
          { key: 'qty',   label: 'Quantity', type: 'number', min: 1, required: true },
          { key: 'notes', label: 'Notes', placeholder: 'Why are you moving it?' }
        ],
        values: { productId: PRODUCTS[0].id, from: LOCATIONS[0].id,
                  to: (LOCATIONS[1] || LOCATIONS[0]).id, qty: 1 },
        submitLabel: 'Move stock',
        onSubmit(d) {
          if (d.from === d.to) { UI.toast('Pick two different locations', 'err'); return false; }
          const t = Store.addTransfer(d);
          if (!t) { UI.toast('Not enough stock at that location', 'err'); return false; }
          UI.toast(t.qty + ' units moved \u00b7 ' + t.id, 'ok');
        }
      });
    },

    'export-waste'() {
      const expired  = STOCK.filter(r => isExpired(r.product));
      const expiring = STOCK.filter(r => expiryStatus(r.product) === 'soon');
      const lazy     = STOCK.filter(r => isSlow(r.product) || isDead(r.product));
      UI.downloadCsv('waste-and-deadstock.csv', [
        ['Waste & dead stock report'],
        ['Generated', new Date().toLocaleString('en-GB')],
        [],
        ['EXPIRED LINES'],
        ['Product', 'SKU', 'Location', 'Units', 'Value at cost', 'Supplier'],
        ...expired.map(r => [r.product.name, r.product.id, locName(r.location), r.qty,
          (r.qty * r.product.cost).toFixed(2), SUPPLIERS[r.product.sup] || r.product.sup]),
        [],
        ['EXPIRING WITHIN 3 DAYS'],
        ['Product', 'SKU', 'Location', 'Units', 'Days left'],
        ...expiring.map(r => [r.product.name, r.product.id, locName(r.location), r.qty, daysToExpiry(r.product)]),
        [],
        ['SLOW MOVING & DEAD STOCK'],
        ['Product', 'SKU', 'Location', 'Units', 'Sold 30d', 'Value tied up'],
        ...lazy.map(r => [r.product.name, r.product.id, locName(r.location), r.qty, r.product.sold30,
          (r.qty * r.product.cost).toFixed(2)])
      ]);
    },

    'export-report'(btn) {
      const what = btn.dataset.what || 'stock';
      const rows = what === 'stock'
        ? [['Product', 'SKU', 'Category', 'Location', 'Qty', 'Min', 'Reorder', 'Status', 'Cost', 'Price'],
           ...STOCK.map(r => [r.product.name, r.product.id, (CAT[r.product.cat] || {}).name || '',
             locName(r.location), r.qty, r.min, r.reorder, STATUS_LABEL[statusOf(r)],
             r.product.cost.toFixed(2), r.product.price.toFixed(2)])]
        : [['Location', 'SKUs', 'Units', 'Capacity', 'Utilization %', 'Stock value'],
           ...LOCATIONS.map(l => [l.name, skusAt(l.id), unitsAt(l.id), l.capacity,
             pct(unitsAt(l.id), l.capacity).toFixed(1), valueAt(l.id).toFixed(2)])];
      UI.downloadCsv(what + '-report.csv', rows);
    },

    'export-order'() {
      const lows = STOCK.filter(r => r.qty <= r.min);
      if (!lows.length) { UI.toast('Nothing to order', 'warn'); return; }
      const bySup = {};
      lows.forEach(r => { (bySup[r.product.sup] = bySup[r.product.sup] || []).push(r); });
      const rows = [['Purchase order sheet'], ['Generated', new Date().toLocaleString('en-GB')], []];
      Object.entries(bySup).forEach(([code, list]) => {
        rows.push(['SUPPLIER', SUPPLIERS[code] || code]);
        rows.push(['Product', 'SKU', 'Location', 'On hand', 'Min', 'Order qty', 'Unit cost', 'Line cost']);
        list.forEach(r => {
          const order = Math.max(r.reorder - r.qty, 0);
          rows.push([r.product.name, r.product.id, locName(r.location), r.qty, r.min,
                     order, r.product.cost.toFixed(2), (order * r.product.cost).toFixed(2)]);
        });
        const units = list.reduce((a, r) => a + Math.max(r.reorder - r.qty, 0), 0);
        const cost = list.reduce((a, r) => a + Math.max(r.reorder - r.qty, 0) * r.product.cost, 0);
        rows.push(['Subtotal', '', '', '', '', units, '', cost.toFixed(2)]);
        rows.push([]);
      });
      UI.downloadCsv('purchase-order.csv', rows);
    },
    'reset-demo'() {
      UI.confirm({
        title: 'Reset demo data?',
        message: 'Every product, stock record, location and transfer you have edited will be discarded and the original figures restored.',
        confirmLabel: 'Reset everything',
        danger: true
      }).then(ok => {
        if (ok) { Store.reset(); UI.toast('Demo data reset', 'ok'); }
      });
    },

    'view-alerts'() { location.href = 'stock.html?flag=low'; }
  };

  document.addEventListener('DOMContentLoaded', () => {
    /* hydrate any saved edits before the first paint */
    Store.load();
    Store.onChange(() => repaint.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }));

    initGlobal();
    initDashboard();
    initLocations();
    initProducts();
    initStock();
    initTransfers();
    initReports();
    initExpiry();
    initLowStock();
    initInventory();

    /* first paint: bring every counter and meter to life wherever they are */
    rollAll(document);
    fillMeters(document);
  });
})();
