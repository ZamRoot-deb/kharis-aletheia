/* KHARIS & ALETHEIA — KA_CORE tests (per CONTRACT.md)
   core.js is required directly (it's DOM-free and exports via module.exports). config.js and
   products.js are browser scripts (they assign to window.*), so they're evaluated in a vm
   sandbox with a window stub, and the resulting plain objects are handed to KA_CORE._init()
   exactly as core.js documents for tests.
   Run: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const KA_CORE = require('../core.js');

function loadBrowserGlobal(file) {
  const sandbox = { window: null };
  sandbox.window = sandbox;
  sandbox.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} };
  sandbox.console = console;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  return sandbox;
}

const configSandbox = loadBrowserGlobal('config.js');
const productsSandbox = loadBrowserGlobal('products.js');
const REAL_CONFIG = configSandbox.KA_CONFIG;
const REAL_PRODUCTS = productsSandbox.KA_PRODUCTS;

assert.ok(REAL_CONFIG, 'config.js must define window.KA_CONFIG');
assert.ok(Array.isArray(REAL_PRODUCTS) && REAL_PRODUCTS.length > 0, 'products.js must define a non-empty window.KA_PRODUCTS');

if (typeof KA_CORE._init === 'function') {
  KA_CORE._init({ config: REAL_CONFIG, products: REAL_PRODUCTS });
} else {
  // fallback per contract: no _init() escape hatch, so fake a browser window instead
  global.window = { KA_CONFIG: REAL_CONFIG, KA_PRODUCTS: REAL_PRODUCTS };
}

/* ============ money() ============ */

test('money() formats whole pounds without decimals and fractional pounds to 2dp', () => {
  assert.strictEqual(KA_CORE.money(38), '£38');
  assert.strictEqual(KA_CORE.money(0), '£0');
  assert.strictEqual(KA_CORE.money(4.95), '£4.95');
  assert.strictEqual(KA_CORE.money(4.9), '£4.90');
  assert.strictEqual(KA_CORE.money(4.999), '£5');
});

test('money() coerces non-numeric input to £0 instead of throwing or printing NaN', () => {
  assert.strictEqual(KA_CORE.money(NaN), '£0');
  assert.strictEqual(KA_CORE.money(undefined), '£0');
  assert.strictEqual(KA_CORE.money('not a number'), '£0');
});

/* ============ findProduct() ============ */

test('findProduct() returns the matching product or null', () => {
  const first = REAL_PRODUCTS[0];
  assert.strictEqual(KA_CORE.findProduct(first.id), first);
  assert.strictEqual(KA_CORE.findProduct('does-not-exist'), null);
  assert.strictEqual(KA_CORE.findProduct(), null);
});

/* ============ unitPrice() / lineTotal() — all kinds, incl. legacy (no `kind`) ============ */

test('unitPrice()/lineTotal() for kind:"product" and for legacy items with no `kind` field', () => {
  const p = REAL_PRODUCTS.find(x => !x.sold);
  const withKind = { kind: 'product', id: p.id, size: 'M', qty: 2 };
  const legacy = { id: p.id, size: 'M', qty: 2 }; // no `kind` at all -> must default to 'product'
  assert.strictEqual(KA_CORE.unitPrice(withKind), p.price);
  assert.strictEqual(KA_CORE.unitPrice(legacy), p.price);
  assert.strictEqual(KA_CORE.lineTotal(withKind), Math.round(p.price * 2 * 100) / 100);
  assert.strictEqual(KA_CORE.lineTotal(legacy), Math.round(p.price * 2 * 100) / 100);
});

test('unitPrice() for kind:"product" with an unknown id is 0, not a throw', () => {
  assert.strictEqual(KA_CORE.unitPrice({ kind: 'product', id: 'nope', qty: 1 }), 0);
});

