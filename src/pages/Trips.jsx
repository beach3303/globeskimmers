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
import BookingDetailSheet, { StatusChip, partnerLabel, fmtDate, splitProductName } from "@/components/trips/BookingDetailSheet";
import { IVORY, IVORY_2, TEAL_DEEP, SHADOW_CARD_SOFT } from "@/components/redesign/constants";

// Editorial design tokens (shared with MyTrip / Wishlist / SavedLocations).
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK3 = "#736657";
const ED_RULE = "rgba(22,17,13,.10)";
const STAMP_RED = "#B0472F"; // warm passport-ink red (same as Passport)
const DAY_MS = 86400000;

// Past-trip feedback — asked once per booking, never nags: a submit OR a
// dismissal is remembered on-device per bookingRef and the prompt stays gone.
const fbKey = (ref) => `gs_trip_fb_${ref}`;
const readFbState = (ref) => { try { return localStorage.getItem(fbKey(ref)); } catch { return null; } };
const writeFbState = (ref, v) => { try { localStorage.setItem(fbKey(ref), v); } catch { /* ignore */ } };

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

  // ── BOOKED sections (Wave 1) ──────────────────────────────────────────────
  // A tap is still not a booking: only partner-confirmed rows show. CANCELLED
  // rows are kept too (never deleted) but sink straight to Past trips, muted.
  //
  // dueDate per row: ONLY Nuitée rows carry real stay dates (the worker encodes
  // "<hotel> · <checkin> → <checkout>" in product_name — splitProductName reads
  // them back). Partner rows get NO dueDate ever — their dates live with the
  // partner and we never fabricate them.
  const parseYMD = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
  };
  const todayStart = new Date().setHours(0, 0, 0, 0);

  const rows = items
    .filter((it) => ["confirmed", "cancelled"].includes((it.status || "").toLowerCase()))
    .map((it) => {
      const isNuitee = (it.partner || "").toLowerCase() === "nuitee";
      const { name, dates } = splitProductName(it.product_name);
      let checkin = null, checkout = null;
      if (isNuitee) {
        // Prefer the real stay-date columns (worker Wave 3 / 08_nuitee_stay_
        // fields.sql) when the row carries BOTH; legacy rows fall back to the
        // product_name parse. Still never a fabricated date for partner rows.
        checkin = parseYMD(it.checkin);
        checkout = parseYMD(it.checkout);
        if ((checkin == null || checkout == null) && dates) {
          const [a, b] = dates.split(" → ");
          checkin = parseYMD(a);
          checkout = parseYMD(b);
        }
      }
      return { it, name, dates, dated: checkin != null && checkout != null, checkin, checkout };
    });

  const isCancelled = (r) => (r.it.status || "").toLowerCase() === "cancelled";
  // Past = the checkout day is fully over (checkout+1 <= today) — or cancelled.
  const isPast = (r) => isCancelled(r) || (r.dated && r.checkout < todayStart);

  // (1) UPCOMING — dated rows, check-in ASC; mid-stay rows pin to the top.
  const upcoming = rows.filter((r) => r.dated && !isPast(r)).sort((a, b) => a.checkin - b.checkin);
  const current = upcoming.filter((r) => r.checkin <= todayStart);
  const future = upcoming.filter((r) => r.checkin > todayStart);
  // (2) undated confirmed partner rows — newest tap first.
  const undated = rows.filter((r) => !r.dated && !isCancelled(r)).sort((a, b) => (b.it.ts || 0) - (a.it.ts || 0));
  // (3) past — reverse-chron by checkout (cancelled/undated fall back to ts).
  const past = rows
    .filter(isPast)
    .sort((a, b) => (b.checkout ?? (b.it.ts || 0) * 1000) - (a.checkout ?? (a.it.ts || 0) * 1000));
  const bookedCount = upcoming.length + undated.length + past.length;

  // Countdown captions — dated rows only. Mid-stay pins say ENJOY YOUR STAY
  // (CHECK-IN TODAY on the check-in day itself); the soonest future stay says
  // IN {N} DAYS. Partner rows never get one — we don't know their dates.
  const currentCaption = (r) => (r.checkin === todayStart ? "CHECK-IN TODAY" : "ENJOY YOUR STAY");
  const futureCaption = (r) => {
    const n = Math.round((r.checkin - todayStart) / DAY_MS);
    return `IN ${n} ${n === 1 ? "DAY" : "DAYS"}`;
  };

  // Default tab: BOOKED when ≥1 confirmed booking, else DREAMING — decided when
  // the first load lands, and never after the traveler taps a tab themselves.
  useEffect(() => {
    if (!loading && !picked.current && rows.some((r) => !isCancelled(r))) setTab("booked");
  }, [loading]); // rows derives from the same load — loading is the real trigger

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
          ) : bookedCount === 0 ? (
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

              {/* (1) UPCOMING — dated stays, mid-stay pinned, then check-in ASC */}
              {upcoming.length > 0 && (
                <p className="uppercase font-semibold mb-2 px-1" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".14em", color: ED_INK3 }}>
                  Upcoming
                </p>
              )}
              <div className="flex flex-col gap-2.5">
                {current.map((r) => (
                  <BookedRow key={r.it.key} r={r} fs={fs} t={t} display="confirmed" caption={currentCaption(r)} onOpen={() => setDetail(r.it)} />
                ))}
                {future.map((r, i) => (
                  <BookedRow key={r.it.key} r={r} fs={fs} t={t} display="confirmed" caption={i === 0 ? futureCaption(r) : null} onOpen={() => setDetail(r.it)} />
                ))}
                {/* (2) undated confirmed partner rows — their dates live with the partner */}
                {undated.map((r) => (
                  <BookedRow
                    key={r.it.key} r={r} fs={fs} t={t} display="confirmed"
                    // An in-app row without parseable dates has no partner to
                    // hold them — say nothing rather than something wrong.
                    microcopy={(r.it.partner || "").toLowerCase() === "nuitee" ? null : `Dates live with ${partnerLabel(r.it.partner)}`}
                    onOpen={() => setDetail(r.it)}
                  />
                ))}
              </div>

              {/* (3) Past trips — completed stays reverse-chron; cancelled rows
                  sink here immediately, muted, and still open the sheet. */}
              {past.length > 0 && (
                <>
                  <h2 className="italic mt-7 mb-3 px-1" style={{ fontFamily: ED_SERIF, fontSize: t(fs(20), fs(18)), color: ED_INK3 }}>
                    Past trips
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {past.map((r) => (
                      <div key={r.it.key}>
                        <BookedRow
                          r={r} fs={fs} t={t} muted
                          display={isCancelled(r) ? "cancelled" : "completed"}
                          onOpen={() => setDetail(r.it)}
                        />
                        {/* Completed stays only (never cancelled — they didn't stay):
                            a compact once-per-booking feedback ask under the card. */}
                        {!isCancelled(r) && r.dated && <TripFeedbackPrompt r={r} fs={fs} t={t} />}
                      </div>
                    ))}
                  </div>
                </>
              )}
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
        // A cancel that succeeded in the sheet flips the row's status here, so
        // the row sinks to Past (isCancelled) without a refetch.
        onStatusChange={(id, status) => setItems((prev) => prev.map((it) =>
          (it.partner || "").toLowerCase() === "nuitee" && String(it.product_id) === String(id) ? { ...it, status } : it
        ))}
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

