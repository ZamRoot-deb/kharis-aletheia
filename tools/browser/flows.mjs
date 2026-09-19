// End-to-end user flows on file:// in headless Chrome (no server). Hostile-tester assertions.
import { launch, openPage, sleep } from './cdp.mjs'
import { mkdirSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url).href
const OUT = new URL('../../.shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const fails = [], passes = []
const must = (ok, msg, extra) => { (ok ? passes : fails).push(msg + (ok || extra === undefined ? '' : ` → got ${JSON.stringify(extra)}`)) }
const LS = k => `JSON.parse(localStorage.getItem('${k}')||'null')`
const txt = sel => `(document.querySelector(${JSON.stringify(sel)})||{}).textContent`

const b = await launch({ port: 9334, profile: new URL('../../.shots/chrome-prof-flows-' + process.pid, import.meta.url).pathname })
const only = process.argv[2]
const run = async (name, fn, view) => {
  if (only && !name.startsWith(only)) return
  const page = await openPage(b, view || {})
  await page.goto(ROOT + 'about.html', 200); await page.eval(`localStorage.clear();sessionStorage.clear()`)
  try { await fn(page) } catch (e) { fails.push(`${name}: THREW ${e.message}`) }
  if (page.errors.length) fails.push(`${name}: console/runtime errors → ${[...new Set(page.errors)].slice(0, 6).join(' | ')}`)
  await page.shot(`${OUT}flow-${name}.png`)
  await page.close()
}

try {
  await run('F1-product-cart-checkout-order', async p => {
    await p.goto(ROOT + 'product.html?id=t01')
    must((await p.eval(txt('h1')) || '').includes('ANKARA DIAGONAL'), 'F1 product h1 shows product name', await p.eval(txt('h1')))
    const sizeSel = await p.eval(`(()=>{const r=document.querySelector('input[name="pdSize"][value="L"]');if(!r)return 'NO-L';r.click();return document.querySelector('input[name="pdSize"]:checked').value})()`)
    must(sizeSel === 'L', 'F1 size L selectable', sizeSel)
    await p.click('#qtyInc'); await p.click('#pdAdd'); await sleep(400)
    const cart = await p.eval(LS('ka_cart'))
    must(cart?.length === 1 && cart[0].id === 't01' && cart[0].size === 'L' && cart[0].qty === 2, 'F1 cart holds t01/L/x2', cart)
    must(await p.eval(`document.querySelector('.cart-drawer').classList.contains('open')`), 'F1 drawer opens on add')
    must((await p.eval(txt('.cart-count'))) === '2', 'F1 nav badge = 2', await p.eval(txt('.cart-count')))
    // Esc closes the drawer
    await p.s('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300)
    must(!(await p.eval(`document.querySelector('.cart-drawer').classList.contains('open')`)), 'F1 Esc closes drawer')

    await p.goto(ROOT + 'checkout.html')
    must(!!(await p.eval(`!!document.getElementById('checkoutForm')`)), 'F1 checkout form renders')
    must(/76/.test(await p.eval(txt('#coSubtotal')) || ''), 'F1 subtotal £76', await p.eval(txt('#coSubtotal')))
    // empty submit must be blocked with errors
    await p.click('#coSubmit'); await sleep(400)
    must((await p.eval(`location.pathname.endsWith('checkout.html')`)), 'F1 empty submit stays on checkout')
    must((await p.eval(`document.querySelectorAll('[aria-invalid="true"]').length`)) >= 4, 'F1 empty submit flags invalid fields', await p.eval(`document.querySelectorAll('[aria-invalid="true"]').length`))
    must(!(await p.eval(LS('ka_orders')))?.length, 'F1 no order stored on invalid submit')
    await p.type('#coEmail', 'ama@example.com'); await p.type('#coName', 'Ama Owusu'); await p.type('#coAddr1', '10 Downing St')
    await p.type('#coCity', 'London'); await p.type('#coPostcode', 'SW1A 2AA'); await p.type('#coCountry', 'GB'); await sleep(300)
    must(/free|£0|0\.00/i.test(await p.eval(txt('#coShipping')) || ''), 'F1 UK £76 ships free', await p.eval(txt('#coShipping')))
    await p.type('#coPromoCode', ' welcome10 '); await p.click('#coPromoBtn'); await sleep(400)
    must(/7\.60/.test(await p.eval(txt('#coDiscount')) || ''), 'F1 promo discount £7.60', await p.eval(txt('#coDiscount')))
    must(/4\.95/.test(await p.eval(txt('#coShipping')) || ''), 'F1 post-discount £68.40 no longer free → £4.95', await p.eval(txt('#coShipping')))
    must(/73\.35/.test(await p.eval(txt('#coTotal')) || ''), 'F1 total £73.35', await p.eval(txt('#coTotal')))
    await p.type('#coCountry', 'GH'); await sleep(400)
    must(/18\.95/.test(await p.eval(txt('#coShipping')) || ''), 'F1 Ghana → AFRICA zone £18.95', await p.eval(txt('#coShipping')))
    await p.type('#coCountry', 'GB'); await sleep(300)
    await p.eval(`(()=>{const a=document.getElementById('coAck');if(!a.checked)a.click()})()`)
    await p.shot(`${OUT}flow-F1-checkout-filled.png`, true)
    await p.click('#coSubmit'); await sleep(2500)
    const href = await p.eval('location.href')
    must(/order\.html\?ref=KA-[A-Z0-9]{6}/.test(href), 'F1 lands on order.html?ref=KA-XXXXXX', href)
    const orders = await p.eval(LS('ka_orders'))
    must(orders?.length === 1 && Math.abs(orders[0].totals.total - 73.35) < 0.001, 'F1 order stored with total 73.35', orders?.[0]?.totals)
    must((await p.eval(LS('ka_cart')))?.length === 0 || (await p.eval(LS('ka_cart'))) === null, 'F1 cart cleared after order')
    must((await p.eval(`document.body.innerText`)).includes(orders?.[0]?.ref || '###'), 'F1 confirmation shows the ref')
    must(/ANKARA DIAGONAL/i.test(await p.eval(`document.body.innerText`)), 'F1 confirmation lists the item')
  })

  await run('F2-studio-to-cart', async p => {
    await p.goto(ROOT + 'studio.html', 1200)
    must((await p.eval(`document.querySelectorAll('#stageMount svg pattern').length`)) >= 1, 'F2 stage svg has a <pattern>')
    must((await p.eval(`document.querySelectorAll('#printGrid [data-print]').length`)) >= 12, 'F2 >=12 prints offered', await p.eval(`document.querySelectorAll('#printGrid [data-print]').length`))
    for (const s of ['[data-garment="hoodie"]', '[data-colour="burgundy"]', '[data-placement="allover"]', 'input[name="studioSize"][value="L"]']) must((await p.click(s)) === 'ok', 'F2 click ' + s)
    await p.type('#ftScale', '1.5'); await p.type('#ftRotate', '45'); await sleep(400)
    must(/74/.test(await p.eval(txt('#priceBreakdown')) || ''), 'F2 hoodie 66 + all-over 8 = £74', (await p.eval(txt('#priceBreakdown')) || '').slice(0, 120))
    await p.shot(`${OUT}flow-F2-studio.png`, false)
    const hash = await p.eval('location.hash')
    must(/hoodie/.test(decodeURIComponent(hash)), 'F2 design mirrored in URL hash', hash.slice(0, 120))
    await p.click('#btnAddToCart'); await sleep(600)
    const c = (await p.eval(LS('ka_cart')))?.[0]
    must(c?.kind === 'custom' && c.price === 74 && c.size === 'L' && c.garment === 'hoodie', 'F2 custom item in cart (hoodie/L/£74)', c && { kind: c.kind, price: c.price, size: c.size, garment: c.garment })
    must(/^data:image\/svg\+xml/.test(c?.thumb || ''), 'F2 thumb is an svg data-uri', (c?.thumb || '').slice(0, 40))
    must((c?.thumb || '').length < 40000, 'F2 thumb < 40KB', (c?.thumb || '').length)
    must(await p.eval(`!!document.querySelector('.cart-drawer.open .cart-item img')`), 'F2 drawer renders custom item with thumb')
    // reload restores the design
    await p.goto(ROOT + 'studio.html', 1000)
    must((await p.eval(`(document.querySelector('[data-garment="hoodie"]')||{}).getAttribute?.('aria-pressed')||document.querySelector('[data-garment="hoodie"]').className`) + '').match(/true|on|active|selected/) !== null, 'F2 design restored after reload')
    // hostile hash must not execute or crash
    await p.goto(ROOT + 'studio.html#print=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E&garment=%22%3E%3Csvg%20onload%3Dwindow.__xss%3D1%3E', 1000)
    must((await p.eval('window.__xss')) === undefined, 'F2 hostile hash does not execute')
    must((await p.eval(`document.querySelectorAll('#stageMount svg').length`)) >= 1, 'F2 hostile hash still renders a stage')
    await p.goto(ROOT + 'checkout.html')
    must(/74/.test(await p.eval(txt('#coSubtotal')) || ''), 'F2 checkout prices the custom piece £74', await p.eval(txt('#coSubtotal')))
  })

  await run('F3-lab-to-studio', async p => {
    await p.goto(ROOT + 'lab.html', 1200)
    const bg0 = await p.eval(`getComputedStyle(document.getElementById('labPreview')).backgroundImage.length`)
    must(bg0 > 50, 'F3 lab preview has a tiled background', bg0)
    await p.click('#labRandomize'); await sleep(600)
    const bg1 = await p.eval(`getComputedStyle(document.getElementById('labPreview')).backgroundImage`)
    await p.click('#labUndo'); await sleep(600)
    const bg2 = await p.eval(`getComputedStyle(document.getElementById('labPreview')).backgroundImage`)
    must(bg1 !== bg2, 'F3 undo changes the preview back')
    await p.click('#labRedo'); await sleep(600)
    must((await p.eval(`getComputedStyle(document.getElementById('labPreview')).backgroundImage`)) === bg1, 'F3 redo restores the randomized print')
    await p.type('#labName', 'Harmattan <b>Test</b>'); await p.click('#labSave'); await sleep(500)
    const saved = await p.eval(LS('ka_prints'))
    const list = Array.isArray(saved) ? saved : Object.values(saved || {})
    must(list.length === 1, 'F3 print saved to ka_prints', saved && list.length)
    must((await p.eval(`document.querySelectorAll('#labShelf b').length`)) === 0, 'F3 saved name is escaped on the shelf (no injected <b>)')
    await p.click('#labSendStudio'); await sleep(1800)
    const href = await p.eval('location.href')
    must(/studio\.html/.test(href), 'F3 navigates to studio.html', href.slice(0, 120))
    const id = list[0] && list[0].id
    const st = await p.eval(LS('ka_studio'))
    must(/^c_/.test(id || '') && st && JSON.stringify(st).includes(id), 'F3 studio adopted the lab print ' + id, st && (st.printId || st.design?.printId))
    must(decodeURIComponent(href).includes(id), 'F3 share hash carries the custom print id')
    must((await p.eval(`document.querySelectorAll('#stageMount svg pattern').length`)) >= 1, 'F3 studio renders the custom print')
  })

  await run('F4-gift-card', async p => {
    await p.goto(ROOT + 'gift.html')
    await p.click('#gfAdd'); await sleep(300)
    must(!(await p.eval(LS('ka_cart')))?.length, 'F4 empty gift form is rejected')
    must((await p.click('.amount-btn[data-amt="50"]')) === 'ok', 'F4 £50 amount button exists')
    await p.type('#gfTo', 'Kofi'); await p.type('#gfToEmail', 'kofi@example.com'); await p.type('#gfFrom', 'Ama'); await p.type('#gfMessage', 'Grace & truth <3')
    await p.click('#gfAdd'); await sleep(500)
    const g = (await p.eval(LS('ka_cart')))?.[0]
    must(g?.kind === 'gift' && g.amount === 50 && g.email === 'kofi@example.com', 'F4 gift item in cart', g)
    await p.goto(ROOT + 'checkout.html')
    must(await p.eval(`(()=>{const d=document.getElementById('coDeliverySection');return !d||d.hidden||getComputedStyle(d).display==='none'})()`), 'F4 gift-only cart hides delivery address')
    await p.type('#coPromoCode', 'WELCOME10'); await p.click('#coPromoBtn'); await sleep(400)
    must(/50/.test(await p.eval(txt('#coTotal')) || '') && !/45/.test(await p.eval(txt('#coTotal')) || ''), 'F4 promo never discounts a gift card (total stays £50)', await p.eval(txt('#coTotal')))
  })

  await run('F5-bulk-quote', async p => {
    await p.goto(ROOT + 'bulk.html')
    await p.type('#bkQtyInput', '25'); await sleep(300)
    const unit = await p.eval(txt('#bkUnit')), total = await p.eval(txt('#bkTotal'))
    must(/32\.30/.test(unit || ''), 'F5 25 tees → 15% off £38 = £32.30 unit', unit)
    must(/807\.50/.test(total || ''), 'F5 total £807.50', total)
    await p.type('#bkQtyInput', '9'); await sleep(300)
    must(Number((await p.eval(`document.getElementById('bkQtyInput').value`))) >= 10 || /minimum|10/i.test(await p.eval(`document.body.innerText`)), 'F5 below-minimum quantity handled')
    await p.click('#bkSubmit'); await sleep(400)
    must((await p.eval(`document.querySelectorAll('#bulkForm [aria-invalid="true"], #bulkForm .has-err').length`)) > 0, 'F5 empty enquiry blocked with errors')
  })

  await run('F6-shop-filters-wishlist-xss', async p => {
    await p.goto(ROOT + 'shop.html')
    const all = await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)
    must(all === 12, 'F6 shop shows the 12 live pieces (sold archive hidden)', all)
    await p.type('#shopSearch', 'hoodie'); await sleep(400)
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 1, 'F6 search "hoodie" → 1', await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`))
    await p.type('#shopSearch', 'zzzzqq'); await sleep(400)
    must(await p.eval(`(()=>{const e=document.getElementById('shopEmpty');return e&&!e.hidden&&getComputedStyle(e).display!=='none'})()`), 'F6 empty state shown for no results')
    await p.type('#shopSearch', ''); await sleep(300)
    await p.click('#showSoldToggle'); await sleep(400)
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 16, 'F6 sold archive toggle → 16', await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`))
    await p.click('#shopGrid [data-wish]'); await sleep(300)
    must((await p.eval(LS('ka_wish')))?.length === 1, 'F6 wishlist stores 1')
    must((await p.eval(txt('.wish-count'))) === '1', 'F6 nav wishlist badge = 1', await p.eval(txt('.wish-count')))
    await p.goto(ROOT + 'shop.html?wish=1')
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 1, 'F6 ?wish=1 shows only the wished piece')
    await p.goto(ROOT + 'shop.html?collection=kente-codes')
    must(await p.eval(`(()=>{const e=document.getElementById('collectionBanner');return e&&!e.hidden&&getComputedStyle(e).display!=='none'})()`), 'F6 collection banner visible')
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) >= 1, 'F6 kente-codes has pieces')
    await p.goto(ROOT + 'shop.html#sweatshirts')
    must((await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`)) === 4, 'F6 legacy #sweatshirts hash → 4', await p.eval(`document.querySelectorAll('#shopGrid [data-card]').length`))
    for (const u of ['shop.html?collection=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E', 'shop.html?q=%22%3E%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E', 'product.html?id=%22%3E%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E', 'order.html?ref=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E']) {
      await p.goto(ROOT + u); must((await p.eval('window.__xss')) === undefined, 'F6 no XSS via ' + u.split('?')[0] + ' param')
    }
    await p.goto(ROOT + 'product.html?id=nope')
    must(!/ANKARA DIAGONAL/.test(await p.eval('document.body.innerText')), 'F6 unknown product id does not silently show product #001')
    await p.goto(ROOT + 'product.html?id=c11')
    must(/sold/i.test(await p.eval('document.body.innerText')) && !(await p.eval(`!!document.querySelector('#pdAdd:not([disabled])')`)), 'F6 sold one-of-one cannot be added')
  })

  await run('F7-forms-notify-newsletter-contact', async p => {
    await p.goto(ROOT + 'index.html', 1000)
    must((await p.eval(`document.querySelectorAll('#homeSignatureGrid .prod-card').length`)) === 4, 'F7 home signature grid renders 4 from catalog')
    must((await p.eval(`[...document.querySelectorAll('#studios a')].map(a=>a.getAttribute('href')).filter(h=>h==='shop.html').length`)) === 0, 'F7 no studio card dead-ends at shop.html')
    await p.type('#nlEmail', 'not-an-email'); await p.eval(`document.getElementById('newsletterForm').requestSubmit()`); await sleep(400)
    must(!(await p.eval(LS('ka_submissions')))?.length, 'F7 newsletter rejects bad email')
    await p.type('#nlEmail', 'ama@example.com'); await p.click('#newsletterForm button[type="submit"], #newsletterForm button:not([type])'); await sleep(900)
    const subs = await p.eval(LS('ka_submissions'))
    must(subs?.length === 1 && /newsletter/.test(JSON.stringify(subs[0])), 'F7 newsletter submission recorded', subs)
    must(((await p.eval(txt('#nlStatus'))) || '').trim().length > 0, 'F7 newsletter shows a status message')
    await p.goto(ROOT + 'contact.html')
    await p.type('#ctName', 'Ama'); await p.type('#ctEmail', 'ama@example.com'); await p.type('#ctMessage', 'Do you ship to Accra?')
    await p.eval(`(()=>{const t=document.getElementById('ctTopic');if(t&&!t.value){t.selectedIndex=1;t.dispatchEvent(new Event('change',{bubbles:true}))}})()`)
    await p.click('#ctSubmit'); await sleep(1200)
    must((await p.eval(LS('ka_submissions')))?.length === 2, 'F7 contact submission recorded', (await p.eval(LS('ka_submissions')))?.length)
    must(await p.eval(`(()=>{const e=document.getElementById('ctResult');return e&&!e.hidden&&e.textContent.trim().length>0})()`), 'F7 contact shows a result panel')
  })

  await run('F8-mobile-nav-theme', async p => {
    await p.goto(ROOT + 'index.html', 900)
    await p.click('.nav-burger'); await sleep(400)
    const links = await p.eval(`[...document.querySelectorAll('.mobile-menu a')].map(a=>a.getAttribute('href'))`)
    for (const dest of ['shop.html', 'studio.html', 'lab.html', 'bulk.html', 'gift.html', 'lookbook.html', 'makers.html', 'sizing.html', 'about.html', 'contact.html']) must(links.some(h => (h || '').startsWith(dest)), 'F8 mobile menu reaches ' + dest, links)
    must((await p.eval(`document.querySelector('.nav-burger').getAttribute('aria-expanded')`)) === 'true', 'F8 burger aria-expanded=true')
    await p.shot(`${OUT}flow-F8-mobile-menu.png`)
    await p.click('.nav-burger'); await sleep(200)
    await p.click('.theme-toggle'); await sleep(200)
    must((await p.eval(`document.documentElement.getAttribute('data-theme')`)) === 'light', 'F8 theme toggles to light')
    await p.goto(ROOT + 'lookbook.html', 900)
    must((await p.eval(`document.documentElement.getAttribute('data-theme')`)) === 'light', 'F8 theme persists across pages')
    must((await p.eval(`document.querySelectorAll('[id^="look-"]').length`)) >= 8, 'F8 lookbook has 8 anchorable looks')
    await p.goto(ROOT + 'makers.html', 900)
    for (const m of ['efua-mensah', 'kwame-asante', 'zuri-olayinka']) must(await p.eval(`!!document.getElementById('${m}')`), 'F8 makers anchor #' + m)
  }, { width: 375, height: 812, mobile: true, theme: null })
} finally { await b.close() }

console.log(passes.map(x => '✓ ' + x).join('\n'))
console.log(fails.map(x => '✗ ' + x).join('\n'))
console.log(`\nFLOWS ${passes.length} passed, ${fails.length} failed → ${fails.length ? 'FAIL' : 'PASS'}`)