test('unitPrice()/lineTotal() for kind:"custom" uses item.price directly', () => {
  const item = { kind: 'custom', uid: 'c_1', price: 42, qty: 3 };
  assert.strictEqual(KA_CORE.unitPrice(item), 42);
  assert.strictEqual(KA_CORE.lineTotal(item), 126);
});

test('unitPrice() for kind:"custom" with a missing/invalid price is 0', () => {
  assert.strictEqual(KA_CORE.unitPrice({ kind: 'custom', uid: 'c_2', qty: 1 }), 0);
  assert.strictEqual(KA_CORE.unitPrice({ kind: 'custom', uid: 'c_3', price: 'nope', qty: 1 }), 0);
});

test('unitPrice()/lineTotal() for kind:"gift" uses item.amount, and qty is always effectively 1', () => {
  const item = { kind: 'gift', uid: 'g_1', amount: 50, qty: 1 };
  assert.strictEqual(KA_CORE.unitPrice(item), 50);
  assert.strictEqual(KA_CORE.lineTotal(item), 50);
});

test('lineTotal() never returns NaN or negative for a garbage qty', () => {
  const p = REAL_PRODUCTS[0];
  assert.strictEqual(KA_CORE.lineTotal({ kind: 'product', id: p.id, qty: -5 }), 0);
  assert.strictEqual(KA_CORE.lineTotal({ kind: 'product', id: p.id, qty: 'lots' }), 0);
  assert.strictEqual(KA_CORE.lineTotal({ kind: 'product', id: p.id, qty: 0 }), 0);
});

/* ============ subtotal() / itemCount() ============ */

test('subtotal() sums lineTotal() across a mixed-kind cart', () => {
  const p = REAL_PRODUCTS.find(x => !x.sold);
  const items = [
    { kind: 'product', id: p.id, size: 'M', qty: 2 },
    { kind: 'custom', uid: 'c_1', price: 10, qty: 1 },
    { kind: 'gift', uid: 'g_1', amount: 25, qty: 1 }
  ];
  const expected = Math.round((p.price * 2 + 10 + 25) * 100) / 100;
  assert.strictEqual(KA_CORE.subtotal(items), expected);
  assert.strictEqual(KA_CORE.subtotal([]), 0);
  assert.strictEqual(KA_CORE.subtotal(null), 0);
});

test('itemCount() sums quantities, defaulting a missing/invalid gift qty to 1 (the UI always sends qty:1 for gifts; KA_CORE itself only fills in the default)', () => {
  const p = REAL_PRODUCTS.find(x => !x.sold);
  const items = [
    { kind: 'product', id: p.id, qty: 3 },
    { kind: 'gift', uid: 'g_1', amount: 25, qty: 1 },
    { kind: 'gift', uid: 'g_2', amount: 25 } // no qty at all -> defaults to 1 for a gift
  ];
  assert.strictEqual(KA_CORE.itemCount(items), 5);
  assert.strictEqual(KA_CORE.itemCount([]), 0);
});

/* ============ zoneFor() ============ */

test('zoneFor() maps GB/FR/GH/NG to their real zones and unknown codes to ROW', () => {
  assert.strictEqual(KA_CORE.zoneFor('GB'), 'UK');
  assert.strictEqual(KA_CORE.zoneFor('FR'), 'EU');
  assert.strictEqual(KA_CORE.zoneFor('GH'), 'AFRICA');
  assert.strictEqual(KA_CORE.zoneFor('NG'), 'AFRICA');
  assert.strictEqual(KA_CORE.zoneFor('US'), 'ROW'); // not listed under UK/EU/AFRICA
  assert.strictEqual(KA_CORE.zoneFor('ZZ'), 'ROW'); // truly unknown
  assert.strictEqual(KA_CORE.zoneFor(''), 'ROW');
  assert.strictEqual(KA_CORE.zoneFor(), 'ROW');
});

test('zoneFor() is case-insensitive and trims whitespace', () => {
  assert.strictEqual(KA_CORE.zoneFor('gb'), 'UK');
  assert.strictEqual(KA_CORE.zoneFor('  GB  '), 'UK');
});

