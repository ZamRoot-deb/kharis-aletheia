/* KHARIS & ALETHEIA — KA_CORE: pure, DOM-free cart/shipping/promo math.
   Ported from ../core.js. Logic UNCHANGED — the only change from the original is
   the config/products source: the browser version read window.KA_CONFIG /
   window.KA_PRODUCTS, this version imports KA_CONFIG from ./config and KA_PRODUCTS
   from ./products directly. _init() is kept as a test-only escape hatch (per
   CONTRACT-NEXT.md) so tests/core.test.ts can swap in a hostile config without
   touching the real one. */
/* Explicit .ts extensions on these two value imports (unlike the extensionless
   type-only imports below) so `node --test tests/*.test.ts` can resolve them
   directly — Node's native TS loader requires a resolvable file extension on
   relative specifiers, unlike webpack/Turbopack's bundler resolution. tsconfig.json
   sets allowImportingTsExtensions to permit this alongside next build's typecheck. */
import { KA_CONFIG as DEFAULT_CONFIG } from './config.ts';
import { KA_PRODUCTS as DEFAULT_PRODUCTS } from './products.ts';
import type { KaConfig, Product } from './types';

let _config: KaConfig = DEFAULT_CONFIG;
let _products: Product[] = DEFAULT_PRODUCTS;

