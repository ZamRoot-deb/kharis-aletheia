// Page sweep: every page x theme x viewport on file:// in headless Chrome. No server.
import { launch, openPage } from './cdp.mjs'
import { mkdirSync } from 'node:fs'

const ROOT = process.env.KA_ORIGIN || 'http://localhost:3000'
const OUT = new URL('./.shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const PAGES = (process.argv[2] || '/,/shop,/product?id=t01,/product?id=c11,/product?id=zzz,/studio,/lab,/bulk,/gift,/contact,/checkout,/order?ref=KA-NOPE00,/lookbook,/makers,/sizing,/about,/policies,/no-such-page,/shop?collection=kente-codes,/shop?wish=1').split(',')
const VIEWS = [{ n: 'desk', width: 1440, height: 900, mobile: false }, { n: 'mob', width: 375, height: 812, mobile: true }]
const THEMES = ['dark', 'light']

const PROBE = `(()=>{
  const de=document.documentElement, vw=innerWidth;
  const wide=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>vw+1&&getComputedStyle(e).position!=='fixed'&&!e.closest('.car-track,.cart-drawer,.mobile-menu,[data-allow-overflow]')}).slice(0,4).map(e=>e.tagName.toLowerCase()+'.'+(e.className&&e.className.baseVal===undefined?String(e.className).split(' ')[0]:'')+'@'+Math.round(e.getBoundingClientRect().right));
  const lowContrast=[];
  return {
    title:document.title, h1:document.querySelectorAll('h1').length,
    nav:!!document.querySelector('nav.nav'), footer:(document.querySelector('footer')||{}).children?.length||0,
    main:!!document.querySelector('main,[role=main],#main'),
    overflowX:de.scrollWidth-de.clientWidth, wide,
    brokenImgs:[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&i.getAttribute('src')).map(i=>i.getAttribute('src')).slice(0,5),
    textLen:document.body.innerText.length,
    emptyLinks:[...document.querySelectorAll('a')].filter(a=>!a.getAttribute('href')||a.getAttribute('href')==='#').map(a=>a.textContent.trim().slice(0,30)).slice(0,5)
  }})()`

const b = await launch({ port: 9333, profile: new URL('./.shots/chrome-prof-sweep-next', import.meta.url).pathname })
const rows = []
try {
  for (const v of VIEWS) for (const theme of THEMES) {
    const page = await openPage(b, { ...v, theme })
    for (const p of PAGES) {
      page.errors.length = 0
      await page.goto(ROOT + p, 1100)
      let probe; try { probe = await page.eval(PROBE) } catch (e) { probe = { probeError: e.message } }
      const gotTheme = await page.eval(`document.documentElement.getAttribute('data-theme')`)
      const slug = p.replace(/[^a-z0-9]/gi, '_').replace(/^_+|_+$/g, '') || 'home'
      await page.shot(`${OUT}${slug}-${v.n}-${theme}.png`, false)
      rows.push({ p, v: v.n, theme, gotTheme, ...probe, errors: [...page.errors] })
    }
    await page.close()
  }
} finally { await b.close() }

let bad = 0
for (const r of rows) {
  const issues = []
  if (r.MISSING) issues.push('PAGE MISSING')
  if (r.probeError) issues.push('probe: ' + r.probeError)
  if (r.errors?.length && !/no-such-page|nope|404-probe/.test(r.p)) issues.push(...r.errors.filter(e=>!/favicon|Download the React DevTools|status of 404/i.test(e)))  // OLD
  if (r.gotTheme && r.gotTheme !== r.theme) issues.push(`theme ${r.gotTheme}!=${r.theme}`)
  if (r.overflowX > 1) issues.push(`overflowX ${r.overflowX}px ${r.wide?.join(' ')}`)
  if (r.brokenImgs?.length) issues.push('brokenImgs ' + r.brokenImgs.join(','))
  if (r.h1 !== undefined && r.h1 !== 1) issues.push(`h1 count ${r.h1}`)
  if (r.nav === false) issues.push('no nav')
  if (r.footer === 0) issues.push('empty footer')
  if (r.emptyLinks?.length) issues.push('empty hrefs: ' + r.emptyLinks.join('|'))
  if (r.textLen !== undefined && r.textLen < 200) issues.push(`near-empty page (${r.textLen} chars)`)
  if (issues.length) { bad++; console.log(`✗ ${r.p} [${r.v}/${r.theme}]\n    ` + [...new Set(issues)].join('\n    ')) }
}
console.log(`\nSWEEP ${rows.length} loads, ${bad} with issues → ${bad ? 'FAIL' : 'PASS'}`)
