// HotelBookSheet — the in-app hotel checkout (Nuitée Connect lane).
//
// Stages: form → prebooking → ready → paying → booked | failed | pending.
// The card form itself is Nuitée's Payment SDK on a page served by OUR worker,
// opened in the same in-app sheet Viator uses; when that sheet closes we ask
// the worker whether the session booked. Card data never touches the app, and
// the app never sees the payment secrets — only a session id.
// Prices here are Closed-User-Group rates: rendered only behind the sign-in
// gate (App.jsx), never on share cards or web pages.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { useAuth } from "@/lib/AuthContext";
import { openPartnerAndWait } from "@/lib/openPartner";
import { createPageUrl } from "@/utils";

const ACCENT = "#2563EB", INK = "#16110D", INK2 = "#5F5546", RULE = "#F0E9DC", OK = "#2E7D46", BAD = "#C2392F";
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

export default function HotelBookSheet({ hotel, checkin, checkout, adults, children, dest, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const meta = user?.user_metadata || {};
  const guess = splitName(meta.full_name || meta.name);
  const [holder, setHolder] = useState({
    firstName: meta.first_name || guess.first, lastName: meta.last_name || guess.last,
    email: user?.email || "", phone: meta.phone || "",
  });
  const [stage, setStage] = useState("form");   // form · prebooking · ready · paying · booked · failed · pending
  const [pre, setPre] = useState(null);         // /hotels/nuitee/prebook response
  const [err, setErr] = useState(null);
  const [booking, setBooking] = useState(null);
  const set = (k) => (e) => setHolder((h) => ({ ...h, [k]: e.target.value }));
  const valid = holder.firstName.trim() && holder.lastName.trim() && /^\S+@\S+\.\S+$/.test(holder.email);

  const prebook = async () => {
    if (!valid) return;
    setStage("prebooking"); setErr(null);
    try {
      const { data } = await callWorker("hotels/nuitee/prebook", {
        offerId: hotel.offerId, hotelName: hotel.name, holder, adults, children,
        dest_city: dest?.city || hotel.city || "", dest_country: dest?.country || hotel.country || "",
      });
      if (!data?.sid) { setErr(data?.detail || data?.error || "This rate is no longer available — pick another stay."); setStage("form"); return; }
      setPre(data); setStage("ready");
    } catch { setErr("Couldn't reach the booking service. Check your connection and try again."); setStage("form"); }
  };
  const checkStatus = async () => {
    try {
      const { data } = await callWorker("hotels/nuitee/status", { sid: pre.sid });
      if (data?.status === "booked") { setBooking(data.booking); setStage("booked"); }
      else if (data?.status === "failed") { setErr(data.error || "The hotel could not confirm this rate."); setStage("failed"); }
      else setStage("pending");
    } catch { setStage("pending"); }
  };
  const pay = async () => {
    setStage("paying");
    await openPartnerAndWait(pre.checkoutUrl);   // resolves when the payment sheet closes (native)
    await checkStatus();
  };

  const nights = hotel.nights || Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000));
  const price = pre?.price ?? hotel.price;
  const cur = pre?.currency || hotel.currency || "USD";
  const room = pre?.room || { name: hotel.roomName, board: hotel.board, refundable: hotel.freeCancellation, cancelBy: hotel.cancelBy };
  const field = (label, k, type = "text", auto) => (
    <label className="flex flex-col gap-1">
      <span className="text-[calc(11.5px*var(--fs))] font-semibold" style={{ color: INK2 }}>{label}</span>
      <input value={holder[k]} onChange={set(k)} type={type} autoComplete={auto} autoCapitalize={type === "email" ? "none" : "words"}
        className="rounded-[12px] px-3 py-2.5 text-[calc(14px*var(--fs))]" style={{ border: `1.5px solid ${RULE}`, color: INK, background: "#fff", fontFamily: "inherit" }} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={stage === "paying" ? undefined : onClose}>
      <div className="w-full max-w-[560px] rounded-t-[22px] px-4 pt-3 pb-6 max-h-[92vh] overflow-y-auto" style={{ background: "#FBF8F1", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-[calc(17px*var(--fs))] leading-snug" style={{ color: INK }}>{hotel.name}</div>
            <div className="text-[calc(12.5px*var(--fs))] mt-0.5" style={{ color: INK2 }}>{fmtDate(checkin)} → {fmtDate(checkout)} · {nights} night{nights === 1 ? "" : "s"} · {adults} adult{adults === 1 ? "" : "s"}{children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""}</div>
          </div>
          {stage !== "paying" && <button onClick={onClose} aria-label="Close" className="flex-none rounded-full p-1.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}><X size={18} color={INK} /></button>}
        </div>

        {/* Rate summary — what is being bought, in plain words */}
        <div className="rounded-[16px] p-3.5 mt-3" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
          {room?.name && <div className="text-[calc(13.5px*var(--fs))] font-semibold" style={{ color: INK }}>{room.name}{room.board ? <span style={{ color: INK2, fontWeight: 500 }}> · {room.board}</span> : null}</div>}
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

        {(stage === "form" || stage === "prebooking") && (
          <>
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
            <button onClick={prebook} disabled={!valid || stage === "prebooking"}
              className="w-full py-3.5 rounded-[14px] font-bold text-white text-[calc(15px*var(--fs))] mt-4"
              style={{ background: ACCENT, opacity: (!valid || stage === "prebooking") ? 0.6 : 1, fontFamily: "inherit" }}>
              {stage === "prebooking" ? "Confirming availability…" : "Continue to secure payment"}
            </button>
            <p className="text-[calc(10.5px*var(--fs))] leading-snug mt-3 px-0.5" style={{ color: "#9AA0A6" }}>
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
            {stage === "paying" && <button onClick={checkStatus} className="w-full py-2.5 mt-2 text-[calc(13px*var(--fs))] font-semibold" style={{ color: ACCENT, background: "none", border: "none", fontFamily: "inherit" }}>I've paid — check my booking</button>}
            <p className="text-[calc(10.5px*var(--fs))] leading-snug mt-3 px-0.5" style={{ color: "#9AA0A6" }}>The payment page opens in a secure sheet. When you're done, tap Done to come back — we'll confirm the booking here.</p>
          </>
        )}

        {stage === "pending" && (
          <>
            <div className="text-[calc(13.5px*var(--fs))] font-bold mt-4" style={{ color: INK }}>Payment not completed yet</div>
            <div className="text-[calc(12.5px*var(--fs))] mt-1" style={{ color: INK2 }}>No booking was made and nothing was charged. You can reopen the payment page or check again.</div>
            <div className="flex gap-2 mt-3">
              <button onClick={pay} className="flex-1 py-3 rounded-[14px] font-bold text-white text-[calc(14px*var(--fs))]" style={{ background: ACCENT, fontFamily: "inherit" }}>Reopen payment</button>
              <button onClick={checkStatus} className="flex-1 py-3 rounded-[14px] font-bold text-[calc(14px*var(--fs))]" style={{ background: "#fff", color: INK, border: `1.5px solid ${RULE}`, fontFamily: "inherit" }}>Check again</button>
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
            <div className="text-[calc(17px*var(--fs))] font-extrabold mt-4" style={{ color: OK }}>✅ You're booked</div>
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
