/* KHARIS & ALETHEIA — order localStorage persistence, shared by the checkout submit
   flow and the order confirmation lookup. Ported from ../checkout.js's persistOrder()
   and ../order.js's findOrder() — same key (`ka_orders`), same cap/expiry rules.
   Owns: app/checkout/** app/order/** — see CONTRACT-NEXT.md "commerce" row. DOM-free
   (only touches localStorage), safe to call from client event handlers/effects only. */

import type { Order } from '@/lib/types';

/** `deliveryVia`/`paystackReference` aren't part of lib/types.ts's shared `Order`
 *  type (engine-owned; not edited here per OWNS scope) but checkout.js's
 *  buildOrder()/order.js's renderOrder() both read/write them — extend locally. */
export interface StoredOrder extends Order {
  deliveryVia?: 'endpoint' | 'mailto' | 'local';
  paystackReference?: string;
}

const ORDERS_KEY = 'ka_orders';
/* Orders hold full PII (name, address, phone, email) and live in localStorage
   indefinitely with no server-side counterpart — cap by count and age on every
   write so a shared/kiosk browser doesn't accumulate an unbounded PII archive. */
const ORDERS_MAX = 50;
const ORDERS_MAX_AGE_DAYS = 90;

function readOrders(): StoredOrder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistOrder(order: StoredOrder): void {
  let orders = readOrders();
  const i = orders.findIndex((o) => o && o.ref === order.ref);
  if (i > -1) orders[i] = order;
  else orders.push(order);

  const cutoff = Date.now() - ORDERS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  orders = orders.filter((o) => {
    const t = o && o.createdAt ? new Date(o.createdAt).getTime() : NaN;
    return Number.isNaN(t) || t >= cutoff;
  });
  if (orders.length > ORDERS_MAX) orders = orders.slice(orders.length - ORDERS_MAX);

  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    /* storage full/unavailable */
  }
}

export function findOrder(ref: string): StoredOrder | null {
  if (!ref) return null;
  const orders = readOrders();
  const needle = ref.toLowerCase();
  const matches = orders.filter((o) => o && typeof o.ref === 'string' && o.ref.toLowerCase() === needle);
  return matches.length ? matches[matches.length - 1] : null;
}
