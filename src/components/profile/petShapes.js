// Travel-buddy vector art (founder, 2026-10-05): chibi pets in three poses —
// sitting, laying, belly-up. The generic species drawing is the FALLBACK; a
// per-breed render uploaded to R2 at stamp-art/pets/<species>/<breed>/<pose>.webp
// takes over automatically, exactly like the luggage skins. Each function
// returns an SVG inner string for a 340×340 canvas, tinted by the coat
// { body, belly, ear }.
/* eslint-disable */
const face = (cx, cy, s = 1, sleepy = true) => `
  <path d="M${cx - 14 * s},${cy} q5,${6 * s} 10,0" stroke="#3A2E24" stroke-width="${3 * s}" fill="none" stroke-linecap="round"/>
  <path d="M${cx + 4 * s},${cy} q5,${6 * s} 10,0" stroke="#3A2E24" stroke-width="${3 * s}" fill="none" stroke-linecap="round"/>
  <circle cx="${cx - 17 * s}" cy="${cy + 10 * s}" r="${4.5 * s}" fill="#E8A5A0" opacity=".6"/>
  <circle cx="${cx + 17 * s}" cy="${cy + 10 * s}" r="${4.5 * s}" fill="#E8A5A0" opacity=".6"/>
  <path d="M${cx - 3 * s},${cy + 9 * s} q3,3 6,0" stroke="#3A2E24" stroke-width="${2.4 * s}" fill="none" stroke-linecap="round"/>`;

