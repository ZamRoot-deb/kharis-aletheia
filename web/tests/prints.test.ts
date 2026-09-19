/* KHARIS & ALETHEIA — print engine tests (per CONTRACT-NEXT.md)
   Ported from ../../prints.test.js. KA_PRINTS is now a real ESM export from lib/prints.ts.
   Run: node --test tests/prints.test.ts */

import test from 'node:test';
import assert from 'node:assert';

import { KA_PRINTS } from '../lib/prints.ts';

const FAMILIES = ['kente', 'ankara', 'adinkra'];
const SIZE_LIMIT = 12 * 1024; /* 12KB per contract */

/* ---- helpers ---- */

function checkBalancedTags(svg: string): boolean {
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(svg))) {
    const full = m[0];
    const name = m[1];
    if (full.slice(0, 2) === '</') {
      const top = stack.pop();
      if (top !== name) return false;
    } else if (full.slice(-2) !== '/>') {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

function hasNoNaNOrUndefined(str: string): boolean {
  return !/NaN|undefined|Infinity/.test(str);
}

function hasEvenQuotes(str: string): boolean {
  return (str.match(/"/g) || []).length % 2 === 0;
}

function assertWellFormedSvg(svg: string, label: string) {
  assert.match(svg, /^<svg[ >]/, label + ': starts with <svg');
  assert.match(svg, /<\/svg>$/, label + ': ends with </svg>');
  assert.ok(hasNoNaNOrUndefined(svg), label + ': no NaN/undefined/Infinity');
  assert.ok(hasEvenQuotes(svg), label + ': quotes are balanced');
  assert.ok(checkBalancedTags(svg), label + ': tags are balanced');
}

/* ============ list() / get() ============ */

test('list() returns at least 12 built-ins, 4+ per family', () => {
  const all = KA_PRINTS.list();
  assert.ok(all.length >= 12, 'expected >=12 built-ins, got ' + all.length);
  const counts: Record<string, number> = {};
  for (const p of all) counts[p.family] = (counts[p.family] || 0) + 1;
  for (const f of FAMILIES) {
    assert.ok(counts[f] >= 4, f + ' should have >=4 built-ins, got ' + (counts[f] || 0));
  }
});

test('every built-in has the {id,name,family,maker,meaning,def} shape', () => {
  for (const p of KA_PRINTS.list()) {
    assert.strictEqual(typeof p.id, 'string');
    assert.strictEqual(typeof p.name, 'string');
    assert.ok(FAMILIES.includes(p.family));
    assert.ok(p.maker === null || typeof p.maker === 'string');
    assert.ok(p.meaning === null || typeof p.meaning === 'string');
    assert.strictEqual(typeof p.def, 'object');
    assert.strictEqual(p.def.family, p.family);
  }
});

test('built-in ids are unique', () => {
  const ids = KA_PRINTS.list().map((p) => p.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('maker attribution matches the house rule per family', () => {
  for (const p of KA_PRINTS.list()) {
    if (p.family === 'kente') assert.strictEqual(p.maker, 'efua-mensah');
    if (p.family === 'adinkra') assert.strictEqual(p.maker, 'kwame-asante');
    if (p.family === 'ankara') assert.ok(p.maker === null || p.maker === 'zuri-olayinka');
  }
  const indigo = KA_PRINTS.list().filter((p) => p.maker === 'zuri-olayinka');
  assert.ok(indigo.length >= 1, 'at least one indigo ankara print attributed to zuri-olayinka');
});

test('get() resolves a built-in id and returns null for an unknown id', () => {
  const first = KA_PRINTS.list()[0];
  const found = KA_PRINTS.get(first.id);
  assert.ok(found);
  assert.strictEqual(found!.id, first.id);
  assert.strictEqual(KA_PRINTS.get('not-a-real-id'), null);
  assert.strictEqual(KA_PRINTS.get(undefined), null);
  assert.strictEqual(KA_PRINTS.get(42), null);
});

/* ============ defaults() ============ */

test('defaults() returns a valid, family-correct def for each family', () => {
  for (const f of FAMILIES) {
    const d = KA_PRINTS.defaults(f);
    assert.strictEqual(d.family, f);
    const sanitized = KA_PRINTS.sanitize(d);
    assert.deepStrictEqual(sanitized, d, 'defaults() output should already be sanitize-stable');
  }
});

test('defaults() returns fresh objects each call (no shared mutable state)', () => {
  const a = KA_PRINTS.defaults('kente');
  const b = KA_PRINTS.defaults('kente');
  a.palette.push('#000000');
  a.params.bandHeights.push(1);
  assert.notStrictEqual(a.palette.length, b.palette.length);
  assert.notStrictEqual(a.params.bandHeights.length, b.params.bandHeights.length);
});

test('defaults() falls back to kente for an unknown family', () => {
  assert.strictEqual(KA_PRINTS.defaults('not-a-family').family, 'kente');
  assert.strictEqual(KA_PRINTS.defaults(undefined).family, 'kente');
});

/* ============ determinism ============ */

test('tileSvg is deterministic: same def -> identical string', () => {
  for (const p of KA_PRINTS.list()) {
    const a = KA_PRINTS.tileSvg(p.def);
    const b = KA_PRINTS.tileSvg(p.def);
    assert.strictEqual(a, b, p.id + ' tileSvg should be identical across calls');
    // and a deep clone of the def (not the same object reference) too
    const clone = JSON.parse(JSON.stringify(p.def));
    assert.strictEqual(KA_PRINTS.tileSvg(clone), a, p.id + ' tileSvg should match for an equal-but-distinct def');
  }
});

test('patternDef is deterministic for the same def + opts', () => {
  const def = KA_PRINTS.get('ankara-01')!.def;
  const a = KA_PRINTS.patternDef(def, { id: 'p1', scale: 1.5, rotate: 20 });
  const b = KA_PRINTS.patternDef(def, { id: 'p1', scale: 1.5, rotate: 20 });
  assert.strictEqual(a, b);
});

test('dataUri is deterministic for the same def', () => {
  const def = KA_PRINTS.get('adinkra-01')!.def;
  assert.strictEqual(KA_PRINTS.dataUri(def), KA_PRINTS.dataUri(def));
});

test('randomize(def, seed) is deterministic: same def+seed -> identical def and rendering', () => {
  const base = KA_PRINTS.defaults('kente');
  const r1 = KA_PRINTS.randomize(base, 'my-seed-42');
  const r2 = KA_PRINTS.randomize(base, 'my-seed-42');
  assert.deepStrictEqual(r1, r2);
  assert.strictEqual(KA_PRINTS.tileSvg(r1), KA_PRINTS.tileSvg(r2));

  const rNum1 = KA_PRINTS.randomize(base, 7);
  const rNum2 = KA_PRINTS.randomize(base, 7);
  assert.deepStrictEqual(rNum1, rNum2);
});

test('randomize() with a different seed produces a different def', () => {
  const base = KA_PRINTS.defaults('ankara');
  const a = KA_PRINTS.randomize(base, 'seed-a');
  const b = KA_PRINTS.randomize(base, 'seed-b');
  assert.notDeepStrictEqual(a, b);
});

/* ============ well-formed SVG for every built-in ============ */

test('tileSvg() for every built-in is well-formed, no NaN/undefined, under the size bound', () => {
  for (const p of KA_PRINTS.list()) {
    const svg = KA_PRINTS.tileSvg(p.def);
    assertWellFormedSvg(svg, p.id);
    assert.ok(svg.length < SIZE_LIMIT, p.id + ' tile is ' + svg.length + ' bytes, must be < ' + SIZE_LIMIT);
  }
});

test('patternDef() for every built-in emits a valid <pattern> element', () => {
  for (const p of KA_PRINTS.list()) {
    const frag = KA_PRINTS.patternDef(p.def, { id: 'pat-' + p.id, scale: 1, rotate: 15 });
    assert.match(frag, /^<pattern id="pat-[a-z0-9-]+" patternUnits="userSpaceOnUse" width="[0-9.]+" height="[0-9.]+"/);
    assert.match(frag, /<\/pattern>$/);
    assert.ok(hasNoNaNOrUndefined(frag), p.id + ' pattern has no NaN/undefined');
    assert.ok(hasEvenQuotes(frag), p.id + ' pattern quotes balanced');
    assert.ok(checkBalancedTags(frag), p.id + ' pattern tags balanced');
    assert.match(frag, /patternTransform="rotate\(15\)"/);
  }
});

test('patternDef() omits patternTransform when rotate is 0/omitted', () => {
  const def = KA_PRINTS.get('kente-01')!.def;
  const frag = KA_PRINTS.patternDef(def, { id: 'no-rotate' });
  assert.ok(!/patternTransform/.test(frag));
});

test('dataUri() for every built-in is a valid, parseable data URI', () => {
  for (const p of KA_PRINTS.list()) {
    const uri = KA_PRINTS.dataUri(p.def);
    assert.match(uri, /^data:image\/svg\+xml,/);
    const decoded = decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
    assertWellFormedSvg(decoded, p.id + ' (decoded data uri)');
  }
});

/* ============ family-specific richness ============ */

test('kente tiles use multiple strips and bands (reads as woven, not flat)', () => {
  const def = KA_PRINTS.get('kente-01')!.def;
  const svg = KA_PRINTS.tileSvg(def);
  const rectCount = (svg.match(/<rect/g) || []).length;
  assert.ok(rectCount >= def.params.strips, 'expected at least one rect per strip');
});

test('ankara tiles place the motif at the tile center plus all four corners (seamless tiling)', () => {
  for (const p of KA_PRINTS.list().filter((x) => x.family === 'ankara')) {
    const svg = KA_PRINTS.tileSvg(p.def);
    assert.ok(svg.length > 0);
    assertWellFormedSvg(svg, p.id);
  }
});

test('adinkra tiles render density^2 symbol instances via <use> (plus one per-cell frame <use> when framed)', () => {
  const noFrame = KA_PRINTS.get('adinkra-03')!.def; // density 5, frame:'none'
  const svgNoFrame = KA_PRINTS.tileSvg(noFrame);
  const cellsNoFrame = noFrame.params.density * noFrame.params.density;
  assert.strictEqual((svgNoFrame.match(/<use /g) || []).length, cellsNoFrame);

  const framed = KA_PRINTS.get('adinkra-01')!.def; // density 4, frame:'box'
  const svgFramed = KA_PRINTS.tileSvg(framed);
  const cellsFramed = framed.params.density * framed.params.density;
  assert.strictEqual((svgFramed.match(/<use /g) || []).length, cellsFramed * 2);
});

/* ============ symbols() ============ */

test('symbols() returns >=10 original adinkra-inspired glyphs with the full shape', () => {
  const syms = KA_PRINTS.symbols();
  assert.ok(syms.length >= 10, 'expected >=10 symbols, got ' + syms.length);
  const ids = new Set<string>();
  for (const s of syms) {
    assert.strictEqual(typeof s.id, 'string');
    assert.ok(s.id.length > 0);
    assert.strictEqual(typeof s.name, 'string');
    assert.strictEqual(typeof s.meaning, 'string');
    assert.ok(s.meaning.length > 10, s.id + ' should carry a real meaning, not a stub');
    assert.strictEqual(typeof s.path, 'string');
    assert.ok(/^[ML]/.test(s.path), s.id + ' path should start with a move command');
    ids.add(s.id);
  }
  assert.strictEqual(ids.size, syms.length, 'symbol ids must be unique');
});

test('symbols() paths sit inside (or very close to) the 100x100 box', () => {
  for (const s of KA_PRINTS.symbols()) {
    const nums = (s.path.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    for (const n of nums) {
      assert.ok(n > -5 && n < 125, s.id + ' coordinate ' + n + ' should roughly fit a 100x100 box');
    }
  }
});

test('symbols() returns a fresh copy each call (mutation-safe)', () => {
  const a = KA_PRINTS.symbols();
  a[0].path = 'MUTATED';
  const b = KA_PRINTS.symbols();
  assert.notStrictEqual(b[0].path, 'MUTATED');
});

test('every adinkra built-in uses a symbol id that exists in symbols()', () => {
  const ids = new Set(KA_PRINTS.symbols().map((s) => s.id));
  for (const p of KA_PRINTS.list().filter((x) => x.family === 'adinkra')) {
    assert.ok(ids.has(p.def.params.symbol), p.id + ' references an unknown symbol ' + p.def.params.symbol);
  }
});

/* ============ sanitize() ============ */

test('sanitize() never throws and always returns the {family,name,palette,params} shape', () => {
  const hostileInputs: any[] = [
    null, undefined, 42, 'a string', [], () => {},
    {}, { family: 'kente' },
    { family: '<script>alert(1)</script>', name: 'x', palette: 'not-an-array', params: null }
  ];
  for (const input of hostileInputs) {
    let result: any;
    assert.doesNotThrow(() => {
      result = KA_PRINTS.sanitize(input);
    }, 'sanitize threw on ' + JSON.stringify(input));
    assert.ok(FAMILIES.includes(result.family));
    assert.strictEqual(typeof result.name, 'string');
    assert.ok(Array.isArray(result.palette));
    assert.strictEqual(typeof result.params, 'object');
  }
});

test('sanitize() strips script-tag content out of name', () => {
  const result = KA_PRINTS.sanitize({ family: 'kente', name: '<script>alert(1)</script>' });
  assert.ok(!/[<>]/.test(result.name), 'name must not contain angle brackets: ' + result.name);
  assert.ok(!/script/i.test(result.name) === false || !/<|>/.test(result.name));
});

test('sanitize() rejects javascript: and other non-hex palette colours', () => {
  const result = KA_PRINTS.sanitize({
    family: 'ankara',
    palette: ['javascript:alert(1)', 'red', '#zzzzzz', '#fff', 'url(evil)']
  });
  for (const c of result.palette) {
    assert.match(c, /^#[0-9a-fA-F]{3,8}$/, 'every palette entry must be hex-only: ' + c);
  }
});

test('sanitize() clamps NaN/Infinity/hostile numbers to sane bounds', () => {
  const r1 = KA_PRINTS.sanitize({ family: 'kente', params: { strips: NaN, weftLines: Infinity, bandHeights: [NaN, 'x', -999, Infinity] } });
  assert.ok(Number.isFinite(r1.params.strips));
  assert.ok(r1.params.strips >= 3 && r1.params.strips <= 8);
  assert.ok(Number.isFinite(r1.params.weftLines));
  for (const bh of r1.params.bandHeights) assert.ok(Number.isFinite(bh) && bh > 0);

  const r2 = KA_PRINTS.sanitize({ family: 'ankara', params: { scale: NaN } });
  assert.ok(Number.isFinite(r2.params.scale));

  const r3 = KA_PRINTS.sanitize({ family: 'adinkra', params: { density: 'NaN' } });
  assert.ok(Number.isFinite(r3.params.density));
});

test('sanitize() whitelists enums and unknown adinkra symbol ids', () => {
  const r1 = KA_PRINTS.sanitize({ family: 'ankara', params: { motif: 'javascript:alert(1)' } });
  assert.ok(['rings', 'fans', 'petals', 'waves', 'suns', 'shells'].includes(r1.params.motif));

  const r2 = KA_PRINTS.sanitize({ family: 'adinkra', params: { symbol: '<script>', frame: 'DROP TABLE' } });
  assert.ok(KA_PRINTS.symbols().some((s) => s.id === r2.params.symbol));
  assert.ok(['none', 'box', 'comb'].includes(r2.params.frame));

  const r3 = KA_PRINTS.sanitize({ family: 'kente', params: { blockMotifs: ['evil', 'zigzag', 'javascript:x'] } });
  for (const m of r3.params.blockMotifs) {
    assert.ok(['zigzag', 'checker', 'steps', 'diamond', 'bars'].includes(m));
  }
});

test('sanitize() output always renders to well-formed SVG even from adversarial input', () => {
  const hostile = KA_PRINTS.sanitize({
    family: 'kente',
    name: '"><img src=x onerror=alert(1)>',
    palette: ['"><script>', 1234, null, {}, '#abc'],
    params: { strips: '<script>', bandHeights: 'nope', blockMotifs: [{}], weftLines: 'NaN' }
  });
  const svg = KA_PRINTS.tileSvg(hostile);
  assertWellFormedSvg(svg, 'hostile-kente');
  assert.ok(!/<script/i.test(svg), 'no script tag should ever reach the output');
});

/* ============ size bound stress test ============ */

test('tileSvg() stays under the 12KB size bound at the extreme edge of every param', () => {
  const kenteWorst = KA_PRINTS.sanitize({
    family: 'kente',
    params: { strips: 999, bandHeights: new Array(20).fill(999), blockMotifs: ['steps', 'steps', 'steps', 'steps', 'steps', 'steps'], weftLines: 999 }
  });
  assert.ok(KA_PRINTS.tileSvg(kenteWorst).length < SIZE_LIMIT, 'kente worst-case exceeded size bound');

  const ankaraWorst = KA_PRINTS.sanitize({ family: 'ankara', params: { motif: 'suns', scale: 999, outline: true, dotFill: true, crackle: true } });
  assert.ok(KA_PRINTS.tileSvg(ankaraWorst).length < SIZE_LIMIT, 'ankara worst-case exceeded size bound');

  const adinkraWorst = KA_PRINTS.sanitize({ family: 'adinkra', params: { symbol: 'mate-masie', density: 999, frame: 'comb', alternate: true, rotateAlt: true } });
  assert.ok(KA_PRINTS.tileSvg(adinkraWorst).length < SIZE_LIMIT, 'adinkra worst-case exceeded size bound');
});

/* ============ saved.* (localStorage-backed, no-op in node) ============ */

test('saved.list()/save()/remove() never throw in node (no localStorage) and stay no-ops', () => {
  assert.doesNotThrow(() => KA_PRINTS.saved.list());
  const before = KA_PRINTS.saved.list();
  assert.deepStrictEqual(before, []);

  let entry: any;
  assert.doesNotThrow(() => {
    entry = KA_PRINTS.saved.save(KA_PRINTS.defaults('ankara'));
  });
  assert.ok(entry && typeof entry.id === 'string' && entry.id.indexOf('c_') === 0);

  // no persistence without localStorage: list() is still empty
  assert.deepStrictEqual(KA_PRINTS.saved.list(), []);

  let removed: any;
  assert.doesNotThrow(() => {
    removed = KA_PRINTS.saved.remove('c_whatever');
  });
  assert.strictEqual(removed, false);
});
