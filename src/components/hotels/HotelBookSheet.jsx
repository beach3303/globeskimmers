// HotelBookSheet — the in-app hotel checkout (Nuitée Connect lane).
//
// Stages: [rooms →] form → prebooking → ready → paying → booked | failed | pending | unknown.
// "rooms" (Wave 4) exists only when the search hotel carries rates[] with a
// real choice (>1 plan): rates group by the SUPPLIER's room name (never
// invented tiers), the traveler picks a plan, and that plan's offerId + labels
// feed the existing prebook flow. Hotels without rates[] (old cache/edge)
// start on "form" with the flattened cheapest rate — exactly the old behavior.
// A caller that already knows the plan (Smart Packages' priced choice) passes
// initialOfferId: when it matches a rate in rates[] the sheet opens on "form"
// with that rate preselected, "‹ Change room" still available; otherwise it is
// ignored and the sheet opens exactly as it would without it.
// The card form itself is Nuitée's Payment SDK on a page served by OUR worker,
// opened in the same in-app sheet Viator uses; when that sheet closes we ask
// the worker whether the session booked. Card data never touches the app, and
// the app never sees the payment secrets — only a session id.
// "pending" is only ever shown on a REAL "pending" answer from the worker;
// no answer at all lands on "unknown", which never claims nothing was charged.
// Prices here are Closed-User-Group rates: rendered only behind the sign-in
// gate (App.jsx), never on share cards or web pages.
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, CheckCircle2 } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { useAuth } from "@/lib/AuthContext";
import { openPartnerAndWait } from "@/lib/openPartner";
import { prettyRoom } from "@/lib/roomName";
import { createPageUrl } from "@/utils";
import { TEAL_DEEP } from "@/components/redesign/constants";

// Passport Standard: one teal primary on the ivory sheet.
const ACCENT = TEAL_DEEP, INK = "#16110D", INK2 = "#5F5546", RULE = "#F0E9DC", OK = "#2E7D46", BAD = "#C2392F";
const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const fs = (n) => `calc(${n}px*var(--fs))`;
const money = (amt, cur) => {
  if (amt == null) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(amt); }
  catch { return `${Math.round(amt)} ${cur || ""}`; }
};
const splitName = (full) => {
  const p = String(full || "").trim().split(/\s+/).filter(Boolean);
  return p.length > 1 ? { first: p.slice(0, -1).join(" "), last: p[p.length - 1] } : { first: p[0] || "", last: "" };
};
const fmtDate = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }); };
// The bed configuration is the decision; everything after it is supplier
// boilerplate. Split the prettified name at the first separator when the head
// reads like a bed phrase ("1 King Bed", "2 Queen Beds", "Studio Suite ...").
const splitRoomName = (s) => {
  const p = prettyRoom(s);
  const m = p.match(/^(.*?)(?:\s+[-–·]\s+|\s*·\s*)(.+)$/);
  if (m && /\b(bed|beds|suite|studio|room)\b/i.test(m[1]) && m[1].length <= 44) return { bed: m[1], rest: m[2] };
  return { bed: p, rest: null };
};
// The worker's own bed phrase (rate.room.bedLabel, e.g. "1 King") leads when
// present; the supplier's room name still shows underneath — its tail when the
// name split cleanly, else the whole name — so nothing the supplier said is
// hidden. Without a bedLabel the split heuristic above stands alone.
const roomLines = (name, bedLabel) => {
  const s = splitRoomName(name);
  if (!bedLabel) return s;
  const rest = s.rest || (s.bed && s.bed.toLowerCase() !== String(bedLabel).toLowerCase() ? s.bed : null);
  return { bed: String(bedLabel), rest };
};

