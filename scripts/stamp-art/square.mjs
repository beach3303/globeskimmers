#!/usr/bin/env node
// Square stamp pictures to the house 1254×1254 PNG with sharp — used by intake.py when node_modules/sharp exists
// (it does: @capacitor/assets brings it). sips, the fallback, pads with an opaque colour; sharp keeps a transparent
// background transparent, which is what the founder's Grok exports are since 2026-11-22 (a stamp shape on clear pixels).
//
//   node scripts/stamp-art/square.mjs <manifest.json>
//   manifest: { size: 1254, pad: true|false, padColor: "FFFFFF", items: [{ src, dst }, …] }
//   prints JSON: [{ src, dst, ok, w, h, how }, …]
//
// Rule (same as intake.py's sips path): a nearly square picture (long/short ≤ 1.25) is centre-cropped to the short side,
// unless pad is set — then nothing is ever cropped; a wide or tall picture is padded to a square (clear when the picture
// has alpha, padColor otherwise), and every result is scaled to size².
import fs from "node:fs";
import sharp from "sharp";

const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const SIZE = manifest.size || 1254;
const padHex = (manifest.padColor || "FFFFFF").replace(/^#/, "");
const padRGB = { r: parseInt(padHex.slice(0, 2), 16), g: parseInt(padHex.slice(2, 4), 16), b: parseInt(padHex.slice(4, 6), 16), alpha: 1 };

async function one({ src, dst }) {
  try {
    const meta = await sharp(src).metadata();
    const w = meta.width, h = meta.height;
    if (!w || !h) return { src, dst, ok: false, how: "unreadable" };
    const ratio = Math.max(w, h) / Math.min(w, h);
    // One resize call does both steps. sharp runs its pipeline in a fixed order (resize BEFORE extend/extract,
    // whatever order the calls are made in), so extend-then-resize would stretch the picture to size² and pad after.
    const clear = meta.hasAlpha;
    const bg = clear ? { r: 0, g: 0, b: 0, alpha: 0 } : padRGB;
    let img = sharp(src).ensureAlpha(), how;
    if (ratio <= 1.25 && !manifest.pad) {
      img = img.resize(SIZE, SIZE, { fit: "cover", position: "centre", kernel: "lanczos3" });
      how = `cropped ${w}×${h} → ${SIZE}²`;
    } else {
      img = img.resize(SIZE, SIZE, { fit: "contain", background: bg, kernel: "lanczos3" });
      how = `padded ${w}×${h} → ${SIZE}² (${clear ? "clear" : padHex})`;
    }
    const out = await img.png({ compressionLevel: 9 }).toFile(dst);
    return { src, dst, ok: true, w: out.width, h: out.height, how };
  } catch (e) {
    return { src, dst, ok: false, how: String(e.message || e) };
  }
}

// a few at a time: sharp is already multi-threaded inside libvips
const results = [];
const queue = [...manifest.items];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) results.push(await one(queue.shift())); }));
const order = new Map(manifest.items.map((it, i) => [it.src, i]));
results.sort((a, b) => order.get(a.src) - order.get(b.src));
process.stdout.write(JSON.stringify(results));
