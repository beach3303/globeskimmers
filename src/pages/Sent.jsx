// Sent: what you sent (founder, 2026-10-25: "users ask me where their sent messages went"). The
// Mailbox masthead's sibling — the stamp-red kicker, the serif line, the full-bleed chevron — over
// SentList. Opened from the Mailbox, whose tab stays lit. Nothing social until the age tier is
// known; a held account sees its note.
import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import SentList from "@/components/mail/SentList";
import ConfirmBirthdayNote from "@/components/social/ConfirmBirthdayNote";
import TeenHoldNote from "@/components/social/TeenHoldNote";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const BLUE = NEUTRAL.airmailBlue;

function Masthead() {
  const navigate = useNavigate();
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Mailbox"));
  };
  return (
    <>
      <div aria-hidden="true" style={{ height: 12 }} />
      <header className={COLUMN} style={{ paddingTop: 4, paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" onClick={back} aria-label="Back to Mailbox"
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "0 0 0 -12px", padding: 0, borderRadius: 999, background: "transparent", border: 0, color: BLUE, cursor: "pointer" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".2em", lineHeight: 1.2, textTransform: "uppercase", color: NEUTRAL.stamp }}>Globeskimmers · Sent</div>
        </div>
        <h1 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.04, color: NEUTRAL.ink }}>
          Postcards & telegrams <em style={{ fontStyle: "italic", color: BLUE }}>you sent</em>
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>Newest first, with who each one went to. A telegram shows when it was opened.</p>
      </header>
      <AirmailChevron height={5} />
    </>
  );
}

export default function SentPage() {
  const { socialTier, socialTierReady } = useAuth();
  if (!socialTierReady || socialTier === "blocked") return <Masthead />;
  if (socialTier === "confirm" || socialTier === "teen") {
    return (
      <div>
        <Masthead />
        <div className={COLUMN}><div style={{ marginTop: 16 }}>{socialTier === "confirm" ? <ConfirmBirthdayNote /> : <TeenHoldNote />}</div></div>
      </div>
    );
  }
  return (
    <div>
      <Masthead />
      <div className={COLUMN}><SentList style={{ marginTop: 16 }} /></div>
    </div>
  );
}
