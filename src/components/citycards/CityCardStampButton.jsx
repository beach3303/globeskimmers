// CityCardStampButton — "Stamp my Los Angeles card" on a Places to Eat, Coffee, Shopping or
// Convenience Store card (founder, 2026-10-28: those four stamp a City Card, never the passport;
// ATMs, restrooms and Money Exchange stamp nothing). The tap is the proof, as "I was here": the
// best of fresh GPS readings, measured by the worker against the place. A grant shows the stamp
// that landed — the category artwork, the business's name, today's date — and how far the card
// is; the tenth opens the card complete. A refusal says why, in the same words the passport uses,
// and offers the tap again.
//
//   <CityCardStampButton finder place formatDistance />
//   finder   'eat' | 'coffee' | 'shopping' | 'convenience'
//   place    { id, name, lat, lng, types, formattedAddress }
import React, { useState } from "react";
import { Stamp } from "lucide-react";
import RubberStamp from "@/components/redesign/RubberStamp";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { showToast } from "@/components/Toast";
import { placeParts } from "@/components/attraction/AttractionExtras";
import { placeParts as locationParts } from "@/lib/placeContext";
import { useLocation } from "@/components/location/LocationContext";
import { getStampFix } from "@/lib/geolocation";
import { localISODate } from "@/lib/localDate";
import { countryCode } from "@/lib/countries";
import { logEvent } from "@/lib/analytics";
import { stampCityCard, artFor, inkFor, stampDate, cardLeft } from "@/lib/cityCards";
import CityCardSheet from "@/components/citycards/CityCardSheet";
import CityCardComplete from "@/components/citycards/CityCardComplete";

const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const STAMP = "Georgia, 'Times New Roman', serif";
const RED = "#B0472F", BLUE = "#1F4E8C";
const REFUSALS = ["not_here", "proof_needed", "unlocatable", "unconfirmed", "no_city", "unavailable", "slow_down", "day_full"];

