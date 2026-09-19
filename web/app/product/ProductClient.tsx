'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useCart, useModal, useToast } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';
import { KA_CAT_LABEL, KA_COLLECTIONS, KA_MAKERS, KA_PRODUCTS } from '@/lib/products';
import type { Maker, Product } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/Button';
import { Money } from '@/components/Money';
import { WishButton } from '@/components/WishButton';
import { GlitchHeading } from '@/components/GlitchHeading';
import { PdAccordion, PdAccordionItem } from './_components/PdAccordion';
import { RelatedCard } from './_components/RelatedCard';
import { SizeGuideModal, sizeGuideLabel } from './_components/SizeGuideModal';

/* KHARIS & ALETHEIA — /product?id=. Ported from ../product.html + ../product.js:
   gallery + zoom thumbs, size radio group + Find-my-size modal, qty stepper, add to
   cart, sold state (CTA to Tee Studio), wishlist, share, accordions, maker
   attribution, recently viewed, related products.

   Unlike the old static page, the browser-tab title/meta/OG tags and the Product
   JSON-LD are handled server-side by app/product/page.tsx's generateMetadata() +
   inline <script> — this component owns only the interactive detail view. */

const SIZES_FULL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const RECENT_KEY = 'ka_recent';
const RECENT_MAX = 6;

const CARE_COPY: Record<string, string> = {
  tees: 'Machine wash cold, inside out, with similar colours. Tumble dry low or line dry. Do not iron directly over the print — turn the garment inside out first, or use a pressing cloth. Do not dry clean.',
  sweatshirts:
    'Machine wash cold, inside out. Reshape and lay flat to dry for the best fit — tumble dry low if you need to. Do not iron the print directly. Do not dry clean.',
  accessories: 'Spot clean with a damp cloth. Do not machine wash, soak or tumble dry — this keeps the shape and the print sharp.',
};

function findCollection(slug: string | null) {
  return KA_COLLECTIONS.find((c) => c.slug === slug);
}
function findMaker(slug: string | null) {
  return KA_MAKERS.find((m) => m.slug === slug);
}

function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    } catch (e) {
      reject(e as Error);
    }
  });
}

function ShareButton({ product }: { product: Product }) {
  const { toast } = useToast();

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${product.name} — KHARIS & ALETHEIA`, text: product.blurb, url });
      } catch {
        /* user cancelled — not an error */
      }
      return;
    }
    try {
      await copyToClipboard(url);
      toast('Link copied', 'ok');
    } catch {
      toast('Could not copy — copy the link from the address bar', 'err');
    }
  }

  return (
    <button className="share-btn" type="button" aria-label="Share this piece" onClick={handleShare}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="18" cy="5" r="2.6" />
        <circle cx="6" cy="12" r="2.6" />
        <circle cx="18" cy="19" r="2.6" />
        <path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" />
      </svg>{' '}
      Share
    </button>
  );
}

function MakerLine({ maker }: { maker: Maker }) {
  return (
    <Link className="pd-maker" href={`/makers#${encodeURIComponent(maker.slug)}`}>
      <span className="pd-maker-label">Made by</span>
      <span className="pd-maker-name">{maker.name}</span>
      {maker.series ? <span className="pd-maker-series">· {maker.series}</span> : null}
    </Link>
  );
}

const NOT_FOUND_TITLE = 'THAT ONE’S NOT HERE';

