// MyTrip — the traveler's bookings hub. Reads the signed-in user's own affiliate
// taps (worker /aff/mine -> affiliate_clicks WHERE user_id) and groups them by
// category (stays / tours / events / rides / car / data / storage ...).
//
// HONEST-UX (non-negotiable): a tap is NOT a booking. We label items "Started"
// until the partner's offline conversion report marks them "Confirmed" — we never
// say "Booked". Tapping a card opens a detail sheet; its one action reopens the
// partner where the user left off — except in-app (Nuitée) bookings, which have
// no partner page to reopen (the worker writes target_url NULL): their sheet
// shows the stored booking info instead, with no new worker calls.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Loader2, ExternalLink, Luggage } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { useIsTablet } from "@/lib/useIsTablet";
import BookingDetailSheet, { StatusChip, partnerLabel, fmtDate } from "@/components/trips/BookingDetailSheet";
import StayAnchor from "@/components/home/StayAnchor";
import WishlistCard from "@/components/home/WishlistCard";

// Editorial design tokens (shared with SavedLocations / PlacesToEat).
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK3 = "#736657";
const ED_RULE = "rgba(22,17,13,.10)";
const IVORY = "#FFFCF7";
const TEAL_DEEP = "#0E7C73";

// category -> section. Falls back to partner when the click had no category.
const SECTIONS = {
  stays: { emoji: "🏨", label: "Stays", accent: "#1F5BD6" },
  tours: { emoji: "🎟️", label: "Tours & experiences", accent: "#C5197A" },
  events: { emoji: "🎫", label: "Events & tickets", accent: "#7C3AED" },
  rides: { emoji: "🚕", label: "Rides & transfers", accent: "#3F49D4" },
  car: { emoji: "🚗", label: "Car rental", accent: "#0E7C73" },
  data: { emoji: "📶", label: "Connectivity", accent: "#0F9A6B" },
  storage: { emoji: "🧳", label: "Luggage storage", accent: "#A85A2E" },
  shopping: { emoji: "🛍️", label: "Shopping", accent: "#7C3AED" },
  flights: { emoji: "✈️", label: "Flights", accent: "#1F5BD6" },
  other: { emoji: "📌", label: "Other", accent: "#736657" },
};
const SECTION_ORDER = ["stays", "tours", "events", "rides", "car", "data", "storage", "shopping", "flights", "other"];

// partnerLabel / fmtDate / statusLabel / StatusChip and the detail sheet now
// live in src/components/trips/BookingDetailSheet.jsx (shared with Trips).
// Only known transport reasons reach the screen; a worker 500 can carry an
// internal D1/SQL message that is not for travelers.
const friendlyError = (e) => {
  const s = String(e || "");
  if (s === "timeout") return "The server took too long to respond.";
  if (/^HTTP \d+$/.test(s) || /^Network error$|Failed to fetch|No response/i.test(s)) return "Couldn't reach the server.";
  return "Something went wrong on our side.";
};

function sectionKeyFor(category, partner) {
  const c = (category || "").toLowerCase();
  if (/hotel|stay|accommodation|lodging/.test(c)) return "stays";
  if (/tour|activity|experience|attraction|excursion/.test(c)) return "tours";
  if (/event|concert|show|ticket|theatre|theater|game|sport/.test(c)) return "events";
  if (/transfer|ride|taxi|pickup|shuttle/.test(c)) return "rides";
  if (/car|rental/.test(c)) return "car";
  if (/esim|sim|data|internet|connectivity/.test(c)) return "data";
  if (/storage|luggage|bag/.test(c)) return "storage";
  if (/shop/.test(c)) return "shopping";
  if (/flight|airfare|airline/.test(c)) return "flights";
  // fall back to the partner when category is blank/unknown
  const p = (partner || "").toLowerCase();
  if (p === "stay22" || p === "booking" || p === "agoda") return "stays";
  if (p === "viator" || p === "getyourguide") return "tours";
  if (p === "ticketmaster" || p === "vividseats" || p === "fever" || p === "stubhub") return "events";
  if (p === "welcomepickups" || p === "kiwitaxi") return "rides";
  if (p === "discovercars") return "car";
  if (p === "airalo") return "data";
  if (p === "radicalstorage") return "storage";
  return "other";
}

