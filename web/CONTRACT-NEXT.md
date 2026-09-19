# KHARIS & ALETHEIA — Next.js + Tailwind port contract

Port the **existing, fully-working vanilla static storefront** (repo root: `../*.html`, `../app.js`,
`../styles.css`, `../core.js`, `../prints.js`, `../products.js`, `../config.js`) into a **Next.js 16
App Router + React 19 + Tailwind v4 + TypeScript** app that lives in this `web/` directory and is
served by Docker. **This is a faithful port, not a redesign.** Same look, same copy, same features,
same verified behaviour. The old site is the spec — when in doubt, open the old file and match it.

Scaffold already done (do NOT re-run create-next-app): Next 16.3.5, React 19.2.8, Tailwind v4
(`@tailwindcss/postcss`, CSS-first config via `@theme` in globals.css — there is NO tailwind.config.js),
TypeScript, `output: "standalone"` + `images.unoptimized: true` in `next.config.ts`. Assets already
copied to `web/public/assets/…` (referenced as `/assets/…`). Node 26 local, node:22-alpine in Docker.

## Hard rules (every agent)

- **NEVER start a dev server** (`next dev`, `npm run dev`, `next start`) — the owner's machine crashes on dev servers. Verify ONLY with `npm run build` (from `web/`) and `node --test`. The orchestrator does the containerized runtime verification separately.
- **HYDRATION — the #1 trap.** NEVER read `localStorage`/`sessionStorage`/`window`/`document`/`Date.now()`/`Math.random()` during render or in a `useState(initializer)`. Read them in `useEffect` AFTER mount and set state there. First server render and first client render MUST be identical. Theme is set by a tiny inline `<script>` in `<head>` (before hydration, mirroring the old bootstrap) to avoid a flash; the React theme provider reads the DOM attribute in `useEffect`, never during render. Any component using `useSearchParams`/`usePathname` must be a client component wrapped in `<Suspense>`.
- **Only edit files in your OWNS list.** Code against the APIs/types in this contract exactly, even if a sibling agent is still writing them.
- No new runtime UI dependencies (no component libs, no state libs, no CSS-in-JS). Tailwind + the ported design-system CSS only. `clsx`-style joins: write a 3-line local helper, don't add a package.
- TypeScript is LOOSE: `strict` may stay on but liberal use of `any`/`as` is fine to keep the port fast. The build must pass with **zero type errors and zero build errors**.
- Responsive to 360px, no horizontal scroll; grids use `minmax(0,1fr)` / `min-w-0`. Works in BOTH themes (`html[data-theme="light"]` and default dark). Honour `prefers-reduced-motion`. Real `<button>/<a>/<label htmlFor>`, visible focus rings, keyboard operable, Esc closes overlays, `aria-live` on async status.
- Currency GBP (£). Copy voice and all product/collection/maker/look data come verbatim from the old files. No fake data/reviews/urgency.
- Do NOT commit to git. Do NOT touch `../` (the old static site) except to READ it.

## Design system (globals.css + Tailwind v4 @theme)

`app/globals.css` must: `@import "tailwindcss";` then port the ENTIRE `../styles.css` (tokens in `:root`,
the `html[data-theme="light"]` overrides, and every component class: `.glitch`, `.hero*`, `.scanlines`,
`.btn/.btn-berry/.btn-gold/.btn-solid`, `.micro`, `.h-display/.h-xl/.h-lg/.h-md`, `.page/.page-hero`,
`.reveal`, `.pill`, `.pd-field`, `.card*`, `.nav*`, `.cart-*`, `.wish-*`, `.toast*`, `.modal*`,
`.accordion`, `.field*`, `.empty-state`, `.panel`, forms.css, shop.css, product.css, studio.css,
lab.css, home.css, checkout.css — merge ALL of the old per-page CSS into globals.css or `@import`ed
partials under `app/`). Expose tokens to Tailwind utilities via `@theme`:
```css
@theme {
  --color-bg: #070308; --color-surface: #0d060d; --color-surface-2: #120812;
  --color-gold: #d8b26a; --color-gold-hi: #f0d6a0; --color-berry: #e8325e; --color-berry-hi: #ff6d92;
  --color-crimson: #8b0e3a; --color-maroon: #2a0816; --color-fg: #f7f1e8; --color-muted: #a08e93;
  --font-display: 'Orbitron', sans-serif; --font-mono: 'JetBrains Mono', ui-monospace, monospace; --font-pixel: 'Tiny5', monospace;
}
```
So `bg-surface text-fg border-gold font-display` etc. work. Keep the runtime `--gold`/`--berry` CSS
vars too (the component classes and light-theme overrides depend on them). Fonts: load Orbitron +
JetBrains Mono + Tiny5 (the old Google Fonts link is fine in `app/layout.tsx` `<head>`, or `next/font`).
Zero border-radius house style. **Use Tailwind utilities for layout/spacing/responsive/state in JSX;
keep the complex effects (glitch, hero, scanlines) as the ported CSS classes.**

