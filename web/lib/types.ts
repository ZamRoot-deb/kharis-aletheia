/* KHARIS & ALETHEIA — shared TS types (per CONTRACT-NEXT.md "Shared modules")
   Ported from the shapes used across the old site's app.js / studio.js / checkout.js /
   gift.js / prints.js. Kept loose in a few spots (design/def params) to match the old
   code's permissive plain-object usage — see CONTRACT-NEXT.md "TypeScript is LOOSE". */

/* ---------- config.ts ---------- */

export interface ShippingMethod {
  id: string;
  label: string;
  price: number;
  days: string;
}

export interface ShippingZone {
  label: string;
  countries: string[];
  methods: ShippingMethod[];
  freeOver: number;
}

export interface Promo {
  type: 'percent' | 'fixed';
  value: number;
  label: string;
}

export interface BulkTier {
  min: number;
  off: number;
}

export interface StudioGarment {
  id: string;
  name: string;
  base: number;
}

export interface StudioColour {
  id: string;
  name: string;
  hex: string;
}

export interface StudioPlacement {
  id: string;
  name: string;
  surcharge: number;
}

export interface KaConfig {
  brand: string;
  currency: string;
  currencySymbol: string;
  contactEmail: string;
  formEndpoint: string;
  payment: { provider: string; paystackPublicKey: string };
  shipping: { zones: Record<string, ShippingZone> };
  promos: Record<string, Promo>;
  bulkTiers: BulkTier[];
  giftAmounts: number[];
  studio: {
    garments: StudioGarment[];
    colours: StudioColour[];
    placements: StudioPlacement[];
    sizes: string[];
  };
  leadTime: string;
  siteUrl: string;
  placeholders: string[];
}

/* ---------- products.ts ---------- */

export interface Product {
  id: string;
  cat: string;
  name: string;
  price: number;
  oneSize?: boolean;
  sold?: true;
  collection: string | null;
  maker: string | null;
  colour: string;
  tags: string[];
  img: string;
  blurb: string;
  details: string;
}

export interface Collection {
  slug: string;
  name: string;
  tag: string;
  blurb: string;
  img: string;
}

export interface Maker {
  slug: string;
  name: string;
  series: string;
  status: 'live' | 'upcoming';
  city: string;
  bio: string;
  long: string;
  collection: string;
}

export interface Look {
  id: string;
  img: string;
  title: string;
  caption: string;
  productIds: string[];
}

/* ---------- Tee Studio design (studio.js state.design) ---------- */

export interface StudioDesign {
  garment: string;
  colour: string;
  printId: string;
  placement: string;
  scale: number;
  rotate: number;
  x: number;
  y: number;
  view: 'front' | 'back';
}

/* ---------- cart items (app.js kaCart) — SAME shapes/keys as the old site,
   localStorage key 'ka_cart' ---------- */

export interface ProductCartItem {
  kind: 'product';
  id: string;
  size: string;
  qty: number;
}

export interface GiftCartItem {
  kind: 'gift';
  uid: string;
  amount: number;
  to: string;
  from: string;
  email: string;
  message: string;
  sendOn: string;
  qty: number;
}

export interface CustomCartItem {
  kind: 'custom';
  uid: string;
  name: string;
  garment: string;
  colour: string;
  size: string;
  qty: number;
  price: number;
  design: StudioDesign;
  thumb?: string;
}

/* Legacy stored items may have no `kind` at all — KA_CORE treats a missing kind as
   'product' (see kindOf() in core.ts), so a bare ProductCartItem without `kind` is
   still a valid, backward-compatible shape. */
export type CartItem = ProductCartItem | GiftCartItem | CustomCartItem;

/* ---------- prints.ts (KA_PRINTS) ---------- */

export type PrintFamily = 'kente' | 'ankara' | 'adinkra';

export interface PrintDef {
  family: PrintFamily;
  name: string;
  palette: string[];
  /* shape differs per family (kente/ankara/adinkra params) — kept loose on purpose,
     see CONTRACT-NEXT.md "TypeScript is LOOSE". */
  params: Record<string, any>;
}

export interface PrintEntry {
  id: string;
  name: string;
  family: PrintFamily;
  maker: string | null;
  meaning: string | null;
  def: PrintDef;
}

export interface PrintSymbol {
  id: string;
  name: string;
  meaning: string;
  path: string;
}

/* ---------- orders (checkout.js buildOrder()) ---------- */

export interface Order {
  ref: string;
  createdAt: string;
  items: Array<Record<string, any>>;
  contact: { email: string; phone: string; marketing: boolean };
  address: {
    fullName: string;
    address1: string;
    address2: string;
    city: string;
    region: string;
    postcode: string;
    country: string;
  } | null;
  shipping: ShippingMethod | null;
  promo: { ok: boolean; code: string; discount: number; label: string; error: string } | null;
  totals: { subtotal: number; discount: number; shipping: number; total: number };
  notes: { order: string; gift: string };
  status: string;
}