export default function MyTripPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const fs = (n) => `calc(${n}px*var(--fs))`;
  const t = (tab, phone) => (isTablet ? tab : phone);
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";

  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [items, setItems] = useState([]);
  // Load failure (timeout / offline / worker 4xx-5xx), kept apart from "no
  // bookings" so a traveler with real bookings is never told they have none.
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);   // bumped by Retry
  const [detail, setDetail] = useState(null);  // { it, accent } — booking open in the sheet

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // callWorker never throws — a timeout, offline fetch or worker 4xx/5xx
        // resolves as { data: null, error }. Read `error`, or every failure
        // renders as the definitive "No bookings yet" (audit 2026-09-01).
        const { data, error: err } = await callWorker(ROUTE.affiliateMine, {});
        if (cancelled) return;
        if (err || !data) {
          setError(err || "No response");
          setItems([]); setNeedsAuth(false);
          return;
        }
        setNeedsAuth(!!data.needsAuth);
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (!cancelled) { setItems([]); setNeedsAuth(false); setError(e?.message || "Network error"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  // CONFIRMED ONLY (founder call, 2026-08-31 — reverses the 2026-08-24 change).
  // My Trip is for things you actually booked: stays, tours, tickets, concerts.
  // A tap on a partner link is not a booking and no longer appears here.
  // "confirmed" is set by /aff/import from the partner's conversion report, so
  // this list is only as current as the last import. The home card counts the
  // same set and renders nothing at zero, so there is no "N items → empty page".
  const bookings = items.filter((it) => (it.status || "").toLowerCase() === "confirmed");

  // Group into ordered sections.
  const grouped = SECTION_ORDER
    .map((key) => ({ key, meta: SECTIONS[key], rows: bookings.filter((it) => sectionKeyFor(it.category, it.partner) === key) }))
    .filter((g) => g.rows.length > 0);

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
            style={{ background: "#EAE0FA", color: "#6D3AC0", fontFamily: ED_MONO, fontSize: t(fs(11), fs(10.5)), letterSpacing: ".08em" }}
          >
            <Luggage size={13} color="#6D3AC0" strokeWidth={2} /> My Trip
          </div>
          <div className="w-10 h-10" aria-hidden="true" />
        </div>
      </div>

      {/* TITLE */}
      <div className={`px-4 ${colWrap} mx-auto pb-2 text-center`}>
        <h1 className="italic leading-none" style={{ fontFamily: ED_SERIF, fontSize: t(fs(38), fs(28)), color: TEAL_DEEP }}>
          My Trip
        </h1>
        <p className="uppercase mt-2 font-semibold" style={{ fontFamily: ED_MONO, fontSize: t(fs(10.5), fs(10)), letterSpacing: "0.16em", color: ED_INK3 }}>
          Your bookings so far
        </p>
      </div>

      {/* YOUR STAY + SAVED — moved here from Home (founder, 2026-09-20: "keep
          Your trip strictly inside the Your Trip page"). StayAnchor is the only
          place a traveler sets the base that Stamps near your stay and the
          events row re-center on, so it lives here now and never snoozes away.
          WishlistCard renders nothing until something is saved. */}
      <div className="pt-2">
        <StayAnchor persistent />
        <WishlistCard />
      </div>

      <div className={`${colWrap} mx-auto px-4 pb-16 pt-4`}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: TEAL_DEEP }} />
          </div>
        ) : error ? (
          <EmptyState
            fs={fs} t={t}
            emoji="📡"
            title="Couldn't load your trip"
            body="We couldn't reach your bookings just now. Check your connection and try again."
            detail={friendlyError(error)}
            cta="Retry"
            onCta={() => setAttempt((n) => n + 1)}
          />
        ) : needsAuth ? (
          <EmptyState
            fs={fs} t={t}
            emoji="🔒"
            title="Sign in to see your trip"
            body="Your tours, stays, and tickets are saved to your account so you can pick up where you left off on any device."
            cta="Sign in"
            onCta={() => navigate(createPageUrl("Settings"))}
          />
        ) : bookings.length === 0 ? (
          <EmptyState
            fs={fs} t={t}
            emoji="🧳"
            title="No bookings yet"
            body="Stays, tours, tickets, and anything else you book through a Globeskimmers partner appear here once the partner confirms it — usually a day or two after you pay."
            cta="Explore things to do"
            onCta={() => navigate(createPageUrl("ThingsToDo"))}
          />
        ) : (
          <>
            {/* Honest note — Started (resume) vs Confirmed (partner-verified). */}
            <div
              className="mb-5 p-3 rounded-[14px] flex items-start gap-2.5"
              style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}` }}
            >
              <span className="text-[15px] leading-none mt-0.5">🧭</span>
              <p style={{ color: ED_INK3, fontSize: t(fs(12.5), fs(12)), lineHeight: 1.5 }}>
                Everything here is <b style={{ color: "#0F7A50" }}>confirmed</b> by the partner you booked with. New bookings usually appear a day or two after you pay.
              </p>
            </div>

            {grouped.map((g) => (
              <section key={g.key} className="mb-7">
                <div className="flex items-center gap-2 mb-3 px-0.5">
                  <span className="text-[17px] leading-none">{g.meta.emoji}</span>
                  <h2 className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: t(fs(21), fs(18)), color: ED_INK }}>
                    {g.meta.label}
                  </h2>
                  <span className="ml-auto font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(11), color: ED_INK3 }}>
                    {g.rows.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {g.rows.map((it) => {
                    // Every row opens the detail sheet. The partner reopen (and
                    // in-app Nuitée's stored booking info — the worker writes
                    // target_url NULL, so there is nothing to reopen) lives there.
                    const inApp = (it.partner || "").toLowerCase() === "nuitee";
                    const canOpen = !inApp && !!it.target_url;
                    return (
                      <button
                        key={it.key}
                        onClick={() => setDetail({ it, accent: g.meta.accent })}
                        className="w-full text-left p-3.5 rounded-[16px] transition-colors hover:bg-black/[0.02]"
                        style={{ background: "#FFFFFF", border: `1px solid ${ED_RULE}`, boxShadow: "0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-1 self-stretch rounded-full flex-none"
                            style={{ background: g.meta.accent, minHeight: 36 }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusChip status={it.status} fs={fs} />
                              <span className="uppercase font-semibold" style={{ fontFamily: ED_MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: g.meta.accent }}>
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
                              {canOpen && <ExternalLink size={12} color={ED_INK3} strokeWidth={2} className="ml-auto flex-none" />}
                            </div>
                            {inApp && (
                              <div className="mt-1.5" style={{ fontFamily: ED_MONO, fontSize: fs(10.5), letterSpacing: ".04em", color: ED_INK3, lineHeight: 1.6 }}>
                                {it.product_id && <div>Booking ref {it.product_id}</div>}
                                <div>Confirmation emailed</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      <BookingDetailSheet
        booking={detail?.it || null}
        accent={detail?.accent || TEAL_DEEP}
        onClose={() => setDetail(null)}
        // A cancel that succeeded in the sheet flips the row's status here; this
        // page lists confirmed rows only, so the stay leaves the list on close.
        onStatusChange={(id, status) => setItems((prev) => prev.map((it) =>
          (it.partner || "").toLowerCase() === "nuitee" && String(it.product_id) === String(id) ? { ...it, status } : it
        ))}
        fs={fs}
        t={t}
      />
    </div>
  );
}

function EmptyState({ emoji, title, body, detail, cta, onCta, fs, t }) {
  return (
    <div className="text-center py-14 px-4">
      <div className="text-[40px] mb-3">{emoji}</div>
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
