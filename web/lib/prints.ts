/* KHARIS & ALETHEIA — procedural print engine
   Ported from ../prints.js. KA_PRINTS — DOM-free, deterministic SVG pattern generator
   for the three house print families (kente / ankara / adinkra). Every function here
   returns plain strings; nothing touches `document`. Logic UNCHANGED from the original;
   `saved.*` is the only part that touches localStorage, and it's guarded by try/catch
   so it no-ops server-side (matches the old browser-only behaviour when localStorage
   is unavailable). TypeScript is intentionally loose here per CONTRACT-NEXT.md — the
   def/params shapes vary by family, same as the original plain-JS objects. */
import type { PrintDef, PrintEntry, PrintSymbol, PrintFamily } from './types';

/* ============ CONSTANTS ============ */

const FAMILIES: PrintFamily[] = ['kente', 'ankara', 'adinkra'];
const KENTE_MOTIFS = ['zigzag', 'checker', 'steps', 'diamond', 'bars'];
const ANKARA_MOTIFS = ['rings', 'fans', 'petals', 'waves', 'suns', 'shells'];
const ADINKRA_FRAMES = ['none', 'box', 'comb'];

const STRIP_W = 16; /* kente: px width of one warp strip */
const ANKARA_TILE = 120; /* ankara: px side of one repeat tile */
const CELL = 40; /* adinkra: px side of one grid cell */

const STORAGE_KEY = 'ka_prints';

/* ============ NUMBER / STRING SAFETY ============ */

/* Every computed number that reaches an SVG string goes through r2() —
   it is the single point that guarantees no NaN/Infinity ever leaks into
   markup, and keeps output small by rounding to 2dp. */
function r2(n: any): number {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  return Math.round(v * 100) / 100;
}

function isFiniteNum(v: any): v is number {
  return typeof v === 'number' && isFinite(v);
}

