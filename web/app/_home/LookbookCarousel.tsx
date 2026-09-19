'use client';

/* Homepage lookbook carousel — ported from ../index.html's #lookbook markup +
   ../app.js's "LOOKBOOK CAROUSEL" block (2-up desktop / 1-up mobile, dot nav,
   prev/next, touch swipe). Slide content now comes from KA_LOOKS instead of the
   old hardcoded 8 <div class="car-slide">s; the per-slide alt text the old markup
   hand-wrote (richer than KA_LOOKS' `caption`) is preserved verbatim below since
   that copy isn't stored anywhere in the shared catalog. */

import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import Link from 'next/link';
import { KA_LOOKS } from '@/lib/products';
import { Reveal } from '@/components/Reveal';

const SLIDE_ALT: Record<string, string> = {
  'look-1': 'Look 01 — signature kente stripe tee',
  'look-2': 'Look 02 — midnight ankara panel tee',
  'look-3': 'Look 03 — berry adinkra crewneck',
  'look-4': 'Look 04 — midnight ankara hoodie',
  'look-5': 'Look 05 — berry crest tee',
  'look-6': 'Look 06 — cream kente sleeve crew',
  'look-7': 'Look 07 — olive kente pocket tee',
  'look-8': 'Look 08 — adinkra all-over tee',
};

export function LookbookCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [dotCount, setDotCount] = useState(0);
  const startXRef = useRef<number | null>(null);
  /* Mirrors `index` for the resize handler below — the old vanilla version reads a
     plain closure variable that's always current; a React effect's closure isn't,
     so the resize listener reads this ref instead of the (potentially stale)
     `index` state to re-centre on the slide the visitor is actually on. */
  const indexRef = useRef(0);

  const perView = useCallback(() => (typeof window !== 'undefined' && window.innerWidth <= 820 ? 1 : 2), []);
  const maxIndex = useCallback(() => Math.max(0, KA_LOOKS.length - perView()), [perView]);

  const goTo = useCallback(
    (idx: number) => {
      const track = trackRef.current;
      if (!track) return;
      const slides = Array.from(track.children) as HTMLElement[];
      if (!slides.length) return;
      const clamped = Math.max(0, Math.min(idx, maxIndex()));
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      const w = slides[0].getBoundingClientRect().width + gap;
      track.style.transform = `translateX(${-clamped * w}px)`;
      indexRef.current = clamped;
      setIndex(clamped);
    },
    [maxIndex]
  );

  useEffect(() => {
    setDotCount(maxIndex() + 1);
    goTo(0);
    const onResize = () => {
      setDotCount(maxIndex() + 1);
      goTo(indexRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [goTo, maxIndex]);

  const goPrev = () => goTo(index <= 0 ? maxIndex() : index - 1);
  const goNext = () => goTo(index >= maxIndex() ? 0 : index + 1);

  const onTouchStart = (e: TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (startXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - startXRef.current;
    if (Math.abs(dx) > 40) (dx < 0 ? goNext : goPrev)();
    startXRef.current = null;
  };

  return (
    <Reveal className="carousel">
      <div className="car-view">
        <div className="car-track" ref={trackRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {KA_LOOKS.map((look) => (
            <div className="car-slide" key={look.id}>
              <Link href={`/lookbook#${look.id}`} aria-label={`View ${look.caption}, in the lookbook`}>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/${look.img}`}
                    width={1024}
                    height={1536}
                    alt={SLIDE_ALT[look.id] || look.caption}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>{look.caption}</figcaption>
                </figure>
              </Link>
            </div>
          ))}
        </div>
      </div>
      <button className="car-nav prev" type="button" aria-label="Previous looks" onClick={goPrev}>
        ‹
      </button>
      <button className="car-nav next" type="button" aria-label="Next looks" onClick={goNext}>
        ›
      </button>
      <div className="car-dots" role="group" aria-label="Jump to slide">
        {Array.from({ length: dotCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={i === index ? 'on' : undefined}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === index || undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </Reveal>
  );
}
