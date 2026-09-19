'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useCart } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';
import type { CartItem } from '@/lib/types';
import { cn } from '@/lib/cn';
import { lockScroll, trapTabKey, unlockScroll } from './dom-utils';
import { Money } from './Money';

/* KHARIS & ALETHEIA — cart drawer. Ported from ../app.js's kaCart renderDrawer()/
   openDrawer()/closeDrawer(). Renders all 3 CartItem kinds (product/gift/custom)
   with guarded thumbnails exactly like the old safeImgSrc — a custom item's `thumb`
   is an untrusted SVG data-URI that round-tripped through localStorage, so it's
   validated, never escaped-as-text (escaping would corrupt the data: URI itself). */

const GIFT_THUMB =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#120a02"/><rect x="7" y="24" width="50" height="30" fill="none" stroke="#d8b26a" stroke-width="2"/><path d="M7 32h50M32 24v30M18 24c0-4.5 4-8 9-8s7.5 3.5 5 8M46 24c0-4.5-4-8-9-8s-7.5 3.5-5 8" fill="none" stroke="#d8b26a" stroke-width="2"/></svg>'
  );
const CUSTOM_THUMB =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#120a02"/><path d="M22 8l10 6 10-6 10 8-6 6v34H18V22l-6-6z" fill="none" stroke="#d8b26a" stroke-width="2"/></svg>'
  );

function kindOf(it: any): string {
  return it && it.kind ? it.kind : 'product';
}

/** Ported verbatim from ../app.js's safeImgSrc — refuses anything that could break
 *  out of `src="…"` or isn't a recognisable image reference, falling back to a
 *  built-in placeholder rather than ever emitting `src=""`. */