function clampF(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function clampNum(v: any, lo: number, hi: number, fallback: number): number {
  if (!isFiniteNum(v)) return r2(fallback);
  return r2(clampF(v, lo, hi));
}

function clampInt(v: any, lo: number, hi: number, fallback: number): number {
  const n = isFiniteNum(v) ? Math.round(v) : Math.round(fallback);
  return Math.round(clampF(n, lo, hi));
}

function sanitizeEnum(v: any, list: string[], fallback: string): string {
  return list.indexOf(v) !== -1 ? v : fallback;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function sanitizeHex(v: any, fallback: string): string {
  return typeof v === 'string' && HEX_RE.test(v) ? v : fallback;
}

function sanitizePalette(raw: any, fallback: string[]): string[] {
  let arr: string[];
  if (Array.isArray(raw) && raw.length > 0) {
    arr = raw.slice(0, 8).map((v, i) => sanitizeHex(v, fallback[i % fallback.length]));
  } else {
    arr = fallback.slice();
  }
  while (arr.length < 2) arr.push(fallback[arr.length % fallback.length]);
  return arr;
}

/* Keep names to a safe, small, printable charset — display-safe metadata,
   not an SVG-injection vector (name never reaches SVG markup), but any
   text pulled from storage/hash still gets scrubbed before it is trusted. */
const NAME_RE = /[^A-Za-z0-9 &'()#.,\-]/g;
function sanitizeName(raw: any): string {
  if (typeof raw !== 'string') return 'Untitled print';
  const cleaned = raw.replace(NAME_RE, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return cleaned || 'Untitled print';
}

function sanitizeNumArray(raw: any, minLen: number, maxLen: number, lo: number, hi: number, fallback: number[]): number[] {
  let arr: number[];
  if (Array.isArray(raw) && raw.length > 0) {
    arr = raw.slice(0, maxLen).map((v) => clampNum(v, lo, hi, (lo + hi) / 2));
  } else {
    arr = fallback.slice();
  }
  while (arr.length < minLen) arr.push(fallback[arr.length % fallback.length]);
  return arr.slice(0, maxLen);
}

function sanitizeEnumArray(raw: any, whitelist: string[], minLen: number, maxLen: number, fallback: string[]): string[] {
  let arr: string[];
  if (Array.isArray(raw) && raw.length > 0) {
    arr = raw.slice(0, maxLen).map((v) => sanitizeEnum(v, whitelist, whitelist[0]));
  } else {
    arr = fallback.slice();
  }
  while (arr.length < minLen) arr.push(fallback[arr.length % fallback.length]);
  return arr.slice(0, maxLen);
}

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,60}$/;
function sanitizeId(raw: any, fallback: string): string {
  return typeof raw === 'string' && ID_RE.test(raw) ? raw : fallback;
}

/* Deterministic, pure hash of a def's visual content — used only to
   namespace internal element ids so several tiles can be inlined on the
   same page without id collisions in their <defs>/<use>. */
function hashDef(d: PrintDef): string {
  let s: string;
  try {
    s = d.family + '|' + d.palette.join(',') + '|' + JSON.stringify(d.params);
  } catch (e) {
    s = String(d.family) + '|fallback';
  }
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/* ============ SEEDED PRNG (mulberry32) ============ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToInt(seed: any): number {
  if (isFiniteNum(seed)) return seed >>> 0;
  const s = String(seed == null ? 'ka-print' : seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ============ ADINKRA SYMBOLS ============
   Ten original, simplified geometric glyphs inspired by well-known
   adinkra symbols — not traced reproductions. Each `path` is a single
   `d` string (may hold several M…Z subpaths) inside a 100x100 box,
   meant to be rendered as a bold stroke (fill:none). */

const SYMBOLS: PrintSymbol[] = [
  { id: 'gye-nyame', name: 'Gye Nyame',
    meaning: 'Except for God — the supremacy and omnipresence of the divine over all things.',
    path: 'M50,20 C65,20 72,32 68,42 C64,50 54,50 52,42 M50,80 C35,80 28,68 32,58 C36,50 46,50 48,58' },
  { id: 'sankofa', name: 'Sankofa',
    meaning: 'Return and fetch it — it is never too late to go back for what you have forgotten or left behind.',
    path: 'M30,82 C28,55 30,28 55,25 C74,23 80,38 66,44 C56,48 50,38 58,34' },
  { id: 'dwennimmen', name: 'Dwennimmen',
    meaning: 'Ram’s horns — humility paired with strength; power held with a gentle hand.',
    path: 'M50,55 C50,40 38,26 24,32 C13,37 15,52 28,54 M50,55 C50,40 62,26 76,32 C87,37 85,52 72,54' },
  { id: 'adinkrahene', name: 'Adinkrahene',
    meaning: 'Chief of the adinkra symbols — leadership, greatness and the charisma that holds a people together.',
    path: 'M20,50 A30,30 0 1,0 80,50 A30,30 0 1,0 20,50 M32,50 A18,18 0 1,0 68,50 A18,18 0 1,0 32,50 M44,50 A6,6 0 1,0 56,50 A6,6 0 1,0 44,50' },
  { id: 'nyame-dua', name: 'Nyame Dua',
    meaning: 'Tree of God — an altar of protection, marking the presence and providence of the divine.',
    path: 'M50,88 L50,45 M50,45 L28,18 M50,45 L72,18 M50,45 L50,12 M44,12 A6,6 0 1,0 56,12 A6,6 0 1,0 44,12' },
  { id: 'funtunfunefu', name: 'Funtunfunefu Denkyemfunefu',
    meaning: 'Siamese crocodiles sharing one stomach — unity in diversity, fighting for a shared destiny.',
    path: 'M50,50 L25,35 L15,50 L25,65 Z M50,50 L75,35 L85,50 L75,65 Z M45,50 A5,5 0 1,0 55,50 A5,5 0 1,0 45,50' },
  { id: 'aya', name: 'Aya',
    meaning: 'The fern — endurance, resourcefulness and defiance in the face of hardship.',
    path: 'M50,88 L50,15 M50,68 L28,56 M50,68 L72,56 M50,50 L26,38 M50,50 L74,38 M50,32 L30,22 M50,32 L70,22' },
  { id: 'akoma', name: 'Akoma',
    meaning: 'The heart — patience, tolerance, love and the endurance to carry it all.',
    path: 'M50,78 C22,55 20,28 40,25 C48,24 50,32 50,38 C50,32 52,24 60,25 C80,28 78,55 50,78 Z' },
  { id: 'mate-masie', name: 'Mate Masie',
    meaning: 'What I hear, I keep — wisdom, knowledge and the prudence to hold what matters.',
    path: 'M50,15 L82,15 L82,75 L22,75 L22,32 L65,32 L65,60 L38,60 L38,45 L50,45' },
  { id: 'nkyinkyim', name: 'Nkyinkyim',
    meaning: 'Twisting — initiative, dynamism and the versatility to move through life’s changes.',
    path: 'M15,78 L38,52 L18,42 L50,15 L64,42 L48,54 L85,25' }
];

const SYMBOLS_BY_ID: Record<string, PrintSymbol> = {};
SYMBOLS.forEach((s) => {
  SYMBOLS_BY_ID[s.id] = s;
});

function symbolIndex(id: string): number {
  for (let i = 0; i < SYMBOLS.length; i++) {
    if (SYMBOLS[i].id === id) return i;
  }
  return 0;
}

function symbols(): PrintSymbol[] {
  return SYMBOLS.map((s) => ({ id: s.id, name: s.name, meaning: s.meaning, path: s.path }));
}

/* ============ DEFAULTS ============ */

const DEFAULT_DEFS: Record<PrintFamily, PrintDef> = {
  kente: {
    family: 'kente', name: 'Untitled kente', palette: ['#d8b26a', '#8b0e3a', '#1f4d2e', '#f7f1e8'],
    params: { strips: 8, bandHeights: [12, 8, 12, 6], blockMotifs: ['zigzag', 'checker', 'steps', 'bars'], weftLines: 8 }
  },
  ankara: {
    family: 'ankara', name: 'Untitled ankara', palette: ['#d8b26a', '#e8325e', '#121013', '#f7f1e8'],
    params: { motif: 'rings', scale: 1, outline: true, dotFill: true, crackle: false }
  },
  adinkra: {
    family: 'adinkra', name: 'Untitled adinkra', palette: ['#2a0816', '#d8b26a', '#f7f1e8'],
    params: { symbol: 'gye-nyame', density: 3, frame: 'box', alternate: false, rotateAlt: false }
  }
};

function cloneParams(family: PrintFamily, p: any): any {
  if (family === 'kente') {
    return { strips: p.strips, bandHeights: p.bandHeights.slice(), blockMotifs: p.blockMotifs.slice(), weftLines: p.weftLines };
  }
  const out: any = {};
  for (const k in p) {
    if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
  }
  return out;
}

function defaults(family?: any): PrintDef {
  const f: PrintFamily = FAMILIES.indexOf(family) !== -1 ? family : 'kente';
  const d = DEFAULT_DEFS[f];
  return { family: d.family, name: d.name, palette: d.palette.slice(), params: cloneParams(f, d.params) };
}

/* ============ SANITIZE ============ */

function sanitizeParams(family: PrintFamily, raw: any, dflt: any): any {
  if (family === 'ankara') {
    return {
      motif: sanitizeEnum(raw.motif, ANKARA_MOTIFS, dflt.motif),
      scale: clampNum(raw.scale, 0.4, 2.5, dflt.scale),
      outline: raw.outline === undefined ? dflt.outline : !!raw.outline,
      dotFill: raw.dotFill === undefined ? dflt.dotFill : !!raw.dotFill,
      crackle: raw.crackle === undefined ? dflt.crackle : !!raw.crackle
    };
  }
  if (family === 'adinkra') {
    return {
      symbol: SYMBOLS_BY_ID[raw.symbol] ? raw.symbol : dflt.symbol,
      density: clampInt(raw.density, 1, 6, dflt.density),
      frame: sanitizeEnum(raw.frame, ADINKRA_FRAMES, dflt.frame),
      alternate: raw.alternate === undefined ? dflt.alternate : !!raw.alternate,
      rotateAlt: raw.rotateAlt === undefined ? dflt.rotateAlt : !!raw.rotateAlt
    };
  }
  /* kente */
  return {
    strips: clampInt(raw.strips, 3, 8, dflt.strips),
    bandHeights: sanitizeNumArray(raw.bandHeights, 2, 5, 4, 14, dflt.bandHeights),
    blockMotifs: sanitizeEnumArray(raw.blockMotifs, KENTE_MOTIFS, 1, 6, dflt.blockMotifs),
    weftLines: clampInt(raw.weftLines, 0, 10, dflt.weftLines)
  };
}

function sanitize(def: any): PrintDef {
  const family: PrintFamily = def && FAMILIES.indexOf(def.family) !== -1 ? def.family : 'kente';
  const dflt = DEFAULT_DEFS[family];
  const name = sanitizeName(def && def.name);
  const palette = sanitizePalette(def && def.palette, dflt.palette);
  const rawParams = def && typeof def.params === 'object' && def.params ? def.params : {};
  const params = sanitizeParams(family, rawParams, dflt.params);
  return { family, name, palette, params };
}

/* ============ KENTE RENDERER ============ */

function kenteMotif(type: string, x: number, y: number, w: number, h: number, color: string): string {
  const cx = r2(x + w / 2),
    cy = r2(y + h / 2);
  if (type === 'checker') {
    const hw = r2(w / 2),
      hh = r2(h / 2);
    return (
      '<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + hw + '" height="' + hh + '" fill="' + color + '"/>' +
      '<rect x="' + r2(x + hw) + '" y="' + r2(y + hh) + '" width="' + hw + '" height="' + hh + '" fill="' + color + '"/>'
    );
  }
  if (type === 'steps') {
    const s = r2(h / 3);
    return (
      '<rect x="' + r2(x) + '" y="' + r2(y + h - s) + '" width="' + r2(w / 3) + '" height="' + s + '" fill="' + color + '"/>' +
      '<rect x="' + r2(x + w / 3) + '" y="' + r2(y + h - 2 * s) + '" width="' + r2(w / 3) + '" height="' + r2(2 * s) + '" fill="' + color + '"/>' +
      '<rect x="' + r2(x + (2 * w) / 3) + '" y="' + r2(y) + '" width="' + r2(w / 3) + '" height="' + r2(h) + '" fill="' + color + '"/>'
    );
  }
  if (type === 'diamond') {
    return '<polygon points="' + cx + ',' + r2(y) + ' ' + r2(x + w) + ',' + cy + ' ' + cx + ',' + r2(y + h) + ' ' + r2(x) + ',' + cy + '" fill="' + color + '"/>';
  }
  if (type === 'bars') {
    const bh = r2(h / 4);
    return (
      '<rect x="' + r2(x) + '" y="' + r2(y + bh) + '" width="' + r2(w) + '" height="' + r2(bh * 0.6) + '" fill="' + color + '"/>' +
      '<rect x="' + r2(x) + '" y="' + r2(y + bh * 2.4) + '" width="' + r2(w) + '" height="' + r2(bh * 0.6) + '" fill="' + color + '"/>'
    );
  }
  /* zigzag (default) */
  const pts =
    r2(x) + ',' + r2(y + h) + ' ' + r2(x + w * 0.25) + ',' + r2(y) + ' ' + r2(x + w * 0.5) + ',' + r2(y + h) + ' ' +
    r2(x + w * 0.75) + ',' + r2(y) + ' ' + r2(x + w) + ',' + r2(y + h);
  return (
    '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="' + Math.max(1, r2(w * 0.12)) +
    '" stroke-linecap="round" stroke-linejoin="round"/>'
  );
}

function buildKente(d: PrintDef) {
  const p = d.params,
    pal = d.palette;
  const strips: number = p.strips,
    bandHs: number[] = p.bandHeights,
    motifs: string[] = p.blockMotifs,
    weft: number = p.weftLines;
  const tileH = r2(bandHs.reduce((a, b) => a + b, 0));
  const tileW = r2(strips * STRIP_W);
  let body = '';
  for (let i = 0; i < strips; i++) {
    const x = r2(i * STRIP_W);
    const baseColor = pal[i % pal.length];
    body += '<rect x="' + x + '" y="0" width="' + STRIP_W + '" height="' + tileH + '" fill="' + baseColor + '"/>';
    let y = 0;
    for (let j = 0; j < bandHs.length; j++) {
      const bh = bandHs[j];
      const motif = motifs[(i + j) % motifs.length];
      const accent = pal[(i + j + 1) % pal.length];
      body += kenteMotif(motif, x, y, STRIP_W, bh, accent);
      y = r2(y + bh);
    }
  }
  if (weft > 0) {
    for (let k = 0; k < weft; k++) {
      const wy = r2((k + 0.5) * (tileH / weft));
      body += '<line x1="0" y1="' + wy + '" x2="' + tileW + '" y2="' + wy + '" stroke="' + pal[pal.length - 1] + '" stroke-width="0.6" opacity="0.18"/>';
    }
  }
  return { w: tileW, h: tileH, body };
}

/* ============ ANKARA RENDERER ============ */

function ankaraDots(W: number, H: number, color: string): string {
  let body = '';
  const cols = 6,
    rows = 6,
    sx = W / cols,
    sy = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = r % 2 ? sx / 2 : 0;
      let cx = r2(c * sx + sx / 2 + ox);
      if (cx > W) cx = r2(cx - W);
      const cy = r2(r * sy + sy / 2);
      body += '<circle cx="' + cx + '" cy="' + cy + '" r="1.4" fill="' + color + '" opacity="0.4"/>';
    }
  }
  return body;
}

const CRACKLE_LINES = [
  [2, 10, 30, 25, 15, 55, 40, 70],
  [70, 5, 55, 35, 85, 50, 60, 90],
  [10, 80, 35, 95, 5, 110, 25, 118],
  [90, 15, 110, 40, 95, 65, 115, 85],
  [45, 2, 60, 20, 40, 38, 65, 55],
  [20, 95, 45, 105, 15, 118, 50, 118]
];
function ankaraCrackle(color: string): string {
  let body = '';
  for (let i = 0; i < CRACKLE_LINES.length; i++) {
    const a = CRACKLE_LINES[i];
    body +=
      '<path d="M' + a[0] + ',' + a[1] + ' L' + a[2] + ',' + a[3] + ' L' + a[4] + ',' + a[5] + ' L' + a[6] + ',' + a[7] +
      '" fill="none" stroke="' + color + '" stroke-width="0.5" opacity="0.35" stroke-linecap="round"/>';
  }
  return body;
}

function ankaraMotif(type: string, cx: number, cy: number, r: number, fill: string, stroke: string, outline: boolean): string {
  r = Math.max(4, r2(r));
  const sw = outline ? ' stroke="' + stroke + '" stroke-width="' + Math.max(0.6, r2(r * 0.05)) + '"' : ' stroke="none"';
  let body = '',
    i: number;
  if (type === 'fans') {
    const n = 5,
      a0 = -90;
    for (i = 0; i < n; i++) {
      const a1 = ((a0 + i * (180 / n)) * Math.PI) / 180;
      const a2 = ((a0 + (i + 1) * (180 / n)) * Math.PI) / 180;
      const x1 = r2(cx + r * Math.cos(a1)),
        y1 = r2(cy + r * Math.sin(a1));
      const x2 = r2(cx + r * Math.cos(a2)),
        y2 = r2(cy + r * Math.sin(a2));
      body +=
        '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 0 1 ' + x2 + ',' + y2 +
        ' Z" fill="' + fill + '"' + sw + ' opacity="' + (i % 2 ? 0.55 : 0.85) + '"/>';
    }
    return body;
  }
  if (type === 'petals') {
    const pn = 6;
    for (i = 0; i < pn; i++) {
      const ang = r2(i * (360 / pn));
      body +=
        '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r2(r * 0.42) + '" ry="' + r2(r * 0.95) + '" fill="' + fill + '"' + sw +
        ' opacity="0.8" transform="rotate(' + ang + ' ' + cx + ' ' + cy + ')"/>';
    }
    return body + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.22) + '" fill="' + stroke + '"/>';
  }
  if (type === 'waves') {
    for (i = 1; i <= 3; i++) {
      const rr = r2((r * i) / 3);
      body +=
        '<path d="M' + r2(cx - rr) + ',' + cy + ' Q' + cx + ',' + r2(cy - rr * 0.6) + ' ' + r2(cx + rr) + ',' + cy +
        '" fill="none" stroke="' + fill + '" stroke-width="' + r2(Math.max(0.8, r * 0.06)) + '" opacity="' + r2(0.9 - i * 0.2) + '"/>';
    }
    return body;
  }
  if (type === 'suns') {
    body = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.4) + '" fill="' + fill + '"' + sw + '/>';
    const rays = 8;
    for (i = 0; i < rays; i++) {
      const rang = (i * (360 / rays) * Math.PI) / 180;
      const rx1 = r2(cx + Math.cos(rang) * r * 0.5),
        ry1 = r2(cy + Math.sin(rang) * r * 0.5);
      const rx2 = r2(cx + Math.cos(rang) * r),
        ry2 = r2(cy + Math.sin(rang) * r);
      body +=
        '<line x1="' + rx1 + '" y1="' + ry1 + '" x2="' + rx2 + '" y2="' + ry2 + '" stroke="' + fill + '" stroke-width="' +
        r2(Math.max(0.8, r * 0.1)) + '" stroke-linecap="round"/>';
    }
    return body;
  }
  if (type === 'shells') {
    for (i = 1; i <= 4; i++) {
      const sr = r2((r * i) / 4);
      body +=
        '<path d="M' + r2(cx - sr) + ',' + cy + ' A' + sr + ',' + sr + ' 0 0 1 ' + r2(cx + sr) + ',' + cy +
        '" fill="none" stroke="' + fill + '" stroke-width="' + r2(Math.max(0.7, r * 0.05)) + '" opacity="' + r2(1 - i * 0.18) + '"/>';
    }
    return body;
  }
  /* rings (default) */
  return (
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" opacity="0.85"' + sw + '/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.62) + '" fill="none" stroke="' + stroke + '" stroke-width="' + r2(Math.max(0.8, r * 0.08)) + '"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.2) + '" fill="' + stroke + '"/>'
  );
}

