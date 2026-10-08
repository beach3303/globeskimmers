#!/usr/bin/env node
// Grading kit for the worldwide search suite — the same reviewers' view every
// round. Reviewers are independent agents given GRADER_PROMPT.md.
//
//   node scripts/search-eval/judge.mjs pack <dir> [packs=3]
//       split last-run.json (the cases in graded-ids.json) into <dir>/pack-N.json
//   node scripts/search-eval/judge.mjs merge <label> <dir>
//       read every <dir>/verdicts-*.json (several reviewers may grade each case;
//       the MEDIAN verdict wins), write quality-<label>.json, compare with the
//       earlier quality-*.json files on the same cases
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const here = (f) => new URL(`./${f}`, import.meta.url);
const [cmd, a, b] = process.argv.slice(2);
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
      query_sent: r.plan?.query || "", filters_applied: r.filters || [], ...(r.sections ? { page_sections: r.sections } : {}), top: r.top || [] };
  });
  const size = Math.ceil(rows.length / packs);
  for (let i = 0; i < packs; i++) writeFileSync(`${dir}/pack-${i + 1}.json`, JSON.stringify(rows.slice(i * size, (i + 1) * size), null, 1));
  console.log(`${rows.length} cases → ${packs} packs of ≤${size} in ${dir}`);
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
