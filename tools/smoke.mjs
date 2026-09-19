#!/usr/bin/env node
/* KHARIS & ALETHEIA — tools/smoke.mjs
   Headless smoke run: for every root *.html, loads its <script src> files (classic scripts, in
   document order — the inline theme-bootstrap snippet runs first, exactly as a real page would)
   inside a node:vm context against a minimal fake DOM, and reports any exception thrown while
   the scripts execute at "page load" (top-level IIFEs, DOMContentLoaded-equivalent init calls).

   This is NOT a real browser and does not build a real DOM tree from the page's HTML — it's a
   permissive stub (a small recursive Proxy fallback for anything not explicitly modelled) so
   scripts that look up elements, bind listeners, or touch localStorage/location/etc. can run
   their normal init path without crashing on a missing global. Its job is to catch real
   JS errors (ReferenceError, TypeError, wrong-arity calls into KA_* APIs) that plain
   `node --check` syntax checking can't see, on file:// where there's no server-side console.

   Zero dependencies — Node built-ins only. Run: node tools/smoke.mjs */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ============================================================
   MINIMAL FAKE DOM — a small recursive Proxy stub
   ============================================================ */

function autoNoop() {
  // Callable AND property-accessible: `.foo()` and `.foo.bar()` both just work and never throw.
  const fn = function () { return autoNoop(); };
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === Symbol.iterator) return undefined;
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined; // not a Promise
      if (typeof prop === 'symbol') return undefined;
      if (prop in target) return target[prop];
      return autoNoop();
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

function makeClassList(getSet) {
  return {
    add(...c) { c.forEach(x => getSet().add(x)); },
    remove(...c) { c.forEach(x => getSet().delete(x)); },
    toggle(c, force) {
      const set = getSet();
      if (force === undefined) { if (set.has(c)) { set.delete(c); return false; } set.add(c); return true; }
      if (force) set.add(c); else set.delete(c);
      return !!force;
    },
    contains(c) { return getSet().has(c); },
    replace(o, n) { const set = getSet(); if (set.has(o)) { set.delete(o); set.add(n); return true; } return false; },
    toString() { return [...getSet()].join(' '); }
  };
}

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag || 'DIV').toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.childNodes = [];
    this.parentNode = null;
    this.parentElement = null;
    this.attributes = {};
    this._classSet = new Set();
    this.classList = makeClassList(() => this._classSet);
    this._listeners = {};
    this._value = '';
    this._html = '';
    this._text = '';
    this.checked = false;
    this.disabled = false;
    this.selected = false;
    this.hidden = false;
    this.id = '';
    this.dataset = new Proxy({}, {}); // plain read/write bag — el.dataset.foo = 'x' just works
    this.style = new Proxy({ cssText: '' }, {
      get(t, p) { return p in t ? t[p] : ''; },
      set(t, p, v) { t[p] = v; return true; }
    });
  }
  get className() { return [...this._classSet].join(' '); }
  set className(v) { this._classSet = new Set(String(v == null ? '' : v).split(/\s+/).filter(Boolean)); this.classList = makeClassList(() => this._classSet); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v == null ? '' : v); }
  get outerHTML() { return this._html; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v == null ? '' : v); }
  get innerText() { return this._text; }
  set innerText(v) { this._text = String(v == null ? '' : v); }
  get value() { return this._value; }
  set value(v) { this._value = v; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) { if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(f => f !== fn); }
  dispatchEvent(evt) { const list = this._listeners[evt && evt.type] || []; list.forEach(fn => { try { fn(evt); } catch (e) { /* swallow — a handler's own bug isn't a load-time bug */ } }); return true; }
  appendChild(child) { this.children.push(child); this.childNodes.push(child); if (child && typeof child === 'object') { child.parentNode = this; child.parentElement = this; } return child; }
  removeChild(child) { this.children = this.children.filter(c => c !== child); this.childNodes = this.childNodes.filter(c => c !== child); return child; }
  insertBefore(n) { this.appendChild(n); return n; }
  append(...nodes) { nodes.forEach(n => { if (n && typeof n === 'object') this.appendChild(n); }); }
  prepend(...nodes) { nodes.forEach(n => { if (n && typeof n === 'object') { this.children.unshift(n); this.childNodes.unshift(n); } }); }
  before() {} after() {}
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  cloneNode() { return new FakeNode(this.tagName); }
  contains() { return false; }
  closest() { return null; }
  matches() { return false; }
  focus() {} blur() {} click() { this.dispatchEvent({ type: 'click', target: this, preventDefault() {}, stopPropagation() {} }); }
  submit() {} reset() {} select() {} scrollIntoView() {} scrollTo() {}
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
  querySelector() { return makeElement('div'); }
  querySelectorAll() { return [makeElement('div')]; }
  getElementsByClassName() { return []; }
  getElementsByTagName() { return []; }
}

