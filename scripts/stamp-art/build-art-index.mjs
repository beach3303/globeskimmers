// Builds src/lib/stampArtIndex.js (which bespoke art each stamp gets) and
// scripts/stamp-art/d1-art-fixes.sql from the reviewed match of every
// Top-1,000 list place (docs/PASSPORT_ICON_LIST.md) to attractions rows.
//
//   node scripts/stamp-art/build-art-index.mjs <attractions-export.json>
//
// The export is every attractions row as a JSON array (see README.md for the
// wrangler command). Inputs: scripts/stamp-art/art-matches.json. The script
// checks its own output: every stampable row must resolve to exactly the art
// the review gave it, and no other.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countryCode } from "../../src/lib/countries.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const exportPath = process.argv[2];
if (!exportPath) { console.error("usage: node scripts/stamp-art/build-art-index.mjs <attractions-export.json>"); process.exit(1); }

// The app's own slug + hand-kept aliases, read from src/lib/stampArt.js so the
// two can never drift.
const artSrc = fs.readFileSync(path.join(ROOT, "src/lib/stampArt.js"), "utf8");
const pick = (re) => { const m = artSrc.match(re); if (!m) throw new Error(`stampArt.js: ${re} not found`); return m[0]; };
const { slug, ALIAS } = new Function(`${pick(/const slug = [\s\S]*?;\n/)}${pick(/const ALIAS = \{[\s\S]*?\n\};\n/)}return { slug, ALIAS };`)();

const matches = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/stamp-art/art-matches.json"), "utf8"));
const rows = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const byId = new Map(rows.map((r) => [r.id, r]));
const ccOf = (c) => { const v = String(c || "").trim(); return !v ? null : /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : countryCode(v); };
const promoted = new Set(matches.places.map((p) => p.promote).filter(Boolean));
const stampable = (r) => r.tier === "secret" || ["world", "national", "regional"].includes(r.founder_scope || r.scope) || promoted.has(r.id);
const live = matches.places.filter((p) => p.live);
const liveArts = new Set(live.map((p) => p.art));

// Apply, in memory, what d1-art-fixes.sql will do: new rows for list places the
// table lacked, and the cleaned name/city of promoted rows.
for (const p of live) {
  if (p.insert) {
    if (byId.has(p.insert.id)) throw new Error(`#${p.n}: insert id ${p.insert.id} already exists — promote it instead`);
    const r = { ...p.insert, tier: "page", scope: "world", founder_scope: "world", footprint_radius_m: p.insert.radius_m };
    rows.push(r); byId.set(r.id, r);
    p.same = [...p.same, r.id];
  }
  if (p.promote && p.promote_fix) Object.assign(byId.get(p.promote), p.promote_fix);
}
const before = new Map();   // the rows as exported, for the SQL comments
for (const p of live) for (const f of p.fix || []) {
  const r = byId.get(f.id);
  if (!r) continue;
  if (!before.has(f.id)) before.set(f.id, { ...r });
  if (f.country) r.country = f.country;
  if (f.city) r.city = f.city;
}

// Row → the art the review gave it. A row claimed by two places keeps the one
// whose name it carries, else the lower list number.
const rowArt = new Map();
const clash = [];
for (const p of [...live].sort((a, b) => a.n - b.n)) {
  for (const id of [...p.same, ...(p.promote ? [p.promote] : [])]) {
    const r = byId.get(id);
    if (!r) { clash.push(`#${p.n} ${p.name}: row ${id} not in the export`); continue; }
    const had = rowArt.get(id);
    if (had && had !== p.art) {
      if (slug(r.name) === p.art) rowArt.set(id, p.art);
      clash.push(`row ${id} "${r.name}" claimed by ${had} and ${p.art} → ${rowArt.get(id)}`);
    } else rowArt.set(id, p.art);
  }
}

