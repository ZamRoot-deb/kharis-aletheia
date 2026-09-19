'use client';

/* Shared "choose a size" quick-pick modal — ported verbatim (markup + behaviour)
   from ../home.js / ../lookbook.js / ../makers.js's openSizePicker(product), which
   the old site copy-pasted identically into all three files. Kept as one hook here
   since all three new routes (home/lookbook/makers) are built by the same lane. */

import { useCallback } from 'react';
import { useCart, useModal, useToast } from '@/app/providers';
import { Money } from '@/components/Money';
import type { Product } from '@/lib/types';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

/** Returns `openSizePicker(product)` — opens the qp modal, wires each size button to
 *  add-to-cart + close + toast, exactly like the old site's shared function. */
export function useSizePicker() {
  const { add } = useCart();
  const { open, close } = useModal();
  const { toast } = useToast();

  return useCallback(
    (product: Product | null | undefined) => {
      if (!product) return;
      const sizes = product.oneSize ? ['ONE SIZE'] : SIZES;
      const pick = (size: string) => {
        add(product.id, size, 1);
        close();
        toast(`${product.name} added to cart — size ${size}`, 'ok');
      };
      open(
        <div className="qp">
          <p className="qp-eyebrow micro">Choose a size</p>
          <h3 className="qp-title">{product.name}</h3>
          <p className="qp-price">
            <Money value={product.price} />
          </p>
          <div className="qp-sizes" role="group" aria-label="Available sizes">
            {sizes.map((s) => (
              <button key={s} type="button" className="qp-size" onClick={() => pick(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>,
        { label: `Choose a size — ${product.name}` }
      );
    },
    [add, open, close, toast]
  );
}
