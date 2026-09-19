/* KHARIS & ALETHEIA — bulk.html (Crew & Bulk quote calculator + enquiry) */
(function () {
  'use strict';

  /* lead-time text used in copy across the page */
  Array.prototype.forEach.call(document.querySelectorAll('[data-lead-time]'), function (el) {
    el.textContent = KA_CONFIG.leadTime;
  });

  var form = document.getElementById('bulkForm');
  if (!form) return;

  var garments = KA_CONFIG.studio.garments;
  var tiers = KA_CONFIG.bulkTiers;
  var sizes = KA_CONFIG.studio.sizes;

  var garmentSel = document.getElementById('bkGarment');
  var qtyRange = document.getElementById('bkQtyRange');
  var qtyInput = document.getElementById('bkQtyInput');
  var qtyDec = document.getElementById('bkQtyDec');
  var qtyInc = document.getElementById('bkQtyInc');
  var tierBody = document.getElementById('bkTierBody');
  var unitOut = document.getElementById('bkUnit');
  var totalOut = document.getElementById('bkTotal');
  var saveOut = document.getElementById('bkSave');
  var sbWrap = document.getElementById('bkSizeBreakdown');
  var sbCountEl = document.getElementById('bkSbCount');
  var sbTargetEl = document.getElementById('bkSbTarget');
  var sbTotalWrap = document.getElementById('bkSbTotal');
  var sbErrEl = document.getElementById('bkSbErr');
  var splitBtn = document.getElementById('bkSplitEven');

  var nameInput = document.getElementById('bkName');
  var orgInput = document.getElementById('bkOrg');
  var emailInput = document.getElementById('bkEmail');
  var phoneInput = document.getElementById('bkPhone');
  var dateInput = document.getElementById('bkDate');
  var messageInput = document.getElementById('bkMessage');
  var hp = document.getElementById('bkHp');
  var submitBtn = document.getElementById('bkSubmit');
  var statusEl = document.getElementById('bkStatus');
  var resultEl = document.getElementById('bkResult');

  var QTY_MIN = 10, QTY_MAX = 500;

  /* ---------- populate garment select ---------- */
  garmentSel.innerHTML = garments.map(function (g) {
    return '<option value="' + g.id + '" data-base="' + g.base + '">' +
      KA_CORE.escapeHtml(g.name) + ' — from ' + KA_CORE.escapeHtml(KA_CORE.money(g.base)) + '</option>';
  }).join('');

  /* ---------- populate tier table ---------- */
  function tierRangeLabel(i) {
    var t = tiers[i], next = tiers[i + 1];
    return next ? (t.min + '–' + (next.min - 1) + ' pieces') : (t.min + '+ pieces');
  }
  tierBody.innerHTML = tiers.map(function (t, i) {
    return '<tr data-tier-off="' + t.off + '"><th>' + tierRangeLabel(i) + '</th><td>' + Math.round(t.off * 100) + '% off</td></tr>';
  }).join('');
  var tierRows = Array.prototype.slice.call(tierBody.children);

  /* ---------- populate size breakdown fields ---------- */
  sbWrap.innerHTML = sizes.map(function (s) {
    var safe = KA_CORE.escapeHtml(s);
    return '<div class="sb-field"><label for="sb-' + safe + '">' + safe + '</label>' +
      '<input type="number" min="0" step="1" inputmode="numeric" id="sb-' + safe + '" data-sb-size="' + safe + '" value="0" aria-label="' + safe + ' quantity"></div>';
  }).join('');
  var sbInputs = Array.prototype.slice.call(sbWrap.querySelectorAll('[data-sb-size]'));

  /* ---------- helpers ---------- */
  function currentGarmentBase() {
    var opt = garmentSel.options[garmentSel.selectedIndex];
    return opt ? parseFloat(opt.getAttribute('data-base')) : garments[0].base;
  }
  function currentGarmentName() {
    var opt = garmentSel.options[garmentSel.selectedIndex];
    return opt ? garments[garmentSel.selectedIndex].name : garments[0].name;
  }
  function clampQty(v) {
    v = parseInt(v, 10);
    if (isNaN(v)) v = QTY_MIN;
    return Math.max(QTY_MIN, Math.min(QTY_MAX, v));
  }
  function currentQty() { return clampQty(qtyInput.value); }

  function updatePrice() {
    var base = currentGarmentBase();
    var qty = currentQty();
    var q = KA_CORE.bulkQuote(base, qty);
    unitOut.textContent = KA_CORE.money(q.unit);
    totalOut.textContent = KA_CORE.money(q.total);
    saveOut.textContent = q.saving > 0 ? KA_CORE.money(q.saving) : '—';
    tierRows.forEach(function (row) {
      row.classList.toggle('on', parseFloat(row.getAttribute('data-tier-off')) === q.off);
    });
    return q;
  }

  function sbSum() {
    return sbInputs.reduce(function (s, i) { return s + (parseInt(i.value, 10) || 0); }, 0);
  }
  function updateSbCount() {
    var qty = currentQty();
    var sum = sbSum();
    sbCountEl.textContent = sum;
    sbTargetEl.textContent = qty;
    sbTotalWrap.classList.toggle('err', sum !== qty);
    if (sum === qty) sbErrEl.textContent = '';
    return sum === qty;
  }

  function syncQty(v) {
    v = clampQty(v);
    qtyInput.value = v;
    qtyRange.value = v;
    updateAll();
  }
  function updateAll() { updatePrice(); updateSbCount(); }

  qtyRange.addEventListener('input', function () { syncQty(qtyRange.value); });
  qtyInput.addEventListener('input', function () {
    var v = parseInt(qtyInput.value, 10);
    if (!isNaN(v)) {
      /* clamp the visible field the instant it goes over the max, so it never
         disagrees with the price/target computed from it; the lower bound is
         left alone while typing (deferred to blur) so a multi-digit number
         starting below QTY_MIN, e.g. typing "10", "25", isn't fought mid-keystroke */
      if (v > QTY_MAX) { v = QTY_MAX; qtyInput.value = String(v); }
      qtyRange.value = Math.max(QTY_MIN, Math.min(QTY_MAX, v));
      updateAll();
    }
  });
  qtyInput.addEventListener('blur', function () { syncQty(currentQty()); });
  qtyDec.addEventListener('click', function () { syncQty(currentQty() - 1); });
  qtyInc.addEventListener('click', function () { syncQty(currentQty() + 1); });
  garmentSel.addEventListener('change', updateAll);
  sbInputs.forEach(function (i) { i.addEventListener('input', updateSbCount); });

  function splitEvenly(qty) {
    var n = sizes.length;
    var mid = Math.floor(n / 2);
    var order = [];
    order.push(mid);
    for (var step = 1; order.length < n; step++) {
      if (mid - step >= 0) order.push(mid - step);
      if (order.length < n && mid + step < n) order.push(mid + step);
    }
    var base = Math.floor(qty / n);
    var rem = qty - base * n;
    var alloc = sizes.map(function () { return base; });
    for (var k = 0; k < rem; k++) alloc[order[k % order.length]]++;
    sbInputs.forEach(function (inp, idx) { inp.value = alloc[idx]; });
  }

  splitBtn.addEventListener('click', function () {
    splitEvenly(currentQty());
    updateSbCount();
    kaToast('Split evenly across sizes', 'ok');
  });

  /* pre-fill a valid, evenly-split breakdown before the first render so a
     first-time visitor never sees the "sizes don't add up" error state
     before they've touched anything */
  splitEvenly(currentQty());
  updateAll();

  /* ---------- validation ---------- */
  function setFieldError(input, msg) {
    var field = input.closest('.pd-field') || input.parentElement;
    var err = field.querySelector('.field-err');
    field.classList.toggle('has-err', !!msg);
    if (err) err.textContent = msg || '';
    if (msg && err) {
      if (!err.id) err.id = (input.id || 'field') + '-error';
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function validate() {
    var ok = true;

    if (!KA_CORE.validate.required(nameInput.value)) { setFieldError(nameInput, 'Tell us your name.'); ok = false; }
    else setFieldError(nameInput, '');

    if (!KA_CORE.validate.email(emailInput.value)) { setFieldError(emailInput, 'Enter a valid email address.'); ok = false; }
    else setFieldError(emailInput, '');

    if (phoneInput.value && !KA_CORE.validate.phone(phoneInput.value)) { setFieldError(phoneInput, "That phone number doesn't look right."); ok = false; }
    else setFieldError(phoneInput, '');

    if (!updateSbCount()) {
      sbErrEl.textContent = 'Sizes must add up to your quantity (' + currentQty() + ').';
      ok = false;
    }

    return ok;
  }

  function focusFirstError() {
    var bad = form.querySelector('.has-err input, .has-err select, .has-err textarea');
    if (bad) { bad.focus(); return; }
    if (sbTotalWrap.classList.contains('err')) { sbInputs[0].focus(); }
  }

  function channelNote(via) {
    if (via === 'endpoint') return 'Sent straight to our team — no further action needed from you.';
    if (via === 'mailto') return "Your email app should have opened with this enquiry pre-filled. Please hit send there to complete it — if nothing opened, use the direct email link below.";
    return "We've saved this enquiry on this device. If you don't hear back within two working days, please email us directly so we don't miss it.";
  }

  function buildMailtoFallback(subject, lines) {
    return 'mailto:' + KA_CONFIG.contactEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function summaryLines(payload) {
    var sb = Object.keys(payload.sizeBreakdown).map(function (s) {
      return s + ': ' + payload.sizeBreakdown[s];
    }).join(', ');
    return [
      'Name: ' + payload.name,
      'Organisation: ' + (payload.organisation || '—'),
      'Email: ' + payload.email,
      'Phone: ' + (payload.phone || '—'),
      'Event date: ' + (payload.eventDate || '—'),
      'Garment: ' + payload.garmentName,
      'Quantity: ' + payload.quantity,
      'Print approach: ' + payload.approach,
      'Size breakdown: ' + sb,
      'Estimated unit / total: ' + KA_CORE.money(payload.estimate.unit) + ' / ' + KA_CORE.money(payload.estimate.total),
      'Message: ' + (payload.message || '—')
    ];
  }

  function showSuccess(res, payload) {
    var e = KA_CORE.escapeHtml;
    var sbHtml = Object.keys(payload.sizeBreakdown)
      .filter(function (s) { return payload.sizeBreakdown[s] > 0; })
      .map(function (s) { return e(s) + ' × ' + payload.sizeBreakdown[s]; })
      .join(', ');
    resultEl.hidden = false;
    resultEl.className = 'result-panel ok';
    resultEl.setAttribute('role', 'status');
    resultEl.innerHTML =
      '<h3>Enquiry sent</h3>' +
      '<dl>' +
      '<dt>Name</dt><dd>' + e(payload.name) + '</dd>' +
      (payload.organisation ? '<dt>Organisation</dt><dd>' + e(payload.organisation) + '</dd>' : '') +
      '<dt>Email</dt><dd>' + e(payload.email) + '</dd>' +
      (payload.phone ? '<dt>Phone</dt><dd>' + e(payload.phone) + '</dd>' : '') +
      (payload.eventDate ? '<dt>Event date</dt><dd>' + e(payload.eventDate) + '</dd>' : '') +
      '<dt>Garment</dt><dd>' + e(payload.garmentName) + '</dd>' +
      '<dt>Quantity</dt><dd>' + payload.quantity + '</dd>' +
      '<dt>Approach</dt><dd>' + e(payload.approach) + '</dd>' +
      '<dt>Sizes</dt><dd>' + sbHtml + '</dd>' +
      '<dt>Estimate</dt><dd>' + e(KA_CORE.money(payload.estimate.unit)) + ' / unit · ' + e(KA_CORE.money(payload.estimate.total)) + ' total</dd>' +
      (payload.message ? '<dt>Message</dt><dd>' + e(payload.message) + '</dd>' : '') +
      '</dl>' +
      '<p class="via-note">' + e(channelNote(res.via)) + ' Prefer email? <a href="' + buildMailtoFallback('Crew & Bulk enquiry', summaryLines(payload)) + '">Write to us directly</a>.</p>';
    resultEl.setAttribute('tabindex', '-1');
    resultEl.focus();
  }

  function showFailure(payload) {
    var e = KA_CORE.escapeHtml;
    resultEl.hidden = false;
    resultEl.className = 'result-panel err';
    resultEl.setAttribute('role', 'alert');
    resultEl.innerHTML =
      '<h3>Couldn’t send that just now</h3>' +
      '<p>Your enquiry is saved on this device, but sending it failed. Try again, or email us directly with the details below — your email app will open with everything pre-filled.</p>' +
      '<div class="retry-row">' +
      '<button type="button" class="btn btn-gold" id="bkRetry">Try again</button>' +
      '<a class="btn btn-berry" href="' + buildMailtoFallback('Crew & Bulk enquiry', summaryLines(payload)) + '">Email us directly</a>' +
      '</div>';
    resultEl.setAttribute('tabindex', '-1');
    resultEl.focus();
    var retry = document.getElementById('bkRetry');
    if (retry) retry.addEventListener('click', function () { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); });
  }

  function setBusy(isBusy) {
    submitBtn.disabled = isBusy;
    submitBtn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    submitBtn.innerHTML = isBusy ? '<span class="spin" aria-hidden="true"></span>Sending…' : 'Send enquiry';
    statusEl.textContent = isBusy ? 'Sending your enquiry…' : '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    resultEl.hidden = true;
    resultEl.innerHTML = '';

    if (!validate()) {
      statusEl.textContent = 'Please fix the highlighted fields.';
      focusFirstError();
      return;
    }

    var qty = currentQty();
    var quote = KA_CORE.bulkQuote(currentGarmentBase(), qty);
    var approachEl = form.querySelector('input[name="approach"]:checked');
    var sizeBreakdown = {};
    sbInputs.forEach(function (i) { sizeBreakdown[i.getAttribute('data-sb-size')] = parseInt(i.value, 10) || 0; });

    var payload = {
      name: nameInput.value.trim(),
      organisation: orgInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      eventDate: dateInput.value,
      garment: garmentSel.value,
      garmentName: currentGarmentName(),
      quantity: qty,
      approach: approachEl ? approachEl.value : 'house',
      sizeBreakdown: sizeBreakdown,
      message: messageInput.value.trim(),
      estimate: { unit: quote.unit, total: quote.total, saving: quote.saving }
    };

    if (hp && hp.value) {
      /* honeypot tripped: pretend success without ever submitting */
      showSuccess({ ok: true, via: 'local' }, payload);
      form.reset();
      return;
    }

    setBusy(true);
    kaForms.submit('bulk', payload).then(function (res) {
      setBusy(false);
      if (res && res.ok) {
        showSuccess(res, payload);
        form.reset();
        garmentSel.selectedIndex = 0;
        syncQty(25);
        form.querySelectorAll('input[name="approach"]').forEach(function (r) { r.checked = r.value === 'house'; });
      } else {
        showFailure(payload);
      }
    }).catch(function () {
      setBusy(false);
      showFailure(payload);
    });
  });
})();
