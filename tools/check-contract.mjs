#!/usr/bin/env node
/* KHARIS & ALETHEIA — tools/check-contract.mjs
   Cross-file API contract check. Statically collects every member access on KA_CORE.*,
   KA_PRINTS.* (incl. .saved.*), kaCart.*, kaForms.*, kaWishlist.*, kaModal.* and
   KA_CONFIG.<top-level> across every root *.js file, then verifies each one is actually
   defined:
     - config.js / products.js / core.js / prints.js are executed in a node:vm sandbox (a
       stubbed window/localStorage/document) to get their REAL runtime shape.
     - app.js is not executed (it does real DOM work at load time) — instead its kaCart /
       kaForms / kaWishlist / kaModal are found by statically locating the object literal each
       one is built from (an IIFE's `return { … }`, or a direct `const x = { … }`).
   Also verifies every product id / collection slug / maker slug referenced by an id-like
   attribute, a `?key=` query string, or an object-literal key actually exists in KA_PRODUCTS /
   KA_COLLECTIONS / KA_MAKERS.

   Zero dependencies — Node built-ins only. Run: node tools/check-contract.mjs */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const seen = new Set();

function rel(p) { return path.relative(ROOT, p) || p; }
function report(file, line, message) {
  const entry = `${rel(file)}:${line} \u2192 ${message}`;
  if (seen.has(entry)) return;
  seen.add(entry);
  problems.push(entry);
}
function note(message) {
  if (seen.has(message)) return;
  seen.add(message);
  problems.push(message);
}

function readRootFiles(ext) {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith(ext))
    .map(d => d.name)
    .sort();
}

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

function hasOwn(obj, key) {
  return obj != null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

/* ============================================================
   1. load config.js / products.js / core.js / prints.js in a vm sandbox
   ============================================================ */
function createSandbox() {
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear()
  };
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.localStorage = localStorage;
  sandbox.navigator = { userAgent: 'node-vm' };
  sandbox.location = { hash: '', search: '', href: 'file:///sandbox/' };
  sandbox.console = console;
  sandbox.document = {
    documentElement: { getAttribute: () => null, setAttribute() {} },
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({
      classList: { add() {}, remove() {}, toggle() {} },
      style: {},
      setAttribute() {}, appendChild() {}, addEventListener() {}
    }),
    addEventListener() {},
    body: { dataset: {} }
  };
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  return sandbox;
}

const sandbox = createSandbox();
const loaded = { config: false, products: false, core: false, prints: false };
for (const [key, file] of [['config', 'config.js'], ['products', 'products.js'], ['core', 'core.js'], ['prints', 'prints.js']]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) { note(`${file}: MISSING \u2014 cannot verify the members it should define`); continue; }
  try {
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: file });
    loaded[key] = true;
  } catch (e) {
    note(`${file}: failed to load in the check sandbox (${e.message}) \u2014 cannot verify the members it should define`);
  }
}

/* ============================================================
   2. statically parse app.js's kaCart / kaForms / kaWishlist / kaModal object literals
   ============================================================ */
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'yield', 'do', 'else', 'default', 'await']);
function regexAllowed(lastToken) {
  if (lastToken === '') return true;
  if (lastToken === ')' || lastToken === ']') return false;
  if (lastToken === 'STR') return false;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(lastToken)) return REGEX_KEYWORDS.has(lastToken);
  if (/^[0-9.]+$/.test(lastToken)) return false;
  return true;
}

