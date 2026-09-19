'use client';

/* Homepage makers teaser grid — ported from ../home.js's renderMakers()/
   makerTeaserCard(). */

import Link from 'next/link';
import { KA_MAKERS } from '@/lib/products';
import { Reveal } from '@/components/Reveal';
import { NotifyForm } from './NotifyForm';

export function MakersTeaser() {
  if (!KA_MAKERS.length) {
    return (
      <div className="maker-grid">
        <div className="empty-state">
          <p className="es-title">Nothing here yet</p>
          <p className="es-copy">Maker profiles are being written up — check back shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="maker-grid">
      {KA_MAKERS.map((m, idx) => {
        const isLive = m.status === 'live';
        return (
          <Reveal as="article" key={m.slug} className="maker-card" delay={((idx % 3) + 1) as 1 | 2 | 3}>
            {isLive ? <span className="badge live">Now live</span> : <span className="badge">Upcoming</span>}
            <h3>
              <Link href={`/makers#${m.slug}`}>{m.name}</Link>
            </h3>
            <p className="sub">{m.series}</p>
            <p>{m.bio}</p>
            {isLive ? (
              <Link className="link-arrow" href={`/makers#${m.slug}`}>
                Shop the series →
              </Link>
            ) : (
              <NotifyForm maker={m.slug} />
            )}
          </Reveal>
        );
      })}
    </div>
  );
}
