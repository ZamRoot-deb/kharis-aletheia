'use client';

/* Mobile "Scroll" hint pill — ported from ../index.html's #scrollPill +
   ../app.js's "MOBILE SCROLL PILL" block. Only ever rendered on the homepage. */

import { useEffect, useState } from 'react';

export function ScrollPill() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const onScroll = () => setGone(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <div className={`scroll-pill${gone ? ' gone' : ''}`}>Scroll</div>;
}
