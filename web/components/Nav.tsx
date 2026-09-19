'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useCart, useTheme, useWishlist } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_COLLECTIONS, KA_PRODUCTS } from '@/lib/products';
import { cn } from '@/lib/cn';
import { lockScroll, trapTabKey, unlockScroll } from './dom-utils';

/* KHARIS & ALETHEIA — top nav + mobile menu. Ported from ../app.js's injected
   `<nav class="nav">` / `<div class="mobile-menu">` (both were built once, client-
   side, and prepended to <body> on every old page — here they're just JSX in
   app/layout.tsx via this component, with real next/link routes instead of
   shop.html-style hrefs). Live counts come straight from KA_PRODUCTS/KA_CONFIG —
   deterministic, no localStorage/window involved, so computing them at render time
   is hydration-safe. */

const available = KA_PRODUCTS.filter((p) => !p.sold);
const NAV_COUNTS = {
  all: available.length,
  tees: available.filter((p) => p.cat === 'tees').length,
  sweatshirts: available.filter((p) => p.cat === 'sweatshirts').length,
  accessories: available.filter((p) => p.cat === 'accessories').length,
};
const COLLECTIONS_COUNT = KA_COLLECTIONS.length;
/* the real floor is the gift page's custom-amount minimum (GiftForm.tsx MIN_AMT),
   not the lowest preset in KA_CONFIG.giftAmounts — presets start at 25, but any
   amount from 10 is accepted, so advertise the true minimum here too */
const GIFT_FROM = 10;
const GIFT_LABEL = 'From ' + KA_CORE.money(GIFT_FROM);

