/* KHARIS & ALETHEIA — product.js
   Product detail: gallery, size selector + size guide, qty, add to cart, sold state,
   wishlist, share, accordions (details/care/delivery/the print), maker attribution,
   recently viewed, related products, JSON-LD, title/meta.
   Reads window.KA_PRODUCTS / KA_CAT_LABEL / KA_COLLECTIONS / KA_MAKERS (products.js),
   window.KA_CORE / KA_CONFIG (core.js / config.js),
   window.kaCart / kaWishlist / kaToast / kaModal (app.js).
   Coded against CONTRACT.md — these globals are assumed to exist. */

(function () {
  'use strict';

  var root = document.getElementById('productRoot');

  var PRODUCTS = window.KA_PRODUCTS || [];
  var CAT_LABEL = window.KA_CAT_LABEL || {};
  var COLLECTIONS = window.KA_COLLECTIONS || [];
  var MAKERS = window.KA_MAKERS || [];
  var esc = KA_CORE.escapeHtml;
  var money = KA_CORE.money;

  var SIZES_FULL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  var RECENT_KEY = 'ka_recent';
  var RECENT_MAX = 6;

  /* ---------- size guide tables (verbatim from sizing.html — keep in sync) ---------- */
  var TEE_TABLE = {
    head: SIZES_FULL,
    rows: [
      ['Chest width', '19 5/8"', '20 1/2"', '21 1/4"', '22"', '23 1/4"', '24 3/8"', '25 5/8"'],
      ['Body length', '24 1/4"', '25 1/4"', '26 1/8"', '27 1/8"', '28 1/8"', '29 1/8"', '30 1/8"'],
      ['Sleeve length', '8 1/4"', '8 5/8"', '9"', '9 1/2"', '10"', '10 7/8"', '11 1/4"']
    ]
  };
  var CREW_TABLE = {
    head: SIZES_FULL,
    rows: [
      ['Chest width', '21 1/8"', '22"', '22 3/4"', '23 1/2"', '24 3/4"', '26"', '27 1/4"'],
      ['Body length', '25 3/8"', '26 1/2"', '27 3/8"', '28 1/4"', '29 3/8"', '30 1/2"', '31 3/4"'],
      ['Sleeve length', '19 1/4"', '20"', '20 3/4"', '21 3/4"', '22 5/8"', '23 1/2"', '24 3/8"']
    ]
  };
  var HOODIE_TABLE = {
    head: SIZES_FULL,
    rows: [
      ['Chest width', '20 1/2"', '21 1/2"', '22 1/2"', '23 1/2"', '24 1/2"', '25 3/4"', '27"'],
      ['Body length', '24 1/4"', '25 3/4"', '27"', '28"', '29"', '30"', '31"'],
      ['Sleeve length', '20 1/4"', '21 3/4"', '23"', '24"', '25"', '26"', '27"']
    ]
  };

  var CARE_COPY = {
    tees: 'Machine wash cold, inside out, with similar colours. Tumble dry low or line dry. Do not iron directly over the print — turn the garment inside out first, or use a pressing cloth. Do not dry clean.',
    sweatshirts: 'Machine wash cold, inside out. Reshape and lay flat to dry for the best fit — tumble dry low if you need to. Do not iron the print directly. Do not dry clean.',
    accessories: 'Spot clean with a damp cloth. Do not machine wash, soak or tumble dry — this keeps the shape and the print sharp.'
  };

  /* ---------- helpers ---------- */

  function heartSvg(active) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="' + (active ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4.5c2 0 3.6 1.1 4.4 2.7.8-1.6 2.4-2.7 4.4-2.7C18 4.5 19.6 8 22 11.7 19.5 16.4 12 21 12 21z"/></svg>';
  }
  function shareSvg() {
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4"/></svg>';
  }

  function setMeta(description) {
    var m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
    }
    m.setAttribute('content', description);
  }

  /* keep og: and twitter: meta in sync with the per-product title/description/url so a shared
     product link carries the real piece, not the generic fallback baked into product.html */
  function setSocialMeta(title, description, url) {
    var setters = [
      ['meta[property="og:title"]', 'content', title],
      ['meta[property="og:description"]', 'content', description],
      ['meta[property="og:url"]', 'content', url],
      ['meta[name="twitter:title"]', 'content', title],
      ['meta[name="twitter:description"]', 'content', description],
      ['link[rel="canonical"]', 'href', url]
    ];
    setters.forEach(function (s) {
      var el = document.querySelector(s[0]);
      if (el) el.setAttribute(s[1], s[2]);
    });
  }

  function findCollection(slug) {
    return COLLECTIONS.filter(function (c) { return c.slug === slug; })[0];
  }
  function findMaker(slug) {
    return MAKERS.filter(function (m) { return m.slug === slug; })[0];
  }

  /* ---------- not-found state ---------- */

  function renderNotFound(rawId) {
    document.title = 'Piece not found — KHARIS & ALETHEIA';
    setMeta('That piece could not be found. Browse the full Kharis & Aletheia collection instead.');
    setSocialMeta(document.title, 'That piece could not be found. Browse the full Kharis & Aletheia collection instead.', location.href);
    var safeId = esc(String(rawId || ''));
    root.innerHTML =
      '<section class="page-hero plain" style="min-height:52vh">' +
        '<div class="wrap">' +
          '<p class="micro">404 · Piece not found</p>' +
          '<h1 class="h-display glitch glitch-anim" data-text="THAT ONE’S NOT HERE">THAT ONE’S NOT HERE</h1>' +
          '<p class="lede">' + (safeId
            ? 'We couldn’t find a piece matching “' + safeId + '”.'
            : 'No piece was specified.') +
            ' It may have sold out and rotated off, or the link’s off a little.</p>' +
          '<div class="notfound-actions">' +
            '<a class="btn btn-solid" href="shop.html">Back to shop →</a>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* ---------- size guide modal ---------- */

  function openSizeGuide(p) {
    var isHoodie = p.cat === 'sweatshirts' && /hood/i.test(p.name + ' ' + (p.details || ''));
    var table = isHoodie ? HOODIE_TABLE : (p.cat === 'tees' ? TEE_TABLE : CREW_TABLE);
    var label = isHoodie ? 'Hoodies' : (p.cat === 'tees' ? 'Tees' : 'Sweatshirts & Crewnecks');
    var html = '<div class="ka-modal-sizeguide">' +
      '<p class="micro">Size guide</p>' +
      '<h2 class="h-display h-md">' + label + '</h2>' +
      '<div class="size-table"><table>' +
        '<thead><tr><th>Size</th>' + table.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>' +
        '<tbody>' + table.rows.map(function (r) {
          return '<tr><th>' + r[0] + '</th>' + r.slice(1).map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody>' +
      '</table></div>' +
      '<p class="modal-note">All measurements in inches. Between sizes? Size up for a relaxed drape.</p>' +
      '<a class="btn btn-gold" href="sizing.html">Full size charts →</a>' +
    '</div>';
    kaModal.open(html, { label: 'Size guide — ' + label });
  }

  /* ---------- quick-add (used by related-product cards) ---------- */

  function openSizePicker(p, onAdded) {
    var html = '<div class="ka-modal-quickadd">' +
      '<p class="micro">' + p.name + '</p>' +
      '<h2 class="h-display h-md">Choose your size</h2>' +
      '<div class="size-group" role="radiogroup" aria-label="Size">' +
        SIZES_FULL.map(function (s, i) {
          var sid = 'rel-size-' + s;
          return '<input type="radio" name="relSize" id="' + sid + '" value="' + s + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<label for="' + sid + '">' + s + '</label>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-solid" type="button" id="relConfirm">Add to cart</button>' +
    '</div>';
    kaModal.open(html, { label: 'Choose your size — ' + p.name });
    var confirmBtn = document.getElementById('relConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        var checked = document.querySelector('input[name="relSize"]:checked');
        var size = checked ? checked.value : SIZES_FULL[0];
        kaCart.add(p.id, size, 1);
        kaModal.close();
        kaToast(p.name + ' added — ' + size, 'ok');
        if (onAdded) onAdded();
      });
    }
  }

  /* ---------- mini product cards (related) ---------- */

  function relatedCardHtml(p) {
    var wished = kaWishlist.has(p.id);
    var href = 'product.html?id=' + encodeURIComponent(p.id);
    return '<div class="prod-card" data-card="' + p.id + '">' +
      '<div class="prod-img-wrap" style="position:relative">' +
        '<a class="prod-img" href="' + href + '"><img decoding="async" src="' + p.img + '" alt="' + p.name + '" loading="lazy"></a>' +
        '<button type="button" class="wish-heart" data-wish="' + p.id + '" style="position:absolute;top:.6rem;right:.6rem" ' +
          'aria-pressed="' + wished + '" aria-label="' + (wished ? 'Remove from wishlist' : 'Add to wishlist') + '">' +
          heartSvg(wished) +
        '</button>' +
      '</div>' +
      '<button class="btn btn-solid" type="button" data-add="' + p.id + '">Add to cart</button>' +
      '<div class="prod-meta">' +
        '<a href="' + href + '"><p class="prod-name">' + p.name + '</p></a>' +
        '<p class="prod-price">' + money(p.price) + '</p>' +
      '</div>' +
    '</div>';
  }

  function wireRelatedEvents(container) {
    container.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rp = PRODUCTS.filter(function (x) { return x.id === btn.getAttribute('data-add'); })[0];
        if (!rp) return;
        if (rp.oneSize) {
          kaCart.add(rp.id, 'ONE SIZE', 1);
          kaToast(rp.name + ' added to cart', 'ok');
        } else {
          openSizePicker(rp);
        }
      });
    });
    container.querySelectorAll('[data-wish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-wish');
        kaWishlist.toggle(id);
        var active = kaWishlist.has(id);
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
        btn.innerHTML = heartSvg(active);
      });
    });
  }

  /* ---------- recently viewed ---------- */

  function readRecent() {
    try {
      var raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (id) { return typeof id === 'string'; });
    } catch (e) { return []; }
  }

  function writeRecent(list) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch (e) { /* storage unavailable — non-fatal */ }
  }

  function recentlyViewedHtml(p) {
    var stored = readRecent();
    var valid = stored
      .filter(function (id) { return id !== p.id; })
      .map(function (id) { return PRODUCTS.filter(function (x) { return x.id === id; })[0]; })
      .filter(Boolean)
      .slice(0, RECENT_MAX);

    /* persist current product to the front of the list for next time */
    writeRecent([p.id].concat(stored.filter(function (id) { return id !== p.id; })));

    if (!valid.length) return '';
    return '<div class="recently-viewed">' +
      '<p class="micro">Your recent pieces</p>' +
      '<h2 class="h-display h-md">RECENTLY VIEWED</h2>' +
      '<div class="rv-strip">' +
        valid.map(function (r) {
          var href = 'product.html?id=' + encodeURIComponent(r.id);
          return '<a class="rv-card" href="' + href + '">' +
            '<div class="prod-img"><img decoding="async" src="' + r.img + '" alt="' + r.name + '" loading="lazy"></div>' +
            '<p class="prod-name">' + r.name + '</p>' +
            '<p class="prod-price">' + money(r.price) + '</p>' +
          '</a>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  /* ---------- related products ---------- */

  function relatedProducts(p) {
    return PRODUCTS.filter(function (x) { return x.cat === p.cat && x.id !== p.id && !x.sold; }).slice(0, 4);
  }

  /* ---------- accordions ---------- */

  function accordionItem(id, title, bodyHtml, open) {
    return '<div class="acc-item">' +
      '<button type="button" class="acc-trigger" id="' + id + 'Btn" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="' + id + 'Panel">' +
        '<span>' + title + '</span><span class="acc-icon" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="acc-panel" id="' + id + 'Panel" role="region" aria-labelledby="' + id + 'Btn"' + (open ? '' : ' hidden') + '">' +
        bodyHtml +
      '</div>' +
    '</div>';
  }

  function wireAccordions(container) {
    var triggers = Array.prototype.slice.call(container.querySelectorAll('.acc-trigger'));
    triggers.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); (triggers[i + 1] || triggers[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (triggers[i - 1] || triggers[triggers.length - 1]).focus(); }
        else if (e.key === 'Home') { e.preventDefault(); triggers[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); triggers[triggers.length - 1].focus(); }
      });
    });
  }

  /* ---------- share ---------- */

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function wireShare(btn, p) {
    btn.addEventListener('click', function () {
      var url = location.href;
      if (navigator.share) {
        navigator.share({ title: p.name + ' — KHARIS & ALETHEIA', text: p.blurb, url: url }).catch(function () { /* user cancelled */ });
      } else {
        copyToClipboard(url).then(function () {
          kaToast('Link copied', 'ok');
        }).catch(function () {
          kaToast('Could not copy — copy the link from the address bar', 'err');
        });
      }
    });
  }

  /* ---------- wishlist wiring (main product) ---------- */

  function wireWish(btn, p) {
    function sync() {
      var active = kaWishlist.has(p.id);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
      btn.innerHTML = heartSvg(active);
    }
    sync();
    btn.addEventListener('click', function () { kaWishlist.toggle(p.id); sync(); });
    if (typeof kaWishlist.onChange === 'function') kaWishlist.onChange(sync);
  }

  /* ---------- JSON-LD ---------- */

  function injectJsonLd(p, sold) {
    var siteUrl = (window.KA_CONFIG && KA_CONFIG.siteUrl ? KA_CONFIG.siteUrl : '').replace(/\/$/, '');
    var imgPath = String(p.img || '').replace(/^\.?\//, '');
    var ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      image: siteUrl ? [siteUrl + '/' + imgPath] : [p.img],
      description: p.blurb,
      sku: p.id,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'GBP',
        price: String(p.price),
        availability: sold ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: siteUrl ? siteUrl + '/product.html?id=' + encodeURIComponent(p.id) : location.href
      }
    };
    var existing = document.getElementById('pdJsonLd');
    if (existing) existing.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'pdJsonLd';
    s.textContent = JSON.stringify(ld).replace(/</g, '\\u003c');
    document.head.appendChild(s);
  }

  /* ---------- main render ---------- */

  function renderProduct(p) {
    var sold = !!p.sold;
    var catLabel = CAT_LABEL[p.cat] || p.cat;
    var sizes = p.oneSize ? ['ONE SIZE'] : SIZES_FULL;
    var col = findCollection(p.collection);
    var maker = findMaker(p.maker);
    var leadTime = (window.KA_CONFIG && KA_CONFIG.leadTime) ? KA_CONFIG.leadTime : '7–10 working days';

    document.title = p.name + ' — KHARIS & ALETHEIA';
    setMeta((p.blurb || '').slice(0, 155));
    setSocialMeta(document.title, (p.blurb || '').slice(0, 155), location.href);

    var gallery =
      '<div class="pd-gallery">' +
        '<div class="pd-main" id="pdMain"><img decoding="async" src="' + p.img + '" alt="' + p.name + '"></div>' +
        /* One photo per product — these are zoom crops of it, not separate shots, so the
           labels read as a zoom control rather than promising multiple photographs. */
        '<div class="pd-thumbs">' +
          '<button type="button" class="on" data-view="full" aria-label="Full view"><img decoding="async" src="' + p.img + '" alt=""></button>' +
          '<button type="button" class="t-top" data-view="zoom-top" aria-label="Zoom in — top"><img decoding="async" src="' + p.img + '" alt=""></button>' +
          '<button type="button" class="t-detail" data-view="zoom-detail" aria-label="Zoom in — print"><img decoding="async" src="' + p.img + '" alt=""></button>' +
        '</div>' +
      '</div>';

    var makerHtml = maker
      ? '<a class="pd-maker" href="makers.html#' + encodeURIComponent(maker.slug) + '">' +
          '<span class="pd-maker-label">Made by</span>' +
          '<span class="pd-maker-name">' + maker.name + '</span>' +
          (maker.series ? '<span class="pd-maker-series">· ' + maker.series + '</span>' : '') +
        '</a>'
      : '';

    var infoBody;
    if (sold) {
      infoBody =
        '<p class="sold-price">Sold — one of one</p>' +
        makerHtml +
        '<p class="blurb">' + p.blurb + '</p>' +
        '<p class="sold-copy">This exact placement is gone — cut once, never repeated. Build your own version from scratch in the Tee Studio.</p>' +
        '<div class="pd-actions">' +
          '<a class="btn btn-berry" href="studio.html" style="flex:1;justify-content:center">Make your own →</a>' +
          '<button class="wish-btn" type="button" id="pdWish" aria-label="Add to wishlist" aria-pressed="false">' + heartSvg(false) + '</button>' +
          '<button class="share-btn" type="button" id="pdShare" aria-label="Share this piece">' + shareSvg() + ' Share</button>' +
        '</div>';
    } else {
      infoBody =
        '<p class="pd-price-line">' + money(p.price) + '</p>' +
        makerHtml +
        '<p class="blurb">' + p.blurb + '</p>' +
        (p.oneSize
          ? '<div class="pd-field"><label>Size</label><p style="color:var(--muted);font-size:.82rem">One size fits most.</p></div>'
          : '<div class="pd-field">' +
              '<div class="pd-size-head">' +
                '<label id="pdSizeLabel">Size</label>' +
                '<button type="button" class="size-guide-link" id="findMySize">Find my size</button>' +
              '</div>' +
              '<div class="size-group" role="radiogroup" aria-labelledby="pdSizeLabel">' +
                sizes.map(function (s, i) {
                  var sid = 'pd-size-' + s;
                  return '<input type="radio" name="pdSize" id="' + sid + '" value="' + s + '"' + (i === 0 ? ' checked' : '') + '>' +
                    '<label for="' + sid + '">' + s + '</label>';
                }).join('') +
              '</div>' +
            '</div>') +
        '<div class="pd-field">' +
          '<label for="pdQty">Quantity</label>' +
          '<div class="qty-stepper">' +
            '<button type="button" id="qtyDec" aria-label="Decrease quantity">−</button>' +
            '<input type="number" id="pdQty" min="1" max="20" value="1" inputmode="numeric">' +
            '<button type="button" id="qtyInc" aria-label="Increase quantity">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="pd-actions">' +
          '<button class="btn btn-solid" type="button" id="pdAdd">Add to cart</button>' +
          '<button class="wish-btn" type="button" id="pdWish" aria-label="Add to wishlist" aria-pressed="false">' + heartSvg(false) + '</button>' +
          '<button class="share-btn" type="button" id="pdShare" aria-label="Share this piece">' + shareSvg() + ' Share</button>' +
        '</div>' +
        '<p class="lead-time-note">Made to order · ships in ' + leadTime + '</p>';
    }

    /* Collection pieces get dedicated print-story copy; pieces with no collection have no copy
       distinct from the blurb already shown above, so the accordion is skipped rather than
       repeating the same sentence a second time on the same screen. */
    var printBody = col
      ? '<p class="micro">' + (col.tag || 'Collection') + '</p><p><b>' + col.name + '</b></p><p>' + (col.blurb || '') + '</p>'
      : '';

    var accordionsHtml =
      '<div class="pd-accordion" id="pdAccordion">' +
        accordionItem('accDetails', 'Details', '<p>' + (p.details || '') + '</p>', true) +
        accordionItem('accCare', 'Care', '<p>' + (CARE_COPY[p.cat] || CARE_COPY.tees) + '</p>', false) +
        accordionItem('accDelivery', 'Delivery &amp; returns',
          '<p>Cut and sewn after you order — production starts within 24 hours of purchase, and pieces ship in ' + leadTime + '.</p>' +
          '<p>Because each piece is made for you, we can’t accept change-of-mind returns once production has started. If it arrives faulty, damaged, or not as ordered, contact us within 14 days of delivery and we’ll remake it or refund it in full.</p>' +
          '<p>Orders can be cancelled for a full refund within 24 hours of purchase, before the cloth is cut. <a href="policies.html">Read the full refund policy &amp; terms →</a></p>',
          false) +
        (printBody ? accordionItem('accPrint', 'The print', printBody, false) : '') +
      '</div>';

    var relatedList = relatedProducts(p);
    var relatedHtml = relatedList.length
      ? '<div class="related">' +
          '<p class="micro">Keep looking</p>' +
          '<h2 class="h-display h-md">MORE ' + catLabel.toUpperCase() + '</h2>' +
          '<div class="prod-grid">' + relatedList.map(relatedCardHtml).join('') + '</div>' +
        '</div>'
      : '';

    var recentHtml = recentlyViewedHtml(p);

    root.innerHTML =
      '<section class="page-hero" style="min-height:34vh">' +
        '<img decoding="async" class="ph-img" src="' + p.img + '" alt="" style="filter:blur(14px) brightness(.5);transform:scale(1.15)">' +
        '<div class="ph-veil"></div>' +
        '<div class="wrap">' +
          '<p class="micro">Kharis &amp; Aletheia · ' + catLabel + '</p>' +
          '<h1 class="h-display glitch glitch-anim" data-text="' + p.name + '">' + p.name + '</h1>' +
        '</div>' +
      '</section>' +
      '<div class="wrap">' +
        '<div class="pd-layout">' +
          gallery +
          '<div class="pd-info">' +
            '<a class="pd-back" href="shop.html">← Back to shop</a>' +
            '<h2 class="h-display glitch pd-title" data-text="' + p.name + '">' + p.name + '</h2>' +
            infoBody +
          '</div>' +
        '</div>' +
        accordionsHtml +
        recentHtml +
        relatedHtml +
      '</div>';

    /* ---- wire gallery ---- */
    var main = root.querySelector('#pdMain');
    root.querySelectorAll('.pd-thumbs button').forEach(function (b) {
      b.addEventListener('click', function () {
        root.querySelectorAll('.pd-thumbs button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        main.className = 'pd-main ' + (b.getAttribute('data-view') === 'full' ? '' : b.getAttribute('data-view'));
      });
    });

    /* ---- wire accordions ---- */
    wireAccordions(root.querySelector('#pdAccordion'));

    /* ---- wire size guide ---- */
    var findBtn = root.querySelector('#findMySize');
    if (findBtn) findBtn.addEventListener('click', function () { openSizeGuide(p); });

    /* ---- wire wish + share (present in both sold/unsold states) ---- */
    var wishBtn = root.querySelector('#pdWish');
    if (wishBtn) wireWish(wishBtn, p);
    var shareBtn = root.querySelector('#pdShare');
    if (shareBtn) wireShare(shareBtn, p);

    /* ---- wire qty + add to cart (unsold only) ---- */
    if (!sold) {
      var qtyInput = root.querySelector('#pdQty');
      var decBtn = root.querySelector('#qtyDec');
      var incBtn = root.querySelector('#qtyInc');
      if (decBtn) decBtn.addEventListener('click', function () {
        qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
      });
      if (incBtn) incBtn.addEventListener('click', function () {
        qtyInput.value = Math.min(20, (parseInt(qtyInput.value, 10) || 1) + 1);
      });
      if (qtyInput) qtyInput.addEventListener('change', function () {
        var v = parseInt(qtyInput.value, 10);
        if (!isFinite(v)) v = 1;
        qtyInput.value = Math.max(1, Math.min(20, v));
      });

      var addBtn = root.querySelector('#pdAdd');
      if (addBtn) addBtn.addEventListener('click', function () {
        var checked = root.querySelector('input[name="pdSize"]:checked');
        var size = checked ? checked.value : sizes[0];
        var qty = Math.max(1, Math.min(20, parseInt(qtyInput.value, 10) || 1));
        kaCart.add(p.id, size, qty);
        kaToast(p.name + ' added — ' + size + (qty > 1 ? ' ×' + qty : ''), 'ok');
      });
    }

    /* ---- wire related cards ---- */
    var relatedContainer = root.querySelector('.related');
    if (relatedContainer) wireRelatedEvents(relatedContainer);

    /* ---- JSON-LD ---- */
    injectJsonLd(p, sold);
  }

  /* ---------- init ---------- */

  var idParam = new URLSearchParams(location.search).get('id');
  var product = KA_CORE.findProduct(idParam);
  if (product) renderProduct(product);
  else renderNotFound(idParam);

})();
