// Playwright check of both pages. Serve the repo root statically first:
//   python3 -m http.server 8092 & node tests/app.e2e.mjs
// The cloud cannot reach vercel.app, github.io, jsdelivr or cdnjs, so shared files are served from local copies:
//   AOA   = folder with walk.js and ai-menu.js (an AppOfApp-GH/public checkout, or raw.githubusercontent downloads)
//   THREE = three@0.160.0 build/three.module.min.js     PDFJS = pdfjs-dist@4.4.168 build folder
import { chromium } from 'playwright'
import { readFileSync, existsSync, mkdirSync } from 'fs'
const BASE = process.env.BASE || 'http://localhost:8092'
const AOA = process.env.AOA || '../AppOfApp-GH/public'
const THREE = process.env.THREE || ''
const PDFJS = process.env.PDFJS || ''
const SHOTS = process.env.SHOTS || 'tests/shots'
mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++ }
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const js = (f) => (r) => existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: readFileSync(f) }) : r.abort()

async function open(path, opts) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.route(/\/walk\.js$/, js(`${AOA}/walk.js`))
  await p.route(/\/ai-menu\.js$/, js(`${AOA}/ai-menu.js`))
  if (THREE) await p.route(/three\.module\.min\.js$/, js(THREE))
  if (PDFJS) { await p.route(/pdf\.min\.mjs$/, js(`${PDFJS}/pdf.min.mjs`)); await p.route(/pdf\.worker\.min\.mjs$/, js(`${PDFJS}/pdf.worker.min.mjs`)) }
  await p.goto(BASE + path, { waitUntil: 'networkidle' })
  return { ctx, p, errs }
}
const sw = (p, s) => p.locator('space-walk').locator(s)
const txt = (p, s) => p.locator(s).innerText()

// ---- the volume page: the logic ----
{
  const { ctx, p, errs } = await open('/index.html', { viewport: { width: 1440, height: 900 } })
  ok((await txt(p, '#result')).includes('80%'), 'example result: ' + await txt(p, '#result'))
  ok(!(await p.locator('#exampleTag').isHidden()), 'empty form is marked as an example')
  ok(!(await p.locator('#usebar').getAttribute('class')).includes('over'), 'example (8 floors of 200 within 400) is NOT flagged as overflow')
  ok((await txt(p, '#ledger')).includes('200'), 'ground floor 1,600 / 8 = 200')
  ok(await p.locator('#streetSvg .alt').count() === 12, 'twelve alternatives in the street section')
  ok(await p.locator('#streetSvg .alt.sel').getAttribute('data-k') === '8', 'the chosen 8 floors are selected in the street')
  await p.fill('#plotArea', '800'); await p.fill('#coveragePercent', '50'); await p.fill('#buildingPercent', '200'); await p.fill('#floors', '2')
  await p.waitForTimeout(200)
  ok((await txt(p, '#result')).includes('לפחות 4'), '2 floors of 200% over 50% coverage need at least 4: ' + await txt(p, '#result'))
  ok((await p.locator('#usebar').getAttribute('class')).includes('over'), 'overflow bar is red')
  ok((await txt(p, '#psi')).includes('חורג'), 'partner names the problem')
  ok(new URL(p.url()).searchParams.get('r') === '200', 'inputs are kept in the address: ' + p.url())
  await p.locator('#streetSvg .alt[data-k="5"]').click()
  ok(await p.inputValue('#floors') === '5', 'a click on an alternative sets the floors')
  await p.locator('[data-shape="podium"]').click()
  ok(new URL(p.url()).searchParams.get('t') === 'podium', 'the shape is kept in the address')
  ok((await txt(p, '#result')).includes('פודיום'), 'result speaks of the podium: ' + await txt(p, '#result'))
  await p.fill('#setback', '8'); await p.waitForTimeout(150)
  ok((await txt(p, '#ledger')).includes('קו הבניין מגביל'), 'an 8 m building line limits a 28 m plot: (28-16)^2 = 144 < 400')
  await p.fill('#setback', '')
  await p.locator('[data-tab="claude"]').click()
  ok((await txt(p, '#claudePrompt')).includes('פודיום ב-5 קומות'), 'the Claude question carries the shape and numbers')
  ok((await p.locator('#mjPrompt').textContent()).includes('--no text, words, writing, frame divisions'), 'the image prompt follows the house format')
  ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'desktop: no horizontal scroll')
  ok(await p.evaluate(() => document.documentElement.scrollHeight - innerHeight) <= 2, 'desktop: the page fits the screen')
  await p.screenshot({ path: `${SHOTS}/volume-1440.png` })
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '))
  await ctx.close()
}

