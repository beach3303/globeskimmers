#!/usr/bin/env node
// Contact sheets of finished stamps so Claude can read a whole batch at a glance for the review (wrong landmark, a logo
// or wordmark, a character, a person, brand signage) instead of opening 500 files one by one.
//
//   node scripts/stamp-art/contact-sheets.mjs <dir of PNGs> <out dir> [labels.json]
//   labels.json: { "<slug>": "013 · 798 Art District · Beijing" } — sheets follow this order; unlabeled files come last.
//   Writes sheet-01.png … (12 stamps each, 4 × 3, 2000 × 1560) and index.txt (which slug is on which sheet).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [dir, outDir, labelsFile] = process.argv.slice(2);
if (!dir || !outDir) { console.error("usage: contact-sheets.mjs <dir> <out dir> [labels.json]"); process.exit(1); }
const labels = labelsFile ? JSON.parse(fs.readFileSync(labelsFile, "utf8")) : {};
fs.mkdirSync(outDir, { recursive: true });

const COLS = 4, ROWS = 3, CELL = 500, IMG = 440, LABEL = 60, PER = COLS * ROWS;
const W = COLS * CELL, H = ROWS * (IMG + LABEL);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));
const order = Object.keys(labels);
files.sort((a, b) => {
  const ia = order.indexOf(a), ib = order.indexOf(b);
  return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || a.localeCompare(b);
});

const index = [];
for (let s = 0; s * PER < files.length; s++) {
  const chunk = files.slice(s * PER, (s + 1) * PER);
  const comps = [];
  for (let i = 0; i < chunk.length; i++) {
    const slug = chunk[i];
    const x = (i % COLS) * CELL + (CELL - IMG) / 2, y = Math.floor(i / COLS) * (IMG + LABEL);
    const buf = await sharp(path.join(dir, slug + ".png")).resize(IMG, IMG, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    comps.push({ input: buf, left: Math.round(x), top: y });
    const text = labels[slug] || slug;
    const svg = `<svg width="${CELL}" height="${LABEL}"><text x="${CELL / 2}" y="26" font-family="Helvetica, Arial" font-size="20" font-weight="700" text-anchor="middle" fill="#111">${esc(text.length > 44 ? text.slice(0, 43) + "…" : text)}</text><text x="${CELL / 2}" y="50" font-family="Helvetica, Arial" font-size="16" text-anchor="middle" fill="#666">${esc(slug)}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: (i % COLS) * CELL, top: y + IMG });
    index.push(`sheet-${String(s + 1).padStart(2, "0")}  ${text}  (${slug})`);
  }
  const name = `sheet-${String(s + 1).padStart(2, "0")}.png`;
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 246, g: 241, b: 232, alpha: 1 } } }).composite(comps).png().toFile(path.join(outDir, name));
  console.log(name, chunk.length);
}
fs.writeFileSync(path.join(outDir, "index.txt"), index.join("\n") + "\n");
