/* KHARIS & ALETHEIA — shared interactions
   (theme switch, nav, cart, page renderers, reveal, carousel) */

/* ============ THEME ============ */
(function () {
  const saved = localStorage.getItem('ka_theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

function kaToggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', cur);
  localStorage.setItem('ka_theme', cur);
  document.querySelectorAll('.theme-toggle .tt-label').forEach(el => {
    el.textContent = cur === 'light' ? 'DARK' : 'LIGHT';
  });
}

/* ============ NAV (injected, shared) ============ */
(function () {
  const page = document.body.dataset.page || '';
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <a class="nav-logo" href="index.html" aria-label="Kharis & Aletheia home">
      <img class="logo-dark" src="assets/logo-horizontal-sm.png" alt="Kharis & Aletheia">
      <img class="logo-light" src="assets/logo-horizontal-navy.png" alt="Kharis & Aletheia">
    </a>
    <div class="nav-links">
      <div class="nav-drop">
        <button type="button">Shop</button>
        <div class="drop-panel">
          <a href="shop.html">All pieces <span>12</span></a>
          <a href="shop.html#tees">Tees <span>6</span></a>
          <a href="shop.html#sweatshirts">Sweatshirts <span>4</span></a>
          <a href="shop.html#accessories">Accessories <span>2</span></a>
        </div>
      </div>
      <div class="nav-drop">
        <button type="button">Studios</button>
        <div class="drop-panel">
          <a href="index.html#studios">Tee Studio <span>Custom</span></a>
          <a href="index.html#studios">Print Lab <span>Design</span></a>
          <a href="index.html#studios">Crew &amp; Bulk <span>Teams</span></a>
        </div>
      </div>
      <a href="index.html#lookbook">Lookbook</a>
      <a href="sizing.html" class="${page === 'sizing' ? 'active' : ''}">Sizing</a>
      <a href="about.html" class="${page === 'about' ? 'active' : ''}">About</a>
    </div>
    <div class="nav-actions">
      <button class="theme-toggle" type="button" aria-label="Switch theme">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>
        <span class="tt-label">${document.documentElement.getAttribute('data-theme') === 'light' ? 'DARK' : 'LIGHT'}</span>
      </button>
      <button class="cart-btn-nav" type="button" aria-label="Open cart">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/></svg>
        <span class="cart-count">0</span>
      </button>
      <a class="nav-start" href="shop.html">Shop now →</a>
      <button class="nav-burger" type="button" aria-label="Open menu">☰</button>
    </div>`;
  document.body.prepend(nav);

  /* mobile menu */
  const mm = document.createElement('div');
  mm.className = 'mobile-menu';
  mm.innerHTML = `
    <a href="shop.html">Shop</a>
    <a href="index.html#studios">Studios</a>
    <a href="index.html#lookbook">Lookbook</a>
    <a href="sizing.html">Sizing</a>
    <a href="about.html">About</a>
    <div class="m-sub">
      <a href="shop.html#tees">Tees</a>
      <a href="shop.html#sweatshirts">Sweatshirts</a>
      <a href="shop.html#accessories">Accessories</a>
    </div>`;
  document.body.appendChild(mm);

  nav.querySelector('.nav-burger').addEventListener('click', () => mm.classList.toggle('open'));
  mm.addEventListener('click', e => { if (e.target.tagName === 'A') mm.classList.remove('open'); });

  nav.querySelector('.theme-toggle').addEventListener('click', kaToggleTheme);

  /* touch support for dropdowns */
  nav.querySelectorAll('.nav-drop > button').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const d = btn.parentElement;
      nav.querySelectorAll('.nav-drop').forEach(o => { if (o !== d) o.classList.remove('open'); });
      d.classList.toggle('open');
    });
  });
  document.addEventListener('click', () => {
    nav.querySelectorAll('.nav-drop').forEach(d => d.classList.remove('open'));
  });

  /* cart drawer */
  const overlay = document.createElement('div');
  overlay.className = 'cart-overlay';
  const drawer = document.createElement('aside');
  drawer.className = 'cart-drawer';
  drawer.setAttribute('aria-label', 'Cart');
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  overlay.addEventListener('click', () => kaCart.close());
  nav.querySelector('.cart-btn-nav').addEventListener('click', () => kaCart.open());
})();

/* ============ CART ============ */
const kaCart = (function () {
  const KEY = 'ka_cart';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { items = []; }

  const money = n => '£' + n.toFixed(0);

  function save() {
    localStorage.setItem(KEY, JSON.stringify(items));
    renderBadge();
  }
  function renderBadge() {
    const count = items.reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.classList.toggle('show', count > 0);
    });
  }
  function find(id) {
    return (window.KA_PRODUCTS || []).find(p => p.id === id);
  }
  function renderDrawer() {
    const drawer = document.querySelector('.cart-drawer');
    if (!drawer) return;
    let body;
    if (!items.length) {
      body = `<div class="cart-empty">Your cart is empty.<br><br>Every piece is cut to order —<br>go find yours.</div>`;
    } else {
      body = items.map((it, idx) => {
        const p = find(it.id);
        if (!p) return '';
        return `<div class="cart-item">
          <img src="${p.img}" alt="${p.name}">
          <div class="ci-info">
            <p class="ci-name">${p.name}</p>
            <p class="ci-meta">SIZE ${it.size}</p>
            <p class="ci-price">${money(p.price)} × ${it.qty}</p>
            <div class="ci-qty">
              <button type="button" data-dec="${idx}">−</button>
              <span>${it.qty}</span>
              <button type="button" data-inc="${idx}">+</button>
            </div>
            <button class="ci-remove" type="button" data-rm="${idx}">Remove</button>
          </div>
        </div>`;
      }).join('');
    }
    const total = items.reduce((s, it) => { const p = find(it.id); return s + (p ? p.price * it.qty : 0); }, 0);
    drawer.innerHTML = `
      <div class="cart-head">
        <h3>Your cart ${items.length ? '· ' + items.reduce((s, i) => s + i.qty, 0) : ''}</h3>
        <button class="cart-close" type="button" aria-label="Close cart">×</button>
      </div>
      <div class="cart-body">${body}</div>
      <div class="cart-foot">
        <div class="cart-total"><span>SUBTOTAL</span><b>${money(total)}</b></div>
        <button class="btn btn-solid" type="button" data-checkout ${items.length ? '' : 'disabled style="opacity:.4;cursor:default"'}>Checkout →</button>
        <p class="cart-note">Made to order · ships in 7–10 days</p>
      </div>`;
    drawer.querySelector('.cart-close').addEventListener('click', () => kaCart.close());
    drawer.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => { items[+b.dataset.inc].qty++; save(); renderDrawer(); }));
    drawer.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => {
      const it = items[+b.dataset.dec];
      it.qty--; if (it.qty <= 0) items.splice(+b.dataset.dec, 1);
      save(); renderDrawer();
    }));
    drawer.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { items.splice(+b.dataset.rm, 1); save(); renderDrawer(); }));
    const co = drawer.querySelector('[data-checkout]');
    if (co && items.length) co.addEventListener('click', () => {
      co.textContent = 'Demo checkout — no payment wired';
      setTimeout(() => { co.textContent = 'Checkout →'; }, 2200);
    });
  }
  renderBadge();
  return {
    add(id, size, qty) {
      size = size || 'M'; qty = qty || 1;
      const ex = items.find(i => i.id === id && i.size === size);
      if (ex) ex.qty += qty; else items.push({ id, size, qty });
      save(); renderDrawer(); this.open();
    },
    open() { renderDrawer(); document.querySelector('.cart-drawer').classList.add('open'); document.querySelector('.cart-overlay').classList.add('open'); },
    close() { document.querySelector('.cart-drawer').classList.remove('open'); document.querySelector('.cart-overlay').classList.remove('open'); },
    count() { return items.reduce((s, i) => s + i.qty, 0); }
  };
})();

/* ============ ADD-TO-CART BUTTONS ============ */
document.querySelectorAll('[data-add]').forEach(btn => {
  btn.addEventListener('click', e => {
    if (btn.classList.contains('added')) return;
    const id = btn.dataset.id;
    if (id) kaCart.add(id, 'M', 1);
    const old = btn.textContent;
    btn.classList.add('added');
    btn.textContent = 'Added ✓';
    setTimeout(() => { btn.classList.remove('added'); btn.textContent = old; }, 1600);
  });
});

/* ============ SHOP PAGE ============ */
(function () {
  const grid = document.getElementById('shopGrid');
  if (!grid || !window.KA_PRODUCTS) return;

  function card(p) {
    return `<div class="shop-card reveal in">
      <a class="prod-img" href="product.html?id=${p.id}"><img src="${p.img}" alt="${p.name}" loading="lazy"></a>
      <button class="btn btn-solid" data-add data-id="${p.id}">Add to cart</button>
      <div class="prod-meta">
        <span class="cat-tag">${KA_CAT_LABEL[p.cat]}</span>
        <a href="product.html?id=${p.id}"><p class="prod-name">${p.name}</p></a>
        <p class="prod-price">£${p.price}</p>
      </div>
    </div>`;
  }
  function render(cat) {
    const list = cat === 'all' ? KA_PRODUCTS : KA_PRODUCTS.filter(p => p.cat === cat);
    grid.innerHTML = list.map(card).join('');
    grid.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('added')) return;
        kaCart.add(btn.dataset.id, btn.dataset.id[0] === 'a' ? 'ONE SIZE' : 'M', 1);
        const old = btn.textContent;
        btn.classList.add('added'); btn.textContent = 'Added ✓';
        setTimeout(() => { btn.classList.remove('added'); btn.textContent = old; }, 1600);
      });
    });
  }
  const pills = document.querySelectorAll('#shopPills .pill');
  function setCat(cat) {
    pills.forEach(p => p.classList.toggle('on', p.dataset.cat === cat));
    render(cat);
    if (history.replaceState) history.replaceState(null, '', cat === 'all' ? 'shop.html' : '#' + cat);
  }
  pills.forEach(p => p.addEventListener('click', () => setCat(p.dataset.cat)));
  const hash = location.hash.replace('#', '');
  setCat(['tees', 'sweatshirts', 'accessories'].includes(hash) ? hash : 'all');
})();

/* ============ PRODUCT PAGE ============ */
(function () {
  const root = document.getElementById('productRoot');
  if (!root || !window.KA_PRODUCTS) return;
  const id = new URLSearchParams(location.search).get('id');
  const p = KA_PRODUCTS.find(x => x.id === id) || KA_PRODUCTS[0];
  document.title = p.name + ' — KHARIS & ALETHEIA';

  const sizes = p.oneSize ? ['ONE SIZE'] : ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  const related = KA_PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);

  root.innerHTML = `
  <section class="page-hero" style="min-height:34vh">
    <img class="ph-img" src="${p.img}" alt="" style="filter:blur(14px) brightness(.5);transform:scale(1.15)">
    <div class="ph-veil"></div>
    <div class="wrap">
      <p class="micro">Kharis &amp; Aletheia · ${KA_CAT_LABEL[p.cat]}</p>
      <h1 class="h-display glitch glitch-anim" data-text="${p.name}">${p.name}</h1>
    </div>
  </section>
  <div class="wrap">
    <div class="pd-layout">
      <div class="pd-gallery">
        <div class="pd-main" id="pdMain"><img src="${p.img}" alt="${p.name}"></div>
        <div class="pd-thumbs">
          <button type="button" class="on" data-view="full"><img src="${p.img}" alt="Full view"></button>
          <button type="button" class="t-top" data-view="zoom-top"><img src="${p.img}" alt="Top detail"></button>
          <button type="button" class="t-detail" data-view="zoom-detail"><img src="${p.img}" alt="Print detail"></button>
        </div>
      </div>
      <div class="pd-info">
        <a class="pd-back" href="shop.html">← Back to shop</a>
        <h1 class="h-display glitch" data-text="${p.name}">${p.name}</h1>
        <p class="pd-price-line">£${p.price}.00</p>
        <p class="blurb">${p.blurb}</p>
        <p class="details">${p.details}</p>
        <div class="pd-field">
          <label for="pdSize">Size</label>
          <select id="pdSize">${sizes.map(s => `<option>${s}</option>`).join('')}</select>
        </div>
        <div class="pd-field">
          <label for="pdQty">Quantity</label>
          <input id="pdQty" type="number" min="1" max="20" value="1">
        </div>
        <button class="btn btn-solid" id="pdAdd" style="max-width:340px">Add to cart</button>
      </div>
    </div>
    <div class="related">
      <p class="micro">Keep looking</p>
      <h2 class="h-display h-md">MORE ${KA_CAT_LABEL[p.cat].toUpperCase()}</h2>
      <div class="prod-grid">
        ${related.map(r => `
          <div class="prod-card">
            <a class="prod-img" href="product.html?id=${r.id}"><img src="${r.img}" alt="${r.name}" loading="lazy"></a>
            <button class="btn btn-solid" data-rel-add="${r.id}">Add to cart</button>
            <div class="prod-meta">
              <a href="product.html?id=${r.id}"><p class="prod-name">${r.name}</p></a>
              <p class="prod-price">£${r.price}</p>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;

  const main = root.querySelector('#pdMain');
  root.querySelectorAll('.pd-thumbs button').forEach(b => {
    b.addEventListener('click', () => {
      root.querySelectorAll('.pd-thumbs button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      main.className = 'pd-main ' + (b.dataset.view === 'full' ? '' : b.dataset.view);
    });
  });
  root.querySelector('#pdAdd').addEventListener('click', () => {
    const size = root.querySelector('#pdSize').value;
    const qty = Math.max(1, Math.min(20, parseInt(root.querySelector('#pdQty').value) || 1));
    kaCart.add(p.id, size, qty);
  });
  root.querySelectorAll('[data-rel-add]').forEach(b => {
    b.addEventListener('click', () => kaCart.add(b.dataset.relAdd, b.dataset.relAdd[0] === 'a' ? 'ONE SIZE' : 'M', 1));
  });
})();

/* ============ SIZING TABS ============ */
(function () {
  const pills = document.querySelectorAll('#sizePills .pill');
  if (!pills.length) return;
  pills.forEach(p => p.addEventListener('click', () => {
    pills.forEach(x => x.classList.remove('on'));
    p.classList.add('on');
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
    dotsWrap.innerHTML = '';
    for (let i = 0; i <= maxIndex(); i++) {
      const d = document.createElement('i');
      if (i === index) d.classList.add('on');
      d.addEventListener('click', () => { index = i; update(); });
      dotsWrap.appendChild(d);
    }
  }
  function update() {
    index = Math.max(0, Math.min(index, maxIndex()));
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const w = slides[0].getBoundingClientRect().width + gap;
    track.style.transform = `translateX(${-index * w}px)`;
    Array.from(dotsWrap.children).forEach((d, i) => d.classList.toggle('on', i === index));
  }
  prev.addEventListener('click', () => { index = index <= 0 ? maxIndex() : index - 1; update(); });
  next.addEventListener('click', () => { index = index >= maxIndex() ? 0 : index + 1; update(); });
  window.addEventListener('resize', () => { buildDots(); update(); });

  let startX = null;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev).click();
    startX = null;
  }, { passive: true });

  buildDots();
  update();
})();

/* ============ REVEAL ON SCROLL ============ */
(function () {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

/* ============ MOBILE SCROLL PILL ============ */
(function () {
  const pill = document.getElementById('scrollPill');
  if (!pill) return;
  window.addEventListener('scroll', () => {
    pill.classList.toggle('gone', window.scrollY > window.innerHeight * 0.6);
  }, { passive: true });
})();
