/* KHARIS & ALETHEIA — shared DOM helpers for overlays (cart drawer / modal / mobile
   menu). Ported from ../app.js's kaScrollLock / kaFocusables / kaTrapTab closures.
   Plain functions (not components) so every overlay owner reuses one implementation
   instead of re-deriving ref-counted scroll lock / focus-trap logic. Every function
   here is only ever called from an effect or an event handler — never during render —
   so the `typeof document === "undefined"` guards are just defence-in-depth, not load
   bearing for the hydration rules. */

let lockCount = 0;
let prevOverflow = '';

/** Ref-counted body scroll lock shared by the cart drawer, modal and mobile menu —
 *  so nesting (e.g. opening the size-guide modal from inside the cart) doesn't
 *  unlock scrolling early when the inner overlay closes first. */
export function lockScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = prevOverflow;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/** Call from a `keydown` handler on Tab to keep focus inside `container` (a drawer /
 *  modal panel). Mirrors ../app.js's kaTrapTab exactly. */
export function trapTabKey(container: HTMLElement, e: KeyboardEvent): void {
  const list = getFocusables(container);
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
