// BookingDetailSheet — the booking detail bottom-sheet, extracted from MyTrip
// so the Trips surface (BOOKED tab) opens the exact same sheet. Mirrors the
// MapAppSelector / AllServicesSheet pattern (motion sheet + backdrop; the global
// swipe-down dismisses via useDismissable).
//
// Two honest variants:
//   • In-app (Nuitée) hotel rows — on open the sheet lazily asks the worker's
//     POST /hotels/nuitee/booking { bookingId } (bookingId = the row's
//     product_id; the worker checks D1 ownership, then reads Nuitée's
//     /bookings/{id}) and renders the full record: reference (hotel
//     confirmation + booking id, copyable), stay dates, room(s), holder,
//     the cancellation line, booked-on date, and a payment summary. The result
//     is cached per bookingId for the life of the page; offline or on failure
//     the sheet falls back to the fields /aff/mine already gave us. Fields the
//     payload doesn't carry are NOT rendered — nothing is ever invented, and
//     no card number/brand exists anywhere in this data.
//   • Partner rows — kicker, product, city·country, "Booked via {partner}",
//     and ONE primary action: Manage with {partner} (openPartner). Their
//     confirmation lives with the partner; we say so instead of faking a ref
//     (a partner product_id is a catalog id, not a booking reference).
//
// A quiet Share action (src/lib/shareBooking.js) shares a REDACTED summary —
// never the reference, amounts, or holder contacts.
//
// Cancel (in-app rows only) — decided ONLY from the live Nuitée payload:
// status CONFIRMED + refundableTag RFN + a free-cancellation deadline that
// resolves (in the policy's own timezone) to at least CANCEL_MARGIN_MS ahead.
// Anything else (non-refundable, past or within the margin of the deadline,
// unparseable date, payload missing) renders a plain statement or nothing —
// never a button we can't vouch for. The action is a quiet text link →
// inline confirm card → POST /hotels/nuitee/cancel { bookingId }; on success
// the chip flips to Cancelled, the parent is told via
// onStatusChange(bookingId, "cancelled"), and the sheet stays open. The done
// line states only what the cancel response carried: a refund amount when
// one is stated, or "Cancelled with charges" (+ the fee) when the supplier
// still charged (charged:true) — that path gets the error toast, never a
// refund sentence.
//
// HONEST-UX (non-negotiable, same as MyTrip): a tap is NOT a booking. The
// status vocabulary is Started / Confirmed / Completed / Cancelled — never
// "Booked" as a status. The shared display helpers (partnerLabel / fmtDate /
// statusLabel / splitProductName / StatusChip) live here so MyTrip and Trips
// render bookings with one vocabulary.
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ExternalLink, Share2, Navigation } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { openPartner } from "@/lib/openPartner";
import { shareBooking } from "@/lib/shareBooking";
import { prettyRoom } from "@/lib/roomName";
import { useDismissable } from "@/lib/dismissStack";
import { showToast } from "@/components/Toast";
import MapAppSelector from "@/components/MapAppSelector";
import { IVORY, TEAL_DEEP } from "@/components/redesign/constants";

// Editorial design tokens (shared with MyTrip / SavedLocations / PlacesToEat).
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK3 = "#736657";
const ED_RULE = "rgba(22,17,13,.10)";

export const PARTNER_LABEL = {
  viator: "Viator", stay22: "Stay22", discovercars: "Discover Cars", nuitee: "Booked in app",
  welcomepickups: "Welcome Pickups", kiwitaxi: "Kiwitaxi", airalo: "Airalo",
  radicalstorage: "Radical Storage", ticketmaster: "Ticketmaster",
  vividseats: "Vivid Seats", fever: "Fever", booking: "Booking.com",
  agoda: "Agoda", getyourguide: "GetYourGuide", stubhub: "StubHub",
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
export const partnerLabel = (p) => PARTNER_LABEL[(p || "").toLowerCase()] || cap(p);

export function fmtDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

// Nuitée writes product_name as "<hotel> · <checkin> → <checkout>" (worker
// nuiteeRecordBooking) — split the stay dates back out for the detail sheet.
// Anything that doesn't match stays whole; no other partner encodes dates.
const NUITEE_NAME_RE = /^(.*) · (\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2})$/;
export function splitProductName(name) {
  const m = NUITEE_NAME_RE.exec(name || "");
  return m ? { name: m[1], dates: m[2] } : { name: name || "", dates: null };
}

