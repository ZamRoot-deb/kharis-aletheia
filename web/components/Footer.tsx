import Link from 'next/link';

/* `<footer data-ka-footer>` — ported from ../app.js's injected footer markup.
   Year is hardcoded (CONTRACT-NEXT.md offers hardcoding 2026 as one valid option
   for avoiding a `new Date().getFullYear()` server/client hydration mismatch —
   taken here since it needs no client boundary or effect at all). */
const YEAR = 2026;

export function Footer() {
  return (
    <footer data-ka-footer>
      <div className="wrap foot-inner">
        <Link href="/" aria-label="Kharis & Aletheia home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            decoding="async"
            loading="lazy"
            className="logo-dark"
            src="/assets/logo-horizontal-sm.png"
            width={800}
            height={207}
            alt="Kharis & Aletheia"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            decoding="async"
            loading="lazy"
            className="logo-light"
            src="/assets/logo-horizontal-navy.png"
            width={800}
            height={207}
            alt="Kharis & Aletheia"
          />
        </Link>
        <p className="foot-line">Grace &amp; truth, woven in</p>
        <div className="foot-grid">
          <nav className="foot-col" aria-label="Shop">
            <h4>Shop</h4>
            <Link href="/shop">All pieces</Link>
            <Link href="/shop#tees">Tees</Link>
            <Link href="/shop#sweatshirts">Sweatshirts</Link>
            <Link href="/shop#accessories">Accessories</Link>
            <Link href="/gift">Gift cards</Link>
          </nav>
          <nav className="foot-col" aria-label="Studios">
            <h4>Studios</h4>
            <Link href="/studio">Tee Studio</Link>
            <Link href="/lab">Print Lab</Link>
            <Link href="/bulk">Crew &amp; Bulk</Link>
          </nav>
          <nav className="foot-col" aria-label="House">
            <h4>House</h4>
            <Link href="/about">About</Link>
            <Link href="/makers">Makers</Link>
            <Link href="/lookbook">Lookbook</Link>
          </nav>
          <nav className="foot-col" aria-label="Help">
            <h4>Help</h4>
            <Link href="/contact">Contact</Link>
            <Link href="/sizing">Sizing</Link>
            <Link href="/policies">Refund Policy &amp; Terms</Link>
          </nav>
        </div>
        <p className="foot-copy">© {YEAR} KHARIS &amp; ALETHEIA — ALL RIGHTS RESERVED</p>
      </div>
    </footer>
  );
}