function activeConfig(): KaConfig {
  return _config;
}
function activeProducts(): Product[] {
  return _products;
}
function round2(n: any): number {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function kindOf(item: any): string {
  return item && item.kind ? item.kind : 'product';
}
/* deterministic PRNG (mulberry32) so orderRef(seed) is reproducible for the same seed */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const KA_CORE = {
  /* test/back-door init — browser code never needs to call this */
  _config: null as KaConfig | null,
  _products: null as Product[] | null,
  _init(opts?: { config?: KaConfig; products?: Product[] }) {
    opts = opts || {};
    if (opts.config) {
      _config = opts.config;
      this._config = opts.config;
    }
    if (opts.products) {
      _products = opts.products;
      this._products = opts.products;
    }
    return this;
  },

  /* ---------- money ---------- */
  money(n: any): string {
    n = Number(n);
    if (!Number.isFinite(n)) n = 0;
    const symbol = activeConfig().currencySymbol || '£';
    const rounded = round2(n);
    return Number.isInteger(rounded) ? symbol + rounded : symbol + rounded.toFixed(2);
  },

  /* ---------- catalog ---------- */
  findProduct(id?: string): Product | null {
    return activeProducts().find((p) => p.id === id) || null;
  },

  /* ---------- cart line math ---------- */
  unitPrice(item: any): number {
    if (!item) return 0;
    const kind = kindOf(item);
    if (kind === 'gift') return Number(item.amount) || 0;
    if (kind === 'custom') return Number(item.price) || 0;
    const p = this.findProduct(item.id);
    return p ? Number(p.price) || 0 : 0;
  },
  lineTotal(item: any): number {
    if (!item) return 0;
    const kind = kindOf(item);
    let qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) qty = kind === 'gift' ? 1 : 0;
    return round2(this.unitPrice(item) * qty);
  },
  subtotal(items: any): number {
    items = Array.isArray(items) ? items : [];
    return round2(items.reduce((sum: number, it: any) => sum + this.lineTotal(it), 0));
  },
  itemCount(items: any): number {
    items = Array.isArray(items) ? items : [];
    return items.reduce((sum: number, it: any) => {
      const kind = kindOf(it);
      let qty = Number(it && it.qty);
      if (!Number.isFinite(qty) || qty <= 0) qty = kind === 'gift' ? 1 : 0;
      return sum + qty;
    }, 0);
  },

  /* ---------- shipping ---------- */
  zoneFor(countryCode?: string): string {
    const zones = (activeConfig().shipping || {}).zones || {};
    const code = String(countryCode || '').trim().toUpperCase();
    const keys = Object.keys(zones);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === 'ROW') continue; // ROW is always the fallback, never matched by country
      const zone = (zones as any)[key];
      if (zone && Array.isArray(zone.countries) && zone.countries.indexOf(code) > -1) return key;
    }
    return 'ROW';
  },
  /* shippingOptions(countryCode, subtotal[, giftOnly])
     giftOnly is an internal extension used by totals() — a plain 2-arg call still
     returns the zone's normal methods exactly as documented. */
  shippingOptions(countryCode: string | undefined, subtotal: any, giftOnly?: boolean): any[] {
    if (giftOnly) return [{ id: 'digital', label: 'Digital delivery', price: 0, days: 'Instant' }];
    const zones = (activeConfig().shipping || {}).zones || {};
    const zoneKey = this.zoneFor(countryCode);
    const zone = (zones as any)[zoneKey];
    if (!zone || !Array.isArray(zone.methods) || !zone.methods.length) return [];
    const methods = zone.methods.map((m: any) => Object.assign({}, m));
    const sub = round2(subtotal);
    if (typeof zone.freeOver === 'number' && sub >= zone.freeOver) {
      let cheapest = 0;
      for (let i = 1; i < methods.length; i++) {
        if (methods[i].price < methods[cheapest].price) cheapest = i;
      }
      methods[cheapest] = Object.assign({}, methods[cheapest], { price: 0 });
    }
    return methods;
  },

  /* ---------- promos ---------- */
  applyPromo(code: any, subtotal: any) {
    const raw = String(code == null ? '' : code).trim();
    if (!raw) return { ok: false, code: '', discount: 0, label: '', error: 'Enter a promo code.' };
    const key = raw.toUpperCase();
    const promo = (activeConfig().promos || {})[key];
    if (!promo) return { ok: false, code: raw, discount: 0, label: '', error: 'That code is not valid.' };
    const sub = Math.max(0, round2(subtotal));
    let discount = 0;
    if (promo.type === 'percent') discount = round2((sub * (Number(promo.value) || 0)) / 100);
    else if (promo.type === 'fixed') discount = Math.min(sub, round2(Number(promo.value) || 0));
    return { ok: true, code: key, discount, label: promo.label || '', error: '' };
  },

  /* ---------- totals ----------
     Gift cards never discount and never carry physical shipping: a cart's merchandise
     (non-gift) subtotal is what promos and the free-shipping threshold apply to, and a
     cart holding gift cards only ships digital/free regardless of country. */
  totals(items: any, opts?: { country?: string; methodId?: string; promoCode?: string }) {
    items = Array.isArray(items) ? items : [];
    opts = opts || {};

    const merchItems = items.filter((it: any) => kindOf(it) !== 'gift');
    const giftItems = items.filter((it: any) => kindOf(it) === 'gift');
    const merchSubtotal = this.subtotal(merchItems);
    const giftSubtotal = this.subtotal(giftItems);
    const subtotalAll = round2(merchSubtotal + giftSubtotal);

    const promo = opts.promoCode ? this.applyPromo(opts.promoCode, merchSubtotal) : null;
    const discount = promo && promo.ok ? Math.min(promo.discount, merchSubtotal) : 0;
    const postDiscountMerch = round2(Math.max(0, merchSubtotal - discount));

    const giftOnly = items.length > 0 && merchItems.length === 0;
    const options = this.shippingOptions(opts.country, postDiscountMerch, giftOnly);
    let shipping = 0;
    if (!giftOnly && options.length) {
      const chosen = opts.methodId ? options.find((o) => o.id === opts.methodId) : options[0];
      shipping = chosen ? chosen.price : options[0].price;
    }

    const total = round2(postDiscountMerch + giftSubtotal + shipping);

    return {
      subtotal: subtotalAll,
      discount,
      shipping,
      total,
      promo: promo
    };
  },

  /* ---------- bulk ---------- */
  bulkQuote(unitPrice: any, qty: any) {
    unitPrice = Number(unitPrice) || 0;
    qty = Math.max(0, Math.floor(Number(qty)) || 0);
    const tiers = (activeConfig().bulkTiers || []).slice().sort((a, b) => b.min - a.min);
    const tier = tiers.find((t) => qty >= t.min) || null;
    const off = tier ? tier.off : 0;
    const unit = round2(unitPrice * (1 - off));
    const total = round2(unit * qty);
    const fullTotal = round2(unitPrice * qty);
    const saving = round2(fullTotal - total);
    return { tier: tier ? tier.min : null, off, unit, total, saving };
  },

  /* ---------- tee studio ---------- */
  studioPrice(design?: any): number {
    design = design || {};
    const studio = activeConfig().studio || ({} as any);
    const garment = (studio.garments || []).find((g) => g.id === design.garment);
    const placement = (studio.placements || []).find((p) => p.id === design.placement);
    const base = garment ? Number(garment.base) || 0 : 0;
    const surcharge = placement ? Number(placement.surcharge) || 0 : 0;
    return round2(base + surcharge);
  },

  /* ---------- orders ---------- */
  orderRef(seed?: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easier to read aloud
    const s =
      typeof seed === 'number' && Number.isFinite(seed)
        ? Math.floor(seed) >>> 0
        : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const rand = mulberry32(s);
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(rand() * chars.length)];
    return 'KA-' + out;
  },

  /* ---------- validation ---------- */
  validate: {
    email(s?: any): boolean {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s == null ? '' : s).trim());
    },
    postcode(s?: any, country?: string): boolean {
      const v = String(s == null ? '' : s).trim();
      if (!v) return false;
      const c = String(country == null ? '' : country).trim().toUpperCase();
      if (c === 'GB') return /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(v);
      return v.length >= 2 && v.length <= 12;
    },
    required(s?: any): boolean {
      return String(s == null ? '' : s).trim().length > 0;
    },
    phone(s?: any): boolean {
      const v = String(s == null ? '' : s).trim();
      if (!v) return false;
      const digits = v.replace(/[^\d]/g, '');
      return /^[+\d][\d\s().-]{5,18}\d$/.test(v) && digits.length >= 7;
    }
  },

  /* ---------- security ---------- */
  escapeHtml(s: any): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' };
    return String(s == null ? '' : s).replace(/[&<>"'`=\/]/g, (ch) => map[ch]);
  }
};
