// Wishlist — places & experiences the traveler is dreaming of. Reads the on-device
// wishlist (src/lib/wishlist.js), groups by kind, and turns each saved item into a
// bookable action (Find tours / Find hotels / Get tickets) so intent becomes a
// booking. Every CTA is an attributed affiliate click; removes are one tap on the ❤️.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Heart, Trash2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { getWishlist, removeFromWishlist, CHANGE_EVENT } from "@/lib/wishlist";
import { trackAffiliateClick } from "@/lib/affiliate";
import { viatorSearchLink } from "@/lib/viator";
import { logDiscover } from "@/lib/logDiscover";
import { useIsTablet } from "@/lib/useIsTablet";

const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK3 = "#736657";
const ED_RULE = "rgba(22,17,13,.10)";
const IVORY = "#FFFCF7";
const TEAL_DEEP = "#0E7C73";

const KINDS = {
  city: { emoji: "🌆", label: "Destinations" },
  attraction: { emoji: "📍", label: "Places to visit" },
  tour: { emoji: "🎟️", label: "Tours & experiences" },
  event: { emoji: "🎫", label: "Events & tickets" },
  food: { emoji: "🍜", label: "Food to try" },
  hotel: { emoji: "🏨", label: "Stays" },
  other: { emoji: "📌", label: "Other" },
};
const KIND_ORDER = ["city", "attraction", "tour", "event", "food", "hotel", "other"];

async function openExternal(url) {
  if (!url) return;
  try {
    if (Capacitor.isNativePlatform()) await Browser.open({ url });
    else window.open(url, "_blank", "noopener");
  } catch { try { window.open(url, "_blank"); } catch { /* ignore */ } }
}

