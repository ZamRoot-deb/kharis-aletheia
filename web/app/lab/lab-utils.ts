/* KHARIS & ALETHEIA — PRINT LAB pure helpers (ported verbatim from ../lab.js's
   "small helpers" section). DOM-free except prefersReducedMotion(), which is only
   ever called from a client effect/handler, never during render. */
import { KA_PRINTS } from '@/lib/prints';
import { KA_MAKERS } from '@/lib/products';
import type { PrintSymbol } from '@/lib/types';

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export function randSeed(): string {
  return String(Math.floor(Math.random() * 1e9));
}

export function clampZoom(v: number): number {
  return isNaN(v) ? 1 : Math.max(0.5, Math.min(3, v));
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function slugify(s: string): string {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'print'
  );
}

export function normalizeHex(hex: string): string {
  const h = typeof hex === 'string' ? hex.trim() : '';
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return '#000000';
}

/** Fisher-Yates — mutates and returns the same array, matching the original. */
export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function makerName(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const found = KA_MAKERS.find((m) => m.slug === slug);
  return found ? found.name : null;
}

export function findSymbol(id: string): PrintSymbol | null {
  const list = KA_PRINTS.symbols() || [];
  return list.find((s) => s.id === id) || null;
}