function buildAnkara(d: PrintDef) {
  const p = d.params,
    pal = d.palette;
  const W = ANKARA_TILE,
    H = ANKARA_TILE;
  const base = pal[0],
    accent = pal[1] || pal[0],
    line = pal[2] || pal[0],
    hi = pal[3] || accent;
  let body = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + base + '"/>';
  if (p.dotFill) body += ankaraDots(W, H, accent);
  if (p.crackle) body += ankaraCrackle(line);
  const centers: Array<[number, number]> = [
    [W / 2, H / 2],
    [0, 0],
    [W, 0],
    [0, H],
    [W, H]
  ];
  for (let i = 0; i < centers.length; i++) {
    body += ankaraMotif(p.motif, centers[i][0], centers[i][1], 26 * p.scale, hi, line, p.outline);
  }
  return { w: W, h: H, body };
}

/* ============ ADINKRA RENDERER ============ */

/* Frame shape drawn once at cell-local coordinates (0,0,size,size) so every
   cell can reuse it through <use> instead of repeating the path. */
function adinkraFrameShape(type: string, size: number, color: string): string {
  if (type === 'box') {
    const inset = 2;
    return (
      '<rect x="' + r2(inset) + '" y="' + r2(inset) + '" width="' + r2(size - inset * 2) + '" height="' + r2(size - inset * 2) +
      '" fill="none" stroke="' + color + '" stroke-width="0.8" opacity="0.7"/>'
    );
  }
  if (type === 'comb') {
    const n = 4,
      step = r2(size / n);
    let d = '';
    for (let i = 0; i < n; i++) {
      const tx = r2(i * step + step / 2);
      d += 'M' + tx + ',0 l0,4 M' + tx + ',' + r2(size) + ' l0,-4 ';
    }
    return '<path d="' + d.trim() + '" stroke="' + color + '" stroke-width="0.8" fill="none" opacity="0.7"/>';
  }
  return '';
}

