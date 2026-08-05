#!/usr/bin/env node
/**
 * Batch-generate passport stamp art via the OpenAI Images API (gpt-image-1),
 * in the SAME illustrated style as the hand-made set — but with no 24h wall and
 * no rename step. It reads the curated icon list, builds the locked prompt for
 * each landmark (region ink baked in), and writes `<slug>.png` straight to an
 * output folder, ready to upload to R2 as-is.
 *
 * ── Setup (once) ────────────────────────────────────────────────────────────
 *   export OPENAI_API_KEY=sk-...        # your key — NEVER commit it
 *   (needs a few dollars of credit; ~$0.04/image at medium, ~$0.17 at high)
 *
 * ── Run ─────────────────────────────────────────────────────────────────────
 *   node scripts/passport/generate-stamps.mjs                 # all 300, skip existing
 *   node scripts/passport/generate-stamps.mjs --from 201 --to 300   # just batch 3
 *   node scripts/passport/generate-stamps.mjs --only eiffel-tower,petra
 *   node scripts/passport/generate-stamps.mjs --from 201 --to 300 --upload
 *                                                             # generate + push to R2
 *   node scripts/passport/generate-stamps.mjs --dry           # print prompts, no API calls
 *
 * Flags: --from N --to M | --only slugA,slugB | --out DIR (default ./stamp-out)
 *        --quality low|medium|high (default medium) | --force (regen existing)
 *        --concurrency N (default 3) | --upload (wrangler r2 put --remote) | --dry
 *
 * Resumable: already-present PNGs in --out are skipped unless --force. So if it
 * dies at #137, just run it again — it picks up where it left off.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const LIST = path.join(REPO, "docs", "PASSPORT_ICON_LIST.md");
const BUCKET = "globeskimmers-media";

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);
const OUT = path.resolve(arg("out", path.join(REPO, "stamp-out")));
const FROM = parseInt(arg("from", "1"), 10);
const TO = parseInt(arg("to", "99999"), 10);
const ONLY = (arg("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const QUALITY = arg("quality", "medium");
const CONCURRENCY = Math.max(1, parseInt(arg("concurrency", "2"), 10));
const FORCE = has("force");
const UPLOAD = has("upload");
const DRY = has("dry");

// ── region ink hex → friendly colour name for the prompt ─────────────────────
const INK = {
  "#2B4A7E": "deep navy-blue",
  "#A9741F": "warm amber",
  "#B0472F": "crimson red",
  "#1F6E6A": "deep teal",
  "#2E6B4E": "forest green",
  "#6D3A6E": "plum purple",
};

// slug — MUST match src/lib/stampArt.js (diacritics, apostrophes, parens stripped)
const slug = (s) =>
  String(s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase().replace(/['’]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae")
    .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ── parse the icon list markdown ─────────────────────────────────────────────
function parseIcons() {
  const lines = fs.readFileSync(LIST, "utf8").split("\n");
  const icons = [];
  let ink = "#2B4A7E";
  for (const line of lines) {
    const h = line.match(/`(#[0-9A-Fa-f]{6})`/);
    if (line.startsWith("#") && h) { ink = h[1].toUpperCase(); continue; }
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const [, num, name, city, country] = m;
    icons.push({ n: +num, name, city, country, ink, slug: slug(name) });
  }
  return icons;
}

function promptFor(it) {
  const inkName = INK[it.ink] || "deep navy-blue";
  return (
    `A vintage passport stamp of the ${it.name}. ${inkName} ink line-engraving, ` +
    `square double rounded-rectangle border, distressed rubber-stamp texture, ` +
    `clean solid white background, detailed iconic landmark centered, ` +
    `top text "${it.city} · ${it.country}", bottom text "${it.name}" with two small stars, ` +
    `flat 2D vector, high contrast, no date, no photorealism.`
  );
}

function uploadOne(it, outPath) {
  execFileSync("wrangler", ["r2", "object", "put",
    `${BUCKET}/stamp-art/${it.slug}.png`, `--file=${outPath}`,
    "--content-type=image/png", "--remote"], { stdio: "ignore" });
}

async function genOne(it) {
  const outPath = path.join(OUT, `${it.slug}.png`);
  // Already generated: skip the (paid) API call. With --upload, still push it to
  // R2 — so this doubles as a pure uploader for art you've already made.
  if (fs.existsSync(outPath) && !FORCE) {
    if (!UPLOAD) return { ...it, status: "skip" };
    try { uploadOne(it, outPath); return { ...it, status: "uploaded" }; }
    catch (e) { return { ...it, status: "error", err: "upload: " + e.message }; }
  }
  const prompt = promptFor(it);
  if (DRY) { console.log(`  [dry] ${it.slug}.png  ←  ${prompt}`); return { ...it, status: "dry" }; }

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-image-1", prompt, n: 1, size: "1024x1024",
          quality: QUALITY, background: "opaque", output_format: "png",
        }),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`http ${res.status}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `http ${res.status}`);
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error("no image in response");
      fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
      if (UPLOAD) {
        execFileSync("wrangler", ["r2", "object", "put",
          `${BUCKET}/stamp-art/${it.slug}.png`, `--file=${outPath}`,
          "--content-type=image/png", "--remote"], { stdio: "ignore" });
      }
      return { ...it, status: UPLOAD ? "uploaded" : "made" };
    } catch (e) {
      if (attempt === 4) return { ...it, status: "error", err: e.message };
      await new Promise((r) => setTimeout(r, 1500 * attempt * attempt)); // backoff
    }
  }
}

// ── run with a small concurrency pool ────────────────────────────────────────
async function main() {
  if (!DRY && !process.env.OPENAI_API_KEY) {
    console.error("✗ Set OPENAI_API_KEY first:  export OPENAI_API_KEY=sk-...");
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  let icons = parseIcons().filter((it) => it.n >= FROM && it.n <= TO);
  if (ONLY.length) icons = icons.filter((it) => ONLY.includes(it.slug));
  console.log(`${icons.length} icons in range → ${OUT}  (quality=${QUALITY}${UPLOAD ? ", +upload" : ""}${DRY ? ", DRY" : ""})\n`);

  const counts = { made: 0, uploaded: 0, skip: 0, dry: 0, error: 0 };
  const errors = [];
  let i = 0;
  async function worker() {
    while (i < icons.length) {
      const it = icons[i++];
      const r = await genOne(it);
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (r.status === "error") errors.push(`#${it.n} ${it.slug}: ${r.err}`);
      if (r.status !== "dry")
        console.log(`  ${r.status.padEnd(8)} #${String(it.n).padStart(3)}  ${it.slug}.png`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\n✅ done — made ${counts.made}, uploaded ${counts.uploaded}, skipped ${counts.skip}, errors ${counts.error}`);
  if (errors.length) { console.log("errors:"); errors.forEach((e) => console.log("  ✗ " + e)); }
  if (!UPLOAD && (counts.made || 0) > 0)
    console.log(`\nUpload them:  node scripts/passport/generate-stamps.mjs --from ${FROM} --to ${TO} --upload   (re-run skips the made ones, just uploads)\n  …or:  wrangler r2 object put ${BUCKET}/stamp-art/<slug>.png --file=${OUT}/<slug>.png --remote`);
}
main();
