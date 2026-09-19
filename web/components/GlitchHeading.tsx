import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface GlitchHeadingProps {
  text: string;
  as?: ElementType;
  className?: string;
  /** false renders the static chromatic-fringe `.glitch` only (no periodic slice
   *  animation) — used sparingly in the old site; default true (`.glitch-anim`)
   *  matches every real heading usage (hero title, page-hero h1). */
  animate?: boolean;
  children?: ReactNode;
}

/** `.h-display .glitch[.glitch-anim]` heading with `data-text` for the chromatic-
 *  fringe effect — ported from every `<h1 class="h-display glitch glitch-anim"
 *  data-text="…">` in the old html. Both themes/`prefers-reduced-motion` are handled
 *  entirely by the ported CSS (globals.css). */
export function GlitchHeading({ text, as, className, animate = true, children }: GlitchHeadingProps) {
  const Tag: any = as || 'h1';
  return (
    <Tag className={cn('h-display', 'glitch', animate && 'glitch-anim', className)} data-text={text}>
      {children ?? text}
    </Tag>
  );
}
