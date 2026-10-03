import React from "react";

// The GlobeSkimmers Seal — our verification mark (founder, 2026-10-03).
// NOT a social-media checkmark: a miniature official rubber-stamp seal in the
// house worn-ink style (dashed ring + star), the same visual language as the
// passport stamps. Reserved for official figures, official businesses, and
// founder-gifted accounts; granted only through the Admin portal.
export default function OfficialSeal({ size = 13, ink = "#0E7C86", style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" role="img"
      aria-label="Official — the GlobeSkimmers Seal"
      style={{ display: "inline", verticalAlign: "-2px", marginLeft: 3, ...style }}
    >
      <title>Official — the GlobeSkimmers Seal</title>
      <circle cx="10" cy="10" r="8.6" fill="none" stroke={ink} strokeWidth="1.7" strokeDasharray="2.4 1.6" strokeLinecap="round" />
      <path
        d="M10 4.6 L11.45 8.1 L15.2 8.35 L12.3 10.75 L13.25 14.4 L10 12.35 L6.75 14.4 L7.7 10.75 L4.8 8.35 L8.55 8.1 Z"
        fill={ink}
      />
    </svg>
  );
}
