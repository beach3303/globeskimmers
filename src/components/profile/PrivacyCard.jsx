// PrivacyCard: who can open your passport (Profile.dc.html L213-226; bible.profile.sections
// 7, word.lines). A plain white card, because it is a setting: 'Your passport is
// *private*' (or *public*) with the inner-circle sentence, and a switch whose state is
// also printed in words. The flow is today's: going public asks the age gate first (the
// OS age range when the platform has one, else the birthday field), a teen or an under-13
// answer stops there, and a public passport offers its link to copy.
//
//   <PrivacyCard cloth share onShare className style />
//   share     { is_public, url } as /passport/share reads it; null while it loads.
//   onShare   receives the new { is_public, url } after a change.
// Renders nothing for a 13-17 account (the page shows TeenHoldNote instead).
import React, { useState } from "react";
import { Copy, Globe, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { getShareLink, setAgeGate, splitDob } from "@/lib/passport";
import { readOsAgeRange, birthYearFromRange } from "@/lib/ageSignal";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const TRACK_OFF = "#D8D2C6";

/**
 * @param {{ cloth?: any, share?: { is_public: boolean, url: string|null }|null, onShare?: (s: any) => void, className?: string, style?: import('react').CSSProperties }} props
 */
export default function PrivacyCard({ cloth = undefined, share = null, onShare = undefined, className = undefined, style = undefined }) {
  const { socialTier, refreshSocialTier } = useAuth();
  const c = clothRow(cloth);
  const [busy, setBusy] = useState(false);
  const [needYear, setNeedYear] = useState(false);
  const [yearDraft, setYearDraft] = useState("");

  if (socialTier === "teen") return null;

  const loaded = !!share;
  const isPublic = !!share?.is_public;
  const apply = (next) => { if (typeof onShare === "function") onShare(next); };

  const toggleShare = async () => {
    if (busy || !loaded) return;
    setBusy(true);
    if (needYear) {
      const dob = splitDob(yearDraft);
      if (!dob) { setBusy(false); showToast("Enter your full birthday", "error"); return; }
      const { error: ageErr } = await setAgeGate(dob.year, dob.md);
      if (ageErr && ageErr !== "age_required") { setBusy(false); showToast(ageErr, "error"); return; }
      setNeedYear(false);
      const tier = await refreshSocialTier(); // a teen sees the hold, an under-13 the freeze, right away
      if (tier === "teen" || tier === "blocked") { setBusy(false); return; }
    }
    const next = !isPublic;
    const { data, error } = await getShareLink(next);
    setBusy(false);
    if (error === "age_required") {
      const os = await readOsAgeRange();
      const osYear = birthYearFromRange(os);
      if (osYear) {
        const { error: ageErr } = await setAgeGate(osYear);
        if (!ageErr) { refreshSocialTier(); toggleShare(); return; }
      }
      setNeedYear(true); showToast("One thing first — your birthday", "success"); return;
    }
    if (error) { showToast(error, "error"); return; }
    apply({ is_public: !!data.is_public, url: data.url || null });
    showToast(data.is_public ? "Your passport is public — anyone with the link can view it" : "Private — just you and your inner circle now", "success");
  };

  const copyLink = async () => {
    if (!share?.url) return;
    try { await navigator.clipboard.writeText(share.url); showToast("Link copied", "success"); }
    catch { showToast(share.url, "success"); }
  };

  const Knob = isPublic ? Globe : Lock;
  return (
    <section aria-label="Who can see your passport" className={className}
      style={{ boxSizing: "border-box", padding: 16, background: NEUTRAL.white, border: `1px solid ${c.line}`, borderRadius: 16, "--gs-focus": c.cloth, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(17), lineHeight: 20 / 17, fontWeight: 400, color: NEUTRAL.ink }}>
            Your passport is <em style={{ fontStyle: "italic", color: c.cloth }}>{loaded ? (isPublic ? "public" : "private") : "…"}</em>
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: fs(12.5), lineHeight: 18 / 12.5, color: NEUTRAL.ink3 }}>
            {isPublic
              ? "Anyone with the link can view the booklet: photos only after review, never your locations."
              : "Just you and your inner circle: people you follow who follow you back. Flip to public to share with anyone by link."}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <button type="button" role="switch" aria-checked={isPublic} aria-label="Public passport" onClick={toggleShare}
            aria-disabled={busy || !loaded || undefined} aria-busy={busy || undefined}
            style={{ position: "relative", display: "block", width: 52, height: 44, padding: 0, background: "transparent", border: 0, cursor: busy || !loaded ? "default" : "pointer", opacity: loaded ? 1 : 0.5 }}>
            <span aria-hidden="true" style={{ position: "absolute", left: 3, top: 9, width: 46, height: 26, borderRadius: 999, background: isPublic ? NEUTRAL.brandTeal : TRACK_OFF, transition: "background .15s" }} />
            <span aria-hidden="true" style={{ position: "absolute", left: isPublic ? 26 : 6, top: 12, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: NEUTRAL.white, boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "left .15s" }}>
              <Knob size={11} strokeWidth={2.4} color={isPublic ? NEUTRAL.brandTeal : NEUTRAL.ink2} aria-hidden="true" focusable="false" />
            </span>
          </button>
          <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: fs(9), lineHeight: 12 / 9, fontWeight: 500, letterSpacing: ".14em", color: NEUTRAL.ink3 }}>
            {loaded ? (isPublic ? "PUBLIC" : "PRIVATE") : ""}
          </span>
        </div>
      </div>

      {needYear && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input type="date" value={yearDraft} onChange={(e) => setYearDraft(e.target.value)}
            min="1900-01-01" max={new Date().toISOString().slice(0, 10)} aria-label="Your birthday"
            style={{ flex: 1, minWidth: 0, height: 44, boxSizing: "border-box", padding: "0 12px", borderRadius: 12, background: NEUTRAL.white, border: `1px solid ${c.fieldLine}`, fontSize: fs(14), color: NEUTRAL.ink, outline: "none" }} />
          <button type="button" onClick={toggleShare} disabled={!splitDob(yearDraft) || busy}
            style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, background: c.cloth, border: 0, fontFamily: "inherit", fontSize: fs(13.5), fontWeight: 600, color: NEUTRAL.white, opacity: !splitDob(yearDraft) || busy ? 0.5 : 1 }}>
            Continue
          </button>
        </div>
      )}
      {isPublic && share?.url && (
        <button type="button" onClick={copyLink} aria-label={`Copy your passport link, ${share.url}`}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, marginTop: 12, padding: "0 12px", borderRadius: 12, background: c.paper, border: `1px solid ${c.line}`, textAlign: "left", cursor: "pointer" }}>
          <Copy size={14} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO, fontSize: fs(11.5), color: NEUTRAL.ink2 }}>{share.url}</span>
        </button>
      )}
    </section>
  );
}
