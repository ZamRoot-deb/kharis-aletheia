/* KHARIS & ALETHEIA — Tee Studio SVG geometry + garment builder.
   Ported verbatim (logic + coordinates) from ../studio.js sections 1 & 3
   ("GARMENT GEOMETRY" and "SVG BUILD"). Pure, DOM-free — safe to call during
   render on both server and client (no localStorage/window/Date/Math.random),
   which is what keeps the live stage SVG hydration-safe. The one exception in
   the original (a `Math.random()`-derived id prefix, used to namespace each
   render's <defs> ids) is replaced here with a caller-supplied, deterministic
   `uid` (default 'stage') — only one stage SVG is ever mounted at a time, so a
   fixed id can't collide, and determinism is what SSR/hydration requires. */

import { KA_CONFIG } from '@/lib/config';
import { KA_CORE } from '@/lib/core';
import { KA_PRINTS } from '@/lib/prints';
import type { StudioDesign } from '@/lib/types';

const CFG = KA_CONFIG.studio;

export const VB_W = 400;
export const VB_H = 520;

function esc(s: any): string {
  return KA_CORE.escapeHtml(s == null ? '' : String(s));
}

/* ============================================================
   1. GARMENT GEOMETRY — flat vector silhouettes
   One shared coordinate system (viewBox 0 0 400 520) so every placement
   region can be expressed as a clip path in the same space, front and back.
   ============================================================ */
export const GEO = {
  torso: {
    /* tee + long-sleeve: softer, closer drape */
    fitted: {
      front:
        'M168,94 L120,102 C104,106 94,120 90,142 L84,180 C78,240 74,300 72,360 L70,420 L330,420 L328,360 C326,300 322,240 316,180 L310,142 C306,120 296,106 280,102 L232,94 C222,110 212,118 200,120 C188,118 178,110 168,94 Z',
      back:
        'M160,96 L120,102 C104,106 94,120 90,142 L84,180 C78,240 74,300 72,360 L70,420 L330,420 L328,360 C326,300 322,240 316,180 L310,142 C306,120 296,106 280,102 L240,96 C228,102 212,104 200,104 C188,104 172,102 160,96 Z',
    },
    /* crew + hoodie: boxier fleece drape */
    boxy: {
      front:
        'M168,92 L116,100 C98,104 86,120 82,144 L76,182 C70,244 66,306 64,368 L62,420 L338,420 L336,368 C334,306 330,244 324,182 L318,144 C314,120 302,104 284,100 L232,92 C222,110 212,118 200,120 C188,118 178,110 168,92 Z',
      back:
        'M158,94 L116,100 C98,104 86,120 82,144 L76,182 C70,244 66,306 64,368 L62,420 L338,420 L336,368 C334,306 330,244 324,182 L318,144 C314,120 302,104 284,100 L242,94 C228,100 212,102 200,102 C188,102 172,100 158,94 Z',
    },
  },
  sleeve: {
    short:
      'M120,102 C92,108 62,120 42,144 C30,160 24,176 24,192 L50,206 C62,196 76,188 90,182 L90,142 C94,120 104,106 120,102 Z',
    longFitted:
      'M120,102 C90,110 56,126 36,152 C22,172 16,196 16,222 C16,270 20,320 28,364 C32,384 38,400 46,412 L76,406 C70,382 66,356 64,328 C62,288 66,246 78,206 L90,182 L90,142 C94,120 104,106 120,102 Z',
    longBoxy:
      'M116,100 C86,110 50,128 30,156 C16,176 10,200 10,226 C10,274 14,324 22,368 C26,388 32,404 40,416 L72,410 C66,386 62,360 60,332 C58,292 62,248 74,208 L86,184 L82,144 C86,120 98,104 116,100 Z',
  },
  cuff: {
    fitted: 'M40,398 L76,392 L78,416 L44,422 Z',
    boxy: 'M36,402 L72,396 L74,420 L40,426 Z',
  },
  hemBand: {
    fitted: 'M70,398 L330,398 L330,420 L70,420 Z',
    boxy: 'M62,398 L338,398 L338,420 L62,420 Z',
  },
  collarRib:
    'M172,86 C182,96 190,100 200,100 C210,100 218,96 228,86 C233,95 233,107 226,114 C213,122 187,122 174,114 C167,107 167,95 172,86 Z',
  collarPlain: {
    front: 'M168,94 C178,110 188,118 200,120 C212,118 222,110 232,94',
    back: 'M160,96 C172,102 188,104 200,104 C212,104 228,102 240,96',
  },
  hood: {
    front:
      'M138,100 C126,66 152,36 200,34 C248,36 274,66 262,100 C250,88 228,82 200,82 C172,82 150,88 138,100 Z',
    back:
      'M128,112 C116,58 154,24 200,22 C246,24 284,58 272,112 C278,142 266,168 248,180 L152,180 C134,168 122,142 128,112 Z',
  },
  pocket: {
    hoodie: 'M140,284 C162,274 238,274 260,284 L263,338 C263,347 255,354 246,354 L154,354 C145,354 137,347 137,338 Z',
    plain: 'M170,246 C182,240 198,240 210,246 L212,282 C212,290 206,296 198,296 L182,296 C174,296 168,290 168,282 Z',
  },
  drawcord: { L: 'M188,96 C184,114 182,134 184,160', R: 'M212,96 C216,114 218,134 216,160' },
  aglet: { L: { cx: 184, cy: 161 }, R: { cx: 216, cy: 161 } },
} as const;

