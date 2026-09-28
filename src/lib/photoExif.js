// photoExif — read a photo's own location tag and capture time from the
// ORIGINAL file, before resizePhoto strips all metadata (founder, 2026-09-28:
// photo proof for passport stamps). Returns { lat, lng, taken_at } or null.
// Only these three values ever leave the device, and the worker uses them for
// one yes/no check without storing them. JPEG only: iOS hands the web picker a
// JPEG, but it may remove the location unless the traveler allows it, so
// "no location" is a normal answer, not an error.
export async function readPhotoExif(file) {
  try {
    if (!file || typeof file.slice !== "function") return null;
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.byteLength < 12 || v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 10 < v.byteLength) {
      const marker = v.getUint16(off);
      if ((marker & 0xff00) !== 0xff00) break;
      const len = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
      if (marker === 0xffda) break; // start of image data — no EXIF ahead
      off += 2 + len;
    }
    return null;
  } catch { return null; }
}

function parseTiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (o) => v.getUint16(t + o, le);
  const u32 = (o) => v.getUint32(t + o, le);
  const ifd = (o) => {
    const n = u16(o), out = {};
    for (let i = 0; i < n; i++) { const e = o + 2 + i * 12; out[u16(e)] = { count: u32(e + 4), at: e + 8 }; }
    return out;
  };
  const ascii = (ent) => {
    const o = ent.count > 4 ? u32(ent.at) : ent.at;
    let s = "";
    for (let i = 0; i < ent.count - 1; i++) s += String.fromCharCode(v.getUint8(t + o + i));
    return s;
  };
  const rational = (o) => u32(o) / (u32(o + 4) || 1);
  const dms = (ent) => { const o = u32(ent.at); return rational(o) + rational(o + 8) / 60 + rational(o + 16) / 3600; };
  const refChar = (ent) => String.fromCharCode(v.getUint8(t + ent.at));
  const root = ifd(u32(4));
  let taken = null;
  if (root[0x8769]) {
    const ex = ifd(u32(root[0x8769].at));
    const d = ex[0x9003] || ex[0x9004];
    if (d) taken = ascii(d);
  }
  if (!taken && root[0x0132]) taken = ascii(root[0x0132]);
  let lat = null, lng = null;
  if (root[0x8825]) {
    const g = ifd(u32(root[0x8825].at));
    if (g[2] && g[4]) {
      lat = dms(g[2]); lng = dms(g[4]);
      if (g[1] && refChar(g[1]) === "S") lat = -lat;
      if (g[3] && refChar(g[3]) === "W") lng = -lng;
    }
  }
  const takenAt = taken && /^\d{4}:\d{2}:\d{2}/.test(taken) ? `${taken.slice(0, 10).replace(/:/g, "-")}T${taken.slice(11, 19) || "00:00:00"}` : null;
  const okLat = Number.isFinite(lat) && Math.abs(lat) <= 90, okLng = Number.isFinite(lng) && Math.abs(lng) <= 180;
  if (!(okLat && okLng) && !takenAt) return null;
  return { lat: okLat && okLng ? lat : null, lng: okLat && okLng ? lng : null, taken_at: takenAt };
}
