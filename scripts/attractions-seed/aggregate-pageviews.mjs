#!/usr/bin/env node
// aggregate-pageviews.mjs — the DUMP-based replacement for rank-pageviews' API
// stage, for the full-planet run (the API path 429s at scale; the monthly dumps
// have no rate limit).
//
//   node aggregate-pageviews.mjs --peek FILE.bz2            # print first lines (verify format)
//   node aggregate-pageviews.mjs TITLES.txt OUT_DIR FILE.bz2 [FILE2.bz2 ...]
//
// v2 — the readline/split version OOM'd Node's 2GB default heap mid-month on the
// full-planet run. This version: (a) prefilters to en.wikipedia lines with
// shell-side grep so Node never sees ~85% of the stream, (b) parses fields by
// index scanning instead of split() (no per-line array of sliced strings),
// (c) tallies into a Float64Array keyed by title index (no string retention),
// (d) checkpoints each finished month to OUT/pvmonth-<file>.json and skips
// months already checkpointed on restart.
import fs from "node:fs";
import path from "node:path";
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
  // wanted index keyed by underscore form (the dump uses underscores)
  const wantedIdx = new Map();
  const names = [];
  for (const t of fs.readFileSync(TITLES, "utf8").split("\n")) {
    const s = t.trim();
    if (s && !wantedIdx.has(s.replace(/ /g, "_"))) { wantedIdx.set(s.replace(/ /g, "_"), names.length); names.push(s); }
  }
  console.error(`${wantedIdx.size} wanted titles · ${FILES.length} monthly files`);

  const isDigits = (s) => s.length > 0 && s.length < 12 && /^\d+$/.test(s);

  const run = (file) => new Promise((resolve, reject) => {
    const tallies = new Float64Array(names.length);
    // shell-side prefilter: only en.wikipedia rows ever reach Node
    const sh = spawn("sh", ["-c", `bzcat "${file.replace(/"/g, '\\"')}" | LC_ALL=C grep '^en\\.wikipedia '`]);
    sh.stdout.setEncoding("utf8");
    let buf = "", lines = 0, hits = 0;
    const feed = (chunk) => {
      buf += chunk;
      let start = 0, nl;
      while ((nl = buf.indexOf("\n", start)) !== -1) {
        lines++;
        if (lines % 20_000_000 === 0) console.error(`    …${(lines / 1e6) | 0}M en-lines`);
        // line: en.wikipedia TITLE PAGEID AGENT COUNT HOURLYBLOB
        const t0 = start + 13;                       // grep guarantees "en.wikipedia "
        const sp2 = buf.indexOf(" ", t0);
        if (sp2 === -1 || sp2 > nl) { start = nl + 1; continue; }
        const ix = wantedIdx.get(buf.slice(t0, sp2)); // transient sliced string, dies young
        if (ix === undefined) { start = nl + 1; continue; }
        const sp3 = buf.indexOf(" ", sp2 + 1);
        const sp4 = sp3 === -1 ? -1 : buf.indexOf(" ", sp3 + 1);
        const sp5 = sp4 === -1 ? -1 : buf.indexOf(" ", sp4 + 1);
        let count = null;
        if (sp4 !== -1 && sp4 < nl) {                // field 4 (after 4th space) preferred
          const end = sp5 !== -1 && sp5 < nl ? sp5 : nl;
          const c4 = buf.slice(sp4 + 1, end);
          if (isDigits(c4)) count = Number(c4);
        }
        if (count === null && sp3 !== -1 && sp3 < nl) { // tolerate the 4-field shape
          const end = sp4 !== -1 && sp4 < nl ? sp4 : nl;
          const c3 = buf.slice(sp3 + 1, end);
          if (isDigits(c3)) count = Number(c3);
        }
        if (count !== null) { tallies[ix] += count; hits++; } // sum agents (desktop+mobile rows)
        start = nl + 1;
      }
      buf = buf.slice(start);
    };
    sh.stdout.on("data", feed);
    sh.on("error", reject);
    sh.on("close", (code) => {
      if (code !== 0 && code !== null) return reject(new Error(`pipeline exit ${code} for ${file}`));
      console.error(`  ${path.basename(file)}: ${lines.toLocaleString()} en-lines, ${hits.toLocaleString()} hits`);
      resolve(tallies);
    });
  });

  const monthValues = []; // per month: Float64Array
  for (const f of FILES) {
    const ck = path.join(OUT, `pvmonth-${path.basename(f).replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
    if (fs.existsSync(ck)) {
      const pairs = JSON.parse(fs.readFileSync(ck, "utf8"));
      const t = new Float64Array(names.length);
      for (const [i, c] of pairs) if (i < t.length) t[i] = c;
      console.error(`  ${path.basename(f)}: checkpoint reused (${pairs.length} titles)`);
      monthValues.push(t);
      continue;
    }
    const t = await run(f);
    const pairs = [];
    for (let i = 0; i < t.length; i++) if (t[i] > 0) pairs.push([i, t[i]]);
    fs.writeFileSync(ck, JSON.stringify(pairs));
    monthValues.push(t);
  }

  const out = fs.createWriteStream(path.join(OUT, "pv-cache.jsonl"));
  let written = 0;
  for (let i = 0; i < names.length; i++) {
    const v = [];
    for (const m of monthValues) if (m[i] > 0) v.push(m[i]);
    if (!v.length) continue;                        // never appeared → not cached (ranker treats as unranked)
    v.sort((a, b) => a - b);
    out.write(JSON.stringify({ title: names[i], median: v[Math.floor(v.length / 2)] }) + "\n");
    written++;
  }
  out.end();
  console.error(`DONE — pv-cache.jsonl: ${written} titles with pageviews (of ${wantedIdx.size} wanted)`);
}
