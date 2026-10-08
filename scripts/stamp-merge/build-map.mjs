// Builds the duplicate-stamp MERGE MAP for the D1 table `attractions`
// (database globeskimmers-attractions): which rows are the same place, which
// one survives (the "canonical"), what the survivor should inherit from its
// twins, and which groups a person has to look at first.
//
// READ-ONLY. Every query goes through d1Select(), which refuses anything that
// is not a single SELECT. Nothing in D1, KV or Supabase is changed. The outputs
// are plain files for a later, separate apply step.
//
//   node scripts/stamp-merge/build-map.mjs            # fresh read from D1
//   node scripts/stamp-merge/build-map.mjs --cached   # reuse the last read (OS tmp dir)
//   add --dump to print every group whose survivor differs from today's visible row
//
// Writes (scripts/stamp-merge/):
//   data/alias-map.json         { alias_id: canonical_id } for rows that exist in D1
//   data/ghost-aliases.json     { deleted_id: canonical_id } for ids that no longer
//                               exist in D1 but that art, films or parents still name
//   data/canonical-fills.json   per canonical: the fields it should take from its twins
//   data/needs-human.json       groups (or rows) held back or flagged, one-line reason each
//   REPORT.md                   the summary for the founder
//   preflight-supabase.sql      read-only counts to run later:
//                                 npx supabase db query --linked -f scripts/stamp-merge/preflight-supabase.sql
//   preflight-supabase-held-ids.sql  read-only list of every D1-style id held in stamps
//
// Rules (from the read-only data mapping of 2026-10-08):
//   Groups   rows sharing a qid (every qid group, stamp-worthy or not), joined
//            with live stamp-worthy rows whose names normalise equal within
//            1.5 km (no qid, or a different qid within 500 m; a different qid
//            further than that is flagged, not merged). A row banned as
//            'wrong-match:*' is never merged: the ban says it is not this place.
//   Hold     rows further apart than max(5 km, 2 x stamp radius), unless one of
//            the pair is an area (national_park, park, lake, nature_reserve;
//            then up to 50 km); groups where every row is banned for a reason
//            other than 'duplicate' (skipped); a group whose survivor would be
//            un-hidden over a class ban; the hand-reviewed cases in HAND.
//   Pick     live first (class_ban NULL / '' / 'review:...'), then id prefix
//            icon < curated < wikidata < wv < auto, then founder_scope set, then
//            popularity desc, then sitelinks desc (ignoring icon rows whose id
//            Q-number is not their qid: their sitelinks belong to another
//            entity), then id asc.
//   Fill     empty fields from twins, never overwriting founder data (see fillsFor).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DATA = path.join(HERE, 'data');
const CACHE = path.join(os.tmpdir(), 'stamp-merge-cache');
const USE_CACHE = process.argv.includes('--cached');
const DB = 'globeskimmers-attractions';
const TODAY = new Date().toISOString().slice(0, 10);

// ───────────────────────────── Hand-reviewed cases ─────────────────────────────
// Keyed by qid. block: true holds the whole group back from the merge (it stays
// exactly as it is today). block: false merges but asks a person to confirm.
const HAND = {
  // Wrong row, or two different places under one Wikidata id
  Q913672: { kind: 'mistag', block: true, reason: "The visible row is 'SFMOMA — Artists Gallery' at Fort Mason, 3.6 km from the real SFMOMA (the hidden auto row). Two different places share one Wikidata id." },
  Q18157: { kind: 'mistag', block: true, reason: 'The visible row is a church in Djerba, Tunisia; the hidden twin is St. Nicholas Greek Orthodox Church in New York. Different places.' },
  Q841506: { kind: 'mistag', block: true, reason: 'Villa Borghese gardens (visible) and Galleria Borghese museum (hidden, founder said national) are two different places under one Wikidata id.' },
  Q186106: { kind: 'mistag', block: true, reason: "'South Beach' (icon) and 'Española Way' (a street in South Beach) share one Wikidata id; the icon's own id says it is a different entity." },
  // A part listed under its parent's Wikidata id
  Q2583112: { kind: 'sub-place', block: true, reason: "'Camp Jurassic' is one area inside Universal Islands of Adventure, listed under the park's Wikidata id." },
  Q3229105: { kind: 'sub-place', block: true, reason: "'Sea Life Aquarium' is a separate attraction next to Legoland Malaysia, listed under Legoland's Wikidata id." },
  Q338512: { kind: 'sub-place', block: true, reason: "'Hotel Sidi Driss' (a Star Wars film location, has a film scene) is one building in Matmata, listed under the troglodyte houses' id." },
  Q54495: { kind: 'sub-place', block: true, reason: "'Bridge Climb' is a tour on the Sydney Harbour Bridge, not the bridge itself." },
  Q487036: { kind: 'sub-place', block: true, reason: "'Myeong-Dong Cathedral' and the Myeongdong district (icon) share one Wikidata id." },
  Q1123180: { kind: 'sub-place', block: true, reason: "A Wikivoyage listing called just 'Cathedral' sits under the Toledo Old City id." },
  Q423654: { kind: 'sub-place', block: true, reason: "'Wat Traphang Thong' is one temple inside Sukhothai Historical Park, listed under the park's id." },
  Q3630402: { kind: 'sub-place', block: true, reason: "'Dashashwamedh Ghat' is one ghat; the icon is all the Varanasi ghats." },
  Q870844: { kind: 'sub-place', block: true, reason: "'Sentosa Island' (hidden) is listed under the id of 'Siloso Beach', one beach on the island." },
  Q1133309: { kind: 'sub-place', block: true, reason: "'The Dubai Mall' (visible) carries the Wikidata id of the Dubai Aquarium inside it; the hidden twin is the aquarium." },
  Q220289: { kind: 'sub-place', block: true, reason: "The 'Grand Canyon South Rim' icon carries the national park's Wikidata id; the hidden twin is the whole park. The rims are separate variant stamps." },
  Q18769666: { kind: 'sub-place', block: true, reason: "'Castle Keukenhof' is a different building next to Keukenhof Gardens, under the gardens' id." },
  Q990128: { kind: 'sub-place', block: true, reason: "The 'Erawan Falls' icon carries the national park's Wikidata id; the hidden twin is the whole park, 3 km away." },
  // Icons whose name covers more than one Wikidata id
  Q130958: { kind: 'composite', block: false, reason: "The icon 'Pyramids of Giza & Great Sphinx' covers two places; the twin is only the Sphinx." },
  Q842822: { kind: 'composite', block: false, reason: "The icon 'Icherisheher & Maiden Tower' covers the old town and the tower; the twin is only the tower." },
  Q52505: { kind: 'composite', block: false, reason: "The icon 'Grand Canal & Rialto Bridge' covers two places; the twin is only the bridge." },
  Q172988: { kind: 'composite', block: false, reason: "The icon 'St. Mark's Square & Basilica' covers two places; the twin is only the basilica." },
  Q244952: { kind: 'composite', block: false, reason: "The icon 'The Last Supper (Santa Maria delle Grazie)' is the painting's refectory; the twin is the church." },
  Q1348507: { kind: 'composite', block: false, reason: "The icon 'Zócalo & Metropolitan Cathedral' covers two places; the twin is only the square." },
  // Two real sides or sites
  Q34221: { kind: 'two-sides', block: true, reason: 'Niagara Falls: a Canada row, a US row and the US-side icon. Decide whether the two sides stay two stamps.' },
  Q2266081: { kind: 'two-sites', block: true, reason: "Galleria Nazionale d'Arte Antica has two buildings (Palazzo Barberini and Palazzo Corsini), 2.3 km apart." },
  Q177567: { kind: 'two-sites', block: true, reason: "The icon is the 'Manaus gateway' to the Amazon, 274 km from the rainforest row; its id (Q155) is Brazil's." },
  // Merge, but a person should confirm (composites above merge too: a stamp on the
  // part forwards to the icon; split the icon later if the founder wants two stamps)
  Q490981: { kind: 'class-review', block: false, reason: "Bukchon Hanok Village: the hidden twin is under class review as a neighbourhood (review:Q123705); the icon row is live and wins. Confirm neighbourhoods stay stamps." },
};
// Pairs a person should look at that no automatic rule joins (different names and ids).
const CHECK_PAIRS = [
  ['curated:united-states-los-angeles-getty-center', 'icon:Q731126', "Getty Center (the hilltop campus) and the J. Paul Getty Museum (the museum on it) both show, about 100 m apart. Names and Wikidata ids differ, so the automatic rules leave them apart; to merge, add the pair to NAME_PAIRS in this script and re-run."],
];
// Pairs a person has confirmed are one place although names differ: [survivor-to-be?, other]. Empty until confirmed.
const NAME_PAIRS = [];
const AREA = new Set(['national_park', 'park', 'lake', 'nature_reserve']);
const GENERIC_CATEGORY = new Set(['landmark', 'experience']);
const NAME_TWIN_M = 1500, NAME_TWIN_DIFF_QID_M = 500, AREA_MAX_M = 50000, BIG_GROWTH_M = 1000;

