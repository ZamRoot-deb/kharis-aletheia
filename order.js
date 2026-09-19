/* KHARIS & ALETHEIA — order confirmation (order.html?ref=KA-XXXXXX)
   Reads the order snapshot written by checkout.js to localStorage 'ka_orders'.
   Owns: checkout.html checkout.js checkout.css order.html order.js — see
   CONTRACT.md "checkout" row. */

(function () {
  'use strict';

  const root = document.getElementById('orderRoot');
  if (!root) return;

  const esc = s => KA_CORE.escapeHtml(s == null ? '' : String(s));
  const money = n => KA_CORE.money(n);

  const params = new URLSearchParams(window.location.search);
  const refRaw = (params.get('ref') || '').trim();

  function findOrder(ref) {
    if (!ref) return null;
    let orders = [];
    try { orders = JSON.parse(localStorage.getItem('ka_orders')) || []; } catch (e) { orders = []; }
    const needle = ref.toLowerCase();
    const matches = orders.filter(o => o && typeof o.ref === 'string' && o.ref.toLowerCase() === needle);
    return matches.length ? matches[matches.length - 1] : null;
  }

  const order = findOrder(refRaw);

  if (!order) {
    document.title = 'ORDER NOT FOUND — KHARIS & ALETHEIA';
    renderNotFound(refRaw);
  } else {
    document.title = order.ref + ' — ORDER CONFIRMED — KHARIS & ALETHEIA';
    renderOrder(order);
  }

  function renderNotFound(ref) {
    const refLine = ref
      ? `We couldn’t match <b>${esc(ref)}</b> to an order on this device.`
      : 'No order reference was given.';
    root.innerHTML = `
      <div class="order-notfound panel reveal in">
        <div class="empty-state">
          <p class="es-title">We can’t find that order</p>
          <p class="es-copy">${refLine}</p>
          <p class="order-notfound-note">Confirmations are stored on the device and browser you checked out from. If you placed an order and think this is a mistake, get in touch with your reference to hand.</p>
          <div class="order-actions">
            <a class="btn btn-solid" href="shop.html">Continue shopping →</a>
            <a class="btn btn-gold" href="contact.html">Contact us</a>
          </div>
        </div>
      </div>`;
  }

  /* When the order didn't reach us over an automated channel (mailto fallback,
     or no channel at all), we can't promise an automated follow-up email — so
     the "received" step and the payment-link step get softer, honest copy. */
  function deliveryConfirmed(o) {
    return o.deliveryVia === 'endpoint';
  }

  function timelineHtml(o) {
    const leadTime = (window.KA_CONFIG && KA_CONFIG.leadTime) || '7–10 working days';
    const paid = o.status === 'paid';
    const autoConfirmed = deliveryConfirmed(o);
    const steps = [
      {
        label: 'Request received',
        detail: autoConfirmed ? 'Your order details reached us.' : 'Your order details are saved — see the note above about completing this.',
        state: 'done'
      },
      {
        label: paid ? 'Payment received' : 'Payment link emailed',
        detail: paid
          ? 'Payment was completed at checkout.'
          : (autoConfirmed
            ? 'We’ll email a secure payment link shortly — nothing is charged until it’s settled.'
            : 'We’ll be in touch about payment once your order reaches us — nothing is charged until it’s settled.'),
        state: paid ? 'done' : 'current'
      },
      { label: 'Cloth cut within 24 hours', detail: 'Production starts once payment is confirmed.', state: paid ? 'current' : '' },
      { label: 'Ships in ' + leadTime, detail: 'You’ll get a note the moment it leaves us.', state: '' }
    ];
    return '<ul class="order-timeline">' + steps.map(s => {
      const cls = s.state === 'done' ? 'is-done' : (s.state === 'current' ? 'is-current' : '');
      return `<li class="${cls}"><b>${esc(s.label)}</b>${esc(s.detail)}</li>`;
    }).join('') + '</ul>';
  }

  function itemsTableHtml(items) {
    const rows = (items || []).map(it => {
      const kind = it.kind || 'product';
      let title, sub;
      if (kind === 'gift') {
        title = 'Digital gift card';
        const bits = [];
        if (it.to) bits.push('To ' + it.to);
        if (it.from) bits.push('From ' + it.from);
        sub = bits.join(' · ');
      } else if (kind === 'custom') {
        const cfgStudio = (window.KA_CONFIG && KA_CONFIG.studio) || {};
        const label = (list, id) => {
          const found = Array.isArray(list) ? list.find(x => x.id === id) : null;
          return found ? found.name : id;
        };
        title = it.name || 'Custom piece';
        const bits = [];
        if (it.garment) bits.push(label(cfgStudio.garments, it.garment));
        if (it.colour) bits.push(label(cfgStudio.colours, it.colour));
        if (it.size) bits.push('Size ' + it.size);
        sub = bits.join(' · ');
      } else {
        title = it.name || 'Item';
        sub = it.size ? 'Size ' + it.size : '';
      }
      return `<tr>
        <td>${esc(title)}${sub ? `<br><span style="color:var(--muted);font-size:.9em">${esc(sub)}</span>` : ''}</td>
        <td class="num">${esc(it.qty)}</td>
        <td class="num">${esc(money(it.unitPrice))}</td>
        <td class="num">${esc(money(it.lineTotal))}</td>
      </tr>`;
    }).join('');
    return `<div class="order-table-wrap"><table class="order-summary-table">
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function totalsHtml(t) {
    t = t || {};
    let html = `<div class="price-row"><span>Subtotal</span><b>${esc(money(t.subtotal || 0))}</b></div>`;
    if (t.discount) html += `<div class="price-row"><span>Discount</span><b>−${esc(money(t.discount))}</b></div>`;
    html += `<div class="price-row"><span>Shipping</span><b>${t.shipping === 0 ? 'FREE' : esc(money(t.shipping || 0))}</b></div>`;
    html += `<div class="price-row grand"><span>Total</span><b>${esc(money(t.total || 0))}</b></div>`;
    return `<div class="totals">${html}</div>`;
  }

  /* Persistent (non-dismissable) notice for orders that went out via the mailto
     fallback or couldn't be sent anywhere automatically — a toast on the previous
     page isn't enough, since missing it means the shop never sees the order. */
  function deliveryNoticeHtml(order) {
    const via = order.deliveryVia;
    if (via !== 'mailto' && via !== 'local') return '';
    const contactEmail = (window.KA_CONFIG && KA_CONFIG.contactEmail) || '';
    const subject = 'Kharis & Aletheia order ' + order.ref;
    const bodyLines = [
      'Order ref: ' + order.ref,
      'Email: ' + ((order.contact && order.contact.email) || ''),
      'Total: ' + money((order.totals && order.totals.total) || 0)
    ];
    const mailtoHref = contactEmail
      ? 'mailto:' + contactEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyLines.join('\n'))
      : '';
    if (via === 'mailto') {
      return `<div class="order-block order-delivery-notice" role="alert">
        <h3>One more step — send that email</h3>
        <p>Your email app should have opened with your order details pre-filled. <b>Please press Send there</b> — this order hasn’t reached us until you do.</p>
        <p>${mailtoHref ? `If nothing opened, <a href="${esc(mailtoHref)}">send it directly</a> instead.` : `If nothing opened, please contact us with your reference (${esc(order.ref)}) so we don’t miss it.`}</p>
      </div>`;
    }
    return `<div class="order-block order-delivery-notice" role="alert">
      <h3>We haven’t received this order yet</h3>
      <p>We couldn’t send your order details automatically. ${mailtoHref ? `Please <a href="${esc(mailtoHref)}">email us your order</a> so we don’t miss it.` : `Please contact us directly with your reference (${esc(order.ref)}) so we don’t miss it.`}</p>
    </div>`;
  }

  function addressHtml(order) {
    const a = order.address;
    if (!a) return '<p class="order-address">Digital order — no delivery address needed.</p>';
    const lines = [a.fullName, a.address1, a.address2, [a.city, a.region].filter(Boolean).join(', '), a.postcode, a.country]
      .filter(Boolean).map(esc);
    return `<p class="order-address">${lines.join('<br>')}</p>`;
  }

  function renderOrder(order) {
    const paid = order.status === 'paid';
    const created = order.createdAt ? new Date(order.createdAt) : null;
    const createdLabel = created && !isNaN(created.getTime())
      ? created.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const contactEmail = (window.KA_CONFIG && KA_CONFIG.contactEmail) || '';

    root.innerHTML = `
      <div class="order-card reveal in">
        <span class="badge ${paid ? 'berry' : ''}">${paid ? 'Payment received' : 'Order request received'}</span>
        <h2 class="order-ref">${esc(order.ref)}</h2>
        <p class="order-sub">${createdLabel ? 'Placed ' + esc(createdLabel) + ' · ' : ''}${esc((order.contact && order.contact.email) || '')}</p>

        ${deliveryNoticeHtml(order)}

        <div class="order-block">
          <h3>What happens next</h3>
          ${timelineHtml(order)}
        </div>

        <div class="order-block">
          <h3>Order summary</h3>
          ${itemsTableHtml(order.items)}
          ${totalsHtml(order.totals)}
        </div>

        <div class="grid-2">
          <div class="order-block">
            <h3>Delivery</h3>
            ${addressHtml(order)}
            ${order.shipping ? `<p class="order-address" style="margin-top:.6rem">${esc(order.shipping.label || '')}${order.shipping.days ? ' · ' + esc(order.shipping.days) : ''}</p>` : ''}
          </div>
          <div class="order-block">
            <h3>Contact</h3>
            <p class="order-address">
              ${esc((order.contact && order.contact.email) || '')}
              ${order.contact && order.contact.phone ? '<br>' + esc(order.contact.phone) : ''}
            </p>
          </div>
        </div>

        ${(order.notes && (order.notes.order || order.notes.gift)) ? `
        <div class="order-block">
          <h3>Notes</h3>
          ${order.notes.order ? `<p>${esc(order.notes.order)}</p>` : ''}
          ${order.notes.gift ? `<p>${esc(order.notes.gift)}</p>` : ''}
        </div>` : ''}

        <div class="order-actions">
          <button class="btn btn-gold" type="button" id="orderPrint">Print this order</button>
          <a class="btn btn-gold" href="${contactEmail ? 'mailto:' + esc(contactEmail) + '?subject=' + encodeURIComponent('Order ' + order.ref) : 'contact.html'}">Contact us about this order</a>
          <a class="btn btn-solid" href="shop.html">Continue shopping →</a>
        </div>

        <p class="order-privacy-note">Order history lives only in this browser, not on a server.
          On a shared or public device, <button type="button" class="link-btn" id="orderClearData">clear your data on this device</button>.</p>
      </div>`;

    const printBtn = document.getElementById('orderPrint');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const clearBtn = document.getElementById('orderClearData');
    if (clearBtn) clearBtn.addEventListener('click', clearDeviceData);
  }

  function clearDeviceData() {
    const ok = window.confirm('This clears your cart, order history and saved form drafts from this browser only. It cannot be undone. Continue?');
    if (!ok) return;
    try {
      ['ka_cart', 'ka_orders', 'ka_submissions', 'ka_prints', 'ka_checkout_draft'].forEach(k => localStorage.removeItem(k));
    } catch (e) { /* storage unavailable */ }
    root.innerHTML = `
      <div class="order-card reveal in">
        <div class="empty-state">
          <p class="es-title">Your data on this device has been cleared</p>
          <p class="es-copy">Cart, order history and saved drafts from this browser are gone. This doesn’t affect any order already placed with us — get in touch if you need anything about it.</p>
          <div class="order-actions">
            <a class="btn btn-solid" href="shop.html">Continue shopping →</a>
            <a class="btn btn-gold" href="contact.html">Contact us</a>
          </div>
        </div>
      </div>`;
  }
})();
