#!/usr/bin/env node
// Then and now (founder, 2026-11-03): put a board's archive photo on R2 so the board shows "See it then".
//
//   node scripts/then-now/put.mjs --city "Yosemite Valley" --region California --country "United States" \
//     --photo ~/Desktop/yosemite-1902.jpg --year 1902 \
//     --caption "Cathedral Rocks from the valley floor, a glass-plate view." \
//     --credit "Library of Congress, public domain" --source "https://www.loc.gov/item/…"
//
//   node scripts/then-now/put.mjs --kind country --country Japan --photo … --year 1890 …
//
// It works out the kit slug the worker uses (pcKitSlug in cloudflare-worker-v7.12.js — a US city is
// city/<city>--<state>--united-states, any other city is city/<city>--<country>, a country board is
// country/<country>), writes then.json { year, caption, credit, source } and uploads both objects with
// wrangler to the globeskimmers-media bucket. The board picks it up within an hour (the kit is cached
// in KV for 3600 s). Use only photos you have the right to show: public domain or licensed.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) { args[a.slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[++i] : "true"; }
}
const need = (k) => { if (!args[k]) { console.error(`Missing --${k}`); process.exit(1); } return args[k]; };

// The worker's normaliser: accents off, lower case, one space; then words to hyphens.
const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const word = (v) => norm(v).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isUS = (c) => ["united states", "usa", "united states of america", "u.s.a.", "u.s.", "us"].includes(norm(c));

const kind = (args.kind || "city").toLowerCase();
const country = need("country");
let slug;
if (kind === "country") slug = `country/${word(country)}`;
else if (kind === "city" && isUS(country) && args.region) slug = `city/${word(need("city"))}--${word(args.region)}--united-states`;
else slug = `${kind}/${word(need(kind === "state" ? "state" : "city"))}--${word(country)}`;
if (kind === "city" && isUS(country) && !args.region) { console.error("A US city needs --region (the state), e.g. --region California"); process.exit(1); }

const photo = need("photo");
if (!existsSync(photo)) { console.error(`No file at ${photo}`); process.exit(1); }
if (!/\.jpe?g$/i.test(photo)) { console.error("The photo must be a JPEG (then.jpg) — export it as .jpg first"); process.exit(1); }
const then = { year: args.year || null, caption: args.caption || null, credit: args.credit || null, source: args.source || null };
if (!then.year || !then.credit) { console.error("Give at least --year and --credit (where the photo comes from)"); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), "then-now-"));
const jsonPath = join(dir, "then.json");
writeFileSync(jsonPath, JSON.stringify(then, null, 2));
const bucket = "globeskimmers-media";
const put = (key, file, ct) => {
  console.log(`→ ${bucket}/${key}`);
  execFileSync("npx", ["wrangler", "r2", "object", "put", `${bucket}/${key}`, `--file=${file}`, `--content-type=${ct}`, "--remote"], { stdio: "inherit" });
};
if (args["dry-run"] === "true") { console.log(`slug ${slug}\n${JSON.stringify(then, null, 2)}\n(dry run — nothing uploaded)`); process.exit(0); }
put(`kits/${slug}/then.jpg`, photo, "image/jpeg");
put(`kits/${slug}/then.json`, jsonPath, "application/json");
console.log(`Done. The board shows "See it then · ${then.year}" within the hour (kit cache). Check: https://globeskimmers-api.maizasimeon.workers.dev/kit/${slug}/then.jpg`);
