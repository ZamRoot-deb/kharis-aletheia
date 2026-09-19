'use client';

/* Lookbook editorial grid — ported from ../lookbook.html's #lbGrid + ../lookbook.js.
   8 looks (from KA_LOOKS) interleaved with 3 street shots, each look card carrying a
   "shop this look" panel (from KA_PRODUCTS via each look's productIds) and a
   lightbox opened through the shared useModal(). */

import Link from 'next/link';
import { useCallback, useEffect, type ReactNode } from 'react';
import { useCart, useModal, useToast } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_LOOKS } from '@/lib/products';
import { Money } from '@/components/Money';
import type { Look, Product } from '@/lib/types';
import { useInView } from '@/app/_home/useInView';
import { useSizePicker } from '@/app/_home/useSizePicker';

/* Street photography isn't part of the shoppable-look catalog (no product tie-ins),
   so it isn't in KA_LOOKS — these three are laid in for editorial rhythm, reusing
   the same shots as the homepage's "On the streets" strip, exactly like the old
   lookbook.js's own hardcoded STREET_SHOTS. */
const STREET_SHOTS = [
  { img: 'assets/img/street-1.webp', caption: 'Accra — dusk' },
  { img: 'assets/img/street-2.webp', caption: 'Ankara panel — detail' },
  { img: 'assets/img/street-3.webp', caption: 'Night shift — two of a kind' },
];

/* KA_LOOKS' title ("Look 01") and caption ("Look 01 — Kente stripe") both repeat the
   "Look NN" number — strip it from the caption so the heading reads as the
   description alone, with the number carried once by .lb-num. */
function describe(look: Look): string {
  const stripped = String(look.caption || '').replace(/^Look\s*\d+\s*[—-]\s*/i, '');
  return stripped || look.caption || look.title;
}

function ShopList({ look, onAdd }: { look: Look; onAdd: (p: Product) => void }) {
  const products = (look.productIds || []).map((id) => KA_CORE.findProduct(id)).filter((p): p is Product => !!p);
  if (!products.length) {
    return <p className="lb-shop-empty">Pieces from this look are being catalogued.</p>;
  }
  return (
    <ul className="lb-shop-list">
      {products.map((p) => {
        /* prefetch={false}: several look cards share the /product pathname
           (only ?id= differs) — concurrent prefetches race the client
           Router's <title> resolution. See ShopGridCard.tsx. */
        const href = `/product?id=${encodeURIComponent(p.id)}`;
        return (
          <li key={p.id}>
            <Link className="lb-shop-thumb" href={href} tabIndex={-1} prefetch={false}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/${p.img}`} alt="" loading="lazy" decoding="async" />
            </Link>
            <div className="lb-shop-meta">
              <Link href={href} prefetch={false}>{p.name}</Link>
              <span>
                <Money value={p.price} />
              </span>
            </div>
            {p.sold ? (
              <span className="lb-shop-sold">Sold</span>
            ) : (
              <button
                type="button"
                className="lb-shop-add"
                aria-label={`Add ${p.name} to cart`}
                onClick={() => onAdd(p)}
              >
                +
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LookCard({
  look,
  idx,
  sizeClass,
  onOpenLightbox,
  onAdd,
}: {
  look: Look;
  idx: number;
  sizeClass: 'large' | 'small';
  onOpenLightbox: (look: Look) => void;
  onAdd: (p: Product) => void;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const num = String(idx + 1).padStart(2, '0');
  const desc = describe(look);

  return (
    <article
      ref={ref}
      id={look.id}
      className={`lb-card ${sizeClass} reveal d${(idx % 3) + 1}${inView ? ' in' : ''}`}
    >
      <button
        type="button"
        className="lb-photo"
        aria-label={`View Look ${num} — ${desc}, full size`}
        onClick={() => onOpenLightbox(look)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/${look.img}`} alt={`${look.title} — ${desc}`} loading="lazy" decoding="async" />
      </button>
      <div className="lb-info">
        <p className="lb-num">LOOK {num}</p>
        <h3>{desc}</h3>
        <div className="lb-shop">
          <p className="lb-shop-label">Shop this look</p>
          <ShopList look={look} onAdd={onAdd} />
        </div>
      </div>
    </article>
  );
}

function StreetCard({ shot }: { shot: (typeof STREET_SHOTS)[number] }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`lb-card small lb-street reveal${inView ? ' in' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/${shot.img}`} alt={shot.caption} loading="lazy" decoding="async" />
      <span>{shot.caption}</span>
    </div>
  );
}

export function LookbookGrid() {
  const { add } = useCart();
  const { toast } = useToast();
  const { open: openModal } = useModal();
  const openSizePicker = useSizePicker();

  const handleAdd = useCallback(
    (p: Product) => {
      if (p.oneSize) {
        add(p.id, 'ONE SIZE', 1);
        toast(`${p.name} added to cart`, 'ok');
      } else {
        openSizePicker(p);
      }
    },
    [add, toast, openSizePicker]
  );

  const openLightbox = useCallback(
    (look: Look) => {
      const desc = describe(look);
      openModal(
        <figure className="lb-lightbox">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/${look.img}`} alt={`${look.title} — ${desc}`} />
          <figcaption>
            {look.title} — {desc}
          </figcaption>
        </figure>,
        { label: look.title }
      );
    },
    [openModal]
  );

  /* Deep link (#look-N) from the homepage carousel / nav — the grid isn't rendered
     until after mount, so finish the hash jump the browser couldn't on load. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, []);

  if (!KA_LOOKS.length) {
    return (
      <div className="lb-grid" aria-label="Lookbook — looks and street shots">
        <div className="empty-state">
          <p className="es-title">Nothing here yet</p>
          <p className="es-copy">The lookbook is being shot — check back shortly.</p>
        </div>
      </div>
    );
  }

  const cards: ReactNode[] = [];
  let streetIdx = 0;
  KA_LOOKS.forEach((look, i) => {
    cards.push(
      <LookCard
        key={look.id}
        look={look}
        idx={i}
        sizeClass={i % 4 === 0 ? 'large' : 'small'}
        onOpenLightbox={openLightbox}
        onAdd={handleAdd}
      />
    );
    if ((i === 2 || i === 5) && streetIdx < STREET_SHOTS.length) {
      cards.push(<StreetCard key={`street-${streetIdx}`} shot={STREET_SHOTS[streetIdx++]} />);
    }
  });
  while (streetIdx < STREET_SHOTS.length) {
    cards.push(<StreetCard key={`street-${streetIdx}`} shot={STREET_SHOTS[streetIdx++]} />);
  }

  return (
    <div className="lb-grid" aria-label="Lookbook — looks and street shots">
      {cards}
    </div>
  );
}