function makeElement(tag, depth) {
  const node = new FakeNode(tag);
  // Real pages virtually always have *something* inside a container a script queries (a grid
  // of cards, a carousel track, a list) — an empty-by-default stub causes exactly the kind of
  // "array was empty" crash a real page never hits. Pre-populate a couple of generic children
  // (shallow) so code that reads .children/.firstChild/[0] exercises its normal path instead of
  // tripping over a harness artifact. Depth-limited so this stays cheap and terminates.
  if (depth === undefined) depth = 2;
  if (depth > 0) {
    for (let i = 0; i < 2; i++) node.appendChild(makeElement('div', depth - 1));
  }
  return new Proxy(node, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      if (prop in target || typeof target[prop] !== 'undefined') return Reflect.get(target, prop, receiver);
      // unknown member (e.g. .animate, .showModal, .play, .requestFullscreen…) — safe no-op
      return autoNoop();
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

function buildDocument(bodyDataPage) {
  const body = makeElement('body');
  body.dataset.page = bodyDataPage || '';
  const documentElement = makeElement('html');
  const head = makeElement('head');

  const doc = {
    documentElement,
    head,
    body,
    title: '',
    readyState: 'complete',
    cookie: '',
    createElement(tag) { return makeElement(tag); },
    createDocumentFragment() { return makeElement('#fragment'); },
    createTextNode(t) { return { nodeType: 3, textContent: String(t) }; },
    getElementById(id) { const el = makeElement('div'); el.id = id; return el; },
    querySelector(sel) { return makeElement('div'); },
    querySelectorAll(sel) { return [makeElement('div')]; },
    getElementsByClassName() { return []; },
    getElementsByTagName() { return []; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  };
  return doc;
}

function buildLocalStorage() {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    key(i) { return [...store.keys()][i] ?? null; },
    get length() { return store.size; }
  };
}

class FakeIntersectionObserver {
  constructor(cb) { this.cb = cb; }
  observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
}

function buildSandbox(file, bodyDataPage) {
  const localStorageImpl = buildLocalStorage();
  const document = buildDocument(bodyDataPage);
  const listeners = {};
  const locationObj = {
    href: 'file://' + path.join(ROOT, file),
    protocol: 'file:', host: '', hostname: '', port: '',
    pathname: '/' + file, search: '', hash: '', origin: 'null',
    assign() {}, replace() {}, reload() {}, toString() { return this.href; }
  };
  const sandbox = {
    console,
    localStorage: localStorageImpl,
    sessionStorage: buildLocalStorage(),
    document,
    location: locationObj,
    history: {
      state: null, length: 1,
      pushState() {}, replaceState() {}, back() {}, forward() {}, go() {}
    },
    navigator: { userAgent: 'node-smoke', language: 'en-GB', clipboard: undefined, share: undefined, onLine: true },
    URLSearchParams,
    URL,
    Blob: typeof Blob !== 'undefined' ? Blob : class Blob { constructor(parts, opts) { this.parts = parts; this.opts = opts; } },
    IntersectionObserver: FakeIntersectionObserver,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    matchMedia(query) {
      return { matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
    },
    requestAnimationFrame(fn) { return setTimeout(() => fn(Date.now()), 0); },
    cancelAnimationFrame(id) { clearTimeout(id); },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch() { return Promise.reject(new Error('fetch stubbed — no network in smoke context')); },
    alert() {}, confirm() { return false; }, prompt() { return null; },
    getComputedStyle() { return new Proxy({}, { get: () => '' }); },
    performance: { now: () => Date.now() },
    crypto: (typeof globalThis.crypto !== 'undefined') ? globalThis.crypto : { getRandomValues(arr) { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn); },
    dispatchEvent() { return true; },
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    scrollX: 0, scrollY: 0, scrollTo() {}, scroll() {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

/* ============================================================
   PER-PAGE RUN
   ============================================================ */

function extractDataPage(html) {
  const m = /<body\b([^>]*)>/i.exec(html);
  if (!m) return '';
  const pm = /\bdata-page\s*=\s*["']([^"']*)["']/i.exec(m[1]);
  return pm ? pm[1] : '';
}

function extractScriptSrcs(html) {
  const re = /<script\s+src\s*=\s*["']([^"']+)["'][^>]*><\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function extractInlineBootstrap(html) {
  const headEnd = html.search(/<\/head>/i);
  const headContent = headEnd === -1 ? html : html.slice(0, headEnd);
  const m = /<script>([^<]*data-theme[^<]*ka_theme[^<]*)<\/script>/i.exec(headContent);
  return m ? m[1] : null;
}

function readRootHtmlFiles() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.html'))
    .map(d => d.name)
    .sort();
}

function runPage(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const dataPage = extractDataPage(html);
  const scripts = extractScriptSrcs(html);
  const bootstrap = extractInlineBootstrap(html);
  const sandbox = buildSandbox(file, dataPage);

  try {
    if (bootstrap) vm.runInContext(bootstrap, sandbox, { filename: file + '#bootstrap' });
    for (const src of scripts) {
      const full = path.join(ROOT, src);
      if (!fs.existsSync(full)) return { file, ok: false, error: `script not found on disk: ${src}` };
      const code = fs.readFileSync(full, 'utf8');
      vm.runInContext(code, sandbox, { filename: src });
    }
    return { file, ok: true };
  } catch (e) {
    return { file, ok: false, error: (e && e.stack) ? e.stack : String(e) };
  }
}

/* ============================================================ */

const files = readRootHtmlFiles();
const results = files.map(runPage);
const failures = results.filter(r => !r.ok);

for (const r of results) {
  console.log((r.ok ? 'OK   ' : 'FAIL ') + r.file);
  if (!r.ok) console.log('  ' + r.error.split('\n').join('\n  '));
}

console.log('');
console.log(`${results.length - failures.length}/${results.length} pages loaded their scripts without an exception.`);
console.log(failures.length ? 'FAIL' : 'PASS');
process.exit(failures.length ? 1 : 0);
