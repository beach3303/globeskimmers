import React, { useId } from "react";

// The GlobeSkimmers Seal — our verification mark (founder, 2026-10-03).
// NOT a social-media checkmark: a miniature official rubber-stamp seal in the
// house worn-ink style (dashed ring + star), the same visual language as the
// passport stamps. Granted only through the Admin portal, in three inks:
//   gold     — Honored: people OR businesses the founder honors (a gift, never a category; foil, the rarest)
//   burgundy — Official: businesses, partners, public figures
//   teal     — House: GlobeSkimmers' own team accounts
//   sunshine — Friends & Family: daffodil (never metallic — gold must outshine
//              it), founder picks the glyph per person: heart or star
// On DARK surfaces every ink brightens a step and gains a faint ink-glow halo
// (founder 2026-10-03: "improve popping the seal colors on dark") — pass
// dark when the seal sits on a dark card, map chrome, or a share graphic.
const TIERS = {
  gold: {
    label: "Honored — the GlobeSkimmers Gold Seal",
    // Rich engraved metal — deep bronze shadow to bright highlight, so gold
    // always outshines the Sunshine (friends & family) daffodil yellow.
    foil: ["#6B4F09", "#F2D878", "#9A7414"],
    foilDark: ["#A87E16", "#FFE98F", "#C9A227"],
    glow: "rgba(226,195,90,.55)",
  },
  burgundy: {
    label: "Official — the GlobeSkimmers Seal",
    ink: "#7A1F2B", inkDark: "#C8536A", glow: "rgba(200,83,106,.5)",
  },
  teal: {
    label: "GlobeSkimmers team",
    ink: "#0E7C86", inkDark: "#2EB8C4", glow: "rgba(46,184,196,.5)",
  },
  "sunshine-heart": {
    label: "Friends & Family — the Sunshine Seal",
    foil: ["#FFC400", "#FFE565", "#FFB300"],
    foilDark: ["#FFB628", "#FFEFAF", "#FFC53D"],
    glow: "rgba(255,197,61,.6)", glyph: "heart",
  },
  "sunshine-star": {
    label: "Friends & Family — the Sunshine Seal",
    foil: ["#FFC400", "#FFE565", "#FFB300"],
    foilDark: ["#FFB628", "#FFEFAF", "#FFC53D"],
    glow: "rgba(255,197,61,.6)", glyph: "star",
  },
};
const STAR_D = "M10 4.6 L11.45 8.1 L15.2 8.35 L12.3 10.75 L13.25 14.4 L10 12.35 L6.75 14.4 L7.7 10.75 L4.8 8.35 L8.55 8.1 Z";
const HEART_D = "M10 15.6 C8.1 13.8 4.8 11.4 4.8 8.5 C4.8 6.6 6.3 5.2 8 5.2 C9 5.2 9.7 5.8 10 6.3 C10.3 5.8 11 5.2 12 5.2 C13.7 5.2 15.2 6.6 15.2 8.5 C15.2 11.4 11.9 13.8 10 15.6 Z";

export default function OfficialSeal({ size = 13, tier = "burgundy", dark = false, style }) {
  const t = TIERS[tier] || TIERS.burgundy;
  const foil = `seal-foil-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stops = t.foil ? (dark ? t.foilDark : t.foil) : null;
  const paint = stops ? `url(#${foil})` : dark ? t.inkDark : t.ink;
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={t.label}
      style={{
        display: "inline", verticalAlign: "-2px", marginLeft: 3,
        filter: dark ? `drop-shadow(0 0 ${Math.max(1.5, size / 8)}px ${t.glow})` : undefined,
        ...style,
      }}
    >
      <title>{t.label}</title>
      {stops && (
        <defs>
          <linearGradient id={foil} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={stops[0]} />
            <stop offset="0.45" stopColor={stops[1]} />
            <stop offset="1" stopColor={stops[2]} />
          </linearGradient>
        </defs>
      )}
      <circle cx="10" cy="10" r="8.6" fill="none" stroke={paint} strokeWidth="1.7" strokeDasharray="2.4 1.6" strokeLinecap="round" />
      <path d={t.glyph === "heart" ? HEART_D : STAR_D} fill={paint} />
    </svg>
  );
}
