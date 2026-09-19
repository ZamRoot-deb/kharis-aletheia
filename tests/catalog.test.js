/* KHARIS & ALETHEIA — catalog data-integrity tests (per CONTRACT.md)
   products.js is a browser script (assigns to window.*), so it's evaluated in a vm sandbox with
   a window stub and the resulting plain arrays/objects are asserted against directly.
   Run: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function loadBrowserGlobal(file) {
  const sandbox = { window: null };
  sandbox.window = sandbox;
  sandbox.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} };
  sandbox.console = console;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  return sandbox;
}

const sandbox = loadBrowserGlobal('products.js');
const KA_PRODUCTS = sandbox.KA_PRODUCTS;
const KA_CAT_LABEL = sandbox.KA_CAT_LABEL;
const KA_COLLECTIONS = sandbox.KA_COLLECTIONS;
const KA_MAKERS = sandbox.KA_MAKERS;
const KA_LOOKS = sandbox.KA_LOOKS;

test('products.js defines every documented global', () => {
  assert.ok(Array.isArray(KA_PRODUCTS) && KA_PRODUCTS.length > 0, 'KA_PRODUCTS must be a non-empty array');
  assert.ok(KA_CAT_LABEL && typeof KA_CAT_LABEL === 'object', 'KA_CAT_LABEL must be an object');
  assert.ok(Array.isArray(KA_COLLECTIONS) && KA_COLLECTIONS.length > 0, 'KA_COLLECTIONS must be a non-empty array');
  assert.ok(Array.isArray(KA_MAKERS) && KA_MAKERS.length > 0, 'KA_MAKERS must be a non-empty array');
  assert.ok(Array.isArray(KA_LOOKS) && KA_LOOKS.length > 0, 'KA_LOOKS must be a non-empty array');
});

/* ============ KA_PRODUCTS ============ */

test('every product id is unique', () => {
  const ids = KA_PRODUCTS.map(p => p.id);
  const unique = new Set(ids);
  assert.strictEqual(unique.size, ids.length, 'duplicate ids: ' + ids.filter((id, i) => ids.indexOf(id) !== i).join(', '));
});

test('every product has a non-empty string id and name', () => {
  for (const p of KA_PRODUCTS) {
    assert.strictEqual(typeof p.id, 'string', p.id + ': id must be a string');
    assert.ok(p.id.length > 0, 'product has an empty id');
    assert.strictEqual(typeof p.name, 'string', p.id + ': name must be a string');
    assert.ok(p.name.trim().length > 0, p.id + ': name must not be empty');
  }
});

test('every product img file exists on disk', () => {
  for (const p of KA_PRODUCTS) {
    const full = path.join(ROOT, p.img);
    assert.ok(fs.existsSync(full) && fs.statSync(full).isFile(), `${p.id}: image not found at ${p.img}`);
  }
});

test('every product price is a finite number > 0', () => {
  for (const p of KA_PRODUCTS) {
    assert.strictEqual(typeof p.price, 'number', `${p.id}: price must be a number`);
    assert.ok(Number.isFinite(p.price) && p.price > 0, `${p.id}: price must be > 0, got ${p.price}`);
  }
});

test('every product cat is a known category in KA_CAT_LABEL', () => {
  for (const p of KA_PRODUCTS) {
    assert.ok(Object.prototype.hasOwnProperty.call(KA_CAT_LABEL, p.cat), `${p.id}: unknown cat "${p.cat}"`);
  }
});

test('every non-null product collection is a real KA_COLLECTIONS slug', () => {
  const slugs = new Set(KA_COLLECTIONS.map(c => c.slug));
  for (const p of KA_PRODUCTS) {
    if (p.collection == null) continue; // null is a valid "no collection" state
    assert.ok(slugs.has(p.collection), `${p.id}: unknown collection "${p.collection}"`);
  }
});

test('every product maker is either null or a real KA_MAKERS slug', () => {
  const slugs = new Set(KA_MAKERS.map(m => m.slug));
  for (const p of KA_PRODUCTS) {
    assert.ok(p.maker === null || (typeof p.maker === 'string' && slugs.has(p.maker)), `${p.id}: maker must be null or a known slug, got ${JSON.stringify(p.maker)}`);
  }
});

test('every product has a tags array (possibly empty) and a details string', () => {
  for (const p of KA_PRODUCTS) {
    assert.ok(Array.isArray(p.tags), `${p.id}: tags must be an array`);
    assert.strictEqual(typeof p.details, 'string', `${p.id}: details must be a string`);
    assert.ok(p.details.trim().length > 0, `${p.id}: details must not be empty`);
    assert.strictEqual(typeof p.blurb, 'string', `${p.id}: blurb must be a string`);
    assert.ok(p.blurb.trim().length > 0, `${p.id}: blurb must not be empty`);
  }
});

test('c11..c14 exist and are all sold:true (the custom-prints one-of-ones)', () => {
  for (const id of ['c11', 'c12', 'c13', 'c14']) {
    const p = KA_PRODUCTS.find(x => x.id === id);
    assert.ok(p, `${id} must exist in KA_PRODUCTS`);
    assert.strictEqual(p.sold, true, `${id} must be sold:true`);
    assert.strictEqual(p.collection, 'custom-prints', `${id} must belong to the custom-prints collection`);
  }
});

test('sold is either exactly true or left undefined — never a falsy placeholder like false/0/""', () => {
  for (const p of KA_PRODUCTS) {
    if ('sold' in p) assert.strictEqual(p.sold, true, `${p.id}: sold must be exactly true when present`);
  }
});