/* finds the '}' matching the '{' at s[openIdx], string/comment/regex-literal aware */
function findMatchingBrace(s, openIdx) {
  let depth = 0, mode = null, tplDepth = 0, lastToken = '', idBuf = '';
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i], c2 = s[i + 1];
    if (mode === 'line') { if (c === '\n') mode = null; continue; }
    if (mode === 'block') { if (c === '*' && c2 === '/') { mode = null; i++; lastToken = 'STR'; } continue; }
    if (mode === 'sq') { if (c === '\\') { i++; continue; } if (c === "'") { mode = null; lastToken = 'STR'; } continue; }
    if (mode === 'dq') { if (c === '\\') { i++; continue; } if (c === '"') { mode = null; lastToken = 'STR'; } continue; }
    if (mode === 'regex') {
      if (c === '\\') { i++; continue; }
      if (c === '[') { mode = 'regexClass'; continue; }
      if (c === '/') { let j = i + 1; while (j < s.length && /[a-z]/i.test(s[j])) j++; i = j - 1; mode = null; lastToken = 'STR'; continue; }
      continue;
    }
    if (mode === 'regexClass') { if (c === '\\') { i++; continue; } if (c === ']') mode = 'regex'; continue; }
    if (mode === 'tpl') {
      if (c === '\\') { i++; continue; }
      if (c === '`') { mode = null; lastToken = 'STR'; continue; }
      if (c === '$' && c2 === '{') { mode = 'tplExpr'; tplDepth = 1; i++; continue; }
      continue;
    }
    if (mode === 'tplExpr') {
      if (c === '{') { tplDepth++; continue; }
      if (c === '}') { tplDepth--; if (tplDepth === 0) mode = 'tpl'; continue; }
      if (c === "'") { mode = 'sqInTpl'; continue; }
      if (c === '"') { mode = 'dqInTpl'; continue; }
      continue;
    }
    if (mode === 'sqInTpl') { if (c === '\\') { i++; continue; } if (c === "'") mode = 'tplExpr'; continue; }
    if (mode === 'dqInTpl') { if (c === '\\') { i++; continue; } if (c === '"') mode = 'tplExpr'; continue; }

    if (/[A-Za-z0-9_$]/.test(c)) { idBuf += c; continue; }
    if (idBuf) { lastToken = idBuf; idBuf = ''; }

    if (c === '/' && c2 === '/') { mode = 'line'; i++; continue; }
    if (c === '/' && c2 === '*') { mode = 'block'; i++; continue; }
    if (c === '/') { if (regexAllowed(lastToken)) mode = 'regex'; else lastToken = '/'; continue; }
    if (c === "'") { mode = 'sq'; continue; }
    if (c === '"') { mode = 'dq'; continue; }
    if (c === '`') { mode = 'tpl'; continue; }
    if (c === '{') { depth++; lastToken = '{'; continue; }
    if (c === '}') { depth--; lastToken = '}'; if (depth === 0) return i; continue; }
    if (c === '(') { lastToken = '('; continue; }
    if (c === ')') { lastToken = ')'; continue; }
    if (c === '[') { lastToken = '['; continue; }
    if (c === ']') { lastToken = ']'; continue; }
    if (/\s/.test(c)) continue;
    lastToken = c;
  }
  return -1;
}

/* splits the inside of an object literal on its top-level commas */
function splitTopLevel(s) {
  const parts = [];
  let depth = 0, mode = null, start = 0, lastToken = '', idBuf = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], c2 = s[i + 1];
    if (mode === 'line') { if (c === '\n') mode = null; continue; }
    if (mode === 'block') { if (c === '*' && c2 === '/') { mode = null; i++; lastToken = 'STR'; } continue; }
    if (mode === 'sq') { if (c === '\\') { i++; continue; } if (c === "'") { mode = null; lastToken = 'STR'; } continue; }
    if (mode === 'dq') { if (c === '\\') { i++; continue; } if (c === '"') { mode = null; lastToken = 'STR'; } continue; }
    if (mode === 'regex') {
      if (c === '\\') { i++; continue; }
      if (c === '[') { mode = 'regexClass'; continue; }
      if (c === '/') { let j = i + 1; while (j < s.length && /[a-z]/i.test(s[j])) j++; i = j - 1; mode = null; lastToken = 'STR'; continue; }
      continue;
    }
    if (mode === 'regexClass') { if (c === '\\') { i++; continue; } if (c === ']') mode = 'regex'; continue; }
    if (mode === 'tpl') { if (c === '\\') { i++; continue; } if (c === '`') { mode = null; lastToken = 'STR'; } continue; }

    if (/[A-Za-z0-9_$]/.test(c)) { idBuf += c; continue; }
    if (idBuf) { lastToken = idBuf; idBuf = ''; }

    if (c === '/' && c2 === '/') { mode = 'line'; i++; continue; }
    if (c === '/' && c2 === '*') { mode = 'block'; i++; continue; }
    if (c === '/') { if (regexAllowed(lastToken)) mode = 'regex'; else lastToken = '/'; continue; }
    if (c === "'") { mode = 'sq'; continue; }
    if (c === '"') { mode = 'dq'; continue; }
    if (c === '`') { mode = 'tpl'; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; lastToken = c; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; lastToken = c; continue; }
    if (c === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; lastToken = ','; continue; }
    if (/\s/.test(c)) continue;
    lastToken = c;
  }
  const last = s.slice(start);
  if (last.trim()) parts.push(last);
  return parts.map(x => x.trim()).filter(Boolean);
}

