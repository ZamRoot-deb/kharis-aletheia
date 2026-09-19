# KHARIS & ALETHEIA — build contract

Goal: turn the static design prototype into a complete, working made-to-order storefront.
**Principle: every promise the prototype makes becomes real.** Every nav entry, card, CTA and
policy statement must lead to a working feature. Do not invent sections the prototype never
promised (no blog, no accounts, no order tracking).

## Hard constraints (all builders)

- **Stack: vanilla static HTML/CSS/JS, multi-page, zero dependencies, no build step, no npm
  packages.** Classic `<script src>` tags (NOT ES modules) — the site must work from `file://`.
- **Never start any local server** (no `python -m http.server`, no `npx serve`, nothing). Verify
  with `node` scripts only.
- Match the existing design system in `styles.css` exactly: tokens (`--bg --surface --surface-2
  --gold --gold-hi --berry --berry-hi --crimson --maroon --fg --muted --border --border-strong`),
  fonts (`--font-display` Orbitron, `--font-mono` JetBrains Mono, `--font-pixel` Tiny5), zero
  border-radius, `.micro` labels, `.h-display` + `.glitch` headings, `.btn .btn-berry .btn-gold
  .btn-solid`, `.pill`, `.pd-field`, `.page` + `.page-hero`, `.reveal`. Never hardcode a colour a
  token covers. **Both themes must work**: `html[data-theme="light"]` overrides exist — any new
  surface must read correctly in light AND dark.
- Responsive to 360px wide, no horizontal page scroll. Grid children that hold long text/controls
  use `min-width:0`.
- Accessible: real `<button>`/`<a>`/`<label for>`, visible `:focus-visible`, keyboard operable,
  `aria-live` for async status, Esc closes overlays, honour `prefers-reduced-motion`.
- No fake data presented as real: no invented reviews, stock counts, "X people viewing", fake
  countdowns. Anything the owner must supply lives in `config.js` and is listed in
  `KA_CONFIG.placeholders`.
- Currency GBP (£). Copy voice: short, confident, second person, matches existing pages.
- **File ownership is exclusive.** Only edit files in your "OWNS" list. Need something from
  another owner? Code to this contract; the integrator reconciles.
- Every page: `<html lang="en">`, the same `<head>` pattern as `shop.html` (fonts, theme
  bootstrap inline script, `styles.css`), `<body data-page="…">`, content inside
  `<div class="page">`, then `<footer data-ka-footer></footer>`, then scripts in this order:
  `config.js`, `products.js`, `core.js`, `prints.js` (only if used), `app.js`, page script.
  Page-specific CSS goes in its own file linked after `styles.css`.

## Shared globals

### `config.js` → `window.KA_CONFIG` (owner: foundation)
```js
KA_CONFIG = {
  brand: 'KHARIS & ALETHEIA', currency: 'GBP', currencySymbol: '£',
  contactEmail: 'hello@kharisandaletheia.com',        // PLACEHOLDER
  formEndpoint: '',      // POST JSON endpoint (Formspree-style). '' => mailto fallback
  payment: { provider: 'request', paystackPublicKey: '' }, // 'request' | 'paystack'
  shipping: { zones: { UK:{label,countries:['GB'],methods:[{id:'standard',label,price:4.95,days:'2–4'},{id:'express',label,price:9.95,days:'1–2'}],freeOver:75},
                       EU:{…price 14.95}, AFRICA:{…price 18.95}, ROW:{…price 22.95} } },
  promos: { WELCOME10: { type:'percent', value:10, label:'10% off your first order' } }, // PLACEHOLDER
  bulkTiers: [ {min:10,off:0.10},{min:25,off:0.15},{min:50,off:0.20},{min:100,off:0.25} ],
  giftAmounts: [25,50,75,100,150],
  studio: { garments:[…], placements:[…] },   // see Tee Studio
  leadTime: '7–10 working days',
  placeholders: ['contactEmail','promos','shipping.zones','payment'] // preflight fails while non-empty
}
```

### `products.js` → `window.KA_PRODUCTS`, `KA_CAT_LABEL`, `KA_COLLECTIONS`, `KA_MAKERS`, `KA_LOOKS` (owner: foundation)
Existing product fields stay. Add per product: `collection` (slug), `maker` (slug|null),
`colour` (string), `sold:true` for archive pieces, `tags:[]`. Add the four sold one-of-ones from
`index.html` as `c11..c14` (`cat:'tees'`, `collection:'custom-prints'`, `sold:true`).
`KA_COLLECTIONS = [{slug,name,tag,blurb,img}]` with slugs: `kente-codes`, `adinkra-series`,
`ankara-after-dark`, `wraps-caps`, `custom-prints`.
`KA_MAKERS = [{slug,name,series,status:'live'|'upcoming',city,bio,long,collection}]` for
`efua-mensah`, `kwame-asante`, `zuri-olayinka`.
`KA_LOOKS = [{id,img,title,caption,productIds:[]}]` for look-1..8 (captions from index.html).