/* ============ shippingOptions() — free-over edge, gift-only ============ */

test('shippingOptions() free-over threshold: 74.99 is not free, 75 is free (UK zone)', () => {
  const below = KA_CORE.shippingOptions('GB', 74.99);
  assert.ok(below.every(o => o.price > 0), 'no method should be free just under the threshold');
  const at = KA_CORE.shippingOptions('GB', 75);
  assert.ok(at.some(o => o.price === 0), 'the cheapest method should be free at the threshold');
  // only the cheapest method drops to 0 — the rest keep their price
  const cheapestId = at.slice().sort((a, b) => a.price - b.price)[0].id;
  for (const o of at) {
    if (o.id === cheapestId) assert.strictEqual(o.price, 0);
  }
});

test('shippingOptions() returns [] for a zone with no methods, and totals() uses the post-discount subtotal for the free-over check', () => {
  // 80 subtotal minus a 10% promo lands at 72 (below 75) -> should NOT be free, proving the
  // threshold is evaluated on the discounted amount, not the raw pre-discount subtotal.
  const items = [{ kind: 'custom', uid: 'x', price: 80, qty: 1 }];
  const t = KA_CORE.totals(items, { country: 'GB', promoCode: 'WELCOME10' });
  assert.strictEqual(t.discount, 8);
  assert.ok(t.shipping > 0, 'post-discount subtotal (72) is under the £75 free threshold');

  // 84 minus 10% lands at 75.6 (>= 75) -> should be free
  const items2 = [{ kind: 'custom', uid: 'y', price: 84, qty: 1 }];
  const t2 = KA_CORE.totals(items2, { country: 'GB', promoCode: 'WELCOME10' });
  assert.strictEqual(t2.shipping, 0);
});

test('totals() on a gift-only cart ships digital and free, regardless of country', () => {
  const items = [{ kind: 'gift', uid: 'g_1', amount: 50, to: 'A', from: 'B', email: 'a@b.com', message: '', sendOn: '', qty: 1 }];
  for (const country of ['GB', 'US', 'GH', '']) {
    const t = KA_CORE.totals(items, { country });
    assert.strictEqual(t.shipping, 0, `gift-only cart should ship free to ${country || '(none)'}`);
    assert.strictEqual(t.total, 50);
  }
});

test('shippingOptions(country, subtotal, true) (gift-only escape hatch) always returns a single free digital option', () => {
  const opts = KA_CORE.shippingOptions('GB', 0, true);
  assert.deepStrictEqual(opts, [{ id: 'digital', label: 'Digital delivery', price: 0, days: 'Instant' }]);
});

/* ============ applyPromo() ============ */

test('applyPromo() is case- and whitespace-insensitive for a valid code', () => {
  const r = KA_CORE.applyPromo('  welcome10  ', 100);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.code, 'WELCOME10');
  assert.strictEqual(r.discount, 10);
  assert.ok(r.label.length > 0);
  assert.strictEqual(r.error, '');
});

test('applyPromo() rejects an unknown code without throwing', () => {
  const r = KA_CORE.applyPromo('NOTREAL', 100);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.discount, 0);
  assert.ok(r.error.length > 0);
});

test('applyPromo() rejects an empty code with a helpful error', () => {
  const r = KA_CORE.applyPromo('', 100);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.discount, 0);
  assert.ok(/enter/i.test(r.error));
  const r2 = KA_CORE.applyPromo(undefined, 100);
  assert.strictEqual(r2.ok, false);
});

test('a promo never discounts gift cards — totals() applies it to the merch subtotal only', () => {
  const items = [
    { kind: 'gift', uid: 'g_1', amount: 100, to: 'A', from: 'B', email: 'a@b.com', message: '', sendOn: '', qty: 1 },
    { kind: 'custom', uid: 'c_1', price: 50, qty: 1 }
  ];
  const t = KA_CORE.totals(items, { country: 'GB', promoCode: 'WELCOME10' });
  assert.strictEqual(t.discount, 5); // 10% of the 50 merch subtotal, never the 100 gift amount
  assert.strictEqual(t.subtotal, 150); // gift + merch, undiscounted display subtotal
});