function buildAdinkra(d: PrintDef) {
  const p = d.params,
    pal = d.palette;
  const density: number = p.density;
  const W = r2(density * CELL),
    H = W;
  const base = pal[0],
    ink = pal[1] || pal[0],
    accent = pal[2] || ink;
  const sym = SYMBOLS_BY_ID[p.symbol] || SYMBOLS[0];
  const altSym = p.alternate ? SYMBOLS[(symbolIndex(p.symbol) + 1) % SYMBOLS.length] : null;
  const ns = hashDef(d);
  const idA = 'ka-sym-' + ns + '-a',
    idB = 'ka-sym-' + ns + '-b';
  const frameShape = adinkraFrameShape(p.frame, CELL, accent);
  const idF = 'ka-frame-' + ns;
  const defs =
    '<defs><path id="' + idA + '" d="' + sym.path + '"/>' +
    (altSym ? '<path id="' + idB + '" d="' + altSym.path + '"/>' : '') +
    (frameShape ? '<g id="' + idF + '">' + frameShape + '</g>' : '') + '</defs>';
  let body = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + base + '"/>' + defs;
  const pad = 6,
    s = r2((CELL - pad * 2) / 100);
  for (let r = 0; r < density; r++) {
    for (let c = 0; c < density; c++) {
      const x = r2(c * CELL),
        y = r2(r * CELL);
      const useAlt = p.alternate && (r + c) % 2 === 1;
      const refId = useAlt ? idB : idA;
      const rot = useAlt && p.rotateAlt ? ' rotate(180 50 50)' : '';
      const tx = r2(x + pad),
        ty = r2(y + pad);
      if (frameShape) body += '<use href="#' + idF + '" x="' + x + '" y="' + y + '"/>';
      body +=
        '<use href="#' + refId + '" transform="translate(' + tx + ',' + ty + ') scale(' + s + ')' + rot +
        '" stroke="' + ink + '" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    }
  }
  return { w: W, h: H, body };
}

/* ============ TILE DISPATCH + PUBLIC RENDER API ============ */

function buildTile(d: PrintDef) {
  if (d.family === 'ankara') return buildAnkara(d);
  if (d.family === 'adinkra') return buildAdinkra(d);
  return buildKente(d);
}

function tileSvg(def: any, opts?: { size?: number }): string {
  const d = sanitize(def);
  const tile = buildTile(d);
  const o = opts || {};
  const size = isFiniteNum(o.size) ? clampF(o.size, 8, 4000) : null;
  const w = size ? r2(size) : tile.w;
  const h = size ? r2(size * (tile.h / tile.w)) : tile.h;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + tile.w + ' ' + tile.h + '" width="' + w + '" height="' + h + '">' +
    tile.body + '</svg>'
  );
}