export const PLACEMENT_BOUNDS: Record<string, string> = {
  chest: 'M154,148 L246,148 L246,238 L154,238 Z',
  diagonal: 'M104,150 L182,150 L298,404 L220,404 Z',
  stripeL: 'M56,150 L100,150 L92,420 L48,420 Z',
  stripeR: 'M300,150 L344,150 L352,420 L308,420 Z',
};

/* front-only placements: on the back view the print does not appear there */
export const FRONT_ONLY_PLACEMENTS: Record<string, boolean> = { chest: true, diagonal: true, pocket: true };

export function isBoxy(garmentId: string): boolean {
  return garmentId === 'crew' || garmentId === 'hoodie';
}

function mirrorPath(d: string, cx: number): string {
  const mirrored = d.replace(/([MLC])\s*([^MLCZ]*)/g, (_m, cmd, nums) => {
    const vals = nums
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    const out: (string | number)[] = [];
    for (let i = 0; i < vals.length; i += 2) {
      out.push((2 * cx - vals[i]).toFixed(2), vals[i + 1]);
    }
    return cmd + ' ' + out.join(' ');
  });
  /* a bare command letter can immediately follow a number in valid SVG path data
     (e.g. "10L20"), but an explicit space is friendlier to read/debug — normalise it in. */
  return mirrored.replace(/([0-9])([MLCZ])/g, '$1 $2');
}

export function bodyPath(garmentId: string, view: 'front' | 'back'): string {
  return isBoxy(garmentId) ? GEO.torso.boxy[view] : GEO.torso.fitted[view];
}
export function sleevePathL(garmentId: string): string {
  if (garmentId === 'tee') return GEO.sleeve.short;
  return isBoxy(garmentId) ? GEO.sleeve.longBoxy : GEO.sleeve.longFitted;
}
export function sleevePathR(garmentId: string): string {
  return mirrorPath(sleevePathL(garmentId), 200);
}