// Stampable rows grouped by their name slug — an extra name becomes an alias
// only when every stampable row carrying it is the same place.
const bySlug = new Map();
for (const r of rows) if (stampable(r)) { const s = slug(r.name); if (s) (bySlug.get(s) || bySlug.set(s, []).get(s)).push(r.id); }

const ART_ALIAS = {}, ART_BY_ID = {};
for (const [id, art] of rowArt) {
  const s = slug(byId.get(id).name);
  const cur = ALIAS[s] || s;
  if (cur === art) continue;
  const safe = !liveArts.has(cur) && !ALIAS[s] && (bySlug.get(s) || []).every((x) => rowArt.get(x) === art);
  if (safe) ART_ALIAS[s] = art; else ART_BY_ID[id] = art;
}

// Landmark variants (src/lib/stampVariants.js: Grand Canyon rims, Niagara
// sides …) take their parent's art when exactly one live list place matches.
const variantsSrc = fs.readFileSync(path.join(ROOT, "src/lib/stampVariants.js"), "utf8");
for (const block of variantsSrc.split(/\n\s*match:/).slice(1)) {
  const re = block.match(/^\s*\/(.+?)\/([a-z]*),/);
  if (!re) continue;
  const rx = new RegExp(re[1], re[2]);
  const parents = live.filter((p) => rx.test(p.name));
  if (parents.length !== 1) continue;
  for (const m of block.matchAll(/name:\s*"([^"]+)",\s*slug:\s*"([^"]+)"/g)) {
    const s = slug(m[1]);
    if (s && !liveArts.has(s) && !ALIAS[s]) ART_ALIAS[s] = parents[0].art;
    if (!liveArts.has(m[2])) ART_BY_ID[m[2]] = parents[0].art;
  }
}

// How a stamp resolves before the guards (mirrors stampArtSlug in stampArt.js).
const rawArt = (name, id) => ART_BY_ID[id] || (slug(name) ? (ALIAS[slug(name)] || ART_ALIAS[slug(name)] || slug(name)) : null);

// Guards. ART_ONLY: when stampable rows that are NOT the place resolve to its
// art by name, only the reviewed rows may show it. ART_CC: the countries the
// place is in (list + reviewed rows) — a name-only stamp elsewhere doesn't.
const ART_ONLY = {}, ART_CC = {};
const sameOf = new Map();
for (const [id, art] of rowArt) (sameOf.get(art) || sameOf.set(art, []).get(art)).push(id);
const strangers = new Map();
for (const r of rows) {
  if (!stampable(r)) continue;
  const a = rawArt(r.name, r.id);
  if (a && liveArts.has(a) && rowArt.get(r.id) !== a) (strangers.get(a) || strangers.set(a, []).get(a)).push(r.id);
}
for (const p of live) {
  if (strangers.has(p.art)) ART_ONLY[p.art] = [...(sameOf.get(p.art) || [])].sort();
  const ccs = new Set([p.cc, ...(sameOf.get(p.art) || []).map((id) => ccOf(byId.get(id).country))].filter(Boolean));
  if (ccs.size) ART_CC[p.art] = [...ccs].sort();
}

// Self-check with the app's exact rule.
const finalArt = (name, id, country) => {
  if (id && ART_BY_ID[id]) return ART_BY_ID[id];
  const s = slug(name); if (!s) return null;
  const art = ALIAS[s] || ART_ALIAS[s] || s;
  const only = ART_ONLY[art];
  if (only && /^[a-z]+:/.test(id) && !/^(places|owned):/.test(id) && !only.includes(id)) return null;
  const ccs = ART_CC[art], cc = ccOf(country);
  if (ccs && cc && !ccs.includes(cc)) return null;
  return art;
};
const wrong = [];
for (const r of rows) {
  if (!stampable(r)) continue;
  const want = rowArt.get(r.id) || null;
  let got = finalArt(r.name, r.id, r.country);
  if (got && !liveArts.has(got)) got = null;   // no file → typographic, as in the app
  if (got !== want) wrong.push(`${r.id} "${r.name}" (${r.country}): want ${want}, got ${got}`);
}
// A row the review rejected for a place that resolves to a DIFFERENT live art is
// still a wrong stamp; one that resolves to its own art never reaches here.
if (wrong.length) { console.error(`${wrong.length} rows resolve wrongly:\n  ${wrong.slice(0, 40).join("\n  ")}`); process.exit(1); }

