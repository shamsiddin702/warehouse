/* =============================================================
   Auth — login gate (username + password)

   ⚠️  BU DEMO DARAJADAGI HIMOYA — faqat "eshik", qulf emas!
   Hamma narsa brauzerda ishlaydi, shuning uchun:
     - parol koddan ko'rinadi (o'zgartirish oson bo'lishi uchun)
     - birozdagi JavaScript o'chirsak kira oladi (F12 →
       Application → localStorage → kalitlarni o'chirish)
   Haqiqiy himoya uchun backend kerak bo'ladi.

   Foydalanuvchilar localStorage'da saqlanadi (kalit:
   'stock-manager-users-v1'). Birinchi ishga tushirishda
   USERS_SEED dagi asosiy hisoblar yoziladi.
   ============================================================= */

/* ---------- ASOSIY HISOBLAR (o'chirilmaydi, faqat seed) ---------- */
const USERS_SEED = {
  boss:   { pass: 'boss2026',   name: 'Boss',   role: 'Administrator' },
  ishchi: { pass: 'ishchi2026', name: 'Ishchi', role: 'Ishchi'        },
  kassa:  { pass: 'kassa2026',  name: 'Kassa',  role: 'Kassa'         }
};
/* --------------------------------------------------------------- */

/* Rollar: Administrator (boss) · Ishchi · Kassa (faqat sotish ekrani).
   Kassa rolidagi foydalanuvchi kirishi bilanoq kassa.html ga
   yo'naltiriladi va boshqa sahifalarga kira olmaydi. */

const AUTH_KEY   = 'stock-manager-auth-v1';
const USERS_KEY  = 'stock-manager-users-v1';