// ───────────────────────────── D1, read-only ─────────────────────────────

function assertReadOnly(sql) {
  const bare = sql.replace(/'(?:[^']|'')*'/g, "''").trim().replace(/;\s*$/, '');
  if (!/^(SELECT|WITH)\b/i.test(bare) || bare.includes(';') ||
      /\b(INSERT|UPDATE|DELETE|REPLACE|UPSERT|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i.test(bare)) {
    throw new Error(`refusing a statement that is not a single SELECT: ${sql.slice(0, 160)}`);
  }
}
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function d1Select(sql) {
  assertReadOnly(sql);
  for (let attempt = 1; ; attempt++) {
    const r = spawnSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = null;
    try { out = JSON.parse(r.stdout); } catch { /* not JSON: an error message */ }
    if (Array.isArray(out) && Array.isArray(out[0]?.results)) return out[0].results;
    const msg = `${r.stdout || ''}${r.stderr || ''}`;
    if (attempt < 4 && /7429|CPU time|timed? ?out|ECONNRESET|fetch failed|\b5\d\d\b/i.test(msg)) { sleep(attempt * 5000); continue; }
    throw new Error(`D1 read failed: ${msg.slice(0, 800)}`);
  }
}
function cached(name, fn) {
  const f = path.join(CACHE, `${name}.json`);
  if (USE_CACHE && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const v = fn();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v));
  return v;
}
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Long text is read as lengths only; the apply step copies it row-to-row in SQL.
const COLS = `id, name, category, lat, lng, city, country,
  length(coalesce(description, '')) AS dlen, length(coalesce(why_visit, '')) AS wlen,
  rating, is_marquee, free_to_visit, source, source_id, pop_score, pageviews, sitelinks,
  popularity, place_id, footprint_radius_m, parent_id, tier, scope, founder_scope, class_ban, qid`;
const STAMPWORTHY_SQL = `(tier = 'secret' OR coalesce(founder_scope, scope) IN ('world', 'national', 'regional'))`;
const LIVE_SQL = `(class_ban IS NULL OR class_ban = '' OR class_ban LIKE 'review:%')`;

// Full rows WHERE col IN (values), cached under `tag` and re-read when the value list changes.
function rowsWhereIn(tag, col, values) {
  const want = [...new Set(values)].sort();
  const f = path.join(CACHE, `${tag}.json`);
  if (USE_CACHE && fs.existsSync(f)) {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (JSON.stringify(c.values) === JSON.stringify(want)) return c.rows;
  }
  const rows = [];
  for (const part of chunk(want, 250)) rows.push(...d1Select(`SELECT ${COLS} FROM attractions WHERE ${col} IN (${part.map(sqlStr).join(',')})`));
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ values: want, rows }));
  return rows;
}

// ───────────────────────────── Small helpers ─────────────────────────────

// The worker's own name normaliser (ttdStampFor), so "same name" means what it means there.
const norm = (v) => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

// The worker's stamp radius (ppStampRadius / PP_FOOTPRINTS): explicit footprint, else by category, else 250 m.
const PP_FOOTPRINTS = [
  [/national_park|national_forest|nature_reserve|wildlife_refuge/, 6000],
  [/ski_resort|state_park|regional_park|botanical_garden|arboretum/, 2500],
  [/beach|lake|waterfall|mountain|natural_feature|island/, 1800],
  [/theme_park|amusement_park|water_park|resort_world/, 900],
  [/airport|international_airport/, 2500],
  [/university|college|campus|fairground|convention_center/, 800],
  [/zoo|aquarium|safari|golf_course|cemetery|historical_park|archaeolog/, 600],
  [/(?:^|[^a-z])(?:park|garden|viewpoint)(?![a-z])/, 600],
  [/stadium|arena|race_track|marina|pier|market|bazaar|souk/, 400],
  [/shopping_mall|department_store|casino|monastery|temple_complex/, 350],
];
function stampRadius(r) {
  const explicit = Number(r?.footprint_radius_m);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const hay = String(r?.category || '').toLowerCase();
  if (hay) for (const [re, m] of PP_FOOTPRINTS) if (re.test(hay)) return m;
  return 250;
}
function distM(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const s = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}
const km = (m) => (m >= 10000 ? `${Math.round(m / 1000)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const prefixOf = (id) => (/^[a-z]+:/.test(id) ? id.slice(0, id.indexOf(':')) : '(slug)');
const PREFIX_RANK = { icon: 0, curated: 1, wikidata: 2, wv: 3, auto: 4 };
const prefixRank = (id) => PREFIX_RANK[prefixOf(id)] ?? 5;
const isLive = (r) => r.class_ban == null || r.class_ban === '' || String(r.class_ban).startsWith('review:');
const isDupBan = (r) => r.class_ban === 'duplicate';
const isOtherBan = (r) => !isLive(r) && !isDupBan(r);
const isWrongMatch = (r) => String(r.class_ban || '').startsWith('wrong-match:');
const idQ = (id) => (String(id).match(/^(?:icon|wikidata):(Q\d+)$/) || [])[1] || null;
const badSitelinks = (r) => prefixOf(r.id) === 'icon' && idQ(r.id) && r.qid && idQ(r.id) !== r.qid;
const SCOPE_RANK = { world: 3, national: 2, regional: 1, local: 0 };
const scopeRank = (s) => SCOPE_RANK[s] ?? -1;
const effScope = (r) => r.founder_scope || r.scope;
const isStampworthy = (r) => r.tier === 'secret' || scopeRank(effScope(r)) >= 1;

function rankCmp(a, b) {
  const sl = (r) => (badSitelinks(r) ? -1 : r.sitelinks ?? -1);
  return (isLive(b) - isLive(a))
    || (prefixRank(a.id) - prefixRank(b.id))
    || ((b.founder_scope ? 1 : 0) - (a.founder_scope ? 1 : 0))
    || ((b.popularity ?? -1) - (a.popularity ?? -1))
    || (sl(b) - sl(a))
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
const rowLine = (r) => `${r.id} — "${r.name}" (${[r.city, r.country].filter(Boolean).join(', ')}) [${r.class_ban || 'live'}${r.founder_scope ? `, founder: ${r.founder_scope}` : ''}]`;

// ───────────────────────────── Reads ─────────────────────────────

console.error(USE_CACHE ? 'reading D1 (cache allowed)…' : 'reading D1…');

// 1. Every row whose qid is shared with another row.
const qidRows = cached('qid-rows', () => d1Select(
  `SELECT ${COLS} FROM attractions WHERE qid IN
     (SELECT qid FROM attractions WHERE qid IS NOT NULL AND qid <> '' GROUP BY qid HAVING count(*) > 1)`));

// 2. Live stamp-worthy rows (slim), paged by rowid, for the name-twin pass.
const swLive = cached('stampworthy-live', () => {
  const out = [];
  for (let last = 0; ;) {
    const page = d1Select(`SELECT rowid AS rid, id, name, lat, lng, qid, category, tier, footprint_radius_m
      FROM attractions WHERE rowid > ${last} AND ${LIVE_SQL} AND ${STAMPWORTHY_SQL} ORDER BY rowid LIMIT 8000`);
    out.push(...page);
    if (page.length < 8000) break;
    last = page[page.length - 1].rid;
  }
  return out;
});

// 3. Every row marked 'duplicate' (each should end up pointing at a live canonical).
const dupRows = cached('duplicate-rows', () => d1Select(`SELECT ${COLS} FROM attractions WHERE class_ban = 'duplicate'`));

// 4. Ids that other data still points at: film scenes, secret-stamp parents, stamp art.
const filmIds = cached('film-ids', () => d1Select(`SELECT attraction_id FROM film_scenes`).map((r) => r.attraction_id));
const parentRefs = cached('parent-refs', () => d1Select(`SELECT id, parent_id FROM attractions WHERE parent_id IS NOT NULL`));
const artMatches = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/stamp-art/art-matches.json'), 'utf8'));
const artIndexSrc = fs.readFileSync(path.join(ROOT, 'src/lib/stampArtIndex.js'), 'utf8');
const refs = new Map();   // id -> Set(where it is named)
const addRef = (id, where) => { if (id && /^[a-z]+:/.test(id)) { if (!refs.has(id)) refs.set(id, new Set()); refs.get(id).add(where); } };
for (const p of artMatches.places) {
  for (const id of p.same || []) addRef(id, `art-matches #${p.n} ${p.name}`);
  if (p.promote) addRef(p.promote, `art-matches #${p.n} ${p.name} (promote)`);
  if (p.insert?.id) addRef(p.insert.id, `art-matches #${p.n} ${p.name} (insert)`);
}
for (const m of artIndexSrc.matchAll(/"((?:icon|curated|wikidata|wv|auto):[^"]+)"/g)) addRef(m[1], 'src/lib/stampArtIndex.js');
for (const id of filmIds) addRef(id, 'film_scenes');
for (const r of parentRefs) addRef(r.parent_id, `parent of ${r.id}`);

