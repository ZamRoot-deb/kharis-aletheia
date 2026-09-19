'use client';

import { useWishlist } from '@/app/providers';
import { cn } from '@/lib/cn';

interface WishButtonProps {
  id: string;
  /** `.wish-btn` (default — product page / inline actions row) or `.wish-heart`
   *  (shop grid overlay, ../shop.css) — both read the toggled/active state via the
   *  `.on`/`.active` modifier each stylesheet expects. */
  variant?: 'wish-btn' | 'wish-heart';
  size?: number;
  className?: string;
}

/** Heart toggle for the wishlist — ported from ../shop.js's heartSvg()/wish-heart
 *  markup (shop grid, product page). Real `<button>`, aria-pressed + aria-label
 *  swap with state, `svg` fill flips solid on `.on`/`.active` exactly like the old
 *  CSS (`.wish-btn.on svg{fill:currentColor}` / `.wish-heart.active svg` via the
 *  variant's own class). */
export function WishButton({ id, variant = 'wish-btn', size = 15, className }: WishButtonProps) {
  const { has, toggle } = useWishlist();
  const active = has(id);
  const stateClass = variant === 'wish-heart' ? 'active' : 'on';

  return (
    <button
      type="button"
      className={cn(variant, active && stateClass, className)}
      aria-pressed={active}
      aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
      onClick={() => toggle(id)}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
        <path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4.5c2 0 3.6 1.1 4.4 2.7.8-1.6 2.4-2.7 4.4-2.7C18 4.5 19.6 8 22 11.7 19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
