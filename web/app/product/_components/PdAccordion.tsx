'use client';

import { useRef, useState, type ReactNode } from 'react';

/* KHARIS & ALETHEIA — product-page info accordions (Details/Care/Delivery/The
   print). Ported from ../product.js's accordionItem()/wireAccordions(): a custom
   button+aria-expanded/hidden widget (NOT the shared <Accordion/> component, which
   renders native <details> styled by globals.css's generic `.accordion` class —
   this page's `.pd-accordion`/`.acc-item`/`.acc-trigger`/`.acc-panel` classes are a
   bespoke, differently-styled system ported from ../product.css specifically for
   this widget, so the shared component's markup wouldn't pick up this page's CSS).
   Each item keeps its own open/closed state; the container handles Up/Down/Home/End
   focus movement between triggers exactly like the old wireAccordions(). */

export function PdAccordion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const container = ref.current;
    if (!container) return;
    const triggers = Array.from(container.querySelectorAll<HTMLButtonElement>('.acc-trigger'));
    const i = triggers.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (triggers[i + 1] || triggers[0]).focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (triggers[i - 1] || triggers[triggers.length - 1]).focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      triggers[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      triggers[triggers.length - 1].focus();
    }
  }

  return (
    <div className="pd-accordion" id="pdAccordion" ref={ref} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

export function PdAccordionItem({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="acc-item">
      <button
        type="button"
        className="acc-trigger"
        id={`${id}Btn`}
        aria-expanded={open}
        aria-controls={`${id}Panel`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{title}</span>
        <span className="acc-icon" aria-hidden="true" />
      </button>
      <div className="acc-panel" id={`${id}Panel`} role="region" aria-labelledby={`${id}Btn`} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
