#!/usr/bin/env node
/* KHARIS & ALETHEIA — tools/check-links.mjs
   Every local href/src/srcset/poster in *.html, every url(...) in *.css, and every string
   literal in *.js that looks like a local .html/.jpg/.jpeg/.png/.webp/.svg/.gif path must
   resolve to a real file. Every '#anchor' must resolve to a real id= in its target page, or be
   a known JS-handled hash (shop.html category hashes tees|sweatshirts|accessories, studio.html
   '#print=' style key=value hashes, lookbook.html '#look-N' cards set by lookbook.js at render).

   --dead-ends: a separate pass — FAIL if any <a> whose visible text mentions "Tee Studio",
   "Print Lab", "Crew & Bulk", "Gift Card(s)", "Get notified", or a named collection still
   points at plain shop.html (no hash/query), index.html#studios, or a bare '#'.

   Zero dependencies — Node built-ins only. Run: node tools/check-links.mjs [--dead-ends] */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEAD_ENDS = process.argv.includes('--dead-ends');

const problems = [];
const seen = new Set();

function rel(p) { return path.relative(ROOT, p) || p; }
function report(file, line, target) {
  const entry = `${rel(file)}:${line} → ${target}`;
  // the same real problem can legitimately be found twice by two independent extraction passes
  // (e.g. an href="…" both matches the attribute scan and, standing alone, the whole-string-
  // literal scan) — de-duplicate so each genuine problem is only reported once.
  if (seen.has(entry)) return;
  seen.add(entry);
  problems.push(entry);
}

function readRootFiles(ext) {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith(ext))
    .map(d => d.name)
    .sort();
}

/* ---------- line-number lookup (binary search over newline offsets) ---------- */
function makeLineFinder(content) {
  const offsets = [0];
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) offsets.push(i + 1);
  return function lineAt(index) {
    if (index < 0) return 1;
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= index) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
}

/* ---------- shared classification ---------- */
/* a whole string must look EXACTLY like a local path, start to end — this is what keeps big
   HTML-template strings (which merely *contain* "href=...html" somewhere in the middle) and
   comment prose (an apostrophe inside a comment can look like a stray string start) from ever
   being mistaken for a path. */
