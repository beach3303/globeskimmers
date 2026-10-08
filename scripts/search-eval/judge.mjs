#!/usr/bin/env node
// Grading kit for the worldwide search suite — the same reviewers' view every
// round. Reviewers are independent agents given GRADER_PROMPT.md.
//
//   node scripts/search-eval/judge.mjs pack <dir> [packs=3]
//       split last-run.json (the cases in graded-ids.json) into <dir>/pack-N.json
//   node scripts/search-eval/judge.mjs pack <dir> [packs] --since <prevDir>
//       only the cases whose top results differ from <prevDir>'s packs —
//       reviewers re-grading an IDENTICAL list flip about 5 of 119 verdicts,
//       so unchanged lists keep their earlier verdict
//   node scripts/search-eval/judge.mjs merge <label> <dir> [--base quality-X.json]
//       read every <dir>/verdicts-*.json (several reviewers may grade each case;
//       the MEDIAN verdict wins), fill cases not re-graded from --base, write
//       quality-<label>.json, compare with the earlier quality-*.json files
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const here = (f) => new URL(`./${f}`, import.meta.url);
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const since = flag("--since"), base = flag("--base");
const [cmd, a, b] = argv;
const RANK = { WRONG: 0, WEAK: 1, GOOD: 2 };
const NAME = ["WRONG", "WEAK", "GOOD"];

if (cmd === "pack") {
  const dir = a, packs = +(b || 3);
  const ids = JSON.parse(readFileSync(here("graded-ids.json"), "utf8"));
  const run = JSON.parse(readFileSync(here("last-run.json"), "utf8"));
  const byId = Object.fromEntries(run.results.map((r) => [r.id, r]));
  const rows = ids.map((id) => {
    const r = byId[id];
    if (!r) throw new Error(`case ${id} is not in last-run.json — run the full suite first`);
    return { id, q: r.q, resolved_place: r.at || "near Arcadia, CA (traveler GPS)", finder: r.route,
      query_sent: r.plan?.query || "", filters_applied: r.filters || [], ...(r.sections ? { page_sections: r.sections } : {}),
      // Reviewers see what the traveler sees: the internal famous-place marker isn't shown in the app.
      top: (r.top || []).map(({ on_wikipedia, ...t }) => t) };
  });
  let todo = rows;
  if (since) {
    const prev = {};
    for (const f of readdirSync(since).filter((f) => /^pack-\d+\.json$/.test(f))) for (const c of JSON.parse(readFileSync(`${since}/${f}`, "utf8"))) prev[c.id] = JSON.stringify(c.top.map((t) => t.name));
    todo = rows.filter((r) => prev[r.id] !== JSON.stringify(r.top.map((t) => t.name)));
    console.log(`${rows.length - todo.length} lists unchanged since ${since} (verdicts carry over)`);
  }
  const size = Math.max(1, Math.ceil(todo.length / packs));
  for (let i = 0; i < packs; i++) writeFileSync(`${dir}/pack-${i + 1}.json`, JSON.stringify(todo.slice(i * size, (i + 1) * size), null, 1));
  console.log(`${todo.length} cases → ${packs} packs of ≤${size} in ${dir}`);
} else if (cmd === "merge") {
  const label = a, dir = b;
  const votes = {};
  for (const f of readdirSync(dir).filter((f) => /^verdicts-.*\.json$/.test(f))) {
    for (const v of JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))) (votes[v.id] ||= []).push(v);
  }
  const verdicts = {};
  for (const [id, vs] of Object.entries(votes)) {
    const sorted = [...vs].sort((x, y) => RANK[x.verdict] - RANK[y.verdict]);
    const med = sorted[(sorted.length - 1) >> 1]; // lower median: a tie leans strict
    verdicts[id] = { ...med, votes: vs.map((v) => v.verdict) };
  }
  if (base) {
    const prior = JSON.parse(readFileSync(here(base), "utf8")).verdicts;
    for (const [id, v] of Object.entries(prior)) if (!verdicts[id]) verdicts[id] = { ...v, carried: true };
  }
  const ids = Object.keys(verdicts);
  const tally = (vs) => { const t = { GOOD: 0, WEAK: 0, WRONG: 0 }; for (const id of ids) if (vs[id]) t[vs[id].verdict]++; return t; };
  const line = (name, vs) => { const t = tally(vs), n = t.GOOD + t.WEAK + t.WRONG; console.log(`${name.padEnd(34)} good ${t.GOOD} · weak ${t.WEAK} · wrong ${t.WRONG}  (${Math.round((100 * t.GOOD) / Math.max(1, n))}% good, n=${n})`); };
  for (const f of readdirSync(here(".").pathname).filter((f) => /^quality-.*\.json$/.test(f)).sort()) {
    const q = JSON.parse(readFileSync(here(f), "utf8"));
    line(f.replace(/\.json$/, ""), q.verdicts || q);
  }
  line(`quality-${label} (this run)`, verdicts);
  const split = ids.filter((id) => new Set(verdicts[id].votes).size > 1).length;
  console.log(`reviewers disagreed on ${split}/${ids.length} cases`);
  writeFileSync(here(`quality-${label}.json`), JSON.stringify({ judgedAt: new Date().toISOString().slice(0, 10), label,
    method: "GRADER_PROMPT.md; filters + hours + price visible; median of every reviewer's vote per case", verdicts }, null, 1));
} else {
  console.log("usage: judge.mjs pack <dir> [packs] | judge.mjs merge <label> <dir>");
}
