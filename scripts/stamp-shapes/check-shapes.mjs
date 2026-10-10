// Field-test fixtures for shaped stamp places (founder, 2026-10-10: the Walk of
// Fame refused a stamp under the Dolby Theatre). Loads PP_SHAPES and the
// distance code straight from the worker and checks real spots that must pass
// or must fail. Run: node scripts/stamp-shapes/check-shapes.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../cloudflare-worker-v7.12.js', import.meta.url), 'utf8');
const start = src.indexOf('const PP_SHAPES = [');
const end = src.indexOf('// The rough zone a stamp keeps');
if (start < 0 || end < 0) throw new Error('PP_SHAPES block not found in the worker');
const { PP_SHAPES, ppMetersToShape } = new Function(`${src.slice(start, end)}; return { PP_SHAPES, ppMetersToShape };`)();

// [label, lat, lng, expect]: 'pass' = inside the buffer with perfect GPS;
// 'slack' = passes only with ordinary GPS slack (acc ≥ the overshoot, max 100 m);
// 'fail' = must be refused even with 100 m of slack.
const FIXTURES = {
  'hollywood-walk-of-fame': [
    ['Dolby Theatre, sidewalk under the marquee', 34.10172, -118.34040, 'pass'],
    ['Dolby Theatre, building centre', 34.10228, -118.34030, 'slack'],
    ['TCL Chinese Theatre forecourt', 34.10200, -118.34100, 'pass'],
    ['Hollywood & La Brea', 34.10160, -118.34450, 'pass'],
    ['Hollywood & Highland', 34.10160, -118.33870, 'pass'],
    ['Hollywood & Vine', 34.10164, -118.32670, 'pass'],
    ['Hollywood & Gower', 34.10166, -118.32200, 'pass'],
    ['Vine & Sunset', 34.09815, -118.32668, 'pass'],
    ['Vine & Yucca', 34.10365, -118.32675, 'pass'],
    ['Capitol Records (Vine St)', 34.10318, -118.32625, 'pass'],
    ['Hollywood Bowl', 34.11220, -118.33910, 'fail'],
    ['Runyon Canyon entrance', 34.10510, -118.34960, 'fail'],
    ['Sunset & La Brea', 34.09810, -118.34450, 'fail'],
    ['Griffith Observatory', 34.11840, -118.30030, 'fail'],
  ],
};

let failures = 0;
for (const shape of PP_SHAPES) {
  const cases = FIXTURES[shape.key] || [];
  if (!cases.length) { console.log(`⚠️  ${shape.key}: no fixtures`); continue; }
  console.log(`\n${shape.key} (buffer ${shape.buffer_m} m)`);
  for (const [label, lat, lng, expect] of cases) {
    const m = ppMetersToShape(shape, lat, lng);
    const got = m <= shape.buffer_m ? 'pass' : m <= shape.buffer_m + 100 ? 'slack' : 'fail';
    const ok = got === expect || (expect === 'slack' && got === 'pass');
    if (!ok) failures++;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${Math.round(m)} m from the line → ${got} (want ${expect})`);
  }
}
console.log(failures ? `\n${failures} fixture(s) failed` : '\nAll fixtures pass');
process.exit(failures ? 1 : 0);
