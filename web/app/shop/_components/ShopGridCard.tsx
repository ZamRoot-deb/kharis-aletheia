'use client';

import Link from 'next/link';
import { useCart, useModal, useToast } from '@/app/providers';
import { KA_CAT_LABEL } from '@/lib/products';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Money } from '@/components/Money';
import { WishButton } from '@/components/WishButton';
import { QuickAddModal } from './QuickAddModal';

/* KHARIS & ALETHEIA — shop grid tile. Ported from ../shop.js's cardHtml() +
   wireCardEvents(). Deliberately NOT the shared <ProductCard/> (components/ProductCard.tsx):
   that component always adds a default size straight to the cart, whereas the old
   shop grid opens the quick-add size picker for anything that isn't one-size —
   this card reproduces that behaviour exactly, reusing the shared WishButton/Money
   atoms + the QuickAddModal above instead of duplicating their logic. */
export function ShopGridCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { open: openModal } = useModal();
  const { toast } = useToast();
  const sold = !!product.sold;
  const catLabel = KA_CAT_LABEL[product.cat] || product.cat;
  /* prefetch={false}: a grid of 12 cards all pointing at the SAME pathname
     (/product) with only the ?id= differing means Next.js would fire a dozen
     concurrent prefetches sharing that route template — confirmed in testing
     to race the client Router's metadata (document.title) resolution, so a
     click can land on the right page with a WRONG, other-product's <title>.
     Disabling prefetch avoids the race; the click-through nav is unaffected,
     it's just not pre-warmed. Integrator fix, see RelatedCard/ProdCard too. */
  const href = `/product?id=${encodeURIComponent(product.id)}`;

  function handleAdd() {
    if (product.oneSize) {
      add(product.id, 'ONE SIZE', 1);
      toast(`${product.name} added to cart`, 'ok');
    } else {
      openModal(<QuickAddModal product={product} />, { label: `Choose your size — ${product.name}` });
    }
  }

  return (
    <div className={cn('shop-card', sold && 'sold')} data-card={product.id}>
      <div className="prod-img-wrap">
        <Link className="prod-img" href={href} prefetch={false}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img decoding="async" src={`/${product.img}`} alt={product.name} loading="lazy" />
        </Link>
        {sold && <span className="sold-tag">Sold</span>}
        <WishButton id={product.id} variant="wish-heart" />
      </div>
      {sold ? (
        <p className="sold-note">One of one · sold</p>
      ) : (
        <button className="btn btn-solid" type="button" onClick={handleAdd}>
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
