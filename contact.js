/* KHARIS & ALETHEIA — contact.html (contact form + FAQ) */
(function () {
  'use strict';

  /* direct email link + lead-time copy, rendered from config (never hardcoded) */
  Array.prototype.forEach.call(document.querySelectorAll('[data-contact-email-link]'), function (a) {
    a.href = 'mailto:' + KA_CONFIG.contactEmail;
    a.textContent = KA_CONFIG.contactEmail;
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-lead-time]'), function (el) {
    el.textContent = KA_CONFIG.leadTime;
  });

  var form = document.getElementById('contactForm');
  if (!form) return;

  var nameInput = document.getElementById('ctName');
  var emailInput = document.getElementById('ctEmail');
  var topicSelect = document.getElementById('ctTopic');
  var refInput = document.getElementById('ctRef');
  var messageInput = document.getElementById('ctMessage');
  var hp = document.getElementById('ctHp');
  var submitBtn = document.getElementById('ctSubmit');
  var statusEl = document.getElementById('ctStatus');
  var resultEl = document.getElementById('ctResult');

  var TOPIC_LABEL = {
    order: 'Order enquiry', sizing: 'Sizing help', custom: 'Custom print / design',
    bulk: 'Crew & Bulk', press: 'Press', other: 'Other'
  };

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

    if (!topicSelect.value) { setFieldError(topicSelect, 'Choose a topic.'); ok = false; }
    else setFieldError(topicSelect, '');

    if (!KA_CORE.validate.required(messageInput.value)) { setFieldError(messageInput, 'Add a message so we know how to help.'); ok = false; }
    else setFieldError(messageInput, '');

    return ok;
  }

  function focusFirstError() {
    var bad = form.querySelector('.has-err input, .has-err select, .has-err textarea');
    if (bad) bad.focus();
  }

  function channelNote(via) {
    if (via === 'endpoint') return 'Sent straight to our team — no further action needed from you.';
    if (via === 'mailto') return "Your email app should have opened with this message pre-filled. Please hit send there to complete it — if nothing opened, use the direct email link instead.";
    return "We've saved this message on this device. If you don't hear back within two working days, please email us directly so we don't miss it.";
  }

  function buildMailtoFallback(subject, lines) {
    return 'mailto:' + KA_CONFIG.contactEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function showSuccess(res, payload) {
    var e = KA_CORE.escapeHtml;
    resultEl.hidden = false;
    resultEl.className = 'result-panel ok';
    resultEl.setAttribute('role', 'status');
    resultEl.innerHTML =
      '<h3>Message sent</h3>' +
      '<dl>' +
      '<dt>Name</dt><dd>' + e(payload.name) + '</dd>' +
      '<dt>Email</dt><dd>' + e(payload.email) + '</dd>' +
      '<dt>Topic</dt><dd>' + e(TOPIC_LABEL[payload.topic] || payload.topic) + '</dd>' +
      (payload.orderRef ? '<dt>Order ref</dt><dd>' + e(payload.orderRef) + '</dd>' : '') +
      '<dt>Message</dt><dd>' + e(payload.message) + '</dd>' +
      '</dl>' +
      '<p class="via-note">' + e(channelNote(res.via)) + '</p>';
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
      '<p>Your message is saved on this device, but sending it failed. Try again, or email us directly — your email app will open with everything pre-filled.</p>' +
      '<div class="retry-row">' +
      '<button type="button" class="btn btn-gold" id="ctRetry">Try again</button>' +
      '<a class="btn btn-berry" href="' + buildMailtoFallback('Contact: ' + (TOPIC_LABEL[payload.topic] || payload.topic), [
        'Name: ' + payload.name, 'Email: ' + payload.email, 'Topic: ' + (TOPIC_LABEL[payload.topic] || payload.topic),
        'Order ref: ' + (payload.orderRef || '—'), '', payload.message
      ]) + '">Email us directly</a>' +
      '</div>';
    resultEl.setAttribute('tabindex', '-1');
    resultEl.focus();
    var retry = document.getElementById('ctRetry');
    if (retry) retry.addEventListener('click', function () { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); });
  }

  function setBusy(isBusy) {
    submitBtn.disabled = isBusy;
    submitBtn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    submitBtn.innerHTML = isBusy ? '<span class="spin" aria-hidden="true"></span>Sending…' : 'Send message';
    statusEl.textContent = isBusy ? 'Sending your message…' : '';
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

    var payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      topic: topicSelect.value,
      orderRef: refInput.value.trim(),
      message: messageInput.value.trim()
    };

    if (hp && hp.value) {
      showSuccess({ ok: true, via: 'local' }, payload);
      form.reset();
      return;
    }

    setBusy(true);
    kaForms.submit('contact', payload).then(function (res) {
      setBusy(false);
      if (res && res.ok) {
        showSuccess(res, payload);
        form.reset();
      } else {
        showFailure(payload);
      }
    }).catch(function () {
      setBusy(false);
      showFailure(payload);
    });
  });
})();
