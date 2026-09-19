import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AccordionProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Defaults to the generic `.accordion` primitive (globals.css "SHARED
   *  PRIMITIVES"). Pass 'form-faq-item' (forms builder) to match the bulk/gift/
   *  contact FAQ look, or 'faq-item' (studio/lab builders) for that bordered-card
   *  FAQ look — see app/styles/forms.css's header comment for why those two are
   *  separate classes. */
  className?: string;
  bodyClassName?: string;
}

/** Native `<details>/<summary>` styled as `.accordion` — ported from globals.css's
 *  shared-primitives `.accordion` rule (product info, size guide, FAQs). Real,
 *  natively keyboard-operable disclosure widget; no JS state needed for the open/
 *  closed toggle itself. */
export function Accordion({
  summary,
  children,
  defaultOpen = false,
  className = 'accordion',
  bodyClassName = 'accordion-body',
}: AccordionProps) {
  return (
    <details className={cn(className)} open={defaultOpen}>
      <summary>{summary}</summary>
      <div className={cn(bodyClassName)}>{children}</div>
    </details>
  );
}