export function Nav() {
  const pathname = usePathname() || '/';
  const { theme, toggle: toggleTheme } = useTheme();
  const { count: wishCount } = useWishlist();
  const { count: cartCount, open: openCart } = useCart();

  const isShop = pathname === '/shop' || pathname.startsWith('/shop/') || pathname.startsWith('/product');
  const isStudios = pathname.startsWith('/studio') || pathname.startsWith('/lab') || pathname.startsWith('/bulk');
  const isLookbook = pathname.startsWith('/lookbook');
  const isMakers = pathname.startsWith('/makers');
  const isSizing = pathname.startsWith('/sizing');
  const isAbout = pathname.startsWith('/about');

  const [openDrop, setOpenDrop] = useState<'shop' | 'studios' | null>(null);
  /* mouse-hover truth, tracked separately from the click-toggle `openDrop` state:
     CSS opens `.drop-panel` on plain `:hover` (see base.css .nav-drop:hover), so
     aria-expanded must mirror hover too or it goes stale while a mouse user has the
     panel visibly open — without changing the existing click-to-pin behaviour */
  const [hoverDrop, setHoverDrop] = useState<'shop' | 'studios' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const shopId = useId();
  const studiosId = useId();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileLastFocused = useRef<HTMLElement | null>(null);

  /* close an open desktop dropdown on outside click / Escape (CSS handles hover;
     this is only for the click-toggle path — keyboard + touch) */
  useEffect(() => {
    if (!openDrop) return;
    const onDocClick = () => setOpenDrop(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDrop(null);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openDrop]);

  /* mobile menu: scroll lock, Escape, focus trap + initial focus + focus-return —
     same pattern as CartDrawer/ModalHost (dom-utils.ts trapTabKey + captured
     lastFocused), since below 1024px this overlay is the only way to reach any
     nav destination and must behave like a proper dialog */
  useEffect(() => {
    if (!mobileOpen) return;
    mobileLastFocused.current = document.activeElement as HTMLElement | null;
    lockScroll();
    const menu = mobileMenuRef.current;
    if (menu) {
      const first = menu.querySelector<HTMLElement>('a[href], button:not([disabled])');
      (first || menu).focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
      else if (e.key === 'Tab' && menu) trapTabKey(menu, e);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      unlockScroll();
      document.removeEventListener('keydown', onKey);
      if (mobileLastFocused.current && typeof mobileLastFocused.current.focus === 'function') {
        mobileLastFocused.current.focus();
      }
    };
  }, [mobileOpen]);

  /* close both menus on route change */
  useEffect(() => {
    setOpenDrop(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="nav">
        <Link className="nav-logo" href="/" aria-label="Kharis & Aletheia home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            decoding="async"
            className="logo-dark"
            src="/assets/logo-horizontal-sm.png"
            width={800}
            height={207}
            alt="Kharis & Aletheia"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            decoding="async"
            className="logo-light"
            src="/assets/logo-horizontal-navy.png"
            width={800}
            height={207}
            alt="Kharis & Aletheia"
          />
        </Link>

        <div className="nav-links">
          <div
            className={cn('nav-drop', openDrop === 'shop' && 'open')}
            onMouseEnter={() => setHoverDrop('shop')}
            onMouseLeave={() => setHoverDrop((cur) => (cur === 'shop' ? null : cur))}
          >
            <button
              type="button"
              className={isShop ? 'active' : ''}
              aria-haspopup="true"
              aria-expanded={openDrop === 'shop' || hoverDrop === 'shop'}
              aria-controls={shopId}
              aria-current={isShop ? 'page' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setOpenDrop((cur) => (cur === 'shop' ? null : 'shop'));
              }}
            >
              Shop
            </button>
            <div className="drop-panel" id={shopId}>
              <Link href="/shop">
                All pieces <span>{NAV_COUNTS.all}</span>
              </Link>
              <Link href="/shop#tees">
                Tees <span>{NAV_COUNTS.tees}</span>
              </Link>
              <Link href="/shop#sweatshirts">
                Sweatshirts <span>{NAV_COUNTS.sweatshirts}</span>
              </Link>
              <Link href="/shop#accessories">
                Accessories <span>{NAV_COUNTS.accessories}</span>
              </Link>
              <Link href="/shop#collections">
                Collections <span>{COLLECTIONS_COUNT}</span>
              </Link>
              <Link href="/gift">
                Gift cards <span>{GIFT_LABEL}</span>
              </Link>
            </div>
          </div>

          <div
            className={cn('nav-drop', openDrop === 'studios' && 'open')}
            onMouseEnter={() => setHoverDrop('studios')}
            onMouseLeave={() => setHoverDrop((cur) => (cur === 'studios' ? null : cur))}
          >
            <button
              type="button"
              className={isStudios ? 'active' : ''}
              aria-haspopup="true"
              aria-expanded={openDrop === 'studios' || hoverDrop === 'studios'}
              aria-controls={studiosId}
              aria-current={isStudios ? 'page' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setOpenDrop((cur) => (cur === 'studios' ? null : 'studios'));
              }}
            >
              Studios
            </button>
            <div className="drop-panel" id={studiosId}>
              <Link href="/studio">
                Tee Studio <span>Custom</span>
              </Link>
              <Link href="/lab">
                Print Lab <span>Design</span>
              </Link>
              <Link href="/bulk">
                Crew &amp; Bulk <span>Teams</span>
              </Link>
            </div>
          </div>

          <Link href="/lookbook" className={isLookbook ? 'active' : ''} aria-current={isLookbook ? 'page' : undefined}>
            Lookbook
          </Link>
          <Link href="/makers" className={isMakers ? 'active' : ''} aria-current={isMakers ? 'page' : undefined}>
            Makers
          </Link>
          <Link href="/sizing" className={isSizing ? 'active' : ''} aria-current={isSizing ? 'page' : undefined}>
            Sizing
          </Link>
          <Link href="/about" className={isAbout ? 'active' : ''} aria-current={isAbout ? 'page' : undefined}>
            About
          </Link>
        </div>

        <div className="nav-actions">
          <button className="theme-toggle" type="button" aria-label="Switch theme" onClick={toggleTheme}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
            </svg>
            <span className="tt-label">{theme === 'light' ? 'DARK' : 'LIGHT'}</span>
          </button>
          <Link className="wish-btn wish-btn-nav" href="/shop?wish=1" aria-label="View wishlist">
            <svg width="13" height="13" viewBox="0 0 24 24">
              <path d="M12 21s-7.5-4.7-10.2-9.2C.2 8.7 1.7 5 5.4 5c2.1 0 3.6 1.1 4.6 2.5C10.9 6.1 12.5 5 14.6 5c3.7 0 5.2 3.7 3.6 6.8C19.5 16.3 12 21 12 21z" />
            </svg>
            <span className={cn('wish-count', wishCount > 0 && 'show')}>{wishCount}</span>
          </Link>
          <button className="cart-btn-nav" type="button" aria-label="Open cart" onClick={openCart}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M6 6h15l-1.5 9h-12z" />
              <path d="M6 6L5 3H2" />
              <circle cx="9" cy="20" r="1.6" />
              <circle cx="18" cy="20" r="1.6" />
            </svg>
            <span className={cn('cart-count', cartCount > 0 && 'show')}>{cartCount}</span>
          </button>
          <Link className="nav-start" href="/shop">
            Shop now →
          </Link>
          <button
            className="nav-burger"
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="kaMobileMenu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </nav>

      <div
        className={cn('mobile-menu', mobileOpen && 'open')}
        id="kaMobileMenu"
        ref={mobileMenuRef}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Mobile menu"
        tabIndex={-1}
      >
        <Link href="/shop" className={isShop ? 'active' : ''} aria-current={isShop ? 'page' : undefined}>
          Shop
        </Link>
        <div className="m-sub">
          <Link href="/shop#tees">Tees</Link>
          <Link href="/shop#sweatshirts">Sweatshirts</Link>
          <Link href="/shop#accessories">Accessories</Link>
          <Link href="/shop#collections">Collections</Link>
          <Link href="/gift">Gift cards</Link>
        </div>
        <Link href="/studio" className={isStudios ? 'active' : ''} aria-current={isStudios ? 'page' : undefined}>
          Studios
        </Link>
        <div className="m-sub">
          <Link href="/studio">Tee Studio</Link>
          <Link href="/lab">Print Lab</Link>
          <Link href="/bulk">Crew &amp; Bulk</Link>
        </div>
        <Link href="/lookbook" className={isLookbook ? 'active' : ''} aria-current={isLookbook ? 'page' : undefined}>
          Lookbook
        </Link>
        <Link href="/makers" className={isMakers ? 'active' : ''} aria-current={isMakers ? 'page' : undefined}>
          Makers
        </Link>
        <Link href="/sizing" className={isSizing ? 'active' : ''} aria-current={isSizing ? 'page' : undefined}>
          Sizing
        </Link>
        <Link href="/about" className={isAbout ? 'active' : ''} aria-current={isAbout ? 'page' : undefined}>
          About
        </Link>
        <div className="m-sub">
          <Link href="/shop?wish=1">Wishlist</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/policies">Refund Policy &amp; Terms</Link>
        </div>
      </div>
    </>
  );
}
