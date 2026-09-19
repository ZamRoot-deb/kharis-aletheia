'use client';

import Link from 'next/link';
import { useCart, useModal, useToast } from '@/app/providers';
import type { Product } from '@/lib/types';
import { Money } from '@/components/Money';
import { WishButton } from '@/components/WishButton';
import { QuickAddModal } from '@/app/shop/_components/QuickAddModal';

/* KHARIS & ALETHEIA — "related products" / "recently viewed" mini card. Ported
   from ../product.js's relatedCardHtml()/wireRelatedEvents() — `.prod-card` (base.css),
   a different, smaller tile than the shop grid's `.shop-card`, but the same
   quick-add-modal behaviour, so it reuses the shop builder's QuickAddModal rather
   than re-implementing it. */
export function RelatedCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { open: openModal } = useModal();
  const { toast } = useToast();
  /* prefetch={false}: many related-product cards share the /product pathname
     (only ?id= differs) — concurrent prefetches across them race the client
     Router's <title> resolution (confirmed in testing: navigating to one
     product can end up with a DIFFERENT product's title). See ShopGridCard. */
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
    <div className="prod-card" data-card={product.id}>
      <div className="prod-img-wrap">
        <Link className="prod-img" href={href} prefetch={false}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img decoding="async" src={`/${product.img}`} alt={product.name} loading="lazy" />
        </Link>
        <WishButton id={product.id} variant="wish-heart" />
      </div>
      <button className="btn btn-solid" type="button" onClick={handleAdd}>
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
