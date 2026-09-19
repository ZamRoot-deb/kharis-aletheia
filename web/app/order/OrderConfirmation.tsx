'use client';

/* KHARIS & ALETHEIA — /order?ref=KA-XXXXXX confirmation. Ported from ../order.js.
   Reads the order snapshot ../checkout.js wrote to localStorage `ka_orders`. Client +
   Suspense (useSearchParams) per CONTRACT-NEXT.md's HYDRATION rule. Owns:
   app/checkout/** app/order/** — see CONTRACT-NEXT.md "commerce" row. */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';
import { Button } from '@/components/Button';
import { Money } from '@/components/Money';
import { findOrder, type StoredOrder } from '../checkout/orderStorage';
import { DRAFT_KEY } from '../checkout/CheckoutForm';

/* This route's title can only be known client-side (the order lives in
   localStorage, never on a server, so there's no generateMetadata path for
   it) — every other approach that was tried here lost a real, reproducible
   race against Next's own metadata handling for this route:
     - `document.title = …` in a plain useEffect: gets silently reset back to
       the route's static "Order confirmed" title shortly after, on a hard/
       cold load specifically.
     - rendering a `<title>` element in JSX (React 19 hoists <title> to
       <head> from anywhere in the tree): still lost, and left 3 stray
       <title> tags in <head> — Next re-mounts its own static title again
       after this subtree finishes its client-only fill-in (this route's
       Suspense/useSearchParams boundary bails out of prerendering per
       Next's docs: "calling useSearchParams causes the Client Component
       tree up to the closest Suspense boundary to be client-side rendered"
       on a page load — Next's router treats filling that boundary in as a
       small internal navigation and re-asserts the resolved static
       metadata for it once it settles, AFTER our nested effects/JSX commit).
   This hook is the robust fix: keep correcting document.title for a short
   window after mount via a MutationObserver on <head>, so whichever of the
   above finishes last, ours wins and stays won. Self-cleans on unmount. */
function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    document.title = title;
    const observer = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    /* Next's post-hydration re-assertion (see above) happens once, shortly
       after mount — stop correcting after a generous window so a person
       manually editing the tab title later (browser extensions, etc.)
       isn't fought forever. */
    const timer = window.setTimeout(() => observer.disconnect(), 4000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [title]);
}

/* When the order didn't reach us over an automated channel (mailto fallback, or no
   channel at all), we can't promise an automated follow-up email — so the "received"
   step and the payment-link step get softer, honest copy. */
function deliveryConfirmed(o: StoredOrder): boolean {
  return o.deliveryVia === 'endpoint';
}

interface TimelineStep {
  label: string;
  detail: string;
  state: 'done' | 'current' | '';
}

function timelineSteps(o: StoredOrder): TimelineStep[] {
  const leadTime = KA_CONFIG.leadTime || '7–10 working days';
  const paid = o.status === 'paid';
  const autoConfirmed = deliveryConfirmed(o);
  return [
    {
      label: 'Request received',
      detail: autoConfirmed ? 'Your order details reached us.' : 'Your order details are saved — see the note above about completing this.',
      state: 'done',
    },
    {
      label: paid ? 'Payment received' : 'Payment link emailed',
      detail: paid
        ? 'Payment was completed at checkout.'
        : autoConfirmed
          ? 'We’ll email a secure payment link shortly — nothing is charged until it’s settled.'
          : 'We’ll be in touch about payment once your order reaches us — nothing is charged until it’s settled.',
      state: paid ? 'done' : 'current',
    },
    { label: 'Cloth cut within 24 hours', detail: 'Production starts once payment is confirmed.', state: paid ? 'current' : '' },
    { label: 'Ships in ' + leadTime, detail: 'You’ll get a note the moment it leaves us.', state: '' },
  ];
}

function studioLabel(list: any[] | undefined, id: string): string {
  const found = Array.isArray(list) ? list.find((x) => x.id === id) : null;
  return found ? found.name : id;
}

