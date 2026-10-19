// StampEarnedSheet — the moment a stamp lands (growth plan, 2026-10-19: "ask at the right
// moment"). The stamp, its place and date, a green check when it was proven, and one offer:
// Share this stamp — a story-sized card (the art, the place, VERIFIED, the brand line and the
// member's passport link) through the phone's share sheet; a browser without file sharing gets
// the link instead. Shown by the Passport for adults only, for verified stamps only, never for
// a place of respect or a sensitive place (the caller decides). Done just closes it.
//
//   <StampEarnedSheet stamp slug onClose />
//   stamp   the worker's stamp row ({ id, name, city, country, visited_on, verified, entity_id, meta })
//   slug    the member's passport slug for the link (null = no link on the card)
import React, { useEffect, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import { stampCard } from "@/lib/shareCanvas";
import { stampArtUrl } from "@/lib/stampArt";
import { logEvent } from "@/lib/analytics";
import StampThumb from "@/components/passport/StampThumb";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const VERIFIED = new Set(["gps", "photo_loc", "photo_ai"]);

export default function StampEarnedSheet({ stamp = null, slug = null, onClose = undefined }) {
  const [busy, setBusy] = useState(false);
  const open = !!stamp;
  const close = () => { if (!busy && typeof onClose === "function") onClose(); };
  useDismissable(open, close);
  useEffect(() => { if (open) logEvent("stamp_earned_sheet", { verified: stamp?.verified || null }, "Passport"); }, [open, stamp?.verified]);
  if (!open) return null;

  const verified = VERIFIED.has(stamp.verified);
  const where = [stamp.city, stamp.country].filter(Boolean).join(", ");
  const link = slug ? `globeskimmers.io/p/${slug}` : null;
  const url = slug ? `https://globeskimmers.io/p/${slug}` : "https://globeskimmers.io/get?src=share-stamp";

  const share = async () => {
    if (busy) return;
    setBusy(true);
    const text = `I just stamped ${stamp.name}${where ? ` in ${where}` : ""} on GlobeSkimmers 🛂 ${url}`;
    try {
      let artSrc = null;
      try { artSrc = stampArtUrl(stamp.name, { entityId: stamp.entity_id, country: stamp.country }) || null; } catch { artSrc = null; }
      const card = await stampCard(stamp, { presetId: "story_meta", artSrc, link });
      const files = [new File([card.blob], `globeskimmers-stamp-${String(stamp.name || "stamp").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`, { type: "image/jpeg" })];
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: "My Virtual Passport", text });
        logEvent("stamp_share", { how: "card" }, "Passport");
      } else if (navigator.share) {
        await navigator.share({ title: "My Virtual Passport", text, url });
        logEvent("stamp_share", { how: "link" }, "Passport");
      } else {
        await navigator.clipboard?.writeText(text);
        showToast("Copied — paste it anywhere", "success");
        logEvent("stamp_share", { how: "copy" }, "Passport");
      }
    } catch (e) {
      if (e && e.name === "AbortError") { /* the member closed the share sheet */ }
      else showToast("Couldn’t open sharing. Try again.", "error");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[10005] flex items-end justify-center" style={{ background: rgba(NEUTRAL.ink, 0.5) }} onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="gs-earned-h" className="w-full max-w-md" style={{ position: "relative", background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0" }} onClick={(e) => e.stopPropagation()}>
        <AirmailChevron height={4} />
        <div style={{ padding: "16px 20px calc(24px + env(safe-area-inset-bottom))", textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>{verified ? "Verified ✓ · stamped" : "Stamped"}</div>
          <h3 id="gs-earned-h" style={{ margin: "4px 0 0", fontFamily: SERIF, fontSize: fs(26), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>{stamp.name}</h3>
          {where ? <p style={{ margin: "4px 0 0", fontSize: fs(13.5), color: NEUTRAL.ink3 }}>{where}{stamp.visited_on ? ` · ${stamp.visited_on}` : ""}</p> : null}
          <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 6px" }}>
            <StampThumb stamp={stamp} size={150} />
          </div>
          <button type="button" onClick={share} aria-busy={busy || undefined}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 50, marginTop: 12, borderRadius: 14, border: 0, background: NEUTRAL.brandTeal, color: NEUTRAL.white, fontSize: fs(15), fontWeight: 600 }}>
            {busy ? <Loader2 size={18} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : <Share2 size={18} strokeWidth={2} aria-hidden="true" focusable="false" />}
            Share this stamp
          </button>
          <p style={{ margin: "8px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>A story-sized card for Instagram, Facebook or Messages. {link ? `It carries your passport link, ${link}.` : ""}</p>
          <button type="button" onClick={close} style={{ width: "100%", minHeight: 44, marginTop: 6, background: "transparent", border: 0, color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>Done</button>
        </div>
      </div>
    </div>
  );
}
