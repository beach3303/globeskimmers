// PrivacyCard: who can see your passport (Profile.dc.html L213-226), in the four words every
// privacy setting uses (founder, 2026-10-26): 'Your passport: 🤝 Friends', what that means, and
// Change — the same sheet as the passport page and Settings → Privacy. Opening asks once;
// closing works at once. An Everyone passport offers its link to copy.
//
//   <PrivacyCard cloth share className style />
//   share     { is_public, url } as /passport/share reads it; null while it loads (the link).
// Renders nothing for a 13-17 account (the page shows TeenHoldNote instead).
import React, { useState } from "react";
import { Copy } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";
import { AUD, usePassportAudience } from "@/lib/audience";
import { PassportAudienceSheet } from "@/components/privacy/PassportPrivacy";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/**
 * @param {{ cloth?: any, share?: { is_public: boolean, url: string|null }|null, onShare?: (s: any) => void, className?: string, style?: import('react').CSSProperties }} props
 */
export default function PrivacyCard({ cloth = undefined, share = null, onShare = undefined, className = undefined, style = undefined }) {
  const { socialTier } = useAuth();
  const c = clothRow(cloth);
  const [aud] = usePassportAudience(socialTier !== "teen");
  const [open, setOpen] = useState(false);

  if (socialTier === "teen") return null;

  const a = AUD[aud];
  const copyLink = async () => {
    if (!share?.url) return;
    try { await navigator.clipboard.writeText(share.url); showToast("Link copied", "success"); }
    catch { showToast(share.url, "success"); }
  };

  return (
    <section aria-label="Who can see your passport" className={className}
      style={{ boxSizing: "border-box", padding: 16, background: NEUTRAL.white, border: `1px solid ${c.line}`, borderRadius: 16, "--gs-focus": c.cloth, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(17), lineHeight: 20 / 17, fontWeight: 400, color: NEUTRAL.ink }}>
            Your passport: <em style={{ fontStyle: "italic", color: c.cloth }}>{a ? `${a.icon} ${a.label}` : "…"}</em>
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: fs(12.5), lineHeight: 18 / 12.5, color: NEUTRAL.ink3 }}>
            {a ? `${a.line} The most anyone can see — each stamp and album can be more private.` : " "}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-label="Change who can see your passport"
          style={{ flexShrink: 0, minHeight: 44, padding: "0 16px", borderRadius: 12, background: c.paper, border: `1px solid ${c.line}`, fontFamily: "inherit", fontSize: fs(13.5), fontWeight: 650, color: c.cloth, cursor: "pointer" }}>
          Change
        </button>
      </div>
      {aud === "public" && share?.url && (
        <button type="button" onClick={copyLink} aria-label={`Copy your passport link, ${share.url}`}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, marginTop: 12, padding: "0 12px", borderRadius: 12, background: c.paper, border: `1px solid ${c.line}`, textAlign: "left", cursor: "pointer" }}>
          <Copy size={14} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO, fontSize: fs(11.5), color: NEUTRAL.ink2 }}>{share.url}</span>
        </button>
      )}
      {open && <PassportAudienceSheet onClose={() => setOpen(false)}
        onSaved={(v) => { if (typeof onShare === "function" && share) onShare({ ...share, is_public: v === "public" }); }} />}
    </section>
  );
}