function patternDef(def: any, opts?: { scale?: number; rotate?: number; id?: string }): string {
  const d = sanitize(def);
  const tile = buildTile(d);
  const o = opts || {};
  const scale = isFiniteNum(o.scale) ? clampF(o.scale, 0.1, 8) : 1;
  const rotate = isFiniteNum(o.rotate) ? ((o.rotate % 360) + 360) % 360 : 0;
  const pid = sanitizeId(o.id, 'ka-pattern-' + hashDef(d));
  const pw = r2(tile.w * scale),
    ph = r2(tile.h * scale);
  const transform = rotate ? ' patternTransform="rotate(' + r2(rotate) + ')"' : '';
  return (
    '<pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="' + pw + '" height="' + ph + '"' + transform + '>' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + tile.w + ' ' + tile.h + '" width="' + pw + '" height="' + ph + '">' +
    tile.body + '</svg></pattern>'
  );
}

function dataUri(def: any, opts?: { size?: number }): string {
  const svg = tileSvg(def, opts);
  return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
}

/* ============ RANDOMIZE ============ */

function randomName(family: PrintFamily, rng: () => number): string {
  const A = ['MIDNIGHT', 'GOLDLINE', 'BERRY', 'FOREST', 'COBALT', 'SMOKED', 'QUIET', 'BOLD', 'ANTIQUE', 'DUSK'];
  const N: Record<string, string[]> = {
    kente: ['WARP', 'WEAVE', 'STRIP', 'LOOM'],
    ankara: ['BLOOM', 'WAX', 'RIPPLE', 'CRACKLE'],
    adinkra: ['STAMP', 'BLOCK', 'GLYPH', 'PROVERB']
  };
  const a = A[Math.floor(rng() * A.length)];
  const pool = N[family] || N.kente;
  const n = pool[Math.floor(rng() * pool.length)];
  return a + ' ' + n + ' REMIX';
}