## Shared modules — `lib/` (owner: engine)

Port each old file to an ESM TypeScript module, logic UNCHANGED (they are pure / DOM-free where noted):
- `lib/config.ts` → `export const KA_CONFIG = {…}` (verbatim from `../config.js`, incl. the exact `studio`, `shipping.zones`, `promos`, `bulkTiers`, `giftAmounts`, `placeholders`). Add `NEXT_PUBLIC_*` env overrides for `contactEmail`, `siteUrl`, `formEndpoint`, `payment.provider`, `payment.paystackPublicKey` (read `process.env.NEXT_PUBLIC_…` with the current values as fallback).
- `lib/products.ts` → `export const KA_PRODUCTS`, `KA_CAT_LABEL`, `KA_COLLECTIONS`, `KA_MAKERS`, `KA_LOOKS` (verbatim from `../products.js`).
- `lib/core.ts` → `export const KA_CORE = {…}` — port `../core.js` exactly (money, findProduct, unitPrice, lineTotal, subtotal, itemCount, zoneFor, shippingOptions, applyPromo, totals, bulkQuote, studioPrice, orderRef, validate.*, escapeHtml). Pure, isomorphic. It read `window.KA_CONFIG/KA_PRODUCTS` in the browser — instead import `KA_CONFIG` from `./config` and `KA_PRODUCTS` from `./products` directly. Keep `_init` for tests if easy, else tests import config/products directly.
- `lib/prints.ts` → `export const KA_PRINTS = {…}` — port `../prints.js` exactly (list/get/defaults/tileSvg/patternDef/dataUri/randomize/symbols/sanitize/saved.*). Pure string output. `saved.*` uses `localStorage` guarded by try/catch (no-op server-side; only call from client effects/handlers).
- `lib/types.ts` → shared TS types: `CartItem` (union of product/custom/gift — SAME shapes and localStorage key `ka_cart` as the old site), `Product`, `Collection`, `Maker`, `Look`, `PrintDef`, `StudioDesign`, `Order`.
- Tests: `tests/core.test.ts`, `tests/prints.test.ts`, `tests/catalog.test.ts` ported from `../tests/*` and `../prints.test.js`, run by `node --test tests/*.test.ts` (Node strips types). Keep them meaningful; they must pass.

## Providers + shared components — `app/`, `components/` (owner: foundation)

Client providers wrapping `children` in `app/layout.tsx` (one `<Providers>` client boundary). Hooks:
- `useCart()` → `{ items, add(id,size,qty), addItem(item), update(i,qty), remove(i), clear(), count, subtotal, open(), close(), isOpen }` — localStorage `ka_cart`, read in effect, persists on change, backward-compatible with kind-less items. Renders all 3 kinds in the drawer with thumbs (custom item `thumb` is an SVG data-URI — guard it exactly like old `app.js safeImgSrc`, do not escape it into oblivion).
- `useWishlist()` → `{ ids, has(id), toggle(id), count }` — key `ka_wish`.
- `useTheme()` → `{ theme, toggle() }` — key `ka_theme`; DOM attribute set by inline head script pre-hydration.
- `useToast()` → `toast(msg, type?)`; `<ToastHost/>`.
- `useModal()` → `open(node,{label}), close()`; focus-trapped `<ModalHost/>`, Esc, click-out, returns focus.
- `useForms()` → `submit(kind,payload): Promise<{ok,via}>` — POST `KA_CONFIG.formEndpoint` if https, else `mailto:` fallback to `contactEmail`; always append to localStorage `ka_submissions`. Honeypot supported by callers.

Shared components (`components/…`, all typed, both themes, a11y): `Nav` (Shop dropdown with live counts from KA_PRODUCTS, Studios dropdown → /studio /lab /bulk, Lookbook, Makers, Sizing, About, wishlist button→/shop?wish=1 with count, cart button with count, mobile menu with EVERY destination incl. /contact, skip link, aria-expanded, Esc), `Footer` (Shop/Studios/House/Help columns incl. Contact, Gift cards, Crew & Bulk, Makers, Lookbook, Sizing, About, Policies; dynamic year — but compute year in an effect or pass from server to avoid hydration mismatch, OR hardcode 2026), `CartDrawer`, `Button`, `Field`/`Input`/`Select`/`Textarea`/`Checkbox` (labelled, error slot, aria-describedby), `Accordion` (native details/summary styled), `GlitchHeading` (renders `.h-display .glitch` with `data-text`), `PageHero`, `Reveal` (IntersectionObserver, respects reduced motion), `ProductCard` (image, name, price, wish heart, quick-add), `Money` (KA_CORE.money). Export a `cn(...)` class-join helper in `lib/cn.ts`.

