// photoLook — our own looks for a photo (founder, 2026-10-18: "cool filters that Instagram
// does not have … professional looking, clearer, crisper, brighter, darker, different grains,
// cooler warmer"). Pure pixel math on an ImageData, so a look renders the same in Safari's
// WKWebView as in Chrome (no CanvasRenderingContext2D.filter). The edited photo is what
// uploads; nothing here keeps the original (founder, 2026-10-19: the undo is "upload it again").
//
//   LOOKS                  the named starting points, each { key, name, look }
//   EMPTY_LOOK             every dial at rest
//   isPlain(look)          true when a look changes nothing
//   applyLook(imageData, look)       edits the pixels in place
//   renderLook(dataUrl, look, maxDim, quality) → Promise<dataUrl>   a JPEG with the look applied
//
// A look's dials: brightness, contrast, warmth, saturation −100..100; clarity, grain, fade,
// vignette 0..100; mono true = black and white. Clarity is an unsharp mask against a 3×3
// blur; fade lifts the blacks toward a matte grey; grain is deterministic per photo, so the
// preview and the saved file carry the same grain.

/* global Image, document */

export const EMPTY_LOOK = Object.freeze({ brightness: 0, contrast: 0, warmth: 0, saturation: 0, clarity: 0, grain: 0, fade: 0, vignette: 0, mono: false });

export const LOOKS = [
  { key: "none", name: "Original", look: {} },
  { key: "airmail", name: "Airmail", look: { brightness: 6, contrast: 12, warmth: -18, clarity: 35, saturation: 8 } },
  { key: "golden", name: "Golden Hour", look: { brightness: 10, contrast: 6, warmth: 28, saturation: 12, fade: 8 } },
  { key: "film", name: "Film", look: { contrast: -6, warmth: 8, saturation: -12, grain: 38, fade: 26 } },
  { key: "ink", name: "Ink", look: { mono: true, contrast: 18, clarity: 20, grain: 30 } },
  { key: "dusk", name: "Dusk", look: { brightness: -14, contrast: 10, warmth: -22, saturation: -6, vignette: 30 } },
  { key: "postcard", name: "Postcard", look: { contrast: 14, saturation: 24, warmth: 6, clarity: 20, vignette: 40 } },
];

export const lookFor = (key) => ({ ...EMPTY_LOOK, ...((LOOKS.find((l) => l.key === key) || LOOKS[0]).look) });

export function isPlain(look) {
  const L = { ...EMPTY_LOOK, ...(look || {}) };
  return !L.mono && ["brightness", "contrast", "warmth", "saturation", "clarity", "grain", "fade", "vignette"].every((k) => !L[k]);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function applyLook(img, look) {
  const L = { ...EMPTY_LOOK, ...(look || {}) };
  const { data, width: w, height: h } = img;
  const n = w * h;
  // Clarity: a 3×3 box blur of each channel, separable, for the unsharp mask below.
  let blur = null;
  const cl = clamp(L.clarity, 0, 100) / 100 * 1.2;
  if (cl > 0) {
    const tmp = new Uint16Array(data.length);
    const row = w * 4;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, l = x > 0 ? i - 4 : i, r = x < w - 1 ? i + 4 : i;
        tmp[i] = data[l] + data[i] + data[r];
        tmp[i + 1] = data[l + 1] + data[i + 1] + data[r + 1];
        tmp[i + 2] = data[l + 2] + data[i + 2] + data[r + 2];
      }
    }
    blur = new Float32Array(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, u = y > 0 ? i - row : i, d = y < h - 1 ? i + row : i;
        blur[i] = (tmp[u] + tmp[i] + tmp[d]) / 9;
        blur[i + 1] = (tmp[u + 1] + tmp[i + 1] + tmp[d + 1]) / 9;
        blur[i + 2] = (tmp[u + 2] + tmp[i + 2] + tmp[d + 2]) / 9;
      }
    }
  }
  const bright = clamp(L.brightness, -100, 100) * 0.6;
  const con = 1 + clamp(L.contrast, -100, 100) / 100 * 0.8;
  const warm = clamp(L.warmth, -100, 100) / 100 * 22;
  const sat = 1 + clamp(L.saturation, -100, 100) / 100;
  const grain = clamp(L.grain, 0, 100) / 100 * 28;
  const fade = clamp(L.fade, 0, 100) / 100;
  const vig = clamp(L.vignette, 0, 100) / 100;
  const mono = !!L.mono;
  const cx = w / 2, cy = h / 2, rad = Math.hypot(cx, cy) || 1;
  let seed = 0x9e3779b9;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (blur) { r += cl * (r - blur[i]); g += cl * (g - blur[i + 1]); b += cl * (b - blur[i + 2]); }
    r = (r - 128) * con + 128 + bright; g = (g - 128) * con + 128 + bright; b = (b - 128) * con + 128 + bright;
    r += warm; b -= warm;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (mono) { r = g = b = luma; }
    else if (sat !== 1) { r = luma + (r - luma) * sat; g = luma + (g - luma) * sat; b = luma + (b - luma) * sat; }
    if (fade) { const k = 1 - 0.3 * fade, lift = 48 * fade; r = r * k + lift; g = g * k + lift; b = b * k + lift; }
    if (vig) {
      const x = p % w, y = (p - x) / w;
      const t = clamp((Math.hypot(x - cx, y - cy) / rad - 0.45) / 0.6, 0, 1);
      const k = 1 - vig * 0.55 * t * t;
      r *= k; g *= k; b *= k;
    }
    if (grain) { const q = (rnd() - 0.5) * 2 * grain; r += q; g += q; b += q; }
    data[i] = r; data[i + 1] = g; data[i + 2] = b;   // Uint8ClampedArray clamps and rounds
  }
  return img;
}

export function renderLook(src, look, maxDim = 1280, quality = 0.86) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const s = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * s)); height = Math.max(1, Math.round(height * s));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      if (!isPlain(look)) {
        const id = ctx.getImageData(0, 0, width, height);
        applyLook(id, look);
        ctx.putImageData(id, 0, 0);
      }
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}
