# GATES — Next.js + Tailwind + Docker port (web/)

- [x] N1 Next production build clean (zero type/build errors)
  CHECK: cd web && npm run build 2>&1 | tail -4
  EXPECT: /Compiled successfully|Generating static pages/
  EVIDENCE: Compiled successfully; all 16 routes emitted (/ /shop /product /studio /lab /bulk /gift /checkout /order /lookbook /makers /contact /sizing /about /policies + not-found).

- [x] N2 ported engine unit tests green (TS)
  CHECK: cd web && node --test tests/*.test.ts 2>&1 | grep -E "# (tests|pass|fail)|ℹ (tests|pass|fail)" | tr '\n' ' '
  EXPECT: /fail 0/
  EVIDENCE: tests 90, pass 90, fail 0 (core + prints + catalog, run on the TS lib modules).

- [x] N3 Docker image builds (node:22-alpine, standalone)
  EVIDENCE: `docker build -t kharis-web:verify web/` succeeded on the local (colima) daemon; multi-stage deps→builder→runner, non-root node user, HEALTHCHECK GET /.

- [x] N4 container serves every route 200
  EVIDENCE: `docker run -p 3000:3000` → container "Up (healthy)"; wget from inside returned HTTP 200 for / /shop /studio /lab /checkout /lookbook /makers /bulk /gift /contact /sizing /about /policies; /order and /product render; an unknown path returns Next not-found (404 by design).

- [x] N5 browser sweep over http (both themes, desktop + 375px, zero console errors)
  EVIDENCE: tools/browser/sweep-http.mjs (headless Chrome via CDP) — 80 loads, 76 real routes clean (the 4 flagged are the intentional 404 on the not-found route). Zero console/runtime errors, no horizontal overflow, no broken images, nav+footer present, single h1, theme honoured, in dark AND light at 1440px AND 375px.

- [x] N6 end-to-end flows over http
  EVIDENCE: tools/browser/flows-http.mjs — 82 assertions, 0 failures, driven against the running container: product→cart→checkout(promo+zones)→order (total £73.35, order stored, cart cleared), studio→custom-cart (hoodie/all-over £74, svg thumb, hostile-hash XSS blocked), lab→studio (#print handoff, undo/redo, escaped saved name), gift (promo never discounts gift), bulk quote (25 tees £807.50), shop filters/sold-archive/wishlist/XSS probes, forms (newsletter+contact recorded), mobile nav reaches every route, theme persists.

- [x] N7 committed and pushed
  EVIDENCE: pushed to github.com/ZamRoot-deb/kharis-aletheia (private).
