# Kharis & Aletheia

A made-to-order storefront for African-print streetwear: cut-and-sewn tees, sweatshirts and
accessories, a custom Tee Studio, a procedural Print Lab, gift cards and a Crew & Bulk quote tool.

Vanilla static HTML/CSS/JS. Multi-page, zero dependencies, no build step, no bundler. It runs
straight from `file://` as well as from any static host — there is nothing to compile.

## File map

```
index.html / home.css / home.js          Landing page, product grids, notify + newsletter forms
shop.html / shop.css / shop.js           Full catalog — search, filters, sort, wishlist
product.html / product.css / product.js  Single product — sizing, accordions, related, JSON-LD
studio.html / studio.css / studio.js     Tee Studio — build a custom garment + print
lab.html / lab.css / lab.js              Print Lab — design/save/export a procedural print
bulk.html / bulk.js                      Crew & Bulk — quote calculator + enquiry
gift.html / gift.js                      Gift cards
checkout.html / checkout.css / checkout.js   Cart review → contact → shipping → payment
order.html / order.js                    Order confirmation (by ?ref=)
lookbook.html / lookbook.js              Shop-the-look editorial grid
makers.html / makers.js                  Maker profiles + their series
contact.html / contact.js                Contact form + FAQ
about.html, sizing.html, policies.html   Static content pages
forms.css                                Shared form styling (bulk/gift/contact)

config.js       window.KA_CONFIG   — site-wide settings (see "Configuring config.js" below)
products.js     window.KA_PRODUCTS, KA_CAT_LABEL, KA_COLLECTIONS, KA_MAKERS, KA_LOOKS
core.js         window.KA_CORE     — pure cart/shipping/promo/validation math (also usable from
                                     node via require('./core.js'), no DOM needed)
prints.js       window.KA_PRINTS   — procedural SVG print engine (kente/ankara/adinkra), also
                                     DOM-free and require()-able
app.js          Shared chrome: nav, mobile menu, theme toggle, cart drawer, wishlist, toasts,
                forms, modal, injected footer

styles.css      The design system: colour/font tokens, both themes (light via
                html[data-theme="light"]), layout primitives, component classes
assets/         Images, logos, icon, og-cover.jpg, manifest.json (image dimensions + webp map)

site.webmanifest   PWA manifest (name, theme colour, 192/512 icons)
robots.txt         Crawl rules; disallows checkout.html/order.html/404.html
sitemap.xml        Every indexable page, built from KA_CONFIG.siteUrl (see launch checklist)

tools/          Zero-dependency build checks (see below)
tests/          node:test suites (see below)
```

Every page follows the same shell: `<html lang="en">`, the standard `<head>` (fonts, inline
theme-bootstrap script, `styles.css` + a page stylesheet), `<body data-page="…">`, page content
inside `<div class="page">`, `<footer data-ka-footer></footer>` (filled in by `app.js`), then
scripts in contract order — `config.js`, `products.js`, `core.js`, `prints.js` (only on pages that
use the print engine), `app.js`, the page's own script.

## Configuring `config.js`

Everything the owner needs to supply before launch lives in `window.KA_CONFIG` at the top of
`config.js`, and is listed by key in `KA_CONFIG.placeholders`. `npm run preflight` fails on
purpose while that list is non-empty — that's how you know what's left. As of writing:

- **`contactEmail`** — the real inbox. Used for the `mailto:` form fallback and for order
  notices when `payment.provider` is `'request'`.
- **`formEndpoint`** — a POST JSON endpoint (Formspree-style: `{kind, payload, ts}` in the
  body). Leave `''` to fall back to a `mailto:` link — every form still saves a local copy to
  `localStorage['ka_submissions']` either way.
- **`payment`** — `{ provider: 'request' | 'paystack', paystackPublicKey }`.
  - `'request'` (default): checkout never charges a card. The order is saved to
    `localStorage['ka_orders']` and sent via `kaForms.submit('order', …)` for the owner to
    process manually.
  - `'paystack'`: checkout opens Paystack's inline popup using `paystackPublicKey`. Get a real
    key from the Paystack dashboard first.
- **`shipping.zones`** — real carriers/rates/`freeOver` thresholds per zone (`UK`/`EU`/`AFRICA`/
  `ROW`). A country not listed under `UK`/`EU`/`AFRICA` falls back to `ROW`.
- **`promos`** — launch promo codes (or leave empty to ship with none).
- **`siteUrl`** — the real production domain, used for JSON-LD and canonical/share links.

Once every entry is filled in for real, remove it from `KA_CONFIG.placeholders` — `npm run
preflight` will pass once the array is empty.

`KA_CONFIG.studio` (garments/colours/placements/sizes), `KA_CONFIG.bulkTiers` and
`KA_CONFIG.giftAmounts` are product decisions, not owner placeholders — edit them directly if the
catalog changes.

## Running the checks

Zero dependencies — everything below is Node built-ins only (`node:fs`, `node:path`, `node:vm`,
`node:test`, `node:assert`). No `npm install` is needed or possible (there is nothing to install).