function safeImgSrc(src: any, fallback: string): string {
  if (typeof src !== 'string' || !src) return fallback;
  if (/["'<>]/.test(src)) return fallback;
  if (/^data:image\//.test(src) || /^(assets\/|\/assets\/|https:\/\/|\.\/|\.\.\/)/.test(src)) return src;
  return fallback;
}

function thumbFor(it: any): string {
  const kind = kindOf(it);
  if (kind === 'product') {
    const p = KA_CORE.findProduct(it.id);
    return p ? `/${p.img}` : CUSTOM_THUMB;
  }
  if (kind === 'custom') return safeImgSrc(it.thumb, CUSTOM_THUMB);
  if (kind === 'gift') return GIFT_THUMB;
  return CUSTOM_THUMB;
}

function nameFor(it: any): string {
  const kind = kindOf(it);
  if (kind === 'product') {
    const p = KA_CORE.findProduct(it.id);
    return p ? p.name : 'Item no longer available';
  }
  if (kind === 'custom') return it.name || 'Custom piece';
  if (kind === 'gift') return 'Gift card';
  return 'Item';
}

function studioLabel(list: any[] | undefined, id: string): string {
  const found = Array.isArray(list) ? list.find((x) => x.id === id) : null;
  return found ? found.name : id;
}

function metaFor(it: any): string {
  const kind = kindOf(it);
  if (kind === 'product') return 'SIZE ' + (it.size || 'M');
  if (kind === 'custom') {
    const studio = (KA_CONFIG.studio || {}) as any;
    const bits: string[] = [];
    if (it.colour) bits.push(studioLabel(studio.colours, it.colour));
    if (it.size) bits.push('SIZE ' + it.size);
    if (it.design && it.design.placement) bits.push(studioLabel(studio.placements, it.design.placement));
    return bits.join(' · ');
  }
  if (kind === 'gift') return 'To ' + (it.to || '—');
  return '';
}

export function CartDrawer() {
  const { items, count, subtotal, update, remove, isOpen, close } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  /* guards a fast double-click landing on the freshly re-rendered next row after a
     qty/remove mutation shifts array indices — ported from ../app.js's
     withRowLock(), rows here are likewise keyed by render-time index */
  const rowLocked = useRef(false);

  function withRowLock(fn: () => void) {
    if (rowLocked.current) return;
    rowLocked.current = true;
    fn();
    setTimeout(() => {
      rowLocked.current = false;
    }, 350);
  }

  useEffect(() => {
    if (!isOpen) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    lockScroll();
    const drawer = drawerRef.current;
    if (drawer) {
      const closeBtn = drawer.querySelector<HTMLElement>('.cart-close');
      (closeBtn || drawer).focus();
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Tab' && drawer) trapTabKey(drawer, e);
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      unlockScroll();
      if (lastFocused.current && typeof lastFocused.current.focus === 'function') {
        lastFocused.current.focus();
      }
    };
  }, [isOpen, close]);

  const leadTime = KA_CONFIG.leadTime || '7–10 days';
  /* gift cards are digital-only (see KA_CORE.totals()'s own giftOnly special-case) —
     a cart holding gift cards only must not claim it's "made to order" and shipped */
  const giftOnly = items.length > 0 && items.every((it) => kindOf(it) === 'gift');

  return (
    <>
      <div className={cn('cart-overlay', isOpen && 'open')} onClick={close} />
      <aside
        ref={drawerRef}
        className={cn('cart-drawer', isOpen && 'open')}
        tabIndex={-1}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-labelledby="cartDrawerTitle"
      >
        <div className="cart-head">
          <h3 id="cartDrawerTitle">Your cart{items.length ? ' · ' + count : ''}</h3>
          <button className="cart-close" type="button" aria-label="Close cart" onClick={close}>
            ×
          </button>
        </div>

        <div className="cart-body">
          {!items.length ? (
            <div className="empty-state cart-empty">
              <p className="es-title">Your cart is empty</p>
              <p className="es-copy">Every piece is made to order — go find yours.</p>
              <Link className="btn btn-gold" href="/shop">
                Shop the collection →
              </Link>
            </div>
          ) : (
            items.map((it: CartItem, idx: number) => {
              const kind = kindOf(it);
              const thumb = thumbFor(it);
              const name = nameFor(it);
              const meta = metaFor(it);
              const unit = KA_CORE.unitPrice(it);
              const qty = kind === 'gift' ? 1 : Math.max(1, Number((it as any).qty) || 1);
              return (
                <div className="cart-item" data-kind={kind} key={idx}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img decoding="async" src={thumb} alt="" loading="lazy" />
                  <div className="ci-info">
                    <p className="ci-name">{name}</p>
                    {meta && <p className="ci-meta">{meta}</p>}
                    <p className="ci-price">
                      {kind === 'gift' ? (
                        <Money value={unit} />
                      ) : (
                        <>
                          <Money value={unit} /> × {qty}
                        </>
                      )}
                    </p>
                    {kind === 'gift' ? (
                      <p className="ci-note">Digital delivery · qty 1</p>
                    ) : (
                      <div className="ci-qty">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => withRowLock(() => update(idx, qty - 1))}
                        >
                          −
                        </button>
                        <span>{qty}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => withRowLock(() => update(idx, qty + 1))}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button className="ci-remove" type="button" onClick={() => withRowLock(() => remove(idx))}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="cart-foot">
          <div className="price-row cart-total">
            <span>Subtotal</span>
            <b>
              <Money value={subtotal} />
            </b>
          </div>
          <Link
            className="btn btn-solid"
            href="/checkout"
            data-checkout
            aria-disabled={items.length ? undefined : true}
            tabIndex={items.length ? undefined : -1}
            style={items.length ? undefined : { opacity: 0.4, pointerEvents: 'none' }}
          >
            Checkout →
          </Link>
          <p className="cart-note">
            {giftOnly ? 'Sent digitally · delivered on your chosen date' : `Made to order · ships in ${leadTime}`}
          </p>
        </div>
      </aside>
    </>
  );
}
