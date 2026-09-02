#!/usr/bin/env node
// score-fame.mjs — grade every attraction row against the stamp-worthiness bar.
//
//   node score-fame.mjs ROWS_JSON OUT_SQL          (rows: wrangler d1 export, see below)
//
// The bar (calibrated 2026-09-01 on 58 founder-labeled places; binary
// stamp/no-stamp 58/58, zero locals through; two adversarial passes):
//
//   1. CLASS GATE first — fame cannot rescue a non-destination. Hard bans
//      (airport, road, prison, corporate HQ, hospital, military base, power
//      station) → never a stamp; review classes (cemetery, university,
//      school, neighborhood/district) → 'local' until the founder promotes
//      (Père Lachaise and Montmartre are real; Skid Row and Harvard Yard as
//      auto-stamps are not). An explicit tourist-attraction/monument/park
//      typing (KEEP) beats a review class but NEVER a hard ban.
//   2. fameScope(sitelinks_total, pv, heritage):
//        world    ≥ 70 sitelinks
//        national ≥ 32, or heritage && ≥ 7
//        regional ≥ 7, or pv ≥ 2000/mo
//        else local — browse only, no stamp.
//
// QID-KEYED, not English-title-keyed (attack finding: Ashikaga Flower Park has
// no enwiki article and measured 0/0 by title; by QID it has 5 sitelinks).
// Identity: wbsearchentities by name, then P625 must land within MAX_KM of the
// row (kills the Central Park (Santa Clarita) → Manhattan collision). Rows
// with no confident QID score sitelinks 0 → local, which is honest.
import fs from "node:fs";
const [ROWS_JSON, OUT_SQL] = process.argv.slice(2);
if (!ROWS_JSON || !OUT_SQL) { console.error("usage: node score-fame.mjs rows.json out.sql"); process.exit(1); }
const UA = "GlobeSkimmersStampBar/1.0 (fame scoring; contact in repo)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_KM = 30;

const BAN = {   // root qid -> reason
  Q1248784: "airport", Q34442: "road", Q46622: "controlled-access highway",
  Q40357: "prison", Q7540126: "corporate headquarters", Q16917: "hospital",
  Q245016: "military base", Q159719: "power station",
};
const REVIEW = { Q39614: "cemetery", Q3918: "university", Q3914: "school", Q123705: "neighborhood" };
const KEEP = new Set(["Q570116", "Q4989906", "Q839954", "Q33506", "Q22698", "Q46169", "Q2416723", "Q43501"]); // attraction, monument, archaeological, museum, park, national park, theme park, zoo

const km = (a, b, c, d) => { const R = 6371, dLa = (c - a) * Math.PI / 180, dLo = (d - b) * Math.PI / 180; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLo / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };
// Wikidata/Wikipedia rate-limit HARD once warmed up (measured: the first run's
// signal batches 429'd and everything defaulted to sitelinks 0 → 'local').
// Honor Retry-After, back off exponentially, and only then give up.
async function api(url) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null);
    if (r && r.ok) return r.json();
    const status = r ? r.status : "network";
    if (r && r.status !== 429 && r.status < 500) throw new Error(`${status}`);
    const ra = r ? parseInt(r.headers.get("retry-after") || "0", 10) : 0;
    await sleep(Math.max(ra * 1000, 2000 * 2 ** attempt));
  }
  throw new Error("gave up after retries");
}

const rows = JSON.parse(fs.readFileSync(ROWS_JSON, "utf8"));
console.error(`${rows.length} rows to score`);
// Resumable caches next to the output — a rate-limited run resumes, not restarts.
const CACHE_DIR = OUT_SQL.replace(/[^\/]+$/, "");
const QID_CACHE = CACHE_DIR + "qid-cache.jsonl", SIG_CACHE = CACHE_DIR + "sig-cache.jsonl";
const qidCache = new Map(), sigCache = new Map();
for (const [file, map] of [[QID_CACHE, qidCache], [SIG_CACHE, sigCache]]) {
  if (fs.existsSync(file)) for (const l of fs.readFileSync(file, "utf8").split("\n")) { if (!l) continue; try { const j = JSON.parse(l); map.set(j.k, j.v); } catch { /* skip */ } }
}
console.error(`caches: ${qidCache.size} qids, ${sigCache.size} signals`);
const qidOut = fs.createWriteStream(QID_CACHE, { flags: "a" }), sigOut = fs.createWriteStream(SIG_CACHE, { flags: "a" });