test('KA_PRODUCTS has at least one product in each of tees, sweatshirts and accessories', () => {
  const cats = new Set(KA_PRODUCTS.filter(p => !p.sold).map(p => p.cat));
  for (const cat of Object.keys(KA_CAT_LABEL)) {
    assert.ok(cats.has(cat), `no available (non-sold) product in category "${cat}"`);
  }
});

/* ============ KA_COLLECTIONS ============ */

test('every collection has {slug,name,tag,blurb,img} and its image exists on disk', () => {
  const seenSlugs = new Set();
  for (const c of KA_COLLECTIONS) {
    for (const field of ['slug', 'name', 'tag', 'blurb', 'img']) {
      assert.strictEqual(typeof c[field], 'string', `collection missing string field "${field}": ${JSON.stringify(c)}`);
      assert.ok(c[field].trim().length > 0, `collection field "${field}" is empty: ${JSON.stringify(c)}`);
    }
    assert.ok(!seenSlugs.has(c.slug), `duplicate collection slug "${c.slug}"`);
    seenSlugs.add(c.slug);
    const full = path.join(ROOT, c.img);
    assert.ok(fs.existsSync(full) && fs.statSync(full).isFile(), `collection "${c.slug}": image not found at ${c.img}`);
  }
});

test('every required collection slug from CONTRACT.md is present', () => {
  const slugs = new Set(KA_COLLECTIONS.map(c => c.slug));
  for (const slug of ['kente-codes', 'adinkra-series', 'ankara-after-dark', 'wraps-caps', 'custom-prints']) {
    assert.ok(slugs.has(slug), `missing required collection slug "${slug}"`);
  }
});

test('every collection has at least one product (except a brand-new capsule with none yet is still flagged for visibility)', () => {
  const counts = {};
  for (const p of KA_PRODUCTS) if (p.collection) counts[p.collection] = (counts[p.collection] || 0) + 1;
  for (const c of KA_COLLECTIONS) {
    assert.ok((counts[c.slug] || 0) > 0, `collection "${c.slug}" has zero products`);
  }
});

/* ============ KA_MAKERS ============ */

test('every maker has the documented fields, a valid status, and a real collection slug', () => {
  const collectionSlugs = new Set(KA_COLLECTIONS.map(c => c.slug));
  const seenSlugs = new Set();
  for (const m of KA_MAKERS) {
    for (const field of ['slug', 'name', 'series', 'city', 'bio', 'long']) {
      assert.strictEqual(typeof m[field], 'string', `maker missing string field "${field}": ${JSON.stringify(m)}`);
      assert.ok(m[field].trim().length > 0, `maker field "${field}" is empty: ${JSON.stringify(m)}`);
    }
    assert.ok(!seenSlugs.has(m.slug), `duplicate maker slug "${m.slug}"`);
    seenSlugs.add(m.slug);
    assert.ok(['live', 'upcoming'].includes(m.status), `maker "${m.slug}": status must be 'live' or 'upcoming', got ${JSON.stringify(m.status)}`);
    assert.ok(collectionSlugs.has(m.collection), `maker "${m.slug}": unknown collection "${m.collection}"`);
  }
});

test('every required maker slug from CONTRACT.md is present', () => {
  const slugs = new Set(KA_MAKERS.map(m => m.slug));
  for (const slug of ['efua-mensah', 'kwame-asante', 'zuri-olayinka']) {
    assert.ok(slugs.has(slug), `missing required maker slug "${slug}"`);
  }
});

test('a "live" maker has at least one product crediting them; an "upcoming" maker has none yet', () => {
  const counts = {};
  for (const p of KA_PRODUCTS) if (p.maker) counts[p.maker] = (counts[p.maker] || 0) + 1;
  for (const m of KA_MAKERS) {
    if (m.status === 'live') assert.ok((counts[m.slug] || 0) > 0, `live maker "${m.slug}" has no products crediting them`);
    else assert.strictEqual(counts[m.slug] || 0, 0, `upcoming maker "${m.slug}" should have no products yet, found ${counts[m.slug]}`);
  }
});

/* ============ KA_LOOKS ============ */

test('every look has {id,img,title,caption,productIds} with an existing image and non-empty productIds', () => {
  const seenIds = new Set();
  for (const l of KA_LOOKS) {
    assert.strictEqual(typeof l.id, 'string', `look missing string id: ${JSON.stringify(l)}`);
    assert.ok(!seenIds.has(l.id), `duplicate look id "${l.id}"`);
    seenIds.add(l.id);
    assert.strictEqual(typeof l.title, 'string');
    assert.ok(l.title.trim().length > 0, `look "${l.id}": title is empty`);
    assert.strictEqual(typeof l.caption, 'string');
    assert.ok(l.caption.trim().length > 0, `look "${l.id}": caption is empty`);
    assert.ok(Array.isArray(l.productIds) && l.productIds.length > 0, `look "${l.id}": productIds must be a non-empty array`);
    const full = path.join(ROOT, l.img);
    assert.ok(fs.existsSync(full) && fs.statSync(full).isFile(), `look "${l.id}": image not found at ${l.img}`);
  }
});

test('every KA_LOOKS productIds entry exists in KA_PRODUCTS', () => {
  const ids = new Set(KA_PRODUCTS.map(p => p.id));
  for (const l of KA_LOOKS) {
    for (const pid of l.productIds) {
      assert.ok(ids.has(pid), `look "${l.id}" references unknown product id "${pid}"`);
    }
  }
});

test('KA_LOOKS has at least 8 looks (look-1..look-8 per CONTRACT.md)', () => {
  assert.ok(KA_LOOKS.length >= 8, `expected >=8 looks, got ${KA_LOOKS.length}`);
  const ids = new Set(KA_LOOKS.map(l => l.id));
  for (let i = 1; i <= 8; i++) assert.ok(ids.has('look-' + i), `missing look-${i}`);
});