// One booking card. `display` is the DISPLAY status (confirmed / completed /
// cancelled — the stored row is never rewritten); `caption` is the countdown
// line (dated Nuitée rows only); `microcopy` is the honest dates-live-with-
// partner line for undated rows. Muted (past) rows still open the sheet.
function BookedRow({ r, fs, t, display, caption, microcopy, muted, onOpen }) {
  const { it, name, dates, dated } = r;
  return (
    <button
      onClick={onOpen}
      className="w-full text-left p-3.5 rounded-[16px] transition-colors hover:bg-black/[0.02]"
      style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: SHADOW_CARD_SOFT, opacity: muted ? 0.65 : 1 }}
    >
      {caption && (
        <div className="uppercase font-semibold mb-1.5" style={{ fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".12em", color: TEAL_DEEP }}>
          {caption}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusChip status={display || it.status} fs={fs} />
        <span className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: ED_INK3 }}>
          {partnerLabel(it.partner)}
        </span>
      </div>
      <div
        className="font-medium mt-1.5"
        style={{ fontFamily: ED_SERIF, fontSize: t(fs(17), fs(15.5)), color: ED_INK, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {name || it.product_name || partnerLabel(it.partner)}
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap" style={{ color: ED_INK3, fontSize: t(fs(12), fs(11.5)) }}>
        {it.dest_city && <span>{it.dest_city}{it.dest_country ? `, ${it.dest_country}` : ""}</span>}
        {it.dest_city && <span aria-hidden="true">·</span>}
        {dated ? (
          <span style={{ fontFamily: ED_MONO, fontSize: t(fs(11), fs(10.5)), letterSpacing: ".02em" }}>{dates}</span>
        ) : (
          <span>{fmtDate(it.ts)}</span>
        )}
      </div>
      {microcopy && (
        <div className="mt-1.5 uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: ED_INK3 }}>
          {microcopy}
        </div>
      )}
    </button>
  );
}