// Emit the index.
const obj = (o, val) => Object.keys(o).sort().map((k) => `  ${JSON.stringify(k)}: ${val(o[k])},`).join("\n");
const out = `// GENERATED by scripts/stamp-art/build-art-index.mjs from scripts/stamp-art/art-matches.json
// (the reviewed match of every Top-1,000 list place to attractions rows). Do not
// edit by hand — change art-matches.json and re-run the script.

// Other names the attractions DB uses for a list place → its art.
export const ART_ALIAS = {
${obj(ART_ALIAS, JSON.stringify)}
};

// Rows (and landmark variants) whose name can't carry the art safely → art.
export const ART_BY_ID = {
${obj(ART_BY_ID, JSON.stringify)}
};

// Art whose name other places share: only these rows show it.
export const ART_ONLY = {
${obj(ART_ONLY, (v) => JSON.stringify(v))}
};

// The countries each place is in; a stamp elsewhere doesn't borrow its art.
export const ART_CC = {
${obj(ART_CC, (v) => JSON.stringify(v))}
};
`;
fs.writeFileSync(path.join(ROOT, "src/lib/stampArtIndex.js"), out);

// D1 fixes: make list places stampable, widen footprints of big places.
const FOOT = [
  [/national_park|national_forest|nature_reserve|wildlife_refuge/, 6000], [/ski_resort|state_park|regional_park|botanical_garden|arboretum/, 2500],
  [/beach|lake|waterfall|mountain|natural_feature|island/, 1800], [/theme_park|amusement_park|water_park|resort_world/, 900],
  [/airport|international_airport/, 2500], [/university|college|campus|fairground|convention_center/, 800],
  [/zoo|aquarium|safari|golf_course|cemetery|historical_park|archaeolog/, 600], [/(?:^|[^a-z])(?:park|garden|viewpoint)(?![a-z])/, 600],
  [/stadium|arena|race_track|marina|pier|market|bazaar|souk/, 400], [/shopping_mall|department_store|casino|monastery|temple_complex/, 350],
];
const radiusOf = (r) => { const e = Number(r.footprint_radius_m); if (Number.isFinite(e) && e > 0) return e; const h = String(r.category || "").toLowerCase(); for (const [re, m] of FOOT) if (re.test(h)) return m; return 250; };
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const MAX_R = 20000;
const sql = ["-- GENERATED by scripts/stamp-art/build-art-index.mjs — run once:",
  "--   npx wrangler d1 execute globeskimmers-attractions --remote --file=scripts/stamp-art/d1-art-fixes.sql", ""];
