/* KHARIS & ALETHEIA — makers.js (makers.html only)
   Renders one full profile section per KA_MAKERS entry: bio, a live print
   swatch strip from KA_PRINTS (filtered to that maker), their pieces from
   KA_PRODUCTS, a CTA to their collection, and — for an upcoming maker — the
   notify form.
   Depends on: KA_CONFIG, KA_PRODUCTS, KA_MAKERS, KA_CORE, KA_PRINTS, kaCart,
   kaToast, kaModal, kaForms (config.js / products.js / core.js / prints.js /
   app.js). */
(function () {
  'use strict';

  var root = document.getElementById('makersRoot');
  if (!root) return;

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
    }, { threshold: 0.1 });
    els.forEach(function (el) { io.observe(el); });
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

  function pieceCard(p) {
    var href = 'product.html?id=' + encodeURIComponent(p.id);
    if (p.sold) {
      return '<div class="prod-card sold">'
        + '<a class="prod-img" href="' + href + '" aria-label="' + KA_CORE.escapeHtml(p.name) + ' — sold, view this piece">'
        + '<span class="sold-tag">Sold</span><img decoding="async" src="' + p.img + '" alt="' + KA_CORE.escapeHtml(p.name) + '" loading="lazy"></a>'
        + '<span class="btn btn-solid">Sold out</span>'
        + '<div class="prod-meta"><a href="' + href + '"><p class="prod-name">' + KA_CORE.escapeHtml(p.name) + '</p></a>'
        + '<p class="prod-price">' + KA_CORE.money(p.price) + '</p></div></div>';
    }
    return '<div class="prod-card">'
      + '<a class="prod-img" href="' + href + '"><img decoding="async" src="' + p.img + '" alt="' + KA_CORE.escapeHtml(p.name) + '" loading="lazy"></a>'
      + '<button type="button" class="btn btn-solid" data-add="' + p.id + '">Add to cart</button>'
      + '<div class="prod-meta"><a href="' + href + '"><p class="prod-name">' + KA_CORE.escapeHtml(p.name) + '</p></a>'
      + '<p class="prod-price">' + KA_CORE.money(p.price) + '</p></div></div>';
  }

  function swatchTile(pr) {
    var svg = KA_PRINTS.tileSvg(pr.def, { size: 96 });
    var label = pr.meaning ? (pr.name + ' — ' + pr.meaning) : pr.name;
    return '<a class="swatch-tile" href="studio.html#print=' + encodeURIComponent(pr.id) + '" title="' + KA_CORE.escapeHtml(label) + '" aria-label="Design with ' + KA_CORE.escapeHtml(pr.name) + ' in the Tee Studio">'
      + svg + '</a>';
  }

  function notifyFormHtml(slug) {
    var uid = 'notify-' + slug;
    return '<form class="notify-form" data-notify="' + slug + '" novalidate>'
      + '<label class="sr-only" for="' + uid + '">Email address</label>'
      + '<div class="notify-row">'
      + '<input type="email" class="input" id="' + uid + '" name="email" placeholder="you@email.com" autocomplete="email" required>'
      + '<button type="submit" class="btn btn-gold">Get notified</button>'
      + '</div><p class="notify-status" role="status" aria-live="polite"></p></form>';
  }

  function wireNotifyForms(scope) {
    scope.querySelectorAll('[data-notify]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var maker = form.dataset.notify;
        var input = form.querySelector('input[type="email"]');
        var status = form.querySelector('.notify-status');
        var row = form.querySelector('.notify-row');
        var btn = form.querySelector('button[type="submit"]');
        var email = input.value.trim();
        if (!KA_CORE.validate.email(email)) {
          status.textContent = 'Enter a valid email address.';
          status.className = 'notify-status err';
          input.setAttribute('aria-invalid', 'true');
          input.focus();
          return;
        }
        input.removeAttribute('aria-invalid');
        btn.disabled = true;
        btn.textContent = 'Sending…';
        kaForms.submit('notify', { maker: maker, email: email }).then(function (res) {
          btn.disabled = false;
          btn.textContent = 'Get notified';
          if (res && res.ok) {
            row.hidden = true;
            status.className = 'notify-status ok';
            status.textContent = "You're on the list — we'll email you the moment it drops.";
          } else {
            status.className = 'notify-status err';
            status.textContent = 'Something went wrong. Try again, or email ' + KA_CONFIG.contactEmail + ' directly.';
          }
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = 'Get notified';
          status.className = 'notify-status err';
          status.textContent = 'Something went wrong. Try again, or email ' + KA_CONFIG.contactEmail + ' directly.';
        });
      });
    });
  }

  function section(m, idx) {
    var prints = (window.KA_PRINTS ? KA_PRINTS.list() : []).filter(function (pr) { return pr.maker === m.slug; });
    var pieces = KA_PRODUCTS.filter(function (p) { return p.maker === m.slug; });
    var isLive = m.status === 'live';
    var badge = isLive ? '<span class="badge live">Now live</span>' : '<span class="badge">Upcoming</span>';
    var swatchHtml = prints.length
      ? '<div class="swatch-strip">' + prints.map(swatchTile).join('') + '</div>'
      : '<p class="mp-empty">No published prints from ' + KA_CORE.escapeHtml(m.name) + ' yet.</p>';
    var piecesHtml = pieces.length
      ? '<div class="prod-grid">' + pieces.map(pieceCard).join('') + '</div>'
      : '<p class="mp-empty">No pieces from this series yet — check back after the drop.</p>';
    var notify = isLive ? '' : '<div class="mp-notify">' + notifyFormHtml(m.slug) + '</div>';
    var cta = isLive
      ? '<div class="mp-cta"><a class="btn btn-gold" href="shop.html?collection=' + encodeURIComponent(m.collection) + '">Shop the ' + KA_CORE.escapeHtml(m.series) + ' series →</a></div>'
      : '';
    return '<section class="maker-profile reveal' + (idx % 2 ? ' alt' : '') + '" id="' + m.slug + '">'
      + '<div class="wrap">'
      + '<div class="mp-head">' + badge + '<h2>' + KA_CORE.escapeHtml(m.name) + '</h2>'
      + '<span class="mp-series">' + KA_CORE.escapeHtml(m.series) + '</span>'
      + '<span class="mp-city">' + KA_CORE.escapeHtml(m.city) + '</span></div>'
      + '<p class="mp-bio">' + KA_CORE.escapeHtml(m.long) + '</p>'
      + notify
      + '<p class="mp-section-label">The prints</p>' + swatchHtml
      + '<p class="mp-section-label">The pieces</p>' + piecesHtml
      + cta
      + '</div></section>';
  }

  var makers = Array.isArray(window.KA_MAKERS) ? KA_MAKERS : [];
  if (!makers.length) {
    root.innerHTML = '<div class="wrap"><div class="empty-state"><p class="es-title">Nothing here yet</p>'
      + '<p class="es-copy">Maker profiles are being written up — check back shortly.</p></div></div>';
  } else {
    root.innerHTML = makers.map(section).join('');
  }

  root.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () { openSizePicker(KA_CORE.findProduct(btn.dataset.add)); });
  });
  wireNotifyForms(root);
  observeReveal(root.querySelectorAll('.reveal'));

  /* Deep link from index.html / nav (#slug): content wasn't in the DOM yet
     when the browser tried to jump to the hash on load. */
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
  }
})();