// ---- the volume page: the 3D model ----
if (existsSync(`${AOA}/walk.js`)) {
  const { ctx, p, errs } = await open('/index.html', { viewport: { width: 1440, height: 900 } })
  await p.waitForFunction(() => document.querySelector('space-walk')?.shadowRoot?.querySelector('style[data-skin]'), null, { timeout: 30000 }).catch(() => {})
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('space-walk').shadowRoot.querySelector('.panel')).display === 'none'), 'bare: the shared panel is hidden, one set of controls')
  ok(await p.evaluate(() => { const r = document.querySelector('space-walk').shadowRoot; return Math.abs(r.querySelector('.stage').getBoundingClientRect().width - document.querySelector('space-walk').getBoundingClientRect().width) < 2 }), 'bare: the scene fills the whole stage')
  ok((await sw(p, '.title').textContent()).includes('דוגמה'), 'empty form shows the example volume')
  await p.locator('[data-shape="terrace"]').click(); await p.waitForTimeout(200)
  ok(await sw(p, '[data-variant="terrace"]').getAttribute('aria-pressed') === 'true', 'the shape button switches the 3D variant')
  await p.locator('.stagebar [data-eye="95"]').click(); await p.waitForTimeout(200)
  ok(await p.evaluate(() => document.querySelector('space-walk')._eyeCm) === 95, 'the eye button sets the eye height through the attribute')
  await p.locator('.stagebar [data-view="top"]').click(); await p.waitForTimeout(500)
  ok(await p.locator('.stagebar [data-view="top"]').getAttribute('aria-pressed') === 'true', 'view button follows the component')
  await p.fill('#floors', '5'); await p.waitForTimeout(300)
  ok(await sw(p, '[data-view="top"]').getAttribute('aria-pressed') === 'true', 'a live update keeps the view the viewer chose')
  ok(await sw(p, '[data-variant="terrace"]').getAttribute('aria-pressed') === 'true', 'a live update keeps the shape')
  if (THREE) {
    await p.locator('.stagebar [data-view="walk"]').click(); await p.waitForTimeout(800)
    const varied = await p.evaluate(() => { const c = document.querySelector('space-walk').shadowRoot.querySelector('.gl'); const t = document.createElement('canvas'); t.width = t.height = 48; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data; const s = new Set(); for (let i = 0; i < d.length; i += 4) s.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); return s.size })
    ok(varied > 12, 'WebGL scene drawn (' + varied + ')')
    await p.locator('.stagewrap > .stage').screenshot({ path: `${SHOTS}/volume-3d.png` })
  }
  ok(errs.length === 0, '3D: no page errors ' + errs.join(' | '))
  await ctx.close()
}

