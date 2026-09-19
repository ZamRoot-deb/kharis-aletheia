/* KHARIS & ALETHEIA — Tee Studio design state: defaults, sanitisation,
   localStorage (`ka_studio`) + URL-hash persistence.
   Ported from ../studio.js section 2 ("STATE"). `defaultDesign`/`defaultState`
   are pure (config + built-in prints only — no localStorage/Math.random/Date),
   so they're safe to use as a `useState` initializer per the HYDRATION rule;
   everything else here that touches `localStorage`/`location` is only ever
   called from client effects/handlers, never during render. */

import { KA_CONFIG } from '@/lib/config';
import { KA_PRINTS } from '@/lib/prints';
import type { StudioDesign } from '@/lib/types';

const CFG = KA_CONFIG.studio;

export const STORAGE_KEY = 'ka_studio';

export interface StudioState {
  design: StudioDesign;
  size: string;
  qty: number;
}

export function defaultDesign(): StudioDesign {
  const g0 = CFG.garments[0],
    c0 = CFG.colours[0],
    pl0 = CFG.placements[0];
  const prints = KA_PRINTS.list() || [];
  return {
    garment: g0.id,
    colour: c0.id,
    printId: prints.length ? prints[0].id : '',
    placement: pl0.id,
    scale: 1,
    rotate: 0,
    x: 0,
    y: 0,
    view: 'front',
  };
}

export function pickDefaultSize(): string {
  const sizes = CFG.sizes || ['M'];
  return sizes.indexOf('M') > -1 ? 'M' : sizes[Math.floor(sizes.length / 2)];
}

export function defaultState(): StudioState {
  return { design: defaultDesign(), size: pickDefaultSize(), qty: 1 };
}

function inList(list: Array<{ id: string }>, id: any): boolean {
  return list.some((o) => o.id === id);
}
function clampNum(v: any, lo: number, hi: number, dflt: number): number {
  v = parseFloat(v);
  if (!isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, v));
}

export function clampScaleRotate(v: any, lo: number, hi: number, dflt: number): number {
  return clampNum(v, lo, hi, dflt);
}

/** Returns the sanitised design plus a user-facing notice when a referenced
 *  print id no longer resolves (matches ../studio.js's `lastFallbackNotice`). */
export function sanitizeDesign(raw: any, fallback?: StudioDesign): { design: StudioDesign; fallbackNotice: string } {
  const d = fallback || defaultDesign();
  let fallbackNotice = '';
  const out: any = {};
  out.garment = raw && inList(CFG.garments as any, raw.garment) ? raw.garment : d.garment;
  out.colour = raw && inList(CFG.colours as any, raw.colour) ? raw.colour : d.colour;
  if (raw && raw.printId && KA_PRINTS.get(raw.printId)) {
    out.printId = raw.printId;
  } else if (raw && raw.printId) {
    fallbackNotice = 'That print is no longer available — showing a default print instead.';
    out.printId = d.printId;
  } else {
    out.printId = d.printId;
  }
  out.placement = raw && inList(CFG.placements as any, raw.placement) ? raw.placement : d.placement;
  out.scale = clampNum(raw && raw.scale, 0.4, 2.5, d.scale);
  const rot = clampNum(raw && raw.rotate, -100000, 100000, d.rotate);
  out.rotate = ((Math.round(rot) % 360) + 360) % 360;
  out.x = Math.round(clampNum(raw && raw.x, -200, 200, d.x));
  out.y = Math.round(clampNum(raw && raw.y, -200, 200, d.y));
  out.view = raw && (raw.view === 'front' || raw.view === 'back') ? raw.view : d.view;
  return { design: out as StudioDesign, fallbackNotice };
}

export function sanitizeSize(v: any): string {
  return v && CFG.sizes.indexOf(v) > -1 ? v : pickDefaultSize();
}
export function sanitizeQty(v: any): number {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return 1;
  return Math.min(20, Math.max(1, n));
}

function readStoredState(): StudioState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    const { design } = sanitizeDesign(raw.design, defaultDesign());
    return { design, size: sanitizeSize(raw.size), qty: sanitizeQty(raw.qty) };
  } catch {
    return null;
  }
}

interface ParsedHash {
  printOverride?: string;
  design?: Record<string, any>;
  size?: string | null;
  qty?: string | null;
}

function parseLocationHash(hash: string): ParsedHash | null {
  const h = hash.replace(/^#/, '');
  if (!h) return null;
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(h);
  } catch {
    return null;
  }
  if (p.has('print') && !p.has('g')) return { printOverride: p.get('print') || '' };
  if (!p.has('g')) return null;
  return {
    design: {
      garment: p.get('g'),
      colour: p.get('c'),
      printId: p.get('p'),
      placement: p.get('pl'),
      scale: p.get('sc'),
      rotate: p.get('rt'),
      x: p.get('x'),
      y: p.get('y'),
      view: p.get('v'),
    },
    size: p.get('sz'),
    qty: p.get('q'),
  };
}

/** Reads localStorage + the URL hash and returns the design/size/qty to boot
 *  with — a fresh object every call, so React always sees a new reference and
 *  re-renders (see StudioBuilder's mount effect). Called client-side only. */
export function loadInitialState(): { state: StudioState; fallbackNotice: string } {
  const stored = readStoredState();
  const base = stored || defaultState();
  const h = parseLocationHash(location.hash);
  if (h && h.printOverride) {
    const { design, fallbackNotice } = sanitizeDesign(
      {
        printId: h.printOverride,
        garment: base.design.garment,
        colour: base.design.colour,
        placement: base.design.placement,
        scale: base.design.scale,
        rotate: base.design.rotate,
        x: base.design.x,
        y: base.design.y,
        view: base.design.view,
      },
      base.design
    );
    return { state: { design, size: base.size, qty: base.qty }, fallbackNotice };
  }
  if (h && h.design) {
    const { design, fallbackNotice } = sanitizeDesign(h.design, defaultDesign());
    return { state: { design, size: sanitizeSize(h.size), qty: sanitizeQty(h.qty) }, fallbackNotice };
  }
  return { state: { design: { ...base.design }, size: base.size, qty: base.qty }, fallbackNotice: '' };
}

export function encodeHash(st: StudioState): string {
  const p = new URLSearchParams();
  p.set('g', st.design.garment);
  p.set('c', st.design.colour);
  p.set('p', st.design.printId);
  p.set('pl', st.design.placement);
  p.set('sc', st.design.scale.toFixed(2));
  p.set('rt', String(Math.round(st.design.rotate)));
  p.set('x', String(Math.round(st.design.x)));
  p.set('y', String(Math.round(st.design.y)));
  p.set('v', st.design.view);
  p.set('sz', st.size);
  p.set('q', String(st.qty));
  return '#' + p.toString();
}

/** Writes localStorage + replaces the URL hash — client-side only (event
 *  handlers / effects), matches ../studio.js's persist(). */
export function persistState(st: StudioState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  } catch {
    /* storage unavailable — hash still carries state */
  }
  const newHash = encodeHash(st);
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}