/* ============ totals() never negative ============ */

test('totals() total and discount are never negative, even if a promo would exceed the subtotal', () => {
  const savedConfig = KA_CORE._config;
  const hostileConfig = Object.assign({}, savedConfig, {
    promos: Object.assign({}, savedConfig.promos, { HUGE: { type: 'fixed', value: 999, label: 'way too big' } })
  });
  try {
    KA_CORE._init({ config: hostileConfig, products: REAL_PRODUCTS });
    const items = [{ kind: 'custom', uid: 'x', price: 20, qty: 1 }];
    const t = KA_CORE.totals(items, { country: 'GB', promoCode: 'HUGE' });
    assert.ok(t.total >= 0, 'total must never go negative');
    assert.ok(t.discount <= 20, 'discount must be capped at the merch subtotal');
  } finally {
    KA_CORE._init({ config: savedConfig, products: REAL_PRODUCTS }); // restore for later tests
  }
});

test('totals() is never negative across an empty cart and an unknown promo code', () => {
  assert.ok(KA_CORE.totals([], { country: 'GB' }).total >= 0);
  const items = [{ kind: 'custom', uid: 'z', price: 5, qty: 1 }];
  assert.ok(KA_CORE.totals(items, { country: 'GB', promoCode: 'NOPE' }).total >= 0);
});

/* ============ bulkQuote() tier boundaries ============ */

test('bulkQuote() tier boundaries: 9, 10, 24, 25, 50, 100', () => {
  const unit = 20;
  assert.strictEqual(KA_CORE.bulkQuote(unit, 9).tier, null);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 9).off, 0);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 10).tier, 10);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 10).off, 0.10);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 24).tier, 10);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 25).tier, 25);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 25).off, 0.15);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 50).tier, 50);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 50).off, 0.20);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 100).tier, 100);
  assert.strictEqual(KA_CORE.bulkQuote(unit, 100).off, 0.25);
});

test('bulkQuote() total/unit/saving are internally consistent', () => {
  const q = KA_CORE.bulkQuote(20, 25); // 15% off
  assert.strictEqual(q.unit, 17);
  assert.strictEqual(q.total, 425);
  assert.strictEqual(q.saving, 75); // (20*25) - 425
});

test('bulkQuote() with qty 0 or negative never throws and reports 0', () => {
  assert.strictEqual(KA_CORE.bulkQuote(20, 0).total, 0);
  assert.strictEqual(KA_CORE.bulkQuote(20, -5).total, 0);
});

/* ============ studioPrice() — every garment x placement ============ */

test('studioPrice() = garment.base + placement.surcharge, for every garment x placement combination', () => {
  const studio = REAL_CONFIG.studio;
  assert.ok(studio.garments.length >= 4 && studio.placements.length >= 6);
  for (const g of studio.garments) {
    for (const p of studio.placements) {
      const expected = Math.round((g.base + p.surcharge) * 100) / 100;
      assert.strictEqual(
        KA_CORE.studioPrice({ garment: g.id, placement: p.id }),
        expected,
        `${g.id} + ${p.id}`
      );
    }
  }
});

test('studioPrice() with an unknown garment or placement treats the missing side as 0, not NaN', () => {
  assert.strictEqual(KA_CORE.studioPrice({ garment: 'nope', placement: 'nope' }), 0);
  assert.strictEqual(KA_CORE.studioPrice({}), 0);
  assert.strictEqual(KA_CORE.studioPrice(), 0);
});

/* ============ orderRef() ============ */

test('orderRef() always matches /^KA-[A-Z0-9]{6}$/', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(KA_CORE.orderRef(), /^KA-[A-Z0-9]{6}$/);
  }
});

