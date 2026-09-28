// Which edge of a photo can take a stamp without hiding the view (founder,
// 2026-09-28: "the stamp at the top or bottom of the photo, depending on
// making sure the stamp does not block the iconic photo").
//
// The photo is drawn small into a canvas, cropped the way the page crops it
// (object-fit: cover into boxW × boxH), and the top and bottom bands are
// compared by edge energy: the mean brightness change between neighbouring
// pixels. Open sky, water or a blank wall scores low; a crowd, a facade or a
// skyline scores high. The stamp goes on top only when the top band is
// clearly calmer, since below the photo is the page's default.
//
// Needs CORS on the image (the /pp-photo/ R2 files send it). Any failure, a
// tainted canvas included, answers "bottom".
const cache = new Map();

function lum(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

export function bandEnergy(data, w, h, y0, y1) {
  let sum = 0, n = 0;
  for (let y = Math.max(0, y0); y < Math.min(h - 1, y1); y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const l = lum(data, i);
      sum += Math.abs(l - lum(data, i + 4)) + Math.abs(l - lum(data, i + w * 4));
      n += 2;
    }
  }
  return n ? sum / n : 0;
}

// Pure decision, kept apart so it can be tested without a browser canvas.
export function pickEdge(top, bottom) {
  return top < bottom * 0.7 && top < 12 ? "top" : "bottom";
}

export function calmEdge(src, boxW, boxH) {
  const aspect = boxW > 0 && boxH > 0 ? boxW / boxH : 1.25;
  const key = `${src}|${aspect.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);
  const job = new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const iw = img.naturalWidth, ih = img.naturalHeight;
          if (!iw || !ih) return resolve("bottom");
          let sx = 0, sy = 0, sw = iw, sh = ih;
          if (iw / ih > aspect) { sw = ih * aspect; sx = (iw - sw) / 2; } else { sh = iw / aspect; sy = (ih - sh) / 2; }
          const W = 64, H = Math.max(24, Math.round(W / aspect));
          const c = document.createElement("canvas");
          c.width = W; c.height = H;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
          const { data } = ctx.getImageData(0, 0, W, H);
          const band = Math.round(H * 0.25);
          resolve(pickEdge(bandEnergy(data, W, H, 0, band), bandEnergy(data, W, H, H - band, H)));
        } catch { resolve("bottom"); }
      };
      img.onerror = () => resolve("bottom");
      img.src = src;
    } catch { resolve("bottom"); }
  });
  cache.set(key, job);
  return job;
}
