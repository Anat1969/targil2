// Reads the plans that "מה נבנה סביבי" (Anat1969/HITCHADSHUT) already extracted from the plan instructions, once,
// and stores them here as table-5 rows plus a reliability check, so the page never recomputes them.
//   git clone --depth 1 https://github.com/Anat1969/HITCHADSHUT ../HITCHADSHUT
//   node tools/import-plans.mjs ../HITCHADSHUT
// Output: plans/index.json (the list) and plans/<slug>.json (rows in the LEAF_COLUMNS order of taba.html, checks, sources).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.argv[2] || '../HITCHADSHUT'
const SEED = join(SRC, 'supabase/seed')
const OUT = 'plans'
const SITE = 'https://nihul-hitchadshut-ashdod.vercel.app'
const NUM_FN = '90'   // footnote for a coverage estimated from the building lines

const read = (f) => JSON.parse(readFileSync(f, 'utf8'))
const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
const fmt = (v) => (v == null ? '' : Math.round(v * 10) / 10 === Math.round(v) ? Math.round(v).toLocaleString('en-US') : (Math.round(v * 10) / 10).toLocaleString('en-US'))
const sum = (...vs) => vs.reduce((s, v) => s + (n(v) || 0), 0)

// the caveats "מה נבנה סביבי" already wrote per plan: the table in its CLAUDE.md (place | plan | page | model | missing)
const caveats = {}
for (const line of readFileSync(join(SRC, 'CLAUDE.md'), 'utf8').split('\n')) {
  const c = line.split('|').map((s) => s.trim())
  if (c.length >= 7 && c[2] && /\d/.test(c[2]) && c[1] !== 'מתחם') caveats[c[2].split(' ')[0]] = { place: c[1], page: c[3], model: c[4], missing: c[5] === '-' ? '' : c[5] }
}