const rowsById = new Map();
for (const r of [...qidRows, ...dupRows]) rowsById.set(r.id, r);
const qidGroupIds = new Set(qidRows.map((r) => r.id));
const swLiveIds = new Set(swLive.map((r) => r.id));

// ───────────────────────────── Name-twin pass ─────────────────────────────
// Live stamp-worthy rows (plus 'duplicate' rows outside any qid group, whose twin
// may be a qid-less row) that share a normalised name within 1.5 km.

const orphanDups = dupRows.filter((r) => !qidGroupIds.has(r.id));
const namePool = [...swLive.map((r) => ({ ...r, _live: true })), ...orphanDups.map((r) => ({ ...r, _live: false }))];
const byName = new Map();
for (const r of namePool) { const n = norm(r.name); if (n) (byName.get(n) || byName.set(n, []).get(n)).push(r); }
const nameEdges = [], nameFlags = [];
for (const [n, list] of byName) {
  if (list.length < 2) continue;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.id === b.id || !(a._live || b._live)) continue;
    if (a.qid && b.qid && a.qid === b.qid) continue;            // already joined by qid
    const d = distM(a, b);
    if (d > NAME_TWIN_M) continue;
    const diffQ = !!(a.qid && b.qid);
    if (diffQ && d > NAME_TWIN_DIFF_QID_M) { nameFlags.push({ a: a.id, b: b.id, d, name: n }); continue; }
    nameEdges.push({ a: a.id, b: b.id, d, diffQ, name: n });
  }
}
const nameRowIds = [...new Set([...nameEdges, ...nameFlags].flatMap((e) => [e.a, e.b]).concat(NAME_PAIRS.flat(), CHECK_PAIRS.flatMap(([a, b]) => [a, b])))].filter((id) => !rowsById.has(id));
for (const r of rowsWhereIn('name-rows', 'id', nameRowIds)) rowsById.set(r.id, r);

// ───────────────────────────── Ghost ids ─────────────────────────────
// Ids that art / film scenes / parents name but that no longer exist in D1.

const refUnknown = [...refs.keys()].filter((id) => !rowsById.has(id) && !swLiveIds.has(id));
const refRows = rowsWhereIn('ref-rows', 'id', refUnknown);
const refExisting = new Set(refRows.map((r) => r.id));
for (const r of refRows) if (!rowsById.has(r.id)) rowsById.set(r.id, r);
const ghosts = refUnknown.filter((id) => !refExisting.has(id)).sort();
const ghostQids = [...new Set(ghosts.map(idQ).filter(Boolean))];
const qidKnown = new Set([...rowsById.values()].map((r) => r.qid).filter(Boolean));
for (const r of rowsWhereIn('ghost-qid-rows', 'qid', ghostQids.filter((q) => !qidKnown.has(q)))) if (!rowsById.has(r.id)) rowsById.set(r.id, r);

// ───────────────────────────── Groups (union-find) ─────────────────────────────

const parent = new Map();
const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const add = (x) => { if (!parent.has(x)) parent.set(x, x); };
const union = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb); };

// Never merged: a row banned as a wrong Wikidata match (the ban says it is not this
// place) and a secret-tier stamp (its own hidden stamp with a parent, never a page).
const leftOut = new Map();   // id -> why
const leaveOut = (r) => (isWrongMatch(r) ? `banned as a wrong Wikidata match (${r.class_ban})` : r.tier === 'secret' ? 'a secret stamp' : null);
const byQid = new Map();
for (const r of qidRows) (byQid.get(r.qid) || byQid.set(r.qid, []).get(r.qid)).push(r);
for (const [, list] of byQid) {
  const keep = list.filter((r) => !leaveOut(r));
  for (const r of list) if (leaveOut(r)) leftOut.set(r.id, leaveOut(r));
  for (const r of keep) add(r.id);
  for (let i = 1; i < keep.length; i++) union(keep[0].id, keep[i].id);
}
const nameJoined = new Set();
for (const e of nameEdges) {
  if (leaveOut(rowsById.get(e.a)) || leaveOut(rowsById.get(e.b))) continue;
  union(e.a, e.b); nameJoined.add(e.a); nameJoined.add(e.b);
}
for (const [a, b] of NAME_PAIRS) if (rowsById.has(a) && rowsById.has(b)) { union(a, b); nameJoined.add(a); nameJoined.add(b); }

const comps = new Map();
for (const id of parent.keys()) { const r = find(id); (comps.get(r) || comps.set(r, []).get(r)).push(rowsById.get(id)); }

// ───────────────────────────── Decide each group ─────────────────────────────

const aliasMap = {}, ghostMap = {}, fills = {}, needsHuman = [], skipped = [], merged = [];
const groupOfRow = new Map();

function groupKey(rows) {
  const qs = [...new Set(rows.map((r) => r.qid).filter(Boolean))].sort();
  return qs.length ? qs.join('+') : `name:${norm(rows[0].name)}`;
}
function hold(entry) { needsHuman.push(entry); }

// Rows within the distance limit of each other. Returns the core around the best-connected row.
function distanceCore(rows) {
  const limit = (a, b) => {
    const base = Math.max(5000, 2 * Math.max(stampRadius(a), stampRadius(b)));
    return AREA.has(a.category) || AREA.has(b.category) ? Math.max(base, AREA_MAX_M) : base;
  };
  const ok = (a, b) => distM(a, b) <= limit(a, b);
  if (rows.every((a) => rows.every((b) => a === b || ok(a, b)))) return { core: rows, out: [] };
  const scored = rows.map((r) => ({ r, n: rows.filter((o) => o !== r && ok(r, o)).length }))
    .sort((x, y) => (y.n - x.n) || rankCmp(x.r, y.r));
  const center = scored[0].r;
  const core = rows.filter((r) => r === center || ok(center, r));
  return { core, out: rows.filter((r) => !core.includes(r)), center };
}

