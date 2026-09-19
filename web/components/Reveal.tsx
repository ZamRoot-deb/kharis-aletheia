'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** matches the old `.reveal.d1/.d2/.d3` staggered-delay modifiers */
  delay?: 1 | 2 | 3;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- polymorphic `as` tag; see
   CONTRACT-NEXT.md "TypeScript is LOOSE". */

/** `.reveal` fade/slide-in-on-scroll wrapper — ported from ../app.js's
 *  IntersectionObserver block. Starts NOT revealed on both server and first client
 *  render (no window/IO access during render, per the HYDRATION rule); the observer
 *  is created in an effect after mount. `prefers-reduced-motion` is honoured twice,
 *  belt-and-braces like the original: here (skip straight to revealed) AND in
 *  globals.css's `@media (prefers-reduced-motion: reduce) { .reveal{opacity:1!…} }`,
 *  so a no-JS or JS-still-loading view is never stuck invisible for those users. */
export function Reveal({ children, as, className, delay }: RevealProps) {
  const Tag: any = as || 'div';
  const ref = useRef<HTMLDivElement>(null);
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
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={cn('reveal', delay && `d${delay}`, inView && 'in', className)}>
      {children}
    </Tag>
  );
}
