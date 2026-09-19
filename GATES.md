# GATES — Kharis & Aletheia storefront build

- [ ] G1 unit tests green
  CHECK: node --test tests/*.test.js 2>&1 | tail -12
  EXPECT: /fail 0/
  EVIDENCE: pending

- [ ] G2 every local link, asset and anchor resolves
  CHECK: node tools/check-links.mjs
  EXPECT: PASS
  EVIDENCE: pending

- [ ] G3 HTML structure checks pass on every page
  CHECK: node tools/check-html.mjs
  EXPECT: PASS
  EVIDENCE: pending

- [ ] G4 every shared API referenced is defined (cross-file contract)
  CHECK: node tools/check-contract.mjs
  EXPECT: PASS
  EVIDENCE: pending

- [ ] G5 all JS parses
  CHECK: for f in *.js tools/*.mjs tests/*.js; do node --check "$f" || echo FAIL "$f"; done; echo SYNTAX-DONE
  EXPECT: /^SYNTAX-DONE/m
  EVIDENCE: pending

- [ ] G6 all promised pages exist
  CHECK: for f in index shop product studio lab bulk gift checkout order lookbook makers contact sizing about policies 404; do [ -f $f.html ] || echo MISSING $f; done; echo PAGES-DONE
  EXPECT: /^PAGES-DONE/m
  EVIDENCE: pending

- [ ] G7 no dead-end studio/CTA links left pointing at the generic shop or #studios
  CHECK: node tools/check-links.mjs --dead-ends
  EXPECT: PASS
  EVIDENCE: pending

- [ ] G8 browser sweep on file:// — every page loads with zero console errors, both themes, 375px + desktop
  CHECK: node tools/browser/sweep.mjs 2>&1 | tail -1
  EXPECT: PASS
  EVIDENCE: pending

- [ ] G9 end-to-end flows driven in the browser: product→cart→checkout→order; studio→cart; lab→studio; gift→cart; bulk quote
  CHECK: node tools/browser/flows.mjs 2>&1 | tail -1
  EXPECT: PASS
  EVIDENCE: pending

- [ ] G10 committed and pushed to a private GitHub repo
  EVIDENCE: pending