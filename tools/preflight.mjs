#!/usr/bin/env node
/* KHARIS & ALETHEIA — tools/preflight.mjs
   Launch blockers: prints every entry still listed in KA_CONFIG.placeholders, warns when
   formEndpoint is empty (forms fall back to mailto:) and when the payment provider is still
   'request' (orders are emailed for manual processing, not charged automatically).
   Exits 1 while KA_CONFIG.placeholders is non-empty — this is EXPECTED to fail until the owner
   fills in config.js; that is this tool's whole job.

   Zero dependencies — Node built-ins only. Run: node tools/preflight.mjs */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function getAtPath(obj, dotted) {
  return dotted.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj);
}

function loadConfig() {
  const configPath = path.join(ROOT, 'config.js');
  if (!fs.existsSync(configPath)) {
    console.log('config.js: MISSING — cannot run preflight checks.');
    console.log('PREFLIGHT: BLOCKED');
    process.exit(1);
  }
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} };
  sandbox.console = console;
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  try {
    vm.runInContext(fs.readFileSync(configPath, 'utf8'), sandbox, { filename: 'config.js' });
  } catch (e) {
    console.log(`config.js: failed to load (${e.message}) — cannot run preflight checks.`);
    console.log('PREFLIGHT: BLOCKED');
    process.exit(1);
  }
  if (!sandbox.KA_CONFIG || typeof sandbox.KA_CONFIG !== 'object') {
    console.log('config.js: did not define window.KA_CONFIG — cannot run preflight checks.');
    console.log('PREFLIGHT: BLOCKED');
    process.exit(1);
  }
  return sandbox.KA_CONFIG;
}

const KA_CONFIG = loadConfig();
const placeholders = Array.isArray(KA_CONFIG.placeholders) ? KA_CONFIG.placeholders : [];

console.log(`KHARIS & ALETHEIA — launch preflight (${new Date().toISOString()})`);
console.log('');

if (placeholders.length) {
  console.log(`${placeholders.length} placeholder(s) still need the owner's real values before launch:`);
  for (const key of placeholders) {
    const value = getAtPath(KA_CONFIG, key);
    let shown;
    if (value === '' || value == null) shown = '(empty)';
    else if (typeof value === 'object') shown = JSON.stringify(value);
    else shown = String(value);
    console.log(`  - KA_CONFIG.${key} = ${shown}`);
  }
} else {
  console.log('No entries remain in KA_CONFIG.placeholders.');
}
console.log('');

const endpoint = KA_CONFIG.formEndpoint;
if (!endpoint) {
  console.log('NOTICE: KA_CONFIG.formEndpoint is empty — kaForms.submit() falls back to a mailto: link');
  console.log('        instead of posting to a real backend. Every form (notify, contact, bulk,');
  console.log('        checkout, gift) will open the visitor’s email client rather than submitting silently.');
} else {
  console.log(`OK: KA_CONFIG.formEndpoint is set (${endpoint}) — forms POST there.`);
}
console.log('');

const provider = KA_CONFIG.payment && KA_CONFIG.payment.provider;
if (provider === 'request') {
  console.log('NOTICE: KA_CONFIG.payment.provider is \'request\' — checkout does NOT charge a card.');
  console.log('        Every order is saved to ka_orders and emailed to KA_CONFIG.contactEmail for');
  console.log('        the owner to process manually. Switch to \'paystack\' + a real public key to');
  console.log('        take payment automatically at checkout.');
} else if (provider === 'paystack') {
  if (KA_CONFIG.payment.paystackPublicKey) {
    console.log('OK: KA_CONFIG.payment.provider is \'paystack\' with a public key set.');
  } else {
    console.log('NOTICE: KA_CONFIG.payment.provider is \'paystack\' but paystackPublicKey is empty —');
    console.log('        checkout cannot open the Paystack popup until a real key is supplied.');
  }
} else {
  console.log(`NOTICE: KA_CONFIG.payment.provider is "${provider}" — unrecognised (expected 'request' or 'paystack').`);
}
console.log('');

const blocked = placeholders.length > 0;
console.log(blocked ? `PREFLIGHT: BLOCKED (${placeholders.length} placeholder(s) remaining)` : 'PREFLIGHT: READY');
process.exit(blocked ? 1 : 0);