function fillsFor(c, twins, restored, { composite = false } = {}) {
  const set = {};
  const best = (pred) => [...twins].sort(rankCmp).find(pred);
  // category: a specific twin category beats a generic 'landmark' / 'experience'
  if (GENERIC_CATEGORY.has(c.category) && !composite) {
    const t = best((r) => r.category && !GENERIC_CATEGORY.has(r.category));
    if (t) set.category = { value: t.category, was: c.category, from: t.id };
  }
  // place_id: only when the canonical has none and the twins agree on one
  const pids = [...new Set(twins.map((r) => r.place_id).filter(Boolean))];
  if (!c.place_id && pids.length === 1 && !composite) set.place_id = { value: pids[0], from: twins.find((r) => r.place_id === pids[0]).id };
  // long text: copied in SQL from the twin with the longest text
  for (const [col, len] of [['why_visit', 'wlen'], ['description', 'dlen']]) {
    if (!(c[len] > 0)) {
      const t = [...twins].filter((r) => r[len] > 0).sort((a, b) => b[len] - a[len] || rankCmp(a, b))[0];
      if (t) set[col] = { copy_from: t.id, chars: t[len] };
    }
  }
  // free_to_visit: 0 is also the column default; a hand-curated canonical's 0 is a decision
  if (!c.free_to_visit && prefixOf(c.id) !== 'curated') {
    const cur = twins.filter((r) => prefixOf(r.id) === 'curated');
    const pool = cur.length ? cur : twins;
    const t = pool.find((r) => r.free_to_visit === 1);
    if (t) set.free_to_visit = { value: 1, was: c.free_to_visit, from: t.id };
  }
  if (c.rating == null) { const t = best((r) => r.rating != null); if (t) set.rating = { value: t.rating, from: t.id }; }
  // popularity / is_marquee: the max
  const pop = twins.reduce((m, r) => ((r.popularity ?? -1) > (m?.popularity ?? -1) ? r : m), null);
  if (pop && (pop.popularity ?? -1) > (c.popularity ?? -1)) set.popularity = { value: pop.popularity, was: c.popularity, from: pop.id };
  const marq = twins.find((r) => r.is_marquee === 1);
  if (marq && c.is_marquee !== 1) set.is_marquee = { value: 1, was: c.is_marquee, from: marq.id };
  // founder_scope: only when the canonical has none and every twin that has one agrees
  const fs_ = [...new Set(twins.map((r) => r.founder_scope).filter(Boolean))];
  if (!c.founder_scope && fs_.length === 1) set.founder_scope = { value: fs_[0], from: twins.find((r) => r.founder_scope === fs_[0]).id };
  // un-hide a canonical that is itself hidden as a 'duplicate'
  if (restored) {
    set.class_ban = { value: null, was: c.class_ban };
    const top = [...twins].sort((a, b) => scopeRank(b.scope) - scopeRank(a.scope))[0];
    if (top && scopeRank(top.scope) > scopeRank(c.scope)) set.scope = { value: top.scope, was: c.scope, from: top.id };
  }
  // footprint: never shrinks; takes the largest footprint set on any twin; and
  // reaches every twin's coordinates (so a GPS stamp that worked there still works)
  const after = { ...c, category: set.category?.value ?? c.category };
  const cur = stampRadius(after);
  let need = cur, why = null;
  for (const t of twins) {
    const own = Number(t.footprint_radius_m) > 0 ? Number(t.footprint_radius_m) : 0;
    const reach = Math.ceil(distM(c, t) / 10) * 10;
    if (own > need) { need = own; why = { covers: t.id, reason: 'twin footprint' }; }
    if (reach > need) { need = reach; why = { covers: t.id, reason: 'twin coordinates' }; }
  }
  if (why) {
    const far = twins.find((t) => t.id === why.covers);
    set.footprint_radius_m = { value: Math.ceil(need / 10) * 10, was: c.footprint_radius_m, effective_was: cur, ...why, twin_distance_m: Math.round(distM(c, far)) };
  }
  return set;
}

for (const [, rowsRaw] of comps) {
  const rows = [...rowsRaw].sort(rankCmp);
  const key = groupKey(rows);
  const viaName = rows.some((r) => nameJoined.has(r.id));
  if (rows.length < 2) continue;    // a qid group whose only other row was a wrong match

  if (rows.every(isOtherBan)) { skipped.push({ group: key, reason: 'every row is banned for a reason other than duplicate', rows: rows.map(rowLine) }); continue; }

  const hand = rows.map((r) => HAND[r.qid]).find(Boolean);
  if (hand?.block) {
    hold({ group: key, kind: hand.kind, blocks_merge: true, reason: hand.reason, rows: rows.map(rowLine) });
    for (const r of rows) groupOfRow.set(r.id, { key, held: true });
    continue;
  }

  const { core, out } = distanceCore(rows);
  if (core.length < 2) {
    const d = Math.max(...rows.flatMap((a) => rows.map((b) => distM(a, b))));
    const places = [...new Set(rows.map((r) => [r.city, r.country].filter(Boolean).join(', ')))].join(' / ');
    hold({ group: key, kind: 'too-far-apart', blocks_merge: true,
      reason: `Rows are ${km(d)} apart (${places}): either a different place tagged with this Wikidata id, or the same place with wrong coordinates.`,
      suggest: 'Different place: clear the qid on the stray row. Same place: fix its coordinates, then re-run.',
      rows: rows.map(rowLine) });
    for (const r of rows) groupOfRow.set(r.id, { key, held: true });
    continue;
  }
  const c = [...core].sort(rankCmp)[0];
  for (const r of out) {
    hold({ group: key, kind: 'too-far-apart', blocks_merge: false,
      reason: `Left out of the merge: ${km(distM(c, r))} from the survivor ${c.id} (${[r.city, r.country].filter(Boolean).join(', ')}). The rest of the group merges.`,
      suggest: 'Different place: clear its qid. Same place: fix its coordinates, then re-run.',
      rows: [rowLine(r)] });
    groupOfRow.set(r.id, { key, held: true });
  }

  const restored = !isLive(c);
  if (restored && core.some(isOtherBan)) {
    hold({ group: key, kind: 'ban-conflict', blocks_merge: true,
      reason: `No row is visible today, and keeping one would override a class ban (${[...new Set(core.filter(isOtherBan).map((r) => r.class_ban))].join(', ')})${core.some((r) => r.founder_scope) ? ' that the founder\'s own scope contradicts' : ''}.`,
      suggest: 'Decide whether this place is a stamp. If yes, clear the class ban on one row and re-run.',
      rows: core.map(rowLine) });
    for (const r of core) groupOfRow.set(r.id, { key, held: true });
    continue;
  }

  const twins = core.filter((r) => r !== c);
  const fsVals = [...new Set(core.map((r) => r.founder_scope).filter(Boolean))];
  if (fsVals.length > 1) {
    hold({ group: key, kind: 'founder-scope-conflict', blocks_merge: false,
      reason: `Founder scopes disagree (${core.filter((r) => r.founder_scope).map((r) => `${r.id}: ${r.founder_scope}`).join('; ')}). The survivor keeps ${c.founder_scope ? `its own '${c.founder_scope}'` : 'no founder scope'}.`,
      suggest: 'Pick the scope this place should have; the merge does not change it.',
      rows: core.map(rowLine) });
  }
  if (hand && !hand.block) hold({ group: key, kind: hand.kind, blocks_merge: false, reason: hand.reason, rows: core.map(rowLine) });
  // An icon named "A & B" whose twin is only A or B: merge, but the twin's owned-place link and category are not copied.
  const andNorm = (n) => norm(String(n).replace(/&/g, ' and '));
  const parts = / & /.test(c.name) ? twins.filter((t) => !/ & | and /i.test(t.name) && andNorm(t.name) !== andNorm(c.name)) : [];
  const composite = hand?.kind === 'composite' || parts.length > 0;
  if (!hand && parts.length) {
    hold({ group: key, kind: 'composite', blocks_merge: false,
      reason: `The icon '${c.name}' covers more than one place; ${parts.map((t) => `'${t.name}'`).join(', ')} is only part of it. Merged: a stamp on the part opens the icon. Split the icon later if it should be two stamps.`,
      rows: core.map(rowLine) });
  }

  const pidVals = [...new Set(twins.map((r) => r.place_id).filter(Boolean))];
  if (!c.place_id && pidVals.length > 1) {
    hold({ group: key, kind: 'place-id-conflict', blocks_merge: false,
      reason: `The survivor has no owned-place link and its twins name ${pidVals.length} different ones; none was copied.`,
      rows: core.map(rowLine) });
  }

  const set = fillsFor(c, twins, restored, { composite });
  if (set.footprint_radius_m && !AREA.has(set.category?.value ?? c.category)
      && set.footprint_radius_m.value - set.footprint_radius_m.effective_was > BIG_GROWTH_M) {
    hold({ group: key, kind: 'big-footprint', blocks_merge: false,
      reason: set.footprint_radius_m.reason === 'twin footprint'
        ? `The stamp radius would grow from ${km(set.footprint_radius_m.effective_was)} to ${km(set.footprint_radius_m.value)}, taking the footprint set on ${set.footprint_radius_m.covers}. Check that footprint fits this place.`
        : `The stamp radius would grow from ${km(set.footprint_radius_m.effective_was)} to ${km(set.footprint_radius_m.value)} to reach ${set.footprint_radius_m.covers}, ${km(set.footprint_radius_m.twin_distance_m)} away. Check that twin's coordinates.`,
      rows: core.map(rowLine) });
  }
  if (Object.keys(set).length) fills[c.id] = { group: key, name: c.name, set };
  for (const t of twins) aliasMap[t.id] = c.id;
  for (const r of core) groupOfRow.set(r.id, { key, held: false, canonical: c.id });

  const liveRows = core.filter(isLive);
  const change = liveRows.length === 0 ? 'restore' : liveRows.length > 1 ? 'collapse' : liveRows[0] === c ? 'same' : 'switch';
  merged.push({ key, c, twins, change, viaName, set, out });
}

