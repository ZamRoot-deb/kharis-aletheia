'use client';

import Link from 'next/link';
import { useCart } from '@/app/providers';
import { KA_CAT_LABEL } from '@/lib/products';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Money } from './Money';
import { WishButton } from './WishButton';

interface ProductCardProps {
  product: Product;
  className?: string;
}

/** `.shop-card` product tile — ported from ../shop.js's cardHtml() (shop grid;
 *  reused for "related products" / lookbook shop-outs). Sold pieces show
 *  `.sold-tag`/`.sold-note` instead of an add-to-cart button, matching the old
 *  one-of-one behaviour exactly. */
export function ProductCard({ product, className }: ProductCardProps) {
  const { add } = useCart();
  const sold = !!product.sold;
  const catLabel = KA_CAT_LABEL[product.cat] || product.cat;
  /* prefetch={false}: a grid of these cards all shares the /product pathname
     (only ?id= differs) — concurrent prefetches across them race the client
     Router's <title> resolution (confirmed in testing: navigating to one
     product can end up with a DIFFERENT product's title). See
     app/shop/_components/ShopGridCard.tsx for the full writeup. */
  const href = `/product?id=${encodeURIComponent(product.id)}`;

  return (
    <div className={cn('shop-card', sold && 'sold', className)} data-card={product.id}>
      <div className="prod-img-wrap">
        <Link className="prod-img" href={href} prefetch={false}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/${product.img}`} alt={product.name} loading="lazy" decoding="async" />
        </Link>
        {sold && <span className="sold-tag">Sold</span>}
        <WishButton id={product.id} variant="wish-heart" />
      </div>
      {sold ? (
        <p className="sold-note">One of one · sold</p>
      ) : (
        <button
          className="btn btn-solid"
          type="button"
          onClick={() => add(product.id, product.oneSize ? 'ONE SIZE' : 'M', 1)}
        >
          Add to cart
        </button>
      )}
      <div className="prod-meta">
        <span className="cat-tag">{catLabel}</span>
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