`app/layout.tsx`: `<html lang="en">`, `<head>` fonts + theme bootstrap inline script + favicon/meta, `<body>`
`<Providers>` → skip-link, `<Nav/>`, `<main id="main">{children}</main>`, `<Footer/>`, `<CartDrawer/>`,
`<ToastHost/>`, `<ModalHost/>`. Per-page metadata via the App Router `metadata` export / `generateMetadata`.

## Routes & owners (each = an `app/<route>/page.tsx` + colocated client components)

Read the matching OLD html+js and port faithfully. Query params via `useSearchParams` (client + Suspense).

| Owner | OWNS (under `web/`) | Old sources to port |
|---|---|---|
| engine | `lib/config.ts lib/products.ts lib/core.ts lib/prints.ts lib/types.ts lib/cn.ts tests/*.test.ts` | ../config.js ../products.js ../core.js ../prints.js ../tests/* ../prints.test.js |
| foundation | `app/layout.tsx app/globals.css app/providers.tsx components/** app/loading.tsx` (shared only) | ../styles.css ../app.js (nav/footer/cart/wishlist/theme/toast/modal/reveal/carousel) + all per-page css |
| home | `app/page.tsx app/lookbook/** app/makers/**` + their css | ../index.html ../home.js ../lookbook.html ../lookbook.js ../makers.html ../makers.js ../home.css |
| catalog | `app/shop/** app/product/**` | ../shop.html ../shop.js ../shop.css ../product.html ../product.js ../product.css |
| studio | `app/studio/**` | ../studio.html ../studio.js ../studio.css |
| lab | `app/lab/**` | ../lab.html ../lab.js ../lab.css |
| commerce | `app/checkout/** app/order/**` | ../checkout.html ../checkout.js ../checkout.css ../order.html ../order.js |
| forms | `app/bulk/** app/gift/** app/contact/**` | ../bulk.html ../bulk.js ../gift.html ../gift.js ../contact.html ../contact.js ../forms.css |
| static | `app/sizing/** app/about/** app/policies/** app/not-found.tsx` | ../sizing.html ../about.html ../policies.html ../404.html |

Route map: `/`→home, `/shop`, `/product?id=`, `/studio` (accepts `#print=`), `/lab`, `/bulk`, `/gift`,
`/checkout`, `/order?ref=`, `/lookbook` (`#look-N`), `/makers` (`#slug`), `/contact`, `/sizing`, `/about`,
`/policies`, `not-found.tsx` = the on-brand 404. **Every internal link uses `next/link` and the new
route paths (NOT `shop.html`).** Old inbound hashes still work: `/shop?cat=tees` or `/shop#tees`,
`/shop?collection=<slug>`, `/shop?wish=1`.

Studio/Lab: keep the heavy imperative logic (SVG garment build, drag, pattern fill, undo/redo,
palette editor) — port it into a `'use client'` component running against refs in `useEffect`/handlers,
importing `KA_PRINTS`/`KA_CORE`/`KA_CONFIG`. You do NOT have to make it declarative; a ref + effect that
runs the ported logic is fine and preferred for fidelity. Design persisted to localStorage + URL hash,
sanitised on read (whitelist ids, clamp numbers, hex-only colours).

## Docker (owner: docker)

`web/Dockerfile` (multi-stage, `node:22-alpine`): deps → build (`npm ci && npm run build`) → runtime
copies `.next/standalone`, `.next/static`, `public`; non-root `node` user; `ENV PORT=3000 HOSTNAME=0.0.0.0`;
`EXPOSE 3000`; `CMD ["node","server.js"]`; a `HEALTHCHECK` hitting `/`. `web/.dockerignore`
(node_modules, .next, .git, legacy). `docker-compose.yml` at **repo root**: service `web`, build context
`./web`, `ports: "3000:3000"`, `restart: unless-stopped`, `env_file` optional, the `NEXT_PUBLIC_*` config
env vars documented. A root `README-DEPLOY.md`: how to run on Windows (install Docker Desktop, then
`docker compose up -d --build`), how to set the config env vars, and the launch checklist.

## Definition of done (orchestrator verifies)
`cd web && npm run build` zero errors · `node --test tests/*.test.ts` all pass · `docker build` OK ·
container serves every route 200 with zero console errors in both themes at 375px+desktop · the 8
end-to-end flows pass over http · committed + pushed.
