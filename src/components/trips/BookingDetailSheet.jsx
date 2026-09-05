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
// HONEST-UX (non-negotiable, same as MyTrip): a tap is NOT a booking. The
// status vocabulary is Started / Confirmed / Completed / Cancelled — never
// "Booked" as a status. The shared display helpers (partnerLabel / fmtDate /
// statusLabel / splitProductName / StatusChip) live here so MyTrip and Trips
// render bookings with one vocabulary.
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ExternalLink, Share2 } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { openPartner } from "@/lib/openPartner";
import { shareBooking } from "@/lib/shareBooking";
import { useDismissable } from "@/lib/dismissStack";
import { showToast } from "@/components/Toast";
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

// Verbatim cancellation line from Nuitée's cancellationPolicies — the same
// reading the worker's checkout page uses (refundableTag RFN + earliest
// cancelTime). No tag → no line.
function cancellationLine(cp) {
  if (!cp || typeof cp !== "object" || !cp.refundableTag) return null;
  if (cp.refundableTag === "RFN") {
    const by = (cp.cancelPolicyInfos || []).map((c) => c && c.cancelTime).filter(Boolean).sort()[0] || null;
    return `Free cancellation${by ? ` until ${String(by).slice(0, 10)}` : ""}`;
  }
  return "Non-refundable";
}

export default function BookingDetailSheet({ booking, accent = TEAL_DEEP, onClose, fs, t }) {
  const isOpen = !!booking;
  useDismissable(isOpen, onClose);

  const inApp = !!booking && (booking.partner || "").toLowerCase() === "nuitee";
  const bookingId = inApp && booking.product_id ? String(booking.product_id) : null;

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
    })();
  }, [isOpen, bookingId]); // nuiteeDetails/inflight are read as guards, not triggers

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
  const rooms = Array.isArray(bk?.rooms) ? bk.rooms.map(roomLine).filter(Boolean) : [];
  const holderName = bk?.holder
    ? [bk.holder.firstName, bk.holder.lastName].filter(Boolean).join(" ") || null
    : null;
  const cancelLine = cancellationLine(bk?.cancellationPolicies);
  const paidAmount = bk && bk.price != null && Number.isFinite(Number(bk.price)) && bk.currency
    ? `${Number(bk.price).toFixed(2)} ${bk.currency}` : null;
  const address = hotelAddress(bk?.hotel);
  // The reference the hotel front desk recognizes: their confirmation code
  // when Nuitée has one, else the booking id.
  const refCode = confirmationCode || it.product_id || null;

  const canOpen = !inApp && !!it.target_url;

  // Partner rows: booked-tap date only. Nuitée rows: real stay dates.
  const monoLine = inApp
    ? [stayDates, statusLabel(it.status)].filter(Boolean).join(" · ")
    : [`Booked via ${partnerLabel(it.partner)}`, fmtDate(it.ts), statusLabel(it.status)].filter(Boolean).join(" · ");

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
                <StatusChip status={it.status} fs={fs} />
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
                        </div>
                      )}
                      {!bk && (
                        <p className="pt-2 mt-1 border-t" style={{ borderColor: ED_RULE, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3 }}>
                          Confirmation emailed
                        </p>
                      )}
                    </div>
                  )}

                  {/* Address ONLY when the booking payload carries one. */}
                  {!fetching && (
                    address ? (
                      <div className="mt-3 p-3 rounded-[14px]" style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}>
                        <div className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: ED_INK3 }}>
                          Address
                        </div>
                        <p className="mt-0.5" style={{ fontFamily: ED_MONO, fontSize: fs(11.5), color: ED_INK, overflowWrap: "anywhere" }}>
                          {address}
                        </p>
                      </div>
                    ) : (
                      refCode && (
                        <p className="mt-3 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3, lineHeight: 1.6 }}>
                          Address not on file — quote reference {refCode} to the hotel.
                        </p>
                      )
                    )
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
        </>
      )}
    </AnimatePresence>
  );
}
