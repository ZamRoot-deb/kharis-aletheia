/* KHARIS & ALETHEIA — shared chrome
   Nav + mobile menu + theme + cart drawer + injected footer, toasts, wishlist, forms,
   modal, reveal-on-scroll, lookbook carousel, mobile scroll pill, sizing tabs.
   Shop-page and product-page renderers live in shop.js / product.js — not here. */

/* ============ THEME (bootstrap already ran inline in <head>; this just keeps it in sync) ============ */
(function () {
  const saved = localStorage.getItem('ka_theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  } else if (!document.documentElement.getAttribute('data-theme')) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

function kaToggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', cur);
  try { localStorage.setItem('ka_theme', cur); } catch (e) {}
  document.querySelectorAll('.theme-toggle .tt-label').forEach(el => {
    el.textContent = cur === 'light' ? 'DARK' : 'LIGHT';
  });
}

/* ============ SCROLL LOCK (shared by drawer / modal / mobile menu, ref-counted) ============ */
const kaScrollLock = (function () {
  let count = 0;
  let prevOverflow = '';
  return {
    lock() {
      if (count === 0) { prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
      count++;
    },
    unlock() {
      count = Math.max(0, count - 1);
      if (count === 0) document.body.style.overflow = prevOverflow;
    }
  };
})();

/* ============ FOCUS TRAP (shared by drawer / modal) ============ */
function kaFocusables(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null || el === document.activeElement);
}
function kaTrapTab(container, e) {
  const list = kaFocusables(container);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ============ SKIP LINK ============ */
(function () {
  const target = document.querySelector('.page') || document.querySelector('main') || document.querySelector('header.hero') || document.body;
  if (!target.id) target.id = 'ka-main';
  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = '#' + target.id;
  skip.textContent = 'Skip to content';
  document.body.prepend(skip);
})();

/* ============ NAV (injected, shared) ============ */
(function () {
  const page = document.body.dataset.page || '';
  const products = window.KA_PRODUCTS || [];
  const available = products.filter(p => !p.sold);
  const counts = {
    all: available.length,
    tees: available.filter(p => p.cat === 'tees').length,
    sweatshirts: available.filter(p => p.cat === 'sweatshirts').length,
    accessories: available.filter(p => p.cat === 'accessories').length
  };
  const collectionsCount = (window.KA_COLLECTIONS || []).length;
  const giftAmounts = (window.KA_CONFIG && window.KA_CONFIG.giftAmounts) || [];
  const giftFrom = giftAmounts.length ? Math.min.apply(null, giftAmounts) : null;
  const giftLabel = giftFrom != null && window.KA_CORE ? 'From ' + KA_CORE.money(giftFrom) : 'Gift';

  const isShop = page === 'shop' || page === 'product';
  const isStudios = page === 'studio' || page === 'lab' || page === 'bulk';

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <a class="nav-logo" href="index.html" aria-label="Kharis & Aletheia home">
      <img decoding="async" class="logo-dark" src="assets/logo-horizontal-sm.png" width="800" height="207" alt="Kharis & Aletheia">
      <img decoding="async" class="logo-light" src="assets/logo-horizontal-navy.png" width="800" height="207" alt="Kharis & Aletheia">
    </a>
    <div class="nav-links">
      <div class="nav-drop">
        <button type="button" class="${isShop ? 'active' : ''}" aria-haspopup="true" aria-expanded="false">Shop</button>
        <div class="drop-panel">
          <a href="shop.html">All pieces <span>${counts.all}</span></a>
          <a href="shop.html#tees">Tees <span>${counts.tees}</span></a>
          <a href="shop.html#sweatshirts">Sweatshirts <span>${counts.sweatshirts}</span></a>
          <a href="shop.html#accessories">Accessories <span>${counts.accessories}</span></a>
          <a href="shop.html#collections">Collections <span>${collectionsCount}</span></a>
          <a href="gift.html">Gift cards <span>${giftLabel}</span></a>
        </div>
      </div>
      <div class="nav-drop">
        <button type="button" class="${isStudios ? 'active' : ''}" aria-haspopup="true" aria-expanded="false">Studios</button>
        <div class="drop-panel">
          <a href="studio.html">Tee Studio <span>Custom</span></a>
          <a href="lab.html">Print Lab <span>Design</span></a>
          <a href="bulk.html">Crew &amp; Bulk <span>Teams</span></a>
        </div>
      </div>
      <a href="lookbook.html" class="${page === 'lookbook' ? 'active' : ''}">Lookbook</a>
      <a href="makers.html" class="${page === 'makers' ? 'active' : ''}">Makers</a>
      <a href="sizing.html" class="${page === 'sizing' ? 'active' : ''}">Sizing</a>
      <a href="about.html" class="${page === 'about' ? 'active' : ''}">About</a>
    </div>
    <div class="nav-actions">
      <button class="theme-toggle" type="button" aria-label="Switch theme">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>
        <span class="tt-label">${document.documentElement.getAttribute('data-theme') === 'light' ? 'DARK' : 'LIGHT'}</span>
      </button>
      <button class="wish-btn wish-btn-nav" type="button" aria-label="View wishlist">
        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.7-10.2-9.2C.2 8.7 1.7 5 5.4 5c2.1 0 3.6 1.1 4.6 2.5C10.9 6.1 12.5 5 14.6 5c3.7 0 5.2 3.7 3.6 6.8C19.5 16.3 12 21 12 21z"/></svg>
        <span class="wish-count">0</span>
      </button>
      <button class="cart-btn-nav" type="button" aria-label="Open cart">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/></svg>
        <span class="cart-count">0</span>
      </button>
      <a class="nav-start" href="shop.html">Shop now →</a>
      <button class="nav-burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="kaMobileMenu">☰</button>
    </div>`;
  document.body.prepend(nav);

  /* ---- mobile menu ---- */
  const mm = document.createElement('div');
  mm.className = 'mobile-menu';
  mm.id = 'kaMobileMenu';
  mm.innerHTML = `
    <a href="shop.html" class="${isShop ? 'active' : ''}">Shop</a>
    <div class="m-sub">
      <a href="shop.html#tees">Tees</a>
      <a href="shop.html#sweatshirts">Sweatshirts</a>
      <a href="shop.html#accessories">Accessories</a>
      <a href="shop.html#collections">Collections</a>
      <a href="gift.html">Gift cards</a>
    </div>
    <a href="studio.html" class="${isStudios ? 'active' : ''}">Studios</a>
    <div class="m-sub">
      <a href="studio.html">Tee Studio</a>
      <a href="lab.html">Print Lab</a>
      <a href="bulk.html">Crew &amp; Bulk</a>
    </div>
    <a href="lookbook.html" class="${page === 'lookbook' ? 'active' : ''}">Lookbook</a>
    <a href="makers.html" class="${page === 'makers' ? 'active' : ''}">Makers</a>
    <a href="sizing.html" class="${page === 'sizing' ? 'active' : ''}">Sizing</a>
    <a href="about.html" class="${page === 'about' ? 'active' : ''}">About</a>
    <div class="m-sub">
      <a href="shop.html?wish=1">Wishlist</a>
      <a href="contact.html">Contact</a>
      <a href="policies.html">Refund Policy &amp; Terms</a>
    </div>`;
  document.body.appendChild(mm);

  const burger = nav.querySelector('.nav-burger');
  let mmKeyHandler = null;
  function openMobileMenu() {
    mm.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    kaScrollLock.lock();
    mmKeyHandler = e => { if (e.key === 'Escape') closeMobileMenu(true); };
    document.addEventListener('keydown', mmKeyHandler);
  }
  function closeMobileMenu(returnFocus) {
    if (!mm.classList.contains('open')) return;
    mm.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    kaScrollLock.unlock();
    if (mmKeyHandler) { document.removeEventListener('keydown', mmKeyHandler); mmKeyHandler = null; }
    if (returnFocus) burger.focus();
  }
  burger.addEventListener('click', () => { mm.classList.contains('open') ? closeMobileMenu(true) : openMobileMenu(); });
  mm.addEventListener('click', e => { if (e.target.tagName === 'A') closeMobileMenu(false); });

  nav.querySelector('.theme-toggle').addEventListener('click', kaToggleTheme);
  nav.querySelector('.wish-btn-nav').addEventListener('click', () => { window.location.href = 'shop.html?wish=1'; });

  /* ---- desktop dropdowns: click-toggle (keyboard/touch) + hover (CSS, unaffected) ---- */
  nav.querySelectorAll('.nav-drop > button').forEach(btn => {
    const panel = btn.nextElementSibling;
    if (panel) {
      const id = 'ka-drop-' + Math.random().toString(36).slice(2, 8);
      panel.id = id;
      btn.setAttribute('aria-controls', id);
    }
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const drop = btn.parentElement;
      const willOpen = !drop.classList.contains('open');
      nav.querySelectorAll('.nav-drop').forEach(o => {
        o.classList.remove('open');
        const b = o.querySelector('button');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) { drop.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
  document.addEventListener('click', () => {
    nav.querySelectorAll('.nav-drop.open').forEach(d => {
      d.classList.remove('open');
      const b = d.querySelector('button');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openDrop = nav.querySelector('.nav-drop.open');
    if (openDrop) {
      openDrop.classList.remove('open');
      const b = openDrop.querySelector('button');
      if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); }
    }
  });

  /* ---- cart drawer scaffold ---- */
  const overlay = document.createElement('div');
  overlay.className = 'cart-overlay';
  const drawer = document.createElement('aside');
  drawer.className = 'cart-drawer';
  drawer.setAttribute('tabindex', '-1');
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  overlay.addEventListener('click', () => kaCart.close());
  nav.querySelector('.cart-btn-nav').addEventListener('click', () => kaCart.open());
})();

/* ============ TOAST ============ */
function kaToast(msg, type) {
  type = type === 'err' ? 'err' : 'ok';
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-atomic', 'true');
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = String(msg == null ? '' : msg);
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const remove = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 260); };
  const timer = setTimeout(remove, 3200);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}
window.kaToast = kaToast;

/* ============ CART ============ */
const kaCart = (function () {
  const KEY = 'ka_cart';
  let items = [];
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    items = Array.isArray(stored) ? stored : [];
  } catch (e) { items = []; }

  const listeners = [];
  let isOpen = false;
  let lastFocused = null;
  let rowActionLock = false;
  // Guard against a fast double-click landing on the freshly re-rendered next
  // row after a qty/remove mutation shifts array indices (rows are keyed by
  // render-time index). Not a full debounce of the drawer — just closes the
  // window between a mutation and its re-render.
  function withRowLock(fn) {
    return function () {
      if (rowActionLock) return;
      rowActionLock = true;
      fn.apply(null, arguments);
      setTimeout(() => { rowActionLock = false; }, 350);
    };
  }
  let drawerKeyHandler = null;

  const GIFT_THUMB = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#120a02"/><rect x="7" y="24" width="50" height="30" fill="none" stroke="#d8b26a" stroke-width="2"/><path d="M7 32h50M32 24v30M18 24c0-4.5 4-8 9-8s7.5 3.5 5 8M46 24c0-4.5-4-8-9-8s-7.5 3.5-5 8" fill="none" stroke="#d8b26a" stroke-width="2"/></svg>'
  );
  const CUSTOM_THUMB = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#120a02"/><path d="M22 8l10 6 10-6 10 8-6 6v34H18V22l-6-6z" fill="none" stroke="#d8b26a" stroke-width="2"/></svg>'
  );

  function kindOf(it) { return (it && it.kind) ? it.kind : 'product'; }
  function uid(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    renderBadge();
    listeners.forEach(fn => { try { fn(items.slice()); } catch (e2) {} });
  }
  function renderBadge() {
    const count = window.KA_CORE ? KA_CORE.itemCount(items) : items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.classList.toggle('show', count > 0);
    });
  }

  /* it.thumb (kind:'custom') round-trips through localStorage, so it's untrusted: a data-URI
     legitimately contains "/" and "=" (KA_CORE.escapeHtml would corrupt it), so instead of
     escaping we refuse anything that could break out of the src="" attribute or isn't a
     recognisable image reference, and fall back to the built-in placeholder. */
  /* Also exposed as kaCart.safeThumbSrc() — the single sanitizer every renderer of cart-item
     images (this drawer, checkout.js's order summary) should call for untrusted item.thumb,
     instead of each writing its own check. */
  function safeImgSrc(src, fallback) {
    if (typeof src !== 'string' || !src) return fallback;
    if (/["'<>]/.test(src)) return fallback;
    if (/^data:image\//.test(src) || /^(assets\/|https:\/\/|\.\/|\.\.\/)/.test(src)) return src;
    return fallback;
  }
  function thumbFor(it) {
    const kind = kindOf(it);
    if (kind === 'product') {
      const p = window.KA_CORE ? KA_CORE.findProduct(it.id) : (window.KA_PRODUCTS || []).find(p2 => p2.id === it.id);
      /* deleted/renamed product id (stale stored cart): never emit src="" — that can make
         some browsers re-request the current page — fall back to a neutral placeholder. */
      return p ? p.img : CUSTOM_THUMB;
    }
    if (kind === 'custom') return safeImgSrc(it.thumb, CUSTOM_THUMB);
    if (kind === 'gift') return GIFT_THUMB;
    return CUSTOM_THUMB;
  }
  function nameFor(it) {
    const kind = kindOf(it);
    if (kind === 'product') {
      const p = window.KA_CORE ? KA_CORE.findProduct(it.id) : (window.KA_PRODUCTS || []).find(p2 => p2.id === it.id);
      return p ? p.name : 'Item no longer available';
    }
    if (kind === 'custom') return it.name || 'Custom piece';
    if (kind === 'gift') return 'Gift card';
    return 'Item';
  }
  function studioLabel(list, id) {
    const found = Array.isArray(list) ? list.find(x => x.id === id) : null;
    return found ? found.name : id;
  }
  function metaFor(it) {
    const esc = window.KA_CORE ? KA_CORE.escapeHtml.bind(KA_CORE) : (s => String(s == null ? '' : s));
    const kind = kindOf(it);
    if (kind === 'product') return 'SIZE ' + esc(it.size || 'M');
    if (kind === 'custom') {
      const studio = (window.KA_CONFIG && window.KA_CONFIG.studio) || {};
      const bits = [];
      if (it.colour) bits.push(esc(studioLabel(studio.colours, it.colour)));
      if (it.size) bits.push('SIZE ' + esc(it.size));
      if (it.design && it.design.placement) bits.push(esc(studioLabel(studio.placements, it.design.placement)));
      return bits.join(' · ');
    }
    if (kind === 'gift') return 'To ' + esc(it.to || '—');
    return '';
  }

  function renderDrawer() {
    const drawer = document.querySelector('.cart-drawer');
    if (!drawer) return;
    let body;
    if (!items.length) {
      body = `<div class="empty-state cart-empty">
        <p class="es-title">Your cart is empty</p>
        <p class="es-copy">Every piece is made to order — go find yours.</p>
        <a class="btn btn-gold" href="shop.html">Shop the collection →</a>
      </div>`;
    } else {
      body = items.map((it, idx) => {
        const kind = kindOf(it);
        const thumb = thumbFor(it);
        const name = window.KA_CORE ? KA_CORE.escapeHtml(nameFor(it)) : nameFor(it);
        const meta = metaFor(it);
        const unit = window.KA_CORE ? KA_CORE.unitPrice(it) : 0;
        const money = n => window.KA_CORE ? KA_CORE.money(n) : ('£' + n);
        const qty = kind === 'gift' ? 1 : Math.max(1, Number(it.qty) || 1);
        const priceLine = kind === 'gift' ? money(unit) : (money(unit) + ' × ' + qty);
        const qtyControls = kind === 'gift'
          ? `<p class="ci-note">Digital delivery · qty 1</p>`
          : `<div class="ci-qty">
               <button type="button" data-dec="${idx}" aria-label="Decrease quantity">−</button>
               <span>${qty}</span>
               <button type="button" data-inc="${idx}" aria-label="Increase quantity">+</button>
             </div>`;
        return `<div class="cart-item" data-kind="${kind}">
          <img decoding="async" src="${thumb}" alt="" loading="lazy">
          <div class="ci-info">
            <p class="ci-name">${name}</p>
            ${meta ? `<p class="ci-meta">${meta}</p>` : ''}
            <p class="ci-price">${priceLine}</p>
            ${qtyControls}
            <button class="ci-remove" type="button" data-rm="${idx}">Remove</button>
          </div>
        </div>`;
      }).join('');
    }
    const subtotal = window.KA_CORE ? KA_CORE.subtotal(items) : 0;
    const count = window.KA_CORE ? KA_CORE.itemCount(items) : items.length;
    const money = n => window.KA_CORE ? KA_CORE.money(n) : ('£' + n);
    const leadTime = (window.KA_CONFIG && window.KA_CONFIG.leadTime) || '7–10 days';
    drawer.innerHTML = `
      <div class="cart-head">
        <h3 id="cartDrawerTitle">Your cart${items.length ? ' · ' + count : ''}</h3>
        <button class="cart-close" type="button" aria-label="Close cart">×</button>
      </div>
      <div class="cart-body">${body}</div>
      <div class="cart-foot">
        <div class="price-row cart-total"><span>Subtotal</span><b>${money(subtotal)}</b></div>
        <a class="btn btn-solid" href="checkout.html" data-checkout${items.length ? '' : ' aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"'}>Checkout →</a>
        <p class="cart-note">Made to order · ships in ${leadTime}</p>
      </div>`;

    drawer.querySelector('.cart-close').addEventListener('click', () => kaCart.close());
    drawer.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', withRowLock(() => {
      const idx = +b.dataset.inc; const it = items[idx]; if (!it) return;
      doUpdate(idx, (Number(it.qty) || 1) + 1);
    })));
    drawer.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', withRowLock(() => {
      const idx = +b.dataset.dec; const it = items[idx]; if (!it) return;
      doUpdate(idx, (Number(it.qty) || 1) - 1);
    })));
    drawer.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', withRowLock(() => doRemove(+b.dataset.rm))));
  }

  function doUpdate(idx, qty) {
    const it = items[idx]; if (!it) return;
    qty = Math.max(0, Math.floor(Number(qty)) || 0);
    if (kindOf(it) === 'gift') qty = qty > 0 ? 1 : 0;
    if (qty <= 0) items.splice(idx, 1); else it.qty = qty;
    persist(); renderDrawer();
  }
  function doRemove(idx) {
    if (!items[idx]) return;
    items.splice(idx, 1);
    persist(); renderDrawer();
  }
  function doClear() { items = []; persist(); renderDrawer(); }
  function doAddItem(item, opts) {
    if (!item) return;
    opts = opts || {};
    const kind = item.kind || 'product';
    if (kind === 'product') {
      if (!item.id) return; // nothing to add without a product id
      const size = item.size || 'M';
      const qtyToAdd = Math.max(1, parseInt(item.qty, 10) || 1);
      const existing = items.find(i => kindOf(i) === 'product' && i.id === item.id && (i.size || 'M') === size);
      if (existing) existing.qty = (Number(existing.qty) || 0) + qtyToAdd;
      else items.push({ kind: 'product', id: item.id, size, qty: qtyToAdd });
    } else if (kind === 'gift') {
      items.push(Object.assign({}, item, { kind: 'gift', uid: item.uid || uid('g'), qty: 1 }));
    } else if (kind === 'custom') {
      items.push(Object.assign({}, item, { kind: 'custom', uid: item.uid || uid('c'), qty: Math.max(1, parseInt(item.qty, 10) || 1) }));
    } else {
      items.push(Object.assign({}, item, { qty: Math.max(1, parseInt(item.qty, 10) || 1) }));
    }
    persist();
    if (opts.render !== false) renderDrawer();
    if (opts.open !== false) openDrawer();
  }

  function openDrawer() {
    renderDrawer();
    const drawer = document.querySelector('.cart-drawer');
    const overlay = document.querySelector('.cart-overlay');
    if (!drawer || !overlay) return;
    lastFocused = document.activeElement;
    drawer.classList.add('open'); overlay.classList.add('open');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'cartDrawerTitle');
    kaScrollLock.lock();
    isOpen = true;
    const closeBtn = drawer.querySelector('.cart-close');
    (closeBtn || drawer).focus();
    drawerKeyHandler = e => {
      if (e.key === 'Escape') { kaCart.close(); }
      else if (e.key === 'Tab') { kaTrapTab(drawer, e); }
    };
    document.addEventListener('keydown', drawerKeyHandler);
  }
  function closeDrawer() {
    const drawer = document.querySelector('.cart-drawer');
    const overlay = document.querySelector('.cart-overlay');
    if (!drawer || !overlay || !isOpen) return;
    drawer.classList.remove('open'); overlay.classList.remove('open');
    drawer.removeAttribute('aria-modal');
    if (drawerKeyHandler) { document.removeEventListener('keydown', drawerKeyHandler); drawerKeyHandler = null; }
    kaScrollLock.unlock();
    isOpen = false;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  renderBadge();

  return {
    add(id, size, qty) { doAddItem({ kind: 'product', id, size: size || 'M', qty: qty || 1 }); },
    addItem(item) { doAddItem(item); },
    items() { return items.map(it => Object.assign({}, it)); },
    update(index, qty) { doUpdate(index, qty); },
    remove(index) { doRemove(index); },
    clear() { doClear(); },
    count() { return window.KA_CORE ? KA_CORE.itemCount(items) : items.length; },
    open() { openDrawer(); },
    close() { closeDrawer(); },
    onChange(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
    },
    safeThumbSrc(src) { return safeImgSrc(src, CUSTOM_THUMB); }
  };
})();
window.kaCart = kaCart;

/* ============ ADD-TO-CART BUTTONS (event-delegated: works for markup added after load) ============ */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-add]');
  if (!btn || btn.disabled || btn.classList.contains('added')) return;
  const id = btn.dataset.add;
  if (!id) return;
  const size = btn.dataset.size || (id[0] === 'a' ? 'ONE SIZE' : 'M');
  const qty = Math.max(1, parseInt(btn.dataset.qty, 10) || 1);
  kaCart.add(id, size, qty);
  const old = btn.textContent;
  btn.classList.add('added');
  btn.textContent = 'Added ✓';
  setTimeout(() => { btn.classList.remove('added'); btn.textContent = old; }, 1600);
});

/* ============ WISHLIST ============ */
const kaWishlist = (function () {
  const KEY = 'ka_wish';
  let ids = [];
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    ids = Array.isArray(stored) ? stored : [];
  } catch (e) { ids = []; }

  const listeners = [];
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch (e) {}
    renderBadges();
    listeners.forEach(fn => { try { fn(ids.slice()); } catch (e2) {} });
  }
  function renderBadges() {
    document.querySelectorAll('.wish-count').forEach(el => {
      el.textContent = ids.length;
      el.classList.toggle('show', ids.length > 0);
    });
    document.querySelectorAll('[data-wish-id]').forEach(el => {
      el.classList.toggle('on', ids.indexOf(el.dataset.wishId) > -1);
    });
  }
  renderBadges();

  return {
    toggle(id) {
      if (!id) return false;
      const i = ids.indexOf(id);
      if (i > -1) ids.splice(i, 1); else ids.push(id);
      persist();
      return i === -1;
    },
    has(id) { return ids.indexOf(id) > -1; },
    list() { return ids.slice(); },
    onChange(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
    }
  };
})();
window.kaWishlist = kaWishlist;

/* ============ MODAL ============ */
const kaModal = (function () {
  let panelEl = null;
  let lastFocused = null;
  let keyHandler = null;

  function ensureRoot() {
    let root = document.querySelector('.modal-root');
    if (!root) { root = document.createElement('div'); root.className = 'modal-root'; document.body.appendChild(root); }
    return root;
  }
  function close() {
    if (!panelEl) return;
    const root = document.querySelector('.modal-root');
    if (root) root.innerHTML = '';
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    kaScrollLock.unlock();
    panelEl = null;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }
  function open(html, opts) {
    opts = opts || {};
    close();
    const root = ensureRoot();
    const labelAttr = opts.label ? ` aria-label="${(window.KA_CORE ? KA_CORE.escapeHtml(opts.label) : opts.label)}"` : '';
    root.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-panel" role="dialog" aria-modal="true"${labelAttr} tabindex="-1">
        <button type="button" class="modal-close" aria-label="Close dialog">×</button>
        <div class="modal-body">${html}</div>
      </div>`;
    lastFocused = document.activeElement;
    const panel = root.querySelector('.modal-panel');
    const overlay = root.querySelector('.modal-overlay');
    root.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', close);
    kaScrollLock.lock();
    panelEl = panel;
    panel.focus();
    keyHandler = e => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Tab') kaTrapTab(panel, e);
    };
    document.addEventListener('keydown', keyHandler);
  }
  return { open, close };
})();
window.kaModal = kaModal;

/* ============ FORMS ============ */
const kaForms = {
  submit(kind, payload) {
    payload = payload || {};
    const record = { kind: kind || 'form', payload, ts: new Date().toISOString() };
    try {
      const key = 'ka_submissions';
      const list = JSON.parse(localStorage.getItem(key));
      const arr = Array.isArray(list) ? list : [];
      arr.push(record);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}

    const endpoint = (window.KA_CONFIG && window.KA_CONFIG.formEndpoint) || '';
    if (endpoint && !/^https:\/\//i.test(endpoint)) {
      return mailtoFallback(kind, payload);
    }
    if (endpoint) {
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).then(res => ({ ok: !!(res && res.ok), via: 'endpoint' }))
        .catch(() => mailtoFallback(kind, payload));
    }
    return mailtoFallback(kind, payload);
  }
};
function mailtoFallback(kind, payload) {
  const to = (window.KA_CONFIG && window.KA_CONFIG.contactEmail) || '';
  if (!to) return Promise.resolve({ ok: true, via: 'local' });
  return new Promise(resolve => {
    const subject = 'Kharis & Aletheia — ' + (kind || 'enquiry');
    const lines = Object.keys(payload || {}).map(k => `${k}: ${payload[k]}`);
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    try { window.location.href = url; } catch (e) {}
    resolve({ ok: true, via: 'mailto' });
  });
}
window.kaForms = kaForms;