### `core.js` → `window.KA_CORE` (owner: foundation). Pure, DOM-free, also `module.exports` for node tests.
```js
KA_CORE.money(n)                      // '£38' for ints, '£4.95' otherwise
KA_CORE.findProduct(id)
KA_CORE.unitPrice(item)               // by item.kind
KA_CORE.lineTotal(item)
KA_CORE.subtotal(items)
KA_CORE.itemCount(items)
KA_CORE.zoneFor(countryCode)          // 'UK'|'EU'|'AFRICA'|'ROW'
KA_CORE.shippingOptions(countryCode, subtotal) // [{id,label,price,days}] (price 0 when free; gift-only carts => [{id:'digital',price:0}])
KA_CORE.applyPromo(code, subtotal)    // {ok, code, discount, label, error}
KA_CORE.totals(items,{country,methodId,promoCode}) // {subtotal,discount,shipping,total,promo}
KA_CORE.bulkQuote(unitPrice, qty)     // {tier, off, unit, total, saving}
KA_CORE.studioPrice(design)           // garment base + placement surcharge
KA_CORE.orderRef(seed?)               // 'KA-XXXXXX'
KA_CORE.validate.email(s) / .postcode(s,country) / .required(s) / .phone(s)
KA_CORE.escapeHtml(s)                 // ALL user/localStorage text goes through this before innerHTML
```
Cart item shapes (localStorage key `ka_cart`; items with no `kind` are `product`):
```js
{kind:'product', id, size, qty}
{kind:'custom',  uid, name, garment, colour, size, qty, price, design:{printId|printDef, placement, scale, rotate, x, y}, thumb /* svg data-uri */}
{kind:'gift',    uid, amount, to, from, email, message, sendOn, qty:1}
```

### `app.js` (owner: foundation) — shared chrome
Nav + mobile menu + theme + cart drawer + **injected footer** (`<footer data-ka-footer>`), toasts,
reveal, carousel, scroll pill. Shop/product renderers MOVE OUT to `shop.js` / `product.js`.
```js
kaCart.add(id,size,qty) · kaCart.addItem(item) · kaCart.items() · kaCart.update(index,qty)
kaCart.remove(index) · kaCart.clear() · kaCart.count() · kaCart.open() · kaCart.close()
kaCart.onChange(fn)
kaToast(msg, type?)                 // 'ok'|'err'
kaWishlist.toggle(id) / .has(id) / .list() / .onChange(fn)   // key 'ka_wish'
kaForms.submit(kind, payload) -> Promise<{ok, via:'endpoint'|'mailto'|'local'}> // posts to formEndpoint or opens mailto; always stores to localStorage 'ka_submissions'
kaModal.open(html,{label}) / kaModal.close()                  // focus-trapped dialog
```
Drawer "Checkout →" goes to `checkout.html`. Drawer renders all three item kinds. Nav: Shop
dropdown (all/tees/sweatshirts/accessories/collections/gift cards), Studios dropdown
(`studio.html`, `lab.html`, `bulk.html`), Lookbook (`lookbook.html`), Makers (`makers.html`),
Sizing, About, wishlist + cart buttons. Footer adds Contact, Gift cards, Crew & Bulk, Makers.

### `prints.js` → `window.KA_PRINTS` (owner: prints). Procedural SVG print engine, DOM-free strings.
```js
KA_PRINTS.list()            // built-ins: >=12 prints across families 'kente'|'ankara'|'adinkra'
                            // {id,name,family,maker,meaning,def}
KA_PRINTS.get(id)           // built-in or saved custom
KA_PRINTS.defaults(family)  // a fresh def for the Print Lab
KA_PRINTS.tileSvg(def,{size})        // standalone <svg> string of one repeat tile
KA_PRINTS.patternDef(def,{id,scale,rotate}) // '<pattern id=… patternUnits="userSpaceOnUse" patternTransform=…>…</pattern>'
KA_PRINTS.dataUri(def,{size})        // for CSS backgrounds / <img>
KA_PRINTS.randomize(def, seed)       // deterministic remix
KA_PRINTS.symbols()         // adinkra symbol set [{id,name,meaning,path}] — original simplified geometric glyphs
KA_PRINTS.saved.list()/save(def)/remove(id)   // localStorage 'ka_prints', ids 'c_…'
// def = {family, palette:[hex…], params:{…family-specific…}, name}
```

