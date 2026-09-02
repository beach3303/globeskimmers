#!/usr/bin/env node
// aggregate-pageviews.mjs — the DUMP-based replacement for rank-pageviews' API
// stage, for the full-planet run (the API path 429s at scale; the monthly dumps
// have no rate limit).
//
//   node aggregate-pageviews.mjs --peek FILE.bz2            # print first lines (verify format)
//   node aggregate-pageviews.mjs TITLES.txt OUT_DIR FILE.bz2 [FILE2.bz2 ...]
//
// TITLES.txt = one canonical enwiki title per line (from the Wikivoyage parse +
// redirect resolution). Each monthly pageview_complete file is streamed through
// bzcat; lines for en.wikipedia whose title is wanted are tallied. The MEDIAN
// across the given months is written to OUT_DIR/pv-cache.jsonl in exactly the
// shape rank-pageviews.mjs already reads ({title, median}) — so stage 2 runs
// unchanged with the cache pre-warmed and never touches the API.
import fs from "node:fs";
import readline from "node:readline";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
if (args[0] === "--peek") {
  const bz = spawn("bzcat", [args[1]]);
  const rl = readline.createInterface({ input: bz.stdout });
  let n = 0;
  rl.on("line", (l) => { console.log(l); if (++n >= 15) { bz.kill(); process.exit(0); } });
  bz.on("error", (e) => { console.error("bzcat failed:", e.message); process.exit(1); });
} else {
  const [TITLES, OUT, ...FILES] = args;
  if (!TITLES || !OUT || !FILES.length) { console.error("usage: aggregate-pageviews.mjs TITLES.txt OUT_DIR FILE.bz2..."); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  // wanted set keyed by underscore form (dump uses underscores)
  const wanted = new Map();
  for (const t of fs.readFileSync(TITLES, "utf8").split("\n")) { const s = t.trim(); if (s) wanted.set(s.replace(/ /g, "_"), []); }
  console.error(`${wanted.size} wanted titles · ${FILES.length} monthly files`);
  const run = (file) => new Promise((resolve, reject) => {
    let lines = 0, hits = 0;
    const monthTotals = new Map();
    const bz = spawn("bzcat", [file]);
    const rl = readline.createInterface({ input: bz.stdout });
    rl.on("line", (l) => {
      lines++;
      // pageview_complete monthly line: "<wiki> <title> <pageid> <agent> <count> ..."
      // Be tolerant: fields split on single spaces; wiki must be en.wikipedia;
      // count = the first purely-numeric field after position 2.
      if (l.charCodeAt(0) !== 101 /* 'e' */) return;             // cheap prefilter
      if (!l.startsWith("en.wikipedia ")) return;
      const f = l.split(" ");
      const title = f[1];
      const bucket = wanted.get(title);
      if (bucket === undefined) return;
      let count = null;
      for (let i = 2; i < f.length; i++) if (/^\d+$/.test(f[i]) && f[i].length < 12) { count = Number(f[i - 0]); if (i >= 3) break; }
      // prefer the LAST small-ish numeric before hourly blob: take field 4 if numeric, else scan
      if (/^\d+$/.test(f[4] || "")) count = Number(f[4]);
      else if (/^\d+$/.test(f[3] || "")) count = Number(f[3]);
      if (count == null) return;
      monthTotals.set(title, (monthTotals.get(title) || 0) + count);   // sum agents (desktop+mobile rows)
      hits++;
    });
    rl.on("close", () => { for (const [t, c] of monthTotals) wanted.get(t).push(c); console.error(`  ${file.split("/").pop()}: ${lines.toLocaleString()} lines, ${hits.toLocaleString()} hits, ${monthTotals.size} titles`); resolve(); });
    bz.on("error", reject);
  });
  for (const f of FILES) await run(f);
  const out = fs.createWriteStream(OUT + "/pv-cache.jsonl");
  let written = 0;
  for (const [t, months] of wanted) {
    if (!months.length) continue;
    const v = months.slice().sort((a, b) => a - b);
    out.write(JSON.stringify({ title: t.replace(/_/g, " "), median: v[Math.floor(v.length / 2)] }) + "\n");
    written++;
  }
  out.end();
  console.error(`DONE — pv-cache.jsonl: ${written} titles with pageviews (of ${wanted.size} wanted)`);
}
