/* =============================================================
   Store — mutable state + persistence
   The demo has no backend, so edits live in localStorage and are
   merged into the arrays from data.js on load.
   ============================================================= */
const Store = (function () {
  'use strict';

  const KEY = 'stock-manager-state-v2';
  /* the demo is pinned to a fixed date, so new records must use it too,
     otherwise a fresh delivery would land years in the future */
  const now = () => new Date(TODAY.getTime());
  const listeners = [];

  /* ---------------- persistence ---------------- */
  function snapshot() {
    return {
      products:   PRODUCTS.map(p => ({ ...p })),
      records:    STOCK.map(r => ({
        id: r.id, productId: r.product.id, locationId: r.location.id,
        qty: r.qty, min: r.min, reorder: r.reorder,
        reserveQty: r.reserveQty,
        reserveLocationId: r.reserveLocation ? r.reserveLocation.id : null,
        lastRestock: r.lastRestock.toISOString()
      })),
      locations:  LOCATIONS.map(l => ({ ...l })),
      transfers:  TRANSFERS.map(t => ({ ...t, date: t.date.toISOString() })),
      inventories: INVENTORIES.map(s => ({ ...s, date: s.date.toISOString() }))
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function hasSaved() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  /** Hydrate from localStorage if there is anything saved, then relink either
      way — the shipped data.js records carry `location` but no `locationId`. */
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}

    if (!raw) { relink(); return false; }

    let s;
    try { s = JSON.parse(raw); } catch (e) { clear(); relink(); return false; }
    if (!s || !Array.isArray(s.products) || !Array.isArray(s.records)) { clear(); relink(); return false; }

    LOCATIONS.splice(0, LOCATIONS.length, ...s.locations);
    PRODUCTS.splice(0, PRODUCTS.length, ...s.products);
    STOCK.splice(0, STOCK.length, ...s.records.map(r => {
      /* older saves (and the shipped data.js) may lack locationId — fall back
         to the aisle the product is filed in so the record stays findable */
      let locId = r.locationId;
      if (!locId) {
        const pr = s.products.find(p => p.id === (r.productId || r.id));
        if (pr) {
          const home = s.locations.find(l => l.row === pr.row);
          if (home) locId = home.id;
        }
      }
      return {
        id: r.id, productId: r.productId, locationId: locId,
        product: null, location: null, reserveLocation: null,
        qty: r.qty, min: r.min, reorder: r.reorder,
        reserveQty: r.reserveQty || 0,
        reserveLocationId: r.reserveLocationId || null,
        lastRestock: new Date(r.lastRestock)
      };
    }));
    if (Array.isArray(s.transfers)) {
      TRANSFERS.splice(0, TRANSFERS.length, ...s.transfers.map(t => ({ ...t, date: new Date(t.date) })));
    }
    if (Array.isArray(s.inventories)) {
      INVENTORIES.splice(0, INVENTORIES.length, ...s.inventories.map(x => ({ ...x, date: new Date(x.date) })));
    }
    relink();
    return true;
  }

  /** Re-point the object references and rebuild the id lookups.
      Records built in data.js carry `location` but not `locationId`, so
      derive it here — everything else filters on the id. */
  function relink() {
    const byIdLoc = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));

    /* dates come back from JSON as strings — revive them */
    PRODUCTS.forEach(p => {
      if (p.lastRestock && !(p.lastRestock instanceof Date)) p.lastRestock = new Date(p.lastRestock);
      if (p.expires) {
        if (!(p.expires instanceof Date)) p.expires = new Date(p.expires);
      } else if (p.sd > 0 && p.lastRestock) {
        p.expires = new Date(p.lastRestock.getTime() + p.sd * 864e5);
      }
      if (typeof p.sold30 !== 'number') p.sold30 = 0;
    });
    TRANSFERS.forEach(t => { if (!(t.date instanceof Date)) t.date = new Date(t.date); });

    STOCK.forEach(r => {
      if (!r.product) {
        r.product = PRODUCTS.find(p => p.id === (r.productId || r.id)) || null;
      }
      if (r.product && !r.productId) r.productId = r.product.id;

      /* id wins; otherwise take it from the object we already hold */
      if (!r.locationId && r.location) r.locationId = r.location.id;
      if (!r.location) r.location = byIdLoc[r.locationId] || LOCATIONS[0];
      if (!r.locationId) r.locationId = r.location.id;

      if (!r.reserveLocationId && r.reserveLocation) r.reserveLocationId = r.reserveLocation.id;
      r.reserveLocation = r.reserveLocationId ? (byIdLoc[r.reserveLocationId] || null) : null;

      if (typeof r.reserveQty !== 'number') r.reserveQty = 0;
      if (!(r.lastRestock instanceof Date)) r.lastRestock = new Date(r.lastRestock || TODAY.getTime());
    });
  }

  /* ---------------- lookups ---------------- */
  const productById  = (id) => PRODUCTS.find(p => p.id === id) || null;
  const locationById = (id) => LOCATIONS.find(l => l.id === id) || null;
  const recordById   = (id) => STOCK.find(r => r.id === id) || null;
  const recordsFor   = (productId) => STOCK.filter(r => r.id === productId);

  function nextProductId() {
    let max = 0;
    PRODUCTS.forEach(p => {
      const n = parseInt(String(p.id).replace(/\D/g, ''), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return 'SKU-' + String(max + 1).padStart(4, '0');
  }

  function nextLocationId() {
    let max = 0;
    LOCATIONS.forEach(l => {
      const n = parseInt(String(l.id).replace(/\D/g, ''), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return 'L' + String(max + 1).padStart(2, '0');
  }

  function nextTransferId() {
    let max = 1040;
    TRANSFERS.forEach(t => {
      const n = parseInt(String(t.id).replace(/\D/g, ''), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return 'TR-' + (max + 1);
  }

  /* ---------------- change notification ---------------- */
  function onChange(fn) { listeners.push(fn); }
  function emit() { save(); listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

  /* ---------------- products ---------------- */
  function addProduct(d) {
    const id = d.id || nextProductId();
    const sd = Number(d.sd) || 0;
    const shelf = Math.max(1, Math.min(5, Number(d.shelf) || 1));
    const row = Number(d.row) || 0;
    const loc = LOCATIONS.find(l => l.row === row) || LOCATIONS[0];

    const p = {
      id, barcode: '50' + id.replace(/\D/g, '').padStart(11, '0'),
      name: d.name, brand: d.brand, cat: d.cat, desc: d.desc || '',
      row: loc.row, shelf,
      stock: Number(d.stock) || 0,
      cap:   Number(d.cap)   || Math.max(1, Number(d.stock) || 1),
      reorder: Number(d.reorder) || 0,
      cost: Number(d.cost) || 0,
      price: Number(d.price) || 0,
      sup: d.sup || Object.keys(SUPPLIERS)[0],
      sd,
      sold30: Number(d.sold30) || 0
    };

    /* keep the derived dates consistent with the new shelf life */
    const age = sd > 0 ? Math.round(sd * 0.4) : 7;
    p.lastRestock = new Date(TODAY.getTime() - age * 864e5);
    p.expires = sd > 0 ? new Date(p.lastRestock.getTime() + sd * 864e5) : null;

    PRODUCTS.push(p);
    STOCK.push({
      id: p.id, product: p, productId: p.id,
      location: loc, locationId: loc.id,
      qty: p.stock, min: p.reorder, reorder: Math.max(p.cap - p.stock, p.reorder),
      reserveQty: 0, reserveLocationId: null, reserveLocation: null,
      lastRestock: p.lastRestock
    });
    relink();
    emit();
    return p;
  }

  function updateProduct(id, d) {
    const p = productById(id);
    if (!p) return null;
    const sd = d.sd !== undefined ? (Number(d.sd) || 0) : p.sd;

    if (d.name !== undefined) p.name = d.name;
    if (d.brand !== undefined) p.brand = d.brand;
    if (d.cat !== undefined) p.cat = d.cat;
    if (d.desc !== undefined) p.desc = d.desc;
    if (d.cost !== undefined) p.cost = Number(d.cost) || 0;
    if (d.price !== undefined) p.price = Number(d.price) || 0;
    if (d.sup !== undefined) p.sup = d.sup;
    if (d.cap !== undefined) p.cap = Number(d.cap) || 0;
    if (d.sd !== undefined) {
      p.sd = sd;
      p.lastRestock = new Date(TODAY.getTime() - (sd > 0 ? Math.round(sd * 0.4) : 7) * 864e5);
      p.expires = sd > 0 ? new Date(p.lastRestock.getTime() + sd * 864e5) : null;
    }

    /* moving the product physically moves its stock record */
    if (d.row !== undefined) {
      const row = Number(d.row);
      const loc = LOCATIONS.find(l => l.row === row) || null;
      if (loc) { p.row = loc.row; const r = recordById(id); if (r) { r.location = loc; r.locationId = loc.id; } }
    }
    if (d.shelf !== undefined) p.shelf = Math.max(1, Math.min(5, Number(d.shelf) || 1));
    if (d.stock !== undefined) {
      const n = Math.max(0, Number(d.stock) || 0);
      p.stock = n;
      const r = recordById(id);
      if (r) { r.qty = n; r.reorder = Math.max(p.cap - n, r.min); }
    }
    if (d.reorder !== undefined) {
      const n = Math.max(0, Number(d.reorder) || 0);
      p.reorder = n;
      const r = recordById(id);
      if (r) r.min = n;
    }
    if (d.sold30 !== undefined) p.sold30 = Math.max(0, Number(d.sold30) || 0);

    emit();
    return p;
  }

  function deleteProduct(id) {
    const i = PRODUCTS.findIndex(p => p.id === id);
    if (i < 0) return false;
    PRODUCTS.splice(i, 1);
    for (let k = STOCK.length - 1; k >= 0; k--) if (STOCK[k].id === id) STOCK.splice(k, 1);
    relink();
    emit();
    return true;
  }

  /* ---------------- bulk import (Excel / CSV) ---------------- */
  /** Add many catalogue lines in one pass — one relink, one save.
      Each item: { name, brand, cat, sup, row, shelf, stock, cost, price, desc, sd, sold30 } */
  function importProducts(items) {
    if (!Array.isArray(items) || !items.length) return 0;

    /* grab the id counter once — nextProductId() per line would be O(n²) */
    let max = 0;
    PRODUCTS.forEach(p => {
      const n = parseInt(String(p.id).replace(/\D/g, ''), 10);
      if (isFinite(n) && n > max) max = n;
    });

    const fallbackLoc = LOCATIONS.find(l => !l.reserve) || LOCATIONS[0];
    let added = 0;
    items.forEach(d => {
      const name = String(d.name || '').trim();
      if (!name) return;

      const id = 'SKU-' + String(++max).padStart(4, '0');
      const loc = LOCATIONS.find(l => !l.reserve && l.row === (Number(d.row) || 0)) || fallbackLoc;
      const stock = Math.trunc(Number(d.stock) || 0);
      const sd = Number(d.sd) || 0;
      const age = sd > 0 ? Math.round(sd * 0.4) : 7;

      const p = {
        id, barcode: '50' + id.replace(/\D/g, '').padStart(11, '0'),
        name, brand: d.brand || '', cat: d.cat, desc: d.desc || '',
        row: loc.row,
        shelf: Math.max(1, Math.min(5, Number(d.shelf) || ((added % 5) + 1))),
        stock,
        cap: Math.max(Number(d.cap) || 0, stock, 1),
        reorder: Math.max(0, Number(d.reorder) || 0),
        cost: Number(d.cost) || 0,
        price: Number(d.price) || 0,
        sup: d.sup || Object.keys(SUPPLIERS)[0],
        sd,
        sold30: Math.max(0, Number(d.sold30) || 0),
        lastRestock: new Date(TODAY.getTime() - age * 864e5),
        expires: null
      };
      p.expires = sd > 0 ? new Date(p.lastRestock.getTime() + sd * 864e5) : null;

      PRODUCTS.push(p);
      STOCK.push({
        id: p.id, product: p, productId: p.id,
        location: loc, locationId: loc.id,
        qty: p.stock, min: p.reorder, reorder: Math.max(p.cap - p.stock, p.reorder),
        reserveQty: 0, reserveLocationId: null, reserveLocation: null,
        lastRestock: p.lastRestock
      });
      added++;
    });

    relink();
    emit();
    return added;
  }

  /* ---------------- stock records ---------------- */
  function addRecord(d) {
    const p = productById(d.productId);
    const loc = locationById(d.locationId);
    if (!p || !loc) return null;

    const existing = STOCK.find(r => r.id === p.id && r.locationId === loc.id);
    if (existing) {                       /* a second record for the same pair would confuse things */
      existing.qty = Number(d.qty) || 0;
      existing.min = Number(d.min) || 0;
      existing.reorder = Number(d.reorder) || 0;
      existing.lastRestock = now();
      relink();
      emit();
      return existing;
    }

    const rec = {
      id: p.id, product: p, productId: p.id,
      location: loc, locationId: loc.id,
      qty: Number(d.qty) || 0,
      min: Number(d.min) || 0,
      reorder: Number(d.reorder) || 0,
      reserveQty: 0, reserveLocationId: null, reserveLocation: null,
      lastRestock: now()
    };
    STOCK.push(rec);

    /* the product's headline figures follow its home record */
    if (p.row === loc.row) { p.stock = rec.qty; }
    relink();
    emit();
    return rec;
  }

  function updateRecord(id, d) {
    const r = recordById(id);
    if (!r) return null;

    if (d.locationId !== undefined) {
      const loc = locationById(d.locationId);
      if (loc) { r.location = loc; r.locationId = loc.id; if (r.product && r.product.row !== loc.row) r.product.row = loc.row; }
    }
    if (d.qty !== undefined) r.qty = Math.max(0, Number(d.qty) || 0);
    if (d.min !== undefined) r.min = Math.max(0, Number(d.min) || 0);
    if (d.reorder !== undefined) r.reorder = Math.max(0, Number(d.reorder) || 0);
    if (d.datestamp !== undefined) r.lastRestock = now();

    if (r.product && r.product.row === r.locationId && LOCATIONS.some(l => l.id === r.locationId && l.row === r.product.row)) {
      r.product.stock = r.qty;
    }
    relink();
    emit();
    return r;
  }

  function deleteRecord(id) {
    const i = STOCK.findIndex(r => r.id === id);
    if (i < 0) return false;
    const gone = STOCK[i];
    STOCK.splice(i, 1);
    /* drop the product too if that was its only record */
    if (!STOCK.some(r => r.id === gone.id)) {
      const j = PRODUCTS.findIndex(p => p.id === gone.id);
      if (j >= 0) PRODUCTS.splice(j, 1);
    }
    relink();
    emit();
    return true;
  }

  /** "Copy" on a stock row = duplicate the line into another location. */
  function copyRecord(id, toLocationId, qty) {
    const src = recordById(id);
    const loc = locationById(toLocationId);
    if (!src || !loc) return null;
    if (src.locationId === loc.id) return null;

    const existing = STOCK.find(r => r.id === src.id && r.locationId === loc.id);
    if (existing) {
      existing.qty = Number(qty) || existing.qty;
      relink(); emit();
      return existing;
    }
    const rec = {
      id: src.id, product: src.product, productId: src.id,
      location: loc, locationId: loc.id,
      qty: Number(qty) || 0,
      min: src.min, reorder: src.reorder,
      reserveQty: 0, reserveLocationId: null, reserveLocation: null,
      lastRestock: now()
    };
    STOCK.push(rec);
    relink(); emit();
    return rec;
  }

  /* ---------------- locations ---------------- */
  function addLocation(d) {
    const l = {
      id: d.id || nextLocationId(),
      row: Number(d.row) || 0,
      name: d.name, zone: d.zone || '',
      contact: d.contact || '', email: d.email || '', phone: d.phone || '',
      capacity: Number(d.capacity) || 1000,
      created: d.created || now().toLocaleDateString('en-GB', { day:'numeric', month:'numeric', year:'numeric' }),
      reserve: !!d.reserve
    };
    LOCATIONS.push(l);
    emit();
    return l;
  }

  function updateLocation(id, d) {
    const l = locationById(id);
    if (!l) return null;
    if (d.name !== undefined) l.name = d.name;
    if (d.zone !== undefined) l.zone = d.zone;
    if (d.contact !== undefined) l.contact = d.contact;
    if (d.email !== undefined) l.email = d.email;
    if (d.phone !== undefined) l.phone = d.phone;
    if (d.capacity !== undefined) l.capacity = Math.max(0, Number(d.capacity) || 0);
    emit();
    return l;
  }

  function deleteLocation(id) {
    const i = LOCATIONS.findIndex(l => l.id === id);
    if (i < 0) return false;
    const gone = LOCATIONS[i];
    /* don't orphan stock: pull it back to the back room, or drop the record */
    STOCK.forEach(r => {
      if (r.locationId === id) { r.locationId = 'L01'; r.location = LOCATIONS.find(l => l.id === 'L01'); }
      if (r.reserveLocationId === id) { r.reserveLocationId = null; r.reserveLocation = null; }
    });
    LOCATIONS.splice(i, 1);
    relink();
    void gone;
    emit();
    return true;
  }

  /* ---------------- transfers ---------------- */
  /** Move units between locations and log it. Returns the transfer, or null. */
  function addTransfer(d) {
    const p = productById(d.productId);
    const from = locationById(d.from);
    const to   = locationById(d.to);
    const qty  = Math.max(0, Number(d.qty) || 0);
    if (!p || !from || !to || !qty || from.id === to.id) return null;

    /* take from the source */
    let src = STOCK.find(r => r.id === p.id && r.locationId === from.id);
    if (!src) {
      src = { id: p.id, product: p, productId: p.id, location: from, locationId: from.id,
              qty: 0, min: 0, reorder: 0, reserveQty: 0,
              reserveLocationId: null, reserveLocation: null, lastRestock: now() };
      STOCK.push(src);
    }
    const moved = Math.min(qty, src.qty);
    if (moved <= 0) return null;
    src.qty -= moved;

    /* add to the destination, creating the record if needed */
    let dst = STOCK.find(r => r.id === p.id && r.locationId === to.id);
    if (!dst) {
      dst = { id: p.id, product: p, productId: p.id, location: to, locationId: to.id,
              qty: 0, min: 0, reorder: 0, reserveQty: 0,
              reserveLocationId: null, reserveLocation: null, lastRestock: now() };
      STOCK.push(dst);
    }
    dst.qty += moved;
    dst.lastRestock = now();

    const t = {
      id: nextTransferId(),
      date: now(),
      product: p.name,
      from: from.id, to: to.id,
      qty: moved,
      status: 'completed',
      notes: d.notes || 'Stock transfer'
    };
    TRANSFERS.unshift(t);

    /* keep the product's headline stock in step with its home row */
    const home = STOCK.find(r => r.id === p.id && r.locationId && (locationById(r.locationId) || {}).row === p.row);
    if (home) p.stock = home.qty;

    relink();
    emit();
    return t;
  }

  function deleteTransfer(id) {
    const i = TRANSFERS.findIndex(t => t.id === id);
    if (i < 0) return false;
    TRANSFERS.splice(i, 1);
    emit();
    return true;
  }

  /* ---------------- consolidation (merge two spots of one product) ---------------- */
  /** Move every unit of a product from one location record into another and
      drop the emptied record — the low crate is merged into the fuller one,
      freeing its spot. Returns { moved, freed, snapshot, to } or null. */
  function mergeRecord(productId, fromLocationId, toLocationId) {
    const src = STOCK.find(r => r.id === productId && r.locationId === fromLocationId);
    const dst = STOCK.find(r => r.id === productId && r.locationId === toLocationId);
    const p = productById(productId);
    if (!src || !dst || !p || src === dst) return null;

    const snapshot = {
      locationId: src.locationId, qty: src.qty, min: src.min, reorder: src.reorder,
      wasHome: (locationById(src.locationId) || {}).row === p.row,
      shelf: p.shelf, row: p.row
    };
    const moved = src.qty;
    dst.qty += moved;
    dst.lastRestock = now();
    const freed = { row: (locationById(src.locationId) || {}).row, shelf: p.shelf };

    STOCK.splice(STOCK.indexOf(src), 1);

    /* the product must not keep pointing at the row it just left */
    if (snapshot.wasHome) {
      const toLoc = locationById(toLocationId);
      if (toLoc) p.row = toLoc.row;
    }
    const home = STOCK.find(r => r.id === p.id && (locationById(r.locationId) || {}).row === p.row);
    if (home) p.stock = home.qty;

    relink();
    emit();
    return { moved, freed, snapshot, to: toLocationId };
  }

  /** Undo mergeRecord(): restore the removed record, take the units back off. */
  function unmergeRecord(productId, toLocationId, qty, snap) {
    const dst = STOCK.find(r => r.id === productId && r.locationId === toLocationId);
    if (dst) dst.qty = Math.max(0, dst.qty - qty);
    const p = productById(productId);
    const loc = locationById(snap.locationId);
    if (p && loc) {
      let rec = STOCK.find(r => r.id === productId && r.locationId === loc.id);
      if (rec) {
        rec.qty += qty;
      } else {
        STOCK.push({
          id: p.id, product: p, productId: p.id,
          location: loc, locationId: loc.id,
          qty, min: snap.min, reorder: snap.reorder,
          reserveQty: 0, reserveLocationId: null, reserveLocation: null,
          lastRestock: now()
        });
      }
      if (snap.wasHome) { p.row = snap.row; p.shelf = snap.shelf; }
      const home = STOCK.find(r => r.id === p.id && (locationById(r.locationId) || {}).row === p.row);
      if (home) p.stock = home.qty;
    }
    relink();
    emit();
    return true;
  }

  /* ---------------- inventory (stock-take) ---------------- */
  function nextInventoryId() {
    let max = 0;
    INVENTORIES.forEach(s => {
      const n = parseInt(String(s.id).replace(/\D/g, ''), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return 'INV-' + String(max + 1).padStart(4, '0');
  }

  /** Archive a finished count. Lines keep the ORIGINAL system qty so the
      history shows what was found, even if the stock was later corrected. */
  function saveInventory(d) {
    const s = {
      id: nextInventoryId(),
      date: new Date(),                 /* audits belong to real wall-clock time */
      note: d.note || '',
      lines: d.lines || []
    };
    INVENTORIES.unshift(s);
    emit();
    return s;
  }

  function deleteInventory(id) {
    const i = INVENTORIES.findIndex(s => s.id === id);
    if (i < 0) return false;
    INVENTORIES.splice(i, 1);
    emit();
    return true;
  }

  /** Count says "47", system says "50" — set the record to the counted 47. */
  function applyInventoryCorrection(productId, qty) {
    const r = recordById(productId);
    if (!r) return null;
    const n = Math.max(0, Number(qty) || 0);
    r.qty = n;
    if (r.product) r.product.stock = n;
    relink();
    emit();
    return r;
  }

  /** Same correction for a whole sheet, but with a single save at the end. */
  function applyInventoryCorrections(lines) {
    let done = 0;
    (lines || []).forEach(l => {
      const r = recordById(l.productId);
      if (!r) return;
      const n = Math.max(0, Number(l.actual) || 0);
      if (r.qty !== n) {
        r.qty = n;
        if (r.product) r.product.stock = n;
        done++;
      }
    });
    relink();
    emit();
    return done;
  }

  /* ---------------- demo reset ---------------- */
  function reset() {
    clear();
    location.reload();
  }

  return {
    load, save, clear, hasSaved, reset, onChange, emit, relink,
    productById, locationById, recordById, recordsFor,
    nextProductId, nextLocationId, nextTransferId,
    addProduct, updateProduct, deleteProduct, importProducts,
    addRecord, updateRecord, deleteRecord, copyRecord,
    addLocation, updateLocation, deleteLocation,
    addTransfer, deleteTransfer,
    mergeRecord, unmergeRecord,
    saveInventory, deleteInventory,
    applyInventoryCorrection, applyInventoryCorrections
  };
})();