// Different-qid name twins further than 500 m apart: flagged, never merged.
for (const f of nameFlags) {
  const a = rowsById.get(f.a), b = rowsById.get(f.b);
  hold({ group: `${a.qid}+${b.qid}`, kind: 'possible-twin', blocks_merge: false,
    reason: `Same name, different Wikidata ids, ${km(f.d)} apart: not merged.`,
    suggest: 'If they are the same place, give both rows one qid and re-run.',
    rows: [rowLine(a), rowLine(b)] });
}

// Ghosts: map a deleted id through its Q-number, else through the stamp-art place
// that names it (founder-reviewed art-matches.json) when that place's other rows
// all forward to one survivor.
const ghostHeld = [], ghostVia = {};
const artPlacesById = new Map();
for (const p of artMatches.places) for (const x of [...(p.same || []), p.promote, p.insert?.id].filter(Boolean)) (artPlacesById.get(x) || artPlacesById.set(x, []).get(x)).push(p);
const swById = new Map(swLive.map((r) => [r.id, r]));
const canonOf = (x) => {
  if (aliasMap[x]) return aliasMap[x];
  const g = groupOfRow.get(x);
  if (g) return g.held ? null : g.canonical;
  if (swById.has(x)) return x;
  const r = rowsById.get(x);
  return r && isLive(r) ? x : null;
};
const nameOf = (x) => rowsById.get(x)?.name ?? swById.get(x)?.name ?? '';
function resolveByArt(id) {
  const places = (artPlacesById.get(id) || []).filter((p) => idQ(id) || norm(p.name).split(' ').every((t) => id.toLowerCase().includes(t)));
  for (const p of places) {
    const all = new Set(), named = new Set();
    for (const x of [...(p.same || []), p.promote, p.insert?.id]) {
      if (!x || x === id) continue;
      const c = canonOf(x);
      if (!c) continue;
      all.add(c);
      if (norm(nameOf(x)) === norm(p.name) || norm(nameOf(c)) === norm(p.name)) named.add(c);
    }
    if (all.size === 1) return { canon: [...all][0], via: `art place #${p.n} ${p.name}` };
    if (named.size === 1) return { canon: [...named][0], via: `art place #${p.n} ${p.name}, by name` };
  }
  return null;
}
for (const id of ghosts) {
  const q = idQ(id);
  const where = [...refs.get(id)].join('; ');
  const rowsQ = q ? [...rowsById.values()].filter((r) => r.qid === q) : [];
  if (!q || !rowsQ.length) {
    const art = resolveByArt(id);
    if (art) { ghostMap[id] = art.canon; ghostVia[id] = art.via; continue; }
    ghostHeld.push(id);
    hold({ group: q || id, kind: 'ghost', blocks_merge: true,
      reason: q ? `${id} was deleted and no row carries ${q} any more. Named by: ${where}.`
        : `${id} was deleted; its id has no Wikidata number to follow, and its art place doesn't point at one survivor. Named by: ${where}.`,
      suggest: 'Point it at the right row by hand (or re-insert it), so stamps and art that use it keep working.',
      rows: [id] });
    continue;
  }
  const g = rowsQ.map((r) => groupOfRow.get(r.id)).find(Boolean);
  if (g && !g.held) { ghostMap[id] = g.canonical; ghostVia[id] = `Wikidata id ${q}`; continue; }
  if (g?.held) {
    ghostHeld.push(id);
    hold({ group: g.key, kind: 'ghost', blocks_merge: true, reason: `${id} was deleted; its Wikidata id ${q} belongs to a group held above. Named by: ${where}.`, rows: [id] });
    continue;
  }
  // A single surviving row for that qid (not in any group).
  const r = [...rowsQ].sort(rankCmp)[0];
  if (isOtherBan(r)) {
    ghostHeld.push(id);
    hold({ group: q, kind: 'ghost', blocks_merge: true, reason: `${id} was deleted; the only row left for ${q} is banned (${r.class_ban}). Named by: ${where}.`, rows: [id, rowLine(r)] });
    continue;
  }
  ghostMap[id] = r.id; ghostVia[id] = `Wikidata id ${q}`;
  if (isDupBan(r) && !groupOfRow.has(r.id)) {
    const set = fillsFor(r, [], true);
    fills[r.id] = { group: q, name: r.name, set: { ...(fills[r.id]?.set || {}), ...set } };
    merged.push({ key: q, c: r, twins: [], change: 'restore', viaName: false, set, out: [], ghostOnly: true });
  }
  groupOfRow.set(r.id, { key: q, held: false, canonical: r.id });
}

for (const [a, b, why] of CHECK_PAIRS) {
  if (aliasMap[a] === b || aliasMap[b] === a || (aliasMap[a] && aliasMap[a] === aliasMap[b])) continue;
  hold({ group: `${rowsById.get(a)?.qid || a}+${rowsById.get(b)?.qid || b}`, kind: 'check-pair', blocks_merge: false, reason: why,
    rows: [a, b].map((x) => (rowsById.get(x) ? rowLine(rowsById.get(x)) : x)) });
}

// 'duplicate' rows that still have no live survivor after all of the above.
const orphanLeft = dupRows.filter((r) => !aliasMap[r.id] && !groupOfRow.get(r.id));
for (const r of orphanLeft) {
  const twinOut = r.qid ? qidRows.filter((x) => x.qid === r.qid && x.id !== r.id && leftOut.has(x.id)) : [];
  hold({ group: r.qid || `name:${norm(r.name)}`, kind: 'orphan-duplicate', blocks_merge: false,
    reason: `Hidden as a duplicate, but no twin survives (${twinOut.length ? `its only twin, ${twinOut.map((x) => x.id).join(', ')}, is ${twinOut.map((x) => leftOut.get(x.id)).join(', ')} and is never merged` : 'no row shares its qid, and no visible stamp-worthy row has its name within 1.5 km'})${isStampworthy(r) ? `; its scope says ${effScope(r)}` : ''}.`,
    suggest: isStampworthy(r) ? 'Probably un-hide it (clear class_ban).' : 'Un-hide it, or leave it hidden.',
    rows: [rowLine(r)] });
}