```
npm test        # node --test tests/*.test.js — unit + data-integrity tests
npm run check   # tools/check-links.mjs && tools/check-html.mjs && tools/check-contract.mjs
npm run preflight   # tools/preflight.mjs — launch-blocker report (see above)
```

- **`tools/check-links.mjs`** — every local `href`/`src`/`srcset`/`poster` in `*.html`, every
  `url(...)` in `*.css`, and every string literal in `*.js` that looks like a local
  `.html/.jpg/.jpeg/.png/.webp/.svg/.gif` path resolves to a real file. Every `#anchor` resolves
  to a real `id=` on its target page, or is a hash the page's own JS is known to handle (shop
  category hashes `#tees`/`#sweatshirts`/`#accessories`, or a Tee Studio `#key=value` hash).
  `node tools/check-links.mjs --dead-ends` runs a second pass: it fails if any link whose visible
  text mentions "Tee Studio", "Print Lab", "Crew & Bulk", "Gift Card(s)", "Get notified", or a
  named collection still points at a plain `shop.html`, `index.html#studios` or a bare `#`.
- **`tools/check-html.mjs`** — every page has `<!doctype html>`, `<html lang>`, `<meta charset>`,
  a viewport meta, a non-empty `<title>` and meta description, exactly one `<h1>` (or `<body
  data-h1="js">` documenting a JS-rendered heading), `alt=` on every `<img>`, a `<label for>` /
  `aria-label` / wrapping `<label>` on every form field, no duplicate `id`s, the inline
  theme-bootstrap script, `styles.css` linked, scripts in contract order, `<footer
  data-ka-footer>`, and `<body data-page>`.
- **`tools/check-contract.mjs`** — every `KA_CORE.*`, `KA_PRINTS.*` (incl. `.saved.*`),
  `kaCart.*`, `kaForms.*`, `kaWishlist.*`, `kaModal.*` and `KA_CONFIG.<top-level>` member
  referenced anywhere is actually defined (real values from `config.js`/`products.js`/`core.js`/
  `prints.js`, statically parsed for `app.js`). Also checks that every product id / collection
  slug / maker slug referenced by an `id`-like attribute, a `?key=` query string, or an
  object-literal key actually exists.
- **`tools/preflight.mjs`** — see "Configuring config.js" above. This one is *meant* to fail
  until the owner has filled everything in; that non-zero exit is the point, not a bug.

None of these tools weaken themselves for convenience, and none of them start a server — they
only read files from disk and, where the site's own JS needs to run, execute it in an isolated
`node:vm` sandbox (a stubbed `window`/`localStorage`/`document`), never `eval` in this process's
own global scope.

### Tests

- **`tests/core.test.js`** — `KA_CORE` (money formatting, unit/line pricing for all three cart
  item kinds, subtotal/item count, shipping zones + the free-shipping threshold [incl. the
  post-discount edge], promo codes, `totals()` never going negative, bulk-quote tier boundaries,
  `studioPrice()` for every garment × placement, `orderRef()` format, every validator,
  `escapeHtml()`).
- **`tests/catalog.test.js`** — data integrity across `products.js`: unique/well-formed product
  ids, every referenced image exists on disk, positive prices, known categories/collections/
  makers, `KA_LOOKS` product references resolve, `c11`–`c14` are the sold custom-print
  one-of-ones.
- **`tests/prints.test.js`** *(owned by the prints builder)* — the procedural print engine.

## Deploying

There is no build step. Push the repository (minus `tools/`, `tests/`, `package.json`, `README.md`
and any dotfiles, none of which the browser needs) to any static host — GitHub Pages, Netlify,
Vercel's static hosting, S3 + CloudFront, or a plain nginx/Apache document root — and point it at
`index.html`. Because every page uses relative paths throughout, the whole site also works
unmodified from `file://` for local review.

## Launch checklist

1. Fill in every key listed in `KA_CONFIG.placeholders` (`config.js`) with real values.
2. `npm run preflight` — must print `PREFLIGHT: READY` (exit 0).
3. `npm run check` — must print `PASS` for links, HTML structure and the API contract.
4. `node tools/check-links.mjs --dead-ends` — must print `PASS`.
5. `npm test` — every unit and data-integrity test green.
6. Open every page at 360px width and at desktop width, in both light and dark theme, with the
   browser console open — zero errors.
7. Walk the real flows end to end: shop → product → add to cart → checkout → order confirmation;
   Tee Studio → add to cart; Print Lab → "Send to Tee Studio"; gift card → cart → checkout; Crew &
   Bulk quote → enquiry.
8. Deploy to the static host of your choice and re-run steps 6–7 against the live URL.
9. **`robots.txt` and `sitemap.xml` are generated against the placeholder domain**
   (`https://www.kharisandaletheia.com`, the same placeholder as `KA_CONFIG.siteUrl`). Once the
   real production domain is set, regenerate both files (every `<loc>`/`Sitemap:` line and every
   page's `og:url`/`twitter:*`/canonical `<link>`, which are built from the same `siteUrl`) so
   they point at the real domain rather than the placeholder before submitting the sitemap to
   Search Console / Bing Webmaster Tools.
