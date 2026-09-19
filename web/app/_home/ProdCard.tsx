'use client';

/* `.prod-card` product tile — ported from ../home.js's productCard()/soldCard() and
   reused identically by ../makers.js's pieceCard(). NOT the same component as
   components/ProductCard.tsx (`.shop-card`, owned by the catalog lane, used on
   /shop and /product) — the old site used two different card markups/behaviours
   on purpose (this one's "Add to cart" opens the size-picker modal instead of
   quick-adding a default size), so this port keeps that distinction. */

import Link from 'next/link';
import { Money } from '@/components/Money';
import type { Product } from '@/lib/types';

export function ProdCard({ product, onAdd }: { product: Product; onAdd?: (p: Product) => void }) {
  /* prefetch={false}: home/makers render several of these cards, all sharing
     the /product pathname (only ?id= differs) — concurrent prefetches across
     them race the client Router's <title> resolution (confirmed in testing:
     navigating to one product can end up with a DIFFERENT product's title).
     See app/shop/_components/ShopGridCard.tsx for the full writeup. */
  const href = `/product?id=${encodeURIComponent(product.id)}`;

  if (product.sold) {
    return (
      <div className="prod-card sold">
        <Link className="prod-img" href={href} prefetch={false} aria-label={`${product.name} — sold, view this piece`}>
          <span className="sold-tag">Sold</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/${product.img}`} alt={product.name} loading="lazy" decoding="async" />
        </Link>
        <span className="btn btn-solid">Sold out</span>
        <div className="prod-meta">
          <Link href={href} prefetch={false}>
            <p className="prod-name">{product.name}</p>
          </Link>
          <p className="prod-price">
            <Money value={product.price} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="prod-card">
      <Link className="prod-img" href={href} prefetch={false}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/${product.img}`} alt={product.name} loading="lazy" decoding="async" />
      </Link>
      <button type="button" className="btn btn-solid" onClick={() => onAdd?.(product)}>
        Add to cart
      </button>
      <div className="prod-meta">
        <Link href={href} prefetch={false}>
          <p className="prod-name">{product.name}</p>
        </Link>
        <p className="prod-price">
          <Money value={product.price} />
        </p>
      </div>
    </div>
  );
}