// ───────────────────────────── Write data files ─────────────────────────────

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'alias-map.json'), `${JSON.stringify(sortObj(aliasMap), null, 1)}\n`);
fs.writeFileSync(path.join(DATA, 'ghost-aliases.json'), `${JSON.stringify(sortObj(ghostMap), null, 1)}\n`);
fs.writeFileSync(path.join(DATA, 'canonical-fills.json'), `${JSON.stringify(sortObj(fills), null, 1)}\n`);
const KIND_ORDER = ['ban-conflict', 'mistag', 'too-far-apart', 'sub-place', 'composite', 'two-sides', 'two-sites', 'ghost', 'check-pair', 'founder-scope-conflict', 'class-review', 'place-id-conflict', 'big-footprint', 'possible-twin', 'orphan-duplicate'];
needsHuman.sort((a, b) => (b.blocks_merge - a.blocks_merge) || (KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)) || (a.group < b.group ? -1 : 1));
fs.writeFileSync(path.join(DATA, 'needs-human.json'), `${JSON.stringify(needsHuman, null, 1)}\n`);

// ───────────────────────────── Supabase preflight (read-only) ─────────────────────────────

const pairs = [
  ...Object.entries(aliasMap).map(([a, c]) => [a, c, 'row']),
  ...Object.entries(ghostMap).map(([a, c]) => [a, c, 'ghost']),
].sort(([a], [b]) => (a < b ? -1 : 1));
const valuesCte = chunk(pairs, 400).map((part, i) =>
  `  ${i ? 'UNION ALL ' : ''}SELECT * FROM (VALUES\n${part.map(([a, c, s]) => `    (${sqlStr(a)}, ${sqlStr(c)}, '${s}')`).join(',\n')}\n  ) AS v${i}(alias_id, canon_id, src)`).join('\n');
const preflight = `-- Stamp merge — Supabase PREFLIGHT. READ-ONLY: one SELECT, no writes.
-- Generated by scripts/stamp-merge/build-map.mjs on ${TODAY}; re-run that script, do not edit by hand.
-- ${Object.keys(aliasMap).length} alias rows + ${Object.keys(ghostMap).length} deleted ("ghost") ids -> their surviving canonical id.
--
-- Run (founder, any time; changes nothing):
--   npx supabase db query --linked -f scripts/stamp-merge/preflight-supabase.sql
--
-- Each output row is (section, detail, n):
--   stamps_on_alias          stamps whose entity_id is an alias, by kind / entity_type
--   stamp_users_on_alias     distinct travellers holding at least one alias stamp
--   photos_on_alias_stamps   memory/proof photos attached to those stamps
--   stamps_on_canonical      stamps already on a canonical id (context)
--   collisions               (user, kind, canonical) with 2+ stamps -> must be folded into one stamp
--   collision_stamps         stamps inside those collisions
--   collision_photos         photos on those stamps (must be moved, never deleted)
--   tags_on_alias            buddy tags carrying an alias id, by status
--   guestbook_on_alias       guestbook notes keyed by a raw alias id, by entity_type
--   guestbook_visits_on_alias / guestbook_visit_collisions
--   owner_notes_on_alias     private owner notes keyed by a raw alias id, by status
-- A section that is split by kind/status prints no row when it has nothing to count (zero).
-- Tables and columns checked against scripts/passport/01_schema.sql, scripts/guestbook/01_schema.sql,
-- supabase/migrations/20260930100000_social_p1.sql and 20261005100000_owner_notes.sql.
WITH m AS (
${valuesCte}
),
held AS (
  SELECT s.id, s.user_id, s.kind, coalesce(m.canon_id, s.entity_id) AS canon
  FROM api.passport_stamps s
  LEFT JOIN m ON m.alias_id = s.entity_id
  WHERE s.entity_id IN (SELECT alias_id FROM m UNION SELECT canon_id FROM m)
),
coll AS (
  SELECT user_id, kind, canon FROM held GROUP BY user_id, kind, canon HAVING count(*) > 1
),
coll_stamps AS (
  SELECT h.id FROM held h JOIN coll c USING (user_id, kind, canon)
),
visits AS (
  SELECT v.user_id, coalesce(m.canon_id, v.entity_id) AS canon
  FROM api.guestbook_visits v
  LEFT JOIN m ON m.alias_id = v.entity_id
  WHERE v.entity_id IN (SELECT alias_id FROM m UNION SELECT canon_id FROM m)
)
SELECT 'stamps_on_alias' AS section, coalesce(s.kind, '?') || ' / ' || coalesce(s.entity_type, '?') || ' / ' || m.src AS detail, count(*) AS n
  FROM api.passport_stamps s JOIN m ON m.alias_id = s.entity_id GROUP BY 2
UNION ALL
SELECT 'stamp_users_on_alias', 'distinct users', count(DISTINCT s.user_id)
  FROM api.passport_stamps s JOIN m ON m.alias_id = s.entity_id
UNION ALL
SELECT 'photos_on_alias_stamps', 'passport_stamp_photos', count(*)
  FROM api.passport_stamp_photos p JOIN api.passport_stamps s ON s.id = p.stamp_id JOIN m ON m.alias_id = s.entity_id
UNION ALL
SELECT 'stamps_on_canonical', 'already on the survivor id', count(*)
  FROM api.passport_stamps s WHERE s.entity_id IN (SELECT canon_id FROM m)
UNION ALL
SELECT 'collisions', 'user + kind + canonical held 2+ times', count(*) FROM coll
UNION ALL
SELECT 'collision_stamps', 'stamps inside collisions', count(*) FROM coll_stamps
UNION ALL
SELECT 'collision_photos', 'photos on colliding stamps', count(*)
  FROM api.passport_stamp_photos p WHERE p.stamp_id IN (SELECT id FROM coll_stamps)
UNION ALL
SELECT 'tags_on_alias', coalesce(t.status, '?'), count(*)
  FROM api.passport_tags t JOIN m ON m.alias_id = t.entity_id GROUP BY 2
UNION ALL
SELECT 'guestbook_on_alias', coalesce(g.entity_type, '?') || CASE WHEN g.deleted_at IS NOT NULL OR g.hidden THEN ' (deleted/hidden)' ELSE '' END, count(*)
  FROM api.guestbook_entries g JOIN m ON m.alias_id = g.entity_id GROUP BY 2
UNION ALL
SELECT 'guestbook_visits_on_alias', 'rows', count(*)
  FROM api.guestbook_visits v JOIN m ON m.alias_id = v.entity_id
UNION ALL
SELECT 'guestbook_visit_collisions', 'user + canonical held 2+ times', count(*)
  FROM (SELECT user_id, canon FROM visits GROUP BY user_id, canon HAVING count(*) > 1) x
UNION ALL
SELECT 'owner_notes_on_alias', coalesce(o.status, '?'), count(*)
  FROM api.owner_notes o JOIN m ON m.alias_id = o.entity_id GROUP BY 2
ORDER BY 1, 2;
`;
fs.writeFileSync(path.join(HERE, 'preflight-supabase.sql'), preflight);
fs.writeFileSync(path.join(HERE, 'preflight-supabase-held-ids.sql'), `-- Stamp merge — every D1-style place id held in stamps, tags, guestbooks and owner notes. READ-ONLY.
-- Use: compare this list with D1 to find stored ids that no longer exist there (more "ghosts").
--   npx supabase db query --linked -f scripts/stamp-merge/preflight-supabase-held-ids.sql
SELECT src, entity_id, count(*) AS n FROM (
  SELECT 'stamp' AS src, entity_id FROM api.passport_stamps WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
  UNION ALL SELECT 'tag', entity_id FROM api.passport_tags WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
  UNION ALL SELECT 'guestbook', entity_id FROM api.guestbook_entries WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
  UNION ALL SELECT 'owner_note', entity_id FROM api.owner_notes WHERE entity_id ~ '^(icon|curated|wikidata|wv|auto|secret):'
) x GROUP BY src, entity_id ORDER BY n DESC, entity_id;
`);

// ───────────────────────────── REPORT.md ─────────────────────────────

