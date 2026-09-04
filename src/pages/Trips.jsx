// Trips — the traveler's whole journey on one surface, in three tabs:
//
//   DREAMING — the on-device wishlist (the SAME store WishlistCard / Wishlist
//              read: src/lib/wishlist.js). Each card keeps its existing target:
//              stays & destinations → FindAHotel (presetQuery), everything else
//              → an attributed Viator link (trackAffiliateClick → openPartner).
//   BOOKED   — the SAME /aff/mine read MyTrip uses, CONFIRMED rows only (a tap
//              on a partner link is not a booking), same honest status
//              vocabulary; a row opens the same BookingDetailSheet.
//   SAVED    — the saved locations the old Saved nav pill opened (the same
//              on-device read via LocationContext); add / rename / delete stay
//              on /SavedLocations.
//
// Default tab: BOOKED when the first load finds ≥1 confirmed booking, else
// DREAMING. /MyTrip, /Wishlist and /SavedLocations stay routed — deep links
// live on; this page only reuses their data reads.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { useIsTablet } from "@/lib/useIsTablet";
import { useLocation } from "@/components/location/LocationContext";
import { getWishlist, CHANGE_EVENT } from "@/lib/wishlist";
import { SAVED_CHANGE_EVENT } from "@/lib/savedLocations";
import { trackAffiliateClick } from "@/lib/affiliate";
import { viatorSearchLink } from "@/lib/viator";
import { logDiscover } from "@/lib/logDiscover";
import { openPartner } from "@/lib/openPartner";
import TypographicStamp from "@/components/passport/TypographicStamp";
import BookingDetailSheet, { StatusChip, partnerLabel, fmtDate } from "@/components/trips/BookingDetailSheet";
import { IVORY, IVORY_2, TEAL_DEEP, SHADOW_CARD_SOFT } from "@/components/redesign/constants";

// Editorial design tokens (shared with MyTrip / Wishlist / SavedLocations).
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK3 = "#736657";
const ED_RULE = "rgba(22,17,13,.10)";

const TABS = [
  { id: "dreaming", label: "Dreaming" },
  { id: "booked", label: "Booked" },
  { id: "saved", label: "Saved" },
];

// Only known transport reasons reach the screen; a worker 500 can carry an
// internal D1/SQL message that is not for travelers. (Same rule as MyTrip.)
const friendlyError = (e) => {
  const s = String(e || "");
  if (s === "timeout") return "The server took too long to respond.";
  if (/^HTTP \d+$/.test(s) || /^Network error$|Failed to fetch|No response/i.test(s)) return "Couldn't reach the server.";
  return "Something went wrong on our side.";
};

const fmtSavedDate = (ms) => {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
};

