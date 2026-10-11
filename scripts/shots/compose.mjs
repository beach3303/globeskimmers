// compose — build a framed, captioned App Store image from a raw capture.
// Writes a self-contained HTML page (cream canvas, eyebrow + serif headline,
// device bezel, drawn clean status bar) and captures it with cdp-shot at the
// exact store pixel size. Usage:
//   node scripts/shots/compose.mjs --src shot.png --out store.png \
//     --w 1284 --h 2778 --eyebrow "BORDER CROSSINGS" \
//     --l1 "Crossed a border?" --l2 "stamp it on the way" [--serve-dir DIR]
// The raw capture's own status-bar strip is covered by the drawn one only
// when --statusbar teal|none is set to teal (web captures have none).
import { writeFileSync } from 'node:fs';
import { basename, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = resolve(arg('src')); const OUT = resolve(arg('out'));
const W = +arg('w', 1284), H = +arg('h', 2778);
const EYEBROW = arg('eyebrow', ''); const L1 = arg('l1', ''); const L2 = arg('l2', '');
const BAR = arg('statusbar', 'teal'); const COVER = arg('coverbar', '') === '1'; const BS = +arg('barscale', 1); // teal = draw iOS glyphs over the app's teal header; none = leave capture as is
const DIR = resolve(arg('serve-dir', dirname(SRC)));
const PORT = +arg('port', 4321);

// Proportions tuned for 1284×2778 and scaled linearly elsewhere.
const u = W / 1284;
const pad = Math.round(72 * u);
const eyebrowPx = Math.round(34 * u);
const headPx = Math.round(88 * u);
const bezel = Math.round(16 * u);
const devRadius = Math.round(64 * u);
const devW = Math.round(+(process.argv[process.argv.indexOf('--devw')+1] || 0) || 1012 * u);
const barH = Math.round(booleanBar() * u);
function booleanBar() { return BAR === 'teal' ? 62 * BS : 0; }

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  body{width:${W}px;height:${H}px;background:#F6F1E7;font-family:'Inter Tight',sans-serif;overflow:hidden}
  .wrap{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;padding:${pad}px ${pad}px 0}
  .eyebrow{align-self:flex-start;color:#B0472F;font-weight:700;font-size:${eyebrowPx}px;letter-spacing:.18em;text-transform:uppercase}
  h1{align-self:flex-start;margin:${Math.round(18 * u)}px 0 0;font-family:'Instrument Serif',serif;font-weight:400;color:#16110D;font-size:${headPx}px;line-height:1.08}
  h1 em{font-style:italic;color:#0E7C73}
  .device{margin-top:${Math.round(56 * u)}px;background:#15130F;border-radius:${devRadius}px;padding:${bezel}px;box-shadow:0 ${Math.round(40 * u)}px ${Math.round(90 * u)}px rgba(22,17,13,.28)}
  .screen{position:relative;width:${devW}px;border-radius:${devRadius - bezel}px;overflow:hidden;display:block}
  .screen img{width:100%;display:block}
  .sbar{${COVER ? 'background:linear-gradient(100deg,#0E8077 0%,#16AF9F 85%);' : ''}position:absolute;top:0;left:0;right:0;height:${barH}px;display:flex;justify-content:space-between;align-items:center;padding:0 ${Math.round(44 * u * BS)}px;box-sizing:border-box;color:#fff;font-weight:600;font-size:${Math.round(30 * u * BS)}px}
  .sbar svg{display:block}
</style></head><body><div class="wrap">
  <div class="eyebrow">${esc(EYEBROW)}</div>
  <h1>${esc(L1)}<br><em>${esc(L2)}</em></h1>
  <div class="device"><span class="screen">
    <img src="http://localhost:${PORT}/${encodeURIComponent(basename(SRC))}">
    ${BAR === 'teal' ? `<span class="sbar"><span>9:41</span><span style="display:flex;gap:${Math.round(14 * u * BS)}px;align-items:center">
      <svg width="${Math.round(42 * u * BS)}" height="${Math.round(26 * u * BS)}" viewBox="0 0 21 13" fill="#fff"><rect x="0" y="8" width="3.5" height="5" rx="1"/><rect x="5.5" y="5.5" width="3.5" height="7.5" rx="1"/><rect x="11" y="3" width="3.5" height="10" rx="1"/><rect x="16.5" y="0.5" width="3.5" height="12.5" rx="1"/></svg>
      <svg width="${Math.round(40 * u * BS)}" height="${Math.round(28 * u * BS)}" viewBox="0 0 20 14" fill="#fff"><path d="M10 12.8l2.9-3.6a4.6 4.6 0 0 0-5.8 0z"/><path d="M4.3 6.9a8.6 8.6 0 0 1 11.4 0l2-2.5a11.8 11.8 0 0 0-15.4 0z" opacity=".95"/></svg>
      <svg width="${Math.round(62 * u * BS)}" height="${Math.round(30 * u * BS)}" viewBox="0 0 31 15" fill="none"><rect x="1" y="1.5" width="24" height="12" rx="3.5" stroke="#fff" opacity=".6" stroke-width="1.6"/><rect x="3.2" y="3.7" width="17" height="7.6" rx="1.8" fill="#fff"/><path d="M27.5 5.2v4.6c1.6-.4 1.6-4.2 0-4.6z" fill="#fff" opacity=".6"/></svg>
    </span></span>` : ''}
  </span></div>
</div></body></html>`;
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

const page = resolve(DIR, basename(OUT).replace(/\.png$/, '.html'));
writeFileSync(page, html);
// Serve DIR (python http.server), capture, kill server.
const srv = spawnSync('bash', ['-c', `cd ${JSON.stringify(DIR)} && (python3 -m http.server ${PORT} >/dev/null 2>&1 & echo $!)`], { encoding: 'utf8' });
const pid = srv.stdout.trim();
try {
  const r = spawnSync('node', [resolve(dirname(new URL(import.meta.url).pathname), 'cdp-shot.mjs'),
    '--url', `http://localhost:${PORT}/${encodeURIComponent(basename(page))}`,
    '--out', OUT, '--width', String(W), '--height', String(H), '--dsf', '1', '--wait', '5500'], { encoding: 'utf8' });
  process.stdout.write(r.stdout + r.stderr);
} finally { spawnSync('kill', [pid]); }
