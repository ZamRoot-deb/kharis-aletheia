// Minimal zero-dependency CDP driver: headless Chrome on file:// pages (no local server).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export async function launch({ port = 9333, profile }) {
  mkdirSync(profile, { recursive: true })
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' })
  let ver
  for (let i = 0; i < 60; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break } catch { await sleep(250) }
  }
  if (!ver) { proc.kill(); throw new Error('chrome did not start') }
  const ws = new WebSocket(ver.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  const listeners = new Set()
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id)
      m.error ? rej(new Error(m.error.message)) : res(m.result)
    } else if (m.method) listeners.forEach(fn => fn(m))
  }
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej })
    ws.send(JSON.stringify({ id: i, method, params, sessionId }))
  })
  return {
    send, on: fn => listeners.add(fn), off: fn => listeners.delete(fn),
    async close() { try { await send('Browser.close') } catch {} proc.kill() },
  }
}

export async function openPage(b, { width = 1440, height = 900, mobile = false, theme = 'dark' } = {}) {
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true })
  const s = (m, p) => b.send(m, p, sessionId)
  const errors = []
  const onEvt = m => {
    if (m.sessionId !== sessionId) return
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      errors.push(`EXCEPTION ${d.exception?.description || d.text} @${(d.url || '').split('/').pop()}:${d.lineNumber}`)
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300))
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(`LOG ${m.params.entry.text} ${(m.params.entry.url || '').split('/').slice(-2).join('/')}`)
    } else if (m.method === 'Network.loadingFailed' && !m.params.canceled) {
      errors.push(`NETFAIL ${m.params.errorText} ${reqs.get(m.params.requestId) || ''}`)
    } else if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, m.params.request.url.split('/').slice(-2).join('/'))
  }
  const reqs = new Map()
  b.on(onEvt)
  await s('Page.enable'); await s('Runtime.enable'); await s('Log.enable'); await s('Network.enable')
  await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile })
  if (mobile) await s('Emulation.setTouchEmulationEnabled', { enabled: true })
  if (theme) await s('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('ka_theme','${theme}')}catch(e){}` })
  const page = {
    s, errors, sessionId,
    async goto(url, settle = 700) {
      const loaded = new Promise(res => {
        const fn = m => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { b.off(fn); res() } }
        b.on(fn)
      })
      await s('Page.navigate', { url })
      await Promise.race([loaded, sleep(15000)])
      await sleep(settle)
    },
    async eval(expr) {
      const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true })
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
      return r.result.value
    },
    async shot(file, full = false) {
      const r = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full })
      writeFileSync(file, Buffer.from(r.data, 'base64'))
    },
    async click(sel) {
      // real mouse input (grants genuine user activation); falls back to label / el.click() for visually-hidden controls
      const r = await page.eval(`(()=>{let e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});let b=e.getBoundingClientRect();if((b.width<4||b.height<4)&&e.id){const l=document.querySelector('label[for="'+e.id+'"]');if(l){b=l.getBoundingClientRect()}}const x=b.left+b.width/2,y=b.top+b.height/2;const hit=document.elementFromPoint(x,y);const ok=b.width>=4&&b.height>=4&&hit&&(hit===e||e.contains(hit)||hit.contains(e)||(e.id&&hit.closest('label[for="'+e.id+'"]')));if(!ok){e.click();return {fallback:true}}return {x,y}})()`)
      if (!r) return 'MISSING'
      if (r.fallback) return 'ok'
      // layout may still be shifting (lazy images / reveal) — wait until the target's position is stable
      for (let i = 0; i < 8; i++) {
        await sleep(90)
        const n = await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;let b=e.getBoundingClientRect();if((b.width<4||b.height<4)&&e.id){const l=document.querySelector('label[for="'+e.id+'"]');if(l)b=l.getBoundingClientRect()}return {x:b.left+b.width/2,y:b.top+b.height/2}})()`)
        if (!n) return 'MISSING'
        const moved = Math.abs(n.x - r.x) + Math.abs(n.y - r.y); r.x = n.x; r.y = n.y
        if (moved < 1) break
      }
      // final guard: the point must still hit the target right before we click (page may have scrolled)
      for (let i = 0; i < 4; i++) {
        const hit = await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});const h=document.elementFromPoint(${r.x},${r.y});if(h&&(h===e||e.contains(h)||h.contains(e)||(e.id&&h.closest('label[for="'+e.id+'"]'))))return null;e.scrollIntoView({block:'center',behavior:'instant'});let b=e.getBoundingClientRect();if((b.width<4||b.height<4)&&e.id){const l=document.querySelector('label[for="'+e.id+'"]');if(l)b=l.getBoundingClientRect()}return {x:b.left+b.width/2,y:b.top+b.height/2}})()`)
        if (!hit) break
        r.x = hit.x; r.y = hit.y; await sleep(150)
      }
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y })
      await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 })
      await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
      return 'ok'
    },
    async type(sel, val) {
      return page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'MISSING';const d=Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value');d.set.call(e,${JSON.stringify(val)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.dispatchEvent(new Event('blur',{bubbles:true}));return 'ok'})()`)
    },
    async close() { b.off(onEvt); await b.send('Target.closeTarget', { targetId }) },
  }
  return page
}
export { sleep }