const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const qidGroupCount = byQid.size;
const groupsMerged = merged.filter((g) => !g.ghostOnly);
const prefixCombo = (rows) => {
  const c = count(rows, (r) => prefixOf(r.id));
  return Object.keys(c).sort((a, b) => (PREFIX_RANK[a] ?? 9) - (PREFIX_RANK[b] ?? 9)).map((p) => (c[p] > 1 ? `${p}×${c[p]}` : p)).join(' + ');
};
const combos = Object.entries(count(groupsMerged, (g) => prefixCombo([g.c, ...g.twins]))).sort((a, b) => b[1] - a[1]);
const changes = count(merged, (g) => g.change);
const fillCounts = {};
for (const { set } of Object.values(fills)) for (const k of Object.keys(set)) fillCounts[k] = (fillCounts[k] || 0) + 1;
const blocking = needsHuman.filter((h) => h.blocks_merge), flagged = needsHuman.filter((h) => !h.blocks_merge);
const kindCounts = (list) => Object.entries(count(list, (h) => h.kind)).sort((a, b) => KIND_ORDER.indexOf(a[0]) - KIND_ORDER.indexOf(b[0]));
const aliasSet = new Set(Object.keys(aliasMap));
const filmOnAlias = filmIds.filter((id) => aliasSet.has(id) || ghostMap[id]);
const parentOnAlias = parentRefs.filter((r) => aliasSet.has(r.parent_id) || ghostMap[r.parent_id]);
const artOnAlias = [...refs.entries()].filter(([id, w]) => (aliasSet.has(id) || ghostMap[id]) && [...w].some((x) => x.startsWith('src/'))).map(([id]) => id);
const matchesOnAlias = [...refs.entries()].filter(([id, w]) => (aliasSet.has(id) || ghostMap[id]) && [...w].some((x) => x.startsWith('art-matches'))).map(([id]) => id);
const aliasFounder = Object.keys(aliasMap).filter((id) => rowsById.get(id)?.founder_scope);
const aliasOtherBan = Object.keys(aliasMap).filter((id) => isOtherBan(rowsById.get(id)));
const aliasLive = Object.keys(aliasMap).filter((id) => isLive(rowsById.get(id)));
const scopeHigherTwin = groupsMerged.filter((g) => g.twins.some((t) => scopeRank(effScope(t)) > scopeRank(g.set.founder_scope?.value || effScope(g.c))));
const namesDiffer = groupsMerged.filter((g) => g.twins.some((t) => {
  const a = norm(g.c.name), b = norm(t.name);
  return a && b && a !== b && !a.includes(b) && !b.includes(a);
}));
const fmtFill = (k, v) => {
  if (k === 'why_visit' || k === 'description') return `${k} ← ${v.copy_from} (${v.chars} chars)`;
  if (k === 'footprint_radius_m') return `radius ${km(v.effective_was)} → ${km(v.value)}`;
  if (k === 'class_ban') return 'un-hide';
  if (k === 'place_id') return 'place link';
  return `${k} ${v.was ?? '∅'} → ${v.value}`;
};
const esc = (s) => String(s).replace(/\|/g, '\\|');
const top = [...merged].sort((a, b) => (b.c.popularity ?? 0) - (a.c.popularity ?? 0) || rankCmp(a.c, b.c)).slice(0, 30);
const CHANGE_WORDS = { same: 'same row stays', collapse: '2+ visible → 1', restore: 'un-hidden', switch: 'different row' };