// Compact once-per-booking feedback ask, rendered as a quiet sub-card under a
// completed past stay (BookedRow is itself a <button>, so the prompt must be a
// sibling, never a child). Five text-★ buttons (stamp-red when selected), an
// optional one-line problems input, a quiet send. Submit or dismiss persists
// per bookingRef in localStorage so the ask never nags; a worker "already_left"
// gets the same thanks line (idempotent UX).
function TripFeedbackPrompt({ r, fs, t }) {
  const it = r.it;
  const bookingRef = it.product_id || it.key;
  const [phase, setPhase] = useState(() => {
    const s = readFbState(bookingRef);
    return s === "done" ? "thanks" : s === "dismissed" ? "hidden" : "ask";
  });
  const [rating, setRating] = useState(0);
  const [problems, setProblems] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  if (!bookingRef || phase === "hidden") return null;

  const dismiss = () => { writeFbState(bookingRef, "dismissed"); setPhase("hidden"); };

  const submit = async () => {
    if (!rating || sending) return;
    setSending(true);
    setErr(null);
    // checkout as YYYY-MM-DD: prefer the row's real column; else re-format the
    // parsed local ms (parseYMD built it from local parts, so local out too).
    let checkout = it.checkout || null;
    if (!checkout && r.checkout) {
      const d = new Date(r.checkout);
      checkout = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    // The worker answers business outcomes as 200 { ok, reason } — only
    // transport trouble surfaces as `error` (callWorker never throws).
    const { data: resp } = await callWorker(ROUTE.tripFeedback, {
      bookingRef,
      rating,
      problems: problems.trim() || null,
      hotelName: r.name || it.product_name || null,
      city: it.dest_city || null,
      country: it.dest_country || null,
      checkout,
    });
    setSending(false);
    // "already_left" = they rated this stay before — same thanks, idempotent.
    if (!resp?.ok && resp?.reason !== "already_left") {
      setErr("Couldn't send — check your connection and try again.");
      return;
    }
    writeFbState(bookingRef, "done");
    setPhase("thanks");
  };

  return (
    <div className="mx-2 mt-1.5 rounded-[14px] px-4 py-3" style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: SHADOW_CARD_SOFT }}>
      {phase === "thanks" ? (
        <p className="uppercase font-semibold text-center" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".08em", color: ED_INK3 }}>
          Thanks — this shapes where we send travelers.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="italic" style={{ fontFamily: ED_SERIF, fontSize: t(fs(16), fs(15)), color: ED_INK }}>
              How was your stay?
            </p>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="w-7 h-7 rounded-full flex items-center justify-center flex-none transition-colors hover:bg-black/5"
              style={{ background: "transparent", border: "none", color: ED_INK3, fontSize: fs(15), lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <div className="flex gap-0.5 mt-1.5" role="radiogroup" aria-label="Rate your stay from 1 to 5 stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                className="transition-transform active:scale-90"
                style={{ background: "transparent", border: "none", padding: "2px 4px", fontSize: fs(22), lineHeight: 1, color: n <= rating ? STAMP_RED : "rgba(22,17,13,.18)", cursor: "pointer" }}
              >
                ★
              </button>
            ))}
          </div>
          <input
            value={problems}
            onChange={(e) => setProblems(e.target.value)}
            maxLength={140}
            placeholder="Anything go wrong? (optional)"
            className="w-full mt-2 rounded-lg px-3 py-2"
            style={{ border: `1px solid ${ED_RULE}`, background: IVORY, fontSize: fs(13), color: ED_INK, outline: "none" }}
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={submit}
              disabled={!rating || sending}
              className="uppercase font-semibold px-3.5 py-1.5 rounded-full transition-colors"
              style={{
                fontFamily: ED_MONO, fontSize: fs(10), letterSpacing: ".08em",
                background: rating ? ED_INK : "transparent",
                color: rating ? IVORY : ED_INK3,
                border: `1px solid ${rating ? ED_INK : ED_RULE}`,
                opacity: sending ? 0.6 : 1,
                cursor: rating ? "pointer" : "default",
              }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
            {err && (
              <span style={{ fontFamily: ED_MONO, fontSize: fs(9.5), color: STAMP_RED }}>{err}</span>
            )}
          </div>
        </>
      )}
    </div>
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
