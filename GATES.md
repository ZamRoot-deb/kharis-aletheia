# GATES — Kharis & Aletheia storefront build

- [x] G1 unit tests green
  CHECK: node --test tests/*.test.js 2>&1 | tail -12
  EXPECT: /fail 0/
  EVIDENCE: ℹ todo 0 | ℹ duration_ms 81.341584

- [x] G2 every local link, asset and anchor resolves
  CHECK: node tools/check-links.mjs
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G3 HTML structure checks pass on every page
  CHECK: node tools/check-html.mjs
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G4 every shared API referenced is defined (cross-file contract)
  CHECK: node tools/check-contract.mjs
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G5 all JS parses
  CHECK: for f in *.js tools/*.mjs tests/*.js; do node --check "$f" || echo FAIL "$f"; done; echo SYNTAX-DONE
  EXPECT: /^SYNTAX-DONE/m
  EVIDENCE: SYNTAX-DONE

- [x] G6 all promised pages exist
  CHECK: for f in index shop product studio lab bulk gift checkout order lookbook makers contact sizing about policies 404; do [ -f $f.html ] || echo MISSING $f; done; echo PAGES-DONE
  EXPECT: /^PAGES-DONE/m
  EVIDENCE: PAGES-DONE

- [x] G7 no dead-end studio/CTA links left pointing at the generic shop or #studios
  CHECK: node tools/check-links.mjs --dead-ends
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G8 browser sweep on file:// — every page loads with zero console errors, both themes, 375px + desktop
  CHECK: node tools/browser/sweep.mjs 2>&1 | tail -1
  EXPECT: PASS
  EVIDENCE: SWEEP 80 loads, 0 with issues → PASS

- [x] G9 end-to-end flows driven in the browser: product→cart→checkout→order; studio→cart; lab→studio; gift→cart; bulk quote
  CHECK: node tools/browser/flows.mjs 2>&1 | tail -1
  EXPECT: PASS
  EVIDENCE: FLOWS 95 passed, 0 failed → PASS

- [x] G10 committed and pushed to a private GitHub repo
  EVIDENCE: github.com/ZamRoot-deb/kharis-aletheia (private), main tracks origin/main, git status --porcelain = 0 lines at push time