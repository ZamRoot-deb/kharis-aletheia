'use client';

/* /makers — one full profile section per KA_MAKERS entry. Ported from
   ../makers.html's #makersRoot + ../makers.js's section(). */

import { useEffect } from 'react';
import { Button } from '@/components/Button';
import { KA_MAKERS, KA_PRODUCTS } from '@/lib/products';
import { KA_PRINTS } from '@/lib/prints';
import type { Maker, PrintEntry, Product } from '@/lib/types';
import { useInView } from '@/app/_home/useInView';
import { useSizePicker } from '@/app/_home/useSizePicker';
import { ProdCard } from '@/app/_home/ProdCard';
import { NotifyForm } from '@/app/_home/NotifyForm';

function SwatchTile({ pr }: { pr: PrintEntry }) {
  const svg = KA_PRINTS.tileSvg(pr.def, { size: 96 });
  const label = pr.meaning ? `${pr.name} — ${pr.meaning}` : pr.name;
  return (
    <a
      className="swatch-tile"
      href={`/studio#print=${encodeURIComponent(pr.id)}`}
      title={label}
      aria-label={`Design with ${pr.name} in the Tee Studio`}
      // eslint-disable-next-line react/no-danger -- KA_PRINTS.tileSvg() is our own
      // deterministic, sanitised SVG generator (lib/prints.ts) — no user input reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function MakerSection({
  maker,
  idx,
  onAdd,
}: {
  maker: Maker;
  idx: number;
  onAdd: (p: Product) => void;
}) {
  const { ref, inView } = useInView<HTMLElement>(0.1);
  const isLive = maker.status === 'live';
  const prints = KA_PRINTS.list().filter((pr) => pr.maker === maker.slug);
  const pieces = KA_PRODUCTS.filter((p) => p.maker === maker.slug);

  return (
    <section
      ref={ref}
      id={maker.slug}
      className={`maker-profile reveal${idx % 2 ? ' alt' : ''}${inView ? ' in' : ''}`}
    >
      <div className="wrap">
        <div className="mp-head">
          {isLive ? <span className="badge live">Now live</span> : <span className="badge">Upcoming</span>}
          <h2>{maker.name}</h2>
          <span className="mp-series">{maker.series}</span>
          <span className="mp-city">{maker.city}</span>
        </div>
        <p className="mp-bio">{maker.long}</p>

        {!isLive && (
          <div className="mp-notify">
            <NotifyForm maker={maker.slug} />
          </div>
        )}

        <p className="mp-section-label">The prints</p>
        {prints.length ? (
          <div className="swatch-strip">
            {prints.map((pr) => (
              <SwatchTile key={pr.id} pr={pr} />
            ))}
          </div>
        ) : (
          <p className="mp-empty">No published prints from {maker.name} yet.</p>
        )}

        <p className="mp-section-label">The pieces</p>
        {pieces.length ? (
          <div className="prod-grid">
            {pieces.map((p) => (
              <ProdCard key={p.id} product={p} onAdd={onAdd} />
            ))}
          </div>
        ) : (
          <p className="mp-empty">No pieces from this series yet — check back after the drop.</p>
        )}

        {isLive && (
          <div className="mp-cta">
            <Button variant="gold" href={`/shop?collection=${encodeURIComponent(maker.collection)}`}>
              Shop the {maker.series} series →
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function MakerSections() {
  const openSizePicker = useSizePicker();

  /* Deep link (#slug) from the homepage teaser / nav — content isn't in the DOM
     until after mount. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, []);

  if (!KA_MAKERS.length) {
    return (
      <div className="wrap">
        <div className="empty-state">
          <p className="es-title">Nothing here yet</p>
          <p className="es-copy">Maker profiles are being written up — check back shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {KA_MAKERS.map((m, idx) => (
        <MakerSection key={m.slug} maker={m} idx={idx} onAdd={openSizePicker} />
      ))}
    </>
  );
}
