'use client';

/* Same IntersectionObserver "scroll reveal" behaviour as components/Reveal.tsx, as a
   bare hook instead of a wrapper element. Needed anywhere a `.reveal` element must
   also carry its own `id` (lookbook cards' `#look-N`, maker sections' `#slug`) —
   Reveal doesn't forward arbitrary props like `id`, so those elements apply the
   fade-in classes directly instead of going through <Reveal>. Ported from
   ../lookbook.js / ../makers.js's local observeReveal(), which — like Reveal.tsx —
   is belt-and-braces on top of the `prefers-reduced-motion` CSS rule in globals.css. */

import { useEffect, useRef, useState } from 'react';

export function useInView<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}
