'use client';

import { Fragment, useId, useState } from 'react';
import { useCart, useModal, useToast } from '@/app/providers';
import type { Product } from '@/lib/types';

/* KHARIS & ALETHEIA — quick-add size picker, rendered inside useModal(). Ported
   from ../shop.js's openSizePicker(p) / ../product.js's openSizePicker(p, onAdded)
   (the two were byte-for-byte identical in the old site). Shared by the shop grid
   card and the product page's related-products cards. */

const SIZES_FULL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export function QuickAddModal({ product }: { product: Product }) {
  const { add } = useCart();
  const { close } = useModal();
  const { toast } = useToast();
  const [size, setSize] = useState(SIZES_FULL[0]);
  const groupId = useId();

  return (
    <div className="ka-modal-quickadd">
      <p className="micro">{product.name}</p>
      <h2 className="h-display h-md">Choose your size</h2>
      <div className="size-group" role="radiogroup" aria-label="Size">
        {SIZES_FULL.map((s) => {
          const id = `${groupId}-${s}`;
          return (
            <Fragment key={s}>
              <input
                type="radio"
                name={`qaSize-${groupId}`}
                id={id}
                value={s}
                checked={size === s}
                onChange={() => setSize(s)}
              />
              <label htmlFor={id}>{s}</label>
            </Fragment>
          );
        })}
      </div>
      <button
        className="btn btn-solid"
        type="button"
        onClick={() => {
          add(product.id, size, 1);
          close();
          toast(`${product.name} added — ${size}`, 'ok');
        }}
      >
        Add to cart
      </button>
    </div>
  );
}