// ── 1. QID per row: wikidata:<qid> ids are free; else search + coordinate check ──
const ent = new Map();  // rowId -> qid
for (const r of rows) {
  const m = /^wikidata:(Q\d+)$/.exec(r.id || "");
  if (m) { ent.set(r.id, m[1]); continue; }
  if (r.qid) { ent.set(r.id, r.qid); continue; }
}
for (const r of rows) if (!ent.has(r.id) && qidCache.has(r.id)) { const v = qidCache.get(r.id); if (v) ent.set(r.id, v); }
const need = rows.filter((r) => !ent.has(r.id) && !qidCache.has(r.id));
console.error(`searching QIDs for ${need.length} rows (coordinate-verified)…`);
let done = 0;
for (const r of need) {
  // A genuine no-match is cached (honest: sitelinks 0 → local). A lookup that
  // DIED on rate limits must NOT be cached — the resume run retries it.
  let transient = false;
  try {
    const j = await api(`https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&type=item&limit=5&format=json&search=${encodeURIComponent(r.name)}`);
    const cands = (j.search || []).map((x) => x.id);
    if (cands.length) {
      const e = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${cands.join("|")}`);
      for (const c of cands) {
        const p = e.entities?.[c]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
        if (p && Number.isFinite(r.lat) && km(r.lat, r.lng, p.latitude, p.longitude) <= MAX_KM) { ent.set(r.id, c); break; }
      }
    }
  } catch (e) { transient = /gave up|429|^5|network/.test(String(e && e.message)); }
  if (ent.has(r.id) || !transient) qidOut.write(JSON.stringify({ k: r.id, v: ent.get(r.id) || null }) + "\n");
  if (++done % 100 === 0) console.error(`  …${done}/${need.length}`);
  await sleep(300);
}
console.error(`QIDs resolved: ${ent.size}/${rows.length}`);
// Most rows here are neighborhood spots with NO Wikidata item — low resolution is
// EXPECTED. The coverage guard below protects the signal stage, where absence
// would corrupt scoring; here absence is itself the signal.

// ── 2. entity signals: sitelinks, P31, P1435 ──
const allQids = [...new Set(ent.values())];
const sig = new Map();
for (const q of allQids) if (sigCache.has(q)) sig.set(q, sigCache.get(q));
const qids = allQids.filter((q) => !sig.has(q));
console.error(`signals: ${sig.size} cached, ${qids.length} to fetch`);
for (let i = 0; i < qids.length; i += 50) {
  const batch = qids.slice(i, i + 50);
  try {
    const j = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks|claims&format=json&ids=${batch.join("|")}`);
    for (const [id, e] of Object.entries(j.entities || {})) {
      sig.set(id, {
        sitelinks: Object.keys(e.sitelinks || {}).filter((k) => k.endsWith("wiki") && k !== "commonswiki").length,
        p31: (e.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean),
        heritage: (e.claims?.P1435 || []).length > 0,
        enTitle: e.sitelinks?.enwiki?.title || null,
      });
    }
    for (const id of batch) if (sig.has(id)) sigOut.write(JSON.stringify({ k: id, v: sig.get(id) }) + "\n");
  } catch (e2) { console.error(`  batch ${i} failed: ${e2.message}`); }
  await sleep(400);
}
// COVERAGE GUARD — a rate-limited run must fail loudly, never emit a garbage
// tally (first run: 72 regional / 0 world because signals were missing).
const covered = allQids.filter((q) => sig.has(q)).length;
if (allQids.length && covered / allQids.length < 0.9) {
  console.error(`!! HARD ERROR: signals for only ${covered}/${allQids.length} entities (<90%). Re-run to resume from cache; refusing to emit.`);
  process.exit(1);
}