// Same vocabulary as StatusChip — never "Booked".
export const statusLabel = (status) =>
  ({ confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" })[(status || "").toLowerCase()] || "Started";

// Shared partner opener (in-app sheet on native) — see src/lib/openPartner.js
const openExternal = openPartner;

export function StatusChip({ status, fs }) {
  const map = {
    confirmed: { label: "Confirmed", bg: "#D8F4E5", fg: "#0F7A50" },
    // "Completed" is a DISPLAY status for confirmed stays whose checkout has
    // passed (Trips computes it) — the stored row stays "confirmed".
    completed: { label: "Completed", bg: "#EFEAE0", fg: "#736657" },
    cancelled: { label: "Cancelled", bg: "#FBE0E0", fg: "#B02525" },
    started: { label: "Started", bg: "#EFEAE0", fg: "#736657" },
  };
  const s = map[(status || "").toLowerCase()] || map.started;
  return (
    <span
      className="inline-flex items-center rounded-full font-semibold uppercase"
      style={{ background: s.bg, color: s.fg, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", padding: "3px 8px" }}
    >
      {s.label}
    </span>
  );
}

// ---- Nuitée live-payload readers (defensive: render only what exists) ------

// hotel.address may be a plain string or a structured object — normalize, and
// return null rather than guess when neither form is present.
function hotelAddress(hotel) {
  const a = hotel?.address;
  if (!a) return null;
  if (typeof a === "string") return a.trim() || null;
  if (typeof a === "object") {
    const s = [a.line1 || a.address || a.street || null, a.city || null, a.country || null]
      .filter(Boolean).join(", ");
    return s || null;
  }
  return null;
}

// One line per booked room: "Deluxe King · Breakfast included · 2 adults".
function roomLine(r) {
  if (!r || typeof r !== "object") return null;
  const name = r.roomType?.name || (typeof r.roomType === "string" ? r.roomType : null) || r.name || null;
  const board = r.boardName || r.boardType || null;
  const bits = [];
  const adults = Number(r.adults), children = Number(r.children);
  if (Number.isFinite(adults) && adults > 0) bits.push(`${adults} ${adults === 1 ? "adult" : "adults"}`);
  if (Number.isFinite(children) && children > 0) bits.push(`${children} ${children === 1 ? "child" : "children"}`);
  if (!bits.length && Array.isArray(r.guests) && r.guests.length) {
    bits.push(`${r.guests.length} ${r.guests.length === 1 ? "guest" : "guests"}`);
  }
  return [name, board, bits.join(", ")].filter(Boolean).join(" · ") || null;
}

// Total heads across rooms — for the redacted share only. Null when the
// payload carries no counts (never fabricate).
function partySize(rooms) {
  let n = 0;
  for (const r of rooms || []) {
    const a = Number(r?.adults), c = Number(r?.children);
    if (Number.isFinite(a) && a > 0) n += a;
    if (Number.isFinite(c) && c > 0) n += c;
    if (!Number.isFinite(a) && !Number.isFinite(c) && Array.isArray(r?.guests)) n += r.guests.length;
  }
  return n > 0 ? `${n} ${n === 1 ? "guest" : "guests"}` : null;
}

// Free-cancellation deadline from the live payload: Nuitée's explicit
// lastFreeCancellationDate, else the earliest cancelPolicyInfos[].cancelTime.
// Null when the payload carries neither — the caller then shows no action.
// ONE source of truth: the policy line, the button gate and the deadline
// lines all read this value.
function cancelDeadline(bk) {
  if (!bk || typeof bk !== "object") return null;
  const infos = bk.cancellationPolicies?.cancelPolicyInfos;
  const earliest = (Array.isArray(infos) ? infos : []).map((c) => c && c.cancelTime).filter(Boolean).sort()[0] || null;
  return bk.lastFreeCancellationDate || earliest || null;
}

// The timezone Nuitée states the deadline in — the earliest policy's, else the
// first policy carrying one. Null when none is stated.
function cancelDeadlineZone(bk) {
  const infos = bk?.cancellationPolicies?.cancelPolicyInfos;
  const list = Array.isArray(infos) ? infos.filter((c) => c && typeof c === "object") : [];
  const earliest = list.map((c) => c.cancelTime).filter(Boolean).sort()[0] || null;
  return list.find((c) => c.cancelTime === earliest)?.timezone || list.find((c) => c.timezone)?.timezone || null;
}

// Verbatim cancellation line from Nuitée's cancellationPolicies (refundableTag
// RFN + the same deadline the button gates on). No tag → no line.
function cancellationLine(bk) {
  const cp = bk?.cancellationPolicies;
  if (!cp || typeof cp !== "object" || !cp.refundableTag) return null;
  if (cp.refundableTag === "RFN") {
    const by = cancelDeadline(bk);
    return `Free cancellation${by ? ` until ${String(by).slice(0, 10)}` : ""}`;
  }
  return "Non-refundable";
}

// Deadline → epoch ms, or NaN. Same logic as the worker's nuiteeDeadlineMs so
// the button and the /hotels/nuitee/cancel gate agree: a value with an explicit
// offset / Z is exact; an offset-less wall-clock (or a date-only value, read as
// the END of that day) is resolved in the policy's timezone via Intl, UTC when
// the zone is missing or invalid — never the device's zone.
function resolveDeadlineMs(value, timezone) {
  const str = String(value || "").trim();
  if (!str) return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(str);
  if (!m) return Date.parse(str);
  const hasTime = m[4] != null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], hasTime ? +m[4] : 23, hasTime ? +m[5] : 59, hasTime ? +(m[6] || 0) : 59);
  if (!Number.isFinite(wall)) return NaN;
  if (m[7]) {
    const o = m[7].toUpperCase();
    const off = o === "Z" ? 0 : (o[0] === "-" ? -1 : 1) * (Number(o.slice(1, 3)) * 60 + Number(o.slice(-2))) * 60000;
    return wall - off;
  }
  let fmt = null;
  try {
    fmt = timezone ? new Intl.DateTimeFormat("en-US", { timeZone: String(timezone), hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
  } catch { fmt = null; }
  if (!fmt) return wall;
  const zoneWall = (ms) => {
    const p = {};
    for (const { type, value: v } of fmt.formatToParts(new Date(ms))) p[type] = v;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  };
  let utc = wall - (zoneWall(wall) - wall);
  utc = wall - (zoneWall(utc) - utc); // second pass settles a DST-edge deadline
  return Number.isFinite(utc) ? utc : NaN;
}

// The button is hidden this close to the cutoff. Wider than the worker's own
// 30-minute gate on purpose: the app must never offer a cancel the worker will
// refuse a moment later.
const CANCEL_MARGIN_MS = 60 * 60 * 1000;

// "120.00 USD" — the one money format this sheet uses. Null unless BOTH a
// finite amount and a currency exist (never "120 null").
function fmtMoney(amount, currency) {
  return amount != null && Number.isFinite(Number(amount)) && currency
    ? `${Number(amount).toFixed(2)} ${currency}` : null;
}

// step: idle | confirm | busy | done. On done: already (a repeat / cancelled
// upstream), charged (supplier still charged — CANCELLED_WITH_CHARGES), fee and
// refund as "120.00 USD" strings ONLY when the response stated an amount > 0.
const CANCEL_IDLE = { step: "idle", already: false, charged: false, fee: null, refund: null };

export default function BookingDetailSheet({ booking, accent = TEAL_DEEP, onClose, onStatusChange, fs, t }) {
  const isOpen = !!booking;
  useDismissable(isOpen, onClose);
  // "Get Directions" sheet for the stay address — the exact MapAppSelector every
  // finder uses (e.g. CoffeeFinder.jsx). No device location here, so the sheet
  // opens on its "Other address" origin mode.
  const [showMap, setShowMap] = useState(false);
  useEffect(() => { if (!isOpen) setShowMap(false); }, [isOpen]); // never leak an open map into the next booking

  const inApp = !!booking && (booking.partner || "").toLowerCase() === "nuitee";
  const bookingId = inApp && booking.product_id ? String(booking.product_id) : null;

  // Cancel flow state — reset whenever the sheet closes or the booking changes
  // (same discipline as showMap: nothing leaks into the next booking).
  const [cancelUi, setCancelUi] = useState(CANCEL_IDLE);
  useEffect(() => { setCancelUi(CANCEL_IDLE); }, [isOpen, bookingId]);
  // The booking currently on screen, readable after an await: a late cancel
  // response for stay A must never paint stay B's sheet. Also the parent's
  // latest onStatusChange, for the async paths below.
  const shownId = useRef(bookingId);
  shownId.current = bookingId;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const tellParent = (id, status) => {
    if (typeof onStatusChangeRef.current === "function") onStatusChangeRef.current(id, status);
  };

  // Live Nuitée record, cached per bookingId for the life of the page:
  //   bookingId -> { booking } | { failed: true }.
  // On failure/offline the render below falls back to the /aff/mine row.
  const [nuiteeDetails, setNuiteeDetails] = useState({});
  const inflight = useRef(new Set()); // bookingIds with a call already running
  useEffect(() => {
    if (!isOpen || !bookingId) return;
    if (nuiteeDetails[bookingId] || inflight.current.has(bookingId)) return; // cached / in flight
    inflight.current.add(bookingId);
    (async () => {
      // EXISTING worker route (POST /hotels/nuitee/booking) — body is
      // { bookingId }; the worker verifies this user owns the row (D1), then
      // reads Nuitée's /bookings/{id}. callWorker never throws.
      const { data, error } = await callWorker("hotels/nuitee/booking", { bookingId });
      inflight.current.delete(bookingId);
      // A failure is cached too (fallback view, no hammering); the cache lives
      // only as long as the page, so a reopen after a reload retries.
      setNuiteeDetails((prev) => ({
        ...prev,
        [bookingId]: !error && data?.booking ? { booking: data.booking } : { failed: true },
      }));
      // Cancelled outside the app (Nuitée dashboard, the hotel, support): the
      // sheet shows CANCELLED, so the row behind it must agree right now — not
      // after the worker's background write-through and a fresh /aff/mine.
      if (!error && data?.booking?.status === "CANCELLED" && (booking?.status || "").toLowerCase() !== "cancelled") {
        tellParent(bookingId, "cancelled");
      }
    })();
  }, [isOpen, bookingId]); // nuiteeDetails/inflight/booking are read as guards, not triggers

  if (!booking) return null;

  const it = booking;
  const { name, dates } = splitProductName(it.product_name);
  const title = name || partnerLabel(it.partner);
  const destination = it.dest_city
    ? `${it.dest_city}${it.dest_country ? `, ${it.dest_country}` : ""}`
    : (it.dest_country || null);

  // ---- Nuitée live payload (null until the call lands / on fallback) ----
  const entry = bookingId ? nuiteeDetails[bookingId] : null;
  const bk = entry?.booking || null;
  const fetching = inApp && !!bookingId && !entry;
  const stayDates = (bk?.checkin && bk?.checkout) ? `${bk.checkin} → ${bk.checkout}` : dates;
  const confirmationCode = bk?.hotelConfirmationCode || null;
  // Room lines from the live payload; when it carries none, the worker-merged
  // roomLabel (prebook-confirmed room · board) fills in — never both.
  const roomLines = Array.isArray(bk?.rooms) ? bk.rooms.map(roomLine).filter(Boolean) : [];
  const rooms = (roomLines.length ? roomLines : (bk?.roomLabel ? [bk.roomLabel] : [])).map(prettyRoom);
  const holderName = bk?.holder
    ? [bk.holder.firstName, bk.holder.lastName].filter(Boolean).join(" ") || null
    : null;
  // Status for the chip + mono line: "cancelled" ONLY from a cancel that just
  // succeeded here or Nuitée's own record saying CANCELLED — else the row's.
  const effectiveStatus = cancelUi.step === "done" || bk?.status === "CANCELLED" ? "cancelled" : it.status;
  const isCancelledNow = effectiveStatus === "cancelled";
  // The policy line is meaningless once the stay is cancelled — the cancel
  // block below states the cancelled facts instead.
  const cancelLine = isCancelledNow ? null : cancellationLine(bk);
  const paidAmount = fmtMoney(bk?.price, bk?.currency);

  // ---- Cancellability — from the LIVE payload only (never the /aff/mine row) ----
  const liveConfirmed = bk?.status === "CONFIRMED";
  const refundableTag = bk?.cancellationPolicies?.refundableTag || null;
  const deadline = cancelDeadline(bk);
  const deadlineMs = resolveDeadlineMs(deadline, cancelDeadlineZone(bk));
  const deadlineDate = deadline ? String(deadline).slice(0, 10) : null; // same YYYY-MM-DD the policy line uses
  const deadlineValid = Number.isFinite(deadlineMs);
  const deadlineAhead = deadlineValid && deadlineMs > Date.now() + CANCEL_MARGIN_MS;
  // Unparseable deadline → no button (honest fallback), no line either.
  const canCancel = !isCancelledNow && liveConfirmed && refundableTag === "RFN" && deadlineAhead;
  const nonRefundable = !isCancelledNow && liveConfirmed && refundableTag === "NRFN";
  const refundableLive = !isCancelledNow && liveConfirmed && refundableTag === "RFN" && deadlineValid;
  const deadlinePassed = refundableLive && deadlineMs <= Date.now();
  // Still free to cancel, but inside the margin — the app won't offer it.
  const deadlineClosing = refundableLive && !deadlinePassed && !deadlineAhead;
  // Already-cancelled facts — ONLY what Nuitée's record carries.
  const cancelledOn = bk?.cancelledAt ? String(bk.cancelledAt).slice(0, 10) : null;
  const refundedAmount = Number(bk?.amountRefunded) > 0 ? fmtMoney(bk.amountRefunded, bk.currency) : null;
  // Address: Nuitée's live hotel record first, else the stay fields the worker
  // merged from the prebook session (Wave 3). Coords come the same way — only
  // ever real values; MapAppSelector uses them as a fallback destination.
  const address = hotelAddress(bk?.hotel) || bk?.address || null;
  const stayLat = bk?.hotel?.latitude ?? bk?.lat ?? null;
  const stayLng = bk?.hotel?.longitude ?? bk?.lng ?? null;
  // The reference the hotel front desk recognizes: their confirmation code
  // when Nuitée has one, else the booking id.
  const refCode = confirmationCode || it.product_id || null;

  const canOpen = !inApp && !!it.target_url;

  // Partner rows: booked-tap date only. Nuitée rows: real stay dates.
  const monoLine = inApp
    ? [stayDates, statusLabel(effectiveStatus)].filter(Boolean).join(" · ")
    : [`Booked via ${partnerLabel(it.partner)}`, fmtDate(it.ts), statusLabel(effectiveStatus)].filter(Boolean).join(" · ");

  // POST /hotels/nuitee/cancel { bookingId }. callWorker never throws; on a
  // non-2xx it returns { data: null, error: <body.error | "HTTP <status>"> }
  // (src/lib/callWorker.js) — so 409 bodies arrive as their error code only
  // (no cancelBy), and the 401 { needsAuth } body arrives as "HTTP 401".
  const runCancel = async () => {
    if (!bookingId || cancelUi.step === "busy") return;
    setCancelUi({ ...CANCEL_IDLE, step: "busy" });
    const { data, error } = await callWorker("hotels/nuitee/cancel", { bookingId });
    // The sheet is dismissible while busy: if another stay (or none) is on
    // screen now, the record and the parent are still updated for THIS id,
    // but nothing is painted or toasted on the other stay's sheet.
    const stillShown = shownId.current === bookingId;
    if (!error && data?.status === "cancelled") {
      const already = !!data.already;
      // Amounts stated only from the cancel response itself, and only when it
      // stated a positive one — "0.00 USD refund" is not a refund.
      const currency = data.currency || bk?.currency;
      const charged = !already && (data.charged === true || data.nuiteeStatus === "CANCELLED_WITH_CHARGES" || Number(data.cancellationFee) > 0);
      const fee = charged && Number(data.cancellationFee) > 0 ? fmtMoney(data.cancellationFee, currency) : null;
      const refund = !already && Number(data.refundAmount) > 0 ? fmtMoney(data.refundAmount, currency) : null;
      if (stillShown) setCancelUi({ step: "done", already, charged, fee, refund });
      // Keep the cached live record truthful for a reopen on this page: the
      // status Nuitée now holds (+ its cancelledAt when the response carried
      // one). amountRefunded is NOT set — a promised refund isn't a refunded one.
      setNuiteeDetails((prev) => {
        const cur = prev[bookingId]?.booking;
        if (!cur) return prev;
        return { ...prev, [bookingId]: { booking: { ...cur, status: "CANCELLED", ...(data.cancelledAt ? { cancelledAt: data.cancelledAt } : {}) } } };
      });
      if (stillShown && !already) showToast(charged ? "Cancelled with charges" : "Stay cancelled", charged ? "error" : "success");
      tellParent(bookingId, "cancelled");
      return;
    }
    if (!stillShown) return;
    // Error — keep the confirm card open so the traveler can retry or keep the stay.
    setCancelUi({ ...CANCEL_IDLE, step: "confirm" });
    const code = error || data?.error || null;
    let msg;
    if (code === "non_refundable") msg = "This rate is non-refundable, so it can't be cancelled for a refund.";
    else if (code === "past_deadline") msg = "Free cancellation has ended, or is too close to its cutoff to cancel from the app.";
    else if (code === "deadline_unknown") msg = "The free-cancellation deadline couldn't be confirmed, so this stay can't be cancelled from the app.";
    else if (code === "not_cancellable") msg = "This stay can't be cancelled from the app.";
    else if (code === "HTTP 401" || code === "needsAuth" || code === "unauthorized") msg = "Sign in again to cancel.";
    else msg = "Couldn't reach the booking partner. Try again in a moment.";
    showToast(msg, "error");
  };

  const copyRef = async () => {
    try {
      if (!navigator.clipboard) { showToast("Copying isn't available on this device", "error"); return; }
      await navigator.clipboard.writeText(String(refCode));
      showToast("Booking reference copied", "success");
    } catch {
      showToast("Couldn't copy the reference", "error");
    }
  };

  // REDACTED share — name, dates, city, address (+maps) when present, party
  // size. Never the reference, amounts, or holder contacts (shareBooking.js).
  const onShare = () => shareBooking({
    name: title,
    dates: inApp ? stayDates : null, // partner rows carry no travel dates — share none
    city: destination,
    address: inApp ? address : null,
    partySize: inApp ? partySize(bk?.rooms) : null,
  });

  // Mono key/value rows for the Nuitée detail card — absent fields hidden.
  const detailRows = [
    ["Stay dates", stayDates],
    ...rooms.map((r, i) => [rooms.length > 1 ? `Room ${i + 1}` : "Room", r]),
    ["Holder", holderName],
    // The property's own number, only when Nuitée's record carries one — a tap dials it.
    ["Hotel phone", bk?.hotelPhone
      ? <a href={`tel:${String(bk.hotelPhone).replace(/[^\d+]/g, "")}`} style={{ color: TEAL_DEEP, textDecoration: "underline" }}>{bk.hotelPhone}</a>
      : null],
    ["Destination", destination],
    ["Booked", fmtDate(it.ts) || null],
  ].filter(([, v]) => !!v);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9995]"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Booking details"
            className="fixed bottom-0 left-0 right-0 z-[9996] rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[85vh] overflow-y-auto"
            style={{ background: IVORY }}
          >
            {/* Header — status + partner kicker, same vocabulary as the list */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: ED_RULE }}>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusChip status={effectiveStatus} fs={fs} />
                <span className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: accent }}>
                  {partnerLabel(it.partner)}
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
                style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}
              >
                <X size={16} color={ED_INK3} strokeWidth={2.2} />
              </button>
            </div>

            <div className="px-5 pt-4 pb-6">
              <h3 style={{ fontFamily: ED_SERIF, fontSize: t(fs(24), fs(21)), color: ED_INK, lineHeight: 1.15 }}>
                {title}
              </h3>
              {!inApp && destination && (
                <p className="mt-1" style={{ color: ED_INK3, fontSize: t(fs(13), fs(12.5)) }}>
                  {destination}
                </p>
              )}
              <p className="mt-2" style={{ fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".04em", color: ED_INK3 }}>
                {monoLine}
              </p>

              {/* ── In-app (Nuitée) hotel detail ── */}
              {inApp && (
                <>
                  {/* Reference — hotel confirmation code first (the code a front
                      desk recognizes), booking id beneath. Copy takes the code
                      when Nuitée has one, else the booking id. */}
                  {refCode && (
                    <div className="mt-4 p-3 rounded-[14px] flex items-center gap-3" style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}>
                      <div className="min-w-0 flex-1">
                        <div className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: ED_INK3 }}>
                          {confirmationCode ? "Hotel confirmation" : "Booking reference"}
                        </div>
                        <div className="truncate mt-0.5" style={{ fontFamily: ED_MONO, fontSize: fs(13), color: ED_INK }}>
                          {refCode}
                        </div>
                        {confirmationCode && it.product_id && (
                          <div className="truncate mt-0.5" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3 }}>
                            Booking ID {it.product_id}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={copyRef}
                        aria-label="Copy booking reference"
                        className="flex-none inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-semibold uppercase transition-transform active:scale-95"
                        style={{ background: "#EFEAE0", color: ED_INK, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".06em" }}
                      >
                        <Copy size={12} strokeWidth={2.2} /> Copy
                      </button>
                    </div>
                  )}

                  {fetching && (
                    <p className="mt-3 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".05em", color: ED_INK3 }}>
                      Fetching booking details…
                    </p>
                  )}

                  {!fetching && (
                    <div className="mt-4 p-3 rounded-[14px]" style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}>
                      {detailRows.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-3 py-1">
                          <span className="uppercase font-semibold flex-none" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: ED_INK3 }}>
                            {k}
                          </span>
                          <span className="text-right min-w-0" style={{ fontFamily: ED_MONO, fontSize: fs(11.5), color: ED_INK, overflowWrap: "anywhere" }}>
                            {v}
                          </span>
                        </div>
                      ))}
                      {cancelLine && (
                        <p className="pt-2 mt-1 border-t" style={{ borderColor: ED_RULE, fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".04em", color: cancelLine === "Non-refundable" ? "#B02525" : "#0F7A50" }}>
                          {cancelLine}
                        </p>
                      )}
                      {paidAmount && (
                        <div className={cancelLine ? "pt-2" : "pt-2 mt-1 border-t"} style={{ borderColor: ED_RULE }}>
                          <p style={{ fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".04em", color: ED_INK }}>
                            Paid {paidAmount} · charged by Nuitée
                          </p>
                          <p className="mt-0.5" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".04em", color: ED_INK3 }}>
                            Nuitée is the name on your card statement.
                          </p>
                          {/* Only when the worker recorded Resend's acceptance — never from an attempt. */}
                          {bk?.emailedTo && (
                            <p className="mt-0.5" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".04em", color: ED_INK3 }}>
                              Confirmation emailed to {bk.emailedTo}
                            </p>
                          )}
                        </div>
                      )}
                      {!bk && (
                        <p className="pt-2 mt-1 border-t" style={{ borderColor: ED_RULE, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3 }}>
                          Live details unavailable — quote the reference above to the hotel.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Address ONLY when the booking payload carries one — a tap
                      opens the same Get Directions sheet every finder uses. */}
                  {!fetching && (
                    address ? (
                      <button
                        onClick={() => setShowMap(true)}
                        className="mt-3 p-3 rounded-[14px] w-full flex items-center gap-3 text-left transition-transform active:scale-[0.98]"
                        style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: ED_INK3 }}>
                            Address
                          </div>
                          <p className="mt-0.5" style={{ fontFamily: ED_MONO, fontSize: fs(11.5), color: ED_INK, overflowWrap: "anywhere" }}>
                            {address}
                          </p>
                        </div>
                        <span
                          className="flex-none inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-semibold uppercase"
                          style={{ background: "#EFEAE0", color: ED_INK, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".06em" }}
                        >
                          <Navigation size={12} strokeWidth={2.2} /> Directions
                        </span>
                      </button>
                    ) : (
                      refCode && (
                        <p className="mt-3 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3, lineHeight: 1.6 }}>
                          Address not on file — quote reference {refCode} to the hotel.
                        </p>
                      )
                    )
                  )}

                  {/* ── Cancellation — one of: just-cancelled line · already-cancelled
                      facts · quiet cancel action / confirm card · non-refundable ·
                      deadline passed · nothing (payload missing or unparseable). */}
                  {!fetching && cancelUi.step === "done" && (
                    <p className="mt-4 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".04em", color: "#B02525", lineHeight: 1.6 }}>
                      {cancelUi.already
                        ? "Already cancelled with Nuitée"
                        : cancelUi.charged
                          ? `Cancelled with charges${cancelUi.fee ? ` · ${cancelUi.fee} cancellation fee` : ""}${cancelUi.refund ? ` · ${cancelUi.refund} refunded` : ""}`
                          : `Cancelled${cancelUi.refund ? ` · ${cancelUi.refund} refund to your card` : ""}`}
                    </p>
                  )}
                  {!fetching && cancelUi.step !== "done" && isCancelledNow && (
                    <p className="mt-4 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".04em", color: "#B02525", lineHeight: 1.6 }}>
                      Cancelled{cancelledOn ? ` on ${cancelledOn}` : ""}{refundedAmount ? ` · ${refundedAmount} refunded` : ""}{bk?.cancellationEmailedTo ? ` · notice emailed to ${bk.cancellationEmailedTo}` : ""}
                    </p>
                  )}
                  {!fetching && canCancel && (cancelUi.step === "idle") && (
                    <div className="mt-4 px-1">
                      <button
                        onClick={() => setCancelUi({ ...CANCEL_IDLE, step: "confirm" })}
                        className="font-semibold uppercase transition-colors hover:bg-black/5 rounded-full -mx-2 px-2 py-1"
                        style={{ fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".08em", color: "#B02525" }}
                      >
                        Cancel this stay
                      </button>
                      <p className="mt-1" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".04em", color: ED_INK3, lineHeight: 1.6 }}>
                        Need different dates? Cancel, then book again — stays booked in the app can't be changed.
                      </p>
                    </div>
                  )}
                  {!fetching && canCancel && (cancelUi.step === "confirm" || cancelUi.step === "busy") && (
                    <div className="mt-4 p-3 rounded-[14px]" style={{ background: "#FBE0E0", border: `1px solid ${ED_RULE}` }}>
                      <div className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: "#B02525" }}>
                        Cancel this stay?
                      </div>
                      <p className="mt-1" style={{ fontFamily: ED_MONO, fontSize: fs(11.5), color: ED_INK, overflowWrap: "anywhere" }}>
                        {[title, stayDates].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-2" style={{ fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".03em", color: ED_INK3, lineHeight: 1.6 }}>
                        Free cancellation applies — the refund goes back through Nuitée, who charged your card. The amount is confirmed when the cancellation goes through; timing depends on your bank.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setCancelUi(CANCEL_IDLE)}
                          disabled={cancelUi.step === "busy"}
                          className="flex-1 py-2.5 rounded-full font-semibold uppercase transition-transform active:scale-95 disabled:opacity-60"
                          style={{ background: "#FFFFFF", color: ED_INK, border: `1px solid ${ED_RULE}`, fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".07em" }}
                        >
                          Keep stay
                        </button>
                        <button
                          onClick={runCancel}
                          disabled={cancelUi.step === "busy"}
                          className="flex-1 py-2.5 rounded-full font-semibold uppercase transition-transform active:scale-95 disabled:opacity-60"
                          style={{ background: "#B02525", color: "#FFFFFF", fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".07em" }}
                        >
                          {cancelUi.step === "busy" ? "Cancelling…" : "Yes, cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                  {!fetching && nonRefundable && (
                    <p className="mt-4 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3, lineHeight: 1.6 }}>
                      Non-refundable — this stay can't be cancelled for a refund.
                    </p>
                  )}
                  {!fetching && deadlinePassed && (
                    <p className="mt-4 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3, lineHeight: 1.6 }}>
                      Free cancellation ended {deadlineDate}.
                    </p>
                  )}
                  {!fetching && deadlineClosing && (
                    <p className="mt-4 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3, lineHeight: 1.6 }}>
                      Free cancellation ends {deadlineDate} — too close to the cutoff to cancel from the app.
                    </p>
                  )}
                </>
              )}

              {/* ── Partner / event variant ── */}
              {!inApp && (
                <p className="mt-4 px-1" style={{ color: ED_INK3, fontSize: t(fs(13), fs(12.5)), lineHeight: 1.55 }}>
                  Your confirmation and details live with {partnerLabel(it.partner)}.
                </p>
              )}

              {/* ONE primary action max — the partner reopen. In-app rows have
                  their record above and no primary action. */}
              {canOpen && (
                <button
                  onClick={() => { openExternal(it.target_url); onClose(); }}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold uppercase transition-transform active:scale-95"
                  style={{ background: TEAL_DEEP, color: "#FFFFFF", fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".07em" }}
                >
                  Manage with {partnerLabel(it.partner)} <ExternalLink size={13} strokeWidth={2.2} />
                </button>
              )}

              {/* Quiet share — redacted summary, never the reference. */}
              <div className="mt-5 text-center">
                <button
                  onClick={onShare}
                  className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold uppercase transition-colors hover:bg-black/5 rounded-full"
                  style={{ fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".08em", color: ED_INK3 }}
                >
                  <Share2 size={13} strokeWidth={2.2} /> Share
                </button>
                <p style={{ fontFamily: ED_MONO, fontSize: fs(9), letterSpacing: ".05em", color: ED_INK3 }}>
                  Reference number not included.
                </p>
              </div>
            </div>
            <div className="h-2" />
          </motion.div>

          {/* Get Directions — the shared finder sheet (name + address destination,
              coords only as MapAppSelector's own fallback). Stacks above this
              sheet (z-9998/9999 vs 9995/9996). */}
          <MapAppSelector
            isOpen={showMap}
            onClose={() => setShowMap(false)}
            destination={{ name: title, address: address || "", latitude: stayLat, longitude: stayLng }}
          />
        </>
      )}
    </AnimatePresence>
  );
}
