/* ============================================================
   KHARIS & ALETHEIA — TEE STUDIO
   "Pick a print, place it your way, scale it, rotate it.
    We cut and sew your exact layout."

   Owns: studio.html, studio.css, studio.js
   Consumes: KA_CONFIG.studio, KA_CORE, KA_PRINTS, KA_PRODUCTS(none), kaCart, kaToast
   Classic script — no ES modules, must run from file://.
   ============================================================ */
(function () {
  'use strict';

  var CFG   = window.KA_CONFIG && window.KA_CONFIG.studio;
  var CORE  = window.KA_CORE;
  var PRINTS = window.KA_PRINTS;
  /* esc is a function, not a direct property read, so this line can never throw
     even if core.js failed to load — the missing-dependency guard below is what
     actually stops the page, with a visible message instead of a silent crash. */
  function esc(s) { return CORE && CORE.escapeHtml ? CORE.escapeHtml(s == null ? '' : String(s)) : (s == null ? '' : String(s)); }

  var STORAGE_KEY = 'ka_studio';
  var VB_W = 400, VB_H = 520;

  /* ============================================================
     1. GARMENT GEOMETRY — flat vector silhouettes
     One shared coordinate system (viewBox 0 0 400 520) so every
     placement region can be expressed as a clip path in the same
     space, front and back.
     ============================================================ */
  var GEO = {
    torso: {
      /* tee + long-sleeve: softer, closer drape */
      fitted: {
        front: 'M168,94 L120,102 C104,106 94,120 90,142 L84,180 C78,240 74,300 72,360 L70,420 L330,420 L328,360 C326,300 322,240 316,180 L310,142 C306,120 296,106 280,102 L232,94 C222,110 212,118 200,120 C188,118 178,110 168,94 Z',
        back:  'M160,96 L120,102 C104,106 94,120 90,142 L84,180 C78,240 74,300 72,360 L70,420 L330,420 L328,360 C326,300 322,240 316,180 L310,142 C306,120 296,106 280,102 L240,96 C228,102 212,104 200,104 C188,104 172,102 160,96 Z'
      },
      /* crew + hoodie: boxier fleece drape */
      boxy: {
        front: 'M168,92 L116,100 C98,104 86,120 82,144 L76,182 C70,244 66,306 64,368 L62,420 L338,420 L336,368 C334,306 330,244 324,182 L318,144 C314,120 302,104 284,100 L232,92 C222,110 212,118 200,120 C188,118 178,110 168,92 Z',
        back:  'M158,94 L116,100 C98,104 86,120 82,144 L76,182 C70,244 66,306 64,368 L62,420 L338,420 L336,368 C334,306 330,244 324,182 L318,144 C314,120 302,104 284,100 L242,94 C228,100 212,102 200,102 C188,102 172,100 158,94 Z'
      }
    },
    sleeve: {
      short: 'M120,102 C92,108 62,120 42,144 C30,160 24,176 24,192 L50,206 C62,196 76,188 90,182 L90,142 C94,120 104,106 120,102 Z',
      longFitted: 'M120,102 C90,110 56,126 36,152 C22,172 16,196 16,222 C16,270 20,320 28,364 C32,384 38,400 46,412 L76,406 C70,382 66,356 64,328 C62,288 66,246 78,206 L90,182 L90,142 C94,120 104,106 120,102 Z',
      longBoxy: 'M116,100 C86,110 50,128 30,156 C16,176 10,200 10,226 C10,274 14,324 22,368 C26,388 32,404 40,416 L72,410 C66,386 62,360 60,332 C58,292 62,248 74,208 L86,184 L82,144 C86,120 98,104 116,100 Z'
    },
    cuff: {
      fitted: 'M40,398 L76,392 L78,416 L44,422 Z',
      boxy:   'M36,402 L72,396 L74,420 L40,426 Z'
    },
    hemBand: {
      fitted: 'M70,398 L330,398 L330,420 L70,420 Z',
      boxy:   'M62,398 L338,398 L338,420 L62,420 Z'
    },
    collarRib: 'M172,86 C182,96 190,100 200,100 C210,100 218,96 228,86 C233,95 233,107 226,114 C213,122 187,122 174,114 C167,107 167,95 172,86 Z',
    collarPlain: {
      front: 'M168,94 C178,110 188,118 200,120 C212,118 222,110 232,94',
      back:  'M160,96 C172,102 188,104 200,104 C212,104 228,102 240,96'
    },
    hood: {
      front: 'M138,100 C126,66 152,36 200,34 C248,36 274,66 262,100 C250,88 228,82 200,82 C172,82 150,88 138,100 Z',
      back:  'M128,112 C116,58 154,24 200,22 C246,24 284,58 272,112 C278,142 266,168 248,180 L152,180 C134,168 122,142 128,112 Z'
    },
    pocket: {
      hoodie: 'M140,284 C162,274 238,274 260,284 L263,338 C263,347 255,354 246,354 L154,354 C145,354 137,347 137,338 Z',
      plain:  'M170,246 C182,240 198,240 210,246 L212,282 C212,290 206,296 198,296 L182,296 C174,296 168,290 168,282 Z'
    },
    drawcord: { L: 'M188,96 C184,114 182,134 184,160', R: 'M212,96 C216,114 218,134 216,160' },
    aglet: { L: { cx: 184, cy: 161 }, R: { cx: 216, cy: 161 } }
  };

  var PLACEMENT_BOUNDS = {
    chest:    'M154,148 L246,148 L246,238 L154,238 Z',
    diagonal: 'M104,150 L182,150 L298,404 L220,404 Z',
    stripeL:  'M56,150 L100,150 L92,420 L48,420 Z',
    stripeR:  'M300,150 L344,150 L352,420 L308,420 Z'
  };

  /* front-only placements: on the back view the print does not appear there */
  var FRONT_ONLY_PLACEMENTS = { chest: true, diagonal: true, pocket: true };

  function isBoxy(garmentId) { return garmentId === 'crew' || garmentId === 'hoodie'; }
  function isLongSleeve(garmentId) { return garmentId !== 'tee'; }

  function mirrorPath(d, cx) {
    var mirrored = d.replace(/([MLC])\s*([^MLCZ]*)/g, function (m, cmd, nums) {
      var vals = nums.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      var out = [];
      for (var i = 0; i < vals.length; i += 2) {
        out.push((2 * cx - vals[i]).toFixed(2), vals[i + 1]);
      }
      return cmd + ' ' + out.join(' ');
    });
    /* a bare command letter can immediately follow a number in valid SVG path data (e.g. "10L20"),
       but a explicit space is friendlier to read/debug — normalise it in. */
    return mirrored.replace(/([0-9])([MLCZ])/g, '$1 $2');
  }

  function bodyPath(garmentId, view) {
    return isBoxy(garmentId) ? GEO.torso.boxy[view] : GEO.torso.fitted[view];
  }
  function sleevePathL(garmentId) {
    if (garmentId === 'tee') return GEO.sleeve.short;
    return isBoxy(garmentId) ? GEO.sleeve.longBoxy : GEO.sleeve.longFitted;
  }
  function sleevePathR(garmentId) { return mirrorPath(sleevePathL(garmentId), 200); }

  function shade(hex, amt) {
    var c = (hex || '#888888').replace('#', '');
    if (c.length === 3) c = c.split('').map(function (ch) { return ch + ch; }).join('');
    var num = parseInt(c, 16) || 0x888888;
    var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    function adj(v) { v = amt < 0 ? v * (1 + amt) : v + (255 - v) * amt; return Math.max(0, Math.min(255, Math.round(v))); }
    r = adj(r); g = adj(g); b = adj(b);
    return '#' + [r, g, b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  /* ============================================================
     2. STATE — persisted to localStorage + mirrored in location.hash
     ============================================================ */
  function defaultDesign() {
    var g0 = CFG.garments[0], c0 = CFG.colours[0], pl0 = CFG.placements[0];
    var prints = PRINTS.list() || [];
    return {
      garment: g0.id, colour: c0.id,
      printId: prints.length ? prints[0].id : '',
      placement: pl0.id,
      scale: 1, rotate: 0, x: 0, y: 0,
      view: 'front'
    };
  }
  function defaultState() {
    return { design: defaultDesign(), size: pickDefaultSize(), qty: 1 };
  }
  function pickDefaultSize() {
    var sizes = CFG.sizes || ['M'];
    return sizes.indexOf('M') > -1 ? 'M' : sizes[Math.floor(sizes.length / 2)];
  }
  function inList(list, id) { return list.some(function (o) { return o.id === id; }); }
  function clampNum(v, lo, hi, dflt) {
    v = parseFloat(v);
    if (!isFinite(v)) return dflt;
    return Math.min(hi, Math.max(lo, v));
  }

  var lastFallbackNotice = '';

  function sanitizeDesign(raw, fallback) {
    var d = fallback || defaultDesign();
    var out = {};
    out.garment = raw && inList(CFG.garments, raw.garment) ? raw.garment : d.garment;
    out.colour = raw && inList(CFG.colours, raw.colour) ? raw.colour : d.colour;
    if (raw && raw.printId && PRINTS.get(raw.printId)) {
      out.printId = raw.printId;
    } else if (raw && raw.printId) {
      lastFallbackNotice = 'That print is no longer available — showing a default print instead.';
      out.printId = d.printId;
    } else {
      out.printId = d.printId;
    }
    out.placement = raw && inList(CFG.placements, raw.placement) ? raw.placement : d.placement;
    out.scale = clampNum(raw && raw.scale, 0.4, 2.5, d.scale);
    var rot = clampNum(raw && raw.rotate, -100000, 100000, d.rotate);
    out.rotate = ((Math.round(rot) % 360) + 360) % 360;
    out.x = Math.round(clampNum(raw && raw.x, -200, 200, d.x));
    out.y = Math.round(clampNum(raw && raw.y, -200, 200, d.y));
    out.view = raw && (raw.view === 'front' || raw.view === 'back') ? raw.view : d.view;
    return out;
  }
  function sanitizeSize(v) { return v && CFG.sizes.indexOf(v) > -1 ? v : pickDefaultSize(); }
  function sanitizeQty(v) { var n = parseInt(v, 10); if (!isFinite(n)) return 1; return Math.min(20, Math.max(1, n)); }

  function readStorage() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || typeof raw !== 'object') return null;
      return {
        design: sanitizeDesign(raw.design, defaultDesign()),
        size: sanitizeSize(raw.size),
        qty: sanitizeQty(raw.qty)
      };
    } catch (e) { return null; }
  }

  function parseHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return null;
    var p;
    try { p = new URLSearchParams(h); } catch (e) { return null; }
    if (p.has('print') && !p.has('g')) return { printOverride: p.get('print') };
    if (!p.has('g')) return null;
    return {
      design: {
        garment: p.get('g'), colour: p.get('c'), printId: p.get('p'), placement: p.get('pl'),
        scale: p.get('sc'), rotate: p.get('rt'), x: p.get('x'), y: p.get('y'), view: p.get('v')
      },
      size: p.get('sz'), qty: p.get('q')
    };
  }

  function loadState() {
    var stored = readStorage();
    var base = stored || defaultState();
    var h = parseHash();
    if (h && h.printOverride) {
      base = { design: JSON.parse(JSON.stringify(base.design)), size: base.size, qty: base.qty };
      base.design = sanitizeDesign({ printId: h.printOverride, garment: base.design.garment, colour: base.design.colour, placement: base.design.placement, scale: base.design.scale, rotate: base.design.rotate, x: base.design.x, y: base.design.y, view: base.design.view }, base.design);
      return base;
    }
    if (h && h.design) {
      return { design: sanitizeDesign(h.design, defaultDesign()), size: sanitizeSize(h.size), qty: sanitizeQty(h.qty) };
    }
    return base;
  }

  function encodeHash(st) {
    var p = new URLSearchParams();
    p.set('g', st.design.garment);
    p.set('c', st.design.colour);
    p.set('p', st.design.printId);
    p.set('pl', st.design.placement);
    p.set('sc', st.design.scale.toFixed(2));
    p.set('rt', Math.round(st.design.rotate));
    p.set('x', Math.round(st.design.x));
    p.set('y', Math.round(st.design.y));
    p.set('v', st.design.view);
    p.set('sz', st.size);
    p.set('q', st.qty);
    return '#' + p.toString();
  }

  function persist(st) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable — hash still carries state */ }
    var newHash = encodeHash(st);
    if (location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }
  }

  /* ---------- undo stack ---------- */
  var undoStack = [];
  function snapshot() { return JSON.stringify(state); }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 50) undoStack.shift();
    renderUndoButton();
  }
  function doUndo() {
    if (!undoStack.length) return;
    var prev = undoStack.pop();
    state = JSON.parse(prev);
    persist(state);
    renderAll();
  }
  function renderUndoButton() {
    var b = document.getElementById('btnUndo');
    if (b) b.disabled = undoStack.length === 0;
  }

  /* Not loadState() here — that touches CFG.garments/PRINTS.list() immediately,
     which would throw at parse time if config.js/prints.js failed to load.
     Assigned inside boot(), behind the dependency guard, below. */
  var state;

  /* ============================================================
     3. SVG BUILD
     ============================================================ */
  function regionInfo(garmentId, view, placementId) {
    var body = bodyPath(garmentId, view);
    var sleeveL = sleevePathL(garmentId), sleeveR = sleevePathR(garmentId);
    switch (placementId) {
      case 'sleeves':
        return { shapes: [sleeveL, sleeveR], bound: null, frontOnly: false };
      case 'allover': {
        var shapes = [body, sleeveL, sleeveR];
        if (garmentId === 'hoodie') shapes.push(GEO.hood[view]);
        return { shapes: shapes, bound: null, frontOnly: false };
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

  function bandTexture(clipId, x, y, w, h, lines, angle) {
    var out = ['<g clip-path="url(#' + clipId + ')" stroke="rgba(0,0,0,.28)" stroke-width="1.2" opacity=".55">'];
    for (var i = 0; i < lines; i++) {
      var ly = y + (h * (i + 0.5)) / lines;
      out.push('<line x1="' + (x - 10) + '" y1="' + ly + '" x2="' + (x + w + 10) + '" y2="' + (ly + angle) + '"/>');
    }
    out.push('</g>');
    return out.join('');
  }

  /**
   * Builds the full <svg> markup for the current design.
   * @param {object} design
   * @param {object} opts { thumb: boolean } — thumb strips shading/stitching to stay tiny
   */
  function buildSvg(design, opts) {
    opts = opts || {};
    var view = opts.forceView || design.view;
    var g = design.garment, colourObj = CFG.colours.find(function (c) { return c.id === design.colour; });
    var hex = colourObj ? colourObj.hex : '#888888';
    var printDef = null, printObj = PRINTS.get(design.printId);
    if (printObj) printDef = printObj.def;

    var body = bodyPath(g, view);
    var sleeveL = sleevePathL(g), sleeveR = sleevePathR(g);
    var boxy = isBoxy(g);
    var hem = boxy ? GEO.hemBand.boxy : GEO.hemBand.fitted;
    var cuffL = boxy ? GEO.cuff.boxy : GEO.cuff.fitted;
    var cuffR = mirrorPath(cuffL, 200);
    var hasRib = boxy && g !== 'hoodie'; /* crew: rib collar/cuffs/hem. hoodie: hood instead of rib collar, but ribbed cuffs/hem */
    var hasHood = g === 'hoodie';

    var region = regionInfo(g, view, design.placement);
    var showPrint = printDef && !(region.frontOnly && view === 'back');

    var uid = 'p' + Math.random().toString(36).slice(2, 8);
    var defs = [];
    var body_id = 'b_' + uid;

    /* --- clip: garment region (first clip) --- */
    var regionClipId = 'clipR_' + uid;
    defs.push('<clipPath id="' + regionClipId + '">' + region.shapes.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</clipPath>');

    /* --- clip: placement bound (second clip, optional) --- */
    var boundClipId = null;
    if (region.bound) {
      boundClipId = 'clipB_' + uid;
      defs.push('<clipPath id="' + boundClipId + '">' + region.bound.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</clipPath>');
    }

    /* --- whole-garment clip, used for the fabric-shading overlay --- */
    var garmentShapes = [body, sleeveL, sleeveR];
    if (hasHood) garmentShapes.push(GEO.hood[view]);
    var garmentClipId = 'clipG_' + uid;
    defs.push('<clipPath id="' + garmentClipId + '">' + garmentShapes.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</clipPath>');

    var hemClipId = 'clipHem_' + uid, cuffLClipId = 'clipCuffL_' + uid, cuffRClipId = 'clipCuffR_' + uid, collarClipId = 'clipCol_' + uid;
    if (hasRib || hasHood) {
      defs.push('<clipPath id="' + hemClipId + '"><path d="' + hem + '"/></clipPath>');
      defs.push('<clipPath id="' + cuffLClipId + '"><path d="' + cuffL + '"/></clipPath>');
      defs.push('<clipPath id="' + cuffRClipId + '"><path d="' + cuffR + '"/></clipPath>');
    }
    if (hasRib) defs.push('<clipPath id="' + collarClipId + '"><path d="' + GEO.collarRib + '"/></clipPath>');

    /* --- print pattern: base def from prints.js, offset wrapper for drag position --- */
    var patBaseId = 'patBase_' + uid, patOffsetId = 'patOffset_' + uid;
    if (printDef) {
      defs.push(PRINTS.patternDef(printDef, { id: patBaseId, scale: design.scale, rotate: design.rotate }));
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

    var out = [];
    out.push('<svg viewBox="0 0 ' + VB_W + ' ' + VB_H + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-labelledby="' + body_id + 't">');
    out.push('<title id="' + body_id + 't">' + esc(describeDesign(design, view)) + '</title>');
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
      if (hasRib || hasHood) { out.push('<path d="' + hem + '"/><path d="' + cuffL + '"/><path d="' + cuffR + '"/>'); }
      if (hasHood && view === 'front') out.push('<path d="' + GEO.pocket.hoodie + '"/>');
      out.push('</g>');
    }

    /* drawcords (hoodie, front) — drawn last, on top */
    if (hasHood && view === 'front') {
      var cord = shade(hex, -0.4), aglet = shade(hex, -0.55);
      out.push('<path d="' + GEO.drawcord.L + '" fill="none" stroke="' + cord + '" stroke-width="4" stroke-linecap="round"/>');
      out.push('<path d="' + GEO.drawcord.R + '" fill="none" stroke="' + cord + '" stroke-width="4" stroke-linecap="round"/>');
      out.push('<circle cx="' + GEO.aglet.L.cx + '" cy="' + GEO.aglet.L.cy + '" r="4" fill="' + aglet + '"/>');
      out.push('<circle cx="' + GEO.aglet.R.cx + '" cy="' + GEO.aglet.R.cy + '" r="4" fill="' + aglet + '"/>');
    }

    out.push('</svg>');
    return out.join('');
  }

  function describeDesign(design, view) {
    var g = CFG.garments.find(function (x) { return x.id === design.garment; });
    var c = CFG.colours.find(function (x) { return x.id === design.colour; });
    var pl = CFG.placements.find(function (x) { return x.id === design.placement; });
    var pr = PRINTS.get(design.printId);
    var bits = [g ? g.name : design.garment, c ? c.name : design.colour];
    if (pr) bits.push('with ' + pr.name + ' print at ' + (pl ? pl.name.toLowerCase() : design.placement));
    bits.push(view === 'back' ? 'back view' : 'front view');
    return bits.join(', ');
  }

  /* ============================================================
     4. RENDER
     ============================================================ */
  function garmentOf(id) { return CFG.garments.find(function (x) { return x.id === id; }); }
  function colourOf(id) { return CFG.colours.find(function (x) { return x.id === id; }); }
  function placementOf(id) { return CFG.placements.find(function (x) { return x.id === id; }); }

  var activeFamily = 'all';

  function renderAll() {
    renderNotice();
    renderStage();
    renderGarmentStep();
    renderColourStep();
    renderPrintStep();
    renderPlacementStep();
    renderFineTuneStep();
    renderSizeStep();
    renderPriceBar();
    renderSpecSheet();
    renderUndoButton();
    persist(state);
  }

  function renderNotice() {
    var el = document.getElementById('linkNotice');
    if (!el) return;
    if (lastFallbackNotice) {
      el.textContent = lastFallbackNotice;
      el.classList.add('show');
    } else {
      el.classList.remove('show');
      el.textContent = '';
    }
  }

  function renderStage() {
    var mount = document.getElementById('stageMount');
    if (!mount) return;
    mount.innerHTML = buildSvg(state.design, {});
    document.getElementById('btnViewFront').classList.toggle('on', state.design.view === 'front');
    document.getElementById('btnViewFront').setAttribute('aria-pressed', state.design.view === 'front');
    document.getElementById('btnViewBack').classList.toggle('on', state.design.view === 'back');
    document.getElementById('btnViewBack').setAttribute('aria-pressed', state.design.view === 'back');

    var note = document.getElementById('stageNote');
    if (note) {
      if (FRONT_ONLY_PLACEMENTS[state.design.placement] && state.design.view === 'back') {
        var pl = placementOf(state.design.placement);
        note.textContent = (pl ? pl.name : 'This print') + ' sits on the front — flip to Front to see it placed.';
      } else {
        note.textContent = '';
      }
    }
  }

  function cardMarkup(active, name, meta, price) {
    return '<span class="oc-name">' + esc(name) + '</span>' +
      (meta ? '<span class="oc-meta">' + esc(meta) + '</span>' : '') +
      (price != null ? '<span class="oc-price">' + esc(price) + '</span>' : '');
  }

  function renderGarmentStep() {
    var grid = document.getElementById('garmentGrid');
    if (!grid) return;
    grid.innerHTML = CFG.garments.map(function (g) {
      var on = g.id === state.design.garment;
      return '<button type="button" class="opt-card" data-garment="' + esc(g.id) + '" aria-pressed="' + on + '">' +
        cardMarkup(on, g.name, null, CORE.money(g.base) + ' base') + '</button>';
    }).join('');
    grid.querySelectorAll('[data-garment]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.garment === state.design.garment) return;
        pushUndo();
        state.design.garment = btn.dataset.garment;
        lastFallbackNotice = '';
        renderAll();
      });
    });
  }

  function renderColourStep() {
    var grid = document.getElementById('colourGrid');
    if (!grid) return;
    grid.innerHTML = CFG.colours.map(function (c) {
      var on = c.id === state.design.colour;
      return '<button type="button" class="colour-btn" data-colour="' + esc(c.id) + '" aria-pressed="' + on + '">' +
        '<span class="cs-swatch" style="background:' + esc(c.hex) + '"></span>' +
        '<span class="cs-name">' + esc(c.name) + '</span></button>';
    }).join('');
    grid.querySelectorAll('[data-colour]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.colour === state.design.colour) return;
        pushUndo();
        state.design.colour = btn.dataset.colour;
        renderAll();
      });
    });
  }

  function allPrints() {
    var built = PRINTS.list() || [];
    var saved = (PRINTS.saved && PRINTS.saved.list()) || [];
    return built.concat(saved);
  }
  function families() {
    var set = {};
    allPrints().forEach(function (p) { if (p.family) set[p.family] = true; });
    return Object.keys(set);
  }

  function renderPrintStep() {
    var tabs = document.getElementById('printTabs');
    var grid = document.getElementById('printGrid');
    if (!tabs || !grid) return;

    var fams = families();
    var tabHtml = ['<button type="button" class="pill' + (activeFamily === 'all' ? ' on' : '') + '" data-fam="all">All</button>'];
    fams.forEach(function (f) {
      tabHtml.push('<button type="button" class="pill' + (activeFamily === f ? ' on' : '') + '" data-fam="' + esc(f) + '">' + esc(f.charAt(0).toUpperCase() + f.slice(1)) + '</button>');
    });
    var savedList = (PRINTS.saved && PRINTS.saved.list()) || [];
    tabHtml.push('<button type="button" class="pill' + (activeFamily === 'mine' ? ' on' : '') + '" data-fam="mine">My prints (' + savedList.length + ')</button>');
    tabs.innerHTML = tabHtml.join('');
    tabs.querySelectorAll('[data-fam]').forEach(function (btn) {
      btn.addEventListener('click', function () { activeFamily = btn.dataset.fam; renderPrintStep(); });
    });

    var list;
    if (activeFamily === 'all') list = allPrints();
    else if (activeFamily === 'mine') list = savedList;
    else list = allPrints().filter(function (p) { return p.family === activeFamily; });

    if (activeFamily === 'mine' && !savedList.length) {
      grid.innerHTML = '';
      var empty = document.getElementById('printEmpty');
      empty.hidden = false;
    } else {
      var empty2 = document.getElementById('printEmpty');
      if (empty2) empty2.hidden = true;
      grid.innerHTML = list.map(function (p) {
        var on = p.id === state.design.printId;
        var uri = PRINTS.dataUri(p.def, { size: 120 });
        return '<button type="button" class="print-tile" data-print="' + esc(p.id) + '" aria-pressed="' + on + '">' +
          '<span class="pt-swatch" style="background-image:url(&quot;' + esc(uri) + '&quot;)"></span>' +
          '<span class="pt-name">' + esc(p.name) + '</span>' +
          (p.meaning ? '<span class="pt-meaning">' + esc(p.meaning) + '</span>' : '') +
          '</button>';
      }).join('');
    }
    grid.querySelectorAll('[data-print]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.print === state.design.printId) return;
        pushUndo();
        state.design.printId = btn.dataset.print;
        lastFallbackNotice = '';
        renderAll();
      });
    });
  }

  function renderPlacementStep() {
    var grid = document.getElementById('placementGrid');
    if (!grid) return;
    grid.innerHTML = CFG.placements.map(function (pl) {
      var on = pl.id === state.design.placement;
      return '<button type="button" class="opt-card" data-placement="' + esc(pl.id) + '" aria-pressed="' + on + '">' +
        cardMarkup(on, pl.name, null, pl.surcharge > 0 ? '+' + CORE.money(pl.surcharge) : 'Included') + '</button>';
    }).join('');
    grid.querySelectorAll('[data-placement]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.placement === state.design.placement) return;
        pushUndo();
        state.design.placement = btn.dataset.placement;
        renderAll();
      });
    });
  }

  function renderFineTuneStep() {
    var scaleInput = document.getElementById('ftScale');
    var rotateInput = document.getElementById('ftRotate');
    var scaleOut = document.getElementById('ftScaleOut');
    var rotateOut = document.getElementById('ftRotateOut');
    if (!scaleInput) return;
    scaleInput.value = state.design.scale;
    rotateInput.value = state.design.rotate;
    scaleOut.textContent = '×' + state.design.scale.toFixed(2);
    rotateOut.textContent = Math.round(state.design.rotate) + '°';
  }

  function renderSizeStep() {
    var grid = document.getElementById('sizeGrid');
    if (!grid) return;
    /* true radio-group semantics: native inputs get free keyboard support (arrow keys move
       the checked radio) and correct single-select ARIA for free — a pill is just the label. */
    grid.innerHTML = CFG.sizes.map(function (s, i) {
      var on = s === state.size;
      var id = 'size_' + i;
      return '<span class="pill size-pill' + (on ? ' on' : '') + '">' +
        '<input type="radio" name="studioSize" id="' + id + '" value="' + esc(s) + '"' + (on ? ' checked' : '') + '>' +
        '<label for="' + id + '">' + esc(s) + '</label></span>';
    }).join('');
    grid.querySelectorAll('input[name="studioSize"]').forEach(function (input) {
      input.addEventListener('change', function () {
        if (!input.checked || input.value === state.size) return;
        state.size = input.value;
        renderAll();
        document.getElementById('size_' + CFG.sizes.indexOf(state.size)).focus();
      });
    });
    document.getElementById('qtyValue').textContent = state.qty;
  }

  function computePrice() {
    return CORE.studioPrice(state.design);
  }

  function renderPriceBar() {
    var bar = document.getElementById('priceBreakdown');
    if (!bar) return;
    var g = garmentOf(state.design.garment), pl = placementOf(state.design.placement);
    var unit = computePrice();
    var total = unit * state.qty;
    bar.innerHTML =
      '<div class="pb-row"><span>' + esc(g ? g.name : '') + '</span><span>' + esc(CORE.money(g ? g.base : 0)) + '</span></div>' +
      '<div class="pb-row"><span>' + esc(pl ? pl.name : '') + '</span><span>' + (pl && pl.surcharge > 0 ? '+' + esc(CORE.money(pl.surcharge)) : 'Included') + '</span></div>' +
      '<div class="pb-row"><span>Qty</span><span>× ' + state.qty + '</span></div>' +
      '<div class="pb-total"><span>Total</span><span>' + esc(CORE.money(total)) + '</span></div>';
  }

  function renderSpecSheet() {
    var el = document.getElementById('specSheet');
    if (!el) return;
    var g = garmentOf(state.design.garment), c = colourOf(state.design.colour), pl = placementOf(state.design.placement);
    var pr = PRINTS.get(state.design.printId);
    var unit = computePrice();
    function row(label, val) { return '<div class="spec-row"><span>' + esc(label) + '</span><span>' + val + '</span></div>'; }
    el.innerHTML =
      '<h2>Spec sheet — what the workshop cuts</h2>' +
      row('Garment', esc(g ? g.name : '—')) +
      row('Colour', esc(c ? c.name : '—')) +
      row('Print', esc(pr ? pr.name : '—') + (pr && pr.family ? ' · ' + esc(pr.family) : '')) +
      (pr && pr.meaning ? row('Meaning', esc(pr.meaning)) : '') +
      row('Placement', esc(pl ? pl.name : '—') + (pl && pl.surcharge > 0 ? ' (+' + esc(CORE.money(pl.surcharge)) + ')' : ' (included)')) +
      row('Scale', '×' + state.design.scale.toFixed(2)) +
      row('Rotation', Math.round(state.design.rotate) + '°') +
      row('Position offset', Math.round(state.design.x) + 'px, ' + Math.round(state.design.y) + 'px from centre') +
      row('Size', esc(state.size)) +
      row('Quantity', String(state.qty)) +
      row('Unit price', esc(CORE.money(unit))) +
      row('Lead time', esc(window.KA_CONFIG.leadTime || '')) +
      '<p class="spec-note">Every Tee Studio piece is cut and sewn to this exact layout after you order — no two placements fall the same.</p>';
  }

  /* ============================================================
     5. DRAG + KEYBOARD NUDGE
     ============================================================ */
  function moveOffset(dx, dy) {
    state.design.x = clampNum(state.design.x + dx, -200, 200, 0);
    state.design.y = clampNum(state.design.y + dy, -200, 200, 0);
    renderStage();
    renderSpecSheet();
  }

  function bindStageInteractions() {
    var surface = document.getElementById('stageSurface');
    var dragging = false, startX = 0, startY = 0, origX = 0, origY = 0, moved = false;

    surface.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      origX = state.design.x; origY = state.design.y;
      surface.setPointerCapture(e.pointerId);
    });
    surface.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var rect = surface.getBoundingClientRect();
      var scaleFactor = VB_W / rect.width;
      var dx = (e.clientX - startX) * scaleFactor;
      var dy = (e.clientY - startY) * scaleFactor;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;
      state.design.x = clampNum(origX + dx, -200, 200, 0);
      state.design.y = clampNum(origY + dy, -200, 200, 0);
      renderStage();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (moved) { pushUndo0(origX, origY); renderSpecSheet(); persist(state); }
    }
    surface.addEventListener('pointerup', endDrag);
    surface.addEventListener('pointercancel', endDrag);

    /* keyboard nudge */
    var NUDGE_KEYS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Home: 1 };
    surface.addEventListener('keydown', function (e) {
      if (!NUDGE_KEYS[e.key]) return;
      var step = e.shiftKey ? 20 : 5;
      if (!e.repeat) pushUndo(); /* one undo step per key-down, not per auto-repeat tick */
      if (e.key === 'ArrowUp') moveOffset(0, -step);
      else if (e.key === 'ArrowDown') moveOffset(0, step);
      else if (e.key === 'ArrowLeft') moveOffset(-step, 0);
      else if (e.key === 'ArrowRight') moveOffset(step, 0);
      else if (e.key === 'Home') { state.design.x = 0; state.design.y = 0; renderStage(); renderSpecSheet(); }
      e.preventDefault();
      persist(state);
    });

    /* records an undo entry for the state BEFORE the drag started, without re-rendering */
    function pushUndo0(ox, oy) {
      var snap = JSON.parse(snapshot());
      snap.design.x = ox; snap.design.y = oy;
      undoStack.push(JSON.stringify(snap));
      if (undoStack.length > 50) undoStack.shift();
      renderUndoButton();
    }
  }

  function bindNudgeButtons() {
    document.querySelectorAll('.ft-nudge [data-nudge]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.dataset.nudge;
        pushUndo();
        if (dir === 'up') moveOffset(0, -10);
        else if (dir === 'down') moveOffset(0, 10);
        else if (dir === 'left') moveOffset(-10, 0);
        else if (dir === 'right') moveOffset(10, 0);
        else if (dir === 'center') { state.design.x = 0; state.design.y = 0; renderStage(); renderSpecSheet(); }
        persist(state);
      });
    });
  }

  /* ============================================================
     6. TOP TOOLBAR + FINE TUNE + SIZE/QTY WIRING
     ============================================================ */
  function bindToolbar() {
    document.getElementById('btnViewFront').addEventListener('click', function () {
      if (state.design.view === 'front') return;
      state.design.view = 'front'; renderAll();
    });
    document.getElementById('btnViewBack').addEventListener('click', function () {
      if (state.design.view === 'back') return;
      state.design.view = 'back'; renderAll();
    });
    document.getElementById('btnUndo').addEventListener('click', doUndo);
    document.getElementById('btnReset').addEventListener('click', function () {
      pushUndo();
      var size = state.size, qty = state.qty;
      state = { design: defaultDesign(), size: size, qty: qty };
      lastFallbackNotice = '';
      renderAll();
    });
    document.getElementById('btnRandomize').addEventListener('click', function () {
      pushUndo();
      var prints = allPrints();
      state.design.colour = CFG.colours[Math.floor(Math.random() * CFG.colours.length)].id;
      if (prints.length) state.design.printId = prints[Math.floor(Math.random() * prints.length)].id;
      state.design.placement = CFG.placements[Math.floor(Math.random() * CFG.placements.length)].id;
      state.design.scale = Math.round((0.7 + Math.random() * 1.1) * 100) / 100;
      state.design.rotate = Math.floor(Math.random() * 360);
      state.design.x = Math.floor(Math.random() * 80 - 40);
      state.design.y = Math.floor(Math.random() * 80 - 40);
      renderAll();
    });
    document.getElementById('btnCopyLink').addEventListener('click', function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          window.kaToast && window.kaToast('Link copied', 'ok');
        }, function () {
          window.kaToast && window.kaToast('Could not copy — copy the address bar instead', 'err');
        });
      } else {
        window.kaToast && window.kaToast('Copy not supported on this browser', 'err');
      }
    });
  }

  function bindFineTune() {
    var scaleInput = document.getElementById('ftScale');
    var rotateInput = document.getElementById('ftRotate');
    var committing = false;
    function commitOnce() { if (!committing) { pushUndo(); committing = true; } }
    scaleInput.addEventListener('input', function () {
      commitOnce();
      state.design.scale = clampNum(scaleInput.value, 0.4, 2.5, 1);
      document.getElementById('ftScaleOut').textContent = '×' + state.design.scale.toFixed(2);
      renderStage(); renderSpecSheet();
    });
    rotateInput.addEventListener('input', function () {
      commitOnce();
      state.design.rotate = clampNum(rotateInput.value, 0, 360, 0);
      document.getElementById('ftRotateOut').textContent = Math.round(state.design.rotate) + '°';
      renderStage(); renderSpecSheet();
    });
    function commitEnd() { committing = false; persist(state); }
    scaleInput.addEventListener('change', commitEnd);
    rotateInput.addEventListener('change', commitEnd);

    document.getElementById('ftReset').addEventListener('click', function () {
      pushUndo();
      state.design.scale = 1; state.design.rotate = 0; state.design.x = 0; state.design.y = 0;
      renderAll();
    });
  }

  function bindQty() {
    document.getElementById('qtyMinus').addEventListener('click', function () {
      state.qty = sanitizeQty(state.qty - 1); renderAll();
    });
    document.getElementById('qtyPlus').addEventListener('click', function () {
      state.qty = sanitizeQty(state.qty + 1); renderAll();
    });
  }

  /* ============================================================
     7. FAQ ACCORDION (native <details>; just single-open convenience)
     ============================================================ */
  function bindFaq() {
    var items = document.querySelectorAll('.faq-item');
    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (item.open) {
          items.forEach(function (other) { if (other !== item) other.open = false; });
        }
      });
    });
  }

  /* ============================================================
     8. ADD TO CART
     ============================================================ */
  function buildThumb() {
    var svg = buildSvg(state.design, { thumb: true, forceView: 'front' });
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function bindAddToCart() {
    document.getElementById('btnAddToCart').addEventListener('click', function () {
      var g = garmentOf(state.design.garment), pr = PRINTS.get(state.design.printId);
      var price = computePrice();
      var name = (g ? g.name : 'Custom garment') + ' — ' + (pr ? pr.name : 'Custom print');
      var uid = 'ka_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var item = {
        kind: 'custom', uid: uid, name: name,
        garment: state.design.garment, colour: state.design.colour,
        size: state.size, qty: state.qty, price: price,
        design: JSON.parse(JSON.stringify(state.design)),
        thumb: buildThumb()
      };
      try {
        window.kaCart.addItem(item);
      } catch (e1) {
        try {
          var noThumb = Object.assign({}, item); delete noThumb.thumb;
          window.kaCart.addItem(noThumb);
        } catch (e2) {
          window.kaToast && window.kaToast('Could not add to cart — try again', 'err');
          return;
        }
      }
      window.kaToast && window.kaToast('Added to cart', 'ok');
      window.kaCart.open && window.kaCart.open();
    });
  }

  /* ============================================================
     9. INIT
     ============================================================ */
  function showFatalError(err) {
    var wrap = document.querySelector('.studio-shell .wrap');
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="step" role="alert">' +
        '<p class="studio-fatal-title">Tee Studio couldn’t load</p>' +
        '<p class="step-hint">Something the Studio depends on didn’t load correctly. Refresh the page, and check your connection if it happens again.</p>' +
      '</div>';
    if (window.console && console.error) console.error('[Tee Studio]', err);
  }

  function init() {
    bindToolbar();
    bindStageInteractions();
    bindNudgeButtons();
    bindFineTune();
    bindQty();
    bindFaq();
    bindAddToCart();
    renderAll();
  }

  function boot() {
    if (!CFG || !CORE || !PRINTS) throw new Error('Tee Studio dependencies (config.js/core.js/prints.js) are not available.');
    state = loadState();
    init();
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        try { boot(); } catch (err) { showFatalError(err); }
      });
    } else {
      boot();
    }
  } catch (err) {
    showFatalError(err);
  }
})();
