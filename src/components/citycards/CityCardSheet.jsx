// CityCardSheet — one card, open (founder, 2026-10-28). The card at full size, and for the owner
// who sees it (the four privacy words, capped by the passport, unset reads Friends) and Share.
// A visitor gets the card alone. Any stamp on the card opens big on a tap (CityStampDetail).
//
//   <CityCardSheet card owner onClose onChanged />
//   onChanged(card)  after the owner changes who sees it (the caller keeps its list current)
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, X } from "lucide-react";
import CityCard, { cardWords } from "@/components/citycards/CityCard";
import CityStampDetail from "@/components/citycards/CityStampDetail";
import { BlotterStrip } from "@/components/passport/Blotter";
import { blotterReadCards } from "@/lib/passport";
import PrivacyChip from "@/components/privacy/PrivacyChip";
import AudienceSheet from "@/components/privacy/AudienceSheet";
import { PassportAudienceSheet } from "@/components/privacy/PassportPrivacy";
import { showToast } from "@/components/Toast";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { useDismissable } from "@/lib/dismissStack";
import { capTo, usePassportAudience } from "@/lib/audience";
import { setCityCardVisibility, cardLeft } from "@/lib/cityCards";
import { shareCardElement } from "@/components/citycards/shareCard";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const BLUE = "#1F4E8C", RED = "#B0472F";

export default function CityCardSheet({ card, owner = false, onClose, onChanged = undefined, initialStamp = null }) {
  const [picking, setPicking] = useState(false);
  const [passportSheet, setPassportSheet] = useState(false);
  const [sharing, setSharing] = useState(false);
  // The stamp open big, if any — the one a friend's find or a Mailbox line asked for, to start.
  const [stamp, setStamp] = useState(() => (initialStamp && card ? (card.stamps || []).find((s) => s.id === initialStamp) || null : null));
  // The card's stickers and comments (founder, 2026-10-30): whoever may see the card may add theirs.
  const [book, setBook] = useState(null);
  const readBook = () => { if (card?.id) blotterReadCards([card.id]).then(setBook); };
  useEffect(() => { readBook(); }, [card?.id]);
  const close = () => { if (!picking && !passportSheet && !stamp) onClose(); };
  useDismissable(true, close);
  const [ceiling] = usePassportAudience(owner);
  const ref = useRef(null);
  if (!card) return null;
  const level = capTo(card.visibility || "inner", ceiling);
  const done = !!card.completed_at;
  const left = cardLeft(card);
  const count = Number(card.count) || (card.stamps || []).length;
  const pick = async (v) => {
    const r = await setCityCardVisibility(card.id, v);
    if (!r.ok) { showToast(r.code === "teen_hold" ? "Sharing beyond friends opens at age 18" : (r.error || "Couldn’t save that — try again"), "error"); return false; }
    onChanged?.({ ...card, visibility: r.visibility || v });
    return true;
  };
  const share = async () => { if (sharing) return; setSharing(true); await shareCardElement(ref.current, card); setSharing(false); };

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9997, background: "rgba(22,17,13,.5)" }} onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={`${cardWords(card)} city card`} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "92vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "12px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: RED }}>City card · {card.city} · {card.year}</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
              {done ? <>Ten local finds, <em style={{ fontStyle: "italic", color: "#2E6B4E" }}>complete</em></> : <>Ten local finds, <em style={{ fontStyle: "italic", color: BLUE }}>one city</em></>}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="Close"
            style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 999, background: "transparent", border: 0, color: NEUTRAL.ink2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>

        <div ref={ref} style={{ marginTop: 12 }}><CityCard card={card} size="full" onStamp={setStamp} /></div>
        {count ? <p aria-hidden="true" style={{ margin: "8px 0 0", fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".14em", textTransform: "uppercase", color: NEUTRAL.ink3, textAlign: "center" }}>Tap a stamp to see it big</p> : null}
        {/* Friends like and comment under the card (founder, 2026-10-30). */}
        <div style={{ marginTop: 10 }}><BlotterStrip cardId={card.id} blotter={book} ownerView={owner} onChanged={readBook} /></div>

        {owner ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => setPicking(true)} aria-label={`Who sees this card: ${level}. Change`}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: 0, background: "transparent", border: 0, fontSize: fs(12.5), color: NEUTRAL.ink2, cursor: "pointer" }}>
                <span aria-hidden="true">Who sees it</span><PrivacyChip level={level} size="xs" /><b aria-hidden="true" style={{ color: BLUE }}>Change</b>
              </button>
              <button type="button" onClick={share} aria-busy={sharing || undefined}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 999, border: "1px solid #EADFC9", background: "#fff", font: "inherit", fontSize: fs(12.5), fontWeight: 650, color: NEUTRAL.ink, cursor: "pointer" }}>
                <Share2 size={14} strokeWidth={2.2} color={RED} aria-hidden="true" focusable="false" />{sharing ? "Rendering…" : "Share"}
              </button>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink3, textAlign: "center" }}>
              {done ? `Card No. ${card.no} is complete and stays here. Your next ${card.city} find starts No. ${card.no + 1}.` : `${left === 1 ? "One more find" : `${left} more finds`} complete this card. Then your next ${card.city} find starts No. ${card.no + 1}.`} Your Virtual Passport isn’t stamped.
            </p>
          </>
        ) : null}

        {picking && (
          <AudienceSheet title="Who sees this card" kicker={cardWords(card)} value={level} ceiling={ceiling}
            onPick={pick} onClose={() => setPicking(false)} onChangePassport={() => { setPicking(false); setPassportSheet(true); }}
            note="A card can’t reach more people than your passport does." />
        )}
        {passportSheet && <PassportAudienceSheet onClose={() => setPassportSheet(false)} />}
        {stamp && <CityStampDetail card={card} stamp={stamp} owner={owner} onClose={() => setStamp(null)} />}
      </div>
    </div>,
    document.body,
  );
}