const promos = live.filter((p) => p.promote);
sql.push(`-- 1. ${promos.length} Top-1,000 places that exist but weren't stampable → world scope (a few get a cleaner name/city).`);
for (const p of promos) {
  const set = ["founder_scope='world'", ...Object.entries(p.promote_fix || {}).map(([k, v]) => `${k}=${q(v)}`), "updated_at=datetime('now')"];
  sql.push(`UPDATE attractions SET ${set.join(", ")} WHERE id=${q(p.promote)}; -- #${p.n} ${p.name}`);
}
const fixes = live.flatMap((p) => (p.fix || []).map((f) => ({ p, f })));
sql.push("", `-- 2. ${fixes.length} rows pinned in the wrong place (a country/city centroid, another town) → the place itself (Wikidata-checked).`);
for (const { p, f } of fixes) {
  const r = before.get(f.id);
  if (!r) { console.warn(`fix: ${f.id} not in export`); continue; }
  const set = f.lat != null ? [`lat=${(+f.lat).toFixed(5)}`, `lng=${(+f.lng).toFixed(5)}`] : [];
  if (f.qid && f.qid !== r.qid) set.push(`qid=${q(f.qid)}`);
  if (f.city) set.push(`city=${q(f.city)}`);
  if (f.country) set.push(`country=${q(f.country)}`);
  if (f.radius_m && radiusOf(r) < f.radius_m) set.push(`footprint_radius_m=${Math.min(MAX_R, Math.round(f.radius_m))}`);
  sql.push(`UPDATE attractions SET ${set.join(", ")}, updated_at=datetime('now') WHERE id=${q(f.id)}; -- #${p.n} ${p.name}: was ${(+r.lat).toFixed(3)},${(+r.lng).toFixed(3)} ${r.city || ""}, ${r.country || ""}`);
}
const inserts = live.filter((p) => p.insert);
sql.push("", `-- 3. ${inserts.length} Top-1,000 places the table didn't have → new stampable rows (Wikidata-checked centre + footprint).`);
for (const p of inserts) {
  const r = p.insert;
  sql.push(`INSERT OR IGNORE INTO attractions (id,name,category,lat,lng,city,country,source,source_id,footprint_radius_m,tier,scope,founder_scope,qid,popularity) VALUES (${q(r.id)},${q(r.name)},${q(r.category)},${(+r.lat).toFixed(5)},${(+r.lng).toFixed(5)},${q(r.city)},${q(r.country)},'stamp_art',${q(p.art)},${Math.min(MAX_R, Math.round(r.radius_m))},'page','world','world',${r.qid ? q(r.qid) : "NULL"},500000); -- #${p.n}`);
}
// A building matched as part of a big place (a fort on Hadrian's Wall, one of
// Chiloé's churches) keeps a building-sized circle.
const BUILDING = /^(religious|cathedral|mosque|temple|shrine|museum|art_gallery|fortress|palace|monument|tower|observation_deck|zoo|aquarium|market|square)$/;
const widen = [];
for (const p of live) {
  if (!p.big || !p.radius_hint_m) continue;
  const fixed = new Set((p.fix || []).map((f) => f.id));
  for (const id of [...p.same, ...(p.promote ? [p.promote] : [])]) {
    const r = byId.get(id);
    const hint = Math.min(BUILDING.test(String(r?.category || "")) ? 2000 : MAX_R, Math.round(p.radius_hint_m));
    if (r && !fixed.has(id) && !(p.insert && p.insert.id === id) && radiusOf(r) < hint) widen.push(`UPDATE attractions SET footprint_radius_m=${hint}, updated_at=datetime('now') WHERE id=${q(id)}; -- #${p.n} ${p.name} (${radiusOf(r)} m → ${hint} m)`);
  }
}
sql.push("", `-- 4. ${widen.length} big places (parks, lakes, islands, valleys, old towns) whose "you are here" circle was smaller than the place — never narrowed, capped at ${MAX_R / 1000} km.`, ...widen);
const missing = live.filter((p) => p.missing && !p.insert);
sql.push("", `-- 5. ${missing.length} places left without a row (no single spot to stamp) — their art shows only on a stamp that carries the name:`, ...missing.map((p) => `--    #${p.n} ${p.name} (${p.city}, ${p.country}) ${p.skip_note || ""}`));
fs.writeFileSync(path.join(ROOT, "scripts/stamp-art/d1-art-fixes.sql"), sql.join("\n") + "\n");

console.log(JSON.stringify({ places: live.length, rowsWithArt: rowArt.size, aliases: Object.keys(ART_ALIAS).length, byId: Object.keys(ART_BY_ID).length,
  onlyGuards: Object.keys(ART_ONLY).length, countryGuards: Object.keys(ART_CC).length, promotions: promos.length, fixes: fixes.length, inserts: inserts.length, widened: widen.length, missing: missing.length, clashes: clash.length }));
if (clash.length) console.log("clashes:\n  " + clash.join("\n  "));