function randomize(def: any, seed?: any): PrintDef {
  const base: PrintFamily = def && FAMILIES.indexOf(def.family) !== -1 ? def.family : 'kente';
  const rng = mulberry32(seedToInt(seed));
  function pick<T>(arr: T[]): T {
    return arr[Math.floor(rng() * arr.length)];
  }

  const paletteSet = HOUSE_PALETTES[base];
  const palette = pick(paletteSet).slice();
  let params: any,
    i: number;

  if (base === 'ankara') {
    params = {
      motif: pick(ANKARA_MOTIFS),
      scale: r2(0.7 + rng() * 1.1),
      outline: rng() > 0.4,
      dotFill: rng() > 0.3,
      crackle: rng() > 0.5
    };
  } else if (base === 'adinkra') {
    const ids = SYMBOLS.map((s) => s.id);
    params = {
      symbol: pick(ids),
      density: 2 + Math.floor(rng() * 4),
      frame: pick(ADINKRA_FRAMES),
      alternate: rng() > 0.5,
      rotateAlt: rng() > 0.5
    };
  } else {
    const strips = 4 + Math.floor(rng() * 5);
    const bandCount = 2 + Math.floor(rng() * 4);
    const bandHeights: number[] = [];
    for (i = 0; i < bandCount; i++) bandHeights.push(r2(6 + rng() * 14));
    const mc = 2 + Math.floor(rng() * 3);
    const blockMotifs: string[] = [];
    for (i = 0; i < mc; i++) blockMotifs.push(pick(KENTE_MOTIFS));
    params = { strips, bandHeights, blockMotifs, weftLines: Math.floor(rng() * 10) };
  }

  const name = randomName(base, rng);
  return sanitize({ family: base, name, palette, params });
}

