/* KHARIS & ALETHEIA — shop.js
   Catalog: search, sort, category + collection + price + availability filters
   (URL-synced via history.replaceState), wishlist view, quick-add size picker,
   gift-card / studio promo tiles.
   Reads window.KA_PRODUCTS / KA_CAT_LABEL / KA_COLLECTIONS / KA_MAKERS (products.js),
   window.KA_CORE (core.js), window.kaCart / kaWishlist / kaToast / kaModal (app.js).
   Coded against CONTRACT.md — these globals are assumed to exist. */

(function () {
  'use strict';

  var grid = document.getElementById('shopGrid');

  var PRODUCTS = window.KA_PRODUCTS || [];
  var CAT_LABEL = window.KA_CAT_LABEL || {};
  var COLLECTIONS = window.KA_COLLECTIONS || [];
  var MAKERS = window.KA_MAKERS || [];
  var esc = KA_CORE.escapeHtml;
  var money = KA_CORE.money;

  var SIZES_FULL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  var CATS = ['tees', 'sweatshirts', 'accessories'];
  var SORTS = ['price-asc', 'price-desc', 'name'];

  var els = {
    banner: document.getElementById('collectionBanner'),
    bannerImg: document.getElementById('collectionBannerImg'),
    bannerTag: document.getElementById('collectionBannerTag'),
    bannerName: document.getElementById('collectionBannerName'),
    bannerBlurb: document.getElementById('collectionBannerBlurb'),
    bannerClear: document.getElementById('collectionBannerClear'),
    search: document.getElementById('shopSearch'),
    sort: document.getElementById('shopSort'),
    priceMin: document.getElementById('priceMin'),
    priceMax: document.getElementById('priceMax'),
    pills: Array.prototype.slice.call(document.querySelectorAll('#shopPills .pill')),
    soldToggle: document.getElementById('showSoldToggle'),
    wishToggle: document.getElementById('wishToggle'),
    clearBtn: document.getElementById('clearFilters'),
    count: document.getElementById('shopCount'),
    empty: document.getElementById('shopEmpty'),
    emptyMsg: document.getElementById('shopEmptyMsg'),
    emptyClearBtn: document.getElementById('shopEmptyClear')
  };

  var state = {
    cat: 'all', collection: '', q: '', sort: 'featured',
    min: null, max: null, sold: false, wish: false
  };

  /* ---------- helpers ---------- */

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function heartSvg(active) {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="' + (active ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4.5c2 0 3.6 1.1 4.4 2.7.8-1.6 2.4-2.7 4.4-2.7C18 4.5 19.6 8 22 11.7 19.5 16.4 12 21 12 21z"/></svg>';
  }

  /* ---------- URL <-> state ---------- */

  function parseUrl() {
    var qp = new URLSearchParams(location.search);
    var hash = location.hash.replace('#', '');

    var cat = qp.get('cat');
    if (!cat && CATS.indexOf(hash) !== -1) cat = hash;
    state.cat = CATS.indexOf(cat) !== -1 ? cat : 'all';

    var col = qp.get('collection');
    state.collection = COLLECTIONS.some(function (c) { return c.slug === col; }) ? col : '';

    state.q = (qp.get('q') || '').slice(0, 120);

    var sort = qp.get('sort');
    state.sort = SORTS.indexOf(sort) !== -1 ? sort : 'featured';

    var min = parseFloat(qp.get('min'));
    var max = parseFloat(qp.get('max'));
    state.min = isFinite(min) && min >= 0 ? min : null;
    state.max = isFinite(max) && max >= 0 ? max : null;

    state.sold = qp.get('sold') === '1';
    state.wish = qp.get('wish') === '1';
  }

  function syncUrl() {
    var qp = new URLSearchParams();
    if (state.cat !== 'all') qp.set('cat', state.cat);
    if (state.collection) qp.set('collection', state.collection);
    if (state.q) qp.set('q', state.q);
    if (state.sort !== 'featured') qp.set('sort', state.sort);
    if (state.min !== null) qp.set('min', String(state.min));
    if (state.max !== null) qp.set('max', String(state.max));
    if (state.sold) qp.set('sold', '1');
    if (state.wish) qp.set('wish', '1');
    var qs = qp.toString();
    var url = location.pathname + (qs ? '?' + qs : '');
    if (history.replaceState) history.replaceState(null, '', url);
  }

  /* ---------- filtering / sorting ---------- */

  function matchesSearch(p, needle) {
    var col = COLLECTIONS.filter(function (c) { return c.slug === p.collection; })[0];
    var maker = MAKERS.filter(function (m) { return m.slug === p.maker; })[0];
    var hay = [
      p.name, p.blurb, p.colour, (p.tags || []).join(' '),
      col ? col.name : '', col ? col.slug : '',
      maker ? maker.name : '', maker ? maker.slug : '',
      CAT_LABEL[p.cat] || p.cat
    ].join(' ').toLowerCase();
    return hay.indexOf(needle) !== -1;
  }

  /* Sold pieces are hidden by default on the unfiltered "All pieces" view, but a user who has
     explicitly navigated into a collection (which may be entirely archived, e.g. custom-prints)
     or into their wishlist (which may hold a sold one-of-one they saved) should still see them —
     the sold-hide is only a default declutter for browsing, not a hard exclusion. */
  function showsSold() {
    return state.sold || state.wish || !!state.collection;
  }

  function filterSort() {
    var list = PRODUCTS.slice();
    if (state.cat !== 'all') list = list.filter(function (p) { return p.cat === state.cat; });
    if (state.collection) list = list.filter(function (p) { return p.collection === state.collection; });
    if (!showsSold()) list = list.filter(function (p) { return !p.sold; });
    if (state.wish) list = list.filter(function (p) { return kaWishlist.has(p.id); });
    if (state.min !== null) list = list.filter(function (p) { return p.price >= state.min; });
    if (state.max !== null) list = list.filter(function (p) { return p.price <= state.max; });
    if (state.q) {
      var needle = state.q.toLowerCase();
      list = list.filter(function (p) { return matchesSearch(p, needle); });
    }
    if (state.sort === 'price-asc') list.sort(function (a, b) { return a.price - b.price; });
    else if (state.sort === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });
    else if (state.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return list;
  }

  /* ---------- render ---------- */

  function cardHtml(p) {
    var sold = !!p.sold;
    var wished = kaWishlist.has(p.id);
    var catLabel = CAT_LABEL[p.cat] || p.cat;
    var href = 'product.html?id=' + encodeURIComponent(p.id);
    return '<div class="shop-card' + (sold ? ' sold' : '') + '" data-card="' + p.id + '">' +
      '<div class="prod-img-wrap">' +
        '<a class="prod-img" href="' + href + '"><img decoding="async" src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy"></a>' +
        (sold ? '<span class="sold-tag">Sold</span>' : '') +
        '<button type="button" class="wish-heart' + (wished ? ' active' : '') + '" data-wish="' + p.id + '" ' +
          'aria-pressed="' + wished + '" aria-label="' + (wished ? 'Remove from wishlist' : 'Add to wishlist') + '">' +
          heartSvg(wished) +
        '</button>' +
      '</div>' +
      (sold
        ? '<p class="sold-note">One of one · sold</p>'
        : '<button class="btn btn-solid" type="button" data-add="' + p.id + '">Add to cart</button>') +
      '<div class="prod-meta">' +
        '<span class="cat-tag">' + catLabel + '</span>' +
        '<a href="' + href + '"><p class="prod-name">' + esc(p.name) + '</p></a>' +
        '<p class="prod-price">' + money(p.price) + '</p>' +
      '</div>' +
    '</div>';
  }

  function promoTiles() {
    return '<div class="shop-card promo-tile"><div class="promo-tile-inner">' +
        '<p class="micro">Custom</p><h3>Tee Studio</h3>' +
        '<p>Pick a print, place it your way, choose your cut — cut to order.</p>' +
        '<a class="btn btn-gold" href="studio.html">Enter the studio →</a>' +
      '</div></div>' +
      '<div class="shop-card promo-tile"><div class="promo-tile-inner">' +
        '<p class="micro">Gift</p><h3>Gift cards</h3>' +
        '<p>Give grace &amp; truth. Digital gift cards from £25.</p>' +
        '<a class="btn btn-gold" href="gift.html">Send a gift card →</a>' +
      '</div></div>';
  }

  function emptyMessage() {
    if (state.wish) return 'Your wishlist is empty — tap the heart on any piece to save it here.';
    if (state.collection) {
      var colProducts = PRODUCTS.filter(function (p) { return p.collection === state.collection; });
      if (colProducts.length && colProducts.every(function (p) { return p.sold; })) {
        return 'Every piece in this collection is sold — you’re looking at the archive.';
      }
    }
    if (state.q) return 'No pieces match "' + esc(state.q) + '".';
    return 'No pieces match those filters.';
  }

  function render() {
    var list = filterSort();
    grid.innerHTML = list.map(cardHtml).join('') + promoTiles();
    wireCardEvents();

    var totalInScope = PRODUCTS.filter(function (p) { return showsSold() ? true : !p.sold; }).length;
    var countText = 'Showing <b>' + list.length + '</b> of ' + totalInScope + ' piece' + (totalInScope === 1 ? '' : 's');
    if (state.q) countText += ' for &ldquo;' + esc(state.q) + '&rdquo;';
    els.count.innerHTML = countText;

    els.empty.hidden = list.length !== 0;
    els.emptyMsg.innerHTML = emptyMessage();
  }

  function syncHeartStates() {
    grid.querySelectorAll('[data-wish]').forEach(function (btn) {
      var id = btn.getAttribute('data-wish');
      var active = kaWishlist.has(id);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
      btn.innerHTML = heartSvg(active);
    });
  }

  /* ---------- quick-add ---------- */

  function openSizePicker(p) {
    var html = '<div class="ka-modal-quickadd">' +
      '<p class="micro">' + p.name + '</p>' +
      '<h2 class="h-display h-md">Choose your size</h2>' +
      '<div class="size-group" role="radiogroup" aria-label="Size">' +
        SIZES_FULL.map(function (s, i) {
          var sid = 'qa-size-' + s;
          return '<input type="radio" name="qaSize" id="' + sid + '" value="' + s + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<label for="' + sid + '">' + s + '</label>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-solid" type="button" id="qaConfirm">Add to cart</button>' +
    '</div>';
    kaModal.open(html, { label: 'Choose your size — ' + p.name });
    var confirmBtn = document.getElementById('qaConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        var checked = document.querySelector('input[name="qaSize"]:checked');
        var size = checked ? checked.value : SIZES_FULL[0];
        kaCart.add(p.id, size, 1);
        kaModal.close();
        kaToast(p.name + ' added — ' + size, 'ok');
      });
    }
  }

  function wireCardEvents() {
    grid.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = PRODUCTS.filter(function (x) { return x.id === btn.getAttribute('data-add'); })[0];
        if (!p) return;
        if (p.oneSize) {
          kaCart.add(p.id, 'ONE SIZE', 1);
          kaToast(p.name + ' added to cart', 'ok');
        } else {
          openSizePicker(p);
        }
      });
    });
    grid.querySelectorAll('[data-wish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-wish');
        kaWishlist.toggle(id);
        if (state.wish) { render(); return; }
        var active = kaWishlist.has(id);
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
        btn.innerHTML = heartSvg(active);
      });
    });
  }

  /* ---------- toolbar wiring ---------- */

  function updatePillsUI() {
    els.pills.forEach(function (p) {
      var on = p.getAttribute('data-cat') === state.cat;
      p.classList.toggle('on', on);
      p.setAttribute('aria-pressed', String(on));
    });
  }

  function updateCollectionBanner() {
    var c = COLLECTIONS.filter(function (x) { return x.slug === state.collection; })[0];
    if (!c) { els.banner.hidden = true; return; }
    els.banner.hidden = false;
    els.bannerTag.textContent = c.tag || 'Collection';
    els.bannerName.textContent = c.name;
    els.bannerBlurb.textContent = c.blurb || '';
    if (c.img) { els.bannerImg.src = c.img; els.bannerImg.alt = c.name; els.bannerImg.hidden = false; }
    else { els.bannerImg.hidden = true; }
  }

  function applyState() { syncUrl(); render(); }

  function clearFilters() {
    state.cat = 'all'; state.collection = ''; state.q = ''; state.sort = 'featured';
    state.min = null; state.max = null; state.sold = false; state.wish = false;
    els.search.value = ''; els.sort.value = 'featured';
    els.priceMin.value = ''; els.priceMax.value = '';
    els.soldToggle.checked = false; els.wishToggle.checked = false;
    updatePillsUI(); updateCollectionBanner(); applyState();
    els.search.focus();
  }

  function wireControls() {
    els.search.value = state.q;
    els.search.addEventListener('input', debounce(function () {
      state.q = els.search.value.trim().slice(0, 120);
      applyState();
    }, 220));

    els.sort.value = state.sort;
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; applyState(); });

    if (state.min !== null) els.priceMin.value = state.min;
    if (state.max !== null) els.priceMax.value = state.max;
    els.priceMin.addEventListener('input', debounce(function () {
      var v = parseFloat(els.priceMin.value);
      state.min = (isFinite(v) && v >= 0) ? v : null;
      applyState();
    }, 250));
    els.priceMax.addEventListener('input', debounce(function () {
      var v = parseFloat(els.priceMax.value);
      state.max = (isFinite(v) && v >= 0) ? v : null;
      applyState();
    }, 250));

    els.pills.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.cat = btn.getAttribute('data-cat');
        updatePillsUI();
        applyState();
      });
    });

    els.soldToggle.checked = state.sold;
    els.soldToggle.addEventListener('change', function () { state.sold = els.soldToggle.checked; applyState(); });

    els.wishToggle.checked = state.wish;
    els.wishToggle.addEventListener('change', function () { state.wish = els.wishToggle.checked; applyState(); });

    els.clearBtn.addEventListener('click', clearFilters);
    els.emptyClearBtn.addEventListener('click', clearFilters);
    els.bannerClear.addEventListener('click', function () {
      state.collection = '';
      updateCollectionBanner();
      applyState();
    });
  }

  /* ---------- init ---------- */

  parseUrl();
  updatePillsUI();
  updateCollectionBanner();
  wireControls();
  render();

  if (window.kaWishlist && typeof kaWishlist.onChange === 'function') {
    kaWishlist.onChange(function () {
      if (state.wish) render(); else syncHeartStates();
    });
  }

})();