// ── 3. class closure WITHOUT WDQS (it 503'd for hours): BFS up P279 via the
// plain wbgetentities API — batched, backoff-protected, memoized on disk.
const seen = [...new Set([...sig.values()].flatMap((s) => s.p31))];
const roots = [...Object.keys(BAN), ...Object.keys(REVIEW), ...KEEP];
const rootSet = new Set(roots);
const PARENTS_CACHE = CACHE_DIR + "p279-cache.jsonl";
const parentsOf = new Map();
if (fs.existsSync(PARENTS_CACHE)) for (const l of fs.readFileSync(PARENTS_CACHE, "utf8").split("\n")) { if (!l) continue; try { const j = JSON.parse(l); parentsOf.set(j.k, j.v); } catch { /* skip */ } }
const pOut = fs.createWriteStream(PARENTS_CACHE, { flags: "a" });
let frontier = [...new Set(seen)].filter((q) => !parentsOf.has(q));
let depth = 0;
while (frontier.length && depth < 10) {
  console.error(`  closure BFS depth ${depth}: ${frontier.length} classes`);
  for (let i = 0; i < frontier.length; i += 50) {
    const batch = frontier.slice(i, i + 50);
    try {
      const j = await api(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${batch.join("|")}`);
      for (const id of batch) {
        const ps = (j.entities?.[id]?.claims?.P279 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
        parentsOf.set(id, ps); pOut.write(JSON.stringify({ k: id, v: ps }) + "\n");
      }
    } catch (e2) { console.error(`  closure batch failed: ${e2.message}`); for (const id of batch) if (!parentsOf.has(id)) parentsOf.set(id, []); }  // in-memory only — a failed batch is refetched next run
    await sleep(350);
  }
  const next = new Set();
  for (const q of frontier) for (const p of parentsOf.get(q) || []) if (!parentsOf.has(p) && !rootSet.has(p)) next.add(p);
  frontier = [...next]; depth++;
}
const ancestorsMemo = new Map();
const ancestorsOf = (q, walking = new Set()) => {
  if (ancestorsMemo.has(q)) return ancestorsMemo.get(q);
  if (walking.has(q)) return new Set();               // P279 cycles exist; break them
  walking.add(q);
  const out = new Set([q]);
  for (const p of parentsOf.get(q) || []) { out.add(p); for (const a of ancestorsOf(p, walking)) out.add(a); }
  ancestorsMemo.set(q, out);
  return out;
};
const verdictByClass = new Map();
for (const c of seen) {
  const anc = ancestorsOf(c);
  for (const root of roots) if (anc.has(root)) {
    const v = KEEP.has(root) ? "KEEP" : BAN[root] ? `banned:${root}` : `review:${root}`;
    if (!verdictByClass.has(c)) verdictByClass.set(c, new Set());
    verdictByClass.get(c).add(v);
  }
}
console.error(`closure via API: ${verdictByClass.size} flagged classes (of ${seen.length} seen)`);

// ── 4. pageview backstop only where it can matter (1–6 sitelinks + an enwiki title) ──
const pvOf = new Map();
const pvCandidates = rows.filter((r) => { const s = sig.get(ent.get(r.id)); return s && s.sitelinks >= 1 && s.sitelinks < 7 && s.enTitle; });
console.error(`pageview backstop for ${pvCandidates.length} borderline rows…`);
for (const r of pvCandidates) {
  const s = sig.get(ent.get(r.id));
  try {
    const t = encodeURIComponent(s.enTitle.replace(/ /g, "_"));
    const j = await api(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${t}/monthly/20250501/20250801`);
    const v = (j.items || []).map((x) => x.views).sort((a, b) => a - b);
    if (v.length) pvOf.set(r.id, v[Math.floor(v.length / 2)]);
  } catch { /* 404/429 → no backstop */ }
  await sleep(300);
}

// ── 5. score + emit ──
const scope = (r) => {
  const q = ent.get(r.id); const s = q ? sig.get(q) : null;
  const links = s?.sitelinks ?? 0, heritage = !!s?.heritage, pv = pvOf.get(r.id) ?? (r.popularity ?? 0);
  const verdicts = new Set((s?.p31 || []).flatMap((c) => [...(verdictByClass.get(c) || [])]));
  const ban = [...verdicts].find((v) => v.startsWith("banned:"));
  if (ban) return { scope: "local", ban };                              // hard ban — fame is irrelevant
  const review = [...verdicts].find((v) => v.startsWith("review:"));
  if (review && !verdicts.has("KEEP")) return { scope: "local", ban: review };  // review class → local until promoted
  if (links >= 70) return { scope: "world", ban: null };
  if (links >= 32 || (heritage && links >= 7)) return { scope: "national", ban: null };
  if (links >= 7 || pv >= 2000) return { scope: "regional", ban: null };
  return { scope: "local", ban: null };
};
const esc = (v) => v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const out = [`-- score-fame.mjs ${new Date().toISOString().slice(0, 10)} — scope per row (founder_scope always wins; untouched here)`];
const tally = {};
for (const r of rows) {
  const q = ent.get(r.id); const s = q ? sig.get(q) : null; const v = scope(r);
  tally[v.scope] = (tally[v.scope] || 0) + 1;
  out.push(`UPDATE attractions SET scope=${esc(v.scope)}, class_ban=${esc(v.ban)}, qid=${esc(q ?? null)}, sitelinks=${s ? s.sitelinks : 0}, is_marquee=${v.scope === "world" || v.scope === "national" ? 1 : (v.scope === "local" ? 0 : "is_marquee")} WHERE id=${esc(r.id)};`);
}
fs.writeFileSync(OUT_SQL, out.join("\n") + "\n");
console.error(`DONE → ${OUT_SQL}`);
console.error("tally:", JSON.stringify(tally));