const FULL_LOCAL_PATH_RE = /^(?:\.\.?\/)?[\w./-]+\.(html?|jpe?g|png|webp|svg|gif)(?:\?[\w=&%./-]*)?(?:#[\w=&%.:/-]*)?$/i;
/* the leading run of path-safe characters in a raw attribute value pulled out of JS source —
   used to find the static portion of a value built by concatenation/interpolation. */
const PATH_SAFE_PREFIX_RE = /^[\w./#=&%-]*/;

function isIgnorable(raw) {
  const v = (raw || '').trim();
  if (!v) return true;
  if (/^(https?:)?\/\//i.test(v)) return true;          // external / protocol-relative
  if (/^(mailto:|tel:|data:|javascript:)/i.test(v)) return true;
  if (v === '#') return true;                            // javascript-free '#'
  return false;
}

/* splits "path/to/file.ext?x=1#hash" into { pathPart, hash } */
function splitPathHash(raw) {
  let v = raw.trim();
  let hash = '';
  const hashIdx = v.indexOf('#');
  if (hashIdx !== -1) { hash = v.slice(hashIdx + 1); v = v.slice(0, hashIdx); }
  const qIdx = v.indexOf('?');
  if (qIdx !== -1) v = v.slice(0, qIdx);
  return { pathPart: v, hash };
}

function isKnownJsHash(targetBasename, hash) {
  if (!hash) return true; // nothing to check
  if (targetBasename === 'shop.html') {
    return hash === 'tees' || hash === 'sweatshirts' || hash === 'accessories';
  }
  if (targetBasename === 'studio.html') {
    return hash.indexOf('=') !== -1; // key=value style (print=, or g=&c=&p=...)
  }
  if (targetBasename === 'lookbook.html') {
    return /^look-\d+$/.test(hash); // lookbook.js sets id="look-N" on each card at render
  }
  return false;
}

/* ---------- html id index (memoized) ---------- */
const idCache = new Map();
function idsOf(file) {
  if (idCache.has(file)) return idCache.get(file);
  let ids = new Set();
  try {
    const content = fs.readFileSync(file, 'utf8');
    const re = /\bid=["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(content))) ids.add(m[1]);
  } catch (e) { /* file missing — handled by the caller via existsSync */ }
  idCache.set(file, ids);
  return ids;
}

/* ============================================================
   STANDARD LINK CHECK
   ============================================================ */
function checkHtmlFiles() {
  const files = readRootFiles('.html');
  for (const name of files) {
    const full = path.join(ROOT, name);
    const content = fs.readFileSync(full, 'utf8');
    const lineAt = makeLineFinder(content);

    const attrRe = /\b(href|src|poster|srcset)\s*=\s*(["'])([\s\S]*?)\2/g;
    let m;
    while ((m = attrRe.exec(content))) {
      const attr = m[1];
      const rawValue = m[3];
      const index = m.index;
      const values = attr === 'srcset'
        ? rawValue.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean)
        : [rawValue];
      for (const raw of values) checkOneRef(full, content, lineAt, index, raw, name);
    }
  }
}

function checkOneRef(sourceFull, sourceContent, lineAt, index, raw, sourceName) {
  if (isIgnorable(raw)) return;
  const { pathPart, hash } = splitPathHash(raw);

  let targetFull, targetName;
  if (!pathPart) {
    // same-page anchor, e.g. href="#drop"
    targetFull = sourceFull;
    targetName = sourceName;
  } else {
    targetFull = path.join(ROOT, pathPart);
    targetName = path.basename(pathPart);
  }

  const line = lineAt(index);

  if (pathPart) {
    if (!fs.existsSync(targetFull) || !fs.statSync(targetFull).isFile()) {
      report(sourceFull, line, `${raw} (missing file: ${pathPart})`);
      return; // don't also flag the anchor against a file that doesn't exist
    }
  }

  if (hash) {
    const targetIsHtml = /\.html?$/i.test(targetName) || !pathPart;
    if (targetIsHtml) {
      if (isKnownJsHash(targetName, hash)) return;
      const ids = idsOf(targetFull);
      if (!ids.has(hash)) {
        report(sourceFull, line, `${raw} (no id="${hash}" in ${targetName})`);
      }
    }
  }
}

function checkCssFiles() {
  const files = readRootFiles('.css');
  for (const name of files) {
    const full = path.join(ROOT, name);
    const content = fs.readFileSync(full, 'utf8');
    const lineAt = makeLineFinder(content);
    const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    let m;
    while ((m = re.exec(content))) {
      const raw = m[2];
      if (isIgnorable(raw)) continue;
      const { pathPart } = splitPathHash(raw);
      if (!pathPart) continue;
      const targetFull = path.join(ROOT, pathPart);
      if (!fs.existsSync(targetFull) || !fs.statSync(targetFull).isFile()) {
        report(full, lineAt(m.index), `url(${raw}) (missing file: ${pathPart})`);
      }
    }
  }
}

function checkJsFiles() {
  const files = readRootFiles('.js');
  for (const name of files) {
    const full = path.join(ROOT, name);
    const content = fs.readFileSync(full, 'utf8');
    const lineAt = makeLineFinder(content);
    let m;

    // (a) href="…"/src="…"/poster="…" attributes embedded in HTML the script builds — this
    //     codebase always quotes HTML attributes with " regardless of whether the surrounding
    //     JS string uses '…', "…" + concatenation, or a `…${x}…` template literal, so matching
    //     the literal attr="…" text directly (not JS string boundaries) finds the real value
    //     and is immune to both concatenation breaks and template interpolation.
    const attrRe = /\b(href|src|poster)\s*=\s*"([^"]*)"/g;
    while ((m = attrRe.exec(content))) {
      const prefix = PATH_SAFE_PREFIX_RE.exec(m[2])[0];
      if (prefix) checkJsPathValue(full, lineAt, m.index, prefix);
    }

    // (b) a whole quoted string literal that is itself a complete local path, e.g. 'shop.html'
    const strRe = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
    while ((m = strRe.exec(content))) {
      const val = m[1] !== undefined ? m[1] : m[2];
      if (FULL_LOCAL_PATH_RE.test(val)) checkJsPathValue(full, lineAt, m.index, val);
    }

    // (c) a whole static template literal (no ${}) that is itself a complete local path
    const tplRe = /`((?:[^`\\]|\\.)*)`/g;
    while ((m = tplRe.exec(content))) {
      const raw = m[1];
      if (raw.indexOf('${') !== -1) continue;
      if (FULL_LOCAL_PATH_RE.test(raw)) checkJsPathValue(full, lineAt, m.index, raw);
    }
  }
}

function checkJsPathValue(full, lineAt, index, raw) {
  if (isIgnorable(raw)) return;

  if (FULL_LOCAL_PATH_RE.test(raw)) {
    const { pathPart, hash } = splitPathHash(raw);
    const targetFull = path.join(ROOT, pathPart);
    if (!fs.existsSync(targetFull) || !fs.statSync(targetFull).isFile()) {
      report(full, lineAt(index), `${JSON.stringify(raw)} (missing file: ${pathPart})`);
      return;
    }
    if (hash && /\.html?$/i.test(pathPart)) {
      const targetName = path.basename(pathPart);
      if (!isKnownJsHash(targetName, hash)) {
        const ids = idsOf(targetFull);
        if (!ids.has(hash)) report(full, lineAt(index), `${JSON.stringify(raw)} (no id="${hash}" in ${targetName})`);
      }
    }
    return;
  }

  // not (yet) a complete path — e.g. "assets/img/look-" before an interpolated "${n}.jpg".
  // per contract, a template-literal path with ${} is checked by its static prefix only: verify
  // just that the directory it names exists, since the rest is genuinely dynamic.
  if (!/^[\w./-]+$/.test(raw) || !raw.includes('/')) return; // not path-shaped enough to say anything useful
  const dir = raw.slice(0, raw.lastIndexOf('/'));
  const dirFull = path.join(ROOT, dir);
  if (dir && (!fs.existsSync(dirFull) || !fs.statSync(dirFull).isDirectory())) {
    report(full, lineAt(index), `\`${raw}…\` (missing directory: ${dir})`);
  }
}