export default function TripsPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const fs = (n) => `calc(${n}px*var(--fs))`;
  const t = (tab, phone) => (isTablet ? tab : phone);
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  const { getSavedLocations, switchToNavigateMode } = useLocation();

  const [tab, setTab] = useState("dreaming");
  // Once the traveler picks a tab themselves, the default-tab logic backs off.
  const picked = useRef(false);

  // DREAMING — on-device wishlist, kept live via the store's change event.
  const [wish, setWish] = useState(() => getWishlist());
  useEffect(() => {
    const sync = () => setWish(getWishlist());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  // BOOKED — same read + confirmed-only filter as MyTrip (founder call
  // 2026-08-31: a tap is not a booking; only partner-confirmed rows show).
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState(null); // booking open in the sheet

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // callWorker never throws — a timeout, offline fetch or worker 4xx/5xx
      // resolves as { data: null, error }; read `error` so a failure never
      // renders as the definitive "No bookings yet".
      const { data, error: err } = await callWorker(ROUTE.affiliateMine, {});
      if (cancelled) return;
      if (err || !data) {
        setError(err || "No response");
        setItems([]); setNeedsAuth(false);
      } else {
        setNeedsAuth(!!data.needsAuth);
        setItems(Array.isArray(data.items) ? data.items : []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  const bookings = items
    .filter((it) => (it.status || "").toLowerCase() === "confirmed")
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // Default tab: BOOKED when ≥1 confirmed booking, else DREAMING — decided when
  // the first load lands, and never after the traveler taps a tab themselves.
  useEffect(() => {
    if (!loading && !picked.current && bookings.length > 0) setTab("booked");
  }, [loading]); // bookings derives from the same load — loading is the real trigger

  // SAVED — same on-device read the SavedLocations page uses.
  const [saved, setSaved] = useState([]);
  useEffect(() => {
    const sync = () => setSaved(getSavedLocations());
    sync();
    window.addEventListener(SAVED_CHANGE_EVENT, sync);
    return () => window.removeEventListener(SAVED_CHANGE_EVENT, sync);
  }, []); // getSavedLocations is a stable context read

  // Wishlist item → its existing target (same routing as the Wishlist page).
  const act = async (it) => {
    const k = it.kind;
    if (k === "hotel" || k === "city") {
      logDiscover("wishlist_cta", { kind: k, title: it.title, action: "hotels", city: it.city, country: it.country });
      // FindAHotel expects an OBJECT for presetCity; a bare string must go via
      // presetQuery (see Wishlist.jsx) or the destination is silently dropped.
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
    openPartner(url || it.url);
  };

  const goNavigate = async (loc) => {
    await switchToNavigateMode(loc);
    navigate(createPageUrl("Home"));
  };

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-1">
        <div className={`${colWrap} mx-auto flex items-center`}>
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
            style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}
            aria-label="Back"
          >
            <ChevronLeft size={18} color={ED_INK} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* TITLE — mono kicker over serif headline */}
      <div className={`px-4 ${colWrap} mx-auto pb-1 text-center`}>
        <p className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: t(fs(10.5), fs(10)), letterSpacing: "0.16em", color: ED_INK3 }}>
          Trips
        </p>
        <h1 className="italic leading-none mt-1.5" style={{ fontFamily: ED_SERIF, fontSize: t(fs(38), fs(28)), color: TEAL_DEEP }}>
          Your travels
        </h1>
      </div>

      {/* TABS */}
      <div className={`px-4 ${colWrap} mx-auto pt-3`}>
        <div className="flex gap-2 justify-center">
          {TABS.map((tb) => {
            const on = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => { picked.current = true; setTab(tb.id); }}
                aria-pressed={on}
                className="px-4 py-2 rounded-full font-semibold uppercase transition-colors"
                style={{
                  fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".08em",
                  background: on ? ED_INK : "#FFFFFF",
                  color: on ? IVORY : ED_INK3,
                  border: `1px solid ${on ? ED_INK : ED_RULE}`,
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${colWrap} mx-auto px-4 pb-28 pt-5`}>
        {/* ── DREAMING ── */}
        {tab === "dreaming" && (
          wish.length === 0 ? (
            <EmptyCard
              fs={fs} t={t}
              title="Nothing saved yet"
              body="Tap the heart on any place, tour, or event to start dreaming — everything you save lands here, ready to book."
              cta="Explore things to do"
              onCta={() => navigate(createPageUrl("ThingsToDo"))}
            />
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {wish.map((it) => (
                  <DreamRow key={it.key} it={it} fs={fs} t={t} onOpen={() => act(it)} />
                ))}
              </div>
              <p className="text-center mt-4 px-6" style={{ color: ED_INK3, fontSize: fs(11), lineHeight: 1.5 }}>
                Some booking links may earn Globeskimmers a small commission — never at extra cost to you.
              </p>
            </>
          )
        )}

        {/* ── BOOKED ── */}
        {tab === "booked" && (
          loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: TEAL_DEEP }} />
            </div>
          ) : error ? (
            <EmptyCard
              fs={fs} t={t}
              title="Couldn't load your bookings"
              body="We couldn't reach your bookings just now. Check your connection and try again."
              detail={friendlyError(error)}
              cta="Retry"
              onCta={() => setAttempt((n) => n + 1)}
            />
          ) : needsAuth ? (
            <EmptyCard
              fs={fs} t={t}
              title="Sign in to see your bookings"
              body="Your tours, stays, and tickets are saved to your account so you can pick up where you left off on any device."
              cta="Sign in"
              onCta={() => navigate(createPageUrl("Settings"))}
            />
          ) : bookings.length === 0 ? (
            <EmptyCard
              fs={fs} t={t}
              title="No bookings yet"
              body="Stays, tours, and tickets you book through a Globeskimmers partner appear here once the partner confirms them — usually a day or two after you pay."
              cta="Explore things to do"
              onCta={() => navigate(createPageUrl("ThingsToDo"))}
            />
          ) : (
            <>
              {/* Honest note — same vocabulary as MyTrip: confirmed by partner. */}
              <p className="mb-4 px-1" style={{ color: ED_INK3, fontSize: t(fs(12.5), fs(12)), lineHeight: 1.5 }}>
                Everything here is confirmed by the partner you booked with. New bookings usually appear a day or two after you pay.
              </p>
              <div className="flex flex-col gap-2.5">
                {bookings.map((it) => (
                  <button
                    key={it.key}
                    onClick={() => setDetail(it)}
                    className="w-full text-left p-3.5 rounded-[16px] transition-colors hover:bg-black/[0.02]"
                    style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: SHADOW_CARD_SOFT }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusChip status={it.status} fs={fs} />
                      <span className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: ED_INK3 }}>
                        {partnerLabel(it.partner)}
                      </span>
                    </div>
                    <div
                      className="font-medium mt-1.5"
                      style={{ fontFamily: ED_SERIF, fontSize: t(fs(17), fs(15.5)), color: ED_INK, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {it.product_name || partnerLabel(it.partner)}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5" style={{ color: ED_INK3, fontSize: t(fs(12), fs(11.5)) }}>
                      {it.dest_city && <span>{it.dest_city}{it.dest_country ? `, ${it.dest_country}` : ""}</span>}
                      {it.dest_city && <span aria-hidden="true">·</span>}
                      <span>{fmtDate(it.ts)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )
        )}

        {/* ── SAVED ── */}
        {tab === "saved" && (
          saved.length === 0 ? (
            <EmptyCard
              fs={fs} t={t}
              title="No saved locations yet"
              body="Save the places you come back to — your hotel, a station, a favorite corner — and jump straight to them anytime."
              cta="Add a location"
              onCta={() => navigate(createPageUrl("SavedLocations"))}
            />
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {saved.map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => goNavigate(loc)}
                    className="w-full text-left p-3.5 rounded-[16px] flex items-center gap-3 transition-colors hover:bg-black/[0.02]"
                    style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: SHADOW_CARD_SOFT }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-none" style={{ background: IVORY_2 }}>
                      <MapPin size={16} color={ED_INK3} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-medium"
                        style={{ fontFamily: ED_SERIF, fontSize: t(fs(17), fs(15.5)), color: ED_INK, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      >
                        {loc.nickname || loc.placeName}
                      </div>
                      {loc.address?.formatted && (
                        <div className="mt-0.5 truncate" style={{ fontFamily: ED_MONO, fontSize: t(fs(11), fs(11.5)), color: ED_INK3 }}>
                          {loc.address.formatted}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} color={ED_INK3} strokeWidth={2} className="flex-none" />
                  </button>
                ))}
              </div>
              {/* Quiet management link — add / rename / delete live on the page. */}
              <button
                onClick={() => navigate(createPageUrl("SavedLocations"))}
                className="mt-4 mx-auto flex items-center gap-1.5 px-3 py-2 uppercase font-semibold"
                style={{ fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".08em", color: ED_INK3 }}
              >
                Manage saved locations <ChevronRight size={13} strokeWidth={2.2} />
              </button>
            </>
          )
        )}
      </div>

      <BookingDetailSheet
        booking={detail}
        onClose={() => setDetail(null)}
        fs={fs}
        t={t}
      />
    </div>
  );
}

// One wishlist card: photo when it has one, its typographic passport stamp when
// it doesn't (photoless never renders a colored placeholder). Tap = the item's
// existing booking target.
function DreamRow({ it, fs, t, onOpen }) {
  const [imgFail, setImgFail] = useState(false);
  const hasPhoto = !!it.image && !imgFail;
  const savedOn = fmtSavedDate(it.ts);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left p-3 rounded-[16px] flex items-center gap-3 transition-colors hover:bg-black/[0.02]"
      style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: SHADOW_CARD_SOFT }}
    >
      <div className="w-14 h-14 rounded-xl flex-none overflow-hidden flex items-center justify-center" style={hasPhoto ? { background: IVORY_2 } : undefined}>
        {hasPhoto ? (
          <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setImgFail(true)} />
        ) : (
          <TypographicStamp name={it.title} city={it.city} country={it.country} entityId={it.id || it.title} width={50} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-medium"
          style={{ fontFamily: ED_SERIF, fontSize: t(fs(17), fs(15.5)), color: ED_INK, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {it.title}
        </div>
        {(it.city || it.country) && (
          <div className="mt-0.5 truncate" style={{ color: ED_INK3, fontSize: t(fs(12.5), fs(12)) }}>
            {[it.city, it.country].filter(Boolean).join(", ")}
          </div>
        )}
        {savedOn && (
          <div className="mt-1 uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".07em", color: ED_INK3 }}>
            Saved {savedOn}
          </div>
        )}
      </div>
      <ChevronRight size={16} color={ED_INK3} strokeWidth={2} className="flex-none" />
    </button>
  );
}

// The one designed empty/error card per tab — serif title, quiet body, at most
// ONE brand-teal action (the surface's single primary action).
function EmptyCard({ title, body, detail, cta, onCta, fs, t }) {
  return (
    <div
      className="text-center rounded-[20px] px-6 py-12"
      style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: SHADOW_CARD_SOFT }}
    >
      <h2 className="italic" style={{ fontFamily: ED_SERIF, fontSize: t(fs(26), fs(22)), color: ED_INK }}>{title}</h2>
      <p className="mt-2 mx-auto" style={{ color: ED_INK3, fontSize: t(fs(14), fs(13.5)), maxWidth: 340, lineHeight: 1.55 }}>{body}</p>
      {detail && (
        <p className="mt-2 uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".06em", color: ED_INK3 }}>{detail}</p>
      )}
      {cta && (
        <button
          onClick={onCta}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold uppercase transition-transform active:scale-95"
          style={{ background: TEAL_DEEP, color: "#FFFFFF", fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".07em" }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}
