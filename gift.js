/* KHARIS & ALETHEIA — gift.html (gift card builder) */
(function () {
  'use strict';

  var form = document.getElementById('giftForm');
  if (!form) return;

  var amounts = KA_CONFIG.giftAmounts;
  var MIN_AMT = 10, MAX_AMT = 500;

  var amountRow = document.getElementById('gfAmountRow');
  var customInput = document.getElementById('gfCustomAmount');
  var amountErr = document.getElementById('gfAmountErr');
  var toInput = document.getElementById('gfTo');
  var toEmailInput = document.getElementById('gfToEmail');
  var fromInput = document.getElementById('gfFrom');
  var messageInput = document.getElementById('gfMessage');
  var msgCount = document.getElementById('gfMsgCount');
  var dateInput = document.getElementById('gfDate');
  var previewMount = document.getElementById('gfPreview');
  var addBtn = document.getElementById('gfAdd');
  var statusEl = document.getElementById('gfStatus');
  var resultEl = document.getElementById('gfResult');
  var hp = document.getElementById('gfHp');

  var MAXMSG = 200;
  var selectedAmount = amounts[Math.floor(amounts.length / 2)] || amounts[0] || MIN_AMT;

  /* ---------- amount presets ---------- */
  amountRow.innerHTML = amounts.map(function (a) {
    return '<button type="button" class="amount-btn" data-amt="' + a + '" aria-pressed="false">' + KA_CORE.escapeHtml(KA_CORE.money(a)) + '</button>';
  }).join('');
  var amtButtons = Array.prototype.slice.call(amountRow.querySelectorAll('.amount-btn'));

  function markPresetSelection() {
    amtButtons.forEach(function (b) {
      var on = parseFloat(b.getAttribute('data-amt')) === selectedAmount && !customInput.value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function selectPreset(a) {
    selectedAmount = a;
    customInput.value = '';
    markPresetSelection();
    renderPreview();
  }
  amtButtons.forEach(function (b) {
    b.addEventListener('click', function () { selectPreset(parseFloat(b.getAttribute('data-amt'))); });
  });
  customInput.addEventListener('input', function () {
    var v = parseFloat(customInput.value);
    selectedAmount = isNaN(v) ? 0 : v;
    markPresetSelection();
    renderPreview();
  });

  /* ---------- send date: today or later (local calendar day, not UTC) ---------- */
  function localIso(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  dateInput.min = localIso();
  dateInput.value = localIso();

  /* ---------- live SVG card preview ---------- */
  function giftCardSvg(amountText, to, from) {
    return '<svg class="gift-card-svg" viewBox="0 0 640 400" role="img" aria-label="Gift card preview: ' + amountText + ', to ' + to + ', from ' + from + '">' +
      '<rect x="1" y="1" width="638" height="398" fill="var(--surface)" stroke="var(--gold)" stroke-width="2"></rect>' +
      '<rect x="1" y="1" width="638" height="6" fill="var(--berry)"></rect>' +
      '<text x="40" y="66" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="5" fill="var(--gold)">KHARIS &amp; ALETHEIA</text>' +
      '<text x="40" y="90" font-family="JetBrains Mono, monospace" font-size="10" letter-spacing="4" fill="var(--muted)">GIFT CARD</text>' +
      '<text x="40" y="218" font-family="Orbitron, sans-serif" font-weight="900" font-size="62" fill="var(--fg)">' + amountText + '</text>' +
      '<line x1="40" y1="266" x2="600" y2="266" stroke="var(--border-strong)" stroke-width="1"></line>' +
      '<text x="40" y="304" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="3" fill="var(--muted)">TO</text>' +
      '<text x="92" y="304" font-family="JetBrains Mono, monospace" font-size="14" fill="var(--fg)">' + to + '</text>' +
      '<text x="40" y="334" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="3" fill="var(--muted)">FROM</text>' +
      '<text x="92" y="334" font-family="JetBrains Mono, monospace" font-size="14" fill="var(--fg)">' + from + '</text>' +
      '<text x="600" y="378" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9" letter-spacing="2" fill="var(--muted)">EMAIL US TO REDEEM · APPLIED BY HAND</text>' +
      '</svg>';
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function renderPreview() {
    var amtText = selectedAmount > 0 ? KA_CORE.money(selectedAmount) : '£—';
    var to = truncate(toInput.value.trim() || 'Someone special', 22);
    var from = truncate(fromInput.value.trim() || 'A friend', 22);
    previewMount.innerHTML = giftCardSvg(KA_CORE.escapeHtml(amtText), KA_CORE.escapeHtml(to), KA_CORE.escapeHtml(from));
  }
  [toInput, fromInput].forEach(function (inp) { inp.addEventListener('input', renderPreview); });

  /* ---------- character counter ---------- */
  function updateMsgCount() {
    var len = messageInput.value.length;
    msgCount.textContent = len + ' / ' + MAXMSG;
    msgCount.classList.toggle('near', len > MAXMSG * 0.85 && len < MAXMSG);
    msgCount.classList.toggle('over', len >= MAXMSG);
  }
  messageInput.addEventListener('input', updateMsgCount);

  /* initial paint */
  selectPreset(selectedAmount);
  updateMsgCount();

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

    if (!(selectedAmount >= MIN_AMT && selectedAmount <= MAX_AMT)) {
      amountErr.textContent = 'Choose an amount, or enter a custom amount between £10 and £500.';
      ok = false;
    } else {
      amountErr.textContent = '';
    }

    if (!KA_CORE.validate.required(toInput.value)) { setFieldError(toInput, "Who's this for?"); ok = false; }
    else setFieldError(toInput, '');

    if (!KA_CORE.validate.email(toEmailInput.value)) { setFieldError(toEmailInput, "Enter a valid recipient email."); ok = false; }
    else setFieldError(toEmailInput, '');

    if (!KA_CORE.validate.required(fromInput.value)) { setFieldError(fromInput, 'Tell us who this is from.'); ok = false; }
    else setFieldError(fromInput, '');

    if (!dateInput.value) { setFieldError(dateInput, 'Choose a send date.'); ok = false; }
    else if (dateInput.value < dateInput.min) { setFieldError(dateInput, "Send date can't be in the past."); ok = false; }
    else setFieldError(dateInput, '');

    if (messageInput.value.length > MAXMSG) { setFieldError(messageInput, 'Keep your message under 200 characters.'); ok = false; }
    else setFieldError(messageInput, '');

    return ok;
  }

  function focusFirstError() {
    var bad = form.querySelector('.has-err input, .has-err textarea');
    if (bad) bad.focus();
    else if (amountErr.textContent) customInput.focus();
  }

  function uid() { return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function showSuccess(item) {
    var e = KA_CORE.escapeHtml;
    resultEl.hidden = false;
    resultEl.className = 'result-panel ok';
    resultEl.setAttribute('role', 'status');
    resultEl.innerHTML =
      '<h3>Added to your cart</h3>' +
      '<dl>' +
      '<dt>Amount</dt><dd>' + e(KA_CORE.money(item.amount)) + '</dd>' +
      '<dt>To</dt><dd>' + e(item.to) + ' (' + e(item.email) + ')</dd>' +
      '<dt>From</dt><dd>' + e(item.from) + '</dd>' +
      '<dt>Sends on</dt><dd>' + e(item.sendOn) + '</dd>' +
      (item.message ? '<dt>Message</dt><dd>' + e(item.message) + '</dd>' : '') +
      '</dl>' +
      '<p class="via-note">Added to your order — we\'ll send this to your recipient by hand ahead of the date you chose. <a href="checkout.html">Go to checkout →</a></p>';
    resultEl.setAttribute('tabindex', '-1');
    /* kaCart.addItem() below opens the cart drawer as a focus-trapped modal — don't
       fight that trap by pulling focus back out to this panel. It stays available
       (and keyboard-reachable) once the drawer is closed. */
  }

  function showFailure() {
    resultEl.hidden = false;
    resultEl.className = 'result-panel err';
    resultEl.setAttribute('role', 'alert');
    resultEl.innerHTML = '<h3>Couldn’t add that to your cart</h3><p>Something went wrong saving this on your device. Try again — if it keeps happening, refresh the page first.</p>' +
      '<div class="retry-row"><button type="button" class="btn btn-gold" id="gfRetry">Try again</button></div>';
    resultEl.setAttribute('tabindex', '-1');
    resultEl.focus();
    var retry = document.getElementById('gfRetry');
    if (retry) retry.addEventListener('click', function () { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); });
  }

  function setBusy(isBusy) {
    addBtn.disabled = isBusy;
    addBtn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    addBtn.innerHTML = isBusy ? '<span class="spin" aria-hidden="true"></span>Adding…' : 'Add to cart';
    statusEl.textContent = isBusy ? 'Adding to your cart…' : '';
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

    var item = {
      kind: 'gift',
      uid: uid(),
      amount: selectedAmount,
      to: toInput.value.trim(),
      from: fromInput.value.trim(),
      email: toEmailInput.value.trim(),
      message: messageInput.value.trim(),
      sendOn: dateInput.value,
      qty: 1
    };

    if (hp && hp.value) {
      /* honeypot tripped: behave as if it worked, but never touch the cart */
      showSuccess(item);
      form.reset();
      return;
    }

    setBusy(true);
    try {
      kaCart.addItem(item);
      setBusy(false);
      showSuccess(item);
      kaToast('Gift card added to your cart', 'ok');
      form.reset();
      dateInput.min = localIso();
      dateInput.value = localIso();
      selectPreset(amounts[Math.floor(amounts.length / 2)] || amounts[0]);
      updateMsgCount();
    } catch (err) {
      setBusy(false);
      showFailure();
    }
  });
})();