// ---- table 5: selection drives every view ----
{
  const { ctx, p, errs } = await open('/taba.html', { viewport: { width: 1440, height: 900 } })
  const rowsShown = () => p.locator('#resultsContainer tbody tr').count()
  ok(await p.locator('.empty').isVisible(), 'table 5: empty state explains the three steps')
  await p.locator('#loadExample2').click(); await p.waitForTimeout(200)
  ok(await p.locator('#mapSvg .tile').count() === 15, 'example: fifteen plots as tiles')
  ok((await txt(p, '#insight')).includes('הציבור מקבל'), 'lens tells what the public gets: ' + await txt(p, '#insight'))
  await p.locator('.pick [data-tok="o:public"]').click(); await p.waitForTimeout(150)
  ok(await rowsShown() === 8, 'public lens: 8 rows')
  ok(await p.locator('#mapSvg .tile.dim').count() === 7, 'the other 7 tiles stay, dimmed')
  await p.locator('.pick [data-tok="edu"]').click(); await p.waitForTimeout(150)
  ok(await rowsShown() === 2, 'education lens: school and kindergartens')
  await p.locator('#legend .it[data-tok="g:res"]').click(); await p.waitForTimeout(150)
  ok(await rowsShown() === 5, 'legend item isolates housing: 5 rows')
  await p.locator('#legend .add[data-tok="g:com"]').click(); await p.waitForTimeout(150)
  ok(await rowsShown() === 6, '+ adds commerce: 6 rows')
  await p.locator('#mapSvg .tile[data-tok="p:401"]').click({ modifiers: ['Shift'] }); await p.waitForTimeout(150)
  ok(await rowsShown() === 7, 'Shift on a tile adds plot 401')
  await p.fill('#plotNumber', '101, 104'); await p.waitForTimeout(150)
  ok(await rowsShown() === 2, 'typed plots select exactly them')
  await p.locator('#shares [data-tok="g:open"]').first().click(); await p.waitForTimeout(150)
  ok(await rowsShown() === 3, 'a bar segment isolates open space')
  await p.locator('.pick [data-tok=""]').click(); await p.waitForTimeout(150)
  ok(await rowsShown() === 15, '"all" returns the whole table')
  ok(await p.evaluate(() => document.documentElement.scrollHeight - innerHeight) <= 2, 'table 5: the page fits the screen')
  await p.screenshot({ path: `${SHOTS}/taba-1440.png` })
  ok(errs.length === 0, 'table 5 selection: no page errors ' + errs.join(' | '))
  await ctx.close()
}

// ---- table 5: a saved row goes to the volume page ----
{
  const { ctx, p, errs } = await open('/taba.html', { viewport: { width: 1440, height: 900 } })
    await p.evaluate(() => new Promise((res, rej) => {
    const rq = indexedDB.open('Table5ExtractorDB', 1)
    rq.onupgradeneeded = () => rq.result.createObjectStore('extracted_data')
    rq.onsuccess = () => { const tx = rq.result.transaction(['extracted_data'], 'readwrite'); tx.objectStore('extracted_data').put({
      rows: [['מגורים ד', 'מגורים', '101', '', '1,200', '1,920(1)', '480', '', '1,200', '3,600', '200', '40', '', '24', '30', '9', '2']],
      footnotes: [{ num: '1', text: 'כולל מרפסות' }], programInfo: { planNumber: '101-0000001', planTitle: 'בדיקה' }, pdfName: 'test.pdf' }, 'table5_data'); tx.oncomplete = res; tx.onerror = rej }
    rq.onerror = rej
  }))
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500)
  const href = await p.locator('.to-volume').first().getAttribute('href').catch(() => null)
  ok(href === 'index.html?a=1200&c=40&r=160&n=9', 'row → volume link uses main rights 1,920 / 1,200 = 160%: ' + href)
  ok(await p.locator('.empty').isHidden(), 'the empty state gives way to the table')
  await p.screenshot({ path: `${SHOTS}/taba-1440.png` })
  if (href) {
    await p.locator('.to-volume').first().click(); await p.waitForLoadState('networkidle')
    ok(await p.inputValue('#plotArea') === '1200' && await p.inputValue('#floors') === '9', 'the volume page opens with the row values')
  }
  ok(errs.length === 0, 'table 5: no page errors ' + errs.join(' | '))
  await ctx.close()
}

// ---- phone ----
for (const path of ['/index.html', '/taba.html']) {
  const { ctx, p, errs } = await open(path, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await p.waitForTimeout(1200)
  const sx = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ok(sx <= 0, 'mobile ' + path + ': no horizontal scroll (' + sx + ')')
  await p.screenshot({ path: `${SHOTS}/mobile${path.replace('.html', '').replace('/', '-')}.png`, fullPage: true })
  ok(errs.length === 0, 'mobile ' + path + ': no page errors ' + errs.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0)
