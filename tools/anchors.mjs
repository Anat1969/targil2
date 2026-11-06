#!/usr/bin/env node
// Appends an "anchors" table to CODEMAP.md: every function, section comment and main region in the app files,
// with its line number, so a session opens only the lines it needs.
// Why here: the shared map (Claude-GH/tools/context-map.mjs) does not read functions inside <script> in HTML,
// and this app is a few large HTML files. Deterministic, zero model tokens. Runs from the SessionStart hook.
//   node tools/anchors.mjs [repoDir]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || '.';
const FILES = ['index.html', 'taba.html', 'app.css', 'tests/app.e2e.mjs'];
const RULES = [
  [/^\s*(?:async\s+)?function\s+([\w$]+)\s*\(/, (m) => m[1] + '()'],
  [/^\s*(?:const|let)\s+([A-Z][A-Z0-9_]{2,})\s*=/, (m) => m[1]],                        // constants: TYPES, GROUPS, SKIN
  [/^\s*\/\/\s*-{3,}\s*(.+?)\s*-{3,}\s*$/, (m) => '§ ' + m[1]],                              // // ---------- section ----------
  [/^\s*\/\/\s*={3,}\s*(.+?)\s*={3,}\s*$/, (m) => '§ ' + m[1]],
  [/^\s*\/\*\s*={3,}\s*(.+?)\s*={3,}\s*\*\/\s*$/, (m) => '§ ' + m[1]],                         // /* ===== css section ===== */
  [/^\s*<(main|header|section|aside)\b[^>]*class="([^"]+)"/, (m) => '<' + m[1] + '.' + m[2].split(' ')[0] + '>'],
  [/^\s*\/\/ ---- (.+?) ----/, (m) => '§ ' + m[1]],
];

let out = '\n## עוגנים: פונקציות וסעיפים לפי שורה\n\nפותחים בטווח שורות סביב העוגן (Read עם offset ו-limit), לא את כל הקובץ.\n';
let total = 0;
for (const f of FILES) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => { for (const [re, name] of RULES) { const m = l.match(re); if (m) { hits.push(`${i + 1} ${name(m)}`); break; } } });
  total += hits.length;
  out += `\n**\`${f}\`** (${lines.length} שורות): ` + hits.join(' · ') + '\n';
}
const map = path.join(dir, 'CODEMAP.md');
const base = fs.existsSync(map) ? fs.readFileSync(map, 'utf8').replace(/\n## עוגנים:[\s\S]*$/, '') : '# מפת הקוד\n';
fs.writeFileSync(map, base.replace(/\s*$/, '\n') + out);
const size = fs.statSync(map).size;
const code = FILES.map((f) => path.join(dir, f)).filter(fs.existsSync).reduce((s, p) => s + fs.statSync(p).size, 0);
// rough token estimate for Hebrew-heavy text: ~3 characters per token
console.log(`anchors: ${total} in ${FILES.length} files; map ~${Math.round(size / 3)} tokens vs ~${Math.round(code / 3)} for reading the files`);