/* ============================================================
   --dead-ends CHECK
   ============================================================ */
function createSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = console;
  sandbox.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} };
  sandbox.document = { documentElement: { getAttribute: () => null, setAttribute() {} }, querySelectorAll: () => [], querySelector: () => null };
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  return sandbox;
}

function loadCollectionNames() {
  const p = path.join(ROOT, 'products.js');
  if (!fs.existsSync(p)) return [];
  try {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: 'products.js' });
    return Array.isArray(sandbox.KA_COLLECTIONS) ? sandbox.KA_COLLECTIONS.map(c => c.name).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function isDeadTarget(rawHref) {
  const v = rawHref.trim();
  if (v === '#') return true;
  if (v === 'index.html#studios') return true;
  if (v === 'shop.html') return true; // bare — no hash, no query
  return false;
}

function checkDeadEnds() {
  const terms = [
    'Tee Studio', 'Print Lab', 'Crew & Bulk', 'Gift Card', 'Get notified',
    ...loadCollectionNames()
  ].map(t => t.toLowerCase());

  const files = [...readRootFiles('.html'), ...readRootFiles('.js')];
  for (const name of files) {
    const full = path.join(ROOT, name);
    const content = fs.readFileSync(full, 'utf8');
    const lineAt = makeLineFinder(content);
    const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = aRe.exec(content))) {
      const attrs = m[1];
      const inner = m[2];
      const hrefMatch = /\bhref\s*=\s*(["'])([\s\S]*?)\1/.exec(attrs);
      if (!hrefMatch) continue;
      const href = hrefMatch[2];
      const text = stripTags(inner).toLowerCase();
      if (!text) continue;
      const mentioned = terms.find(t => t && text.indexOf(t) !== -1);
      if (mentioned && isDeadTarget(href)) {
        report(full, lineAt(m.index), `<a href="${href}"> text "${stripTags(inner)}" mentions "${mentioned}" but still points at a dead end`);
      }
    }
  }
}

/* ============================================================ */

if (DEAD_ENDS) {
  checkDeadEnds();
} else {
  checkHtmlFiles();
  checkCssFiles();
  checkJsFiles();
}

for (const p of problems) console.log(p);
console.log(problems.length ? 'FAIL' : 'PASS');
process.exit(problems.length ? 1 : 0);
