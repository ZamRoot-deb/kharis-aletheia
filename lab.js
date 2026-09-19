/* KHARIS & ALETHEIA — PRINT LAB (lab.html only)
   Built on top of window.KA_PRINTS (prints.js) exactly per CONTRACT.md's "lab" row.
   Family params:
     kente   {strips, bandHeights[], blockMotifs[](zigzag|checker|steps|diamond|bars), weftLines}
     ankara  {motif(rings|fans|petals|waves|suns|shells), scale, outline, dotFill, crackle}
     adinkra {symbol, density, frame(none|box|comb), alternate, rotateAlt}
*/
(function () {
  'use strict';

  var LS_KEY = 'ka_lab';
  var FAMILIES = ['kente', 'ankara', 'adinkra'];
  var MOTIF_OPTS = ['zigzag', 'checker', 'steps', 'diamond', 'bars'];
  var ANKARA_MOTIFS = ['rings', 'fans', 'petals', 'waves', 'suns', 'shells'];
  var FRAME_OPTS = ['none', 'box', 'comb'];

  var FAMILY_LABEL = { kente: 'Kente', ankara: 'Ankara', adinkra: 'Adinkra' };
  var FAMILY_MEANING = {
    kente: 'Kente began with Akan weavers in Ghana — narrow strips woven on a horizontal loom, then sewn edge to edge into cloth. Historically, every stripe combination carried its own name and proverb. The strips and bands you’re remixing echo that same structure.',
    ankara: 'Ankara (Dutch wax print) is wax-resist cotton, bold and large in scale by design, worn across West Africa for everyday wear and for ceremony alike. The motifs repeat freely — there’s no single "correct" layout.',
    adinkra: 'Adinkra symbols come from the Akan of Ghana, traditionally stamped onto cloth for funerals and formal occasions. Each glyph is a compressed proverb — pick one below to read what it carries.'
  };

  var HOUSE_PALETTES = [
    { name: 'Gold & Berry', hexes: ['#d8b26a', '#e8325e', '#2a0816', '#f2e8d6'] },
    { name: 'Forest Kente', hexes: ['#0f3d2e', '#d8b26a', '#8b0e3a', '#f2e8d6'] },
    { name: 'Midnight Ankara', hexes: ['#121013', '#1f4fa8', '#d8b26a', '#f4f1ea'] },
    { name: 'Adire Indigo', hexes: ['#14213d', '#f4f1ea', '#8a6a2a', '#2a0816'] },
    { name: 'Sunset Wax', hexes: ['#e8325e', '#f0d6a0', '#8b0e3a', '#4a5232'] },
    { name: 'Earth & Ivory', hexes: ['#4a5232', '#e9dfc8', '#8a6a78', '#2a0816'] }
  ];

  var HIST_MAX = 60;

  var state = { family: 'kente', def: null, seed: '1', zoom: 1, teeMock: false };
  var sourcePrint = null;      // built-in gallery item the current def was loaded from, if unedited since
  var history = [];
  var lastSaved = null;
  var histIndex = -1;
  var previewRAF = null;
  var uidCounter = 0;

  /* ============ small helpers ============ */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return KA_CORE.escapeHtml(s == null ? '' : String(s)); }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function randSeed() { return String(Math.floor(Math.random() * 1e9)); }
  function uid(prefix) { uidCounter += 1; return prefix + uidCounter; }
  function clampZoom(v) { return isNaN(v) ? 1 : Math.max(0.5, Math.min(3, v)); }
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'print';
  }
  function normalizeHex(hex) {
    var h = typeof hex === 'string' ? hex.trim() : '';
    if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(h)) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return '#000000';
  }
  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function formatVal(v, opts) {
    if (opts && opts.decimals != null) return v.toFixed(opts.decimals);
    return String(Math.round(v));
  }
  function announce(msg) {
    var el = document.getElementById('labStatus');
    if (!el) return;
    el.textContent = '';
    window.requestAnimationFrame(function () { el.textContent = msg; });
  }
  function makerName(slug) {
    if (!slug || !window.KA_MAKERS) return null;
    var found = KA_MAKERS.find(function (m) { return m.slug === slug; });
    return found ? found.name : null;
  }
  function findSymbol(id) {
    try {
      var list = KA_PRINTS.symbols() || [];
      return list.filter(function (s) { return s.id === id; })[0] || null;
    } catch (err) { return null; }
  }

  /* ============ persistence ============ */
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        family: state.family, def: state.def, seed: state.seed,
        zoom: state.zoom, teeMock: state.teeMock
      }));
    } catch (err) { /* private mode / quota exceeded — in-memory state still works this visit */ }
  }
  function tryRestore() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.def || FAMILIES.indexOf(parsed.family) === -1) return null;
      return parsed;
    } catch (err) { return null; }
  }

  /* ============ history (undo / redo) ============ */
  function pushHistory() {
    history = history.slice(0, histIndex + 1);
    history.push({ family: state.family, def: clone(state.def), seed: state.seed });
    if (history.length > HIST_MAX) history.shift();
    histIndex = history.length - 1;
    updateHistButtons();
  }
  function updateHistButtons() {
    var undoBtn = document.getElementById('labUndo');
    var redoBtn = document.getElementById('labRedo');
    if (undoBtn) undoBtn.disabled = histIndex <= 0;
    if (redoBtn) redoBtn.disabled = histIndex >= history.length - 1;
  }
  function goHistory(delta) {
    var target = histIndex + delta;
    if (target < 0 || target >= history.length) return;
    histIndex = target;
    var snap = history[histIndex];
    sourcePrint = null;
    state.family = snap.family;
    state.def = clone(snap.def);
    state.seed = snap.seed;
    renderFamilyTabs();
    renderGallery();
    renderPalette();
    renderParams();
    renderNameField();
    renderSeedField();
    renderPreview();
    renderMeaning();
    persist();
    updateHistButtons();
    announce(delta < 0 ? 'Undo.' : 'Redo.');
  }

  /* ============ core state transitions ============ */
  function loadDef(def, family) {
    state.family = family || def.family;
    state.def = KA_PRINTS.sanitize(clone(def));
    if (!state.def.name) state.def.name = 'Untitled remix';
    // sourcePrint is set by the caller (gallery/shelf click) *before* calling loadDef,
    // or left null for family-switch/reset/randomize/undo/redo — loadDef never touches it.
    renderFamilyTabs();
    renderGallery();
    renderPalette();
    renderParams();
    renderNameField();
    renderSeedField();
    renderPreview();
    renderMeaning();
    pushHistory();
    persist();
  }
  function commitChange() {
    sourcePrint = null;
    pushHistory();
    persist();
    renderPreview();
    renderMeaning();
  }
  function schedulePreview() {
    if (previewRAF) return;
    previewRAF = requestAnimationFrame(function () { previewRAF = null; renderPreview(); });
  }

  /* ============ rendering: chrome ============ */
  function renderFamilyTabs() {
    var btns = document.querySelectorAll('#labFamilyTabs .pill');
    btns.forEach(function (b) {
      var on = b.dataset.family === state.family;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderGallery() {
    var wrap = document.getElementById('labGallery');
    var items;
    try { items = (KA_PRINTS.list() || []).filter(function (p) { return p.family === state.family; }); }
    catch (err) { wrap.innerHTML = '<p class="lab-gallery-error">Couldn’t load the built-in gallery. Refresh to try again.</p>'; return; }
    if (!items.length) {
      wrap.innerHTML = '<p class="lab-gallery-empty">No built-in ' + esc(FAMILY_LABEL[state.family]) + ' prints yet — start from Reset and remix your own.</p>';
      return;
    }
    wrap.innerHTML = '';
    items.forEach(function (item) {
      var on = !!(sourcePrint && sourcePrint.id === item.id);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'lab-card' + (on ? ' on' : '');
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
      card.innerHTML = '<span class="lc-thumb"><img decoding="async" alt=""></span><span class="lc-name"></span>';
      var img = card.querySelector('img');
      try { img.src = KA_PRINTS.dataUri(item.def, { size: 160 }); } catch (err) { /* thumbnail skipped */ }
      card.querySelector('.lc-name').textContent = item.name;
      card.title = item.name + (item.meaning ? ' — ' + item.meaning : '');
      card.addEventListener('click', function () {
        sourcePrint = item;
        state.seed = randSeed();
        loadDef(item.def, item.family);
        announce('Loaded "' + item.name + '".');
      });
      wrap.appendChild(card);
    });
  }

  /* ============ rendering: palette ============ */
  function renderPalette() {
    renderPalettePresets();
    renderSwatches();
  }
  function renderPalettePresets() {
    var wrap = document.getElementById('labPalettePresets');
    wrap.innerHTML = '';
    HOUSE_PALETTES.forEach(function (preset) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lab-preset';
      b.title = preset.name;
      b.setAttribute('aria-label', 'Apply the ' + preset.name + ' palette');
      preset.hexes.forEach(function (hex) {
        var i = document.createElement('i');
        i.style.background = hex;
        b.appendChild(i);
      });
      b.addEventListener('click', function () {
        state.def.palette = preset.hexes.slice();
        renderSwatches();
        commitChange();
        announce('Applied the ' + preset.name + ' palette.');
      });
      wrap.appendChild(b);
    });
  }
  function renderSwatches() {
    var wrap = document.getElementById('labSwatches');
    wrap.innerHTML = '';
    var pal = state.def.palette;
    pal.forEach(function (hex, idx) {
      var cell = document.createElement('div');
      cell.className = 'lab-swatch';
      var input = document.createElement('input');
      input.type = 'color';
      input.value = normalizeHex(hex);
      input.setAttribute('aria-label', 'Swatch ' + (idx + 1) + ' colour');
      input.addEventListener('input', function () { pal[idx] = input.value; schedulePreview(); });
      input.addEventListener('change', function () { pal[idx] = input.value; commitChange(); });
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'lab-swatch-rm';
      rm.textContent = 'Remove';
      rm.disabled = pal.length <= 2;
      rm.setAttribute('aria-label', 'Remove swatch ' + (idx + 1));
      rm.addEventListener('click', function () {
        if (pal.length <= 2) return;
        pal.splice(idx, 1);
        renderSwatches();
        commitChange();
        announce('Swatch removed.');
        var addBtn = document.getElementById('labAddSwatch');
        if (addBtn) addBtn.focus();
      });
      cell.appendChild(input);
      cell.appendChild(rm);
      wrap.appendChild(cell);
    });
    var addBtn = document.getElementById('labAddSwatch');
    var shuffleBtn = document.getElementById('labShuffleSwatch');
    if (addBtn) addBtn.disabled = pal.length >= 6;
    if (shuffleBtn) shuffleBtn.disabled = pal.length < 2;
  }

  /* ============ rendering: shared field builders ============ */
  function rangeField(labelText, key, value, min, max, step, setter, opts) {
    var field = document.createElement('div');
    field.className = 'lab-field';
    var inputId = uid('labP_');
    var label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.textContent = labelText;
    field.appendChild(label);

    var row = document.createElement('div');
    row.className = 'lab-range-row';
    var input = document.createElement('input');
    input.type = 'range'; input.id = inputId;
    input.min = min; input.max = max; input.step = step; input.value = value;
    var output = document.createElement('output');
    output.setAttribute('for', inputId);
    output.textContent = formatVal(value, opts);

    input.addEventListener('input', function () {
      var v = parseFloat(input.value);
      setter(v);
      output.textContent = formatVal(v, opts);
      schedulePreview();
    });
    input.addEventListener('change', function () { commitChange(); });

    row.appendChild(input);
    row.appendChild(output);
    field.appendChild(row);
    return field;
  }

  function segField(labelText, options, current, setter, formatter) {
    var field = document.createElement('div');
    field.className = 'lab-field';
    var labelId = uid('labLbl_');
    var label = document.createElement('span');
    label.className = 'lab-field-label';
    label.id = labelId;
    label.textContent = labelText;
    field.appendChild(label);

    var seg = document.createElement('div');
    seg.className = 'lab-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', labelId);
    options.forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (opt === current ? ' on' : '');
      b.textContent = formatter ? formatter(opt) : opt;
      b.setAttribute('aria-pressed', opt === current ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (opt === current) return;
        current = opt;
        setter(opt);
        Array.prototype.forEach.call(seg.children, function (child, i) {
          var on = options[i] === opt;
          child.classList.toggle('on', on);
          child.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        commitChange();
      });
      seg.appendChild(b);
    });
    field.appendChild(seg);
    return field;
  }

  function multiSegField(labelText, options, currentArr, setter, formatter) {
    var field = document.createElement('div');
    field.className = 'lab-field';
    var labelId = uid('labLbl_');
    var label = document.createElement('span');
    label.className = 'lab-field-label';
    label.id = labelId;
    label.textContent = labelText;
    field.appendChild(label);

    var seg = document.createElement('div');
    seg.className = 'lab-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', labelId);
    options.forEach(function (opt) {
      var on = currentArr.indexOf(opt) >= 0;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (on ? ' on' : '');
      b.textContent = formatter ? formatter(opt) : opt;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () {
        var idx = currentArr.indexOf(opt);
        if (idx >= 0) {
          if (currentArr.length <= 1) { announce('At least one option must stay selected.'); return; }
          currentArr.splice(idx, 1);
          b.classList.remove('on'); b.setAttribute('aria-pressed', 'false');
        } else {
          currentArr.push(opt);
          b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
        }
        setter(currentArr);
        commitChange();
      });
      seg.appendChild(b);
    });
    field.appendChild(seg);
    return field;
  }

  function boolRow(defs) {
    var row = document.createElement('div');
    row.className = 'lab-bool-row';
    defs.forEach(function (d) {
      var label = document.createElement('label');
      label.className = 'lab-toggle';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!d.value;
      input.setAttribute('aria-label', d.label);
      var box = document.createElement('span');
      box.className = 'lt-box';
      box.setAttribute('aria-hidden', 'true');
      var text = document.createElement('span');
      text.textContent = d.label;
      input.addEventListener('change', function () { d.setter(input.checked); commitChange(); });
      label.appendChild(input);
      label.appendChild(box);
      label.appendChild(text);
      row.appendChild(label);
    });
    return row;
  }

  /* ============ rendering: family-specific param panels ============ */
  function renderParams() {
    var title = document.getElementById('labParamsTitle');
    var wrap = document.getElementById('labParams');
    if (title) title.textContent = FAMILY_LABEL[state.family] + ' pattern';
    wrap.innerHTML = '';
    if (state.family === 'kente') buildKenteParams(wrap);
    else if (state.family === 'ankara') buildAnkaraParams(wrap);
    else buildAdinkraParams(wrap);
  }

  function buildKenteParams(container) {
    var p = state.def.params;
    container.appendChild(rangeField('Strips', 'strips', p.strips, 3, 8, 1, function (v) { p.strips = v; }));
    container.appendChild(multiSegField('Block motifs — pick one or more', MOTIF_OPTS, p.blockMotifs, function (arr) { p.blockMotifs = arr; }, capitalize));
    container.appendChild(rangeField('Weft lines', 'weftLines', p.weftLines, 0, 10, 1, function (v) { p.weftLines = v; }));
    container.appendChild(bandHeightsField(p));
  }

  function buildAnkaraParams(container) {
    var p = state.def.params;
    container.appendChild(segField('Motif', ANKARA_MOTIFS, p.motif, function (v) { p.motif = v; }, capitalize));
    container.appendChild(rangeField('Scale', 'scale', p.scale, 0.4, 2.5, 0.1, function (v) { p.scale = v; }, { decimals: 1 }));
    container.appendChild(boolRow([
      { key: 'outline', label: 'Outline', value: p.outline, setter: function (v) { p.outline = v; } },
      { key: 'dotFill', label: 'Dot fill', value: p.dotFill, setter: function (v) { p.dotFill = v; } },
      { key: 'crackle', label: 'Crackle', value: p.crackle, setter: function (v) { p.crackle = v; } }
    ]));
  }

  function buildAdinkraParams(container) {
    var p = state.def.params;
    container.appendChild(rangeField('Density', 'density', p.density, 1, 6, 1, function (v) { p.density = v; }));
    container.appendChild(segField('Frame', FRAME_OPTS, p.frame, function (v) { p.frame = v; }, capitalize));
    container.appendChild(boolRow([
      { key: 'alternate', label: 'Alternate rows', value: p.alternate, setter: function (v) { p.alternate = v; } },
      { key: 'rotateAlt', label: 'Rotate alternate', value: p.rotateAlt, setter: function (v) { p.rotateAlt = v; } }
    ]));
    container.appendChild(symbolPickerField(p));
  }

  function bandHeightsField(p) {
    var field = document.createElement('div');
    field.className = 'lab-field';
    var label = document.createElement('span');
    label.className = 'lab-field-label';
    label.textContent = 'Band heights';
    field.appendChild(label);

    var list = document.createElement('div');
    list.className = 'lab-bandlist';
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-gold lab-mini-btn';
    addBtn.textContent = '+ Add band';

    function redraw() {
      list.innerHTML = '';
      p.bandHeights.forEach(function (h, idx) {
        var row = document.createElement('div');
        row.className = 'lab-band-row';
        var inputId = uid('labBand_');

        var idxLabel = document.createElement('label');
        idxLabel.className = 'lb-idx';
        idxLabel.setAttribute('for', inputId);
        idxLabel.textContent = 'Band ' + (idx + 1);
        row.appendChild(idxLabel);

        var input = document.createElement('input');
        input.type = 'range'; input.id = inputId;
        input.min = 4; input.max = 14; input.step = 1; input.value = h;
        var out = document.createElement('output');
        out.setAttribute('for', inputId);
        out.textContent = h;
        input.addEventListener('input', function () {
          p.bandHeights[idx] = parseInt(input.value, 10);
          out.textContent = input.value;
          schedulePreview();
        });
        input.addEventListener('change', function () { commitChange(); });
        row.appendChild(input);
        row.appendChild(out);

        var rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '−';
        rm.setAttribute('aria-label', 'Remove band ' + (idx + 1));
        rm.disabled = p.bandHeights.length <= 2;
        rm.addEventListener('click', function () {
          if (p.bandHeights.length <= 2) return;
          p.bandHeights.splice(idx, 1);
          redraw();
          commitChange();
          announce('Band removed.');
        });
        row.appendChild(rm);
        list.appendChild(row);
      });
      addBtn.disabled = p.bandHeights.length >= 5;
    }
    redraw();

    addBtn.addEventListener('click', function () {
      if (p.bandHeights.length >= 5) return;
      p.bandHeights.push(p.bandHeights[p.bandHeights.length - 1] || 8);
      redraw();
      commitChange();
      announce('Band added.');
      addBtn.focus();
    });

    field.appendChild(list);
    field.appendChild(addBtn);
    return field;
  }

  function symbolPickerField(p) {
    var field = document.createElement('div');
    field.className = 'lab-field';
    var labelId = uid('labLbl_');
    var label = document.createElement('span');
    label.className = 'lab-field-label';
    label.id = labelId;
    label.textContent = 'Symbol';
    field.appendChild(label);

    var symbols;
    try { symbols = KA_PRINTS.symbols() || []; } catch (err) { symbols = []; }

    if (!symbols.length) {
      var empty = document.createElement('p');
      empty.className = 'lab-gallery-error';
      empty.textContent = 'Symbols could not be loaded. Refresh to try again.';
      field.appendChild(empty);
      return field;
    }

    var grid = document.createElement('div');
    grid.className = 'lab-symbols';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-labelledby', labelId);

    symbols.forEach(function (sym) {
      var on = sym.id === p.symbol;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lab-symbol' + (on ? ' on' : '');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = sym.name + ' — ' + sym.meaning;
      var svgNS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      var glyph = document.createElementNS(svgNS, 'path');
      glyph.setAttribute('d', sym.path);
      glyph.setAttribute('fill', 'currentColor');
      svg.appendChild(glyph);
      var nameSpan = document.createElement('span');
      nameSpan.textContent = sym.name;
      b.appendChild(svg);
      b.appendChild(nameSpan);
      b.addEventListener('click', function () {
        if (p.symbol === sym.id) return;
        p.symbol = sym.id;
        Array.prototype.forEach.call(grid.children, function (child) {
          var isThis = child === b;
          child.classList.toggle('on', isThis);
          child.setAttribute('aria-pressed', isThis ? 'true' : 'false');
        });
        commitChange();
      });
      grid.appendChild(b);
    });

    field.appendChild(grid);
    return field;
  }

  /* ============ rendering: name / seed fields ============ */
  function renderNameField() {
    var el = document.getElementById('labName');
    if (el) el.value = state.def.name || '';
  }
  function renderSeedField() {
    var el = document.getElementById('labSeed');
    if (el) el.value = state.seed;
  }

  /* ============ rendering: preview + tee mock ============ */
  function renderPreview() {
    var el = document.getElementById('labPreview');
    if (!el) return;
    try {
      var clean = KA_PRINTS.sanitize(clone(state.def));
      var uri = KA_PRINTS.dataUri(clean, { size: 480 });
      el.style.backgroundImage = 'url("' + uri + '")';
      el.style.backgroundSize = Math.round(160 * state.zoom) + 'px';
      el.classList.remove('is-empty');
      el.setAttribute('aria-label', 'Live tiled preview of ' + (state.def.name || 'this') + ' print');
      renderTeeMock(clean);
    } catch (err) {
      el.classList.add('is-empty');
      el.style.backgroundImage = 'none';
      document.getElementById('labTeeMock').hidden = true;
    }
  }
  function renderTeeMock(clean) {
    var box = document.getElementById('labTeeMock');
    if (!state.teeMock) { box.hidden = true; return; }
    box.hidden = false;
    try {
      var pat = KA_PRINTS.patternDef(clean, { id: 'labTeePattern', scale: 1, rotate: 0 });
      box.innerHTML = '<svg viewBox="0 0 300 340" role="img" aria-label="Preview of the print on a tee">' +
        '<defs>' + pat + '</defs>' +
        '<path d="M100,42 L100,10 Q150,-4 200,10 L200,42 L252,22 L284,74 L236,98 L236,322 L64,322 L64,98 L16,74 L48,22 Z" ' +
        'style="fill:url(#labTeePattern);stroke:var(--border-strong);stroke-width:2"></path>' +
        '<ellipse cx="150" cy="34" rx="36" ry="15" style="fill:var(--surface);stroke:var(--border-strong);stroke-width:1.5"></ellipse>' +
        '</svg>';
    } catch (err) {
      box.innerHTML = '<p class="lab-block-hint">Tee mock-up unavailable right now.</p>';
    }
  }

  /* ============ rendering: meaning panel ============ */
  function renderMeaning() {
    var el = document.getElementById('labMeaning');
    if (!el) return;
    var famName = FAMILY_LABEL[state.family];
    var html = '<h3>' + esc(famName) + '</h3>';
    if (sourcePrint && sourcePrint.meaning) {
      html += '<p>' + esc(sourcePrint.meaning) + '</p>';
      var mn = makerName(sourcePrint.maker);
      if (mn) html += '<p class="lab-block-hint">Inspired by a piece from ' + esc(mn) + '.</p>';
    } else {
      html += '<p>' + esc(FAMILY_MEANING[state.family]) + '</p>';
    }
    if (state.family === 'adinkra') {
      var sym = findSymbol(state.def.params.symbol);
      if (sym) html += '<div class="lab-symbol-meaning"><p><b>' + esc(sym.name) + '</b> — ' + esc(sym.meaning) + '</p></div>';
    }
    el.innerHTML = html;
  }

  /* ============ my prints shelf ============ */
  function renderShelf() {
    var wrap = document.getElementById('labShelf');
    var items;
    try { items = KA_PRINTS.saved.list() || []; }
    catch (err) { wrap.innerHTML = '<p class="lab-gallery-error">Couldn’t load My Prints. Refresh to try again.</p>'; return; }
    if (!items.length) {
      wrap.innerHTML = '<p class="lab-shelf-empty">Nothing saved yet — remix a print above and hit “Save to My Prints.”</p>';
      return;
    }
    wrap.innerHTML = '';
    items.forEach(function (item) { wrap.appendChild(buildShelfCard(item)); });
  }

  function actionButton(label, handler) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', handler);
    return b;
  }

  function buildShelfCard(item) {
    var full = item;
    try { full = KA_PRINTS.get(item.id) || item; } catch (err) { full = item; }
    var def = full.def || item.def;
    var name = full.name || item.name || 'Untitled remix';
    var family = full.family || item.family || 'kente';

    var card = document.createElement('div');
    card.className = 'lab-shelf-card';

    var thumb = document.createElement('div');
    thumb.className = 'lab-shelf-thumb';
    var img = document.createElement('img');
    img.alt = '';
    if (def) { try { img.src = KA_PRINTS.dataUri(def, { size: 160 }); } catch (err) { /* no thumb */ } }
    thumb.appendChild(img);
    card.appendChild(thumb);

    var body = document.createElement('div');
    body.className = 'lab-shelf-body';

    var famEl = document.createElement('p');
    famEl.className = 'lab-shelf-fam';
    famEl.textContent = FAMILY_LABEL[family] || family;
    body.appendChild(famEl);

    var nameEl = document.createElement('p');
    nameEl.className = 'lab-shelf-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);

    var actions = document.createElement('div');
    actions.className = 'lab-shelf-actions';

    actions.appendChild(actionButton('Load', function () {
      if (!def) { kaToast('That print could not be loaded.', 'err'); return; }
      sourcePrint = null;
      state.seed = randSeed();
      loadDef(def, family);
      kaToast('Loaded "' + name + '".', 'ok');
      announce('Loaded "' + name + '" into the editor.');
      var controls = document.getElementById('labControls');
      if (controls) controls.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }));

    actions.appendChild(actionButton('Rename', function () { startRename(card, item, name, def, family); }));
    actions.appendChild(actionButton('Duplicate', function () { duplicatePrint(name, def, family); }));

    var delBtn = actionButton('Delete', function () { confirmDelete(item, name); });
    delBtn.classList.add('lab-danger');
    actions.appendChild(delBtn);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function startRename(card, item, currentName, def, family) {
    var nameEl = card.querySelector('.lab-shelf-name');
    var actions = card.querySelector('.lab-shelf-actions');
    if (!nameEl || !actions) return;

    var row = document.createElement('div');
    row.className = 'lab-rename-row';
    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.maxLength = 48;
    input.setAttribute('aria-label', 'New name for ' + currentName);
    var save = document.createElement('button');
    save.type = 'button'; save.textContent = 'Save';
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Cancel';
    row.appendChild(input); row.appendChild(save); row.appendChild(cancel);

    nameEl.replaceWith(row);
    actions.hidden = true;
    input.focus();
    input.select();

    function finish() { row.replaceWith(nameEl); actions.hidden = false; }
    cancel.addEventListener('click', finish);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') finish();
      if (e.key === 'Enter') { e.preventDefault(); save.click(); }
    });
    save.addEventListener('click', function () {
      var newName = input.value.trim() || currentName;
      renamePrint(item, def, family, newName);
    });
  }

  function renamePrint(item, def, family, newName) {
    if (!def) { kaToast('That print has no data to rename.', 'err'); renderShelf(); return; }
    var clean;
    try { clean = KA_PRINTS.sanitize(clone(def)); } catch (err) { clean = clone(def); }
    clean.name = newName;
    clean.family = family;
    try {
      KA_PRINTS.saved.remove(item.id);
      KA_PRINTS.saved.save(clean);
    } catch (err) {
      kaToast('Rename failed — please try again.', 'err');
      renderShelf();
      return;
    }
    renderShelf();
    kaToast('Renamed to "' + newName + '".', 'ok');
    announce('Renamed print to "' + newName + '".');
  }

  function duplicatePrint(name, def, family) {
    if (!def) { kaToast('That print has no data to duplicate.', 'err'); return; }
    var clean;
    try { clean = KA_PRINTS.sanitize(clone(def)); } catch (err) { clean = clone(def); }
    clean.name = name + ' (copy)';
    clean.family = family;
    try { KA_PRINTS.saved.save(clean); }
    catch (err) { kaToast('Duplicate failed — please try again.', 'err'); return; }
    renderShelf();
    kaToast('Duplicated as "' + clean.name + '".', 'ok');
    announce('Duplicated as "' + clean.name + '".');
  }

  function confirmDelete(item, name) {
    var html =
      '<div class="lab-confirm">' +
        '<h3 class="h-display h-md">Delete this print?</h3>' +
        '<p>“' + esc(name) + '” will be removed from My Prints. This can’t be undone.</p>' +
        '<div class="lab-confirm-btns">' +
          '<button type="button" class="btn btn-gold" data-lab-cancel>Cancel</button>' +
          '<button type="button" class="btn btn-berry" data-lab-confirm>Delete</button>' +
        '</div>' +
      '</div>';
    kaModal.open(html, { label: 'Confirm delete' });
    var cancelBtn = document.querySelector('[data-lab-cancel]');
    var confirmBtn = document.querySelector('[data-lab-confirm]');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { kaModal.close(); });
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      try { KA_PRINTS.saved.remove(item.id); }
      catch (err) { kaToast('Delete failed — please try again.', 'err'); kaModal.close(); return; }
      kaModal.close();
      renderShelf();
      kaToast('Deleted "' + name + '".', 'ok');
      announce('Deleted "' + name + '" from My Prints.');
    });
  }

  /* ============ save / download / send ============ */
  function resolveSavedId(result) {
    if (result && typeof result === 'object' && result.id) return result.id;
    if (typeof result === 'string' && result) return result;
    return null;
  }
  function saveCurrentAsNewPrint(announceResult) {
    var name = (state.def.name || '').trim() || 'Untitled remix';
    state.def.name = name;
    renderNameField();
    var clean;
    try { clean = KA_PRINTS.sanitize(clone(state.def)); }
    catch (err) { kaToast('Could not prepare this print to save.', 'err'); return null; }
    // unchanged since the last save (e.g. Save then Send to Tee Studio) → reuse that print, don't duplicate it
    var fingerprint = JSON.stringify(clean);
    if (lastSaved && lastSaved.fingerprint === fingerprint && KA_PRINTS.get(lastSaved.id)) {
      if (announceResult) { kaToast('"' + name + '" is already in My Prints.', 'ok'); announce('Already saved.'); }
      return lastSaved.id;
    }
    var result;
    try { result = KA_PRINTS.saved.save(clean); }
    catch (err) { kaToast('Saving failed — please try again.', 'err'); announce('Save failed.'); return null; }
    var id = resolveSavedId(result);
    if (id) lastSaved = { id: id, fingerprint: fingerprint };
    renderShelf();
    if (announceResult) {
      kaToast('Saved "' + name + '" to My Prints.', 'ok');
      announce('Saved "' + name + '" to My Prints.');
    }
    return id;
  }

  /* ============ boot ============ */
  function bindStaticEvents() {
    document.querySelectorAll('#labFamilyTabs .pill').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.family === state.family) return;
        var fresh = KA_PRINTS.defaults(b.dataset.family);
        sourcePrint = null;
        state.seed = randSeed();
        loadDef(fresh, b.dataset.family);
        announce('Switched to ' + FAMILY_LABEL[b.dataset.family] + '.');
      });
    });

    document.getElementById('labAddSwatch').addEventListener('click', function () {
      var pal = state.def.palette;
      if (pal.length >= 6) return;
      pal.push(pal[pal.length - 1] || '#d8b26a');
      renderSwatches();
      commitChange();
      announce('Swatch added.');
    });
    document.getElementById('labShuffleSwatch').addEventListener('click', function () {
      shuffleArray(state.def.palette);
      renderSwatches();
      commitChange();
      announce('Palette order shuffled.');
    });

    document.getElementById('labUndo').addEventListener('click', function () { goHistory(-1); });
    document.getElementById('labRedo').addEventListener('click', function () { goHistory(1); });
    document.getElementById('labReset').addEventListener('click', function () {
      var fresh = KA_PRINTS.defaults(state.family);
      sourcePrint = null;
      state.seed = randSeed();
      loadDef(fresh, state.family);
      announce('Reset to the default ' + FAMILY_LABEL[state.family] + ' print.');
    });
    document.getElementById('labRandomize').addEventListener('click', function () {
      var seedInput = document.getElementById('labSeed');
      var seed = (seedInput.value || '').trim() || randSeed();
      var remixed;
      try {
        var clean = KA_PRINTS.sanitize(clone(state.def));
        remixed = KA_PRINTS.randomize(clean, seed);
      } catch (err) {
        announce('Randomize failed for that seed — try another.');
        return;
      }
      state.seed = seed;
      sourcePrint = null;
      loadDef(remixed, (remixed && remixed.family) || state.family);
      spinDice();
      announce('Randomized with seed ' + seed + '.');
    });

    document.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      if (!mod || (e.key !== 'z' && e.key !== 'Z')) return;
      var active = document.activeElement;
      var tag = active ? active.tagName : '';
      var typingField = (tag === 'INPUT' && active.type === 'text') || tag === 'TEXTAREA';
      if (typingField) return; // let the browser's native text-undo run
      e.preventDefault();
      if (e.shiftKey) goHistory(1); else goHistory(-1);
    });

    var nameInput = document.getElementById('labName');
    nameInput.addEventListener('input', function () { state.def.name = nameInput.value; schedulePreview(); });
    nameInput.addEventListener('change', function () {
      if (!nameInput.value.trim()) { nameInput.value = 'Untitled remix'; state.def.name = 'Untitled remix'; }
      commitChange();
    });

    document.getElementById('labSave').addEventListener('click', function () { saveCurrentAsNewPrint(true); });

    document.getElementById('labDownload').addEventListener('click', function () {
      var clean;
      try { clean = KA_PRINTS.sanitize(clone(state.def)); }
      catch (err) { kaToast('Could not prepare the SVG.', 'err'); return; }
      var svg;
      try { svg = KA_PRINTS.tileSvg(clean, { size: 1024 }); }
      catch (err) { kaToast('Download failed — try adjusting the print first.', 'err'); return; }
      var blob = new Blob([svg], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = slugify(state.def.name || 'kharis-aletheia-print') + '.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      kaToast('Downloading ' + a.download, 'ok');
      announce('SVG download started.');
    });

    document.getElementById('labSendStudio').addEventListener('click', function () {
      var id = saveCurrentAsNewPrint(false);
      if (!id) { kaToast('Could not send to the Tee Studio — try saving first.', 'err'); return; }
      kaToast('Sending to Tee Studio…', 'ok');
      announce('Sending "' + (state.def.name || 'this print') + '" to the Tee Studio.');
      location.href = 'studio.html#print=' + encodeURIComponent(id);
    });

    var zoomInput = document.getElementById('labZoom');
    var zoomOut = document.getElementById('labZoomOut');
    zoomInput.addEventListener('input', function () {
      state.zoom = clampZoom(parseFloat(zoomInput.value));
      zoomOut.textContent = Math.round(state.zoom * 100) + '%';
      renderPreview();
    });
    zoomInput.addEventListener('change', function () { persist(); });

    document.getElementById('labTeeToggle').addEventListener('change', function (e) {
      state.teeMock = e.target.checked;
      renderPreview();
      persist();
      announce(state.teeMock ? 'Showing the tee mock-up.' : 'Hid the tee mock-up.');
    });
  }

  function spinDice() {
    var el = document.getElementById('labDiceIcon');
    if (!el || prefersReducedMotion()) return;
    el.classList.remove('spin');
    void el.offsetWidth;
    el.classList.add('spin');
  }

  function showFatalError(err) {
    var wrap = document.querySelector('.lab-section .wrap');
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="lab-block" role="alert">' +
        '<p class="lab-block-title">Print Lab couldn’t load</p>' +
        '<p class="lab-block-hint">Something the Lab depends on didn’t load correctly. Refresh the page, and check your connection if it happens again.</p>' +
      '</div>';
    if (window.console && console.error) console.error('[Print Lab]', err);
  }

  function init() {
    var restored = tryRestore();
    var fam = (restored && restored.family) || 'kente';
    var def = (restored && restored.def) || KA_PRINTS.defaults(fam);

    state.seed = restored && restored.seed != null ? String(restored.seed) : randSeed();
    state.zoom = restored && restored.zoom != null ? clampZoom(restored.zoom) : 1;
    state.teeMock = !!(restored && restored.teeMock);

    document.getElementById('labZoom').value = state.zoom;
    document.getElementById('labZoomOut').textContent = Math.round(state.zoom * 100) + '%';
    document.getElementById('labTeeToggle').checked = state.teeMock;

    history = []; histIndex = -1;
    sourcePrint = null;
    loadDef(def, fam);
    renderShelf();
    bindStaticEvents();
    announce('Print Lab ready.');
  }

  try {
    if (!window.KA_PRINTS || !window.KA_CORE) throw new Error('Print Lab engine (prints.js/core.js) is not available.');
    init();
  } catch (err) {
    showFatalError(err);
  }
})();