/* ============ FOOTER (injected into <footer data-ka-footer>) ============ */
(function () {
  const footer = document.querySelector('footer[data-ka-footer]');
  if (!footer) return;
  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="wrap foot-inner">
      <a href="index.html" aria-label="Kharis & Aletheia home">
        <img decoding="async" loading="lazy" class="logo-dark" src="assets/logo-horizontal-sm.png" width="800" height="207" alt="Kharis &amp; Aletheia">
        <img decoding="async" loading="lazy" class="logo-light" src="assets/logo-horizontal-navy.png" width="800" height="207" alt="Kharis &amp; Aletheia">
      </a>
      <p class="foot-line">Grace &amp; truth, woven in</p>
      <div class="foot-grid">
        <nav class="foot-col" aria-label="Shop">
          <h4>Shop</h4>
          <a href="shop.html">All pieces</a>
          <a href="shop.html#tees">Tees</a>
          <a href="shop.html#sweatshirts">Sweatshirts</a>
          <a href="shop.html#accessories">Accessories</a>
          <a href="gift.html">Gift cards</a>
        </nav>
        <nav class="foot-col" aria-label="Studios">
          <h4>Studios</h4>
          <a href="studio.html">Tee Studio</a>
          <a href="lab.html">Print Lab</a>
          <a href="bulk.html">Crew &amp; Bulk</a>
        </nav>
        <nav class="foot-col" aria-label="House">
          <h4>House</h4>
          <a href="about.html">About</a>
          <a href="makers.html">Makers</a>
          <a href="lookbook.html">Lookbook</a>
        </nav>
        <nav class="foot-col" aria-label="Help">
          <h4>Help</h4>
          <a href="contact.html">Contact</a>
          <a href="sizing.html">Sizing</a>
          <a href="policies.html">Refund Policy &amp; Terms</a>
        </nav>
      </div>
      <p class="foot-copy">© ${year} KHARIS &amp; ALETHEIA — ALL RIGHTS RESERVED</p>
    </div>`;
})();

/* ============ SIZING TABS ============ */
(function () {
  const pills = document.querySelectorAll('#sizePills .pill');
  if (!pills.length) return;
  pills.forEach(p => p.addEventListener('click', () => {
    pills.forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    p.classList.add('on');
    p.setAttribute('aria-pressed', 'true');
    document.querySelectorAll('.size-block').forEach(b => {
      b.style.display = b.dataset.sizeGroup === p.dataset.sizeTab ? '' : 'none';
    });
  }));
  pills[0].click();
})();

/* ============ LOOKBOOK CAROUSEL ============ */
(function () {
  const track = document.getElementById('carTrack');
  if (!track) return;
  const slides = Array.from(track.children);
  const prev = document.getElementById('carPrev');
  const next = document.getElementById('carNext');
  const dotsWrap = document.getElementById('carDots');
  let index = 0;

  const perView = () => (window.innerWidth <= 820 ? 1 : 2);
  const maxIndex = () => Math.max(0, slides.length - perView());

  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    for (let i = 0; i <= maxIndex(); i++) {
      const d = document.createElement('i');
      if (i === index) d.classList.add('on');
      d.addEventListener('click', () => { index = i; update(); });
      dotsWrap.appendChild(d);
    }
  }
  function update() {
    if (!slides.length) return;
    index = Math.max(0, Math.min(index, maxIndex()));
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const w = slides[0].getBoundingClientRect().width + gap;
    track.style.transform = `translateX(${-index * w}px)`;
    if (dotsWrap) Array.from(dotsWrap.children).forEach((d, i) => d.classList.toggle('on', i === index));
  }
  if (prev) prev.addEventListener('click', () => { index = index <= 0 ? maxIndex() : index - 1; update(); });
  if (next) next.addEventListener('click', () => { index = index >= maxIndex() ? 0 : index + 1; update(); });
  window.addEventListener('resize', () => { buildDots(); update(); });

  let startX = null;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40 && (next || prev)) (dx < 0 ? next : prev).click();
    startX = null;
  }, { passive: true });

  buildDots();
  update();
})();

/* ============ REVEAL ON SCROLL ============ */
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

/* ============ MOBILE SCROLL PILL ============ */
(function () {
  const pill = document.getElementById('scrollPill');
  if (!pill) return;
  window.addEventListener('scroll', () => {
    pill.classList.toggle('gone', window.scrollY > window.innerHeight * 0.6);
  }, { passive: true });
})();
