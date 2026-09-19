/* KHARIS & ALETHEIA — home.js (index.html only)
   Renders the signature + custom-print grids and the makers teaser straight
   from the shared catalog (so the homepage can never drift from the shop),
   wires the size quick-pick, the upcoming-maker notify form and the
   newsletter band.
   Depends on: KA_CONFIG, KA_PRODUCTS, KA_MAKERS, KA_CORE, kaCart, kaToast,
   kaModal, kaForms (config.js / products.js / core.js / app.js). */
(function () {
  'use strict';

  /* ---------- scroll-reveal for content this script injects ----------
     app.js's own IntersectionObserver only ever sees elements that exist
     in the DOM at the moment app.js runs, which is before this script has
     rendered anything into the grids below. Re-observe our own .reveal
     nodes so they still animate in; prefers-reduced-motion is already
     handled globally by styles.css (.reveal{opacity:1} + transitions
     killed), so no extra branching is needed here. */
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

  /* ---------- size quick-pick ---------- */
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

  /* ---------- product cards ---------- */
  function productCard(p) {
    var href = 'product.html?id=' + encodeURIComponent(p.id);
    return '<div class="prod-card">'
      + '<a class="prod-img" href="' + href + '"><img decoding="async" src="' + p.img + '" alt="' + KA_CORE.escapeHtml(p.name) + '" loading="lazy"></a>'
      + '<button type="button" class="btn btn-solid" data-add="' + p.id + '">Add to cart</button>'
      + '<div class="prod-meta"><a href="' + href + '"><p class="prod-name">' + KA_CORE.escapeHtml(p.name) + '</p></a>'
      + '<p class="prod-price">' + KA_CORE.money(p.price) + '</p></div>'
      + '</div>';
  }
  function soldCard(p) {
    var href = 'product.html?id=' + encodeURIComponent(p.id);
    return '<div class="prod-card sold">'
      + '<a class="prod-img" href="' + href + '" aria-label="' + KA_CORE.escapeHtml(p.name) + ' — sold, view this piece">'
      + '<span class="sold-tag">Sold</span><img decoding="async" src="' + p.img + '" alt="' + KA_CORE.escapeHtml(p.name) + '" loading="lazy"></a>'
      + '<span class="btn btn-solid">Sold out</span>'
      + '<div class="prod-meta"><a href="' + href + '"><p class="prod-name">' + KA_CORE.escapeHtml(p.name) + '</p></a>'
      + '<p class="prod-price">' + KA_CORE.money(p.price) + '</p></div>'
      + '</div>';
  }

  function renderSignature() {
    var grid = document.getElementById('homeSignatureGrid');
    if (!grid) return;
    var items = KA_PRODUCTS.filter(function (p) { return p.cat === 'tees' && !p.sold; }).slice(0, 4);
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state"><p class="es-title">Nothing here yet</p>'
        + '<p class="es-copy">The signature line is being re-cut — check back shortly.</p></div>';
      return;
    }
    grid.innerHTML = items.map(productCard).join('');
    grid.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () { openSizePicker(KA_CORE.findProduct(btn.dataset.add)); });
    });
  }

  function renderCustomPrints() {
    var grid = document.getElementById('homeCustomGrid');
    if (!grid) return;
    var items = KA_PRODUCTS.filter(function (p) { return p.collection === 'custom-prints' && p.sold; });
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state"><p class="es-title">Nothing here yet</p>'
        + '<p class="es-copy">No archived custom cuts yet — the first one-of-ones drop soon.</p></div>';
      return;
    }
    grid.innerHTML = items.map(soldCard).join('');
  }

  /* ---------- upcoming-maker notify form ---------- */
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

  /* ---------- makers teaser ---------- */
  function makerTeaserCard(m, idx) {
    var isLive = m.status === 'live';
    var badge = isLive ? '<span class="badge live">Now live</span>' : '<span class="badge">Upcoming</span>';
    var action = isLive
      ? '<a class="link-arrow" href="makers.html#' + m.slug + '">Shop the series →</a>'
      : notifyFormHtml(m.slug);
    return '<article class="maker-card reveal d' + ((idx % 3) + 1) + '">'
      + badge
      + '<h3><a href="makers.html#' + m.slug + '">' + KA_CORE.escapeHtml(m.name) + '</a></h3>'
      + '<p class="sub">' + KA_CORE.escapeHtml(m.series) + '</p>'
      + '<p>' + KA_CORE.escapeHtml(m.bio) + '</p>'
      + action
      + '</article>';
  }

  function renderMakers() {
    var grid = document.getElementById('homeMakersGrid');
    if (!grid) return;
    var makers = Array.isArray(window.KA_MAKERS) ? KA_MAKERS : [];
    if (!makers.length) {
      grid.innerHTML = '<div class="empty-state"><p class="es-title">Nothing here yet</p>'
        + '<p class="es-copy">Maker profiles are being written up — check back shortly.</p></div>';
      return;
    }
    grid.innerHTML = makers.map(makerTeaserCard).join('');
    wireNotifyForms(grid);
    observeReveal(grid.querySelectorAll('.reveal'));
  }

  /* ---------- newsletter band ---------- */
  function wireNewsletter() {
    var form = document.getElementById('newsletterForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('nlEmail');
      var status = document.getElementById('nlStatus');
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
      btn.textContent = 'Signing up…';
      kaForms.submit('newsletter', { email: email }).then(function (res) {
        btn.disabled = false;
        btn.textContent = 'Sign up →';
        if (res && res.ok) {
          form.querySelector('.nl-row').hidden = true;
          status.className = 'notify-status ok';
          status.textContent = "You're in — welcome to the list.";
        } else {
          status.className = 'notify-status err';
          status.textContent = 'Something went wrong. Try again, or email ' + KA_CONFIG.contactEmail + ' directly.';
        }
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'Sign up →';
        status.className = 'notify-status err';
        status.textContent = 'Something went wrong. Try again, or email ' + KA_CONFIG.contactEmail + ' directly.';
      });
    });
  }

  renderSignature();
  renderCustomPrints();
  renderMakers();
  wireNewsletter();
})();