### Exact `KA_CONFIG.studio` (foundation defines, studio + core consume)
```js
studio: {
  garments:   [{id:'tee',name:'Heavyweight Tee',base:38},{id:'longsleeve',name:'Long-Sleeve Tee',base:42},
               {id:'crew',name:'Fleece Crewneck',base:60},{id:'hoodie',name:'Heavyweight Hoodie',base:66}],
  colours:    [{id:'white',name:'White',hex:'#f4f1ea'},{id:'black',name:'Black',hex:'#121013'},
               {id:'burgundy',name:'Burgundy',hex:'#5a1029'},{id:'navy',name:'Navy',hex:'#14213d'},
               {id:'olive',name:'Olive',hex:'#4a5232'},{id:'cream',name:'Cream',hex:'#e9dfc8'},
               {id:'mauve',name:'Mauve',hex:'#8a6a78'},{id:'cobalt',name:'Cobalt',hex:'#1f4fa8'}],
  placements: [{id:'chest',name:'Chest panel',surcharge:0},{id:'diagonal',name:'Diagonal sweep',surcharge:4},
               {id:'stripe',name:'Side stripe',surcharge:0},{id:'pocket',name:'Pocket',surcharge:0},
               {id:'sleeves',name:'Sleeves',surcharge:4},{id:'allover',name:'All-over',surcharge:8}],
  sizes: ['XS','S','M','L','XL','2XL','3XL']
}
```
`KA_CORE.studioPrice({garment, placement})` = garment.base + placement.surcharge.
Studio design object: `{garment, colour, printId, printDef?, placement, scale (0.4–2.5), rotate (0–360), x, y, view:'front'|'back'}`.
`KA_CONFIG.siteUrl = 'https://www.kharisandaletheia.com'` (PLACEHOLDER, listed in `placeholders`).

## Pages & owners

| Owner | OWNS | Delivers |
|---|---|---|
| foundation | `config.js products.js core.js app.js styles.css` + footers/script tags of `about.html policies.html sizing.html` | everything under "Shared globals" |
| catalog | `shop.html shop.js shop.css product.html product.js product.css` | search, sort, category + collection + price + availability filters (URL-synced, `?collection=`), result count, empty state, sold archive toggle, wishlist hearts, quick-add with size picker; product page: size selector w/ guidance, size-guide modal, accordions (details, care, delivery & returns, the print's meaning), maker attribution, sold-out state, wishlist, share (navigator.share / copy), recently viewed, related, JSON-LD Product, unknown-id state |
| prints | `prints.js tests/prints.test.js` | the engine above |
| studio | `studio.html studio.js studio.css` | Tee Studio: garment (tee/long-sleeve/crew/hoodie as inline SVG silhouettes), garment colour, print picker (built-in + saved), placement (chest panel, diagonal, side stripe, pocket, sleeves, all-over), scale/rotate sliders, drag to position, front/back, live SVG preview, live price, size + qty, reset/randomize, design persisted in URL hash + localStorage, add to cart as `kind:'custom'` with SVG thumb |
| lab | `lab.html lab.js lab.css` | Print Lab: family tabs, palette editor (house palettes + custom), family params (stripe widths/counts, block shapes, symbol pick + density), seed randomize, undo/redo, live tiled preview, save to "My prints", rename/delete, download SVG, "Send to Tee Studio" (`studio.html#print=<id>`) |
| checkout | `checkout.html checkout.js checkout.css order.html order.js` | full checkout: cart review (edit qty/remove), contact, shipping address w/ country → live shipping options, promo, totals, validation w/ inline errors, payment adapter (`request` default: order saved to `ka_orders`, sent via kaForms; `paystack`: inline popup when key present), `order.html?ref=` confirmation w/ printable summary; empty-cart state |
| forms | `bulk.html bulk.js gift.html gift.js contact.html contact.js forms.css` | Crew & Bulk quote calculator + enquiry; gift cards (amount, recipient, message, send date, add to cart as `kind:'gift'`); contact page w/ FAQ accordion |
| home | `index.html lookbook.html lookbook.js makers.html makers.js home.css` | index: every card/CTA links to its real page, product grids render from `KA_PRODUCTS`, notify form for the upcoming capsule, newsletter; lookbook w/ shop-the-look panels from `KA_LOOKS`; makers profiles + their series |
| tooling | `tools/*.mjs tests/core.test.js tests/catalog.test.js package.json README.md` | `tools/check-links.mjs` (every local href/src + `#anchor` resolves), `tools/check-html.mjs` (lang, title, meta description, one h1, img alt, label-for, script order, footer placeholder), `tools/check-contract.mjs` (every `KA_*`/`kaCart.*`/`kaForms.*` member referenced anywhere is defined), `tools/preflight.mjs` (launch blockers: placeholders), `node --test tests/` |

`package.json` has scripts only (`test`, `check`), **no dependencies**.