export default function HotelBookSheet({ hotel, checkin, checkout, adults, children, dest, onClose, initialOfferId = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const meta = user?.user_metadata || {};
  const guess = splitName(meta.full_name || meta.name);
  const [holder, setHolder] = useState({
    firstName: meta.first_name || guess.first, lastName: meta.last_name || guess.last,
    email: user?.email || "", phone: meta.phone || "",
  });
  // ── Room choice (Wave 4) ───────────────────────────────────────────────
  // The search hotel MAY carry rates[]: every purchasable plan for this stay,
  // same field names as the flattened top-level rate —
  //   { offerId, roomName, board, price, currency?, freeCancellation, cancelBy, maxOccupancy?,
  //     room?: { bedLabel? }, boardLabel? }
  // (supplier spellings name/boardName tolerated). room.bedLabel ("1 King") and
  // boardLabel ("Breakfast included") are optional worker-derived display
  // strings — shown only when present, never built here. Anything without an
  // offerId and price can't be booked and is dropped.
  const rates = useMemo(() => (Array.isArray(hotel.rates) ? hotel.rates : [])
    .map((r) => (r && r.offerId != null && r.price != null) ? {
      offerId: r.offerId, roomName: r.roomName || r.name || null, board: r.board || r.boardName || null,
      price: r.price, currency: r.currency || hotel.currency || "USD",
      freeCancellation: !!r.freeCancellation, cancelBy: r.cancelBy || null, maxOccupancy: r.maxOccupancy ?? null,
      room: r.room?.bedLabel ? { bedLabel: String(r.room.bedLabel) } : null,
      boardLabel: typeof r.boardLabel === "string" && r.boardLabel.trim() ? r.boardLabel.trim() : null,
    } : null)
    .filter(Boolean)
    .sort((a, b) => a.price - b.price), [hotel]);
  // Group by the supplier's real room name. Rates are price-sorted, so groups
  // appear cheapest-first. Each room shows at most 2 plans: its cheapest, plus
  // the cheapest refundable alternative when the cheapest is non-refundable.
  const roomGroups = useMemo(() => {
    const by = new Map(); const out = [];
    for (const r of rates) {
      const k = r.roomName || "Room";
      if (!by.has(k)) { const g = { name: k, rates: [] }; by.set(k, g); out.push(g); }
      by.get(k).rates.push(r);
    }
    for (const g of out) {
      const cheapest = g.rates[0];
      const alt = !cheapest.freeCancellation ? g.rates.find((x) => x.freeCancellation) : null;
      g.plans = alt ? [cheapest, alt] : [cheapest];
      g.occ = g.rates.reduce((m, x) => Math.max(m, x.maxOccupancy || 0), 0) || null;
      g.bedLabel = g.rates.find((x) => x.room?.bedLabel)?.room.bedLabel || null;   // the room's worker bed phrase, when any plan carries one
    }
    return out;
  }, [rates]);
  const hasRoomChoice = rates.length > 1;
  // Deep link: initialOfferId (compared as a string) preselects its rate and
  // skips the room picker. No match → null → today's behavior, untouched.
  const preset = initialOfferId != null ? rates.find((r) => String(r.offerId) === String(initialOfferId)) || null : null;
  const [sel, setSel] = useState(preset);       // the traveler's chosen rate (from rates[])
  const [allRooms, setAllRooms] = useState(false); // "More rooms" disclosure open
  // The rate being bought: chosen > cheapest-from-rates > the flattened legacy
  // fields (no-rates[] fallback — identical to pre-Wave-4 behavior).
  const rate = sel || rates[0] || {
    offerId: hotel.offerId, roomName: hotel.roomName, board: hotel.board, price: hotel.price,
    currency: hotel.currency, freeCancellation: hotel.freeCancellation, cancelBy: hotel.cancelBy,
    room: hotel.room?.bedLabel ? { bedLabel: String(hotel.room.bedLabel) } : null,
    boardLabel: typeof hotel.boardLabel === "string" && hotel.boardLabel.trim() ? hotel.boardLabel.trim() : null,
  };
  const [stage, setStage] = useState(hasRoomChoice && !preset ? "rooms" : "form"); // rooms · form · prebooking · ready · paying · booked · failed · pending · unknown
  const [pre, setPre] = useState(null);         // /hotels/nuitee/prebook response
  const [err, setErr] = useState(null);
  const [booking, setBooking] = useState(null);
  const [checking, setChecking] = useState(false); // a status probe is running (disables Check again)
  const [webTab, setWebTab] = useState(false);     // web: payment opened in a tab we get no close signal from
  // Lock the sheet (no Close / backdrop dismiss) only while the NATIVE payment
  // sheet is up. On web the tab gives us no close signal, so the traveler must
  // keep an exit — otherwise deciding not to pay leaves them stuck.
  const locked = stage === "paying" && !webTab;
  const set = (k) => (e) => setHolder((h) => ({ ...h, [k]: e.target.value }));
  const valid = holder.firstName.trim() && holder.lastName.trim() && /^\S+@\S+\.\S+$/.test(holder.email);

  const prebook = async () => {
    if (!valid) return;
    setStage("prebooking"); setErr(null);
    try {
      const { data } = await callWorker("hotels/nuitee/prebook", {
        // The CHOSEN rate's offerId — not necessarily the hotel's cheapest.
        offerId: rate.offerId, hotelName: hotel.name, holder, adults, children,
        dest_city: dest?.city || hotel.city || "", dest_country: dest?.country || hotel.country || "",
        // Stay plumbing (Wave 3): the worker stores these on the session so My
        // Trips can map/share/sort the booking without regexing names. All come
        // straight off the search-result hotel object — never invented here.
        address: hotel.address || "", lat: hotel.lat ?? null, lng: hotel.lng ?? null,
        thumbnail: hotel.thumbnail || null,
        // Wave 3 field name, unchanged: roomLabel — now built from the CHOSEN
        // rate so My Trips shows the room actually booked.
        roomLabel: [rate.roomName, rate.board].filter(Boolean).join(" · ") || null,
      });
      if (!data?.sid) { setErr(data?.detail || data?.error || "This rate is no longer available — pick another stay."); setStage("form"); return; }
      setPre(data); setStage("ready");
    } catch { setErr("Couldn't reach the booking service. Check your connection and try again."); setStage("form"); }
  };
  const checkStatus = async () => {
    // The booking is written server-side on the return page; give it a moment
    // (up to 3 × 2s). Only a REAL "pending" answer means "never paid". No answer
    // at all — network drop, timeout, worker 4xx/5xx (callWorker returns
    // data:null, it never throws), or an "expired"/"forbidden" session — proves
    // nothing: the card may have been charged and the booking completes on
    // Nuitée's side. That lands on "unknown", which never says "nothing was
    // charged" and never offers to pay again.
    setChecking(true);
    let last = null; // status of the most recent probe that actually answered
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data } = await callWorker("hotels/nuitee/status", { sid: pre.sid });
          if (data?.status === "booked") { setBooking(data.booking); setStage("booked"); return; }
          if (data?.status === "failed") { setErr(data.error || "The hotel could not confirm this rate."); setStage("failed"); return; }
          last = data?.status === "pending" ? "pending" : null;
        } catch { last = null; }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
      }
      // Decided by the LAST probe: an early "pending" followed by a dropped probe
      // could have flipped to booked in between.
      setStage(last === "pending" ? "pending" : "unknown");
    } finally { setChecking(false); }
  };
  const pay = async () => {
    setStage("paying");
    const waited = await openPartnerAndWait(pre.checkoutUrl);   // true = native sheet closed
    setWebTab(!waited);
    // Native: the sheet closed, ask the worker. Web has no close signal, so we
    // stay in "paying" and the traveler taps "I've paid — check my booking" —
    // polling now would read the still-pending session and wrongly announce
    // "not completed" while the card form is still open in the other tab.
    if (waited) await checkStatus();
  };

  // Dates are the OFFER's: FindAHotel hands us the search's checkin/checkout,
  // and once prebook has run the worker's confirmed dates win — never the live
  // date picker, which may have moved since the search.
  const ci = pre?.checkin || checkin, co = pre?.checkout || checkout;
  const span = Math.round((Date.parse(co) - Date.parse(ci)) / 86400000);
  const nights = span > 0 ? span : (hotel.nights || 1);
  const price = pre?.price ?? rate.price;
  const cur = pre?.currency || rate.currency || "USD";
  const room = pre?.room || { name: rate.roomName, board: rate.board, refundable: rate.freeCancellation, cancelBy: rate.cancelBy };
  // Display strings for the SAME offer: the worker's prebook room wins when it
  // carries them, else the chosen search rate's (bed configuration and board
  // don't change between search and prebook for one offerId — price and
  // cancellation can, and those come from pre.room / pre.price above).
  const bedLabel = pre?.room?.bedLabel || rate.room?.bedLabel || null;
  const boardLabel = pre?.room?.boardLabel || rate.boardLabel || null;
  const field = (label, k, type = "text", auto) => (
    <label className="flex flex-col gap-1">
      <span className="text-[calc(11.5px*var(--fs))] font-semibold" style={{ color: INK2 }}>{label}</span>
      <input value={holder[k]} onChange={set(k)} type={type} autoComplete={auto} autoCapitalize={type === "email" ? "none" : "words"}
        className="rounded-[12px] px-3 py-2.5 text-[calc(14px*var(--fs))]" style={{ border: `1.5px solid ${RULE}`, color: INK, background: "#fff", fontFamily: "inherit" }} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={locked ? undefined : onClose}>
      <div className="w-full max-w-[560px] rounded-t-[22px] px-4 pt-3 pb-6 max-h-[92vh] overflow-y-auto" style={{ background: "#FBF8F1", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-[calc(17px*var(--fs))] leading-snug" style={{ color: INK }}>{hotel.name}</div>
            <div className="text-[calc(12.5px*var(--fs))] mt-0.5" style={{ color: INK2 }}>{fmtDate(ci)} → {fmtDate(co)} · {nights} night{nights === 1 ? "" : "s"} · {adults} adult{adults === 1 ? "" : "s"}{children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""}</div>
          </div>
          {!locked && <button onClick={onClose} aria-label="Close" className="flex-none rounded-full p-1.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}><X size={18} color={INK} /></button>}
        </div>

        {/* Rate summary — what is being bought, in plain words. Hidden on the
            rooms stage, where the room cards themselves carry this. */}
        {stage !== "rooms" && (
        <div className="rounded-[16px] p-3.5 mt-3" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
          {(room?.name || bedLabel) && (() => { const l = roomLines(room?.name, bedLabel); const bd = boardLabel || room?.board; return (
            <div className="text-[calc(13.5px*var(--fs))] font-semibold" style={{ color: INK }}><b style={{ fontFamily: SERIF, fontSize: fs(15.5), fontWeight: 700 }}>{l.bed}</b>{l.rest ? ` · ${l.rest}` : ""}{bd ? <span style={{ color: INK2, fontWeight: 500 }}> · {bd}</span> : null}</div>
          ); })()}
          <div className="text-[calc(12.5px*var(--fs))] mt-1" style={{ color: room?.refundable ? OK : BAD }}>
            {room?.refundable ? `Free cancellation${room.cancelBy ? ` until ${fmtDate(String(room.cancelBy).slice(0, 10))}` : ""}` : "Non-refundable"}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-[calc(12px*var(--fs))]" style={{ color: INK2 }}>Total for {nights} night{nights === 1 ? "" : "s"}</span>
            <span className="font-extrabold text-[calc(20px*var(--fs))]" style={{ color: INK }}>{money(price, cur)}</span>
          </div>
          {pre?.priceChanged && <div className="text-[calc(12px*var(--fs))] mt-1.5 font-semibold" style={{ color: "#92400E" }}>Heads-up: the hotel updated this price since the search ({pre.priceDifferencePercent > 0 ? "+" : ""}{Number(pre.priceDifferencePercent).toFixed(1)}%). The total above is the confirmed one.</div>}
          {pre?.env === "sandbox" && <div className="text-[calc(11.5px*var(--fs))] mt-1.5 font-bold" style={{ color: BAD }}>SANDBOX — test booking, no real reservation, no charge.</div>}
        </div>
        )}

        {/* Room choice — supplier room names verbatim, cheapest first. Each room
            shows its cheapest plan, plus the refundable alternative when the
            cheapest is non-refundable (the delta stated as fact). */}
        {stage === "rooms" && (
          <>
            <div className="text-[calc(13px*var(--fs))] font-bold mt-4 mb-2" style={{ color: INK }}>Choose your room</div>
            <div className="flex flex-col gap-2.5">
              {(allRooms ? roomGroups : roomGroups.slice(0, 3)).map((g) => (
                <div key={g.name} className="rounded-[16px] p-3.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[calc(19px*var(--fs))] font-bold leading-snug" style={{ fontFamily: SERIF, color: INK }}>{roomLines(g.name, g.bedLabel).bed}</div>
                      {roomLines(g.name, g.bedLabel).rest ? <div className="mt-0.5 text-[calc(12px*var(--fs))] leading-snug" style={{ color: INK2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{roomLines(g.name, g.bedLabel).rest}</div> : null}
                    </div>
                    {g.occ ? <span className="flex-none font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase" style={{ color: INK2 }}>Sleeps {g.occ}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {g.plans.map((r, i) => {
                      const delta = i > 0 ? r.price - g.plans[0].price : 0;
                      const cancelBit = r.freeCancellation
                        ? `free cancellation${r.cancelBy ? ` until ${fmtDate(String(r.cancelBy).slice(0, 10))}` : ""}`
                        : "non-refundable";
                      const line = i === 0
                        ? cancelBit.charAt(0).toUpperCase() + cancelBit.slice(1)
                        : `${delta > 0 ? `+${money(delta, r.currency)} · ` : ""}${cancelBit}`;
                      return (
                        <button key={r.offerId} onClick={() => { setSel(r); setErr(null); setStage("form"); }}
                          className="w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left"
                          style={{ background: "#FBF8F1", border: `1.5px solid ${RULE}`, fontFamily: "inherit" }}>
                          <span className="flex-1 min-w-0">
                            {(r.boardLabel || r.board) && <span className="block text-[calc(12.5px*var(--fs))] font-semibold" style={{ color: INK }}>{r.boardLabel || r.board}</span>}
                            <span className="block text-[calc(11.5px*var(--fs))]" style={{ color: r.freeCancellation ? OK : INK2 }}>{line}</span>
                          </span>
                          <span className="flex-none font-mono font-bold text-[calc(14px*var(--fs))]" style={{ color: INK }}>{money(r.price, r.currency)}</span>
                          <span aria-hidden="true" className="flex-none text-[calc(15px*var(--fs))]" style={{ color: ACCENT }}>›</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {roomGroups.length > 3 && !allRooms && (
              <button onClick={() => setAllRooms(true)}
                className="w-full py-2.5 mt-2 text-[calc(13px*var(--fs))] font-semibold"
                style={{ color: ACCENT, background: "none", border: "none", fontFamily: "inherit" }}>
                More rooms ({roomGroups.length - 3})
              </button>
            )}
            <p className="text-[calc(10.5px*var(--fs))] leading-snug mt-3 px-0.5" style={{ color: "#9AA0A6" }}>
              Room names come straight from the hotel's supplier. Every price is the total for your whole stay.
            </p>
          </>
        )}

        {(stage === "form" || stage === "prebooking") && (
          <>
            {hasRoomChoice && stage === "form" && (
              <button onClick={() => setStage("rooms")}
                className="mt-3 text-[calc(12.5px*var(--fs))] font-semibold"
                style={{ color: ACCENT, background: "none", border: "none", padding: 0, fontFamily: "inherit" }}>
                ‹ Change room
              </button>
            )}
            <div className="text-[calc(13px*var(--fs))] font-bold mt-4 mb-2" style={{ color: INK }}>Who's checking in?</div>
            <div className="grid grid-cols-2 gap-2.5">
              {field("First name", "firstName", "text", "given-name")}
              {field("Last name", "lastName", "text", "family-name")}
            </div>
            <div className="grid grid-cols-1 gap-2.5 mt-2.5">
              {field("Email (confirmation goes here)", "email", "email", "email")}
              {field("Phone (optional)", "phone", "tel", "tel")}
            </div>
            {err && <div className="text-[calc(12.5px*var(--fs))] mt-3 font-semibold" style={{ color: BAD }}>{err}</div>}
            {/* Sticky full-width Continue bar — stays visible while the form scrolls */}
            <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 mt-4" style={{ background: "#FBF8F1" }}>
              <button onClick={prebook} disabled={!valid || stage === "prebooking"}
                className="w-full py-3.5 rounded-[14px] font-bold text-white text-[calc(15px*var(--fs))]"
                style={{ background: ACCENT, minHeight: 52, opacity: (!valid || stage === "prebooking") ? 0.6 : 1, fontFamily: "inherit" }}>
                {stage === "prebooking" ? "Confirming availability…" : "Continue to secure payment"}
              </button>
              <p className="text-[calc(11px*var(--fs))] leading-snug mt-2 px-0.5 text-center" style={{ color: INK2 }}>
                Nothing is charged until you tap Pay on the next screen.
              </p>
            </div>
            <p className="text-[calc(10.5px*var(--fs))] leading-snug mt-2 px-0.5" style={{ color: "#9AA0A6" }}>
              Your card is handled by Nuitée Travel Ltd, our booking partner and the merchant of record — GlobeSkimmers never sees card details. Member rate: available because you're signed in.
            </p>
          </>
        )}

        {(stage === "ready" || stage === "paying") && (
          <>
            <div className="text-[calc(12.5px*var(--fs))] mt-4" style={{ color: INK2 }}>Availability confirmed for <b style={{ color: INK }}>{holder.firstName} {holder.lastName}</b> · {holder.email}</div>
            <button onClick={pay} disabled={stage === "paying"}
              className="w-full py-3.5 rounded-[14px] font-bold text-white text-[calc(15px*var(--fs))] mt-3"
              style={{ background: ACCENT, opacity: stage === "paying" ? 0.6 : 1, fontFamily: "inherit" }}>
              {stage === "paying" ? "Payment window open…" : `Pay ${money(price, cur)} securely`}
            </button>
            {stage === "paying" && <button onClick={checkStatus} disabled={checking} className="w-full py-2.5 mt-2 text-[calc(13px*var(--fs))] font-semibold" style={{ color: ACCENT, background: "none", border: "none", fontFamily: "inherit", opacity: checking ? 0.6 : 1 }}>{checking ? "Checking…" : "I've paid — check my booking"}</button>}
            <p className="text-[calc(10.5px*var(--fs))] leading-snug mt-3 px-0.5" style={{ color: "#9AA0A6" }}>
              {webTab
                ? "The payment page opened in a new tab. When you've paid, come back here and tap “I've paid — check my booking”."
                : "The payment page opens in a secure sheet. When you're done, tap Done to come back — we'll confirm the booking here."}
            </p>
          </>
        )}

        {stage === "pending" && (
          <>
            <div className="text-[calc(13.5px*var(--fs))] font-bold mt-4" style={{ color: INK }}>Payment not completed yet</div>
            <div className="text-[calc(12.5px*var(--fs))] mt-1" style={{ color: INK2 }}>No booking was made and nothing was charged. You can reopen the payment page or check again.</div>
            <div className="flex gap-2 mt-3">
              <button onClick={pay} disabled={checking} className="flex-1 py-3 rounded-[14px] font-bold text-white text-[calc(14px*var(--fs))]" style={{ background: ACCENT, fontFamily: "inherit", opacity: checking ? 0.6 : 1 }}>Reopen payment</button>
              <button onClick={checkStatus} disabled={checking} className="flex-1 py-3 rounded-[14px] font-bold text-[calc(14px*var(--fs))]" style={{ background: "#fff", color: INK, border: `1.5px solid ${RULE}`, fontFamily: "inherit", opacity: checking ? 0.6 : 1 }}>{checking ? "Checking…" : "Check again"}</button>
            </div>
          </>
        )}

        {/* No answer from the worker — the opposite of "nothing was charged":
            the booking completes on Nuitée's side, so never offer to pay again. */}
        {stage === "unknown" && (
          <>
            <div className="text-[calc(13.5px*var(--fs))] font-bold mt-4" style={{ color: INK }}>We couldn't confirm your booking status yet</div>
            <div className="text-[calc(12.5px*var(--fs))] mt-1" style={{ color: INK2 }}>If you paid, do <b style={{ color: INK }}>not</b> pay again — the booking completes on Nuitée's side. Check again in a moment.</div>
            <div className="flex gap-2 mt-3">
              <button onClick={checkStatus} disabled={checking} className="flex-1 py-3 rounded-[14px] font-bold text-white text-[calc(14px*var(--fs))]" style={{ background: ACCENT, fontFamily: "inherit", opacity: checking ? 0.6 : 1 }}>{checking ? "Checking…" : "Check again"}</button>
              <button onClick={() => navigate(createPageUrl("MyTrip"))} className="flex-1 py-3 rounded-[14px] font-bold text-[calc(14px*var(--fs))]" style={{ background: "#fff", color: INK, border: `1.5px solid ${RULE}`, fontFamily: "inherit" }}>View My Trips</button>
            </div>
          </>
        )}

        {stage === "failed" && (
          <>
            <div className="text-[calc(13.5px*var(--fs))] font-bold mt-4" style={{ color: BAD }}>Booking not completed</div>
            <div className="text-[calc(12.5px*var(--fs))] mt-1" style={{ color: INK2 }}>{err} If your card was charged, Nuitée refunds automatically when a booking fails to confirm.</div>
            <button onClick={onClose} className="w-full py-3 rounded-[14px] font-bold text-[calc(14px*var(--fs))] mt-3" style={{ background: "#fff", color: INK, border: `1.5px solid ${RULE}`, fontFamily: "inherit" }}>Choose another stay</button>
          </>
        )}

        {stage === "booked" && booking && (
          <>
            <div className="flex items-center gap-2 text-[calc(17px*var(--fs))] font-extrabold mt-4" style={{ color: OK }}><CheckCircle2 size={20} strokeWidth={2.25} aria-hidden="true" /><span>You're booked</span></div>
            <div className="rounded-[14px] p-3 mt-2 text-[calc(13px*var(--fs))]" style={{ background: "#fff", border: `1px solid ${RULE}`, color: INK }}>
              <div className="flex justify-between"><span style={{ color: INK2 }}>Booking ID</span><b>{booking.bookingId}</b></div>
              {booking.hotelConfirmationCode && <div className="flex justify-between mt-1"><span style={{ color: INK2 }}>Hotel confirmation</span><b>{booking.hotelConfirmationCode}</b></div>}
              <div className="flex justify-between mt-1"><span style={{ color: INK2 }}>Paid</span><b>{money(booking.price ?? price, booking.currency || cur)}</b></div>
            </div>
            <div className="text-[calc(12px*var(--fs))] mt-2" style={{ color: INK2 }}>Confirmation email sent to {holder.email}. This stay is now in My Trips.</div>
            <button onClick={() => navigate(createPageUrl("MyTrip"))} className="w-full py-3.5 rounded-[14px] font-bold text-white text-[calc(15px*var(--fs))] mt-3" style={{ background: OK, fontFamily: "inherit" }}>View in My Trips</button>
          </>
        )}
      </div>
    </div>
  );
}
