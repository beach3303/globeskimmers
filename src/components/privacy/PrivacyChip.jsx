// PrivacyChip — one of the four privacy words as a small pill, each in its own colour, so they are
// told apart at a glance and read the same everywhere (founder, 2026-10-28: "easy to look at, easy
// to distinguish even by labels and design"). Icon + word always; colour only helps.
//
//   <PrivacyChip level="me" />                → 🔒 Only me
//   <PrivacyChip level="public" count={3} short /> → 🌍 3   (spoken "3 Everyone")
//   size: 'sm' (default) | 'xs'
import React from "react";
import { AUD } from "@/lib/audience";

export const PRIVACY_TONE = {
  me:        { bg: "#ECE9E4", ink: "#3D3A36", line: "#CFC8BD" },
  inner:     { bg: "#E1F2E7", ink: "#1D6B43", line: "#B5DCC3" },
  followers: { bg: "#E4ECF8", ink: "#2B4A7E", line: "#BBCDE9" },
  public:    { bg: "#FBEFCF", ink: "#7A5200", line: "#E8CC86" },
};

export default function PrivacyChip({ level, count = null, short = false, size = "sm", style = undefined }) {
  const a = AUD[level];
  if (!a) return null;
  const t = PRIVACY_TONE[level];
  const px = size === "xs" ? 9.5 : 11.5;
  const spoken = `${count != null ? `${count} ` : ""}${a.label}`;
  return (
    <span role="img" aria-label={spoken} title={spoken}
      style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: size === "xs" ? (short ? "1px 5px" : "1px 6px") : "2px 8px", borderRadius: 999,
        background: t.bg, color: t.ink, border: `1px solid ${t.line}`, fontSize: `calc(${px}px * var(--fs, 1))`, fontWeight: 650,
        lineHeight: 1.3, whiteSpace: "nowrap", ...style }}>
      <span aria-hidden="true">{a.icon}</span>
      {count != null ? <span aria-hidden="true">{count}</span> : null}
      {!short ? <span aria-hidden="true">{a.label}</span> : null}
    </span>
  );
}
