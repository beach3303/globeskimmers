// Generate passport stamp art from docs/PASSPORT_ICON_LIST.md via the OpenAI
// image API (gpt-image-1), using the doc's LOCKED prompt template + per-region
// ink, then upload each to R2 at the clean slug. Skips slugs that already exist
// (so it only fills the missing ones and is safe to re-run).
//
// Setup: put your key in .env.images (git-ignored):  OPENAI_API_KEY=sk-...
// Test 5 first:   node scripts/passport/generate-stamps.mjs --test
// Full missing:   node scripts/passport/generate-stamps.mjs --from=301 --to=1000
// Variants only:  node scripts/passport/generate-stamps.mjs --variants
// Re-do one:      node scripts/passport/generate-stamps.mjs --from=305 --to=305 --force
//
// Style/spec © the founder's PASSPORT_ICON_LIST.md. Images are original art.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "../..");
const DOC = join(ROOT, "docs/PASSPORT_ICON_LIST.md");
const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
const BUCKET = "globeskimmers-media";
const TMP = "/tmp/gs-stamps"; try { mkdirSync(TMP, { recursive: true }); } catch { /* ok */ }

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const eq = a.indexOf("="); if (a.startsWith("--") && eq === -1) return [a.slice(2), true];
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a, true];
}));

// --- API key from env or .env.images ----------------------------------------
let KEY = process.env.OPENAI_API_KEY;
if (!KEY && existsSync(join(ROOT, ".env.images"))) {
  const m = readFileSync(join(ROOT, ".env.images"), "utf8").match(/OPENAI_API_KEY\s*=\s*(.+)/);
  if (m) KEY = m[1].trim().replace(/^["']|["']$/g, "");
}
if (!KEY && !args.dry) { console.error("✗ No OPENAI_API_KEY (env or .env.images)."); process.exit(1); }

// --- slug (mirrors src/lib/stampArt.js) -------------------------------------
const slug = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/\([^)]*\)/g, " ").toLowerCase().replace(/['’]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae")
  .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// --- region → ink ------------------------------------------------------------
const INK_BY_REGION = [
  [/europe/i, "navy"], [/middle east|africa/i, "amber"], [/asia/i, "crimson"],
  [/oceania/i, "teal"], [/north america/i, "forest green"], [/south america/i, "plum"],
];
function inkFor(header) { for (const [re, ink] of INK_BY_REGION) if (re.test(header)) return ink; return null; }

// --- parse the doc into {n, name, city, country, ink} ------------------------
function parseDoc() {
  const rows = [];
  let ink = "navy";
  for (const line of readFileSync(DOC, "utf8").split("\n")) {
    if (/^#{1,3}\s/.test(line)) { const k = inkFor(line); if (k) ink = k; continue; }
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (m) rows.push({ n: +m[1], name: m[2].trim(), city: m[3].trim(), country: m[4].trim(), ink });
  }
  return rows;
}

// --- the six location variants (not numbered rows) --------------------------
const VARIANTS = [
  { slug: "grand-canyon-west-rim", name: "Grand Canyon West Rim", top: "GRAND CANYON WEST · USA", bottom: "WEST RIM", ink: "forest green" },
  { slug: "grand-canyon-south-rim", name: "Grand Canyon South Rim", top: "GRAND CANYON SOUTH · USA", bottom: "SOUTH RIM", ink: "forest green" },
  { slug: "grand-canyon-east-rim", name: "Grand Canyon East Rim", top: "GRAND CANYON EAST · USA", bottom: "EAST RIM", ink: "forest green" },
  { slug: "grand-canyon-north-rim", name: "Grand Canyon North Rim", top: "GRAND CANYON NORTH · USA", bottom: "NORTH RIM", ink: "forest green" },
  { slug: "niagara-falls-canada", name: "Niagara Falls, Canada (Horseshoe Falls)", top: "NIAGARA FALLS · CANADA", bottom: "CANADIAN FALLS", ink: "forest green" },
  { slug: "niagara-falls-new-york", name: "Niagara Falls, New York (American Falls)", top: "NIAGARA FALLS, NY · USA", bottom: "AMERICAN FALLS", ink: "forest green" },
];

// --- the LOCKED prompt template ---------------------------------------------
function prompt({ landmark, top, bottom, ink }) {
  return `A vintage passport stamp of the ${landmark}. ${ink} ink line-engraving, ` +
    `square double rounded-rectangle border, distressed rubber-stamp texture, clean transparent background, ` +
    `detailed iconic landmark centered, top text "${top}", bottom text "${bottom}" with two small stars, ` +
    `flat 2D, high contrast, no date, no photorealism.`;
}

async function exists(s) {
  try { const r = await fetch(`${WORKER}/stamp-art/${s}.png`, { method: "GET", headers: { Range: "bytes=0-0" } }); return r.status === 200 || r.status === 206; } catch { return false; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(p) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt: p, size: "1024x1024", quality: "medium", background: "transparent", n: 1 }),
    });
    if (r.status === 429 || r.status >= 500) { await sleep(12000 * (attempt + 1)); continue; }
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
    const b64 = j.data?.[0]?.b64_json; if (!b64) throw new Error("no image data");
    return Buffer.from(b64, "base64");
  }
  throw new Error("rate-limited after retries");
}

function upload(s, buf) {
  const f = join(TMP, `${s}.png`); writeFileSync(f, buf);
  execFileSync("wrangler", ["r2", "object", "put", `${BUCKET}/stamp-art/${s}.png`, `--file=${f}`, "--content-type=image/png", "--remote"], { cwd: ROOT, stdio: "ignore" });
}

async function main() {
  let items;
  if (args.variants) {
    items = VARIANTS.map((v) => ({ slug: v.slug, landmark: v.name, top: v.top, bottom: v.bottom, ink: v.ink }));
  } else {
    const from = +(args.from || 301), to = +(args.to || 1000);
    items = parseDoc().filter((r) => r.n >= from && r.n <= to).map((r) => ({
      slug: slug(r.name), landmark: `${r.name} in ${r.city}, ${r.country}`,
      top: `${r.city.toUpperCase()} · ${r.country.toUpperCase()}`, bottom: r.name.toUpperCase(), ink: r.ink,
    }));
  }
  if (args.test) items = items.slice(0, 5);
  console.error(`${items.length} stamps to consider…`);
  if (args.dry) {
    for (const it of items.slice(0, 8)) console.error(`  ${it.slug}.png · ink=${it.ink} · top="${it.top}" · bottom="${it.bottom}"`);
    console.error(`  … (${items.length} total)`);
    console.error(`\nSample prompt:\n${prompt(items[0])}`);
    return;
  }

  let made = 0, skipped = 0, failed = 0;
  for (const it of items) {
    if (!args.force && await exists(it.slug)) { skipped++; continue; }
    try {
      const buf = await generate(prompt(it));
      upload(it.slug, buf);
      made++; console.error(`✅ ${it.slug}.png  (${made} made)`);
      await sleep(1500); // pace under image rate limits
    } catch (e) { failed++; console.error(`❌ ${it.slug}: ${e.message}`); }
  }
  console.error(`\nDone. made=${made} skipped(existing)=${skipped} failed=${failed}`);
  console.error(`≈ cost: $${(made * 0.04).toFixed(2)} (medium quality est.)`);
}
main();