export function shade(hex: string, amt: number): string {
  let c = (hex || '#888888').replace('#', '');
  if (c.length === 3)
    c = c
      .split('')
      .map((ch) => ch + ch)
      .join('');
  const num = parseInt(c, 16) || 0x888888;
  let r = (num >> 16) & 255,
    g = (num >> 8) & 255,
    b = num & 255;
  function adj(v: number): number {
    v = amt < 0 ? v * (1 + amt) : v + (255 - v) * amt;
    return Math.max(0, Math.min(255, Math.round(v)));
  }
  r = adj(r);
  g = adj(g);
  b = adj(b);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
   3. SVG BUILD
   ============================================================ */
interface RegionInfo {
  shapes: string[];
  bound: string[] | null;
  frontOnly: boolean;
}

function regionInfo(garmentId: string, view: 'front' | 'back', placementId: string): RegionInfo {
  const body = bodyPath(garmentId, view);
  const sleeveL = sleevePathL(garmentId),
    sleeveR = sleevePathR(garmentId);
  switch (placementId) {
    case 'sleeves':
      return { shapes: [sleeveL, sleeveR], bound: null, frontOnly: false };
    case 'allover': {
      const shapes = [body, sleeveL, sleeveR];
      if (garmentId === 'hoodie') shapes.push(GEO.hood[view]);
      return { shapes, bound: null, frontOnly: false };
    }
    case 'pocket':
      return { shapes: [garmentId === 'hoodie' ? GEO.pocket.hoodie : GEO.pocket.plain], bound: null, frontOnly: true };
    case 'chest':
      return { shapes: [body], bound: [PLACEMENT_BOUNDS.chest], frontOnly: true };
    case 'diagonal':
      return { shapes: [body], bound: [PLACEMENT_BOUNDS.diagonal], frontOnly: true };
    case 'stripe':
      return { shapes: [body], bound: [PLACEMENT_BOUNDS.stripeL, PLACEMENT_BOUNDS.stripeR], frontOnly: false };
    default:
      return { shapes: [body], bound: null, frontOnly: false };
  }
}

function bandTexture(clipId: string, x: number, y: number, w: number, h: number, lines: number, angle: number): string {
  const out = ['<g clip-path="url(#' + clipId + ')" stroke="rgba(0,0,0,.28)" stroke-width="1.2" opacity=".55">'];
  for (let i = 0; i < lines; i++) {
    const ly = y + (h * (i + 0.5)) / lines;
    out.push('<line x1="' + (x - 10) + '" y1="' + ly + '" x2="' + (x + w + 10) + '" y2="' + (ly + angle) + '"/>');
  }
  out.push('</g>');
  return out.join('');
}

export interface BuildSvgOpts {
  thumb?: boolean;
  forceView?: 'front' | 'back';
  /** deterministic id namespace for this render's <defs> — see file header. */
  uid?: string;
}

/** Builds the full <svg> markup for the current design. */
export function buildSvg(design: StudioDesign, opts: BuildSvgOpts = {}): string {
  const view = opts.forceView || design.view;
  const g = design.garment;
  const colourObj = CFG.colours.find((c) => c.id === design.colour);
  const hex = colourObj ? colourObj.hex : '#888888';
  const printObj = KA_PRINTS.get(design.printId);
  const printDef = printObj ? printObj.def : null;

  const body = bodyPath(g, view);
  const sleeveL = sleevePathL(g),
    sleeveR = sleevePathR(g);
  const boxy = isBoxy(g);
  const hem = boxy ? GEO.hemBand.boxy : GEO.hemBand.fitted;
  const cuffL = boxy ? GEO.cuff.boxy : GEO.cuff.fitted;
  const cuffR = mirrorPath(cuffL, 200);
  const hasRib = boxy && g !== 'hoodie'; /* crew: rib collar/cuffs/hem. hoodie: hood instead of rib collar, but ribbed cuffs/hem */
  const hasHood = g === 'hoodie';

  const region = regionInfo(g, view, design.placement);
  const showPrint = !!printDef && !(region.frontOnly && view === 'back');

  const uid = opts.uid || 'stage';
  const defs: string[] = [];
  const bodyId = 'b_' + uid;

  /* --- clip: garment region (first clip) --- */
  const regionClipId = 'clipR_' + uid;
  defs.push('<clipPath id="' + regionClipId + '">' + region.shapes.map((d) => '<path d="' + d + '"/>').join('') + '</clipPath>');

  /* --- clip: placement bound (second clip, optional) --- */
  let boundClipId: string | null = null;
  if (region.bound) {
    boundClipId = 'clipB_' + uid;
    defs.push('<clipPath id="' + boundClipId + '">' + region.bound.map((d) => '<path d="' + d + '"/>').join('') + '</clipPath>');
  }

  /* --- whole-garment clip, used for the fabric-shading overlay --- */
  const garmentShapes = [body, sleeveL, sleeveR];
  if (hasHood) garmentShapes.push(GEO.hood[view]);
  const garmentClipId = 'clipG_' + uid;
  defs.push('<clipPath id="' + garmentClipId + '">' + garmentShapes.map((d) => '<path d="' + d + '"/>').join('') + '</clipPath>');

  const hemClipId = 'clipHem_' + uid,
    cuffLClipId = 'clipCuffL_' + uid,
    cuffRClipId = 'clipCuffR_' + uid,
    collarClipId = 'clipCol_' + uid;
  if (hasRib || hasHood) {
    defs.push('<clipPath id="' + hemClipId + '"><path d="' + hem + '"/></clipPath>');
    defs.push('<clipPath id="' + cuffLClipId + '"><path d="' + cuffL + '"/></clipPath>');
    defs.push('<clipPath id="' + cuffRClipId + '"><path d="' + cuffR + '"/></clipPath>');
  }
  if (hasRib) defs.push('<clipPath id="' + collarClipId + '"><path d="' + GEO.collarRib + '"/></clipPath>');

  /* --- print pattern: base def from prints.js, offset wrapper for drag position --- */
  const patBaseId = 'patBase_' + uid,
    patOffsetId = 'patOffset_' + uid;
  if (printDef) {
    defs.push(KA_PRINTS.patternDef(printDef, { id: patBaseId, scale: design.scale, rotate: design.rotate }));
    defs.push('<pattern href="#' + patBaseId + '" xlink:href="#' + patBaseId + '" id="' + patOffsetId + '" x="' + design.x + '" y="' + design.y + '" patternUnits="userSpaceOnUse"></pattern>');
  }

  if (!opts.thumb) {
    defs.push(
      '<linearGradient id="shTop_' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<linearGradient id="shBot_' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/>' +
        '</linearGradient>' +
        '<linearGradient id="shSide_' + uid + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".18" stop-color="#000" stop-opacity="0"/>' +
        '<stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/>' +
        '</linearGradient>'
    );
  }

  const out: string[] = [];
  out.push(
    '<svg viewBox="0 0 ' + VB_W + ' ' + VB_H + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-labelledby="' + bodyId + 't">'
  );
  out.push('<title id="' + bodyId + 't">' + esc(describeDesign(design, view)) + '</title>');
  out.push('<defs>' + defs.join('') + '</defs>');

  /* studio backdrop */
  out.push('<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H + '" fill="none"/>');

  /* hood drawn behind shoulders (front) or as full silhouette (back) */
  if (hasHood) out.push('<path d="' + GEO.hood[view] + '" fill="' + shade(hex, view === 'back' ? -0.03 : -0.05) + '"/>');

  /* base garment colour */
  out.push('<g>');
  out.push('<path d="' + body + '" fill="' + hex + '"/>');
  out.push('<path d="' + sleeveL + '" fill="' + hex + '"/>');
  out.push('<path d="' + sleeveR + '" fill="' + hex + '"/>');
  out.push('</g>');

  /* print fill */
  if (showPrint) {
    out.push('<g clip-path="url(#' + regionClipId + ')">');
    if (boundClipId) out.push('<g clip-path="url(#' + boundClipId + ')">');
    out.push('<rect x="-20" y="-20" width="' + (VB_W + 40) + '" height="' + (VB_H + 40) + '" fill="url(#' + patOffsetId + ')"/>');
    if (boundClipId) out.push('</g>');
    out.push('</g>');
  }

  /* ribbed collar / cuffs / hem (crew), ribbed cuffs+hem only (hoodie) */
  if (hasRib) {
    out.push('<path d="' + GEO.collarRib + '" fill="' + shade(hex, -0.16) + '"/>');
    out.push(bandTexture(collarClipId, 160, 82, 80, 40, 3, 6));
  }
  if (hasRib || hasHood) {
    out.push('<path d="' + hem + '" fill="' + shade(hex, -0.16) + '"/>');
    out.push('<path d="' + cuffL + '" fill="' + shade(hex, -0.16) + '"/>');
    out.push('<path d="' + cuffR + '" fill="' + shade(hex, -0.16) + '"/>');
    out.push(bandTexture(hemClipId, 60, 396, 280, 26, 3, 0));
    out.push(bandTexture(cuffLClipId, 34, 390, 46, 34, 2, 6));
    out.push(bandTexture(cuffRClipId, 320, 390, 46, 34, 2, -6));
  }

  /* plain neckline stroke (tee / long-sleeve) */
  if (!hasRib && !hasHood) {
    out.push('<path d="' + GEO.collarPlain[view] + '" fill="none" stroke="' + shade(hex, -0.32) + '" stroke-width="2"/>');
  }

  /* kangaroo pocket (hoodie, front) */
  if (hasHood && view === 'front') {
    out.push('<path d="' + GEO.pocket.hoodie + '" fill="' + shade(hex, -0.04) + '" stroke="' + shade(hex, -0.3) + '" stroke-width="1.4"/>');
  }

  if (!opts.thumb) {
    /* fabric shading — reads through the print so it looks like cloth, not a flat fill */
    out.push('<g clip-path="url(#' + garmentClipId + ')">');
    out.push('<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H + '" fill="url(#shTop_' + uid + ')"/>');
    out.push('<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H + '" fill="url(#shBot_' + uid + ')"/>');
    out.push('<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H + '" fill="url(#shSide_' + uid + ')"/>');
    out.push('</g>');

    /* stitched outlines around panels */
    out.push('<g fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.3" stroke-dasharray="3 3" stroke-linejoin="round">');
    out.push('<path d="' + body + '"/><path d="' + sleeveL + '"/><path d="' + sleeveR + '"/>');
    if (hasHood) out.push('<path d="' + GEO.hood[view] + '"/>');
    if (hasRib) out.push('<path d="' + GEO.collarRib + '"/>');
    if (hasRib || hasHood) {
      out.push('<path d="' + hem + '"/><path d="' + cuffL + '"/><path d="' + cuffR + '"/>');
    }
    if (hasHood && view === 'front') out.push('<path d="' + GEO.pocket.hoodie + '"/>');
    out.push('</g>');
  }

  /* drawcords (hoodie, front) — drawn last, on top */
  if (hasHood && view === 'front') {
    const cord = shade(hex, -0.4),
      aglet = shade(hex, -0.55);
    out.push('<path d="' + GEO.drawcord.L + '" fill="none" stroke="' + cord + '" stroke-width="4" stroke-linecap="round"/>');
    out.push('<path d="' + GEO.drawcord.R + '" fill="none" stroke="' + cord + '" stroke-width="4" stroke-linecap="round"/>');
    out.push('<circle cx="' + GEO.aglet.L.cx + '" cy="' + GEO.aglet.L.cy + '" r="4" fill="' + aglet + '"/>');
    out.push('<circle cx="' + GEO.aglet.R.cx + '" cy="' + GEO.aglet.R.cy + '" r="4" fill="' + aglet + '"/>');
  }

  out.push('</svg>');
  return out.join('');
}

export function describeDesign(design: StudioDesign, view: 'front' | 'back'): string {
  const g = CFG.garments.find((x) => x.id === design.garment);
  const c = CFG.colours.find((x) => x.id === design.colour);
  const pl = CFG.placements.find((x) => x.id === design.placement);
  const pr = KA_PRINTS.get(design.printId);
  const bits = [g ? g.name : design.garment, c ? c.name : design.colour];
  if (pr) bits.push('with ' + pr.name + ' print at ' + (pl ? pl.name.toLowerCase() : design.placement));
  bits.push(view === 'back' ? 'back view' : 'front view');
  return bits.join(', ');
}

export function garmentOf(id: string) {
  return CFG.garments.find((x) => x.id === id);
}
export function colourOf(id: string) {
  return CFG.colours.find((x) => x.id === id);
}
export function placementOf(id: string) {
  return CFG.placements.find((x) => x.id === id);
}