if (!existsSync(OUT)) mkdirSync(OUT)
const index = []
for (const file of readdirSync(SEED).filter((f) => f.endsWith('.table5.json')).sort()) {
  const slug = file.replace('.table5.json', '')
  const t5 = read(join(SEED, file))
  const story = existsSync(join(SEED, slug + '.story.json')) ? read(join(SEED, slug + '.story.json')) : {}
  const geo = (k) => { const f = join(SEED, slug + '.' + k + '.geojson'); return existsSync(f) ? read(f).features.map((x) => x.properties) : [] }
  const lotsGeo = geo('lots'), env = geo('envelopes').filter((p) => p.kind === 'envelope')
  const cav = caveats[t5.plan_number] || caveats[t5.plan_number.split(' ')[0]] || {}

  const checks = []   // { id, title, state: ok | check | fail | na (nothing to compare), detail, lots? }
  const est = /הערכה|סרוק/.test((cav.page || '') + (cav.model || ''))
  const lotFlags = {}
  const flag = (lot, text) => { (lotFlags[lot] = lotFlags[lot] || []).push(text) }
  let estCov = 0

  const rows = t5.lots.map((l) => {
    const mainAbove = sum(l.main_above, l.commercial_main, l.public_in_lot_main, l.public_main, l.employment_main, l.maintenance_building_main)
    const servAbove = sum(l.service_above, l.commercial_service_above, l.public_in_lot_service_above)
    const parts = [l.main_above && (/מגורים/.test(l.use || '') ? 'מגורים ' : 'עיקרי ') + fmt(l.main_above), l.commercial_main && 'מסחר ' + fmt(l.commercial_main), l.commercial_total && 'מסחר סה"כ ' + fmt(l.commercial_total),
      (l.public_in_lot_main || l.public_main) && 'ציבור ' + fmt(sum(l.public_in_lot_main, l.public_main)), l.employment_main && 'תעסוקה ' + fmt(l.employment_main)].filter(Boolean)
    let cov = n(l.coverage_pct), covCell = cov == null ? '' : fmt(cov)
    if (cov == null && n(l.lot_size)) {
      const e = env.filter((p) => String(p.lot) === String(l.lot)).reduce((s, p) => s + p.area_m2, 0)
      if (e > 0) { cov = Math.min(100, e / l.lot_size * 100); covCell = fmt(cov) + '(' + NUM_FN + ')'; estCov++ }
    }
    return [
      l.use || '', parts.length > 1 ? 'עיקרי: ' + parts.join(' · ') : (l.public_in_lot_use || ''), String(l.lot), '',
      fmt(n(l.lot_size)), mainAbove ? fmt(mainAbove) : '', servAbove ? fmt(servAbove) : '', fmt(n(l.main_below)), fmt(n(l.service_below)),
      fmt(n(l.total_area)), fmt(n(l.building_pct)), covCell, fmt(n(l.density_per_dunam)), fmt(n(l.units)),
      fmt(n(l.height_m)), fmt(n(l.floors_above)), fmt(n(l.floors_below)),
    ]
  })

  // 1. units: the lots against the plan's own total
  const units = t5.lots.reduce((s, l) => s + (n(l.units) || 0), 0)
  const total = n(t5.total_units)
  if (total == null && !units) checks.push({ id: 'units', title: 'יחידות דיור', state: 'na', detail: 'אין סך יחידות דיור בתוכנית ובטבלה 5.' })
  else if (total == null) checks.push({ id: 'units', title: 'יחידות דיור', state: 'check', detail: 'סך המגרשים **' + units + '**, ואין סך בתוכנית להשוות אליו.' })
  else checks.push({ id: 'units', title: 'יחידות דיור', state: units === total ? 'ok' : 'fail',
    detail: units === total ? 'סך המגרשים **' + units + '** שווה לסך שבתוכנית.' : 'סך המגרשים **' + units + '**, והתוכנית אומרת **' + total + '**. הפרש **' + (units - total) + '**.' + (t5.total_units_ref ? ' מקור: ' + t5.total_units_ref + '.' : '') })

  // 2. plot area: table 5 against the plot drawn in the proposed tashrit
  if (lotsGeo.length) {
    const off = []
    t5.lots.forEach((l) => {
      const g = lotsGeo.filter((p) => String(p.lot) === String(l.lot)).reduce((s, p) => s + (p.area_m2 || 0), 0)
      if (!g || !n(l.lot_size)) return
      const d = (g - l.lot_size) / l.lot_size * 100
      if (Math.abs(d) > 5) { off.push(l.lot); flag(l.lot, 'בתשריט ' + fmt(g) + ' מ"ר מול ' + fmt(l.lot_size) + ' בטבלה (' + (d > 0 ? '+' : '') + Math.round(d) + '%)') }
    })
    const matched = t5.lots.filter((l) => lotsGeo.some((p) => String(p.lot) === String(l.lot))).length
    checks.push({ id: 'area', title: 'שטח מגרש מול התשריט', state: off.length ? (off.length > t5.lots.length / 4 && !est ? 'fail' : 'check') : 'ok',
      detail: off.length ? '**' + off.length + '** מתוך ' + matched + ' מגרשים שונים ביותר מ-**5%** מהשטח שבתשריט.' + (est ? ' המגרשים בתשריט כאן הם הערכה (מסמכים סרוקים), ולכן ההפרש לא מוכיח טעות בטבלה.' : ' כדאי לפתוח את ההוראות ולבדוק את השורה.') : 'כל ' + matched + ' המגרשים שנמדדו בתשריט בטווח של **5%** מטבלה 5.', lots: off.map(String) })
  } else checks.push({ id: 'area', title: 'שטח מגרש מול התשריט', state: 'na', detail: 'אין מגרשים מהתשריט להשוואה.' })

  // 3. total floor area against its parts, where the table gives a total
  const tot = t5.lots.filter((l) => n(l.total_area))
  // some plans count the shop and public floor area inside the lot in the total, some beside it: either reading is consistent
  const badTot = tot.filter((l) => { const base = sum(l.main_above, l.service_above, l.main_below, l.service_below)
    const extra = sum(l.commercial_main, l.commercial_service_above, l.commercial_total, l.public_in_lot_main, l.public_in_lot_service_above, l.public_in_lot_total, l.public_main, l.employment_main, l.maintenance_building_main)
    const near = (p) => Math.abs(p - l.total_area) <= Math.max(2, l.total_area * 0.01)
    const bad = base > 0 && !near(base) && !near(base + extra); if (bad) flag(l.lot, 'סך השטחים ' + fmt(l.total_area) + ', סכום החלקים ' + fmt(base) + (extra ? ' (עם מסחר וציבור ' + fmt(base + extra) + ')' : '')); return bad })
  checks.push({ id: 'total', title: 'סך שטחי הבנייה מול החלקים', state: !tot.length ? 'na' : badTot.length ? 'check' : 'ok',
    detail: !tot.length ? 'הטבלה לא נותנת סך לכל מגרש, ולכן אין מה לסכם.' : badTot.length ? '**' + badTot.length + '** מתוך ' + tot.length + ' מגרשים: הסך לא שווה לסכום החלקים. ייתכן שחלק מהשטח בעמודה שלא חולצה.' : 'בכל ' + tot.length + ' המגרשים עם סך, הסך שווה לסכום החלקים.', lots: badTot.map((l) => String(l.lot)) })

  // 4. height per floor: a plain range for an apartment or office floor
  // only where people live: a hall or a port shed has tall floors by design
  const hf = t5.lots.filter((l) => n(l.height_m) && n(l.floors_above) && ((n(l.units) || 0) > 0 || /מגורים/.test(l.use || '')))
  const badH = hf.filter((l) => { const r = l.height_m / l.floors_above; const bad = r < 2.8 || r > 5; if (bad) flag(l.lot, 'גובה ' + fmt(l.height_m) + ' מ\' ל-' + l.floors_above + ' קומות: ' + (Math.round(r * 10) / 10) + ' מ\' לקומה'); return bad })
  checks.push({ id: 'height', title: 'גובה לקומה', state: !hf.length ? 'na' : badH.length ? 'check' : 'ok',
    detail: !hf.length ? 'אין מגרש מגורים עם גובה ומספר קומות באותה שורה.' : badH.length ? '**' + badH.length + '** מגרשים מחוץ לטווח **2.8 עד 5 מ\'** לקומה. בדרך כלל: קומות טכניות, חזית מסחרית או גובה שנמדד אחרת.' : 'בכל ' + hf.length + ' המגרשים: **2.8 עד 5 מ\'** לקומה.', lots: badH.map((l) => String(l.lot)) })

  // 5. what is missing for the volume page: coverage on built lots
  const built = t5.lots.filter((l) => (n(l.main_above) || 0) + (n(l.commercial_main) || 0) > 0)
  const noCov = built.filter((l) => n(l.coverage_pct) == null)
  checks.push({ id: 'coverage', title: 'תכסית במגרשים הבנויים', state: !noCov.length ? 'ok' : 'check',
    detail: !noCov.length ? 'לכל ' + built.length + ' המגרשים הבנויים יש תכסית בטבלה.' : '**' + noCov.length + '** מתוך ' + built.length + ' בלי תכסית בטבלה.' + (estCov ? ' ב-**' + estCov + '** מהם הוערכה מקווי הבניין בתשריט, מסומנת (' + NUM_FN + ').' : ' בלי תכסית אין מעבר לנפח.') })

  // 6. how the data was read, as "מה נבנה סביבי" wrote it
  checks.push({ id: 'source', title: 'איך נקרא', state: est || cav.missing ? 'check' : 'ok',
    detail: [t5.source, cav.page && 'עמוד: ' + cav.page, cav.model && 'מודל: ' + cav.model, cav.missing && 'הערה: ' + cav.missing].filter(Boolean).join('. ') + '.' })

  const notes = [...(t5.notes || [])].map((text, i) => ({ num: String(i + 1), text }))
  if (estCov) notes.push({ num: NUM_FN, text: 'תכסית שאינה בטבלה 5: שטח המעטפת בין קווי הבניין בתשריט, חלקי שטח המגרש. הערכה, לא מספר מהתוכנית.' })
  const states = checks.map((c) => c.state).filter((x) => x !== 'na')
  const plan = {
    slug, number: t5.plan_number, name: story.official_name || cav.place || '', place: cav.place || story.kicker || '', status: story.status || '',
    housing: units > 0, lots: t5.lots.length, units, totalUnits: total,
    verdict: states.includes('fail') ? 'fail' : states.includes('check') ? 'check' : 'ok',
    links: { horaot: existsSync(join(SRC, 'public/plans', slug, 'docs/horaot.pdf')) ? SITE + '/plans/' + slug + '/docs/horaot.pdf' : '', mavat: story.mavat_url || '', page: SITE + '/plan/' + encodeURIComponent(t5.plan_number) },
  }
  writeFileSync(join(OUT, slug + '.json'), JSON.stringify({ ...plan, source: t5.source, rows, notes, checks, lotFlags, imported: new Date().toISOString().slice(0, 10) }, null, 1))
  index.push(plan)
}
index.sort((a, b) => (b.housing - a.housing) || a.place.localeCompare(b.place, 'he'))
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ from: 'Anat1969/HITCHADSHUT', site: SITE, imported: new Date().toISOString().slice(0, 10), plans: index }, null, 1))
console.log(index.map((p) => p.verdict.padEnd(6) + p.number.padEnd(16) + String(p.lots).padStart(4) + ' lots ' + String(p.units).padStart(5) + ' units  ' + p.place).join('\n'))
