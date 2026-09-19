/* KHARIS & ALETHEIA — procedural print engine
   window.KA_PRINTS — DOM-free, deterministic SVG pattern generator for the
   three house print families (kente / ankara / adinkra). Every function here
   returns plain strings; nothing touches `document`. Safe to `require()` from
   node:test and safe to drop into a browser via a classic <script> tag. */

(function () {
  'use strict';

  /* ============ CONSTANTS ============ */

  var FAMILIES = ['kente', 'ankara', 'adinkra'];
  var KENTE_MOTIFS = ['zigzag', 'checker', 'steps', 'diamond', 'bars'];
  var ANKARA_MOTIFS = ['rings', 'fans', 'petals', 'waves', 'suns', 'shells'];
  var ADINKRA_FRAMES = ['none', 'box', 'comb'];

  var STRIP_W = 16;      /* kente: px width of one warp strip */
  var ANKARA_TILE = 120; /* ankara: px side of one repeat tile */
  var CELL = 40;         /* adinkra: px side of one grid cell */

  var STORAGE_KEY = 'ka_prints';

  /* ============ NUMBER / STRING SAFETY ============ */

  /* Every computed number that reaches an SVG string goes through r2() —
     it is the single point that guarantees no NaN/Infinity ever leaks into
     markup, and keeps output small by rounding to 2dp. */
  function r2(n) {
    var v = (typeof n === 'number' && isFinite(n)) ? n : 0;
    return Math.round(v * 100) / 100;
  }

  function isFiniteNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function clampF(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function clampNum(v, lo, hi, fallback) {
    if (!isFiniteNum(v)) return r2(fallback);
    return r2(clampF(v, lo, hi));
  }

  function clampInt(v, lo, hi, fallback) {
    var n = isFiniteNum(v) ? Math.round(v) : Math.round(fallback);
    return Math.round(clampF(n, lo, hi));
  }

  function sanitizeEnum(v, list, fallback) {
    return list.indexOf(v) !== -1 ? v : fallback;
  }

  var HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  function sanitizeHex(v, fallback) {
    return (typeof v === 'string' && HEX_RE.test(v)) ? v : fallback;
  }

  function sanitizePalette(raw, fallback) {
    var arr;
    if (Array.isArray(raw) && raw.length > 0) {
      arr = raw.slice(0, 8).map(function (v, i) {
        return sanitizeHex(v, fallback[i % fallback.length]);
      });
    } else {
      arr = fallback.slice();
    }
    while (arr.length < 2) arr.push(fallback[arr.length % fallback.length]);
    return arr;
  }

  /* Keep names to a safe, small, printable charset — display-safe metadata,
     not an SVG-injection vector (name never reaches SVG markup), but any
     text pulled from storage/hash still gets scrubbed before it is trusted. */
  var NAME_RE = /[^A-Za-z0-9 &'()#.,\-]/g;
  function sanitizeName(raw) {
    if (typeof raw !== 'string') return 'Untitled print';
    var cleaned = raw.replace(NAME_RE, '').replace(/\s+/g, ' ').trim().slice(0, 48);
    return cleaned || 'Untitled print';
  }

  function sanitizeNumArray(raw, minLen, maxLen, lo, hi, fallback) {
    var arr;
    if (Array.isArray(raw) && raw.length > 0) {
      arr = raw.slice(0, maxLen).map(function (v) { return clampNum(v, lo, hi, (lo + hi) / 2); });
    } else {
      arr = fallback.slice();
    }
    while (arr.length < minLen) arr.push(fallback[arr.length % fallback.length]);
    return arr.slice(0, maxLen);
  }

  function sanitizeEnumArray(raw, whitelist, minLen, maxLen, fallback) {
    var arr;
    if (Array.isArray(raw) && raw.length > 0) {
      arr = raw.slice(0, maxLen).map(function (v) { return sanitizeEnum(v, whitelist, whitelist[0]); });
    } else {
      arr = fallback.slice();
    }
    while (arr.length < minLen) arr.push(fallback[arr.length % fallback.length]);
    return arr.slice(0, maxLen);
  }

  var ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,60}$/;
  function sanitizeId(raw, fallback) {
    return (typeof raw === 'string' && ID_RE.test(raw)) ? raw : fallback;
  }

  /* Deterministic, pure hash of a def's visual content — used only to
     namespace internal element ids so several tiles can be inlined on the
     same page without id collisions in their <defs>/<use>. */
  function hashDef(d) {
    var s;
    try {
      s = d.family + '|' + d.palette.join(',') + '|' + JSON.stringify(d.params);
    } catch (e) {
      s = String(d.family) + '|fallback';
    }
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  /* ============ SEEDED PRNG (mulberry32) ============ */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedToInt(seed) {
    if (isFiniteNum(seed)) return seed >>> 0;
    var s = String(seed == null ? 'ka-print' : seed);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
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

  var SYMBOLS = [
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

  var SYMBOLS_BY_ID = {};
  SYMBOLS.forEach(function (s) { SYMBOLS_BY_ID[s.id] = s; });

  function symbolIndex(id) {
    for (var i = 0; i < SYMBOLS.length; i++) { if (SYMBOLS[i].id === id) return i; }
    return 0;
  }

  function symbols() {
    return SYMBOLS.map(function (s) {
      return { id: s.id, name: s.name, meaning: s.meaning, path: s.path };
    });
  }

  /* ============ DEFAULTS ============ */

  var DEFAULT_DEFS = {
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

  function cloneParams(family, p) {
    if (family === 'kente') {
      return { strips: p.strips, bandHeights: p.bandHeights.slice(), blockMotifs: p.blockMotifs.slice(), weftLines: p.weftLines };
    }
    var out = {};
    for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k]; }
    return out;
  }

  function defaults(family) {
    var f = FAMILIES.indexOf(family) !== -1 ? family : 'kente';
    var d = DEFAULT_DEFS[f];
    return { family: d.family, name: d.name, palette: d.palette.slice(), params: cloneParams(f, d.params) };
  }

  /* ============ SANITIZE ============ */

  function sanitizeParams(family, raw, dflt) {
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

  function sanitize(def) {
    var family = (def && FAMILIES.indexOf(def.family) !== -1) ? def.family : 'kente';
    var dflt = DEFAULT_DEFS[family];
    var name = sanitizeName(def && def.name);
    var palette = sanitizePalette(def && def.palette, dflt.palette);
    var rawParams = (def && typeof def.params === 'object' && def.params) ? def.params : {};
    var params = sanitizeParams(family, rawParams, dflt.params);
    return { family: family, name: name, palette: palette, params: params };
  }

  /* ============ KENTE RENDERER ============ */

  function kenteMotif(type, x, y, w, h, color) {
    var cx = r2(x + w / 2), cy = r2(y + h / 2);
    if (type === 'checker') {
      var hw = r2(w / 2), hh = r2(h / 2);
      return '<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + hw + '" height="' + hh + '" fill="' + color + '"/>' +
             '<rect x="' + r2(x + hw) + '" y="' + r2(y + hh) + '" width="' + hw + '" height="' + hh + '" fill="' + color + '"/>';
    }
    if (type === 'steps') {
      var s = r2(h / 3);
      return '<rect x="' + r2(x) + '" y="' + r2(y + h - s) + '" width="' + r2(w / 3) + '" height="' + s + '" fill="' + color + '"/>' +
             '<rect x="' + r2(x + w / 3) + '" y="' + r2(y + h - 2 * s) + '" width="' + r2(w / 3) + '" height="' + r2(2 * s) + '" fill="' + color + '"/>' +
             '<rect x="' + r2(x + 2 * w / 3) + '" y="' + r2(y) + '" width="' + r2(w / 3) + '" height="' + r2(h) + '" fill="' + color + '"/>';
    }
    if (type === 'diamond') {
      return '<polygon points="' + cx + ',' + r2(y) + ' ' + r2(x + w) + ',' + cy + ' ' + cx + ',' + r2(y + h) + ' ' + r2(x) + ',' + cy + '" fill="' + color + '"/>';
    }
    if (type === 'bars') {
      var bh = r2(h / 4);
      return '<rect x="' + r2(x) + '" y="' + r2(y + bh) + '" width="' + r2(w) + '" height="' + r2(bh * 0.6) + '" fill="' + color + '"/>' +
             '<rect x="' + r2(x) + '" y="' + r2(y + bh * 2.4) + '" width="' + r2(w) + '" height="' + r2(bh * 0.6) + '" fill="' + color + '"/>';
    }
    /* zigzag (default) */
    var pts = r2(x) + ',' + r2(y + h) + ' ' + r2(x + w * 0.25) + ',' + r2(y) + ' ' + r2(x + w * 0.5) + ',' + r2(y + h) + ' ' +
      r2(x + w * 0.75) + ',' + r2(y) + ' ' + r2(x + w) + ',' + r2(y + h);
    return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="' + Math.max(1, r2(w * 0.12)) +
      '" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function buildKente(d) {
    var p = d.params, pal = d.palette;
    var strips = p.strips, bandHs = p.bandHeights, motifs = p.blockMotifs, weft = p.weftLines;
    var tileH = r2(bandHs.reduce(function (a, b) { return a + b; }, 0));
    var tileW = r2(strips * STRIP_W);
    var body = '';
    for (var i = 0; i < strips; i++) {
      var x = r2(i * STRIP_W);
      var baseColor = pal[i % pal.length];
      body += '<rect x="' + x + '" y="0" width="' + STRIP_W + '" height="' + tileH + '" fill="' + baseColor + '"/>';
      var y = 0;
      for (var j = 0; j < bandHs.length; j++) {
        var bh = bandHs[j];
        var motif = motifs[(i + j) % motifs.length];
        var accent = pal[(i + j + 1) % pal.length];
        body += kenteMotif(motif, x, y, STRIP_W, bh, accent);
        y = r2(y + bh);
      }
    }
    if (weft > 0) {
      for (var k = 0; k < weft; k++) {
        var wy = r2((k + 0.5) * (tileH / weft));
        body += '<line x1="0" y1="' + wy + '" x2="' + tileW + '" y2="' + wy + '" stroke="' + pal[pal.length - 1] + '" stroke-width="0.6" opacity="0.18"/>';
      }
    }
    return { w: tileW, h: tileH, body: body };
  }

  /* ============ ANKARA RENDERER ============ */

  function ankaraDots(W, H, color) {
    var body = '', cols = 6, rows = 6, sx = W / cols, sy = H / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ox = (r % 2) ? sx / 2 : 0;
        var cx = r2(c * sx + sx / 2 + ox);
        if (cx > W) cx = r2(cx - W);
        var cy = r2(r * sy + sy / 2);
        body += '<circle cx="' + cx + '" cy="' + cy + '" r="1.4" fill="' + color + '" opacity="0.4"/>';
      }
    }
    return body;
  }

  var CRACKLE_LINES = [
    [2, 10, 30, 25, 15, 55, 40, 70],
    [70, 5, 55, 35, 85, 50, 60, 90],
    [10, 80, 35, 95, 5, 110, 25, 118],
    [90, 15, 110, 40, 95, 65, 115, 85],
    [45, 2, 60, 20, 40, 38, 65, 55],
    [20, 95, 45, 105, 15, 118, 50, 118]
  ];
  function ankaraCrackle(color) {
    var body = '';
    for (var i = 0; i < CRACKLE_LINES.length; i++) {
      var a = CRACKLE_LINES[i];
      body += '<path d="M' + a[0] + ',' + a[1] + ' L' + a[2] + ',' + a[3] + ' L' + a[4] + ',' + a[5] + ' L' + a[6] + ',' + a[7] +
        '" fill="none" stroke="' + color + '" stroke-width="0.5" opacity="0.35" stroke-linecap="round"/>';
    }
    return body;
  }

  function ankaraMotif(type, cx, cy, r, fill, stroke, outline) {
    r = Math.max(4, r2(r));
    var sw = outline ? ' stroke="' + stroke + '" stroke-width="' + Math.max(0.6, r2(r * 0.05)) + '"' : ' stroke="none"';
    var body = '', i;
    if (type === 'fans') {
      var n = 5, a0 = -90;
      for (i = 0; i < n; i++) {
        var a1 = (a0 + i * (180 / n)) * Math.PI / 180;
        var a2 = (a0 + (i + 1) * (180 / n)) * Math.PI / 180;
        var x1 = r2(cx + r * Math.cos(a1)), y1 = r2(cy + r * Math.sin(a1));
        var x2 = r2(cx + r * Math.cos(a2)), y2 = r2(cy + r * Math.sin(a2));
        body += '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 0 1 ' + x2 + ',' + y2 +
          ' Z" fill="' + fill + '"' + sw + ' opacity="' + (i % 2 ? 0.55 : 0.85) + '"/>';
      }
      return body;
    }
    if (type === 'petals') {
      var pn = 6;
      for (i = 0; i < pn; i++) {
        var ang = r2(i * (360 / pn));
        body += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r2(r * 0.42) + '" ry="' + r2(r * 0.95) + '" fill="' + fill + '"' + sw +
          ' opacity="0.8" transform="rotate(' + ang + ' ' + cx + ' ' + cy + ')"/>';
      }
      return body + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.22) + '" fill="' + stroke + '"/>';
    }
    if (type === 'waves') {
      for (i = 1; i <= 3; i++) {
        var rr = r2(r * i / 3);
        body += '<path d="M' + r2(cx - rr) + ',' + cy + ' Q' + cx + ',' + r2(cy - rr * 0.6) + ' ' + r2(cx + rr) + ',' + cy +
          '" fill="none" stroke="' + fill + '" stroke-width="' + r2(Math.max(0.8, r * 0.06)) + '" opacity="' + r2(0.9 - i * 0.2) + '"/>';
      }
      return body;
    }
    if (type === 'suns') {
      body = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.4) + '" fill="' + fill + '"' + sw + '/>';
      var rays = 8;
      for (i = 0; i < rays; i++) {
        var rang = (i * (360 / rays)) * Math.PI / 180;
        var rx1 = r2(cx + Math.cos(rang) * r * 0.5), ry1 = r2(cy + Math.sin(rang) * r * 0.5);
        var rx2 = r2(cx + Math.cos(rang) * r), ry2 = r2(cy + Math.sin(rang) * r);
        body += '<line x1="' + rx1 + '" y1="' + ry1 + '" x2="' + rx2 + '" y2="' + ry2 + '" stroke="' + fill + '" stroke-width="' +
          r2(Math.max(0.8, r * 0.1)) + '" stroke-linecap="round"/>';
      }
      return body;
    }
    if (type === 'shells') {
      for (i = 1; i <= 4; i++) {
        var sr = r2(r * i / 4);
        body += '<path d="M' + r2(cx - sr) + ',' + cy + ' A' + sr + ',' + sr + ' 0 0 1 ' + r2(cx + sr) + ',' + cy +
          '" fill="none" stroke="' + fill + '" stroke-width="' + r2(Math.max(0.7, r * 0.05)) + '" opacity="' + r2(1 - i * 0.18) + '"/>';
      }
      return body;
    }
    /* rings (default) */
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" opacity="0.85"' + sw + '/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.62) + '" fill="none" stroke="' + stroke + '" stroke-width="' + r2(Math.max(0.8, r * 0.08)) + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.2) + '" fill="' + stroke + '"/>';
  }

  function buildAnkara(d) {
    var p = d.params, pal = d.palette;
    var W = ANKARA_TILE, H = ANKARA_TILE;
    var base = pal[0], accent = pal[1] || pal[0], line = pal[2] || pal[0], hi = pal[3] || accent;
    var body = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + base + '"/>';
    if (p.dotFill) body += ankaraDots(W, H, accent);
    if (p.crackle) body += ankaraCrackle(line);
    var centers = [[W / 2, H / 2], [0, 0], [W, 0], [0, H], [W, H]];
    for (var i = 0; i < centers.length; i++) {
      body += ankaraMotif(p.motif, centers[i][0], centers[i][1], 26 * p.scale, hi, line, p.outline);
    }
    return { w: W, h: H, body: body };
  }

  /* ============ ADINKRA RENDERER ============ */

  /* Frame shape drawn once at cell-local coordinates (0,0,size,size) so every
     cell can reuse it through <use> instead of repeating the path. */
  function adinkraFrameShape(type, size, color) {
    if (type === 'box') {
      var inset = 2;
      return '<rect x="' + r2(inset) + '" y="' + r2(inset) + '" width="' + r2(size - inset * 2) + '" height="' + r2(size - inset * 2) +
        '" fill="none" stroke="' + color + '" stroke-width="0.8" opacity="0.7"/>';
    }
    if (type === 'comb') {
      var n = 4, step = r2(size / n), d = '';
      for (var i = 0; i < n; i++) {
        var tx = r2(i * step + step / 2);
        d += 'M' + tx + ',0 l0,4 M' + tx + ',' + r2(size) + ' l0,-4 ';
      }
      return '<path d="' + d.trim() + '" stroke="' + color + '" stroke-width="0.8" fill="none" opacity="0.7"/>';
    }
    return '';
  }

  function buildAdinkra(d) {
    var p = d.params, pal = d.palette;
    var density = p.density;
    var W = r2(density * CELL), H = W;
    var base = pal[0], ink = pal[1] || pal[0], accent = pal[2] || ink;
    var sym = SYMBOLS_BY_ID[p.symbol] || SYMBOLS[0];
    var altSym = p.alternate ? SYMBOLS[(symbolIndex(p.symbol) + 1) % SYMBOLS.length] : null;
    var ns = hashDef(d);
    var idA = 'ka-sym-' + ns + '-a', idB = 'ka-sym-' + ns + '-b';
    var frameShape = adinkraFrameShape(p.frame, CELL, accent);
    var idF = 'ka-frame-' + ns;
    var defs = '<defs><path id="' + idA + '" d="' + sym.path + '"/>' +
      (altSym ? '<path id="' + idB + '" d="' + altSym.path + '"/>' : '') +
      (frameShape ? '<g id="' + idF + '">' + frameShape + '</g>' : '') + '</defs>';
    var body = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + base + '"/>' + defs;
    var pad = 6, s = r2((CELL - pad * 2) / 100);
    for (var r = 0; r < density; r++) {
      for (var c = 0; c < density; c++) {
        var x = r2(c * CELL), y = r2(r * CELL);
        var useAlt = p.alternate && ((r + c) % 2 === 1);
        var refId = useAlt ? idB : idA;
        var rot = (useAlt && p.rotateAlt) ? ' rotate(180 50 50)' : '';
        var tx = r2(x + pad), ty = r2(y + pad);
        if (frameShape) body += '<use href="#' + idF + '" x="' + x + '" y="' + y + '"/>';
        body += '<use href="#' + refId + '" transform="translate(' + tx + ',' + ty + ') scale(' + s + ')' + rot +
          '" stroke="' + ink + '" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      }
    }
    return { w: W, h: H, body: body };
  }

  /* ============ TILE DISPATCH + PUBLIC RENDER API ============ */

  function buildTile(d) {
    if (d.family === 'ankara') return buildAnkara(d);
    if (d.family === 'adinkra') return buildAdinkra(d);
    return buildKente(d);
  }

  function tileSvg(def, opts) {
    var d = sanitize(def);
    var tile = buildTile(d);
    var o = opts || {};
    var size = isFiniteNum(o.size) ? clampF(o.size, 8, 4000) : null;
    var w = size ? r2(size) : tile.w;
    var h = size ? r2(size * (tile.h / tile.w)) : tile.h;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + tile.w + ' ' + tile.h + '" width="' + w + '" height="' + h + '">' +
      tile.body + '</svg>';
  }

  function patternDef(def, opts) {
    var d = sanitize(def);
    var tile = buildTile(d);
    var o = opts || {};
    var scale = isFiniteNum(o.scale) ? clampF(o.scale, 0.1, 8) : 1;
    var rotate = isFiniteNum(o.rotate) ? ((o.rotate % 360) + 360) % 360 : 0;
    var pid = sanitizeId(o.id, 'ka-pattern-' + hashDef(d));
    var pw = r2(tile.w * scale), ph = r2(tile.h * scale);
    var transform = rotate ? ' patternTransform="rotate(' + r2(rotate) + ')"' : '';
    return '<pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="' + pw + '" height="' + ph + '"' + transform + '>' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + tile.w + ' ' + tile.h + '" width="' + pw + '" height="' + ph + '">' +
      tile.body + '</svg></pattern>';
  }

  function dataUri(def, opts) {
    var svg = tileSvg(def, opts);
    return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
  }

  /* ============ RANDOMIZE ============ */

  function randomName(family, rng) {
    var A = ['MIDNIGHT', 'GOLDLINE', 'BERRY', 'FOREST', 'COBALT', 'SMOKED', 'QUIET', 'BOLD', 'ANTIQUE', 'DUSK'];
    var N = { kente: ['WARP', 'WEAVE', 'STRIP', 'LOOM'], ankara: ['BLOOM', 'WAX', 'RIPPLE', 'CRACKLE'], adinkra: ['STAMP', 'BLOCK', 'GLYPH', 'PROVERB'] };
    var a = A[Math.floor(rng() * A.length)];
    var pool = N[family] || N.kente;
    var n = pool[Math.floor(rng() * pool.length)];
    return a + ' ' + n + ' REMIX';
  }

  function randomize(def, seed) {
    var base = (def && FAMILIES.indexOf(def.family) !== -1) ? def.family : 'kente';
    var rng = mulberry32(seedToInt(seed));
    function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

    var paletteSet = HOUSE_PALETTES[base];
    var palette = pick(paletteSet).slice();
    var params, i;

    if (base === 'ankara') {
      params = {
        motif: pick(ANKARA_MOTIFS),
        scale: r2(0.7 + rng() * 1.1),
        outline: rng() > 0.4,
        dotFill: rng() > 0.3,
        crackle: rng() > 0.5
      };
    } else if (base === 'adinkra') {
      var ids = SYMBOLS.map(function (s) { return s.id; });
      params = {
        symbol: pick(ids),
        density: 2 + Math.floor(rng() * 4),
        frame: pick(ADINKRA_FRAMES),
        alternate: rng() > 0.5,
        rotateAlt: rng() > 0.5
      };
    } else {
      var strips = 4 + Math.floor(rng() * 5);
      var bandCount = 2 + Math.floor(rng() * 4);
      var bandHeights = [];
      for (i = 0; i < bandCount; i++) bandHeights.push(r2(6 + rng() * 14));
      var mc = 2 + Math.floor(rng() * 3);
      var blockMotifs = [];
      for (i = 0; i < mc; i++) blockMotifs.push(pick(KENTE_MOTIFS));
      params = { strips: strips, bandHeights: bandHeights, blockMotifs: blockMotifs, weftLines: Math.floor(rng() * 10) };
    }

    var name = randomName(base, rng);
    return sanitize({ family: base, name: name, palette: palette, params: params });
  }

  /* House palette combinations randomize() draws from — every entry is a
     valid hex so sanitize() always passes them through unchanged. */
  var HOUSE_PALETTES = {
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

  function mkBuiltin(id, name, family, maker, palette, params, meaning) {
    var def = sanitize({ family: family, name: name, palette: palette, params: params });
    return { id: id, name: name, family: family, maker: maker, meaning: meaning, def: def };
  }

  var BUILTINS = [
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

  var BUILTINS_BY_ID = {};
  BUILTINS.forEach(function (b) { BUILTINS_BY_ID[b.id] = b; });

  function cloneEntry(e) {
    return { id: e.id, name: e.name, family: e.family, maker: e.maker, meaning: e.meaning, def: e.def };
  }

  function list() {
    return BUILTINS.map(cloneEntry);
  }

  /* ============ SAVED (localStorage 'ka_prints') ============ */

  function hasLocalStorage() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; }
    catch (e) { return false; }
  }

  function genId() {
    return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  var SAVED_ID_RE = /^c_[a-z0-9]+$/i;

  function readSaved() {
    if (!hasLocalStorage()) return [];
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var rows = JSON.parse(raw);
      if (!Array.isArray(rows)) return [];
      return rows.map(function (entry) {
        var d = sanitize(entry && entry.def);
        var id = (entry && typeof entry.id === 'string' && SAVED_ID_RE.test(entry.id)) ? entry.id : genId();
        return { id: id, name: d.name, family: d.family, maker: null, meaning: null, def: d };
      });
    } catch (e) { return []; }
  }

  function writeSaved(rows) {
    if (!hasLocalStorage()) return false;
    try {
      var slim = rows.map(function (e) { return { id: e.id, def: e.def }; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      return true;
    } catch (e) { return false; }
  }

  var saved = {
    list: function () { return readSaved(); },
    save: function (def) {
      var d = sanitize(def);
      var rows = readSaved();
      var entry = { id: genId(), name: d.name, family: d.family, maker: null, meaning: null, def: d };
      rows.push(entry);
      writeSaved(rows);
      return entry;
    },
    remove: function (id) {
      var rows = readSaved();
      var next = rows.filter(function (e) { return e.id !== id; });
      if (next.length === rows.length) return false;
      return writeSaved(next);
    }
  };

  /* ============ GET ============ */

  function get(id) {
    if (typeof id !== 'string') return null;
    var b = BUILTINS_BY_ID[id];
    if (b) return cloneEntry(b);
    var rows = readSaved();
    for (var i = 0; i < rows.length; i++) { if (rows[i].id === id) return rows[i]; }
    return null;
  }

  /* ============ PUBLIC API ============ */

  var KA_PRINTS = {
    list: list,
    get: get,
    defaults: defaults,
    tileSvg: tileSvg,
    patternDef: patternDef,
    dataUri: dataUri,
    randomize: randomize,
    symbols: symbols,
    sanitize: sanitize,
    saved: saved
  };

  if (typeof window !== 'undefined') { window.KA_PRINTS = KA_PRINTS; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = KA_PRINTS; }
}());
