// Get A Ride — the bookable transport surface (car rental + airport transfer +
// same-day ride). Lives OUTSIDE the transit-directions page: this is the "book &
// save" money surface, reached from a Home tile.
//
// Affiliate wiring: every bookable tap goes through trackAffiliateClick (SubID →
// D1) and opens the partner URL. Only options with a live `link` are actionable;
// an option with `link:null` + `soon:true` renders a disabled "Soon" card that
// activates the moment we set its link (no other change needed).
//
// Shell converged to the Passport Standard (shared FinderHeader look). The
// shared FinderHeader component unconditionally renders a location card with a
// "Change" chip; this page is an affiliate menu with no LocationModePicker, so
// mounting it would ship a dead location card. Instead the header row below
// hand-mirrors FinderHeader's anatomy (chevron back · CAT pill · 40px spacer).
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, CarFront, CarTaxiFront, Navigation, Smartphone,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import { CAT, IVORY, IVORY_2, SHADOW_CARD_SOFT, TEAL_DEEP } from "../components/redesign/constants";
import { trackAffiliateClick } from "@/lib/affiliate";
import { logDiscover } from "@/lib/logDiscover";
import { getRideProviders, ccFromLocation, openRide } from "@/lib/rideProviders";

const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_INK = "#16110D";
const fs = (n) => `calc(${n}px*var(--fs))`;

// RENTAL CARS — its own section card (upgraded in place from a plain options
// row, so there's exactly one rental surface). The link is the CONFIRMED
// PostAffiliatePro homepage form — a_aid=beach3303 must survive to the landing
// page, so never rebuild or strip params. City deep links
// (/{country}/{city}?a_aid=…) are plausible but UNVERIFIED for click credit;
// don't prefill a destination until the affiliate panel confirms the grammar.
const RENTAL = {
  key: "car", // trackAffiliateClick category
  partner: "discovercars",
  partnerName: "Discover Cars",
  link: "https://www.discovercars.com/?a_aid=beach3303", // LIVE
};

// Bookable options. See the `soon` note in the header comment. (Rental cars
// moved to the RENTAL section card above.)
const OPTIONS = [
  {
    key: "transfer",
    icon: CarTaxiFront,
    title: "Airport transfer",
    sub: "Private meet & greet · fixed price · flight tracking",
    partner: "welcomepickups",
    partnerName: "Welcome Pickups",
    accent: CAT.atm,
    link: "https://tpx.lt/BtYj7zv4", // LIVE — Travelpayouts tracked link (marker 554304)
  },
];

