/* KHARIS & ALETHEIA — lookbook.js (lookbook.html only)
   Renders the 8-look + 3-street-shot editorial grid from KA_LOOKS, each
   look's "shop this look" panel from KA_PRODUCTS, and a keyboard-accessible
   lightbox via kaModal.
   Depends on: KA_CONFIG, KA_PRODUCTS, KA_LOOKS, KA_CORE, kaCart, kaToast,
   kaModal (config.js / products.js / core.js / app.js). */
(function () {
  'use strict';

  var grid = document.getElementById('lbGrid');
  if (!grid) return;

  /* Street photography isn't part of the shoppable-look catalog (no product
     tie-ins), so it isn't in KA_LOOKS — these three are laid in for editorial
     rhythm, reusing the same shots as index.html's "On the streets" strip. */
  var STREET_SHOTS = [
    { img: 'assets/img/street-1.webp', caption: 'Accra — dusk' },
    { img: 'assets/img/street-2.webp', caption: 'Ankara panel — detail' },
    { img: 'assets/img/street-3.webp', caption: 'Night shift — two of a kind' }
  ];

  function observeReveal(els) {
    if (!els || !els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  function anchorFor(look) {
    return 'look-' + String(look.id).replace(/^look-/, '');
  }

  function openSizePicker(product) {
    if (!product) return;
    var sizes = product.oneSize ? ['ONE SIZE'] : ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
    var html = '<div class="qp">'
      + '<p class="qp-eyebrow micro">Choose a size</p>'
      + '<h3 class="qp-title">' + KA_CORE.escapeHtml(product.name) + '</h3>'
      + '<p class="qp-price">' + KA_CORE.money(product.price) + '</p>'
      + '<div class="qp-sizes" role="group" aria-label="Available sizes">'
      + sizes.map(function (s) {
          return '<button type="button" class="qp-size" data-size="' + KA_CORE.escapeHtml(s) + '">' + KA_CORE.escapeHtml(s) + '</button>';
        }).join('')
      + '</div></div>';
    kaModal.open(html, { label: 'Choose a size — ' + product.name });
    document.querySelectorAll('.qp-size').forEach(function (btn) {
      btn.addEventListener('click', function () {
        kaCart.add(product.id, btn.dataset.size, 1);
        kaModal.close();
        kaToast(product.name + ' added to cart — size ' + btn.dataset.size, 'ok');
      });
    });
  }

  function shopList(look) {
    var ids = Array.isArray(look.productIds) ? look.productIds : [];
    var products = ids.map(function (id) { return KA_CORE.findProduct(id); }).filter(Boolean);
    if (!products.length) return '<p class="lb-shop-empty">Pieces from this look are being catalogued.</p>';
    return '<ul class="lb-shop-list">' + products.map(function (p) {
      var href = 'product.html?id=' + encodeURIComponent(p.id);
      var action = p.sold
        ? '<span class="lb-shop-sold">Sold</span>'
        : '<button type="button" class="lb-shop-add" data-add="' + p.id + '" aria-label="Add ' + KA_CORE.escapeHtml(p.name) + ' to cart">+</button>';
      return '<li>'
        + '<a class="lb-shop-thumb" href="' + href + '" tabindex="-1"><img decoding="async" src="' + p.img + '" alt="" loading="lazy"></a>'
        + '<div class="lb-shop-meta"><a href="' + href + '">' + KA_CORE.escapeHtml(p.name) + '</a><span>' + KA_CORE.money(p.price) + '</span></div>'
        + action
        + '</li>';
    }).join('') + '</ul>';
  }

  /* KA_LOOKS' title ("Look 01") and caption ("Look 01 — Kente stripe") both
     repeat the "Look NN" number — strip it from the caption so the heading
     reads as the description alone, with the number carried once by .lb-num. */
  function describe(look) {
    var stripped = String(look.caption || '').replace(/^Look\s*\d+\s*[—-]\s*/i, '');
    return stripped || look.caption || look.title;
  }

  function lookCard(look, idx, sizeClass) {
    var anchor = anchorFor(look);
    var num = String(idx + 1);
    if (num.length < 2) num = '0' + num;
    var desc = describe(look);
    return '<article class="lb-card ' + sizeClass + ' reveal d' + ((idx % 3) + 1) + '" id="' + anchor + '">'
      + '<button type="button" class="lb-photo" data-look="' + anchor + '" aria-label="View Look ' + num + ' — ' + KA_CORE.escapeHtml(desc) + ', full size">'
      + '<img decoding="async" src="' + look.img + '" alt="' + KA_CORE.escapeHtml(look.title) + ' — ' + KA_CORE.escapeHtml(desc) + '" loading="lazy"></button>'
      + '<div class="lb-info">'
      + '<p class="lb-num">LOOK ' + num + '</p>'
      + '<h3>' + KA_CORE.escapeHtml(desc) + '</h3>'
      + '<div class="lb-shop"><p class="lb-shop-label">Shop this look</p>' + shopList(look) + '</div>'
      + '</div></article>';
  }

  function streetCard(shot) {
    return '<div class="lb-card small lb-street reveal">'
      + '<img decoding="async" src="' + shot.img + '" alt="' + KA_CORE.escapeHtml(shot.caption) + '" loading="lazy">'
      + '<span>' + KA_CORE.escapeHtml(shot.caption) + '</span></div>';
  }

  var looks = Array.isArray(window.KA_LOOKS) ? KA_LOOKS.slice() : [];

  if (!looks.length) {
    grid.innerHTML = '<div class="empty-state"><p class="es-title">Nothing here yet</p>'
      + '<p class="es-copy">The lookbook is being shot — check back shortly.</p></div>';
  } else {
    var cards = looks.map(function (look, i) {
      return lookCard(look, i, i % 4 === 0 ? 'large' : 'small');
    });
    var merged = [];
    var streetIdx = 0;
    cards.forEach(function (card, i) {
      merged.push(card);
      if ((i === 2 || i === 5) && streetIdx < STREET_SHOTS.length) {
        merged.push(streetCard(STREET_SHOTS[streetIdx++]));
      }
    });
    while (streetIdx < STREET_SHOTS.length) merged.push(streetCard(STREET_SHOTS[streetIdx++]));
    grid.innerHTML = merged.join('');
  }

  grid.querySelectorAll('.lb-photo').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var anchor = btn.dataset.look;
      var look = looks.find(function (l) { return anchorFor(l) === anchor; });
      if (!look) return;
      var desc = describe(look);
      var html = '<figure class="lb-lightbox">'
        + '<img decoding="async" src="' + look.img + '" alt="' + KA_CORE.escapeHtml(look.title) + ' — ' + KA_CORE.escapeHtml(desc) + '">'
        + '<figcaption>' + KA_CORE.escapeHtml(look.title) + ' — ' + KA_CORE.escapeHtml(desc) + '</figcaption>'
        + '</figure>';
      kaModal.open(html, { label: look.title });
    });
  });

  grid.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var p = KA_CORE.findProduct(btn.dataset.add);
      if (!p) return;
      if (p.oneSize) {
        kaCart.add(p.id, 'ONE SIZE', 1);
        kaToast(p.name + ' added to cart', 'ok');
      } else {
        openSizePicker(p);
      }
    });
  });

  observeReveal(grid.querySelectorAll('.reveal'));

  /* Deep link from index.html's carousel (#look-N): the grid didn't exist
     yet when the browser tried to jump to the hash on load, so finish the
     job once our content is in the DOM. */
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
  }
})();