function ItemsTable({ items }: { items: any[] }) {
  return (
    <div className="order-table-wrap">
      <table className="order-summary-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Unit</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((it, i) => {
            const kind = it.kind || 'product';
            let title: string;
            let sub: string;
            if (kind === 'gift') {
              title = 'Digital gift card';
              const bits: string[] = [];
              if (it.to) bits.push('To ' + it.to);
              if (it.from) bits.push('From ' + it.from);
              sub = bits.join(' · ');
            } else if (kind === 'custom') {
              const cfgStudio = KA_CONFIG.studio || ({} as any);
              title = it.name || 'Custom piece';
              const bits: string[] = [];
              if (it.garment) bits.push(studioLabel(cfgStudio.garments, it.garment));
              if (it.colour) bits.push(studioLabel(cfgStudio.colours, it.colour));
              if (it.size) bits.push('Size ' + it.size);
              sub = bits.join(' · ');
            } else {
              title = it.name || 'Item';
              sub = it.size ? 'Size ' + it.size : '';
            }
            return (
              <tr key={i}>
                <td>
                  {title}
                  {sub && (
                    <>
                      <br />
                      <span style={{ color: 'var(--muted)', fontSize: '.9em' }}>{sub}</span>
                    </>
                  )}
                </td>
                <td className="num">{it.qty}</td>
                <td className="num">
                  <Money value={it.unitPrice} />
                </td>
                <td className="num">
                  <Money value={it.lineTotal} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ t }: { t: StoredOrder['totals'] }) {
  t = t || ({} as any);
  return (
    <div className="totals">
      <div className="price-row">
        <span>Subtotal</span>
        <b>
          <Money value={t.subtotal || 0} />
        </b>
      </div>
      {!!t.discount && (
        <div className="price-row">
          <span>Discount</span>
          <b>
            −<Money value={t.discount} />
          </b>
        </div>
      )}
      <div className="price-row">
        <span>Shipping</span>
        <b>{t.shipping === 0 ? 'FREE' : <Money value={t.shipping || 0} />}</b>
      </div>
      <div className="price-row grand">
        <span>Total</span>
        <b>
          <Money value={t.total || 0} />
        </b>
      </div>
    </div>
  );
}

/* Persistent (non-dismissable) notice for orders that went out via the mailto
   fallback or couldn't be sent anywhere automatically — a toast on the previous page
   isn't enough, since missing it means the shop never sees the order. */
function DeliveryNotice({ order }: { order: StoredOrder }) {
  const via = order.deliveryVia;
  if (via !== 'mailto' && via !== 'local') return null;
  const contactEmail = KA_CONFIG.contactEmail || '';
  const subject = 'Kharis & Aletheia order ' + order.ref;
  const bodyLines = ['Order ref: ' + order.ref, 'Email: ' + ((order.contact && order.contact.email) || ''), 'Total: ' + KA_CORE.money((order.totals && order.totals.total) || 0)];
  const mailtoHref = contactEmail ? 'mailto:' + contactEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyLines.join('\n')) : '';

  if (via === 'mailto') {
    return (
      <div className="order-block order-delivery-notice" role="alert">
        <h3>One more step — send that email</h3>
        <p>
          Your email app should have opened with your order details pre-filled. <b>Please press Send there</b> — this order hasn’t reached us until you do.
        </p>
        <p>
          {mailtoHref ? (
            <>
              If nothing opened, <a href={mailtoHref}>send it directly</a> instead.
            </>
          ) : (
            <>If nothing opened, please contact us with your reference ({order.ref}) so we don’t miss it.</>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="order-block order-delivery-notice" role="alert">
      <h3>We haven’t received this order yet</h3>
      <p>
        We couldn’t send your order details automatically.{' '}
        {mailtoHref ? (
          <>
            Please <a href={mailtoHref}>email us your order</a> so we don’t miss it.
          </>
        ) : (
          <>Please contact us directly with your reference ({order.ref}) so we don’t miss it.</>
        )}
      </p>
    </div>
  );
}

function AddressBlock({ order }: { order: StoredOrder }) {
  const a = order.address;
  if (!a) return <p className="order-address">Digital order — no delivery address needed.</p>;
  const lines = [a.fullName, a.address1, a.address2, [a.city, a.region].filter(Boolean).join(', '), a.postcode, a.country].filter(Boolean);
  return (
    <p className="order-address">
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

function NotFoundPanel({ refValue }: { refValue: string }) {
  return (
    <div className="order-notfound panel reveal in">
      <div className="empty-state">
        <p className="es-title">We can’t find that order</p>
        <p className="es-copy">
          {refValue ? (
            <>
              We couldn’t match <b>{refValue}</b> to an order on this device.
            </>
          ) : (
            'No order reference was given.'
          )}
        </p>
        <p className="order-notfound-note">
          Confirmations are stored on the device and browser you checked out from. If you placed an order and think this is a mistake, get in touch with your
          reference to hand.
        </p>
        <div className="order-actions">
          <Button variant="solid" href="/shop">
            Continue shopping →
          </Button>
          <Button variant="gold" href="/contact">
            Contact us
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClearedPanel() {
  return (
    <div className="order-card reveal in">
      <div className="empty-state">
        <p className="es-title">Your data on this device has been cleared</p>
        <p className="es-copy">Cart, order history and saved drafts from this browser are gone. This doesn’t affect any order already placed with us — get in touch if you need anything about it.</p>
        <div className="order-actions">
          <Button variant="solid" href="/shop">
            Continue shopping →
          </Button>
          <Button variant="gold" href="/contact">
            Contact us
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: StoredOrder }) {
  const cart = useCart();
  const [cleared, setCleared] = useState(false);

  const paid = order.status === 'paid';
  const created = order.createdAt ? new Date(order.createdAt) : null;
  const createdLabel = created && !isNaN(created.getTime()) ? created.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const contactEmail = KA_CONFIG.contactEmail || '';

  useDocumentTitle(order.ref + ' — ORDER CONFIRMED — KHARIS & ALETHEIA');

  function clearDeviceData() {
    const ok = window.confirm('This clears your cart, order history and saved form drafts from this browser only. It cannot be undone. Continue?');
    if (!ok) return;
    try {
      ['ka_cart', 'ka_orders', 'ka_submissions', 'ka_prints'].forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
    cart.clear();
    setCleared(true);
  }

  if (cleared) return <ClearedPanel />;

  return (
    <div className="order-card reveal in">
      <span className={paid ? 'badge berry' : 'badge'}>{paid ? 'Payment received' : 'Order request received'}</span>
      <h2 className="order-ref">{order.ref}</h2>
      <p className="order-sub">
        {createdLabel ? 'Placed ' + createdLabel + ' · ' : ''}
        {(order.contact && order.contact.email) || ''}
      </p>

      <DeliveryNotice order={order} />

      <div className="order-block">
        <h3>What happens next</h3>
        <ul className="order-timeline">
          {timelineSteps(order).map((s) => (
            <li key={s.label} className={s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : ''}>
              <b>{s.label}</b>
              {s.detail}
            </li>
          ))}
        </ul>
      </div>

      <div className="order-block">
        <h3>Order summary</h3>
        <ItemsTable items={order.items} />
        <Totals t={order.totals} />
      </div>

      <div className="grid-2">
        <div className="order-block">
          <h3>Delivery</h3>
          <AddressBlock order={order} />
          {order.shipping && (
            <p className="order-address" style={{ marginTop: '.6rem' }}>
              {order.shipping.label || ''}
              {order.shipping.days ? ' · ' + order.shipping.days : ''}
            </p>
          )}
        </div>
        <div className="order-block">
          <h3>Contact</h3>
          <p className="order-address">
            {(order.contact && order.contact.email) || ''}
            {order.contact && order.contact.phone ? (
              <>
                <br />
                {order.contact.phone}
              </>
            ) : null}
          </p>
        </div>
      </div>

      {order.notes && (order.notes.order || order.notes.gift) && (
        <div className="order-block">
          <h3>Notes</h3>
          {order.notes.order && <p>{order.notes.order}</p>}
          {order.notes.gift && <p>{order.notes.gift}</p>}
        </div>
      )}

      <div className="order-actions">
        <Button variant="gold" type="button" onClick={() => window.print()}>
          Print this order
        </Button>
        <Button variant="gold" href={contactEmail ? `mailto:${contactEmail}?subject=${encodeURIComponent('Order ' + order.ref)}` : '/contact'}>
          Contact us about this order
        </Button>
        <Button variant="solid" href="/shop">
          Continue shopping →
        </Button>
      </div>

      <p className="order-privacy-note">
        Order history lives only in this browser, not on a server. On a shared or public device,{' '}
        <button type="button" className="link-btn" onClick={clearDeviceData}>
          clear your data on this device
        </button>
        .
      </p>
    </div>
  );
}

function OrderLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  );
}

export function OrderConfirmation() {
  const params = useSearchParams();
  const refRaw = (params.get('ref') || '').trim();
  /* undefined = not yet looked up (matches the server's render — localStorage is
     read only in an effect after mount, per the HYDRATION rule); null = looked up,
     no match. */
  const [order, setOrder] = useState<StoredOrder | null | undefined>(undefined);

  useEffect(() => {
    setOrder(findOrder(refRaw));
  }, [refRaw]);

  useDocumentTitle(order === null ? 'ORDER NOT FOUND — KHARIS & ALETHEIA' : null);

  if (order === undefined) return <OrderLoading />;
  if (!order) return <NotFoundPanel refValue={refRaw} />;
  return <OrderCard order={order} />;
}