export default function GetARide() {
  const navigate = useNavigate();
  const { activeLocation } = useLocation();
  const rideProviders = getRideProviders(ccFromLocation(activeLocation));

  // Options that hand off to a booking partner get a gentle heads-up first (honest
  // "you're leaving the app" moment). Uber is the user's own app → open directly.
  const [confirm, setConfirm] = useState(null);

  const startOpen = (opt) => {
    if (!opt.link || opt.soon) return;
    // Demand signal: rental car vs airport transfer, by city (present vs planning).
    logDiscover("ride_option_tap", { type: opt.key, partner: opt.partner });
    if (opt.utility) {
      window.open(opt.link, "_blank");
      return;
    }
    setConfirm(opt);
  };

  // Rental section CTA — same confirm-sheet → trackAffiliateClick → open-returned-url
  // path as every other partner option; only the tap-event `type` differs.
  const startRental = () => {
    logDiscover("ride_option_tap", { type: "rental", partner: RENTAL.partner });
    setConfirm(RENTAL);
  };

  const proceed = async () => {
    const opt = confirm;
    setConfirm(null);
    if (!opt) return;
    const url = await trackAffiliateClick({
      partner: opt.partner,
      targetUrl: opt.link,
      category: opt.key,
      destCity: activeLocation?.city || activeLocation?.name,
      destCountry: activeLocation?.country,
    });
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* HEADER — chevron back · transit pill · spacer (FinderHeader anatomy, hand-rolled: see file comment) */}
      <div className="px-4 pt-2 pb-3">
        <div className="mx-auto flex items-center justify-between" style={{ maxWidth: 640 }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EFE8D6]"
            style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}
          >
            <ChevronLeft size={18} color="#0F1419" strokeWidth={2.2} />
          </button>
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]"
            style={{ background: CAT.transit.bg, color: CAT.transit.ink }}
          >
            <CarFront size={13} color={CAT.transit.ink} strokeWidth={2} />
            Get a Ride
          </div>
          <div className="w-10 h-10" />
        </div>
        {/* mono kicker — what this surface books */}
        <div
          className="mt-2 text-center font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold"
          style={{ color: "#94A3B8" }}
        >
          Cars · Airport transfers · Rides
        </div>
      </div>

      {/* Options — ivory card · serif name · mono sub · honest partner label · chevron */}
      <div className="px-4 pt-1 space-y-3 pb-8" style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* RENTAL CARS — Passport Standard section card: mono kicker · serif ·
            honest coverage line (Full Coverage is Discover Cars' checkout upsell,
            never "insurance included") · mono source line (we quote no prices we
            can't source) · one quiet teal CTA. */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-4 rounded-[18px]"
          style={{ background: "#FFFFFF", border: "1px solid #F0E9DC", boxShadow: SHADOW_CARD_SOFT }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-none"
              style={{ background: CAT.transit.bg }}
            >
              <CarFront size={22} color={CAT.transit.ink} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold"
                style={{ color: "#94A3B8" }}
              >
                Rental cars
              </div>
              <div className="mt-0.5" style={{ fontFamily: ED_SERIF, fontSize: fs(19), lineHeight: 1.15, color: ED_INK }}>
                Compare rentals with insurance options
              </div>
            </div>
          </div>
          <div className="font-mono text-[calc(11px*var(--fs))] leading-snug mt-3" style={{ color: "#6B7280" }}>
            Free cancellation on most bookings · Full Coverage available at checkout
          </div>
          <div
            className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.12em] uppercase font-semibold mt-1"
            style={{ color: "#94A3B8" }}
          >
            DiscoverCars — prices on their site
          </div>
          <button
            onClick={startRental}
            className="w-full mt-3.5 py-3 rounded-[14px] font-semibold text-white text-[calc(14px*var(--fs))] transition-transform active:scale-[0.99]"
            style={{ background: TEAL_DEEP }}
          >
            Browse rental cars
          </button>
        </motion.div>

        {OPTIONS.map((opt, i) => {
          const disabled = opt.soon || !opt.link;
          const OptIcon = opt.icon;
          return (
            <motion.button
              key={opt.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i + 1, 6) * 0.04 }}
              onClick={() => startOpen(opt)}
              disabled={disabled}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-[18px] text-left transition-transform active:scale-[0.99]"
              style={{
                background: "#FFFFFF",
                border: "1px solid #F0E9DC",
                boxShadow: SHADOW_CARD_SOFT,
                opacity: disabled ? 0.6 : 1,
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-none"
                style={{ background: opt.accent?.bg || IVORY_2 }}
              >
                <OptIcon size={22} color={opt.accent?.ink || ED_INK} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: ED_SERIF, fontSize: fs(19), lineHeight: 1.1, color: ED_INK }}>
                    {opt.title}
                  </span>
                  {opt.soon && (
                    <span
                      className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.12em] uppercase font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: IVORY_2, color: "#8A7A63" }}
                    >
                      Soon
                    </span>
                  )}
                </div>
                <div className="font-mono text-[calc(11px*var(--fs))] leading-snug mt-1" style={{ color: "#6B7280" }}>
                  {opt.sub}
                </div>
                <div
                  className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.12em] uppercase font-semibold mt-1"
                  style={{ color: "#94A3B8" }}
                >
                  via {opt.partnerName}
                </div>
              </div>
              {!disabled && (
                <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} className="flex-none" />
              )}
            </motion.button>
          );
        })}

        {/* Same-day ride — region-aware rider apps (deep-links, utility) */}
        <div className="pt-2">
          <div className="flex items-center gap-4 px-1 mb-2.5">
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-none"
              style={{ background: CAT.transit.bg }}
            >
              <Navigation size={22} color={CAT.transit.ink} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontFamily: ED_SERIF, fontSize: fs(19), lineHeight: 1.1, color: ED_INK }}>
                Same-day ride
              </div>
              <div className="font-mono text-[calc(11px*var(--fs))] leading-snug mt-1" style={{ color: "#6B7280" }}>
                Rider apps available where you are
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {rideProviders.map((p) => (
              <button
                key={p.key}
                onClick={() => { logDiscover("ride_option_tap", { type: "rideshare", partner: p.key }); openRide(p); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] font-semibold text-[calc(14px*var(--fs))]"
                style={{ background: "#FFFFFF", border: "1px solid #F0E9DC", color: ED_INK }}
              >
                <Smartphone size={14} color={CAT.transit.ink} strokeWidth={2} className="flex-none" />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Honest-UX affiliate disclosure (FTC) */}
        <p className="text-[calc(10.5px*var(--fs))] text-[#9AA0A6] leading-snug pt-2 px-1">
          Bookings open on our partners' own sites. We may earn a commission on some bookings — it never
          changes the price you pay.
        </p>
      </div>

      {/* Gentle "you're leaving to a partner" heads-up */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-[22px] sm:rounded-[22px] p-5 sm:m-4"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 -8px 40px -12px rgba(0,0,0,0.25)" }}
          >
            <div className="text-[calc(15px*var(--fs))] leading-snug" style={{ color: ED_INK }}>
              Heads up — we'll pop you over to our partner{" "}
              <span className="font-bold">{confirm.partnerName}</span> for live results. Your price won't change.
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-3 rounded-[14px] font-semibold text-[calc(14px*var(--fs))]"
                style={{ background: IVORY_2, color: ED_INK }}
              >
                Not now
              </button>
              <button
                onClick={proceed}
                className="flex-1 py-3 rounded-[14px] font-bold text-white text-[calc(14px*var(--fs))]"
                style={{ background: CAT.transit.ink }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
