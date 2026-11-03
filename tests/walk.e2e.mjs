// Playwright check of the volume walk on the exercise page. Serve the repo root statically first:
//   python3 -m http.server 8092 & node tests/walk.e2e.mjs
// walk.js and ai-menu.js come from a local AppOfApp-GH checkout (the cloud cannot reach vercel.app).
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'fs'
const BASE = process.env.BASE || 'http://localhost:8092'
const AOA = process.env.AOA || '../AppOfApp-GH/public'
const SHOTS = process.env.SHOTS || 'tests/shots'
mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++ }
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function open(opts) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.route('https://appofapp-gh.vercel.app/walk.js', (r) => r.fulfill({ contentType: 'text/javascript', body: readFileSync(`${AOA}/walk.js`) }))
  await p.route('https://anat1969.github.io/AppOfApp-GH/walk.js', (r) => r.fulfill({ contentType: 'text/javascript', body: readFileSync(`${AOA}/walk.js`) }))
  await p.route('https://appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ contentType: 'text/javascript', body: readFileSync(`${AOA}/ai-menu.js`) }))
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' })
  return { ctx, p, errs }
}
const sw = (p, s) => p.locator('space-walk').locator(s)
{
  const { ctx, p, errs } = await open({ viewport: { width: 1440, height: 900 } })
  await p.waitForFunction(() => document.querySelector('space-walk')?.shadowRoot?.querySelector('.msg')?.hidden, null, { timeout: 30000 })
  ok((await sw(p, '.title').innerText()).includes('דוגמה'), 'empty form shows the example volume')
  ok((await sw(p, '.insight').innerText()).includes('8 קומות'), 'example insight: ' + await sw(p, '.insight').innerText())
  await p.fill('#plotArea', '800'); await p.fill('#coveragePercent', '50'); await p.fill('#buildingPercent', '200'); await p.fill('#floors', '2')
  await p.waitForTimeout(300)
  ok((await sw(p, '.insight').innerText()).includes('2 קומות'), 'typed values drive the volume: ' + await sw(p, '.insight').innerText())
  ok((await sw(p, '.vnote').innerText()).includes('חורגת'), '2 floors of 200% exceed 50% coverage: ' + await sw(p, '.vnote').innerText())
  ok((await sw(p, '.checks').innerText()).includes('לא תואם'), 'coverage check is red')
  await p.locator('#walk').scrollIntoViewIfNeeded(); await p.waitForTimeout(800)
  await p.locator('#walk').screenshot({ path: `${SHOTS}/targil-requested.png` })
  await sw(p, '[data-variant="full"]').click()
  ok((await sw(p, '.insight').innerText()).includes('4 קומות'), 'full coverage: 1600 / 400 = 4 floors: ' + await sw(p, '.insight').innerText())
  await sw(p, '[data-view="top"]').click(); await p.waitForTimeout(800)
  await p.locator('#walk').screenshot({ path: `${SHOTS}/targil-full-top.png` })
  await p.fill('#floors', '5'); await p.waitForTimeout(300)
  ok(await sw(p, '[data-view="top"]').getAttribute('aria-pressed') === 'true', 'a live update keeps the view the viewer chose')
  const varied = await p.evaluate(() => { const c = document.querySelector('space-walk').shadowRoot.querySelector('.gl'); const t = document.createElement('canvas'); t.width = t.height = 48; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data; const s = new Set(); for (let i = 0; i < d.length; i += 4) s.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); return s.size })
  ok(varied > 12, 'WebGL scene drawn (' + varied + ')')
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '))
  await ctx.close()
}
{
  const { ctx, p, errs } = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await p.waitForTimeout(2500)
  const sx = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ok(sx <= 0, 'mobile: no horizontal scroll (' + sx + ')')
  await p.screenshot({ path: `${SHOTS}/targil-mobile.png`, fullPage: true })
  ok(errs.length === 0, 'mobile: no page errors ' + errs.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0)