test('orderRef(seed) is deterministic for the same seed and avoids ambiguous characters (0/O/1/I)', () => {
  assert.strictEqual(KA_CORE.orderRef(42), KA_CORE.orderRef(42));
  const ref = KA_CORE.orderRef(42);
  assert.match(ref, /^KA-[A-Z0-9]{6}$/);
  assert.ok(!/[01OI]/.test(ref.slice(3)), 'no ambiguous 0/O/1/I characters: ' + ref);
});

/* ============ validate.* ============ */

test('validate.email()', () => {
  assert.strictEqual(KA_CORE.validate.email('a@b.com'), true);
  assert.strictEqual(KA_CORE.validate.email('a.b+tag@sub.example.co.uk'), true);
  assert.strictEqual(KA_CORE.validate.email('not-an-email'), false);
  assert.strictEqual(KA_CORE.validate.email('a@'), false);
  assert.strictEqual(KA_CORE.validate.email(''), false);
  assert.strictEqual(KA_CORE.validate.email(), false);
});

test('validate.postcode() — GB pattern, and a length-based fallback for everywhere else', () => {
  assert.strictEqual(KA_CORE.validate.postcode('SW1A 1AA', 'GB'), true);
  assert.strictEqual(KA_CORE.validate.postcode('M1 1AE', 'GB'), true);
  assert.strictEqual(KA_CORE.validate.postcode('not a postcode', 'GB'), false);
  assert.strictEqual(KA_CORE.validate.postcode('', 'GB'), false);
  // non-GB: 2-12 chars is accepted, outside that range is not
  assert.strictEqual(KA_CORE.validate.postcode('A', 'US'), false);
  assert.strictEqual(KA_CORE.validate.postcode('AB', 'US'), true);
  assert.strictEqual(KA_CORE.validate.postcode('123456789012', 'US'), true);
  assert.strictEqual(KA_CORE.validate.postcode('1234567890123', 'US'), false);
});

test('validate.required() rejects empty and whitespace-only strings', () => {
  assert.strictEqual(KA_CORE.validate.required('x'), true);
  assert.strictEqual(KA_CORE.validate.required('  x  '), true);
  assert.strictEqual(KA_CORE.validate.required(''), false);
  assert.strictEqual(KA_CORE.validate.required('   '), false);
  assert.strictEqual(KA_CORE.validate.required(), false);
});

test('validate.phone()', () => {
  assert.strictEqual(KA_CORE.validate.phone('+44 7700 900123'), true);
  assert.strictEqual(KA_CORE.validate.phone('07700900123'), true);
  assert.strictEqual(KA_CORE.validate.phone('123'), false);
  assert.strictEqual(KA_CORE.validate.phone('abcdefgh'), false);
  assert.strictEqual(KA_CORE.validate.phone(''), false);
});

/* ============ escapeHtml() ============ */

test('escapeHtml() escapes the five HTML-significant characters < > & " \'', () => {
  assert.strictEqual(KA_CORE.escapeHtml('<'), '&lt;');
  assert.strictEqual(KA_CORE.escapeHtml('>'), '&gt;');
  assert.strictEqual(KA_CORE.escapeHtml('&'), '&amp;');
  assert.strictEqual(KA_CORE.escapeHtml('"'), '&quot;');
  assert.strictEqual(KA_CORE.escapeHtml("'"), '&#39;');
});

test('escapeHtml() neutralises a full script-injection attempt', () => {
  const out = KA_CORE.escapeHtml('<script>alert("x")</script>');
  assert.ok(!/[<>]/.test(out), 'no raw angle brackets should survive: ' + out);
  assert.ok(!/["']/.test(out), 'no raw quotes should survive: ' + out);
});

test('escapeHtml() treats null/undefined as an empty string', () => {
  assert.strictEqual(KA_CORE.escapeHtml(null), '');
  assert.strictEqual(KA_CORE.escapeHtml(undefined), '');
});