export default function WishlistPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const fs = (n) => `calc(${n}px*var(--fs))`;
  const t = (tab, phone) => (isTablet ? tab : phone);
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";

  // Lazy init from the store so the page never flashes the empty-state before
  // the effect runs for users who already have a wishlist.
  const [items, setItems] = useState(() => getWishlist());
  useEffect(() => {
    const sync = () => setItems(getWishlist());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  const grouped = KIND_ORDER
    .map((key) => ({ key, meta: KINDS[key], rows: items.filter((it) => (KINDS[it.kind] ? it.kind : "other") === key) }))
    .filter((g) => g.rows.length > 0);

  // kind -> primary booking action.
  const act = async (it) => {
    const k = it.kind;
    if (k === "hotel" || k === "city") {
      logDiscover("wishlist_cta", { kind: k, title: it.title, action: "hotels", city: it.city, country: it.country });
      // FindAHotel expects an OBJECT for presetCity; a bare string must go via
      // presetQuery (see WhereToStay.jsx) or the destination is silently dropped.
      navigate(createPageUrl("FindAHotel"), { state: { presetQuery: it.city || it.title } });
      return;
    }
    // attraction / tour / food / event -> find bookable experiences (Viator).
    logDiscover("wishlist_cta", { kind: k, title: it.title, action: k === "event" ? "tickets" : "tours", city: it.city, country: it.country });
    let url = it.url;
    try {
      const term = [it.title, it.city].filter(Boolean).join(" ");
      url = await trackAffiliateClick({
        partner: "viator",
        targetUrl: it.url || viatorSearchLink(term),
        category: k === "event" ? "event" : "tour",
        productName: it.title,
        destCity: it.city,
        destCountry: it.country,
      });
    } catch { /* fall back to raw url below */ }
    openExternal(url || it.url);
  };

  const ctaLabel = (kind) => (kind === "hotel" || kind === "city" ? "Find hotels" : kind === "event" ? "Get tickets" : "Find tours");

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
            style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}
            aria-label="Back"
          >
            <ChevronLeft size={18} color={ED_INK} strokeWidth={2.2} />
          </button>
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full uppercase font-medium"
            style={{ background: "#FFE4E0", color: "#C2392F", fontFamily: ED_MONO, fontSize: t(fs(11), fs(10.5)), letterSpacing: ".08em" }}
          >
            <Heart size={13} color="#C2392F" strokeWidth={2} className="fill-current" /> Wishlist
          </div>
          <div className="w-10 h-10" aria-hidden="true" />
        </div>
      </div>

      {/* TITLE */}
      <div className={`px-4 ${colWrap} mx-auto pb-2 text-center`}>
        <h1 className="italic leading-none" style={{ fontFamily: ED_SERIF, fontSize: t(fs(38), fs(28)), color: TEAL_DEEP }}>
          Wishlist
        </h1>
        <p className="uppercase mt-2 font-semibold" style={{ fontFamily: ED_MONO, fontSize: t(fs(10.5), fs(10)), letterSpacing: "0.16em", color: ED_INK3 }}>
          Places & experiences you're dreaming of
        </p>
      </div>

      <div className={`${colWrap} mx-auto px-4 pb-16 pt-4`}>
        {items.length === 0 ? (
          <div className="text-center py-14 px-4">
            <div className="text-[40px] mb-3">💫</div>
            <h2 className="italic" style={{ fontFamily: ED_SERIF, fontSize: t(fs(26), fs(22)), color: ED_INK }}>Start your wishlist</h2>
            <p className="mt-2 mx-auto" style={{ color: ED_INK3, fontSize: t(fs(14), fs(13.5)), maxWidth: 340, lineHeight: 1.55 }}>
              Tap the ❤️ on any place, tour, or event to save it here — then book it when you're ready.
            </p>
            <button
              onClick={() => navigate(createPageUrl("ThingsToDo"))}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold uppercase transition-transform active:scale-95"
              style={{ background: TEAL_DEEP, color: "#FFFFFF", fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".07em" }}
            >
              Explore things to do
            </button>
          </div>
        ) : (
          <>
          {grouped.map((g) => (
            <section key={g.key} className="mb-7">
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <span className="text-[17px] leading-none">{g.meta.emoji}</span>
                <h2 className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: t(fs(21), fs(18)), color: ED_INK }}>{g.meta.label}</h2>
                <span className="ml-auto font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(11), color: ED_INK3 }}>{g.rows.length}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {g.rows.map((it) => (
                  <div
                    key={it.key}
                    className="p-3 rounded-[16px] flex items-center gap-3"
                    style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: "0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)" }}
                  >
                    <div className="w-14 h-14 rounded-xl flex-none overflow-hidden flex items-center justify-center" style={{ background: "#F2ECE0" }}>
                      {it.image ? <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="text-[22px]">{g.meta.emoji}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-medium"
                        style={{ fontFamily: ED_SERIF, fontSize: t(fs(17), fs(15.5)), color: ED_INK, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      >
                        {it.title || KINDS[g.key].label}
                      </div>
                      {(it.city || it.country) && (
                        <div className="mt-0.5" style={{ color: ED_INK3, fontSize: t(fs(12.5), fs(12)) }}>
                          {[it.city, it.country].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-none">
                      <button
                        onClick={() => act(it)}
                        className="px-3 py-1.5 rounded-full font-semibold uppercase transition-transform active:scale-95"
                        style={{ background: TEAL_DEEP, color: "#FFFFFF", fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".05em", whiteSpace: "nowrap" }}
                      >
                        {ctaLabel(it.kind)}
                      </button>
                      <button
                        onClick={() => removeFromWishlist(it.key)}
                        aria-label="Remove from wishlist"
                        className="inline-flex items-center gap-1 px-1.5 py-1"
                        style={{ color: ED_INK3, fontSize: fs(10) }}
                      >
                        <Trash2 size={13} strokeWidth={2} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p className="text-center mt-2 px-6" style={{ color: ED_INK3, fontSize: fs(11), lineHeight: 1.5 }}>
            Some booking links may earn Globeskimmers a small commission — never at extra cost to you.
          </p>
          </>
        )}
      </div>
    </div>
  );
}
