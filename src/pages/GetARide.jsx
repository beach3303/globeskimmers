// Get A Ride — the bookable transport surface (car rental + airport transfer +
// same-day ride). Lives OUTSIDE the transit-directions page: this is the "book &
// save" money surface, reached from a Home tile.
//
// Affiliate wiring: every bookable tap goes through trackAffiliateClick (SubID →
// D1) and opens the partner URL. Only options with a live `link` are actionable;
// airport transfer shows a "Soon" state until Travelpayouts approves, then it
// slots in with zero rework (just set its `link`). Same-day ride (Uber) is a
// utility deep-link — no commission, opens the app.
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import { CAT } from "../components/redesign/constants";
import { trackAffiliateClick } from "@/lib/affiliate";

const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_INK = "#16110D";
const fs = (n) => `calc(${n}px*var(--fs))`;

// Bookable options. `link:null` + `soon:true` renders a disabled "Soon" card that
// activates the moment we set its link (no other change needed).
const OPTIONS = [
  {
    key: "car",
    emoji: "🚗",
    title: "Rent a car",
    sub: "Compare deals worldwide · free cancellation, no card fees",
    cta: "Find cars",
    partner: "discovercars",
    accent: CAT.transit,
    link: "https://www.discovercars.com/?a_aid=beach3303", // LIVE
  },
  {
    key: "transfer",
    emoji: "🚕",
    title: "Airport transfer",
    sub: "Private meet & greet · fixed price · flight tracking",
    cta: "Book transfer",
    partner: "kiwitaxi",
    accent: CAT.atm,
    link: null, // slots in when Travelpayouts approves (Welcome Pickups / Kiwitaxi)
    soon: true,
  },
  {
    key: "ride",
    emoji: "🚦",
    title: "Same-day ride",
    sub: "Open Uber and book a ride right now",
    cta: "Open Uber",
    partner: "uber",
    accent: CAT.coffee,
    link: "https://m.uber.com/ul/?action=setPickup&pickup=my_location", // utility deep-link
    utility: true, // no commission — opens the app
  },
];

export default function GetARide() {
  const navigate = useNavigate();
  const { activeLocation } = useLocation();

  const open = async (opt) => {
    if (!opt.link || opt.soon) return;
    if (opt.utility) {
      window.open(opt.link, "_blank");
      return;
    }
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
    <div className="min-h-screen" style={{ background: "#FFFCF7" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "#F1EADF" }}
        >
          <ArrowLeft size={18} color={ED_INK} strokeWidth={2.2} />
        </button>
        <div>
          <h1 style={{ fontFamily: ED_SERIF, fontSize: fs(26), color: ED_INK, lineHeight: 1.05 }}>
            Get a ride
          </h1>
          <div className="text-[calc(12.5px*var(--fs))] text-[#6B7280]">Cars · airport transfers · rides</div>
        </div>
      </div>

      {/* Options */}
      <div className="px-4 pt-2 space-y-3 pb-8" style={{ maxWidth: 640, margin: "0 auto" }}>
        {OPTIONS.map((opt, i) => {
          const disabled = opt.soon || !opt.link;
          return (
            <motion.button
              key={opt.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 6) * 0.04 }}
              onClick={() => open(opt)}
              disabled={disabled}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-[18px] text-left transition-transform active:scale-[0.99]"
              style={{
                background: "#FFFFFF",
                border: "1px solid #F0E9DC",
                opacity: disabled ? 0.6 : 1,
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-none"
                style={{ background: opt.accent?.bg || "#F1EADF", fontSize: fs(24) }}
              >
                {opt.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[calc(16px*var(--fs))]" style={{ color: ED_INK }}>
                    {opt.title}
                  </span>
                  {opt.soon && (
                    <span
                      className="text-[calc(10px*var(--fs))] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: "#F1EADF", color: "#8A7A63" }}
                    >
                      Soon
                    </span>
                  )}
                </div>
                <div className="text-[calc(12.5px*var(--fs))] text-[#6B7280] mt-0.5">{opt.sub}</div>
              </div>
              {!disabled && (
                <div
                  className="px-3.5 py-2 rounded-[12px] font-bold text-[calc(12.5px*var(--fs))] flex-none flex items-center gap-1 text-white"
                  style={{ background: opt.accent?.ink || "#0F1419" }}
                >
                  {opt.cta}
                  <ExternalLink size={12} color="#fff" strokeWidth={2.4} />
                </div>
              )}
            </motion.button>
          );
        })}

        {/* Honest-UX affiliate disclosure (FTC) */}
        <p className="text-[calc(10.5px*var(--fs))] text-[#9AA0A6] leading-snug pt-2 px-1">
          Bookings open on our partners' own sites. We may earn a commission on some bookings — it never
          changes the price you pay.
        </p>
      </div>
    </div>
  );
}
