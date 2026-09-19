#!/usr/bin/env node
/* KHARIS & ALETHEIA — tools/check-html.mjs
   Structural + accessibility checks on every root *.html page, per CONTRACT.md:
     - <!doctype html>, <html lang>, <meta charset>, viewport meta, non-empty <title>,
       meta description
     - exactly one <h1> — static, or documented as JS-rendered via <body data-h1="js">
     - every <img> has alt=
     - every <input>/<select>/<textarea> has an associated <label for> or aria-label
     - no duplicate ids
     - the inline theme-bootstrap script is present
     - styles.css is linked
     - scripts load in contract order: config.js, products.js, core.js, [prints.js], app.js
     - <footer data-ka-footer> is present
     - <body data-page="…"> is present

   Zero dependencies — Node built-ins only. Run: node tools/check-html.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

function rel(p) { return path.relative(ROOT, p) || p; }
function report(file, line, message) { problems.push(`${rel(file)}:${line} → ${message}`); }

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

const CORE_SCRIPTS = ['config.js', 'products.js', 'core.js', 'app.js'];

function checkFile(file) {
  const full = path.join(ROOT, file);
  const content = fs.readFileSync(full, 'utf8');
  const lineAt = makeLineFinder(content);

  /* ---- <!doctype html> ---- */
  if (!/^﻿?\s*<!doctype\s+html\s*>/i.test(content)) {
    report(full, 1, 'missing <!doctype html> at the top of the file');
  }

  /* ---- <html lang="…"> ---- */
  const htmlTagMatch = /<html\b([^>]*)>/i.exec(content);
  if (!htmlTagMatch) {
    report(full, 1, 'missing <html> tag');
  } else {
    const langMatch = /\blang\s*=\s*["']([^"']*)["']/i.exec(htmlTagMatch[1]);
    if (!langMatch || !langMatch[1].trim()) {
      report(full, lineAt(htmlTagMatch.index), '<html> is missing a non-empty lang="…" attribute');
    }
  }

  /* ---- <meta charset> ---- */
  const charsetMatch = /<meta\s+charset\s*=\s*["'][^"']*["']\s*\/?>/i.exec(content);
  if (!charsetMatch) report(full, 1, 'missing <meta charset="…">');

  /* ---- viewport meta ---- */
  const viewportMatch = /<meta\s+name\s*=\s*["']viewport["'][^>]*>/i.exec(content);
  if (!viewportMatch) report(full, 1, 'missing <meta name="viewport" …>');

  /* ---- <title> ---- */
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(content);
  if (!titleMatch || !titleMatch[1].replace(/&\w+;/g, ' ').trim()) {
    report(full, titleMatch ? lineAt(titleMatch.index) : 1, 'missing or empty <title>');
  }

  /* ---- meta description ---- */
  const descMatch = /<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["']([^"']*)["'][^>]*>/i.exec(content);
  if (!descMatch || !descMatch[1].trim()) {
    report(full, descMatch ? lineAt(descMatch.index) : 1, 'missing or empty <meta name="description" content="…">');
  }

  /* ---- exactly one <h1> ---- */
  const h1Matches = [...content.matchAll(/<h1\b/gi)];
  if (h1Matches.length === 0) {
    const bodyMatch = /<body\b([^>]*)>/i.exec(content);
    const hasJsFlag = bodyMatch && /\bdata-h1\s*=\s*["']js["']/i.test(bodyMatch[1]);
    if (!hasJsFlag) {
      report(full, 1, 'no <h1> found, and <body> is not marked data-h1="js" for a JS-rendered heading');
    }
  } else if (h1Matches.length > 1) {
    report(full, lineAt(h1Matches[1].index), `found ${h1Matches.length} <h1> elements — exactly one is required`);
  }

  /* ---- every <img> has alt= ---- */
  const imgRe = /<img\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(content))) {
    if (!/\balt\s*=/.test(m[1])) report(full, lineAt(m.index), '<img> is missing alt=');
  }

  /* ---- every <input|select|textarea> has a <label for>, aria-label(ledby), or is itself
     wrapped in a <label>…</label> (the other HTML-spec-valid way to associate a label,
     used by this site's custom-styled toggle switches) ---- */
  const labelForIds = new Set([...content.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi)].map(x => x[1]));
  const labelSpans = [...content.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)].map(x => [x.index, x.index + x[0].length]);
  const isInsideLabel = (idx) => labelSpans.some(([s, e]) => idx > s && idx < e);
  const NO_LABEL_NEEDED = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
  const fieldRe = /<(input|select|textarea)\b([^>]*)>/gi;
  while ((m = fieldRe.exec(content))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    if (tag === 'input') {
      const typeMatch = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs);
      const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
      if (NO_LABEL_NEEDED.has(type)) continue;
    }
    const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const hasLabelFor = idMatch && labelForIds.has(idMatch[1]);
    const hasAriaLabel = /\baria-label\s*=\s*["'][^"']*\S[^"']*["']/i.test(attrs);
    const hasAriaLabelledby = /\baria-labelledby\s*=\s*["'][^"']*\S[^"']*["']/i.test(attrs);
    if (!hasLabelFor && !hasAriaLabel && !hasAriaLabelledby && !isInsideLabel(m.index)) {
      report(full, lineAt(m.index), `<${tag}> has no associated <label for> or aria-label`);
    }
  }

  /* ---- no duplicate ids ---- */
  const idPositions = new Map();
  for (const idm of content.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    const id = idm[1];
    if (!idPositions.has(id)) idPositions.set(id, []);
    idPositions.get(id).push(idm.index);
  }
  for (const [id, positions] of idPositions) {
    if (positions.length > 1) {
      for (const idx of positions.slice(1)) report(full, lineAt(idx), `duplicate id="${id}" (first used at line ${lineAt(positions[0])})`);
    }
  }

  /* ---- inline theme-bootstrap script ---- */
  const headEnd = content.search(/<\/head>/i);
  const headContent = headEnd === -1 ? content : content.slice(0, headEnd);
  const bootstrapRe = /<script>[^<]*data-theme[^<]*ka_theme[^<]*<\/script>/i;
  if (!bootstrapRe.test(headContent) || !/localStorage\.getItem\(\s*['"]ka_theme['"]\s*\)/.test(headContent)) {
    report(full, 1, 'missing the inline theme-bootstrap <script> in <head> (data-theme / ka_theme)');
  }

  /* ---- styles.css linked ---- */
  if (!/<link\b[^>]*\bhref\s*=\s*["']styles\.css["'][^>]*>/i.test(content)) {
    report(full, 1, 'styles.css is not linked');
  }

  /* ---- scripts load in contract order ---- */
  const scriptSrcs = [...content.matchAll(/<script\s+src\s*=\s*["']([^"']+)["'][^>]*><\/script>/gi)]
    .map(x => ({ name: path.basename(x[1]), index: x.index }));
  const coreIdx = {};
  for (const s of scriptSrcs) if (CORE_SCRIPTS.includes(s.name) && !(s.name in coreIdx)) coreIdx[s.name] = s.index;
  const printsEntry = scriptSrcs.find(s => s.name === 'prints.js');

  let prevName = null, prevIdx = -1;
  for (const name of CORE_SCRIPTS) {
    if (!(name in coreIdx)) {
      report(full, 1, `script order: <script src="${name}"> is missing`);
      continue;
    }
    const idx = coreIdx[name];
    if (idx < prevIdx) {
      report(full, lineAt(idx), `script order: ${name} loads before ${prevName} (expected ${CORE_SCRIPTS.join(' → ')})`);
    }
    prevName = name; prevIdx = idx;
  }
  if (printsEntry && 'core.js' in coreIdx && 'app.js' in coreIdx) {
    if (!(printsEntry.index > coreIdx['core.js'] && printsEntry.index < coreIdx['app.js'])) {
      report(full, lineAt(printsEntry.index), 'script order: prints.js must load after core.js and before app.js');
    }
  }

  /* ---- <footer data-ka-footer> ---- */
  if (!/<footer\b[^>]*\bdata-ka-footer\b[^>]*>/i.test(content)) {
    report(full, 1, 'missing <footer data-ka-footer>');
  }

  /* ---- <body data-page="…"> ---- */
  const bodyMatch2 = /<body\b([^>]*)>/i.exec(content);
  if (!bodyMatch2) {
    report(full, 1, 'missing <body> tag');
  } else {
    const pageMatch = /\bdata-page\s*=\s*["']([^"']*)["']/i.exec(bodyMatch2[1]);
    if (!pageMatch || !pageMatch[1].trim()) {
      report(full, lineAt(bodyMatch2.index), '<body> is missing a non-empty data-page="…" attribute');
    }
  }
}

for (const file of readRootFiles('.html')) checkFile(file);

for (const p of problems) console.log(p);
console.log(problems.length ? 'FAIL' : 'PASS');
process.exit(problems.length ? 1 : 0);
