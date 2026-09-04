// BookingDetailSheet — the booking detail bottom-sheet, extracted from MyTrip
// so the Trips surface (BOOKED tab) opens the exact same sheet. Mirrors the
// MapAppSelector / AllServicesSheet pattern (motion sheet + backdrop; the global
// swipe-down dismisses via useDismissable). Shows ONLY fields /aff/mine already
// returns — nothing invented, absent rows hidden — and at most ONE primary
// action: reopen the partner (openPartner) for affiliate rows, or reveal the
// stored booking info for in-app (Nuitée) rows, with no new worker calls.
// (taps/key are plumbing and commission is OUR affiliate cut — never shown.)
//
// HONEST-UX (non-negotiable, same as MyTrip): a tap is NOT a booking. The
// status vocabulary is Started / Confirmed / Cancelled — never "Booked".
// The shared display helpers (partnerLabel / fmtDate / statusLabel /
// splitProductName / StatusChip) live here so MyTrip and Trips render bookings
// with one vocabulary.
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ExternalLink } from "lucide-react";
import { openPartner } from "@/lib/openPartner";
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
  ({ confirmed: "Confirmed", cancelled: "Cancelled" })[(status || "").toLowerCase()] || "Started";

// Shared partner opener (in-app sheet on native) — see src/lib/openPartner.js
const openExternal = openPartner;

export function StatusChip({ status, fs }) {
  const map = {
    confirmed: { label: "Confirmed", bg: "#D8F4E5", fg: "#0F7A50" },
    cancelled: { label: "Cancelled", bg: "#FBE0E0", fg: "#B02525" },
    started: { label: "Started", bg: "#EFEAE0", fg: "#736657" },
  };
  const s = map[status] || map.started;
  return (
    <span
      className="inline-flex items-center rounded-full font-semibold uppercase"
      style={{ background: s.bg, color: s.fg, fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", padding: "3px 8px" }}
    >
      {s.label}
    </span>
  );
}

export default function BookingDetailSheet({ booking, accent = TEAL_DEEP, onClose, fs, t }) {
  const isOpen = !!booking;
  useDismissable(isOpen, onClose);
  // Nuitée "Booking details" reveal — collapsed again each time the sheet opens.
  const [showStored, setShowStored] = useState(false);
  useEffect(() => { if (isOpen) setShowStored(false); }, [isOpen]);
  if (!booking) return null;

  const it = booking;
  const inApp = (it.partner || "").toLowerCase() === "nuitee";
  const canOpen = !inApp && !!it.target_url;
  const { name, dates } = splitProductName(it.product_name);
  const title = name || partnerLabel(it.partner);
  // One mono line: dates · ref · status. Nuitée rows carry real stay dates in
  // product_name; every other partner only has the booking-tap timestamp.
  const monoLine = [dates || fmtDate(it.ts), it.product_id ? `ref ${it.product_id}` : null, statusLabel(it.status)]
    .filter(Boolean).join(" · ");

  const copyRef = async () => {
    try {
      if (!navigator.clipboard) { showToast("Copying isn't available on this device", "error"); return; }
      await navigator.clipboard.writeText(String(it.product_id));
      showToast("Booking reference copied", "success");
    } catch {
      showToast("Couldn't copy the reference", "error");
    }
  };

  // Stored fields the traveler can act on — hide whatever this row doesn't have.
  const storedRows = [
    ["Stay dates", dates],
    ["Destination", it.dest_city ? `${it.dest_city}${it.dest_country ? `, ${it.dest_country}` : ""}` : (it.dest_country || null)],
    ["Booked on", fmtDate(it.ts) || null],
    ["Currency", it.currency || null],
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
            {/* Header — status + partner, same vocabulary as the list */}
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
              <p className="mt-2" style={{ fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".04em", color: ED_INK3 }}>
                {monoLine}
              </p>

              {it.product_id && (
                <div className="mt-4 p-3 rounded-[14px] flex items-center gap-3" style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}>
                  <div className="min-w-0 flex-1">
                    <div className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: ED_INK3 }}>
                      Booking reference
                    </div>
                    <div className="truncate mt-0.5" style={{ fontFamily: ED_MONO, fontSize: fs(13), color: ED_INK }}>
                      {it.product_id}
                    </div>
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

              {inApp && showStored && (
                <div className="mt-4 p-3 rounded-[14px]" style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}>
                  {storedRows.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3 py-1">
                      <span className="uppercase font-semibold flex-none" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: ED_INK3 }}>
                        {k}
                      </span>
                      <span className="text-right min-w-0" style={{ fontFamily: ED_MONO, fontSize: fs(11.5), color: ED_INK, overflowWrap: "anywhere" }}>
                        {v}
                      </span>
                    </div>
                  ))}
                  <p className="pt-2 mt-1 border-t" style={{ borderColor: ED_RULE, fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".04em", color: ED_INK3 }}>
                    Confirmation emailed
                  </p>
                </div>
              )}

              {/* ONE primary action max */}
              {inApp && !showStored && (
                <button
                  onClick={() => setShowStored(true)}
                  className="mt-5 w-full py-3 rounded-full font-semibold uppercase transition-transform active:scale-95"
                  style={{ background: TEAL_DEEP, color: "#FFFFFF", fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".07em" }}
                >
                  Booking details
                </button>
              )}
              {canOpen && (
                <button
                  onClick={() => { openExternal(it.target_url); onClose(); }}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold uppercase transition-transform active:scale-95"
                  style={{ background: TEAL_DEEP, color: "#FFFFFF", fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".07em" }}
                >
                  View on {partnerLabel(it.partner)} <ExternalLink size={13} strokeWidth={2.2} />
                </button>
              )}
            </div>
            <div className="h-2" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