function memberNameOf(part) {
  let s = part.trim().replace(/^(async\s+|get\s+|set\s+|static\s+)+/, '').replace(/^\*\s*/, '');
  const m = s.match(/^(['"`]?)([A-Za-z_$][\w$]*)\1/);
  return m ? m[2] : null;
}

/* finds `const NAME = (function(){ … return {…}; })();` or `const NAME = {…};` and returns its
   top-level member names, or null if the pattern couldn't be statically recognised. */
function extractObjectMembers(src, varName) {
  const declMatch = new RegExp('\\bconst\\s+' + varName + '\\s*=\\s*').exec(src);
  if (!declMatch) return null;
  let i = declMatch.index + declMatch[0].length;
  while (/\s/.test(src[i])) i++;
  if (src.slice(i, i + 9) === '(function') {
    const braceIdx = src.indexOf('{', i);
    if (braceIdx === -1) return null;
    const bodyEnd = findMatchingBrace(src, braceIdx);
    if (bodyEnd === -1) return null;
    const body = src.slice(braceIdx + 1, bodyEnd);
    const retMatch = /\breturn\s*\{/.exec(body);
    if (!retMatch) return null;
    const objOpen = braceIdx + 1 + retMatch.index + retMatch[0].length - 1;
    const objClose = findMatchingBrace(src, objOpen);
    if (objClose === -1) return null;
    return splitTopLevel(src.slice(objOpen + 1, objClose)).map(memberNameOf).filter(Boolean);
  }
  if (src[i] === '{') {
    const objClose = findMatchingBrace(src, i);
    if (objClose === -1) return null;
    return splitTopLevel(src.slice(i + 1, objClose)).map(memberNameOf).filter(Boolean);
  }
  return null;
}

const appPath = path.join(ROOT, 'app.js');
const appExists = fs.existsSync(appPath);
const appSrc = appExists ? fs.readFileSync(appPath, 'utf8') : '';
const appMembers = {};
for (const name of ['kaCart', 'kaForms', 'kaWishlist', 'kaModal']) {
  if (!appExists) { note('app.js: MISSING \u2014 cannot verify the members it should define'); appMembers[name] = null; continue; }
  const extracted = extractObjectMembers(appSrc, name);
  if (extracted === null) note(`app.js: could not statically determine the members of \`${name}\` \u2014 treating ${name}.* references as unverifiable`);
  appMembers[name] = extracted;
}

/* ============================================================
   3. scan every root *.js file for member accesses and verify each one
   ============================================================ */
function checkMember(globalName, first, second, file, index, lineAt) {
  let ok;
  switch (globalName) {
    case 'KA_CORE':
      if (!loaded.core) { ok = true; break; }
      ok = hasOwn(sandbox.KA_CORE, first);
      if (ok && first === 'validate' && second) ok = hasOwn(sandbox.KA_CORE.validate, second);
      break;
    case 'KA_PRINTS':
      if (!loaded.prints) { ok = true; break; }
      ok = hasOwn(sandbox.KA_PRINTS, first);
      if (ok && first === 'saved' && second) ok = hasOwn(sandbox.KA_PRINTS.saved, second);
      break;
    case 'KA_CONFIG':
      if (!loaded.config) { ok = true; break; }
      ok = hasOwn(sandbox.KA_CONFIG, first);
      break;
    case 'kaCart': case 'kaForms': case 'kaWishlist': case 'kaModal': {
      const members = appMembers[globalName];
      ok = (members == null) ? true : members.includes(first);
      break;
    }
    default:
      ok = true;
  }
  if (!ok) {
    const chain = second ? `${first}.${second}` : first;
    report(file, lineAt(index), `${globalName}.${chain} is not defined`);
  }
}

const GLOBAL_PATTERNS = [
  { name: 'KA_CORE', re: /\bKA_CORE\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?/g, twoLevelFor: new Set(['validate']) },
  { name: 'KA_PRINTS', re: /\bKA_PRINTS\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?/g, twoLevelFor: new Set(['saved']) },
  { name: 'kaCart', re: /\bkaCart\.([A-Za-z_$][\w$]*)/g },
  { name: 'kaForms', re: /\bkaForms\.([A-Za-z_$][\w$]*)/g },
  { name: 'kaWishlist', re: /\bkaWishlist\.([A-Za-z_$][\w$]*)/g },
  { name: 'kaModal', re: /\bkaModal\.([A-Za-z_$][\w$]*)/g },
  { name: 'KA_CONFIG', re: /\bKA_CONFIG\.([A-Za-z_$][\w$]*)/g }
];

const jsFiles = readRootFiles('.js');
for (const name of jsFiles) {
  const full = path.join(ROOT, name);
  const content = fs.readFileSync(full, 'utf8');
  const lineAt = makeLineFinder(content);
  for (const pat of GLOBAL_PATTERNS) {
    pat.re.lastIndex = 0;
    let m;
    while ((m = pat.re.exec(content))) {
      const second = pat.twoLevelFor && pat.twoLevelFor.has(m[1]) ? m[2] : undefined;
      checkMember(pat.name, m[1], second, full, m.index, lineAt);
    }
  }
}

/* ============================================================
   4. product id / collection slug / maker slug references
   ============================================================ */
function idLikeChecks() {
  if (!loaded.products) return; // already noted above
  const productIds = new Set((sandbox.KA_PRODUCTS || []).map(p => p.id));
  const collectionSlugs = new Set((sandbox.KA_COLLECTIONS || []).map(c => c.slug));
  const makerSlugs = new Set((sandbox.KA_MAKERS || []).map(m => m.slug));

  const htmlFiles = readRootFiles('.html').map(f => path.join(ROOT, f));
  const jsFilesFull = jsFiles.map(f => path.join(ROOT, f));

  const ATTR_CHECKS = [
    { attr: 'data-id', set: productIds, label: 'product id' },
    { attr: 'data-collection', set: collectionSlugs, label: 'collection slug' },
    { attr: 'data-maker', set: makerSlugs, label: 'maker slug' }
  ];
  const QUERY_CHECKS = [
    { key: 'id', set: productIds, label: 'product id' },
    { key: 'collection', set: collectionSlugs, label: 'collection slug' },
    { key: 'maker', set: makerSlugs, label: 'maker slug' }
  ];
  const KEY_CHECKS = [
    { key: 'collection', set: collectionSlugs, label: 'collection slug' },
    { key: 'maker', set: makerSlugs, label: 'maker slug' }
  ];

  for (const full of [...htmlFiles, ...jsFilesFull]) {
    const name = path.basename(full);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const lineAt = makeLineFinder(content);
    let m;

    for (const { attr, set, label } of ATTR_CHECKS) {
      const re = new RegExp('\\b' + attr + '\\s*=\\s*(["\'])([^"\']*)\\1', 'g');
      while ((m = re.exec(content))) {
        const val = m[2];
        if (val && !set.has(val)) report(full, lineAt(m.index), `${attr}="${val}" is not a known ${label}`);
      }
    }

    for (const { key, set, label } of QUERY_CHECKS) {
      const re = new RegExp('[?&]' + key + '=([A-Za-z0-9_-]+)', 'g');
      while ((m = re.exec(content))) {
        const val = decodeURIComponent(m[1]);
        if (val && !set.has(val)) report(full, lineAt(m.index), `?${key}=${val} is not a known ${label}`);
      }
    }

    // object-literal `key: 'value'` style — skip products.js itself, which is the canonical
    // definition file (checking it against itself would just re-derive the same data, and its
    // own `id:`/`collection:` keys mean something different depending on context — e.g. KA_LOOKS).
    if (name !== 'products.js') {
      for (const { key, set, label } of KEY_CHECKS) {
        const re = new RegExp('\\b' + key + '\\s*:\\s*([\'"])([^\'"]*)\\1', 'g');
        while ((m = re.exec(content))) {
          const val = m[2];
          if (val && !set.has(val)) report(full, lineAt(m.index), `${key}: "${val}" is not a known ${label}`);
        }
      }
    }
  }
}
idLikeChecks();

/* ============================================================ */
for (const p of problems) console.log(p);
console.log(problems.length ? 'FAIL' : 'PASS');
process.exit(problems.length ? 1 : 0);
