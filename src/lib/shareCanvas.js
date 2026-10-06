// shareCanvas — the passport share images (moved out of PassportBook.jsx on
// 2026-09-28 so each destination's composition can be rendered and checked on
// its own). Canvas-only: no React, no DOM beyond <canvas> and <img>.
const NAVY_DEEP = "#071B33", GOLD = "#D6A64A", STAMP = "#B0472F";

// Share destinations (founder, 2026-09-28: Instagram, Facebook, TikTok,
// Snapchat, X story and post, plus messages — every component inside each
// platform's safe area). Sizes and keep-clear bands come from the platforms'
// own creative specs, checked 2026-09-28: Meta story 14% top / 35% bottom for
// ads, the organic reply bar ~300 px; TikTok's safe-zone overlay (top 240,
// bottom 484 organic–660 ads, right-hand buttons 140–300 px); Snap top 150 /
// bottom 330; Instagram feed 4:5 and, since 2025, 3:4 (its grid crops to
// 3:4); X shows 3:4 uncropped; chats get a 4:5 card. px on a 1080-wide canvas.
// Text never under 40 px there (Apple's 11 pt floor at phone width ≈ 30 px).
export const SHARE_PRESETS = {
  story_meta:   { W: 1080, H: 1920, top: 280, bottom: 300, right: 60,  kind: "story" }, // Instagram / Facebook / WhatsApp Status
  story_tiktok: { W: 1080, H: 1920, top: 240, bottom: 500, right: 170, kind: "story" }, // TikTok photo post + story
  story_snap:   { W: 1080, H: 1920, top: 170, bottom: 340, right: 60,  kind: "story" },
  post_3x4:     { W: 1080, H: 1440, top: 36,  bottom: 36,  right: 40,  kind: "post" },  // Instagram feed, X
  post_4x5:     { W: 1080, H: 1350, top: 36,  bottom: 36,  right: 40,  kind: "post" },  // Facebook feed, chats
};
// uses → preset; max = images per share (Instagram carousel 20, TikTok photo
// mode 35, X 4; stories take one).
export const SHARE_TARGETS = [
  { id: "instagram", label: "Instagram", uses: { story: "story_meta", post: "post_3x4", message: "post_4x5" }, max: 20 },
  { id: "facebook",  label: "Facebook",  uses: { story: "story_meta", post: "post_4x5", message: "post_4x5" }, max: 10 },
  { id: "tiktok",    label: "TikTok",    uses: { post: "story_tiktok", story: "story_tiktok" }, max: 35 },
  { id: "snapchat",  label: "Snapchat",  uses: { story: "story_snap" }, max: 1 },
  { id: "x",         label: "X",         uses: { post: "post_3x4" }, max: 4 },
  { id: "whatsapp",  label: "WhatsApp",  uses: { story: "story_meta", message: "post_4x5" }, max: 10 },
  { id: "messages",  label: "Messages",  uses: { message: "post_4x5" }, max: 10 },
];
export const targetById = (id) => SHARE_TARGETS.find((t) => t.id === id) || SHARE_TARGETS[0];
export const shareUseLabel = (target, use) => (use === "story" && target === "whatsapp" ? "Status" : use === "post" && target === "tiktok" ? "Photo post" : use === "story" ? "Story" : use === "post" ? "Post" : "Message");
const SHARE_FOOTER = "collect stamps & memories where you go";
const SHARE_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, "Times New Roman", serif';
const SHARE_SANS = '-apple-system, "Inter Tight", system-ui, sans-serif';
const setSpacing = (ctx, px) => { try { ctx.letterSpacing = `${px}px`; } catch { /* older engines */ } };
function paintShareBackground(ctx, W, H) {
  const bg = ctx.createRadialGradient(W / 2, H * 0.2, 0, W / 2, H * 0.2, H * 0.95);
  bg.addColorStop(0, "#12365F"); bg.addColorStop(0.7, NAVY_DEEP); bg.addColorStop(1, NAVY_DEEP);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
}
export function brandShareCanvas(page, presetId = "story_meta", title = "My Virtual Passport") {
  const P = SHARE_PRESETS[presetId] || SHARE_PRESETS.story_meta;
  const { W, H } = P;
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  paintShareBackground(ctx, W, H);
  // Content column: 60 px on the left, clear of the platform's right-hand buttons.
  const left = 60, rightEdge = W - Math.max(60, P.right), cx = (left + rightEdge) / 2;
  ctx.textBaseline = "alphabetic";
  let zoneTop, zoneBottom;
  if (P.kind === "post") {
    // One line on top: GLOBESKIMMERS · My Virtual Passport (no platform UI over a feed image).
    const y = P.top + 58;
    ctx.font = `600 36px ${SHARE_SANS}`; setSpacing(ctx, 7);
    const bw = ctx.measureText("GLOBESKIMMERS").width;
    setSpacing(ctx, 0); ctx.font = `54px ${SHARE_SERIF}`;
    const tw = ctx.measureText(title).width;
    const gap = 44, x0 = cx - (bw + gap + tw) / 2;
    ctx.textAlign = "left";
    ctx.font = `600 36px ${SHARE_SANS}`; setSpacing(ctx, 7); ctx.fillStyle = GOLD; ctx.fillText("GLOBESKIMMERS", x0, y);
    setSpacing(ctx, 0); ctx.fillText("·", x0 + bw + gap * 0.36, y);
    ctx.font = `54px ${SHARE_SERIF}`; ctx.fillStyle = "#FBF6EC"; ctx.fillText(title, x0 + bw + gap, y);
    zoneTop = P.top + 92;
  } else {
    ctx.textAlign = "center";
    ctx.font = `600 44px ${SHARE_SANS}`; setSpacing(ctx, 12); ctx.fillStyle = GOLD;
    ctx.fillText("GLOBESKIMMERS", W / 2, P.top + 46);
    setSpacing(ctx, 0);
    ctx.font = `88px ${SHARE_SERIF}`; ctx.fillStyle = "#FBF6EC";
    ctx.fillText(title, W / 2, P.top + 140);
    zoneTop = P.top + 178;
  }
  // Footer: two lines just above the keep-clear band, centred on the content column.
  const f2 = H - P.bottom - 10, f1 = f2 - 52;
  ctx.textAlign = "center";
  ctx.font = `600 44px ${SHARE_SANS}`; ctx.fillStyle = "#FBF6EC"; ctx.fillText("globeskimmers.io", cx, f1);
  ctx.font = `500 40px ${SHARE_SANS}`; ctx.fillStyle = "rgba(251,246,236,0.9)"; ctx.fillText(SHARE_FOOTER, cx, f2, rightEdge - left);
  zoneBottom = f1 - 64;
  const zw = rightEdge - left, zh = zoneBottom - zoneTop;
  const k = Math.min(zh / page.height, zw / page.width);
  const pw = page.width * k, ph = page.height * k;
  ctx.drawImage(page, left + (zw - pw) / 2, zoneTop + (zh - ph) / 2, pw, ph);
  return out;
}
export const composeShare = async (pageCanvas, presetId, title) => {
  const canvas = brandShareCanvas(pageCanvas, presetId, title);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("the image could not be encoded");
  return { url: URL.createObjectURL(blob), blob, dataUrl: canvas.toDataURL("image/png") };
};