function NotFound({ rawId }: { rawId: string | null }) {
  const intro = rawId
    ? `We couldn’t find a piece matching “${rawId}”.`
    : 'No piece was specified.';
  return (
    <section className="page-hero plain" style={{ minHeight: '52vh' }}>
      <div className="wrap">
        <p className="micro">404 · Piece not found</p>
        <GlitchHeading as="h1" text={NOT_FOUND_TITLE} />
        <p className="lede">
          {intro} It may have sold out and rotated off, or the link’s off a little.
        </p>
        <div className="notfound-actions">
          <Button variant="solid" href="/shop">
            Back to shop →
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ProductClient() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const product = useMemo(() => KA_CORE.findProduct(idParam || undefined), [idParam]);

  return product ? <ProductDetail product={product} /> : <NotFound rawId={idParam} />;
}

function ProductDetail({ product }: { product: Product }) {
  const { add } = useCart();
  const { toast } = useToast();
  const { open: openModal } = useModal();

  const sold = !!product.sold;
  const catLabel = KA_CAT_LABEL[product.cat] || product.cat;
  const col = findCollection(product.collection);
  const maker = findMaker(product.maker);
  const leadTime = KA_CONFIG.leadTime || '7–10 working days';
  const sizes = product.oneSize ? ['ONE SIZE'] : SIZES_FULL;

  const [view, setView] = useState<'full' | 'zoom-top' | 'zoom-detail'>('full');
  const [size, setSize] = useState(sizes[0]);
  const [qty, setQty] = useState(1);

  /* the old site reloaded the page for every product; here the route stays mounted
     when a related/recently-viewed link swaps ?id=, so reset per-product UI state
     whenever the product itself changes */
  useEffect(() => {
    setView('full');
    setSize(product.oneSize ? 'ONE SIZE' : SIZES_FULL[0]);
    setQty(1);
  }, [product.id, product.oneSize]);

  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      const stored: string[] = Array.isArray(raw) ? raw.filter((id: unknown): id is string => typeof id === 'string') : [];
      const withoutCurrent = stored.filter((id) => id !== product.id);
      setRecentIds(withoutCurrent);
      localStorage.setItem(RECENT_KEY, JSON.stringify([product.id, ...withoutCurrent].slice(0, RECENT_MAX)));
    } catch {
      /* storage unavailable — non-fatal, the strip just stays empty */
    }
  }, [product.id]);

  const recentProducts = useMemo(
    () => recentIds.map((id) => KA_CORE.findProduct(id)).filter((p): p is Product => !!p).slice(0, RECENT_MAX),
    [recentIds]
  );
  const relatedProducts = useMemo(
    () => KA_PRODUCTS.filter((x) => x.cat === product.cat && x.id !== product.id && !x.sold).slice(0, 4),
    [product.cat, product.id]
  );

  function openSizeGuide() {
    openModal(<SizeGuideModal product={product} />, { label: `Size guide — ${sizeGuideLabel(product)}` });
  }

  function handleAdd() {
    const q = Math.max(1, Math.min(20, qty));
    add(product.id, size, q);
    toast(`${product.name} added — ${size}${q > 1 ? ' ×' + q : ''}`, 'ok');
  }

  function onQtyInputChange(v: string) {
    let n = parseInt(v, 10);
    if (!Number.isFinite(n)) n = 1;
    setQty(Math.max(1, Math.min(20, n)));
  }

  return (
    <>
      <section className="page-hero" style={{ minHeight: '34vh' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          decoding="async"
          className="ph-img"
          src={`/${product.img}`}
          alt=""
          style={{ filter: 'blur(14px) brightness(.5)', transform: 'scale(1.15)' }}
        />
        <div className="ph-veil" />
        <div className="wrap">
          <p className="micro">Kharis &amp; Aletheia · {catLabel}</p>
          <GlitchHeading as="h1" text={product.name} />
        </div>
      </section>

      <div className="wrap">
        <div className="pd-layout">
          <div className="pd-gallery">
            <div className={cn('pd-main', view !== 'full' && view)} id="pdMain">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img decoding="async" src={`/${product.img}`} alt={product.name} />
            </div>
            {/* One photo per product — these are zoom crops of it, not separate shots. */}
            <div className="pd-thumbs">
              <button type="button" className={view === 'full' ? 'on' : ''} aria-label="Full view" onClick={() => setView('full')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img decoding="async" src={`/${product.img}`} alt="" />
              </button>
              <button
                type="button"
                className={cn('t-top', view === 'zoom-top' && 'on')}
                aria-label="Zoom in — top"
                onClick={() => setView('zoom-top')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img decoding="async" src={`/${product.img}`} alt="" />
              </button>
              <button
                type="button"
                className={cn('t-detail', view === 'zoom-detail' && 'on')}
                aria-label="Zoom in — print"
                onClick={() => setView('zoom-detail')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img decoding="async" src={`/${product.img}`} alt="" />
              </button>
            </div>
          </div>

          <div className="pd-info">
            <Link className="pd-back" href="/shop">
              ← Back to shop
            </Link>
            <h2 className="h-display glitch pd-title" data-text={product.name}>
              {product.name}
            </h2>

            {sold ? (
              <>
                <p className="sold-price">Sold — one of one</p>
                {maker ? <MakerLine maker={maker} /> : null}
                <p className="blurb">{product.blurb}</p>
                <p className="sold-copy">
                  This exact placement is gone — cut once, never repeated. Build your own version from scratch in the
                  Tee Studio.
                </p>
                <div className="pd-actions">
                  <Button variant="berry" href="/studio" style={{ flex: 1, justifyContent: 'center' }}>
                    Make your own →
                  </Button>
                  <WishButton id={product.id} />
                  <ShareButton product={product} />
                </div>
              </>
            ) : (
              <>
                <p className="pd-price-line">
                  <Money value={product.price} />
                </p>
                {maker ? <MakerLine maker={maker} /> : null}
                <p className="blurb">{product.blurb}</p>
                {product.oneSize ? (
                  <div className="pd-field">
                    <label>Size</label>
                    <p style={{ color: 'var(--muted)', fontSize: '.82rem' }}>One size fits most.</p>
                  </div>
                ) : (
                  <div className="pd-field">
                    <div className="pd-size-head">
                      <label id="pdSizeLabel">Size</label>
                      <button type="button" className="size-guide-link" onClick={openSizeGuide}>
                        Find my size
                      </button>
                    </div>
                    <div className="size-group" role="radiogroup" aria-labelledby="pdSizeLabel">
                      {sizes.map((s) => {
                        const sid = `pd-size-${s}`;
                        return (
                          <Fragment key={s}>
                            <input
                              type="radio"
                              name="pdSize"
                              id={sid}
                              value={s}
                              checked={size === s}
                              onChange={() => setSize(s)}
                            />
                            <label htmlFor={sid}>{s}</label>
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="pd-field">
                  <label htmlFor="pdQty">Quantity</label>
                  <div className="qty-stepper">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      id="pdQty"
                      min={1}
                      max={20}
                      value={qty}
                      inputMode="numeric"
                      onChange={(e) => onQtyInputChange(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty((q) => Math.min(20, q + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="pd-actions">
                  <button className="btn btn-solid" type="button" onClick={handleAdd}>
                    Add to cart
                  </button>
                  <WishButton id={product.id} />
                  <ShareButton product={product} />
                </div>
                <p className="lead-time-note">Made to order · ships in {leadTime}</p>
              </>
            )}
          </div>
        </div>

        <PdAccordion>
          <PdAccordionItem id="accDetails" title="Details" defaultOpen>
            <p>{product.details}</p>
          </PdAccordionItem>
          <PdAccordionItem id="accCare" title="Care">
            <p>{CARE_COPY[product.cat] || CARE_COPY.tees}</p>
          </PdAccordionItem>
          <PdAccordionItem id="accDelivery" title="Delivery & returns">
            <p>
              Cut and sewn after you order — production starts within 24 hours of purchase, and pieces ship in{' '}
              {leadTime}.
            </p>
            <p>
              Because each piece is made for you, we can’t accept change-of-mind returns once production has
              started. If it arrives faulty, damaged, or not as ordered, contact us within 14 days of delivery and
              we’ll remake it or refund it in full.
            </p>
            <p>
              Orders can be cancelled for a full refund within 24 hours of purchase, before the cloth is cut.{' '}
              <Link href="/policies">Read the full refund policy &amp; terms →</Link>
            </p>
          </PdAccordionItem>
          {col ? (
            <PdAccordionItem id="accPrint" title="The print">
              <p className="micro">{col.tag || 'Collection'}</p>
              <p>
                <b>{col.name}</b>
              </p>
              <p>{col.blurb || ''}</p>
            </PdAccordionItem>
          ) : null}
        </PdAccordion>

        {recentProducts.length > 0 && (
          <div className="recently-viewed">
            <p className="micro">Your recent pieces</p>
            <h2 className="h-display h-md">RECENTLY VIEWED</h2>
            <div className="rv-strip">
              {recentProducts.map((r) => (
                /* prefetch={false}: several of these share the /product pathname
                   (only ?id= differs) — concurrent prefetches race the client
                   Router's <title> resolution. See ShopGridCard.tsx. */
                <Link key={r.id} className="rv-card" href={`/product?id=${encodeURIComponent(r.id)}`} prefetch={false}>
                  <div className="prod-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img decoding="async" src={`/${r.img}`} alt={r.name} loading="lazy" />
                  </div>
                  <p className="prod-name">{r.name}</p>
                  <p className="prod-price">
                    <Money value={r.price} />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {relatedProducts.length > 0 && (
          <div className="related">
            <p className="micro">Keep looking</p>
            <h2 className="h-display h-md">MORE {catLabel.toUpperCase()}</h2>
            <div className="prod-grid">
              {relatedProducts.map((p) => (
                <RelatedCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