/* House palette combinations randomize() draws from — every entry is a
   valid hex so sanitize() always passes them through unchanged. */
const HOUSE_PALETTES: Record<PrintFamily, string[][]> = {
  kente: [
    ['#d8b26a', '#8b0e3a', '#1f4d2e', '#f7f1e8'],
    ['#f0d6a0', '#2a0816', '#121013', '#4a5232'],
    ['#e8325e', '#d8b26a', '#121013', '#e9dfc8'],
    ['#1f4d2e', '#d8b26a', '#5a1029', '#f4f1ea']
  ],
  ankara: [
    ['#d8b26a', '#e8325e', '#121013', '#f7f1e8'],
    ['#5a1029', '#d8b26a', '#1f4d2e', '#e9dfc8'],
    ['#242a5e', '#f0d6a0', '#f4f1ea', '#8a6a78'],
    ['#1f4fa8', '#f4f1ea', '#242a5e', '#d8b26a']
  ],
  adinkra: [
    ['#2a0816', '#d8b26a', '#f7f1e8'],
    ['#121013', '#f0d6a0', '#e9dfc8'],
    ['#5a1029', '#d8b26a', '#4a5232'],
    ['#1f4d2e', '#e9dfc8', '#d8b26a']
  ]
};

/* ============ BUILT-IN PRINTS (>=4 per family) ============ */

function mkBuiltin(id: string, name: string, family: PrintFamily, maker: string | null, palette: string[], params: any, meaning: string): PrintEntry {
  const def = sanitize({ family, name, palette, params });
  return { id, name, family, maker, meaning, def };
}