// Carousel posts (founder, 2026-09-28): slide 1 is the stamp page; each memory
// photo on that page becomes its own 1080×1350 slide, cover-cropped (never
// stretched), with a dark band along the bottom carrying a SOLID red "I was
// here!", the place, city · country · date and the brand line — the top of
// the photo stays clear for the view. Instagram takes up to 10 images.
export const MAX_PHOTO_SLIDES = 9;
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";   // /pp-photo/ answers with CORS *, so the canvas stays exportable
  const t = setTimeout(() => reject(new Error("a memory photo took too long to load")), 12000);
  img.onload = () => { clearTimeout(t); resolve(img); };
  img.onerror = () => { clearTimeout(t); reject(new Error("a memory photo couldn't be loaded")); };
  img.src = src;
});
const slideDate = (iso) => {
  if (!iso) return "";
  try { return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return iso; }
};
// Word-wrap `text` to `maxLines` lines that fit `maxW` at the context's current
// font; the last line gets an ellipsis when the text runs on.
function wrapText(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW || !line) { line = next; continue; }
    lines.push(line); line = words[i];
    if (lines.length === maxLines) { line = ""; break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && (line || lines.join(" ").length < text.length)) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.replace(/\s*\S+$/, "");
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

export async function photoSlide(src, stamp, presetId = "post_4x5") {
  const P = SHARE_PRESETS[presetId] || SHARE_PRESETS.post_4x5;
  const { W, H } = P;
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = NAVY_DEEP; ctx.fillRect(0, 0, W, H);
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  const pad = 64, maxW = W - pad - Math.max(pad, P.right);
  // Text stack from the bottom up, above the platform's keep-clear band.
  // A scene stamp adds "The scene from Title (Year)" between the place and the
  // city line (founder, 2026-09-28) — the title and year only, never a still.
  const film = stamp?.meta?.film && stamp.meta.film.title ? stamp.meta.film : null;
  const filmLine = film ? `The scene from ${film.title}${film.year ? ` (${film.year})` : ""}` : "";
  // The scene itself, at most two lines (founder, 2026-09-29: "include the context").
  ctx.font = `400 38px ${SHARE_SANS}`;
  const sceneLines = film && film.scene ? wrapText(ctx, String(film.scene), maxW, 2) : [];
  const brandY = H - P.bottom - 36, lineY = brandY - 62;
  const sceneY = lineY - 54;                                   // baseline of the LAST scene line
  const filmY = (sceneLines.length ? sceneY - (sceneLines.length - 1) * 46 - 52 : lineY - 58);
  const nameY = (film ? filmY : lineY) - 74;
  const name = String(stamp?.name || "");
  let size = 72;
  ctx.font = `${size}px ${SHARE_SERIF}`;
  while (size > 44 && ctx.measureText(name).width > maxW) { size -= 2; ctx.font = `${size}px ${SHARE_SERIF}`; }
  const pillH = 66, pillY = nameY - size - 20 - pillH;
  const bandTop = Math.max(0, pillY - 150);
  const g = ctx.createLinearGradient(0, bandTop, 0, H);
  g.addColorStop(0, "rgba(7,27,51,0)"); g.addColorStop(0.35, "rgba(7,27,51,0.66)"); g.addColorStop(1, "rgba(7,27,51,0.94)");
  ctx.fillStyle = g; ctx.fillRect(0, bandTop, W, H - bandTop);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // brand line
  ctx.font = `600 36px ${SHARE_SANS}`; setSpacing(ctx, 6); ctx.fillStyle = GOLD; ctx.fillText("GLOBESKIMMERS", pad, brandY);
  const bw = ctx.measureText("GLOBESKIMMERS").width; setSpacing(ctx, 0);
  ctx.font = `42px ${SHARE_SERIF}`; ctx.fillStyle = "#FBF6EC"; ctx.fillText("·  My Virtual Passport", pad + bw + 16, brandY, maxW - bw - 16);
  // city · country · date
  const where = [stamp?.city, stamp?.country].filter(Boolean).join(", ");
  const line = [where, slideDate(stamp?.visited_on)].filter(Boolean).join("  ·  ");
  ctx.font = `500 40px ${SHARE_SANS}`; ctx.fillStyle = "rgba(251,246,236,0.92)";
  if (line) ctx.fillText(line, pad, lineY, maxW);
  // the film, in gold italic under the place, then the scene in one or two lines
  if (filmLine) { ctx.font = `italic 42px ${SHARE_SERIF}`; ctx.fillStyle = GOLD; ctx.fillText(filmLine, pad, filmY, maxW); }
  if (sceneLines.length) {
    ctx.font = `400 38px ${SHARE_SANS}`; ctx.fillStyle = "rgba(251,246,236,0.92)";
    sceneLines.forEach((l, i) => ctx.fillText(l, pad, sceneY - (sceneLines.length - 1 - i) * 46));
  }
  // the place
  ctx.font = `${size}px ${SHARE_SERIF}`; ctx.fillStyle = "#FFFFFF"; ctx.fillText(name, pad, nameY);
  // solid red "I was here!"
  ctx.font = `italic 700 44px ${SHARE_SERIF}`;
  const lw = ctx.measureText("I was here!").width;
  ctx.fillStyle = STAMP;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(pad, pillY, lw + 48, pillH, 14); ctx.fill(); } else ctx.fillRect(pad, pillY, lw + 48, pillH);
  ctx.fillStyle = "#FFFFFF"; ctx.fillText("I was here!", pad + 24, pillY + 47);
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
  if (!blob) throw new Error("a slide could not be encoded");
  return { blob, url: URL.createObjectURL(blob), dataUrl: c.toDataURL("image/jpeg", 0.92) };
}