const dog = (pose, c) => {
  const { body: B, belly: L, ear: E } = c;
  if (pose === "sitting") return `
    <ellipse cx="170" cy="252" rx="86" ry="62" fill="${B}"/>
    <ellipse cx="170" cy="272" rx="52" ry="38" fill="${L}"/>
    <ellipse cx="108" cy="296" rx="26" ry="14" fill="${B}"/><ellipse cx="232" cy="296" rx="26" ry="14" fill="${B}"/>
    <path d="M250,240 q34,-6 30,-38" stroke="${B}" stroke-width="18" fill="none" stroke-linecap="round"/>
    <circle cx="170" cy="150" r="78" fill="${B}"/>
    <path d="M100,110 q-16,46 8,64 q10,-34 28,-44 Z" fill="${E}"/>
    <path d="M240,110 q16,46 -8,64 q-10,-34 -28,-44 Z" fill="${E}"/>
    <ellipse cx="170" cy="182" rx="26" ry="18" fill="${L}"/>
    <ellipse cx="170" cy="172" rx="9" ry="7" fill="#3A2E24"/>
    ${face(170, 152)}`;
  if (pose === "laying") return `
    <ellipse cx="192" cy="266" rx="112" ry="48" fill="${B}"/>
    <ellipse cx="196" cy="282" rx="76" ry="26" fill="${L}"/>
    <ellipse cx="128" cy="304" rx="30" ry="12" fill="${B}"/><ellipse cx="250" cy="304" rx="30" ry="12" fill="${B}"/>
    <path d="M296,252 q28,-12 20,-40" stroke="${B}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <circle cx="106" cy="188" r="66" fill="${B}"/>
    <path d="M48,152 q-14,40 8,56 q8,-30 24,-38 Z" fill="${E}"/>
    <path d="M164,152 q14,40 -8,56 q-8,-30 -24,-38 Z" fill="${E}"/>
    <ellipse cx="106" cy="216" rx="22" ry="15" fill="${L}"/>
    <ellipse cx="106" cy="207" rx="8" ry="6" fill="#3A2E24"/>
    ${face(106, 190, 0.9)}`;
  return `
    <ellipse cx="170" cy="250" rx="96" ry="54" fill="${B}"/>
    <ellipse cx="170" cy="242" rx="64" ry="38" fill="${L}"/>
    <ellipse cx="110" cy="206" rx="15" ry="24" fill="${B}" transform="rotate(-14 110 206)"/>
    <ellipse cx="230" cy="206" rx="15" ry="24" fill="${B}" transform="rotate(14 230 206)"/>
    <ellipse cx="128" cy="292" rx="15" ry="22" fill="${B}" transform="rotate(14 128 292)"/>
    <ellipse cx="212" cy="292" rx="15" ry="22" fill="${B}" transform="rotate(-14 212 292)"/>
    <path d="M262,278 q30,8 36,-16" stroke="${B}" stroke-width="15" fill="none" stroke-linecap="round"/>
    <circle cx="170" cy="138" r="62" fill="${B}"/>
    <path d="M116,104 q-14,38 6,52 q8,-27 22,-35 Z" fill="${E}"/>
    <path d="M224,104 q14,38 -6,52 q-8,-27 -22,-35 Z" fill="${E}"/>
    <ellipse cx="170" cy="164" rx="21" ry="14" fill="${L}"/>
    <ellipse cx="170" cy="156" rx="7.5" ry="6" fill="#3A2E24"/>
    ${face(170, 140, 0.85)}`;
};
const cat = (pose, c) => {
  const { body: B, belly: L, ear: E } = c;
  const ears = (cx, cy, s = 1) => `
    <path d="M${cx - 52 * s},${cy - 28 * s} L${cx - 58 * s},${cy - 74 * s} L${cx - 18 * s},${cy - 52 * s} Z" fill="${B}"/>
    <path d="M${cx - 46 * s},${cy - 36 * s} L${cx - 50 * s},${cy - 62 * s} L${cx - 26 * s},${cy - 48 * s} Z" fill="${E}"/>
    <path d="M${cx + 52 * s},${cy - 28 * s} L${cx + 58 * s},${cy - 74 * s} L${cx + 18 * s},${cy - 52 * s} Z" fill="${B}"/>
    <path d="M${cx + 46 * s},${cy - 36 * s} L${cx + 50 * s},${cy - 62 * s} L${cx + 26 * s},${cy - 48 * s} Z" fill="${E}"/>`;
  const whisk = (cx, cy, s = 1) => `
    <path d="M${cx - 30 * s},${cy + 6 * s} l${-26 * s},-4 M${cx - 30 * s},${cy + 12 * s} l${-26 * s},3" stroke="#3A2E24" stroke-width="${1.8 * s}" stroke-linecap="round"/>
    <path d="M${cx + 30 * s},${cy + 6 * s} l${26 * s},-4 M${cx + 30 * s},${cy + 12 * s} l${26 * s},3" stroke="#3A2E24" stroke-width="${1.8 * s}" stroke-linecap="round"/>`;
  if (pose === "sitting") return `
    <path d="M110,306 Q96,206 170,200 Q244,206 230,306 Z" fill="${B}"/>
    <ellipse cx="170" cy="296" rx="44" ry="26" fill="${L}"/>
    <path d="M228,292 q42,4 40,-34" stroke="${B}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <circle cx="170" cy="150" r="70" fill="${B}"/>
    ${ears(170, 150)}
    ${face(170, 152)}
    ${whisk(170, 152)}`;
  if (pose === "laying") return `
    <path d="M70,296 Q66,238 130,234 L250,234 Q296,238 292,272 Q294,296 268,296 Z" fill="${B}"/>
    <ellipse cx="180" cy="294" rx="80" ry="14" fill="${L}"/>
    <path d="M288,272 q26,-10 18,-36" stroke="${B}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="106" cy="196" r="60" fill="${B}"/>
    ${ears(106, 196, 0.86)}
    ${face(106, 198, 0.9)}
    ${whisk(106, 198, 0.9)}`;
  return `
    <ellipse cx="170" cy="252" rx="88" ry="50" fill="${B}"/>
    <ellipse cx="170" cy="244" rx="58" ry="34" fill="${L}"/>
    <ellipse cx="116" cy="208" rx="13" ry="22" fill="${B}" transform="rotate(-14 116 208)"/>
    <ellipse cx="224" cy="208" rx="13" ry="22" fill="${B}" transform="rotate(14 224 208)"/>
    <ellipse cx="132" cy="290" rx="13" ry="20" fill="${B}" transform="rotate(12 132 290)"/>
    <ellipse cx="208" cy="290" rx="13" ry="20" fill="${B}" transform="rotate(-12 208 290)"/>
    <path d="M254,280 q34,6 38,-20" stroke="${B}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="170" cy="140" r="58" fill="${B}"/>
    ${ears(170, 140, 0.82)}
    ${face(170, 142, 0.85)}
    ${whisk(170, 142, 0.85)}`;
};
const hamster = (pose, c) => {
  const { body: B, belly: L, ear: E } = c;
  const earsH = (cx, cy, s = 1) => `
    <circle cx="${cx - 34 * s}" cy="${cy - 44 * s}" r="${15 * s}" fill="${B}"/>
    <circle cx="${cx - 34 * s}" cy="${cy - 44 * s}" r="${8 * s}" fill="${E}"/>
    <circle cx="${cx + 34 * s}" cy="${cy - 44 * s}" r="${15 * s}" fill="${B}"/>
    <circle cx="${cx + 34 * s}" cy="${cy - 44 * s}" r="${8 * s}" fill="${E}"/>`;
  if (pose === "sitting") return `
    <ellipse cx="170" cy="212" rx="96" ry="104" fill="${B}"/>
    <ellipse cx="170" cy="248" rx="62" ry="56" fill="${L}"/>
    ${earsH(170, 150)}
    <ellipse cx="140" cy="296" rx="18" ry="10" fill="${E}"/><ellipse cx="200" cy="296" rx="18" ry="10" fill="${E}"/>
    <ellipse cx="136" cy="232" rx="13" ry="10" fill="${B}" stroke="${E}" stroke-width="2"/>
    <ellipse cx="204" cy="232" rx="13" ry="10" fill="${B}" stroke="${E}" stroke-width="2"/>
    ${face(170, 158, 1.05)}`;
  if (pose === "laying") return `
    <ellipse cx="180" cy="248" rx="118" ry="70" fill="${B}"/>
    <ellipse cx="186" cy="276" rx="80" ry="34" fill="${L}"/>
    ${earsH(112, 212, 0.9)}
    <ellipse cx="90" cy="282" rx="16" ry="9" fill="${E}"/><ellipse cx="150" cy="300" rx="16" ry="9" fill="${E}"/>
    ${face(112, 218, 0.95)}`;
  return `
    <ellipse cx="170" cy="236" rx="104" ry="80" fill="${B}"/>
    <ellipse cx="170" cy="228" rx="70" ry="54" fill="${L}"/>
    <ellipse cx="118" cy="184" rx="13" ry="18" fill="${B}" transform="rotate(-16 118 184)"/>
    <ellipse cx="222" cy="184" rx="13" ry="18" fill="${B}" transform="rotate(16 222 184)"/>
    <ellipse cx="130" cy="290" rx="13" ry="17" fill="${B}" transform="rotate(12 130 290)"/>
    <ellipse cx="210" cy="290" rx="13" ry="17" fill="${B}" transform="rotate(-12 210 290)"/>
    <circle cx="170" cy="130" r="54" fill="${B}"/>
    <circle cx="136" cy="92" r="13" fill="${B}"/><circle cx="136" cy="92" r="7" fill="${E}"/>
    <circle cx="204" cy="92" r="13" fill="${B}"/><circle cx="204" cy="92" r="7" fill="${E}"/>
    ${face(170, 130, 0.85)}`;
};
const bird = (pose, c) => {
  const { body: B, belly: L, ear: E } = c;
  if (pose === "sitting") return `
    <ellipse cx="170" cy="190" rx="78" ry="92" fill="${B}"/>
    <ellipse cx="170" cy="226" rx="50" ry="52" fill="${L}"/>
    <path d="M226,160 q44,30 18,92 q-18,-24 -34,-32 Z" fill="${E}"/>
    <path d="M170,116 l-12,-18 l24,0 Z" fill="#E8B04B" transform="rotate(90 170 112)"/>
    <path d="M158,140 q12,14 24,0 l-12,16 Z" fill="#E8B04B"/>
    <path d="M150,282 l-8,24 M150,282 l2,26 M190,282 l8,24 M190,282 l-2,26" stroke="#B98A3A" stroke-width="5" stroke-linecap="round"/>
    <path d="M246,266 q-20,34 -58,22" stroke="${E}" stroke-width="12" fill="none" stroke-linecap="round"/>
    ${face(170, 112, 0.9)}`;
  if (pose === "laying") return `
    <ellipse cx="176" cy="240" rx="104" ry="64" fill="${B}"/>
    <ellipse cx="180" cy="266" rx="70" ry="30" fill="${L}"/>
    <path d="M240,208 q50,22 28,80 q-20,-22 -38,-28 Z" fill="${E}"/>
    <path d="M100,196 q14,16 28,0 l-14,18 Z" fill="#E8B04B"/>
    <path d="M296,246 q10,-32 -16,-44" stroke="${E}" stroke-width="11" fill="none" stroke-linecap="round"/>
    ${face(112, 176, 0.9)}`;
  return `
    <ellipse cx="170" cy="222" rx="92" ry="74" fill="${B}"/>
    <ellipse cx="170" cy="212" rx="60" ry="48" fill="${L}"/>
    <path d="M108,180 q-26,-28 -8,-54 q16,12 26,32 Z" fill="${E}"/>
    <path d="M232,180 q26,-28 8,-54 q-16,12 -26,32 Z" fill="${E}"/>
    <path d="M158,120 q12,14 24,0 l-12,16 Z" fill="#E8B04B"/>
    <path d="M140,286 l-6,22 M140,286 l4,24 M200,286 l6,22 M200,286 l-4,24" stroke="#B98A3A" stroke-width="5" stroke-linecap="round"/>
    <circle cx="170" cy="118" r="46" fill="${B}"/>
    ${face(170, 114, 0.8)}`;
};
const reptile = (pose, c) => {
  const { body: B, belly: L, ear: E } = c;
  const crest = (pts) => `<path d="${pts}" fill="${E}"/>`;
  if (pose === "sitting") return `
    <path d="M96,290 Q92,210 170,204 Q250,210 244,290 Z" fill="${B}"/>
    <ellipse cx="170" cy="286" rx="46" ry="22" fill="${L}"/>
    <path d="M240,280 q56,6 54,-52 q-2,-30 -26,-38" stroke="${B}" stroke-width="17" fill="none" stroke-linecap="round"/>
    <ellipse cx="170" cy="146" rx="64" ry="54" fill="${B}"/>
    ${crest("M134,98 l10,-18 l8,16 l10,-18 l8,16 l10,-18 l10,16 l10,-16 l8,18 L170,100 Z")}
    ${face(170, 148, 0.95)}`;
  if (pose === "laying") return `
    <ellipse cx="176" cy="262" rx="110" ry="46" fill="${B}"/>
    <ellipse cx="180" cy="282" rx="76" ry="20" fill="${L}"/>
    <path d="M282,252 q54,0 48,-50" stroke="${B}" stroke-width="15" fill="none" stroke-linecap="round"/>
    <ellipse cx="104" cy="206" rx="54" ry="46" fill="${B}"/>
    ${crest("M72,166 l8,-16 l8,14 l8,-16 l8,14 l10,-16 l8,16 l8,-14 l8,16 L104,168 Z")}
    <ellipse cx="78" cy="300" rx="22" ry="9" fill="${B}"/><ellipse cx="190" cy="304" rx="22" ry="9" fill="${B}"/>
    ${face(104, 208, 0.85)}`;
  return `
    <ellipse cx="170" cy="246" rx="98" ry="52" fill="${B}"/>
    <ellipse cx="170" cy="238" rx="64" ry="36" fill="${L}"/>
    <ellipse cx="116" cy="202" rx="13" ry="21" fill="${B}" transform="rotate(-15 116 202)"/>
    <ellipse cx="224" cy="202" rx="13" ry="21" fill="${B}" transform="rotate(15 224 202)"/>
    <ellipse cx="130" cy="288" rx="13" ry="19" fill="${B}" transform="rotate(12 130 288)"/>
    <ellipse cx="210" cy="288" rx="13" ry="19" fill="${B}" transform="rotate(-12 210 288)"/>
    <path d="M260,270 q44,10 46,-34" stroke="${B}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <ellipse cx="170" cy="140" rx="52" ry="44" fill="${B}"/>
    ${crest("M132,104 l9,-16 l7,14 l9,-16 l7,14 l9,-16 l9,14 l9,-14 l7,16 L170,106 Z")}
    ${face(170, 142, 0.85)}`;
};

export const PET_SHAPES = { dog, cat, hamster, bird, reptile };
// The founder's photo renders (2026-10-05) come in SITTING and STANDING — the
// swipe cycles those two. The drawn chibi has no standing pose, so the fallback
// renderer maps standing → sitting; laying/belly-up drawings stay for any
// legacy pose value.
export const POSES = ["sitting", "standing"];
export const POSE_NAMES = { sitting: "Sitting", standing: "Standing", laying: "Laying", "belly-up": "Belly up" };