export default function CityCardStampButton({ finder, place, formatDistance = undefined }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);     // { card, stamp, completed, already } after a grant
  const [refused, setRefused] = useState(null);   // { why, meters, message } after a refusal
  const [open, setOpen] = useState(false);        // the card, in its sheet
  const [complete, setComplete] = useState(false); // the tenth stamp's pop-up
  const name = place?.name || "this place";
  // The card's city: the place's address when it names one, else the location being browsed (a
  // finder card often carries only the street); the worker reads Google's own address as well.
  const { activeLocation } = useLocation();
  const addr = placeParts(place?.formattedAddress);
  const loc = locationParts(activeLocation);
  const parts = { city: addr.city || loc.city || null, region: addr.region || loc.state || null, country: addr.country || loc.country || null };
  const cityWord = parts.city || null;
  const away = (m) => (typeof formatDistance === "function" ? formatDistance(m / 1609.34) : `${(m / 1609.34).toFixed(1)} mi`);

  const stamp = async () => {
    if (busy || result) return;
    setBusy(true); setRefused(null);
    let fix = null, noFix = null;
    try { fix = await getStampFix(); } catch (e) { noFix = e?.code === 1 ? "denied" : "no_fix"; }
    if (!fix) { setBusy(false); setRefused({ why: noFix }); return; }
    const country = parts.country || null;
    const { data, error } = await stampCityCard({
      finder, place: { id: place.id, name, types: place.types || [] },
      city: cityWord, region: parts.region || null, country,
      cc: countryCode(country) || (/^[A-Za-z]{2}$/.test(country || "") ? country.toUpperCase() : undefined),
      visited_on: localISODate(),
      fix: { lat: fix.lat, lng: fix.lng, ...(Number.isFinite(fix.acc) ? { acc: fix.acc } : {}) },
    });
    setBusy(false);
    if (error === "finish_passport") return;   // the passport gate opened its own sheet
    if (REFUSALS.includes(data?.code)) { setRefused({ why: data.code, meters: Number.isFinite(data.distance_m) ? data.distance_m : null, message: data.error || null }); return; }
    if (error || !data?.ok) { showToast(/sign in/i.test(error || "") ? "Sign in to stamp your city card" : (error || data?.error || "Couldn’t stamp your card — try again"), "error"); return; }
    setResult(data);
    logEvent("citycard_stamp", { finder, slot: data.stamp?.slot, completed: !!data.completed, already: !!data.already }, "CityCards");
    if (data.already) showToast(`Already on your ${data.card.city} ${data.card.year} card`, "success");
    else showToast(data.completed ? `${data.card.city} ${data.card.year} card complete! 📇` : `Stamped on your ${data.card.city} ${data.card.year} card`, "success");
    if (data.completed && !data.already) setComplete(true);
  };

  const refusalText = (r) => (
    r.why === "denied" ? "Location is off for GlobeSkimmers — turn it on in Settings, then tap Stamp again."
      : r.why === "no_fix" ? "We couldn’t get a GPS reading just now — step outside or give it a moment, then tap Stamp again."
      : r.why === "unlocatable" ? "We can’t place this business on our map yet."
      : r.why === "unconfirmed" ? "We couldn’t confirm your GPS reading — a VPN can cause this."
      : r.why === "no_city" ? "We couldn’t tell which city this place is in — open it again and try once more."
      : r.why === "unavailable" ? "City cards open in a few minutes — try again shortly."
      : r.why === "slow_down" || r.why === "day_full" ? (r.message || "That’s a lot at once — give it a minute.")
      : Number.isFinite(r.meters) ? `Your GPS puts you about ${away(r.meters)} from ${name}. Stamps open when you’re there.`
      : r.message || "Your GPS doesn’t show you at this place yet."
  );

  const card = result?.card || null;
  const st = result?.stamp || null;
  const left = card ? cardLeft(card) : 0;
  return (
    <div style={{ marginTop: 12 }}>
      {!result ? (
        <>
          <RubberStamp state={busy ? "busy" : "idle"} onClick={stamp} placeName={name}>
            {cityWord ? `Stamp my ${cityWord} card` : "Stamp my city card"}
          </RubberStamp>
          {refused ? (
            <p style={{ marginTop: 6, fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink2, textAlign: "center" }}>{refusalText(refused)}</p>
          ) : (
            <p style={{ marginTop: 6, fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink3, textAlign: "center" }}>
              Your city card, not your passport&nbsp;· Only at the place, by GPS
            </p>
          )}
        </>
      ) : (
        <div style={{ borderRadius: 14, background: "#FBF6EC", border: "1px solid #EADFC9", padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", width: 92 }}>
            <img src={artFor(st?.category, st?.design)} alt="" style={{ width: 76, height: 76, display: "block", mixBlendMode: "multiply", transform: "rotate(-7deg)" }} />
            <span style={{ fontFamily: STAMP, fontWeight: 700, fontSize: fs(9), letterSpacing: ".04em", textTransform: "uppercase", color: inkFor(st?.category), marginTop: 4, textAlign: "center", lineHeight: 1.15, overflowWrap: "anywhere" }}>{st?.name || name}</span>
            <span style={{ fontFamily: MONO, fontSize: fs(7.5), letterSpacing: ".1em", color: NEUTRAL.ink3, marginTop: 2 }}>{stampDate(st?.visited_on)}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".18em", color: RED }}>{result.already ? "ALREADY ON YOUR CARD" : "STAMPED"}</div>
            <div style={{ fontFamily: SERIF, fontSize: fs(17), lineHeight: 1.15, marginTop: 2, color: NEUTRAL.ink }}>
              {result.already ? <>On your <em style={{ fontStyle: "italic", color: BLUE }}>{card.city} {card.year}</em> card since {stampDate(st?.visited_on)}</> : <>On your <em style={{ fontStyle: "italic", color: BLUE }}>{card.city} {card.year}</em> card</>}
            </div>
            <div aria-hidden="true" style={{ marginTop: 8, height: 6, borderRadius: 999, background: "rgba(176,71,47,.14)", overflow: "hidden" }}>
              <div style={{ width: `${Math.round(((card.count || 0) / (card.slots || 10)) * 100)}%`, height: "100%", borderRadius: 999, background: card.completed_at ? "#2E6B4E" : RED, transition: "width .4s" }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".1em", color: NEUTRAL.ink3, marginTop: 5 }}>
              {card.completed_at ? `${card.slots || 10} / ${card.slots || 10} STAMPED · COMPLETE` : `${card.count} / ${card.slots || 10} STAMPED · ${left} TO GO`}
            </div>
            <button type="button" onClick={() => setOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, marginTop: 4, padding: 0, background: "transparent", border: 0, fontSize: fs(12.5), fontWeight: 650, color: BLUE, cursor: "pointer" }}>
              <Stamp size={13} strokeWidth={2.2} aria-hidden="true" focusable="false" />See my {card.city} {card.year} card ›
            </button>
          </div>
        </div>
      )}
      {open && card ? <CityCardSheet card={card} owner onClose={() => setOpen(false)} onChanged={(c) => setResult((r) => (r ? { ...r, card: c } : r))} /> : null}
      {complete && card ? <CityCardComplete card={card} onClose={() => setComplete(false)} onChanged={(c) => setResult((r) => (r ? { ...r, card: c } : r))} /> : null}
    </div>
  );
}
