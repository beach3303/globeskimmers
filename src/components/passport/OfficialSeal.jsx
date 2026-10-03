import React, { useId } from "react";

// The GlobeSkimmers Seal — our verification mark (founder, 2026-10-03).
// NOT a social-media checkmark: a miniature official rubber-stamp seal in the
// house worn-ink style (dashed ring + star), the same visual language as the
// passport stamps. Granted only through the Admin portal, in three inks:
//   gold     — Honored: people the founder honors (foil, the rarest)
//   burgundy — Official: businesses, partners, public figures
//   teal     — House: GlobeSkimmers' own team accounts
const TIERS = {
  gold: { label: "Honored — the GlobeSkimmers Gold Seal" },
  burgundy: { ink: "#7A1F2B", label: "Official — the GlobeSkimmers Seal" },
  teal: { ink: "#0E7C86", label: "GlobeSkimmers team" },
};

export default function OfficialSeal({ size = 13, tier = "burgundy", style }) {
  const t = TIERS[tier] || TIERS.burgundy;
  const foil = `seal-foil-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const paint = tier === "gold" ? `url(#${foil})` : t.ink;
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={t.label}
      style={{ display: "inline", verticalAlign: "-2px", marginLeft: 3, ...style }}
    >
      <title>{t.label}</title>
      {tier === "gold" && (
        <defs>
          <linearGradient id={foil} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8A6A12" />
            <stop offset="0.45" stopColor="#E2C35A" />
            <stop offset="1" stopColor="#A67C1A" />
          </linearGradient>
        </defs>
      )}
      <circle cx="10" cy="10" r="8.6" fill="none" stroke={paint} strokeWidth="1.7" strokeDasharray="2.4 1.6" strokeLinecap="round" />
      <path
        d="M10 4.6 L11.45 8.1 L15.2 8.35 L12.3 10.75 L13.25 14.4 L10 12.35 L6.75 14.4 L7.7 10.75 L4.8 8.35 L8.55 8.1 Z"
        fill={paint}
      />
    </svg>
  );
}