const Auth = (function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- users storage ---------- */
  function getUsers() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(USERS_KEY) || 'null'); } catch (e) {}
    const map = {};
    /* seed first so a reset browser still has the two master accounts */
    Object.assign(map, USERS_SEED);
    if (stored && typeof stored === 'object') {
      Object.keys(stored).forEach(u => {
        if (stored[u] && typeof stored[u].pass === 'string') map[u] = stored[u];
      });
    }
    return map;
  }
  function saveUsers(map) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function seedIfNeeded() {
    try {
      if (!localStorage.getItem(USERS_KEY)) saveUsers(USERS_SEED);
    } catch (e) {}
  }

  /* ---------- session ---------- */
  function getSession() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) {}
    if (!s || !getUsers()[s.user]) return null;
    return s;
  }
  function setSession(user) {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify({ user, at: Date.now() })); } catch (e) {}
  }
  function logout() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    location.reload();
  }

  /* ---------- user management (boss only, UI guards it) ---------- */
  function listUsers() {
    const map = getUsers();
    return Object.keys(map).sort().map(u => ({ user: u, ...map[u] }));
  }

  function addUser(d) {
    const map = getUsers();
    const name = String(d.user || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{2,20}$/.test(name)) return { ok: false, msg: 'Login 2-20 ta harf/raqam belgisi bo‘lishi kerak' };
    if (map[name]) return { ok: false, msg: 'Bunday foydalanuvchi allaqachon bor' };
    if (!d.name || !d.name.trim()) return { ok: false, msg: 'Ism kiritilmagan' };
    if (!d.pass || String(d.pass).length < 4) return { ok: false, msg: 'Parol kamida 4 ta belgi bo‘lishi kerak' };
    map[name] = { pass: String(d.pass), name: String(d.name).trim(), role: roleOf(d.role), added: new Date().toISOString() };
    saveUsers(map);
    return { ok: true, user: name };
  }

  function roleOf(r) {
    if (r === 'boss' || r === 'Administrator') return 'Administrator';
    if (r === 'kassa' || r === 'Kassa') return 'Kassa';
    return 'Ishchi';
  }

  function changePass(user, newPass) {
    const map = getUsers();
    if (!map[user]) return { ok: false, msg: 'Foydalanuvchi topilmadi' };
    if (!newPass || String(newPass).length < 4) return { ok: false, msg: 'Parol kamida 4 ta belgi bo‘lishi kerak' };
    map[user].pass = String(newPass);
    saveUsers(map);
    return { ok: true };
  }

  function deleteUser(user) {
    const map = getUsers();
    if (!map[user]) return { ok: false, msg: 'Foydalanuvchi topilmadi' };
    if (user === getSession()?.user) return { ok: false, msg: 'O‘zingizni o‘chira olmaysiz' };
    const bosses = Object.keys(map).filter(u => map[u].role === 'Administrator');
    if (map[user].role === 'Administrator' && bosses.length <= 1)
      return { ok: false, msg: 'Oxirgi administratorni o‘chira olmaysiz' };
    delete map[user];
    saveUsers(map);
    return { ok: true };
  }

  /* ---------- sidebar logout button (every page) ---------- */
  function injectLogout() {
    const foot = document.querySelector('.side-foot');
    if (!foot) return;
    const me = getSession();
    let btn = document.querySelector('[data-auth-logout]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'linkbtn';
      btn.setAttribute('data-auth-logout', '');
      foot.appendChild(document.createTextNode('   '));
      foot.appendChild(btn);
    }
    btn.textContent = 'Chiqish' + (me && getUsers()[me.user] ? ' — ' + esc(getUsers()[me.user].name) : '');
    if (btn.dataset.authBound !== '1') {   /* bind once, even if the button came from the HTML */
      btn.dataset.authBound = '1';
      btn.addEventListener('click', logout);
    }
  }

  /* boss-only nav items are hidden for everyone else */
  function applyRoleVisibility() {
    document.querySelectorAll('[data-boss-only]').forEach(el => {
      if (!isBoss()) el.remove();
    });
  }

  function isBoss() {
    const me = getSession();
    return !!me && getUsers()[me.user]?.role === 'Administrator';
  }

  function isKassa() {
    const me = getSession();
    return !!me && getUsers()[me.user]?.role === 'Kassa';
  }

  function onKassaPage() {
    return /kassa\.html$/.test(location.pathname);
  }

  /* Kassa xodimi faqat sotish ekranini ko'radi — boshqa sahifaga
     o'tmoqchi bo'lsa (yoki login shu yerda bo'lsa) kassaga qaytariladi */
  function enforceKassaRoute() {
    if (isKassa() && !onKassaPage()) location.replace('kassa.html');
  }

  /* ---------- login screen ---------- */
  function showLogin() {
    const back = document.createElement('div');
    back.className = 'auth-backdrop';
    back.innerHTML = `
<div class="auth-card" role="dialog" aria-modal="true" aria-label="Kirish">
  <div class="auth-card__brand">
    <span class="auth-card__mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 4h8a1.8 1.8 0 0 1 1.8 1.8V6H6.2v-.2A1.8 1.8 0 0 1 8 4z"/>
        <rect x="3.5" y="6" width="17" height="14.5" rx="2.2"/>
        <path d="M9.5 11h5M9.5 14.5h5"/>
      </svg>
    </span>
    <span>
      <span class="auth-card__name">Stock Manager</span>
      <span class="auth-card__sub">Warehouse System</span>
    </span>
  </div>

  <form class="auth-form" novalidate>
    <label class="auth-field">
      <span>Foydalanuvchi</span>
      <input type="text" name="user" autocomplete="username" placeholder="Login" required>
    </label>
    <label class="auth-field">
      <span>Parol</span>
      <input type="password" name="pass" autocomplete="current-password" placeholder="••••••••" required>
    </label>
    <div class="auth-error" role="alert" hidden></div>
    <button class="btn btn--blue auth-submit" type="submit">Kirish</button>
  </form>

  <p class="auth-hint">Tizim uchun parol so‘rash uchun administratorga murojaat qiling.<br>Ma’lumotlar faqat shu brauzerda saqlanadi.</p>
</div>`;
    document.body.appendChild(back);

    const form = back.querySelector('form');
    const err = back.querySelector('.auth-error');
    const userInput = form.elements.user;

    form.addEventListener('submit', e => {
      e.preventDefault();
      const user = (userInput.value || '').trim().toLowerCase();
      const pass = form.elements.pass.value;
      const rec = getUsers()[user];
      if (rec && rec.pass === pass) {
        setSession(user);
        back.remove();
        if (rec.role === 'Kassa') {
          /* kassir darhol sotish ekraniga o'tadi */
          location.replace('kassa.html');
          return;
        }
        injectLogout();
        applyRoleVisibility();
        /* boss/ishchi login kassa sahifasida bo'lgan bo'lsa — dashboard'ga */
        if (onKassaPage()) { location.replace('dashboard.html'); return; }
      } else {
        err.textContent = 'Foydalanuvchi yoki parol noto‘g‘ri';
        err.hidden = false;
        back.classList.remove('auth-shake');
        void back.offsetWidth;               /* restart the animation */
        back.classList.add('auth-shake');
        form.elements.pass.value = '';
        form.elements.pass.focus();
      }
    });

    userInput.focus();
  }

  /* ---------- boot ---------- */
  seedIfNeeded();
  const api = {
    logout,
    showLogin,
    listUsers,
    addUser,
    changePass,
    deleteUser,
    injectLogout,
    applyRoleVisibility,
    enforceKassaRoute,
    isBoss,
    isKassa,
    current() {
      const me = getSession();
      return me ? { user: me.user, ...(getUsers()[me.user] || {}) } : null;
    }
  };
  return api;
})();

/* ---------- page boot (runs on every page) ---------- */
if (Auth.current()) {
  Auth.enforceKassaRoute();
  Auth.injectLogout();
} else {
  Auth.showLogin();
}
Auth.applyRoleVisibility();
