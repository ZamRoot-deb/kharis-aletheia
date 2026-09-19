'use client';

/* Homepage "signature line" + "custom prints" grids — ported from ../home.js's
   renderSignature()/renderCustomPrints(). Each reads straight from KA_PRODUCTS so
   the homepage can never drift from the shop catalog, matching the old comment on
   home.js verbatim. */

import { KA_PRODUCTS } from '@/lib/products';
import { Button } from '@/components/Button';
import { Reveal } from '@/components/Reveal';
import { ProdCard } from './ProdCard';
import { useSizePicker } from './useSizePicker';

export function SignatureGrid() {
  const openSizePicker = useSizePicker();
  const items = KA_PRODUCTS.filter((p) => p.cat === 'tees' && !p.sold).slice(0, 4);

  return (
    <Reveal className="collection">
      <div className="col-head">
        <div>
          <p className="micro">Signature</p>
          <h3>The Kente Stripe</h3>
          <p>The cut that started it all — banded, printed and sewn to order.</p>
        </div>
        <Button variant="gold" href="/shop#tees">
          View all →
        </Button>
      </div>
      <div className="prod-grid">
        {items.length ? (
          items.map((p) => <ProdCard key={p.id} product={p} onAdd={openSizePicker} />)
        ) : (
          <div className="empty-state">
            <p className="es-title">Nothing here yet</p>
            <p className="es-copy">The signature line is being re-cut — check back shortly.</p>
          </div>
        )}
      </div>
    </Reveal>
  );
}

export function CustomPrintsGrid() {
  const items = KA_PRODUCTS.filter((p) => p.collection === 'custom-prints' && p.sold);

  return (
    <Reveal className="collection">
      <div className="col-head">
        <div>
          <p className="micro">One of one</p>
          <h3>Custom Prints</h3>
          <p>Pieces placed and cut by people like you. When it&rsquo;s gone, it&rsquo;s gone.</p>
        </div>
        <Button variant="gold" href="/shop?collection=custom-prints">
          View all →
        </Button>
      </div>
      <div className="prod-grid">
        {items.length ? (
          items.map((p) => <ProdCard key={p.id} product={p} />)
        ) : (
          <div className="empty-state">
            <p className="es-title">Nothing here yet</p>
            <p className="es-copy">No archived custom cuts yet — the first one-of-ones drop soon.</p>
          </div>
        )}
      </div>
    </Reveal>
  );
}
