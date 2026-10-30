// CityCardsPage — the home of City Cards (founder, 2026-10-28: it takes My Profile's tab on Home;
// the Profile has its own button in the bottom bar). The owner's cards, newest first, two across,
// each a tap from its sheet; and what a card is for someone with none yet. On someone else's page
// (Traveler) the same list shows the cards the worker allowed at the viewer's level.
//
//   <CityCardsPage embedded />                       Home's tab: loads the member's own cards
//   <CityCardsPage cards owner={false} first />      a visit: the cards given, read-only
import React, { useEffect, useRef, useState } from "react";
import CityCard from "@/components/citycards/CityCard";
import CityCardSheet from "@/components/citycards/CityCardSheet";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { listCityCards } from "@/lib/cityCards";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const RED = "#B0472F", BLUE = "#1F4E8C";

// openId / openStamp (2026-10-30): the card (and its stamp) a Mailbox line or a friend's find asked for.
export default function CityCardsPage({ embedded = false, cards: given = undefined, owner = true, first = null, style = undefined, openId = null, openStamp = null }) {
  const [mine, setMine] = useState(null);       // the owner's cards, null until read
  const [state, setState] = useState("loading"); // 'loading' | 'ready' | 'unavailable' | 'error'
  const [open, setOpen] = useState(null);       // the card in its sheet
  const asked = useRef(false);
  const load = () => listCityCards().then((r) => {
    if (r.unavailable) { setMine([]); setState("unavailable"); return; }
    if (r.error) { setMine((m) => m || []); setState("error"); return; }
    setMine(r.cards); setState("ready");
  });
  useEffect(() => { if (owner && !given) load(); }, [owner, given]);
  const cards = given || mine || [];
  const who = owner ? null : (first ? `${first}’s` : "Their");
  // The card asked for by id opens once its list is in (a Mailbox line, a friend's find).
  useEffect(() => {
    if (!openId || asked.current) return;
    const c = cards.find((x) => x.id === openId);
    if (c) { asked.current = true; setOpen(c); }
  }, [cards, openId]);
  const onChanged = (c) => { setMine((m) => (m ? m.map((x) => (x.id === c.id ? { ...x, ...c } : x)) : m)); setOpen((o) => (o && o.id === c.id ? { ...o, ...c } : o)); };

  return (
    <div className={embedded ? "max-w-md md:max-w-2xl mx-auto px-4" : undefined} style={{ paddingTop: embedded ? 14 : 0, paddingBottom: embedded ? 24 : 0, ...style }}>
      <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: RED }}>{who ? `${who} city cards` : "City cards"}</div>
      <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
        Local finds, <em style={{ fontStyle: "italic", color: BLUE }}>one card a year</em>
      </h2>
      {owner ? (
        <p style={{ margin: "6px 0 0", fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
          Restaurants, cafés, shops and convenience stores stamp a city’s card, never your passport. Ten stamps complete it; your next find there starts No. 2.
        </p>
      ) : null}

      {owner && state === "loading" && !mine ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14 }} aria-hidden="true">
          {[0, 1].map((i) => <div key={i} style={{ height: 150, borderRadius: 10, background: "rgba(22,17,13,.06)" }} />)}
        </div>
      ) : cards.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
          {cards.map((c) => (
            <button key={c.id} type="button" onClick={() => setOpen(c)} aria-label={`${c.city} ${c.year} card number ${c.no}, ${c.count} of ${c.slots || 10} stamped${c.completed_at ? ", complete" : ""}`}
              className="active:scale-[0.98] transition-transform" style={{ display: "block", width: "100%", padding: 0, background: "transparent", border: 0, textAlign: "left", cursor: "pointer" }}>
              <CityCard card={c} size="small" />
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 14, padding: "18px 16px", borderRadius: 16, background: "#FBF6EC", border: "1px solid #EADFC9", textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: SERIF, fontSize: fs(19), lineHeight: 1.2, color: NEUTRAL.ink }}>{owner ? "Your first card is waiting" : `${who} cards aren’t shared with you`}</p>
          {owner ? (
            <p style={{ margin: "6px auto 0", maxWidth: "36ch", fontSize: fs(13), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
              {state === "unavailable" ? "City cards open in a few minutes." : state === "error" ? "Couldn’t load your cards — pull to refresh or try again later." : "It starts at the first restaurant, café, shop or convenience store you’re at: open the place in Nearby and tap Stamp my city card."}
            </p>
          ) : null}
        </div>
      )}
      {owner && cards.length ? (
        <p style={{ margin: "12px 0 0", fontFamily: MONO, fontSize: fs(10), letterSpacing: ".03em", color: NEUTRAL.ink3 }}>Tap a card to see every stamp, who sees it, or share it.</p>
      ) : null}
      {open ? <CityCardSheet card={open} owner={owner} onClose={() => setOpen(null)} onChanged={onChanged} initialStamp={open.id === openId ? openStamp : null} /> : null}
    </div>
  );
}
