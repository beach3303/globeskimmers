// cdp-shot — drive headless Chrome over the DevTools protocol to capture the
// web build at TRUE device metrics (iPhone 402×874@3x, iPad 1032×1376@2x…),
// with geolocation and touch taps/swipes. Built 2026-10-11 for the 1.0.4
// App Store screenshot set: Xcode 27 ships no Simulator.app UI, so simulator
// screens can't be tapped from scripts — the web build (same React code) can.
//
//   node scripts/shots/cdp-shot.mjs --url <url> --out shot.png \
//     [--width 402 --height 874 --dsf 3] [--lat 34.1 --lng -118.3] \
//     [--wait 6000] [--actions '[{"tap":[201,500]},{"sleep":1500},
//        {"swipe":[350,600,60,600]},{"untilText":"NEVADA","max":6,
//         "swipe":[350,600,60,600]}]']
//
// Chrome is found at the same path boot-check uses. ws comes from the
// dependency tree (vite's). This is capture tooling only — never shipped.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const WebSocket = createRequire(import.meta.url)('ws');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URLARG = arg('url'); const OUT = arg('out', 'shot.png');
const W = +arg('width', 402), H = +arg('height', 874), DSF = +arg('dsf', 3);
const LAT = +arg('lat', 34.1016), LNG = +arg('lng', -118.3267);
const WAIT = +arg('wait', 6000);
const ACTIONS = JSON.parse(arg('actions', '[]'));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!URLARG) { console.error('need --url'); process.exit(2); }

const prof = mkdtempSync(join(tmpdir(), 'cdp-shot-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${prof}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wsUrl = await new Promise((res, rej) => {
  let buf = ''; const t = setTimeout(() => rej(new Error('no DevTools endpoint')), 20000);
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
});
const sock = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 });
await new Promise((r) => sock.on('open', r));
let seq = 0; const pending = new Map(); const events = [];
sock.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  else if (m.method) events.push(m);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  sock.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await send('Browser.grantPermissions', { permissions: ['geolocation'] });
await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: true });
await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await S('Emulation.setGeolocationOverride', { latitude: LAT, longitude: LNG, accuracy: 12 });
await S('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await S('Page.enable', {});
await S('Page.navigate', { url: URLARG });
await sleep(WAIT);

const tap = async (x, y) => {
  await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const swipe = async (x1, y1, x2, y2, ms = 320) => {
  const steps = 10;
  await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  for (let i = 1; i <= steps; i++) {
    await S('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / steps, y: y1 + (y2 - y1) * i / steps }] });
    await sleep(ms / steps);
  }
  await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const hasText = async (t) => (await S('Runtime.evaluate', { expression: `document.body.textContent.includes(${JSON.stringify(t)})`, returnByValue: true })).result.value === true;

for (const a of ACTIONS) {
  if (a.sleep) await sleep(a.sleep);
  else if (a.tap) { await tap(a.tap[0], a.tap[1]); await sleep(a.after ?? 1200); }
  else if (a.untilText) {
    for (let i = 0; i < (a.max ?? 6) && !(await hasText(a.untilText)); i++) { await swipe(...a.swipe); await sleep(a.after ?? 1100); }
    if (!(await hasText(a.untilText))) console.error(`untilText NOT found: ${a.untilText}`);
  } else if (a.swipe) { await swipe(...a.swipe); await sleep(a.after ?? 1100); }
  else if (a.eval) await S('Runtime.evaluate', { expression: a.eval });
}

const shot = await S('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
console.log('saved', OUT, `${W}x${H}@${DSF}`);
chrome.kill('SIGKILL');
process.exit(0);