const md = [];
md.push(`# Stamp merge — the map`, '');
md.push(`Built ${TODAY} by \`node scripts/stamp-merge/build-map.mjs\` from a read-only look at the live D1 \`attractions\` table. Nothing was changed anywhere: this is the plan the merge will follow once Apple approves the app. Re-run the script any time; it rebuilds every file here from the live data.`, '');
md.push(`**Words used here.** A *group* is two or more rows in our places table that are really one place. The *canonical* (or survivor) is the one row we keep showing. An *alias* is a twin that gets hidden and forwards to the canonical, so every stamp, guestbook note, photo and shared link that names it keeps working. A *ghost* is an id that was deleted from the table but that art, film scenes or stamps still name. A *qid* is the place's Wikidata number (for example Q243 is the Eiffel Tower).`, '');
md.push(`## Headline`, '');
md.push(`| | |`, `|---|---|`);
md.push(`| Wikidata ids shared by 2+ rows | ${qidGroupCount} (${qidRows.length} rows) |`);
md.push(`| Extra twins found by name (same name, within 1.5 km) | ${nameEdges.length} pairs |`);
md.push(`| **Groups merged** | **${groupsMerged.length}** |`);
md.push(`| **Aliases** (rows that will forward to a survivor) | **${Object.keys(aliasMap).length}** |`);
md.push(`| Ghost ids that will forward too | ${Object.keys(ghostMap).length} |`);
md.push(`| **Held for a person** (not merged) | **${blocking.length}** |`);
md.push(`| Merged, but flagged to confirm | ${flagged.length} |`);
md.push(`| Skipped (every row banned for another reason) | ${skipped.length} |`);
for (const [why, n] of Object.entries(count([...leftOut.values()], (w) => (w.startsWith('banned') ? 'banned as a wrong Wikidata match' : w)))) md.push(`| Rows never merged: ${why} | ${n} |`);
md.push('');
md.push(`## What travellers will see change`, '');
md.push(`Compared with the row that is visible today:`, '');
md.push(`- **${changes.same || 0}** groups: the visible row stays; its hidden twins start forwarding to it.`);
md.push(`- **${changes.collapse || 0}** groups: two or more rows are visible today (the same place listed twice); one stays.`);
md.push(`- **${changes.restore || 0}** places are hidden completely today and come back (one row is un-hidden)${merged.filter((g) => g.ghostOnly).length ? `, ${merged.filter((g) => g.ghostOnly).length} of them single rows whose twin was deleted` : ''}.`);
md.push(`- **${changes.switch || 0}** groups: a different row takes over from the visible one.`, '');
md.push(`So **${(changes.collapse || 0) + (changes.restore || 0) + (changes.switch || 0)}** survivors differ from what is visible today; the other ${changes.same || 0} look exactly the same.`, '');
md.push(`## Groups by id type`, '');
md.push(`| Rows in the group | Groups |`, `|---|---|`);
for (const [k, v] of combos) md.push(`| ${k} | ${v} |`);
md.push('', `Survivors by id type: ${Object.entries(count(groupsMerged, (g) => prefixOf(g.c.id))).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
md.push(`## What survivors inherit from their twins`, '');
md.push(`Only empty fields are filled; founder choices are never overwritten.`, '');
md.push(`| Field | Survivors | Rule |`, `|---|---|---|`);
const RULES = {
  place_id: 'the twins\' link to our own places database, when the survivor has none and the twins agree',
  why_visit: '"Why visit" text, copied from the twin with the longest one',
  description: 'description, same way',
  free_to_visit: 'set to free when a twin says free (never on a hand-curated survivor)',
  rating: 'Google rating from a twin',
  footprint_radius_m: 'stamp radius grows so anyone standing where a twin could be stamped still can',
  popularity: 'the highest of the group',
  is_marquee: 'marquee if any twin is',
  category: 'a specific category (museum, palace…) replaces "landmark" / "experience"',
  founder_scope: 'the founder\'s scope from a twin, only when the survivor has none and the twins agree',
  class_ban: 'un-hide a survivor that is hidden today',
  scope: 'an un-hidden survivor takes its group\'s highest scope',
};
for (const [k, v] of Object.entries(fillCounts).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${v} | ${RULES[k] || ''} |`);
md.push('', `${scopeHigherTwin.length} survivors keep a lower scope than one of their hidden twins (the twin's comes from automatic scoring, not the founder). The merge keeps the survivor's own scope; this is noted, not changed.`, '');
md.push(`## The 30 most famous groups`, '');
md.push(`| Survivor | Name | Forwards from | Today | Inherits |`, `|---|---|---|---|---|`);
for (const g of top) {
  const from = [...g.twins.map((t) => `\`${t.id}\``), ...Object.entries(ghostMap).filter(([, c]) => c === g.c.id).map(([a]) => `\`${a}\` (deleted)`)].join(', ');
  md.push(`| \`${g.c.id}\` | ${esc(g.c.name)} | ${from} | ${CHANGE_WORDS[g.change]} | ${esc(Object.entries(g.set).map(([k, v]) => fmtFill(k, v)).join('; ') || '—')} |`);
}
md.push('', `## Held for a person (${blocking.length})`, '');
md.push(`These groups are **not** merged; they stay exactly as they are today. Full rows and suggestions are in \`data/needs-human.json\`.`, '');
for (const [k, n] of kindCounts(blocking)) {
  const KIND_WORDS = {
    'ban-conflict': 'Ban conflict: un-hiding would override a class rule', mistag: 'Two different places under one Wikidata id',
    'too-far-apart': 'Rows too far apart to be one place', 'sub-place': 'A part listed under its parent\'s id',
    composite: 'An icon that covers two places', 'two-sides': 'Two real sides', 'two-sites': 'Two real sites',
    ghost: 'Deleted ids with nothing to forward to',
  };
  md.push(`**${KIND_WORDS[k] || k} (${n})**`, '');
  for (const h of blocking.filter((x) => x.kind === k)) md.push(`- \`${h.group}\` — ${esc(h.reason)}`);
  md.push('');
}
md.push(`## Merged, but please confirm (${flagged.length})`, '');
for (const [k, n] of kindCounts(flagged)) {
  const KIND_WORDS = {
    'founder-scope-conflict': 'Founder scopes disagree inside the group', 'class-review': 'Twin under class review',
    'place-id-conflict': 'Twins link to different owned places', 'big-footprint': 'Stamp radius would grow by more than 1 km',
    'too-far-apart': 'One row left out (too far); the rest merged', 'possible-twin': 'Same name, different Wikidata ids, 500 m–1.5 km apart (not merged)',
    'orphan-duplicate': 'Hidden as a duplicate, but no twin survives (not merged)',
    composite: 'An icon that covers two places; its twin is one of them', 'check-pair': 'Possibly one place, but names and ids differ (not merged)',
  };
  md.push(`**${KIND_WORDS[k] || k} (${n})**`, '');
  for (const h of flagged.filter((x) => x.kind === k)) md.push(`- \`${h.group}\` — ${esc(h.reason)}${['orphan-duplicate', 'possible-twin', 'too-far-apart'].includes(h.kind) ? ` ${esc(h.rows.join('; '))}` : ''}`);
  md.push('');
}
md.push(`## Merged although the names differ (${namesDiffer.length})`, '');
md.push(`Mostly translations and Wikivoyage titles. Worth a glance; anything wrong can be added to \`HAND\` in the script and the map re-run.`, '');
for (const g of namesDiffer) md.push(`- ${esc(g.c.name)} ← ${g.twins.map((t) => esc(t.name)).join(', ')} (\`${g.key}\`)`);
md.push('', `## Twins found by name, not by Wikidata id (${groupsMerged.filter((g) => g.viaName).length} groups)`, '');
for (const g of groupsMerged.filter((x) => x.viaName)) md.push(`- \`${g.c.id}\` ${esc(g.c.name)} ← ${g.twins.map((t) => `\`${t.id}\``).join(', ')}`);
md.push('', `## Deleted ids that will forward (${Object.keys(ghostMap).length})`, '');
md.push(`These ids were deleted from the table (most on 2026-10-06), but stamp art, film scenes or secret stamps still name them, and travellers' stamps may too. Each forwards to the survivor below. Another option, for the famous ones: re-create the deleted \`icon:\` id as the survivor itself, since art already uses it; decide after the Supabase count.`, '');
md.push(`| Deleted id | Forwards to | How it was matched |`, `|---|---|---|`);
for (const [a, c] of Object.entries(sortObj(ghostMap))) md.push(`| \`${a}\` | \`${c}\` ${esc(nameOf(c))} | ${esc(ghostVia[a] || '')} |`);
md.push('', `## Not merged by these rules: the Getty double`, '');
md.push(`Getty Center (\`curated:united-states-los-angeles-getty-center\`) and J. Paul Getty Museum (\`icon:Q731126\`) are both visible about 100 m apart, but their names and Wikidata ids differ, so the automatic rules (same Wikidata id, or the same name within 1.5 km) do not join them. Only the Getty Center's own hidden twin (\`wikidata:Q29247\`) is in the map. Joining the two needs one confirmed line in \`NAME_PAIRS\` in the script (it is listed under "please confirm").`);
md.push('', `## What else the apply step must move`, '');
md.push(`- **Stamp art**: the app's art index (\`src/lib/stampArtIndex.js\`) names ${artOnAlias.length} alias or ghost ids${artOnAlias.length ? ` (${artOnAlias.map((x) => `\`${x}\``).join(', ')})` : ''}, and the art review (\`scripts/stamp-art/art-matches.json\`) names ${matchesOnAlias.length}. Keep them until stored stamps no longer use them, and make sure each survivor id gets the same art when the index is rebuilt.`);
md.push(`- **Film scenes**: ${filmOnAlias.length} \`film_scenes.attraction_id\` values are aliases or ghosts${filmOnAlias.length ? ` (${filmOnAlias.map((x) => `\`${x}\``).join(', ')})` : ''}.`);
md.push(`- **Secret stamps**: ${parentOnAlias.length} \`parent_id\` values point at aliases or ghosts${parentOnAlias.length ? ` (${parentOnAlias.map((r) => `\`${r.id}\` → \`${r.parent_id}\``).join(', ')})` : ''}.`);
md.push(`- **Aliases that are visible today**: ${aliasLive.length} (they disappear from browse when merged). **Aliases with a founder scope**: ${aliasFounder.length} (the survivor takes it only when it has none and the twins agree; disagreements are listed above). **Aliases banned for another reason**: ${aliasOtherBan.length} (${aliasOtherBan.map((id) => `\`${id}\``).join(', ') || 'none'}).`);
md.push(`- **Ghosts with nothing to forward to**: ${ghostHeld.length} (listed under "Held").`);
const dupNoCanon = dupRows.filter((r) => !aliasMap[r.id] && !(groupOfRow.get(r.id) && !groupOfRow.get(r.id).held && groupOfRow.get(r.id).canonical === r.id));
md.push(`- **Rows hidden as "duplicate" that still won't forward anywhere after this map**: ${dupNoCanon.length} of ${dupRows.length} (held groups, wrong matches and orphans above).`);
md.push('', `## Before the merge runs`, '');
md.push(`1. The worker learns to follow an old id to its survivor everywhere it looks a place up, saves a stamp, shows a guestbook or counts a city set. That ships first, after Apple approval.`);
md.push(`2. Founder runs the read-only Supabase count: \`npx supabase db query --linked -f scripts/stamp-merge/preflight-supabase.sql\`. It says how many stamps, photos, tags, guestbook notes and owner notes sit on alias ids, and how many travellers hold both twins (those stamps get folded into one, photos moved, never deleted).`);
md.push(`3. Then the D1 data step from \`data/alias-map.json\` + \`data/canonical-fills.json\` (aliases stay as hidden rows that point at their survivor; nothing is deleted).`);
md.push('');
fs.writeFileSync(path.join(HERE, 'REPORT.md'), md.join('\n'));

// ───────────────────────────── Console summary ─────────────────────────────
if (process.argv.includes('--dump')) {
  for (const g of merged.filter((x) => x.change !== 'same')) console.error(`${g.change}\t${g.key}\t${g.c.id} "${g.c.name}" <= ${g.twins.map((t) => `${t.id} "${t.name}" [${t.class_ban || 'live'}] ${km(distM(g.c, t))}`).join(' ; ')}`);
}
console.log(JSON.stringify({
  qid_groups: qidGroupCount, name_twin_pairs: nameEdges.length, groups_merged: groupsMerged.length,
  aliases: Object.keys(aliasMap).length, ghost_aliases: Object.keys(ghostMap).length,
  held_blocking: blocking.length, flagged_nonblocking: flagged.length, skipped: skipped.length,
  changes, needs_human_by_kind: Object.fromEntries(kindCounts(needsHuman)),
}, null, 1));
