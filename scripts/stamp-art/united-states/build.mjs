// The United States stamp list — match every curated place to the attractions database and to the stamp art on
// the server, then write list-2026-11-22.json (founder, 2026-11-22). Same method as ../philippines/build-report.mjs:
//   node scripts/stamp-art/united-states/build.mjs
// Inputs: places.mjs (the curated list), db-us-2026-11-22.json (every US row of the live attractions D1, pulled
// 2026-11-22 with `wrangler d1 execute globeskimmers-attractions --remote --json`), the ALIAS tables in src/lib,
// ../world/uploaded-inventory.json (stamp files known on the server) and a live probe of the worker for every
// file name not in the inventory (cached in probe-cache.json so re-runs are instant).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGIONS } from "./places.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const DATE = "2026-11-22";
const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

const STATE_NAMES = { AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming" };
const KIND = { T: "Tourist", V: "Novelty", L: "Local" };
const KIND_ORDER = { T: 0, V: 1, L: 2 };

// ── the app's slug rules (src/lib/stampArt.js) ──
const slug = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[\x27’"]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ʻ/g, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm = (s) => slug(s).replace(/-/g, " ");
const STOP = new Set(["the","of","and","at","in","on","de","la","el","del","national","state","park","historic","historical","site","monument","memorial","museum","beach","lake","falls","mount","mountain","mt","island","islands","city","san","santa","saint","st","fort","old","new","center","centre"]);
const words = (s) => norm(s).split(" ").filter((w) => w && !STOP.has(w));
const stampable = (r) => ["world", "national", "regional"].includes(r.founder_scope || r.scope) && r.class_ban !== "duplicate";

// ── the alias tables, read straight out of the source files ──
const grab = (file, name) => {
  const t = fs.readFileSync(file, "utf8");
  const i = t.indexOf(name + " = {"); if (i < 0) return {};
  let d = 0, j = i + name.length + 3;
  for (; j < t.length; j++) { if (t[j] === "{") d++; else if (t[j] === "}") { d--; if (d === 0) break; } }
  return new Function("return " + t.slice(i + name.length + 3, j + 1))();
};
const ALIAS = grab(path.join(ROOT, "src/lib/stampArt.js"), "const ALIAS");
const ART_ALIAS = grab(path.join(ROOT, "src/lib/stampArtIndex.js"), "export const ART_ALIAS");
const ART_BY_ID = grab(path.join(ROOT, "src/lib/stampArtIndex.js"), "export const ART_BY_ID");

// ── the database rows ──
const rows = JSON.parse(fs.readFileSync(path.join(HERE, `db-us-${DATE}.json`), "utf8"))
  .filter((r) => r && r.name && r.tier !== "secret")
  .map((r) => ({ ...r, _n: norm(r.name), _w: words(r.name), _city: norm(String(r.city || "").replace(/,\s*[A-Z]{2}$/, "")), _st: stampable(r) }));
// Where each city and state sits, from the database's own rows: a fuzzy match far from the place's city is a different
// place with a similar name (Bear Lake, Colorado is not Bear Mountain State Park, New York).
const cityPts = new Map(), statePts = new Map();
for (const r of rows) {
  if (typeof r.lat !== "number" || typeof r.lng !== "number") continue;
  const c = norm(String(r.city || "").replace(/,\s*[A-Z]{2}$/, "")); if (c) { if (!cityPts.has(c)) cityPts.set(c, []); cityPts.get(c).push([r.lat, r.lng]); }
  const m = /,\s*([A-Z]{2})$/.exec(String(r.city || "")); if (m) { if (!statePts.has(m[1])) statePts.set(m[1], []); statePts.get(m[1]).push([r.lat, r.lng]); }
}
const median = (pts) => { const la = pts.map((p) => p[0]).sort((a, b) => a - b), lo = pts.map((p) => p[1]).sort((a, b) => a - b); return [la[la.length >> 1], lo[lo.length >> 1]]; };
const km = (a, b) => { const R = 6371, d = Math.PI / 180, dl = (b[0] - a[0]) * d, dg = (b[1] - a[1]) * d, h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const STATE_REACH = { AK: 1200, TX: 600, CA: 600, MT: 600, NV: 500, AZ: 500, NM: 500, CO: 500, WY: 500, OR: 500, ID: 500, UT: 500, FL: 600, MI: 500, MN: 500 };
// Approximate state centres for states the database rows cannot place (few rows carry a ", XX" suffix).
const STATE_CENTROID = { AL:[32.8,-86.8],AK:[64.2,-152.3],AZ:[34.3,-111.7],AR:[34.9,-92.4],CA:[37.2,-119.5],CO:[39.0,-105.5],CT:[41.6,-72.7],DE:[39.0,-75.5],DC:[38.9,-77.0],FL:[28.6,-82.4],GA:[32.7,-83.4],HI:[20.8,-156.3],ID:[44.4,-114.6],IL:[40.0,-89.2],IN:[39.9,-86.3],IA:[42.1,-93.5],KS:[38.5,-98.4],KY:[37.5,-85.3],LA:[31.1,-92.0],ME:[45.4,-69.2],MD:[39.1,-76.8],MA:[42.3,-71.8],MI:[44.3,-85.4],MN:[46.3,-94.3],MS:[32.7,-89.7],MO:[38.4,-92.5],MT:[47.0,-109.6],NE:[41.5,-99.8],NV:[39.3,-116.6],NH:[43.7,-71.6],NJ:[40.2,-74.7],NM:[34.4,-106.1],NY:[42.9,-75.5],NC:[35.6,-79.4],ND:[47.5,-100.5],OH:[40.3,-82.8],OK:[35.6,-97.5],OR:[43.9,-120.6],PA:[40.9,-77.8],RI:[41.7,-71.6],SC:[33.9,-80.9],SD:[44.4,-100.2],TN:[35.9,-86.4],TX:[31.5,-99.3],UT:[39.3,-111.7],VT:[44.1,-72.7],VA:[37.5,-78.9],WA:[47.4,-120.5],WV:[38.6,-80.6],WI:[44.6,-89.9],WY:[43.0,-107.6] };
const refFor = (place) => {
  const refs = [];
  const c = cityPts.get(norm(place.where)); if (c && c.length >= 3) refs.push({ pt: median(c), reach: 150 });
  const s = statePts.get(place.state); const reach = STATE_REACH[place.state] || 450;
  if (s && s.length >= 10) refs.push({ pt: median(s), reach }); else if (STATE_CENTROID[place.state]) refs.push({ pt: STATE_CENTROID[place.state], reach: reach + 150 });
  return refs.length ? refs : null;
};
const byFirstWord = new Map();
for (const r of rows) for (const w of new Set(r._w)) { if (!byFirstWord.has(w)) byFirstWord.set(w, []); byFirstWord.get(w).push(r); }

// Hand-reviewed: places whose best database match is a different thing (reviewed 2026-11-22; see README).
const NO_MATCH = new Set(["Dealey Plaza","Pigeon Forge Parkway","South Carolina State House","Milwaukee Public Market","Sam Houston Statue","Stowe","Nantucket","The Greenbrier","Biloxi Beach","Sanibel Island","Crystal River","Ship Island","Dahlonega","Anna Maria Island","Spearfish Canyon","Mount Lemmon","Bisbee","Tombstone","Leadville","Casper Mountain","Ojai","Forks","Hood River","Ballard","Whidbey Island","Kodiak","Kīlauea","Lake Chelan","Mount Shasta","Magnificent Mile","Old Tucson","Great Basin National Park","Provincetown","Fifth Avenue","Jim Thorpe","Ybor City","Cedar Key","Kelleys Island","Door County","Lady Bird Lake","Jerome","Red Lodge","Pismo Beach Monarch Butterfly Grove","Tumalo Falls","Ala Moana Center","Cheers Beacon Hill","Catalina Island","Napa Valley Wine Train","Ripley's Believe It or Not! Times Square","Roosevelt Island Tramway","Glen Canyon Dam","South Padre Island","Shenandoah Caverns","Lake of the Ozarks","Sisters","Nashville","Seattle Center","Old Sacramento","Apalachicola","Mohegan Sun","Little Jerusalem Badlands State Park","Bisti Badlands","Lincoln Historic Site","Toyota Center","Old Faithful Geyser of California","Coronado Beach","Dinosaur Land","Universal CityWalk Hollywood","The Venetian","Bear Lake","Thousand Springs State Park","Burgdorf Hot Springs","Kirkham Hot Springs","Goldbug Hot Springs","Umpqua Hot Springs","Bagby Hot Springs","Strawberry Park Hot Springs","Lava Hot Springs","Centralia","Georgetown","Rock Creek Park","Mount Mitchell","Legacy Museum","Grand Isle","Brown County State Park","Cranbrook","Illinois Beach State Park","Oz Museum","National Route 66 Museum","Ledges State Park","Yale University","Letchworth State Park","Deep Creek Lake","Wilson Lake","Palisades State Park","Natural Bridges National Monument","Sun Valley","Coney Island Boardwalk","Silver City","Holland Lake Falls","Leavenworth","Buc-ee's San Marcos"]);
// Hand-reviewed: place name → database id, where the matcher could not see it.
const FORCE = { "United States Capitol": "icon:Q54109", "Top of the Rock": "wikidata:Q680614", "Motown Museum": "wikidata:Q1987935", "Mono Lake": "wikidata:Q2115082", "SFMOMA": "wikidata:Q913672", "Enchanted Rock": "wikidata:Q2251435", "Mount St. Helens": "wikidata:Q3326044", "Ernest Hemingway Home and Museum": "wikidata:Q280171", "United States Naval Academy": "wikidata:Q559549", "Little Rock Central High School": "wikidata:Q49518217", "Noah's Ark Water Park": "wikidata:Q3342498", "Cosmosphere": "wikidata:Q847637", "Tallgrass Prairie Preserve": "wikidata:Q3514544", "Rowe Sanctuary": "wv:kearney-nebraska-lillian-annette-rowe-bird-sanctuary", "Acoma Sky City": "wikidata:Q342057", "Little Bighorn Battlefield National Monument": "wikidata:Q1865583", "TCL Chinese Theatre": "wikidata:Q1122565", "Boeing Future of Flight": "wikidata:Q5510825", "The Ringling": "wikidata:Q612530", "Red River Gorge": "wikidata:Q2136041", "Hanalei Bay": "wv:kauai-hanalei-valley-and-bay", "Diablo Lake": "wv:north-cascades-national-park-diablo-lake-overlook", "Bell Rock": "wv:sedona-bell-rock-pathway-vista", "Seneca Rocks": "wikidata:Q7581417" };

function match(place) {
  if (NO_MATCH.has(place.name)) return { row: null, score: 0 };
  if (FORCE[place.name]) { const row = rows.find((r) => r.id === FORCE[place.name]); if (row) return { row, score: 100 }; }
  const n = norm(place.name), w = words(place.name);
  const whereN = norm(place.where + " " + STATE_NAMES[place.state]);
  const ref = refFor(place);
  // candidates: rows sharing at least one meaningful word (the full scan is 20k × 2.7k otherwise)
  const cands = new Set();
  for (const x of (w.length ? w : n.split(" "))) for (const r of byFirstWord.get(x) || []) cands.add(r);
  let best = null, bestScore = 0;
  for (const r of cands) {
    const rn = r._n; if (!rn) continue;
    let score = 0;
    if (rn === n) score = 100;
    else if (rn.includes(n) || n.includes(rn)) score = 70;
    else { const rw = r._w; const hit = w.filter((x) => rw.includes(x)).length;
      // every meaningful word present: a one-word name only counts when the row's meaningful words are the same one
      if (w.length >= 2 && hit === w.length) score = 60; else if (w.length === 1 && hit === 1 && rw.length === 1) score = 60; else if (hit >= 2 && hit >= w.length - 1) score = 45; }
    if (!score) continue;
    const extra = r._w.filter((x) => !w.includes(x)).length; score -= 10 * extra;
    if (score < 100 && r._w.length < w.length && n.includes(rn)) score -= 15;   // a row that says LESS than the place is the generic thing (Rainbow, Old Town, Main St)
    if (score < 100 && Math.min(rn.length, n.length) / Math.max(rn.length, n.length) < 0.6) score -= 10;
    const sameCity = r._city && r._city.length > 3 && whereN.includes(r._city);
    if (sameCity) score += 10;
    else if (ref && typeof r.lat === "number") { const ds = ref.map((f) => km(f.pt, [r.lat, r.lng]) / f.reach); if (ds.some((x) => x > 1)) score -= 35; else if (ds[0] * ref[0].reach < 25) score += 6; }
    const m = /,\s*([A-Z]{2})$/.exec(String(r.city || "")); if (m && m[1] !== place.state) score -= 40;
    if (r._st) score += 8; if (String(r.id).startsWith("icon:")) score += 6;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 55 ? { row: best, score: bestScore } : { row: null, score: 0 };
}

// ── the art on the server ──
const inventory = new Set(JSON.parse(fs.readFileSync(path.join(HERE, "../world/uploaded-inventory.json"), "utf8")).map((a) => String(a.file || "").replace(/\.png$/, "")).filter(Boolean));
const cachePath = path.join(HERE, "probe-cache.json");
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};
async function exists(s) {
  if (inventory.has(s)) return true;
  if (s in cache) return cache[s];
  try {
    const res = await fetch(`${WORKER}/stamp-art/${s}.png`, { method: "GET", headers: { "User-Agent": UA, Accept: "image/png,image/*;q=0.8" } });
    cache[s] = res.status === 200; try { await res.arrayBuffer(); } catch { /* drain */ }
  } catch { return false; }   // not cached: a network blip is not a "no"
  return cache[s];
}
async function artFor(place, row, score) {
  const s = slug(place.name);
  if (await exists(s)) return { art: s, shared: false };
  // The place's own art under another file name: an alias of its own slug, or the file its database row wears
  // when that row is surely the same place (an exact or near-exact name). Anything else is another place's art.
  for (const a of [ALIAS[s], ART_ALIAS[s]]) if (a && a !== s && (await exists(a))) return { art: a, shared: false };
  if (row && score >= 70) {
    const rs = slug(row.name); const same = score >= 90;
    for (const a of [ART_BY_ID[row.id], ALIAS[rs], ART_ALIAS[rs], rs]) if (a && a !== s && (await exists(a))) return { art: a, shared: !same };
  }
  return null;
}

// ── build ──
// Pre-warm the probe cache with every place's own file name, eight at a time (serial would take ten minutes).
{
  const all = REGIONS.flatMap((r) => r.items.map((it) => slug(it[0]))).filter((s) => !inventory.has(s) && !(s in cache));
  let i = 0; const pool = Array.from({ length: 8 }, async () => { while (i < all.length) { const s = all[i++]; await exists(s); if (i % 200 === 0) { fs.writeFileSync(cachePath, JSON.stringify(cache)); process.stderr.write(`probe ${i}/${all.length}… `); } } });
  await Promise.all(pool); fs.writeFileSync(cachePath, JSON.stringify(cache));
}
const out = [];
let n = 0;
for (const { region, items } of REGIONS) {
  const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => (KIND_ORDER[a.it[3]] - KIND_ORDER[b.it[3]]) || (a.i - b.i));
  for (const { it } of sorted) {
    const [name, where, state, kind, category, visitors] = it;
    const place = { n: ++n, region, name, where, state, stateName: STATE_NAMES[state], kind: KIND[kind], category, visitors: visitors || "" };
    const { row, score } = match(place);
    const a = await artFor(place, row, score);
    const status = !row ? "Not in the database yet" : row._st ? "Stampable today" : "In the database, not yet stampable";
    out.push({ ...place, file: slug(name) + ".png", status, score, dbName: row ? row.name : "", dbId: row ? row.id : "", dbCity: row ? row.city || "" : "", dbScope: row ? (row.founder_scope || row.scope) : "", art: a ? a.art + ".png" : "", shares: a && a.shared ? a.art + ".png" : "" });
    if (n % 250 === 0) { fs.writeFileSync(cachePath, JSON.stringify(cache)); process.stderr.write(`${n}… `); }
  }
}
fs.writeFileSync(cachePath, JSON.stringify(cache));
fs.writeFileSync(path.join(HERE, `list-${DATE}.json`), JSON.stringify(out, null, 1));

const tally = (l) => ({ n: l.length, stampable: l.filter((x) => x.status.startsWith("Stampable")).length, exists: l.filter((x) => x.status.startsWith("In the")).length, missing: l.filter((x) => x.status.startsWith("Not")).length, art: l.filter((x) => x.art && !x.shares).length, shared: l.filter((x) => x.shares).length });
console.log("\nALL", JSON.stringify(tally(out)));
for (const k of ["Tourist", "Novelty", "Local"]) console.log(k.padEnd(8), JSON.stringify(tally(out.filter((x) => x.kind === k))));
// Review aids: the fuzzy matches (score < 100) so a human can read them for mistakes.
const fuzzy = out.filter((x) => x.dbId && x.score < 100);
fs.writeFileSync(path.join(HERE, "review-fuzzy.txt"), fuzzy.map((x) => `${String(x.n).padStart(4)} ${x.score.toString().padStart(3)}  ${x.name} (${x.where}, ${x.state})  →  ${x.dbName} [${x.dbCity}] ${x.dbId} ${x.dbScope}`).join("\n"));
console.log("fuzzy matches to review:", fuzzy.length, "→ review-fuzzy.txt");