const BUILTINS: PrintEntry[] = [
  /* ---- kente — efua-mensah ---- */
  mkBuiltin('kente-01', 'GOLDLINE WARP', 'kente', 'efua-mensah',
    ['#d8b26a', '#8b0e3a', '#1f4d2e', '#f7f1e8'],
    { strips: 8, bandHeights: [12, 8, 12, 6], blockMotifs: ['zigzag', 'checker', 'steps', 'bars'], weftLines: 8 },
    'Eight strips woven tight around a single gold line — the thread every other colour answers to.'),
  mkBuiltin('kente-02', 'MIDNIGHT SHUTTLE', 'kente', 'efua-mensah',
    ['#f0d6a0', '#2a0816', '#121013', '#4a5232'],
    { strips: 6, bandHeights: [10, 10, 8], blockMotifs: ['diamond', 'bars', 'zigzag'], weftLines: 6 },
    'Diamonds and bars run the shuttle back and forth across black — the pattern of quiet, steady work.'),
  mkBuiltin('kente-03', 'BERRY STEPS', 'kente', 'efua-mensah',
    ['#e8325e', '#d8b26a', '#121013', '#e9dfc8'],
    { strips: 7, bandHeights: [14, 6, 14], blockMotifs: ['steps', 'checker'], weftLines: 10 },
    'Deep berry steps climbing the warp, one stair at a time — patience built into the cloth.'),
  mkBuiltin('kente-04', 'FOREST DIAMOND WEAVE', 'kente', 'efua-mensah',
    ['#1f4d2e', '#d8b26a', '#5a1029', '#f4f1ea'],
    { strips: 8, bandHeights: [8, 8, 8, 8], blockMotifs: ['diamond', 'zigzag', 'checker', 'bars'], weftLines: 4 },
    'Four strips, four motifs, one field — forest green carrying the whole pattern.'),

  /* ---- ankara — zuri-olayinka on the indigo pieces, null on the rest ---- */
  mkBuiltin('ankara-01', 'SUNBURST RINGS', 'ankara', null,
    ['#d8b26a', '#e8325e', '#121013', '#f7f1e8'],
    { motif: 'rings', scale: 1, outline: true, dotFill: true, crackle: false },
    'Concentric rings on antique gold, cut with a hand-inked outline — the wax-print classic.'),
  mkBuiltin('ankara-02', 'CRACKLE FAN', 'ankara', null,
    ['#5a1029', '#d8b26a', '#1f4d2e', '#e9dfc8'],
    { motif: 'fans', scale: 1.1, outline: true, dotFill: false, crackle: true },
    'Fans laid over a crackled batik ground — the hairline cracks that mark a true wax print.'),
  mkBuiltin('ankara-03', 'INDIGO SHELLS', 'ankara', 'zuri-olayinka',
    ['#242a5e', '#f0d6a0', '#f4f1ea', '#8a6a78'],
    { motif: 'shells', scale: 0.9, outline: false, dotFill: true, crackle: true },
    'Nested shell arcs dyed deep indigo, from Zuri Olayinka’s indigo-only series.'),
  mkBuiltin('ankara-04', 'INDIGO WAVE PETAL', 'ankara', 'zuri-olayinka',
    ['#1f4fa8', '#f4f1ea', '#242a5e', '#d8b26a'],
    { motif: 'petals', scale: 1.2, outline: true, dotFill: true, crackle: false },
    'Petals folding over an indigo ground — soft shape, dark dye, Zuri Olayinka’s hand.'),

  /* ---- adinkra — kwame-asante ---- */
  mkBuiltin('adinkra-01', 'GYE NYAME GRID', 'adinkra', 'kwame-asante',
    ['#2a0816', '#d8b26a', '#f7f1e8'],
    { symbol: 'gye-nyame', density: 4, frame: 'box', alternate: false, rotateAlt: false },
    SYMBOLS_BY_ID['gye-nyame'].meaning),
  mkBuiltin('adinkra-02', 'SANKOFA COMB', 'adinkra', 'kwame-asante',
    ['#121013', '#f0d6a0', '#e9dfc8'],
    { symbol: 'sankofa', density: 3, frame: 'comb', alternate: true, rotateAlt: true },
    SYMBOLS_BY_ID['sankofa'].meaning),
  mkBuiltin('adinkra-03', 'ADINKRAHENE FIELD', 'adinkra', 'kwame-asante',
    ['#5a1029', '#d8b26a', '#4a5232'],
    { symbol: 'adinkrahene', density: 5, frame: 'none', alternate: false, rotateAlt: false },
    SYMBOLS_BY_ID['adinkrahene'].meaning),
  mkBuiltin('adinkra-04', 'AKOMA BLOCK', 'adinkra', 'kwame-asante',
    ['#1f4d2e', '#e9dfc8', '#d8b26a'],
    { symbol: 'akoma', density: 3, frame: 'box', alternate: true, rotateAlt: false },
    SYMBOLS_BY_ID['akoma'].meaning)
];

const BUILTINS_BY_ID: Record<string, PrintEntry> = {};
BUILTINS.forEach((b) => {
  BUILTINS_BY_ID[b.id] = b;
});

function cloneEntry(e: PrintEntry): PrintEntry {
  return { id: e.id, name: e.name, family: e.family, maker: e.maker, meaning: e.meaning, def: e.def };
}

function list(): PrintEntry[] {
  return BUILTINS.map(cloneEntry);
}

/* ============ SAVED (localStorage 'ka_prints') ============ */

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (e) {
    return false;
  }
}

function genId(): string {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const SAVED_ID_RE = /^c_[a-z0-9]+$/i;

function readSaved(): PrintEntry[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows.map((entry: any) => {
      const d = sanitize(entry && entry.def);
      const id = entry && typeof entry.id === 'string' && SAVED_ID_RE.test(entry.id) ? entry.id : genId();
      return { id, name: d.name, family: d.family, maker: null, meaning: null, def: d };
    });
  } catch (e) {
    return [];
  }
}

function writeSaved(rows: PrintEntry[]): boolean {
  if (!hasLocalStorage()) return false;
  try {
    const slim = rows.map((e) => ({ id: e.id, def: e.def }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    return true;
  } catch (e) {
    return false;
  }
}

const saved = {
  list(): PrintEntry[] {
    return readSaved();
  },
  save(def: any): PrintEntry {
    const d = sanitize(def);
    const rows = readSaved();
    const entry: PrintEntry = { id: genId(), name: d.name, family: d.family, maker: null, meaning: null, def: d };
    rows.push(entry);
    writeSaved(rows);
    return entry;
  },
  remove(id: string): boolean {
    const rows = readSaved();
    const next = rows.filter((e) => e.id !== id);
    if (next.length === rows.length) return false;
    return writeSaved(next);
  }
};

/* ============ GET ============ */

function get(id: any): PrintEntry | null {
  if (typeof id !== 'string') return null;
  const b = BUILTINS_BY_ID[id];
  if (b) return cloneEntry(b);
  const rows = readSaved();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return rows[i];
  }
  return null;
}

/* ============ PUBLIC API ============ */

export const KA_PRINTS = {
  list,
  get,
  defaults,
  tileSvg,
  patternDef,
  dataUri,
  randomize,
  symbols,
  sanitize,
  saved
};
