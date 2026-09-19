/* KHARIS & ALETHEIA — checkout
   Renders the two-column checkout (form + sticky order summary), wires
   validation, shipping/promo/total recompute, draft persistence and the
   payment adapter (request / paystack). Owns: checkout.html checkout.js
   checkout.css order.html order.js — see CONTRACT.md "checkout" row. */

(function () {
  'use strict';

  const root = document.getElementById('checkoutRoot');
  if (!root) return;

  const DRAFT_KEY = 'ka_checkout_draft';
  const ORDERS_KEY = 'ka_orders';

  /* ---------- full ISO 3166-1 country list (code, English name) ---------- */
  const COUNTRIES = [{"code":"AF","name":"Afghanistan"},{"code":"AX","name":"Åland Islands"},{"code":"AL","name":"Albania"},{"code":"DZ","name":"Algeria"},{"code":"AS","name":"American Samoa"},{"code":"AD","name":"Andorra"},{"code":"AO","name":"Angola"},{"code":"AI","name":"Anguilla"},{"code":"AQ","name":"Antarctica"},{"code":"AG","name":"Antigua & Barbuda"},{"code":"AR","name":"Argentina"},{"code":"AM","name":"Armenia"},{"code":"AW","name":"Aruba"},{"code":"AU","name":"Australia"},{"code":"AT","name":"Austria"},{"code":"AZ","name":"Azerbaijan"},{"code":"BS","name":"Bahamas"},{"code":"BH","name":"Bahrain"},{"code":"BD","name":"Bangladesh"},{"code":"BB","name":"Barbados"},{"code":"BY","name":"Belarus"},{"code":"BE","name":"Belgium"},{"code":"BZ","name":"Belize"},{"code":"BJ","name":"Benin"},{"code":"BM","name":"Bermuda"},{"code":"BT","name":"Bhutan"},{"code":"BO","name":"Bolivia"},{"code":"BA","name":"Bosnia & Herzegovina"},{"code":"BW","name":"Botswana"},{"code":"BV","name":"Bouvet Island"},{"code":"BR","name":"Brazil"},{"code":"IO","name":"British Indian Ocean Territory"},{"code":"VG","name":"British Virgin Islands"},{"code":"BN","name":"Brunei"},{"code":"BG","name":"Bulgaria"},{"code":"BF","name":"Burkina Faso"},{"code":"BI","name":"Burundi"},{"code":"KH","name":"Cambodia"},{"code":"CM","name":"Cameroon"},{"code":"CA","name":"Canada"},{"code":"CV","name":"Cape Verde"},{"code":"BQ","name":"Caribbean Netherlands"},{"code":"KY","name":"Cayman Islands"},{"code":"CF","name":"Central African Republic"},{"code":"TD","name":"Chad"},{"code":"CL","name":"Chile"},{"code":"CN","name":"China"},{"code":"CX","name":"Christmas Island"},{"code":"CC","name":"Cocos (Keeling) Islands"},{"code":"CO","name":"Colombia"},{"code":"KM","name":"Comoros"},{"code":"CG","name":"Congo - Brazzaville"},{"code":"CD","name":"Congo - Kinshasa"},{"code":"CK","name":"Cook Islands"},{"code":"CR","name":"Costa Rica"},{"code":"CI","name":"Côte d’Ivoire"},{"code":"HR","name":"Croatia"},{"code":"CU","name":"Cuba"},{"code":"CW","name":"Curaçao"},{"code":"CY","name":"Cyprus"},{"code":"CZ","name":"Czechia"},{"code":"DK","name":"Denmark"},{"code":"DJ","name":"Djibouti"},{"code":"DM","name":"Dominica"},{"code":"DO","name":"Dominican Republic"},{"code":"EC","name":"Ecuador"},{"code":"EG","name":"Egypt"},{"code":"SV","name":"El Salvador"},{"code":"GQ","name":"Equatorial Guinea"},{"code":"ER","name":"Eritrea"},{"code":"EE","name":"Estonia"},{"code":"SZ","name":"Eswatini"},{"code":"ET","name":"Ethiopia"},{"code":"FK","name":"Falkland Islands"},{"code":"FO","name":"Faroe Islands"},{"code":"FJ","name":"Fiji"},{"code":"FI","name":"Finland"},{"code":"FR","name":"France"},{"code":"GF","name":"French Guiana"},{"code":"PF","name":"French Polynesia"},{"code":"TF","name":"French Southern Territories"},{"code":"GA","name":"Gabon"},{"code":"GM","name":"Gambia"},{"code":"GE","name":"Georgia"},{"code":"DE","name":"Germany"},{"code":"GH","name":"Ghana"},{"code":"GI","name":"Gibraltar"},{"code":"GR","name":"Greece"},{"code":"GL","name":"Greenland"},{"code":"GD","name":"Grenada"},{"code":"GP","name":"Guadeloupe"},{"code":"GU","name":"Guam"},{"code":"GT","name":"Guatemala"},{"code":"GG","name":"Guernsey"},{"code":"GN","name":"Guinea"},{"code":"GW","name":"Guinea-Bissau"},{"code":"GY","name":"Guyana"},{"code":"HT","name":"Haiti"},{"code":"HM","name":"Heard & McDonald Islands"},{"code":"HN","name":"Honduras"},{"code":"HK","name":"Hong Kong SAR China"},{"code":"HU","name":"Hungary"},{"code":"IS","name":"Iceland"},{"code":"IN","name":"India"},{"code":"ID","name":"Indonesia"},{"code":"IR","name":"Iran"},{"code":"IQ","name":"Iraq"},{"code":"IE","name":"Ireland"},{"code":"IM","name":"Isle of Man"},{"code":"IL","name":"Israel"},{"code":"IT","name":"Italy"},{"code":"JM","name":"Jamaica"},{"code":"JP","name":"Japan"},{"code":"JE","name":"Jersey"},{"code":"JO","name":"Jordan"},{"code":"KZ","name":"Kazakhstan"},{"code":"KE","name":"Kenya"},{"code":"KI","name":"Kiribati"},{"code":"KW","name":"Kuwait"},{"code":"KG","name":"Kyrgyzstan"},{"code":"LA","name":"Laos"},{"code":"LV","name":"Latvia"},{"code":"LB","name":"Lebanon"},{"code":"LS","name":"Lesotho"},{"code":"LR","name":"Liberia"},{"code":"LY","name":"Libya"},{"code":"LI","name":"Liechtenstein"},{"code":"LT","name":"Lithuania"},{"code":"LU","name":"Luxembourg"},{"code":"MO","name":"Macao SAR China"},{"code":"MG","name":"Madagascar"},{"code":"MW","name":"Malawi"},{"code":"MY","name":"Malaysia"},{"code":"MV","name":"Maldives"},{"code":"ML","name":"Mali"},{"code":"MT","name":"Malta"},{"code":"MH","name":"Marshall Islands"},{"code":"MQ","name":"Martinique"},{"code":"MR","name":"Mauritania"},{"code":"MU","name":"Mauritius"},{"code":"YT","name":"Mayotte"},{"code":"MX","name":"Mexico"},{"code":"FM","name":"Micronesia"},{"code":"MD","name":"Moldova"},{"code":"MC","name":"Monaco"},{"code":"MN","name":"Mongolia"},{"code":"ME","name":"Montenegro"},{"code":"MS","name":"Montserrat"},{"code":"MA","name":"Morocco"},{"code":"MZ","name":"Mozambique"},{"code":"MM","name":"Myanmar (Burma)"},{"code":"NA","name":"Namibia"},{"code":"NR","name":"Nauru"},{"code":"NP","name":"Nepal"},{"code":"NL","name":"Netherlands"},{"code":"NC","name":"New Caledonia"},{"code":"NZ","name":"New Zealand"},{"code":"NI","name":"Nicaragua"},{"code":"NE","name":"Niger"},{"code":"NG","name":"Nigeria"},{"code":"NU","name":"Niue"},{"code":"NF","name":"Norfolk Island"},{"code":"KP","name":"North Korea"},{"code":"MK","name":"North Macedonia"},{"code":"MP","name":"Northern Mariana Islands"},{"code":"NO","name":"Norway"},{"code":"OM","name":"Oman"},{"code":"PK","name":"Pakistan"},{"code":"PW","name":"Palau"},{"code":"PS","name":"Palestinian Territories"},{"code":"PA","name":"Panama"},{"code":"PG","name":"Papua New Guinea"},{"code":"PY","name":"Paraguay"},{"code":"PE","name":"Peru"},{"code":"PH","name":"Philippines"},{"code":"PN","name":"Pitcairn Islands"},{"code":"PL","name":"Poland"},{"code":"PT","name":"Portugal"},{"code":"PR","name":"Puerto Rico"},{"code":"QA","name":"Qatar"},{"code":"RE","name":"Réunion"},{"code":"RO","name":"Romania"},{"code":"RU","name":"Russia"},{"code":"RW","name":"Rwanda"},{"code":"WS","name":"Samoa"},{"code":"SM","name":"San Marino"},{"code":"ST","name":"São Tomé & Príncipe"},{"code":"SA","name":"Saudi Arabia"},{"code":"SN","name":"Senegal"},{"code":"RS","name":"Serbia"},{"code":"SC","name":"Seychelles"},{"code":"SL","name":"Sierra Leone"},{"code":"SG","name":"Singapore"},{"code":"SX","name":"Sint Maarten"},{"code":"SK","name":"Slovakia"},{"code":"SI","name":"Slovenia"},{"code":"SB","name":"Solomon Islands"},{"code":"SO","name":"Somalia"},{"code":"ZA","name":"South Africa"},{"code":"GS","name":"South Georgia & South Sandwich Islands"},{"code":"KR","name":"South Korea"},{"code":"SS","name":"South Sudan"},{"code":"ES","name":"Spain"},{"code":"LK","name":"Sri Lanka"},{"code":"BL","name":"St. Barthélemy"},{"code":"SH","name":"St. Helena"},{"code":"KN","name":"St. Kitts & Nevis"},{"code":"LC","name":"St. Lucia"},{"code":"MF","name":"St. Martin"},{"code":"PM","name":"St. Pierre & Miquelon"},{"code":"VC","name":"St. Vincent & Grenadines"},{"code":"SD","name":"Sudan"},{"code":"SR","name":"Suriname"},{"code":"SJ","name":"Svalbard & Jan Mayen"},{"code":"SE","name":"Sweden"},{"code":"CH","name":"Switzerland"},{"code":"SY","name":"Syria"},{"code":"TW","name":"Taiwan"},{"code":"TJ","name":"Tajikistan"},{"code":"TZ","name":"Tanzania"},{"code":"TH","name":"Thailand"},{"code":"TL","name":"Timor-Leste"},{"code":"TG","name":"Togo"},{"code":"TK","name":"Tokelau"},{"code":"TO","name":"Tonga"},{"code":"TT","name":"Trinidad & Tobago"},{"code":"TN","name":"Tunisia"},{"code":"TR","name":"Türkiye"},{"code":"TM","name":"Turkmenistan"},{"code":"TC","name":"Turks & Caicos Islands"},{"code":"TV","name":"Tuvalu"},{"code":"UM","name":"U.S. Outlying Islands"},{"code":"VI","name":"U.S. Virgin Islands"},{"code":"UG","name":"Uganda"},{"code":"UA","name":"Ukraine"},{"code":"AE","name":"United Arab Emirates"},{"code":"GB","name":"United Kingdom"},{"code":"US","name":"United States"},{"code":"UY","name":"Uruguay"},{"code":"UZ","name":"Uzbekistan"},{"code":"VU","name":"Vanuatu"},{"code":"VA","name":"Vatican City"},{"code":"VE","name":"Venezuela"},{"code":"VN","name":"Vietnam"},{"code":"WF","name":"Wallis & Futuna"},{"code":"EH","name":"Western Sahara"},{"code":"YE","name":"Yemen"},{"code":"ZM","name":"Zambia"},{"code":"ZW","name":"Zimbabwe"}];

  const GIFT_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="11"></rect><path d="M3 9h18"></path><path d="M12 9v11"></path><path d="M12 9c-1.4-4-6-5-6-2 0 2 2.4 2 6 2Z"></path><path d="M12 9c1.4-4 6-5 6-2 0 2-2.4 2-6 2Z"></path></svg>';

  const CHEV_SVG = '<svg class="co-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  /* ---------- field validation config (DOM order = focus order on submit) ---------- */
  const FIELDS = [
    { id: 'coEmail', required: true, validate: v => KA_CORE.validate.email(v), msg: 'Enter a valid email address.' },
    { id: 'coPhone', required: false, validate: v => KA_CORE.validate.phone(v), msg: 'Enter a valid phone number, or leave it blank.' },
    { id: 'coName', group: 'delivery', required: true, msg: 'Enter the full name for delivery.' },
    { id: 'coAddr1', group: 'delivery', required: true, msg: 'Enter your street address.' },
    { id: 'coCity', group: 'delivery', required: true, msg: 'Enter your city or town.' },
    { id: 'coPostcode', group: 'delivery', required: true, validate: (v, country) => KA_CORE.validate.postcode(v, country), msg: 'Enter a valid postcode for the selected country.' },
    { id: 'coAck', required: true, type: 'checkbox', msg: 'Please confirm you understand pieces are made to order.' }
  ];
  const FIELDS_BY_ID = {};
  FIELDS.forEach(f => { FIELDS_BY_ID[f.id] = f; });

  /* ---------- module state ---------- */
  const state = {
    promoCode: null,
    shippingMethodId: null,
    submitting: false,
    layoutBuilt: false
  };

  /* ---------- tiny helpers ---------- */
  const esc = s => KA_CORE.escapeHtml(s == null ? '' : String(s));
  const money = n => KA_CORE.money(n);
  const $ = id => document.getElementById(id);
  const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }
  function fieldValue(id) {
    const el = $(id);
    if (!el) return '';
    return el.value ? el.value.trim() : '';
  }
  function announce(msg) {
    const live = $('coStatusLive');
    if (live) live.textContent = msg;
  }
  function labelFor(list, id) {
    if (!id) return '';
    const found = Array.isArray(list) ? list.filter(x => x.id === id)[0] : null;
    if (found && found.name) return found.name;
    return String(id).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  function isGiftOnly(items) {
    return items.length > 0 && items.every(i => i.kind === 'gift');
  }
  function getCountryValue() {
    const el = $('coCountry');
    return el ? el.value : 'GB';
  }
  /* KA_CORE.totals() prices promos and the free-shipping threshold against the
     merchandise-only subtotal — gift cards never discount and never carry
     physical shipping (see core.js's totals() doc comment). Mirror that basis
     here so the shipping list / free-ship hint / promo preview this page shows
     always agree with the numbers totals() actually charges. */
  function merchSubtotal(items) {
    return KA_CORE.subtotal(items.filter(i => (i.kind || 'product') !== 'gift'));
  }
  function shippingBasis(items) {
    const merch = merchSubtotal(items);
    if (!state.promoCode) return merch;
    const res = KA_CORE.applyPromo(state.promoCode, merch);
    const discount = (res && res.ok) ? Math.min(res.discount, merch) : 0;
    return Math.max(0, merch - discount);
  }
  function getShippingOptions(items, country, subtotal) {
    return KA_CORE.shippingOptions(country, subtotal, isGiftOnly(items)) || [];
  }

  /* ---------- draft persistence (sessionStorage — never card data) ---------- */
  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveDraft() {
    const draft = {
      email: fieldValue('coEmail'), phone: fieldValue('coPhone'),
      marketing: $('coMarketing') ? $('coMarketing').checked : false,
      fullName: fieldValue('coName'), address1: fieldValue('coAddr1'), address2: fieldValue('coAddr2'),
      city: fieldValue('coCity'), region: fieldValue('coRegion'), postcode: fieldValue('coPostcode'),
      country: getCountryValue(),
      shippingMethodId: state.shippingMethodId,
      promoCode: state.promoCode,
      notes: fieldValue('coNotes'), giftNote: fieldValue('coGiftNote')
    };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* storage unavailable — draft simply won't persist */ }
  }

  /* ---------- payment adapter resolution ---------- */
  function resolvedProvider() {
    const pay = (window.KA_CONFIG && KA_CONFIG.payment) || {};
    if (pay.provider === 'paystack' && pay.paystackPublicKey) return 'paystack';
    return 'request';
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    const items = kaCart.items();
    if (!items.length) {
      renderEmpty();
      state.layoutBuilt = false;
      return;
    }
    buildLayout(items);
    state.layoutBuilt = true;
  }

  function onCartChange() {
    const items = kaCart.items();
    if (!items.length) {
      renderEmpty();
      state.layoutBuilt = false;
      return;
    }
    if (!state.layoutBuilt) {
      buildLayout(items);
      state.layoutBuilt = true;
      return;
    }
    refreshDynamic(items);
  }

  function renderEmpty() {
    root.innerHTML = `
      <div class="co-empty panel reveal in">
        <div class="empty-state">
          <p class="es-title">Your cart is empty</p>
          <p class="es-copy">Every piece is cut and sewn to order — find something worth the wait.</p>
          <a class="btn btn-solid" href="shop.html">Continue shopping →</a>
        </div>
      </div>`;
  }

  function buildLayout(items) {
    const draft = loadDraft();
    const provider = resolvedProvider();
    const country = draft.country || 'GB';

    root.innerHTML = `
      <form id="checkoutForm" class="co-layout" novalidate>
        <div class="co-form">

          <div class="co-block">
            <h2 class="co-h2"><span class="co-step-n">01</span> Contact</h2>
            <div class="field">
              <label for="coEmail">Email</label>
              <input id="coEmail" name="email" class="input" type="email" autocomplete="email" inputmode="email" value="${esc(draft.email || '')}" required>
              <p class="field-error" id="coEmail-error" role="alert"></p>
            </div>
            <div class="field">
              <label for="coPhone">Phone (optional)</label>
              <input id="coPhone" name="phone" class="input" type="tel" autocomplete="tel" inputmode="tel" value="${esc(draft.phone || '')}">
              <p class="field-error" id="coPhone-error" role="alert"></p>
            </div>
            <label class="checkbox">
              <input id="coMarketing" name="marketing" type="checkbox" ${draft.marketing ? 'checked' : ''}>
              <span>Email me about new drops and restocks. No spam, unsubscribe any time.</span>
            </label>
          </div>

          <div class="co-block" id="coDeliverySection">
            <h2 class="co-h2"><span class="co-step-n">02</span> Delivery</h2>
            <div class="field">
              <label for="coName">Full name</label>
              <input id="coName" name="fullName" class="input" type="text" autocomplete="shipping name" value="${esc(draft.fullName || '')}" required>
              <p class="field-error" id="coName-error" role="alert"></p>
            </div>
            <div class="field">
              <label for="coAddr1">Address line 1</label>
              <input id="coAddr1" name="address1" class="input" type="text" autocomplete="shipping address-line1" value="${esc(draft.address1 || '')}" required>
              <p class="field-error" id="coAddr1-error" role="alert"></p>
            </div>
            <div class="field">
              <label for="coAddr2">Address line 2 (optional)</label>
              <input id="coAddr2" name="address2" class="input" type="text" autocomplete="shipping address-line2" value="${esc(draft.address2 || '')}">
            </div>
            <div class="field-row">
              <div class="field">
                <label for="coCity">City / town</label>
                <input id="coCity" name="city" class="input" type="text" autocomplete="shipping address-level2" value="${esc(draft.city || '')}" required>
                <p class="field-error" id="coCity-error" role="alert"></p>
              </div>
              <div class="field">
                <label for="coRegion">County / region (optional)</label>
                <input id="coRegion" name="region" class="input" type="text" autocomplete="shipping address-level1" value="${esc(draft.region || '')}">
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="coPostcode">Postcode</label>
                <input id="coPostcode" name="postcode" class="input" type="text" autocomplete="shipping postal-code" value="${esc(draft.postcode || '')}" required>
                <p class="field-error" id="coPostcode-error" role="alert"></p>
              </div>
              <div class="field">
                <label for="coCountry">Country</label>
                <select id="coCountry" name="country" class="select" autocomplete="shipping country">
                  ${COUNTRIES.map(c => `<option value="${c.code}" ${c.code === country ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <div class="co-block" id="coShippingSection">
            <h2 class="co-h2"><span class="co-step-n">03</span> Shipping method</h2>
            <p id="coFreeShipHint" hidden></p>
            <div id="coShippingOptions" role="radiogroup" aria-label="Shipping method"></div>
          </div>

          <div class="co-block">
            <h2 class="co-h2"><span class="co-step-n">04</span> Notes</h2>
            <div class="field">
              <label for="coNotes">Order notes (optional)</label>
              <textarea id="coNotes" name="notes" class="textarea" placeholder="Delivery instructions, or anything we should know">${esc(draft.notes || '')}</textarea>
            </div>
            <div class="field">
              <label for="coGiftNote">Gift note (optional)</label>
              <textarea id="coGiftNote" name="giftNote" class="textarea" placeholder="Add a note if this order is a gift">${esc(draft.giftNote || '')}</textarea>
            </div>
          </div>

          <div class="co-block">
            <h2 class="co-h2"><span class="co-step-n">05</span> Payment</h2>
            ${paymentInfoHtml(provider)}
            <label class="checkbox" id="coAckRow">
              <input id="coAck" name="ack" type="checkbox">
              <span>I understand every piece is cut and sewn after I order, per the <a href="policies.html" target="_blank" rel="noopener">Refund Policy &amp; Terms</a>.</span>
            </label>
            <p class="field-error" id="coAck-error" role="alert"></p>
            <div class="co-submit-row">
              <button class="btn btn-solid" type="submit" id="coSubmit" data-idle-label="${esc(submitLabel(provider))}">${esc(submitLabel(provider))}</button>
            </div>
          </div>

        </div>

        <aside class="co-summary open" id="coSummary" aria-label="Order summary">
          <button type="button" class="co-summary-toggle" id="coSummaryToggle" aria-expanded="true" aria-controls="coSummaryBody">
            <span>Order summary</span>
            <span class="co-summary-toggle-total" id="coSummaryToggleTotal">£0</span>
            ${CHEV_SVG}
          </button>
          <div class="co-summary-body" id="coSummaryBody">
            <div id="coItems"></div>
            <div class="co-promo">
              <label for="coPromoCode">Promo code</label>
              <div class="co-promo-row">
                <input id="coPromoCode" class="input" type="text" autocomplete="off" spellcheck="false" placeholder="Enter code" value="${esc(draft.promoCode || '')}">
                <button type="button" class="btn btn-gold" id="coPromoBtn">Apply</button>
              </div>
              <p class="field-error" id="coPromoError" role="alert"></p>
              <p class="co-promo-applied" id="coPromoApplied" hidden></p>
            </div>
            <div class="totals" id="coTotals">
              <div class="price-row"><span>Subtotal</span><b id="coSubtotal">£0</b></div>
              <div class="price-row" id="coDiscountRow" hidden><span>Discount</span><b id="coDiscount">−£0</b></div>
              <div class="price-row"><span>Shipping</span><b id="coShipping">£0</b></div>
              <div class="price-row grand"><span>Total</span><b id="coTotal">£0</b></div>
            </div>
            <p class="cart-note">Made to order · ships in ${esc((window.KA_CONFIG && KA_CONFIG.leadTime) || '7–10 days')}</p>
          </div>
        </aside>
      </form>`;

    state.shippingMethodId = draft.shippingMethodId || null;
    state.promoCode = draft.promoCode || null;

    wireStaticListeners(items);
    refreshDynamic(items);

    if (state.promoCode) {
      // re-validate the carried-over promo silently against the current
      // merchandise subtotal (gift cards are excluded — see shippingBasis)
      const res = KA_CORE.applyPromo(state.promoCode, merchSubtotal(items));
      if (res && res.ok) setPromoAppliedUI(true, res.label, res.discount);
      else { state.promoCode = null; setPromoAppliedUI(false); }
      refreshTotals(items);
    }
  }

  function submitLabel(provider) {
    return provider === 'paystack' ? 'Pay & place order' : 'Place order request';
  }

  function paymentInfoHtml(provider) {
    if (provider === 'paystack') {
      return `<div class="panel co-payment-info">
        <p><strong>Pay securely now with Paystack.</strong> Card details are entered in Paystack's own secure popup and never touch our server.</p>
        <p>Once payment clears we'll confirm your order and your cloth is cut within 24 hours.</p>
      </div>`;
    }
    return `<div class="panel co-payment-info">
      <p><strong>No payment is taken today.</strong> We'll email a secure payment link once we've reviewed your order.</p>
      <p>Nothing is charged, and your cloth isn't cut, until that payment link is settled.</p>
    </div>`;
  }

  /* ======================================================================
     DYNAMIC REFRESH (cart / country / promo change)
     ====================================================================== */
  function refreshDynamic(items) {
    const deliverySection = $('coDeliverySection');
    if (deliverySection) {
      const giftOnly = isGiftOnly(items);
      const wasHidden = deliverySection.hidden;
      deliverySection.hidden = giftOnly;
      if (giftOnly && !wasHidden) {
        FIELDS.filter(f => f.group === 'delivery').forEach(f => {
          const el = $(f.id);
          if (el) clearFieldError(el);
        });
      }
    }
    renderItems(items);
    refreshShipping(items);
    refreshTotals(items);
  }

  function renderItems(items) {
    const wrap = $('coItems');
    if (!wrap) return;
    wrap.innerHTML = items.map(itemRowHtml).join('');
  }

  function itemRowHtml(item, idx) {
    const kind = item.kind || 'product';
    let name, meta, thumbHtml;
    if (kind === 'gift') {
      const to = item.to ? esc(item.to) : '';
      const from = item.from ? esc(item.from) : '';
      const parts = [];
      if (to) parts.push('To ' + to);
      if (from) parts.push('From ' + from);
      if (item.sendOn) parts.push('Sent ' + esc(item.sendOn));
      name = 'Digital gift card';
      meta = parts.join(' · ');
      thumbHtml = `<span class="ci-thumb-gift">${GIFT_SVG}</span>`;
    } else if (kind === 'custom') {
      const cfgStudio = (window.KA_CONFIG && KA_CONFIG.studio) || {};
      const garment = labelFor(cfgStudio.garments, item.garment);
      const colour = labelFor(cfgStudio.colours, item.colour);
      name = esc(item.name || 'Custom piece');
      meta = [garment, colour, item.size ? 'Size ' + item.size : ''].filter(Boolean).map(esc).join(' · ');
      const safeThumb = (typeof kaCart !== 'undefined' && kaCart.safeThumbSrc) ? kaCart.safeThumbSrc(item.thumb) : (item.thumb || '');
      thumbHtml = `<img decoding="async" src="${esc(safeThumb)}" alt="" loading="lazy">`;
    } else {
      const p = KA_CORE.findProduct(item.id) || {};
      name = esc(p.name || 'Item');
      meta = item.size ? 'Size ' + esc(item.size) : '';
      thumbHtml = `<img decoding="async" src="${esc(p.img || '')}" alt="" loading="lazy">`;
    }
    const qty = item.qty || 1;
    const unit = money(KA_CORE.unitPrice(item));
    const line = money(KA_CORE.lineTotal(item));
    return `<div class="cart-item" data-idx="${idx}">
      ${thumbHtml}
      <div class="ci-info">
        <p class="ci-name">${name}</p>
        ${meta ? `<p class="ci-meta">${meta}</p>` : ''}
        <p class="ci-price">${unit} × ${esc(qty)} = ${line}</p>
        <div class="ci-qty">
          <button type="button" class="ci-dec" data-idx="${idx}" aria-label="Decrease quantity">−</button>
          <span>${esc(qty)}</span>
          <button type="button" class="ci-inc" data-idx="${idx}" aria-label="Increase quantity">+</button>
        </div>
        <button class="ci-remove" type="button" data-idx="${idx}">Remove</button>
      </div>
    </div>`;
  }

  function refreshShipping(items) {
    const country = getCountryValue();
    const basis = shippingBasis(items);
    const options = getShippingOptions(items, country, basis);
    const stillValid = options.some(o => o.id === state.shippingMethodId);
    if (!stillValid) state.shippingMethodId = options.length ? options[0].id : null;
    const wrap = $('coShippingOptions');
    if (wrap) wrap.innerHTML = shippingOptionsHtml(options, state.shippingMethodId);
    // a gift-only cart already ships free (digital) regardless of spend —
    // the "spend more" hint would be actively misleading there
    if (isGiftOnly(items)) { const hint = $('coFreeShipHint'); if (hint) { hint.hidden = true; hint.textContent = ''; } }
    else refreshFreeShipHint(country, basis);
  }

  function shippingOptionsHtml(options, selectedId) {
    if (!options.length) return '<p class="co-empty-note">No shipping options are available for this destination yet — contact us and we’ll sort it out.</p>';
    return options.map((o, i) => {
      const checked = (selectedId ? o.id === selectedId : i === 0) ? ' checked' : '';
      const priceLabel = o.price === 0 ? 'FREE' : money(o.price);
      return `<label class="co-ship-opt">
        <input type="radio" name="coShipMethod" value="${esc(o.id)}"${checked}>
        <span class="co-ship-info">
          <span class="co-ship-label">${esc(o.label)}</span>
          ${o.days ? `<span class="co-ship-days">${esc(o.days)} working days</span>` : ''}
        </span>
        <span class="co-ship-price">${priceLabel}</span>
      </label>`;
    }).join('');
  }

  function refreshFreeShipHint(country, subtotal) {
    const hint = $('coFreeShipHint');
    if (!hint) return;
    const zone = KA_CORE.zoneFor(country);
    const zones = (window.KA_CONFIG && KA_CONFIG.shipping && KA_CONFIG.shipping.zones) || {};
    const ukZone = zones.UK;
    if (zone !== 'UK' || !ukZone || !ukZone.freeOver) { hint.hidden = true; hint.textContent = ''; return; }
    hint.hidden = false;
    const remaining = ukZone.freeOver - subtotal;
    hint.innerHTML = remaining > 0
      ? `Add <b>${money(remaining)}</b> more for free UK shipping.`
      : 'You’ve unlocked free UK shipping.';
  }

  function refreshTotals(itemsIn) {
    const items = itemsIn || kaCart.items();
    const country = getCountryValue();
    let res = KA_CORE.totals(items, { country: country, methodId: state.shippingMethodId, promoCode: state.promoCode });
    if (state.promoCode && res.promo && res.promo.ok === false) {
      state.promoCode = null;
      setPromoAppliedUI(false);
      showPromoError(res.promo.error || 'That code no longer applies to this order.');
      res = KA_CORE.totals(items, { country: country, methodId: state.shippingMethodId, promoCode: null });
    } else if (state.promoCode && res.promo && res.promo.ok) {
      /* keep the "applied — save £X" banner in sync with the real discount:
         a cart mutation (qty change, item removed) can change the discount
         without the user touching the promo field again */
      setPromoAppliedUI(true, res.promo.label, res.discount);
    }
    setText('coSubtotal', money(res.subtotal));
    const discountRow = $('coDiscountRow');
    if (discountRow) {
      if (res.discount > 0) { discountRow.hidden = false; setText('coDiscount', '−' + money(res.discount)); }
      else discountRow.hidden = true;
    }
    setText('coShipping', res.shipping === 0 ? 'FREE' : money(res.shipping));
    setText('coTotal', money(res.total));
    setText('coSummaryToggleTotal', money(res.total));
    return res;
  }

  /* ---------- promo apply/remove ---------- */
  function setPromoAppliedUI(applied, label, discount) {
    const input = $('coPromoCode');
    const btn = $('coPromoBtn');
    const applied_p = $('coPromoApplied');
    if (input) input.disabled = applied;
    if (btn) btn.textContent = applied ? 'Remove' : 'Apply';
    if (applied_p) {
      if (applied) {
        applied_p.hidden = false;
        applied_p.innerHTML = `✓ <b>${esc(label || state.promoCode)}</b> applied — save ${money(discount || 0)}`;
      } else {
        applied_p.hidden = true;
        applied_p.innerHTML = '';
      }
    }
    if (!applied && input) input.value = '';
  }
  function showPromoError(msg) { setText('coPromoError', msg || ''); }

  /* ======================================================================
     VALIDATION
     ====================================================================== */
  function setFieldError(el, msg) {
    const errId = el.id + '-error';
    const errEl = $(errId);
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', errId);
    if (errEl) errEl.textContent = msg;
    if (el.id === 'coAck') { const row = $('coAckRow'); if (row) row.classList.add('is-invalid'); }
  }
  function clearFieldError(el) {
    const errId = el.id + '-error';
    const errEl = $(errId);
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
    if (errEl) errEl.textContent = '';
    if (el.id === 'coAck') { const row = $('coAckRow'); if (row) row.classList.remove('is-invalid'); }
  }
  function validateField(cfg) {
    const el = $(cfg.id);
    if (!el) return true;
    if (cfg.group === 'delivery') {
      const section = $('coDeliverySection');
      if (section && section.hidden) { clearFieldError(el); return true; }
    }
    let ok = true;
    if (cfg.type === 'checkbox') {
      ok = !cfg.required || el.checked === true;
    } else {
      const value = el.value.trim();
      if (cfg.required) ok = KA_CORE.validate.required(value);
      if (ok && value && cfg.validate) ok = !!cfg.validate(value, getCountryValue());
    }
    if (ok) { clearFieldError(el); return true; }
    setFieldError(el, cfg.msg);
    return false;
  }
  function validateAll() {
    let firstInvalid = null;
    FIELDS.forEach(cfg => {
      const ok = validateField(cfg);
      if (!ok && !firstInvalid) firstInvalid = $(cfg.id);
    });
    if (firstInvalid) {
      firstInvalid.focus();
      try { firstInvalid.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }); } catch (e) { /* older browsers */ }
      return false;
    }
    return true;
  }

  /* ======================================================================
     EVENT WIRING (static — attached once per full layout build)
     ====================================================================== */
  function wireStaticListeners(items) {
    const form = $('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', onSubmit);

    form.addEventListener('focusout', e => {
      const cfg = FIELDS_BY_ID[e.target.id];
      if (cfg) validateField(cfg);
    });
    form.addEventListener('input', e => {
      const t = e.target;
      if (!t.name) return;
      saveDraft();
      const cfg = FIELDS_BY_ID[t.id];
      if (cfg && t.getAttribute('aria-invalid') === 'true') validateField(cfg);
    });
    form.addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'coShipMethod') {
        state.shippingMethodId = t.value;
        saveDraft();
        refreshTotals();
        return;
      }
      if (!t.name) return;
      saveDraft();
      const cfg = FIELDS_BY_ID[t.id];
      if (cfg) validateField(cfg);
      if (t.id === 'coCountry') {
        refreshShipping(kaCart.items());
        refreshTotals();
        if ($('coPostcode') && $('coPostcode').value.trim()) validateField(FIELDS_BY_ID.coPostcode);
      }
    });

    const itemsWrap = $('coItems');
    if (itemsWrap) {
      itemsWrap.addEventListener('click', e => {
        const btn = e.target.closest ? e.target.closest('button[data-idx]') : null;
        if (!btn) return;
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const cur = kaCart.items();
        const item = cur[idx];
        if (!item) return;
        if (btn.classList.contains('ci-inc')) {
          kaCart.update(idx, item.qty + 1);
        } else if (btn.classList.contains('ci-dec')) {
          if (item.qty <= 1) kaCart.remove(idx); else kaCart.update(idx, item.qty - 1);
        } else if (btn.classList.contains('ci-remove')) {
          kaCart.remove(idx);
        }
      });
    }

    const promoBtn = $('coPromoBtn');
    if (promoBtn) promoBtn.addEventListener('click', onPromoClick);
    const promoInput = $('coPromoCode');
    if (promoInput) promoInput.addEventListener('keydown', e => {
      // Enter here should apply the code, not submit the whole order —
      // both share one <form> so the browser would otherwise submit it.
      if (e.key === 'Enter') { e.preventDefault(); onPromoClick(); }
    });

    const toggle = $('coSummaryToggle');
    if (toggle) toggle.addEventListener('click', () => {
      const summary = $('coSummary');
      const open = summary.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // collapsed by default on mobile so the form isn't pushed down
    const summaryEl = $('coSummary');
    if (summaryEl && window.innerWidth < 901) {
      summaryEl.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  }

  function onPromoClick() {
    if (state.promoCode) {
      state.promoCode = null;
      setPromoAppliedUI(false);
      showPromoError('');
      saveDraft();
      refreshTotals();
      return;
    }
    const input = $('coPromoCode');
    const code = input ? input.value.trim() : '';
    if (!code) { showPromoError('Enter a code to apply.'); return; }
    const res = KA_CORE.applyPromo(code, merchSubtotal(kaCart.items()));
    if (res && res.ok) {
      state.promoCode = res.code || code;
      showPromoError('');
      setPromoAppliedUI(true, res.label, res.discount);
      saveDraft();
      refreshTotals();
    } else {
      showPromoError((res && res.error) || 'That code isn’t valid.');
    }
  }

  /* ======================================================================
     SUBMIT / ORDER BUILD / PAYMENT ADAPTERS
     ====================================================================== */
  function setBusy(busy, label) {
    const btn = $('coSubmit');
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? (label || 'Placing your order…') : btn.getAttribute('data-idle-label');
  }

  function snapshotItem(item) {
    const kind = item.kind || 'product';
    const base = { kind: kind, qty: item.qty, unitPrice: KA_CORE.unitPrice(item), lineTotal: KA_CORE.lineTotal(item) };
    if (kind === 'gift') {
      return Object.assign(base, { name: 'Digital gift card', amount: item.amount, to: item.to, from: item.from, email: item.email, message: item.message, sendOn: item.sendOn });
    }
    if (kind === 'custom') {
      return Object.assign(base, { name: item.name, garment: item.garment, colour: item.colour, size: item.size });
    }
    const p = KA_CORE.findProduct(item.id) || {};
    return Object.assign(base, { id: item.id, name: p.name, size: item.size });
  }

  function currentShippingOption(items, country, subtotal, methodId) {
    const options = getShippingOptions(items, country, subtotal);
    return options.filter(o => o.id === methodId)[0] || options[0] || null;
  }

  function buildOrder(items) {
    const country = getCountryValue();
    const giftOnly = isGiftOnly(items);
    const totalsRes = KA_CORE.totals(items, { country: country, methodId: state.shippingMethodId, promoCode: state.promoCode });
    return {
      ref: KA_CORE.orderRef(),
      createdAt: new Date().toISOString(),
      items: items.map(snapshotItem),
      contact: {
        email: fieldValue('coEmail'),
        phone: fieldValue('coPhone'),
        marketing: $('coMarketing') ? $('coMarketing').checked : false
      },
      address: giftOnly ? null : {
        fullName: fieldValue('coName'), address1: fieldValue('coAddr1'), address2: fieldValue('coAddr2'),
        city: fieldValue('coCity'), region: fieldValue('coRegion'), postcode: fieldValue('coPostcode'), country: country
      },
      shipping: currentShippingOption(items, country, shippingBasis(items), state.shippingMethodId),
      promo: totalsRes.promo || null,
      totals: { subtotal: totalsRes.subtotal, discount: totalsRes.discount, shipping: totalsRes.shipping, total: totalsRes.total },
      notes: { order: fieldValue('coNotes'), gift: fieldValue('coGiftNote') },
      status: 'requested'
    };
  }

  /* Orders hold full PII (name, address, phone, email) and live in localStorage
     indefinitely with no server-side counterpart — cap by count and age on every
     write so a shared/kiosk browser doesn't accumulate an unbounded PII archive. */
  const ORDERS_MAX = 50;
  const ORDERS_MAX_AGE_DAYS = 90;
  function persistOrder(order) {
    let orders = [];
    try { orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch (e) { orders = []; }
    const i = orders.findIndex ? orders.findIndex(o => o.ref === order.ref) : -1;
    if (i > -1) orders[i] = order; else orders.push(order);
    const cutoff = Date.now() - ORDERS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    orders = orders.filter(o => {
      const t = o && o.createdAt ? new Date(o.createdAt).getTime() : NaN;
      return isNaN(t) || t >= cutoff;
    });
    if (orders.length > ORDERS_MAX) orders = orders.slice(orders.length - ORDERS_MAX);
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); } catch (e) { /* storage full/unavailable */ }
  }

  function finishOrder(ref) {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    kaCart.clear();
    window.location.href = 'order.html?ref=' + encodeURIComponent(ref);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.submitting) return;
    const items = kaCart.items();
    if (!items.length) { render(); return; }
    if (!validateAll()) return;

    state.submitting = true;
    setBusy(true);
    announce('Placing your order, please wait.');

    const order = buildOrder(items);
    if (resolvedProvider() === 'paystack') {
      runPaystack(order);
    } else {
      runRequestFlow(order);
    }
  }

  function runRequestFlow(order) {
    order.status = 'requested';
    persistOrder(order);
    Promise.resolve()
      .then(() => kaForms.submit('order', order))
      .catch(err => { console.error('kaForms.submit failed', err); return { ok: false, via: 'local' }; })
      .then(res => {
        /* record how (or whether) the order actually reached the shop, so
           order.html can tell the customer their action is not yet finished
           when it went via mailto/local instead of an automated endpoint */
        order.deliveryVia = (res && res.via) || 'local';
        persistOrder(order);
        announce('Order request placed.');
        finishOrder(order.ref);
      });
  }

  /* -------- Paystack Inline JS v2 adapter --------
     Verified against the @paystack/inline-js README (the package Paystack
     itself publishes for js.paystack.co/v2/inline.js — the docs site
     blocked automated fetches with a 403, see contractDeviations):
       const pop = new PaystackPop();
       pop.newTransaction({ key, email, amount (minor units), currency,
         reference, metadata, onSuccess(transaction), onCancel(), onError({message}) });
     onSuccess receives {id, reference, message}; onCancel takes no args;
     onError receives {message}. Script: https://js.paystack.co/v2/inline.js */
  let paystackScriptPromise = null;
  function loadPaystackScript() {
    if (window.PaystackPop) return Promise.resolve();
    if (paystackScriptPromise) return paystackScriptPromise;
    paystackScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.paystack.co/v2/inline.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the Paystack script.'));
      document.head.appendChild(s);
    });
    return paystackScriptPromise;
  }

  function runPaystack(order) {
    const pay = KA_CONFIG.payment;
    const amountMinor = Math.round(order.totals.total * 100); // GBP → pence
    loadPaystackScript().then(() => {
      const pop = new window.PaystackPop();
      pop.newTransaction({
        key: pay.paystackPublicKey,
        email: order.contact.email,
        amount: amountMinor,
        currency: (window.KA_CONFIG && KA_CONFIG.currency) || 'GBP',
        reference: order.ref,
        metadata: { order_ref: order.ref, item_count: KA_CORE.itemCount(kaCart.items()) },
        onSuccess: transaction => {
          order.status = 'paid';
          order.paystackReference = (transaction && transaction.reference) || order.ref;
          persistOrder(order);
          Promise.resolve()
            .then(() => kaForms.submit('order', order))
            .catch(err => { console.error('kaForms.submit failed', err); return { ok: false, via: 'local' }; })
            .then(res => {
              order.deliveryVia = (res && res.via) || 'local';
              persistOrder(order);
              announce('Payment received.');
              finishOrder(order.ref);
            });
        },
        onCancel: () => {
          state.submitting = false;
          setBusy(false);
          announce('Payment cancelled.');
          kaToast('Payment cancelled — your cart is still here.', 'err');
        },
        onError: err => {
          state.submitting = false;
          setBusy(false);
          const msg = (err && err.message) || 'please try again.';
          announce('Payment error.');
          kaToast('Payment error: ' + msg, 'err');
        }
      });
    }).catch(() => {
      state.submitting = false;
      setBusy(false);
      kaToast('Could not load the payment popup. Please try again.', 'err');
    });
  }

  /* keep the mobile summary collapsed after a resize that crosses the
     desktop breakpoint (e.g. rotating a tablet) without fighting a
     manual toggle within the same breakpoint */
  let wasDesktop = window.innerWidth >= 901;
  window.addEventListener('resize', () => {
    const isDesktop = window.innerWidth >= 901;
    if (isDesktop === wasDesktop) return;
    wasDesktop = isDesktop;
    if (!isDesktop) {
      const summary = $('coSummary');
      const toggle = $('coSummaryToggle');
      if (summary) summary.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------- init ---------- */
  kaCart.onChange(onCartChange);
  render();
})();
