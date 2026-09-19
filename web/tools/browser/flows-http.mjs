// End-to-end flows against the running Docker container (Next.js app) over http.
import { launch, openPage, sleep } from './cdp.mjs'
import { mkdirSync } from 'node:fs'
const O = process.env.KA_ORIGIN || 'http://localhost:3000'
const OUT = new URL('./.shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const fails = [], passes = []
const must = (ok, msg, extra) => { (ok ? passes : fails).push(msg + (ok || extra === undefined ? '' : ` → got ${JSON.stringify(extra)}`)) }
const LS = k => `JSON.parse(localStorage.getItem('${k}')||'null')`
const txt = sel => `(document.querySelector(${JSON.stringify(sel)})||{}).textContent`
// click first visible <button>/<a> whose trimmed text includes `t`, optionally scoped under `scope`
const byText = (t, scope = 'document') => `[...${scope}.querySelectorAll('button,a')].find(e=>e.offsetParent!==null && (e.textContent||'').trim().toLowerCase().includes(${JSON.stringify(t.toLowerCase())}))`

const b = await launch({ port: 9341, profile: new URL('./.shots/chrome-prof-flowshttp-' + process.pid, import.meta.url).pathname })
const only = process.argv[2]
const run = async (name, fn, view) => {
  if (only && !name.startsWith(only)) return
  const page = await openPage(b, view || {})
  await page.goto(O + '/about', 300); await page.eval(`try{localStorage.clear();sessionStorage.clear()}catch(e){}`)
  try { await fn(page) } catch (e) { fails.push(`${name}: THREW ${e.message}`) }
  const errs = [...new Set(page.errors)].filter(e => !/favicon|DevTools|status of 404/i.test(e))
  if (errs.length) fails.push(`${name}: console/runtime errors → ${errs.slice(0, 6).join(' | ')}`)
  await page.shot(`${OUT}flow-${name}.png`)
  await page.close()
}
const money = async (p, sel) => (await p.eval(txt(sel)) || '').replace(/\s+/g, ' ')

try {
  await run('F1-product-cart-checkout-order', async p => {
    await p.goto(O + '/product?id=t01', 1000)
    must(/ANKARA DIAGONAL/i.test(await p.eval('document.body.innerText')), 'F1 product shows name')
    const sz = await p.eval(`(()=>{const r=document.querySelector('input[name="pdSize"][value="L"]');if(!r)return 'NO';r.click();return (document.querySelector('input[name="pdSize"]:checked')||{}).value})()`)
    must(sz === 'L', 'F1 size L selectable', sz)
    await p.clickExpr(`document.querySelector('#pdQty')?.parentElement?.querySelector('button:last-of-type') || ${byText('+')}`)
    await p.clickExpr(`${byText('add to cart', "(document.querySelector('.pd-info')||document)")}`)
    await sleep(500)
    const cart = await p.eval(LS('ka_cart'))
    must(cart?.length === 1 && cart[0].id === 't01' && cart[0].size === 'L' && cart[0].qty === 2, 'F1 cart t01/L/x2', cart)
    must((await p.eval(txt('.cart-count'))) === '2', 'F1 nav badge 2', await p.eval(txt('.cart-count')))
    must(await p.eval(`document.querySelector('.cart-drawer')?.classList.contains('open')`), 'F1 drawer opened on add')
    await p.s('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300)
    must(!(await p.eval(`document.querySelector('.cart-drawer')?.classList.contains('open')`)), 'F1 Esc closes drawer')

    await p.goto(O + '/checkout', 1000)
    must(!!(await p.eval(`!!document.getElementById('checkoutForm')`)), 'F1 checkout form renders')
    const totals = async () => (await p.eval(txt('#coTotals')) || '').replace(/\s+/g, ' ')
    must(/76/.test(await totals()), 'F1 subtotal £76', await totals())
    await p.clickExpr(byText('place order'))
    await sleep(500)
    must(await p.eval(`location.pathname==='/checkout'`), 'F1 empty-field submit stays on checkout')
    must((await p.eval(`document.querySelectorAll('[aria-invalid="true"]').length`)) >= 3, 'F1 invalid fields flagged', await p.eval(`document.querySelectorAll('[aria-invalid="true"]').length`))
    must(!(await p.eval(LS('ka_orders')))?.length, 'F1 no order on invalid submit')
    for (const [id, v] of [['coEmail', 'ama@example.com'], ['coName', 'Ama Owusu'], ['coAddr1', '10 Downing St'], ['coCity', 'London'], ['coPostcode', 'SW1A 2AA']]) await p.type('#' + id, v)
    await p.type('#coCountry', 'GB'); await sleep(500)
    must(/free|£0|0\.00/i.test(await totals()), 'F1 UK £76 free ship', await totals())
    await p.type('#coPromoCode', ' welcome10 '); await p.clickExpr(byText('apply')); await sleep(500)
    must(/7\.60/.test(await totals()), 'F1 promo −£7.60', await totals())
    must(/73\.35/.test(await totals()), 'F1 total £73.35', await totals())
    await p.type('#coCountry', 'GH'); await sleep(500)
    must(/18\.95/.test(await totals()), 'F1 Ghana AFRICA £18.95', await totals())
    await p.type('#coCountry', 'GB'); await sleep(400)
    await p.eval(`(()=>{const a=document.querySelector('[name="ack"]');if(a&&!a.checked)a.click()})()`)
    await p.shot(`${OUT}flow-F1-checkout.png`, true)
    await p.clickExpr(byText('place order')); await sleep(2500)
    must(/\/order\?ref=KA-[A-Z0-9]{6}/.test(await p.eval('location.href')), 'F1 → /order?ref=KA-XXXXXX', await p.eval('location.href'))
    const orders = await p.eval(LS('ka_orders'))
    must(orders?.length === 1 && Math.abs(orders[0].totals.total - 73.35) < 0.01, 'F1 order total 73.35', orders?.[0]?.totals)
    must(!(await p.eval(LS('ka_cart')))?.length, 'F1 cart cleared')
    must((await p.eval('document.body.innerText')).includes(orders?.[0]?.ref || '###'), 'F1 confirmation shows ref')
  })

  await run('F2-studio-to-cart', async p => {
    await p.goto(O + '/studio', 1300)
    must((await p.eval(`document.querySelectorAll('#stageMount svg pattern').length`)) >= 1, 'F2 stage has a pattern')
    must((await p.eval(`document.querySelectorAll('#printGrid button, #printGrid .print-tile').length`)) >= 12, 'F2 ≥12 prints', await p.eval(`document.querySelectorAll('#printGrid button, #printGrid .print-tile').length`))
    const clickBtnText = t => p.clickExpr(`[...document.querySelectorAll('button')].find(e=>e.offsetParent!==null && (e.textContent||'').trim().toLowerCase().startsWith(${JSON.stringify(t.toLowerCase())}))`)
    const clickAria = t => p.clickExpr(`[...document.querySelectorAll('button,[role=button]')].find(e=>((e.getAttribute('aria-label')||e.title||'').trim().toLowerCase()===${JSON.stringify(t.toLowerCase())}))`)
    must((await clickBtnText('Heavyweight Hoodie')) === 'ok', 'F2 pick hoodie')
    must((await p.clickExpr(`document.querySelector('[aria-label="Burgundy"],[title="Burgundy"]') || [...document.querySelectorAll('button,label,[role=button]')].find(e=>/burgundy/i.test((e.getAttribute('aria-label')||e.title||e.textContent||'')))`)) === 'ok', 'F2 pick burgundy')
    must((await clickBtnText('All-over')) === 'ok', 'F2 pick all-over')
    await p.clickExpr(`document.querySelector('input[name="studioSize"][value="L"]')`)
    await p.type('#ftScale', '1.5'); await p.type('#ftRotate', '45'); await sleep(400)
    must(/74/.test(await money(p, '#priceBreakdown')), 'F2 hoodie+all-over £74', await money(p, '#priceBreakdown'))
    await p.shot(`${OUT}flow-F2-studio.png`)
    must(/hoodie/.test(decodeURIComponent(await p.eval('location.hash'))), 'F2 design in URL hash')
    await p.clickExpr(`document.querySelector('#btnAddToCart') || ${byText('add to cart')}`); await sleep(600)
    const c = (await p.eval(LS('ka_cart')))?.[0]
    must(c?.kind === 'custom' && c.price === 74 && c.size === 'L' && c.garment === 'hoodie', 'F2 custom hoodie/L/£74', c && { kind: c.kind, price: c.price, size: c.size, garment: c.garment })
    must(/^data:image\/svg\+xml/.test(c?.thumb || ''), 'F2 svg thumb', (c?.thumb || '').slice(0, 30))
    must((c?.thumb || '').length < 40000, 'F2 thumb < 40KB', (c?.thumb || '').length)
    await p.goto(O + '/studio#print=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E&garment=%22%3E%3Csvg%20onload%3Dwindow.__xss%3D1%3E', 1100)
    must((await p.eval('window.__xss')) === undefined, 'F2 hostile hash no XSS')
    must((await p.eval(`document.querySelectorAll('#stageMount svg').length`)) >= 1, 'F2 hostile hash still renders')
    await p.goto(O + '/checkout', 900)
    must(/74/.test((await p.eval(txt('#coTotals')) || '')), 'F2 checkout prices custom £74', await p.eval(txt('#coTotals')))
  })

  await run('F3-lab-to-studio', async p => {
    await p.goto(O + '/lab', 1300)
    const bg = () => p.eval(`getComputedStyle(document.getElementById('labPreview')).backgroundImage`)
    must((await bg()).length > 50, 'F3 lab preview tiled')
    await p.clickExpr(`document.querySelector('#labRandomize')`); await sleep(500); const b1 = await bg()
    await p.clickExpr(`document.querySelector('#labUndo')`); await sleep(500)
    must((await bg()) !== b1, 'F3 undo changes preview')
    await p.clickExpr(`document.querySelector('#labRedo')`); await sleep(500)
    must((await bg()) === b1, 'F3 redo restores')
    await p.type('#labName', 'Harmattan <b>x</b>')
    await p.clickExpr(`document.querySelector('#labSave') || ${byText('save')}`); await sleep(500)
    const saved = await p.eval(LS('ka_prints')); const list = Array.isArray(saved) ? saved : Object.values(saved || {})
    must(list.length === 1, 'F3 saved to ka_prints', list.length)
    must((await p.eval(`document.querySelectorAll('#labShelf b').length`)) === 0, 'F3 saved name escaped on shelf')
    await p.clickExpr(`document.querySelector('#labSendStudio') || ${byText('send to')}`); await sleep(1800)
    const href = await p.eval('location.href'); const id = list[0]?.id
    must(/\/studio/.test(href), 'F3 → /studio', href.slice(-50))
    must(/^c_/.test(id || '') && decodeURIComponent(href).includes(id), 'F3 hash carries custom id', id)
    must((await p.eval(`document.querySelectorAll('#stageMount svg pattern').length`)) >= 1, 'F3 studio renders custom print')
  })

  await run('F4-gift-card', async p => {
    await p.goto(O + '/gift', 900)
    await p.clickExpr(byText('add gift') + ` || ${byText('add to cart')}`); await sleep(300)
    must(!(await p.eval(LS('ka_cart')))?.length, 'F4 empty gift rejected')
    must((await p.clickExpr(`document.querySelector('[data-amt="50"]') || ${byText('£50')}`)) === 'ok', 'F4 £50 amount')
    await p.type('#gfTo', 'Kofi'); await p.type('#gfToEmail', 'kofi@example.com'); await p.type('#gfFrom', 'Ama'); await p.type('#gfMessage', 'Grace & truth')
    await p.clickExpr(byText('add gift') + ` || ${byText('add to cart')}`); await sleep(500)
    const g = (await p.eval(LS('ka_cart')))?.[0]
    must(g?.kind === 'gift' && g.amount === 50 && g.email === 'kofi@example.com', 'F4 gift in cart', g)
    await p.goto(O + '/checkout', 900)
    must(await p.eval(`(()=>{const d=document.getElementById('coDeliverySection');return !d||d.hidden||getComputedStyle(d).display==='none'})()`), 'F4 gift-only hides delivery')
    await p.type('#coPromoCode', 'WELCOME10'); await p.clickExpr(byText('apply')); await sleep(500)
    const t = (await p.eval(txt('#coTotals')) || '')
    must(/50/.test(t) && !/45/.test(t), 'F4 promo never discounts gift (£50)', t.replace(/\s+/g, ' ').slice(0, 80))
  })

  await run('F5-bulk-quote', async p => {
    await p.goto(O + '/bulk', 900)
    await p.type('#bkQtyInput', '25'); await sleep(400)
    const body = await p.eval('document.body.innerText')
    must(/32\.30/.test(body), 'F5 25 tees unit £32.30', (body.match(/£32\.\d\d/) || [])[0])
    must(/807\.50/.test(body), 'F5 total £807.50', (body.match(/£8\d\d\.\d\d/) || [])[0])
    await p.clickExpr(byText('send') + ` || ${byText('request')} || ${byText('submit')}`); await sleep(400)
    must((await p.eval(`document.querySelectorAll('#bulkForm [aria-invalid="true"], form [aria-invalid="true"], .field-err, .has-err').length`)) > 0, 'F5 empty enquiry blocked')
  })

  await run('F6-shop-filters-wishlist-xss', async p => {
    await p.goto(O + '/shop', 1000)
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 12, 'F6 12 live pieces', await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`))
    await p.type('#shopSearch', 'hoodie'); await sleep(500)
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 1, 'F6 search hoodie → 1')
    await p.type('#shopSearch', 'zzzzq'); await sleep(500)
    must(await p.eval(`(()=>{const e=document.getElementById('shopEmpty');return e&&!e.hidden&&getComputedStyle(e).display!=='none'})()`), 'F6 empty state')
    await p.type('#shopSearch', ''); await sleep(300)
    await p.clickExpr(`(()=>{const lab=[...document.querySelectorAll('label')].find(l=>/sold|archive/i.test(l.textContent));if(!lab)return null;return lab.querySelector('input[type=checkbox]')||(lab.htmlFor&&document.getElementById(lab.htmlFor))||lab})()`); await sleep(500)
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 16, 'F6 sold toggle → 16', await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`))
    await p.clickExpr(`document.querySelector('#shopGrid [data-card] .wish-btn, #shopGrid [data-card] [data-wish], #shopGrid [data-card] button[aria-label*="ishlist"]')`); await sleep(400)
    must((await p.eval(LS('ka_wish')))?.length === 1, 'F6 wishlist stores 1', await p.eval(LS('ka_wish')))
    await p.goto(O + '/shop?wish=1', 900)
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 1, 'F6 ?wish=1 → 1')
    await p.goto(O + '/shop?collection=kente-codes', 900)
    must(await p.eval(`(()=>{const e=document.getElementById('collectionBanner');return e&&!e.hidden&&getComputedStyle(e).display!=='none'})()`), 'F6 collection banner')
    await p.goto(O + '/shop#sweatshirts', 1000)
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 4, 'F6 #sweatshirts → 4', await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`))
    for (const u of ['/shop?collection=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E', '/product?id=%22%3E%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E', '/order?ref=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E']) {
      await p.goto(O + u, 700); must((await p.eval('window.__xss')) === undefined, 'F6 no XSS via ' + u.split('?')[0])
    }
    await p.goto(O + '/product?id=nope', 900)
    must(!/ANKARA DIAGONAL/.test(await p.eval('document.body.innerText')), 'F6 unknown id ≠ product #001')
    await p.goto(O + '/product?id=c11', 900)
    must(/sold/i.test(await p.eval('document.body.innerText')), 'F6 sold piece shows Sold')
  })

  await run('F7-forms', async p => {
    await p.goto(O + '/', 1000)
    must((await p.eval(`document.querySelectorAll('.prod-grid .prod-card, .prod-grid [data-card]').length`)) >= 4, 'F7 home shows product cards')
    must((await p.eval(`[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')||'').some(h=>['/studio','/lab','/bulk','/gift','/makers'].includes(h)||h.indexOf('/shop?collection=')===0)`)), 'F7 home CTAs link to real routes')
    // newsletter band = the last email form on the page
    const emailFill = await p.eval(`(()=>{const list=[...document.querySelectorAll('input[type=email]')];const i=list[list.length-1];if(!i)return 'NO';const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(i,'ama@example.com');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));window.__nlFormHasBtn=!!(i.closest('form')&&i.closest('form').querySelector('button'));return 'ok'})()`)
    must(emailFill === 'ok', 'F7 newsletter email field present')
    await p.clickExpr(`(()=>{const list=[...document.querySelectorAll('input[type=email]')];const i=list[list.length-1];const f=i&&i.closest('form');return f&&(f.querySelector('button[type=submit]')||f.querySelector('button'))})()`); await sleep(1000)
    const subs = await p.eval(LS('ka_submissions'))
    must(subs?.length >= 1 && /(newsletter|notify)/.test(JSON.stringify(subs)), 'F7 newsletter/notify recorded', subs?.length)
    await p.goto(O + '/contact', 900)
    await p.type('#ctName', 'Ama'); await p.type('#ctEmail', 'ama@example.com'); await p.type('#ctMessage', 'Do you ship to Accra?')
    await p.eval(`(()=>{const t=document.getElementById('ctTopic');if(t&&!t.value){t.selectedIndex=1;t.dispatchEvent(new Event('change',{bubbles:true}))}})()`)
    await p.clickExpr(byText('send') + ` || ${byText('submit')}`); await sleep(1000)
    must((await p.eval(LS('ka_submissions')))?.some(s => /contact/.test(JSON.stringify(s))), 'F7 contact recorded')
  })

  await run('F8-mobile-nav-theme', async p => {
    await p.goto(O + '/', 900)
    await p.clickExpr(`document.querySelector('.nav-burger')`); await sleep(400)
    const links = await p.eval(`[...document.querySelectorAll('.mobile-menu a')].map(a=>a.getAttribute('href'))`)
    for (const d of ['/shop', '/studio', '/lab', '/bulk', '/gift', '/lookbook', '/makers', '/sizing', '/about', '/contact']) must(links.some(h => (h || '') === d || (h || '').startsWith(d + '?') || (h || '').startsWith(d + '#')), 'F8 mobile menu reaches ' + d, links)
    await p.clickExpr(`document.querySelector('.nav-burger')`); await sleep(200)
    await p.clickExpr(`document.querySelector('.theme-toggle')`); await sleep(300)
    must((await p.eval(`document.documentElement.getAttribute('data-theme')`)) === 'light', 'F8 toggles to light')
    await p.goto(O + '/lookbook', 900)
    must((await p.eval(`document.documentElement.getAttribute('data-theme')`)) === 'light', 'F8 theme persists across pages')
    must((await p.eval(`document.querySelectorAll('[id^="look-"]').length`)) >= 8, 'F8 lookbook 8 looks')
    await p.goto(O + '/makers', 900)
    for (const m of ['efua-mensah', 'kwame-asante', 'zuri-olayinka']) must(await p.eval(`!!document.getElementById('${m}')`), 'F8 makers #' + m)
  }, { width: 375, height: 812, mobile: true, theme: null })
} finally { await b.close() }

console.log(passes.map(x => '✓ ' + x).join('\n'))
console.log('\n' + fails.map(x => '✗ ' + x).join('\n'))
console.log(`\nFLOWS ${passes.length} passed, ${fails.length} failed → ${fails.length ? 'FAIL' : 'PASS'}`)
