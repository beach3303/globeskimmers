// SmartPackages — the Smart Package composer v1 (hotel + things to do, one plan).
//
// One scrolling surface, stages inline — no wizard chrome:
//   S1 INPUTS  — destination (prefilled from router state { dest } when the
//                Dream answer card sends a GROUNDED destination with coords;
//                otherwise resolved via the owned search-location route),
//                date range (seedable from router-state checkin/checkout when
//                the sender includes valid future dates) + party (FindAHotel's
//                picker/stepper patterns),
//                an optional interest line, one teal "Compose my package".
//   S2 DRAFT   — POST /package/draft → the worker's two-choice draft:
//                exactly the two hotel choices the draft returns (pre-decided
//                default = the first), ≤2 Viator tours + the soonest in-window
//                event as separately-booked rows, an honest hotel-only total,
//                and ONE teal primary that hands the selected choice (and the
//                chosen rate's offerId) into the existing HotelBookSheet.
//                Wave A additive fields — destination intel ("Know before you
//                go"), a selectable "What you'll see" attractions rail, honest
//                AC/breakfast notes — are read defensively: every one may be
//                absent (old worker, cached drafts) and absent renders nothing.
//                Wave C (quality bar + rooms + photos): each choice renders as
//                HotelChoiceCard (supplier gallery → PhotoLightbox, amenity
//                tags, the chosen room line, "Choose room" → RoomChooserSheet);
//                draft.qualityBar says which quality pass the pair came from;
//                draft.stayAreas offer a "WHERE IN <CITY>?" recompose around
//                one area. All additive, all read defensively.
//   S3 FAIL    — ok:false reasons render one designed FinderEmptyState card.
//
// Doctrine notes: totals are never fabricated — the estimate figure is the
// selected hotel's stay total plus only picked attractions carrying a real
// supplier tour price in the hotel's own currency; every other pick is
// labeled "priced at booking" and currencies are never silently converted.
// ONE teal primary per surface: the compose button demotes to a quiet
// ivory button the moment a draft (or fail card) is on screen. Selection uses
// the stamp-red ring, never a second teal. Flights are not in v1 — no origin
// or cabin fields are faked here.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import {
  ArrowLeft, BedDouble, Calendar as CalendarIcon, Check, CloudOff, MapPin,
  Minus, Plus, Search, X,
} from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";
import { callWorker } from "@/lib/callWorker";
import { canonicalName, citiesFor } from "@/lib/destinationCities";
import { logDiscover } from "@/lib/logDiscover";
import { useDwell } from "@/lib/useDwell";
import { viatorProductLink, viatorSearchLink } from "@/lib/viator";
import { ROUTE } from "@/lib/workerRoutes";
import { trackAffiliateClick } from "@/lib/affiliate";
import { openPartner, openPartnerAndWait } from "@/lib/openPartner";
import HotelBookSheet from "@/components/hotels/HotelBookSheet";
import HotelChoiceCard, { bedLabelFor } from "@/components/hotels/HotelChoiceCard";
import RoomChooserSheet from "@/components/hotels/RoomChooserSheet";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import PhotoLightbox from "@/components/finder/PhotoLightbox";
import { IVORY, IVORY_2, TEAL_DEEP } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = "#16110D", SUB = "#736657", EDGE = "#E6DFD0", INK2 = "#6B7280";
const STAMP = "#B0472F"; // selection ring — teal stays on the one primary
const ACCENT = TEAL_DEEP, ACCENT_BG = "#E4F1EF"; // the refundable-green (OK) now lives in HotelChoiceCard / RoomChooserSheet
const AMBER = "#B45309"; // honest-notes register — FindAHotel's dropped-filters line
const RUST = "#B0472F";  // serious-caveat register — the stamp red; the one colour that stops the flow
const fs = (n) => `calc(${n}px*var(--fs))`;

// Same Intl money as HotelBookSheet — whole units, real currency code.
const money = (amt, cur) => {
  if (amt == null) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(amt); }
  catch { return `${Math.round(amt)} ${cur || ""}`; }
};
// UTC-noon-safe "Wed, Sep 4" (HotelBookSheet's fmtDate).
const fmtDate = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
};

// Honest mono kickers for the worker's hotelChoices[].role values — the
// quality-bar composer's three roles plus the legacy trio (old cached drafts).
const ROLE_LABEL = {
  best_value: "BEST VALUE",
  top_pick: "TOP PICK",
  runner_up: "RUNNER-UP",          // second-best-rated when the top pick is also the cheapest
  best_available: "BEST AVAILABLE",
  cheapest: "LOWEST PRICE",
  best_reviewed: "BEST REVIEWED",
  second_cheapest: "ALSO GREAT",
};

// The lightbox credit line — supplier photos, said plainly.
const PHOTO_CREDIT = "Photos from the hotel's supplier";

// FindAHotel's local Stepper pattern (copied, not imported — it is page-local there).
function Stepper({ label, value, setValue, min = 0, max = 16 }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[calc(14.5px*var(--fs))]" style={{ color: INK }}>{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => setValue(Math.max(min, value - 1))} aria-label={`Fewer ${label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F1EADF", opacity: value <= min ? 0.5 : 1 }} disabled={value <= min}>
          <Minus size={16} color={INK} strokeWidth={2.4} />
        </button>
        <span className="w-6 text-center font-bold text-[calc(15px*var(--fs))]" style={{ color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <button onClick={() => setValue(Math.min(max, value + 1))} aria-label={`More ${label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: ACCENT_BG }} disabled={value >= max}>
          <Plus size={16} color={ACCENT} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

// 4:3 photo tile for a "What you'll see" card — serif-initial fallback (a
// letter on the accent wash, never an icon or emoji) when the photo is missing
// or fails to load.
function AttractionThumb({ photoUrl, name }) {
  const [broken, setBroken] = useState(false);
  const initial = (String(name || "").trim().charAt(0) || "?").toUpperCase();
  if (!photoUrl || broken) {
    return (
      <div className="flex items-center justify-center" aria-hidden="true"
        style={{ height: 112, background: `linear-gradient(135deg, ${ACCENT_BG}, ${IVORY_2})` }}>
        <span style={{ fontFamily: SERIF, fontSize: fs(38), color: ACCENT, lineHeight: 1 }}>{initial}</span>
      </div>
    );
  }
  return (
    <img src={photoUrl} alt={name || ""} loading="lazy" onError={() => setBroken(true)}
      style={{ width: "100%", height: 112, objectFit: "cover", display: "block" }} />
  );
}

// KNOW BEFORE YOU GO — the draft's additive destination intel. Every field is
// read defensively (old workers and cached drafts send none): an absent line
// simply doesn't render, and without intel.available nothing renders at all.
// The guidance sub-line stays in the quiet mono register — it is AI-written,
// honest labeling over polish.
function IntelCard({ intel }) {
  if (!intel?.available) return null;
  const bt = intel.bestTime || {};
  const months = Array.isArray(bt.months) ? bt.months.filter(Boolean).join(", ") : (bt.months || "");
  const dn = intel.daysNeeded || {};
  const dMin = Number(dn.min), dIdeal = Number(dn.ideal);
  const hasDays = Number.isFinite(dMin) || Number.isFinite(dIdeal);
  const daysTxt = Number.isFinite(dMin) && Number.isFinite(dIdeal)
    ? (dIdeal === dMin ? `${dMin}` : `${dMin}–${dIdeal}`)
    : `${Number.isFinite(dIdeal) ? dIdeal : dMin}`;
  const known = (Array.isArray(intel.knownFor) ? intel.knownFor : []).filter(Boolean);
  if (!months && !hasDays && known.length === 0 && !intel.guidance) return null;
  return (
    <div className="mt-4 rounded-2xl px-4 py-3.5" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
      <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: SUB }}>
        Know before you go
      </div>
      {months ? (
        <div className="text-[calc(12.5px*var(--fs))] leading-snug mt-1.5" style={{ color: INK }}>
          <span className="font-semibold">Best time:</span> {months}{bt.why ? ` — ${bt.why}` : ""}
        </div>
      ) : null}
      {hasDays && (
        <div className="text-[calc(12.5px*var(--fs))] leading-snug mt-1" style={{ color: INK }}>
          <span className="font-semibold">Days needed:</span> {daysTxt}{dn.why ? ` — ${dn.why}` : ""}
        </div>
      )}
      {known.length > 0 && (
        <div className="text-[calc(12.5px*var(--fs))] leading-snug mt-1" style={{ color: INK }}>
          <span className="font-semibold">Known for:</span> {known.join(" · ")}
        </div>
      )}
      {intel.guidance ? (
        <div className="font-mono text-[calc(11px*var(--fs))] leading-snug mt-2" style={{ color: SUB }}>
          {intel.guidance}
        </div>
      ) : null}
    </div>
  );
}

// Skeleton block matching the final draft layout (heading, two cards, rows, total).
function DraftSkeleton() {
  const blk = (h, extra = "") => (
    <div className={`rounded-2xl animate-pulse ${extra}`} style={{ height: h, background: IVORY_2, border: `1px solid ${EDGE}` }} />
  );
  return (
    <div className="mt-6">
      <div className="rounded animate-pulse" style={{ height: 26, width: "60%", background: IVORY_2 }} />
      <div className="rounded animate-pulse mt-2" style={{ height: 12, width: "45%", background: IVORY_2 }} />
      <div className="grid grid-cols-2 gap-2.5 mt-4">{blk(208)}{blk(208)}</div>
      <div className="mt-4">{blk(120)}</div>
      <div className="mt-4">{blk(88)}</div>
      <div className="rounded-[16px] animate-pulse mt-4" style={{ height: 52, background: "#D8E8E5" }} />
    </div>
  );
}

export default function SmartPackages() {
  const navigate = useNavigate();
  const routerState = useRouterLocation().state;

  // Destination — { name, city, country, lat, lng }. Prefilled only from a
  // grounded dream destination (coords guaranteed by the card's contract).
  const [dest, setDest] = useState(() => {
    const d = routerState?.dest;
    return d && Number.isFinite(d.lat) && Number.isFinite(d.lng)
      ? { name: d.name || d.city || "", city: d.city || "", country: d.country || "", lat: d.lat, lng: d.lng }
      : null;
  });
  // A name-only handoff (Deal Radar's "Build my trip" has no coords) prefills
  // the typed search instead of being discarded — the button must land somewhere.
  const [destQuery, setDestQuery] = useState(() => {
    const d = routerState?.dest;
    return d && !(Number.isFinite(d.lat) && Number.isFinite(d.lng)) && d.name ? String(d.name) : "";
  });
  const [destResults, setDestResults] = useState([]);
  const [destSearching, setDestSearching] = useState(false);
  // A "too broad" answer from search-location (a country, a large region) →
  // { name, kind, country, cities[] }: the composer offers cities instead of
  // dead-ending on a disabled button. destMsg carries the worker's honest
  // no-result line for a plain miss.
  const [destBroad, setDestBroad] = useState(null);
  const [destMsg, setDestMsg] = useState("");

  // Dates — { from: Date, to: Date } | undefined. Optionally prefilled from
  // router state (the gallery tease sends checkin/checkout beside dest): both
  // must be valid yyyy-MM-dd, checkout after checkin, and check-in not in the
  // past — anything else is discarded and the calendar starts empty exactly as
  // today. A valid pair seeds the range the same way a user tap would; the
  // calendar stays fully editable.
  const [range, setRange] = useState(() => {
    const parseIsoDay = (s) => {
      if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y, m - 1, d); // local midnight — same day math as DayPicker
      return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
    };
    const from = parseIsoDay(routerState?.checkin);
    const to = parseIsoDay(routerState?.checkout);
    if (!from || !to || !(to > from)) return undefined;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    return from < t0 ? undefined : { from, to };
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState([]); // index-aligned ages 0–17; unset entries default to 8 (the worker's mid-childhood default)
  const [rooms, setRooms] = useState(1);          // 1–min(adults,4); only sent when > 1
  // Rooms can never exceed adults (a 2-adult party can't fill 3 rooms — the
  // quote wouldn't cover them); re-clamp when adults shrinks.
  useEffect(() => { setRooms((r) => Math.min(r, Math.max(1, Math.min(adults, 4)))); }, [adults]);
  const [interest, setInterest] = useState(""); // optional → interestQuery

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(null);   // the worker's priced draft
  const [extra, setExtra] = useState(null);   // additive draft extras — { intel, attractions, acNote, breakfastNote }, each may be null/empty
  const [picks, setPicks] = useState({});     // "What you'll see" selections — local Wave-A state only, keyed by attraction id/name
  const [sid, setSid] = useState(null);       // package_orders row id (server-side)
  const [fail, setFail] = useState(null);     // { reason } from ok:false / network
  const [selIdx, setSelIdx] = useState(0);    // chosen hotelChoices index — default: the first (the worker's pre-decided default)
  const [selRateByChoice, setSelRateByChoice] = useState({}); // { [choiceIdx]: rate } — a room plan picked in RoomChooserSheet; absent = the choice's cheapest
  const [photoLb, setPhotoLb] = useState(null);    // { choiceIdx, photos:[{src,hd}], index, title } | null — the one PhotoLightbox
  const [roomSheet, setRoomSheet] = useState(null); // choiceIdx | null — RoomChooserSheet open for that choice
  const [stayAreaSel, setStayAreaSel] = useState(""); // "" = Anywhere; else a draft.stayAreas[].name sent as body.stayArea
  const [bookSheet, setBookSheet] = useState(null); // the choice being booked (opens HotelBookSheet)
  // Serious caveats stop the flow ONCE: the sheet asks "Still book?", a yes is
  // remembered for this draft, and nothing asks again.
  const [stillBook, setStillBook] = useState(null); // { items, proceed } while the sheet is up
  const ackSidRef = useRef(null);
  const [testBusy, setTestBusy] = useState(false);  // founder-only Stripe test checkout in flight
  const [testErr, setTestErr] = useState(null);     // its error reason — quiet inline line only
  const resultRef = useRef(null);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const checkin = range?.from ? format(range.from, "yyyy-MM-dd") : "";
  const checkout = range?.to ? format(range.to, "yyyy-MM-dd") : "";
  const hasCoords = Number.isFinite(dest?.lat) && Number.isFinite(dest?.lng);
  // Page-level dwell — one 'dwell' event per visit (foreground ms, >= 2s,
  // capped at 10 min); dest is read at report time, so it reflects the
  // destination the user ended on, null if none was ever chosen.
  // place_name (not `dest`) — the demand_dwell_30d report groups on $.place_name;
  // a divergent key silently collapses this surface into place=''.
  useDwell("smart_packages", { place_name: dest?.name || null });
  const typedDest = destQuery.trim();
  // A typed-but-unresolved destination still enables Compose: compose()
  // resolves it itself (top result, or city chips for a country), so nobody
  // has to know a suggestion had to be tapped first.
  const canCompose = (hasCoords || !!typedDest) && !!checkin && !!checkout && checkout > checkin;   // ISO string compare — same-day stays disabled, matching the worker's checkout<=checkin 400
  const hasResult = !!draft || !!fail; // demotes the compose button to quiet ivory
  // Founder-only test lane while Stripe is in test mode — the page reads no URL
  // params otherwise, so this comes straight off window.location.search. Without
  // ?stripetest=1 nothing below renders differently.
  const stripeTest = new URLSearchParams(window.location.search).get("stripetest") === "1";

  useEffect(() => {
    if (draft && resultRef.current) resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [draft]);

  // Owned search-location route resolves a typed destination to coordinates
  // (same route FindAHotel uses for its "another city" mode).
  // Returns the resolved results so compose() can use them directly. Only
  // results with real coordinates count — the composer needs a point.
  const searchDest = async (qOverride) => {
    const q = String(qOverride ?? destQuery).trim(); if (!q) return [];
    setDestSearching(true); setDestResults([]); setDestBroad(null); setDestMsg("");
    // Curated first, BEFORE any worker call (zero Google spend): a typed
    // country or region we hold cities for shows its chips straight away.
    // One curated city that IS the query ("Singapore") is a city, not a
    // choice — that one goes on to the worker like any other city.
    const local = citiesFor(q);
    if (local.length > 1 || (local.length === 1 && local[0].toLowerCase() !== q.toLowerCase())) {
      setDestBroad({ name: canonicalName(q), kind: "local", country: "", cities: local });
      setDestSearching(false);
      return [];
    }
    let results = [];
    try {
      const { data } = await callWorker(ROUTE.searchLocation, { query: q });
      results = (Array.isArray(data?.results) ? data.results : [])
        .filter((r) => Number.isFinite(r?.coordinates?.latitude) && Number.isFinite(r?.coordinates?.longitude));
      // A region we have curated cities for (Tuscany, Bali, Hawaii) is better
      // served by its cities than by a hotel search around one map point —
      // offer the chips instead of composing at the region's centre.
      const top = results[0];
      if (top && top.granularity === "region" && citiesFor(top.placeName || top.city).length) {
        const name = top.placeName || top.city;
        setDestBroad({ name, kind: "region", country: top.address?.country || "", cities: citiesFor(name) });
        results = [];
      }
      if (!results.length && !top) {
        const broad = Array.isArray(data?.tooBroad) ? data.tooBroad[0] : null;
        if (broad) {
          const name = broad.name || q;
          setDestBroad({ name, kind: broad.kind === "state" ? "region" : "country", country: broad.country || "", cities: citiesFor(name) });
        } else {
          setDestMsg(data?.message || "No destination found — try a city name.");
        }
      }
    } catch { setDestMsg("Couldn't search right now — try again."); }
    setDestResults(results);
    setDestSearching(false);
    return results;
  };
  const destFromResult = (r) => ({
    name: r.placeName || r.city || "",
    city: r.city || r.placeName || "",
    country: r.address?.country || "",
    lat: r.coordinates?.latitude,
    lng: r.coordinates?.longitude,
  });
  const pickDest = (r) => {
    setDest(destFromResult(r));
    setDestResults([]); setDestQuery(""); setDestBroad(null); setDestMsg("");
    setStayAreaSel(""); // a stay area belongs to one city
  };
  // A city chip under a "WHERE IN <NAME>?" row: search "City, Name" for every
  // kind (country, region, curated) and take the top hit — chip names are
  // curated, so the first result is the one.
  const pickCity = async (city) => {
    const scope = destBroad?.name || "";
    const rs = await searchDest(scope ? `${city}, ${scope}` : city);
    if (rs[0]) pickDest(rs[0]);
  };

  // compose({ stayArea }) — an explicit area (or "" for Anywhere) overrides
  // the remembered chip; a bare call (button onClick, empty-state retry) sends
  // the remembered one. destName stays the CITY either way — the area only
  // moves the hotel search point.
  const compose = async (opts) => {
    if (!canCompose || composing) return;
    const stayArea = opts && typeof opts === "object" && typeof opts.stayArea === "string" ? opts.stayArea : stayAreaSel;
    let d = dest;
    if (!hasCoords) {
      // Typed but never resolved: resolve it now. A country answer leaves the
      // city chips on screen; a plain miss leaves the honest message.
      const rs = await searchDest();
      if (!rs[0]) return;
      d = destFromResult(rs[0]); pickDest(rs[0]);
    }
    setComposing(true); setFail(null); setDraft(null); setExtra(null); setPicks({}); setSid(null); setSelIdx(0); setBookSheet(null); setTestErr(null);
    setSelRateByChoice({}); setPhotoLb(null); setRoomSheet(null);
    // Party fields beyond the defaults are only sent when they carry signal —
    // the worker treats absence exactly as the defaults (no children, one room).
    const body = {
      destLat: d.lat, destLng: d.lng,
      checkin, checkout, adults,
      destName: d.name || d.city || "",
      interestQuery: interest.trim().slice(0, 80),
    };
    if (stayArea) body.stayArea = stayArea.slice(0, 80);
    if (children > 0) {
      body.children = children;
      body.childrenAges = Array.from({ length: children }, (_, i) => {
        const a = Number(childAges[i]);
        return Number.isFinite(a) ? Math.min(17, Math.max(0, Math.round(a))) : 8;
      });
    }
    if (rooms > 1) body.rooms = rooms;
    const { data, error } = await callWorker("package/draft", body);
    if (data?.ok && data.draft) {
      setDraft(data.draft);
      // sid: the worker already stored this draft in D1 package_orders
      // (status 'priced'). After a successful HotelBookSheet booking there is
      // no client work in v1 — a future wave will use this sid to move the
      // order row's status to 'booked' from the booking-return path.
      setSid(data.sid || null);
      // Additive Wave-A fields — new workers return them beside the draft, but
      // read both spots and tolerate every field being absent (old worker,
      // cached drafts). Absent extras render nothing at all.
      const pick2 = (k) => data[k] ?? data.draft[k];
      const attractions = pick2("attractions");
      setExtra({
        intel: pick2("intel") || null,
        attractions: Array.isArray(attractions) ? attractions : [],
        acNote: typeof pick2("acNote") === "string" ? pick2("acNote") : null,
        breakfastNote: typeof pick2("breakfastNote") === "string" ? pick2("breakfastNote") : null,
      });
    } else {
      setFail({ reason: data?.reason || (error ? "network" : "error") });
    }
    setComposing(false);
  };

  // Tours and the event are separately-booked partner links — attribute the
  // click, then open in the partner sheet (EventsRow's pattern).
  const choices = Array.isArray(draft?.hotelChoices) ? draft.hotelChoices : [];
  const chosen = choices[selIdx] || choices[0] || null;
  // The rate the traveler picked for the chosen hotel (RoomChooserSheet), or
  // null — then every figure falls back to the choice's own cheapest fields.
  const selRate = selRateByChoice[selIdx] || null;
  const placeName = draft?.destName || dest?.name || "";

  // Wave C — the choice cards' handlers. Analytics via logDiscover carry the
  // destination as place_name (the demand reports group on it).
  const evtBase = (h, i) => ({ place_name: placeName, hotel_id: h?.hotelId || h?.id || null, role: h?.role || null, index: i });
  const selectChoice = (i) => {
    if (i === selIdx) return;
    setSelIdx(i);
    logDiscover("package_hotel_select", evtBase(choices[i], i));
  };
  const galleryOf = (h) => {
    const list = (Array.isArray(h?.photos) ? h.photos : [])
      .filter((p) => p && typeof p.url === "string" && p.url)
      .map((p) => ({ src: p.url, hd: p.hd || undefined }));
    if (!list.length && h?.thumbnail) list.push({ src: h.thumbnail });
    return list;
  };
  const openChoicePhotos = (i, idx = 0) => {
    const h = choices[i]; const photos = galleryOf(h);
    if (!photos.length) return;
    setPhotoLb({ choiceIdx: i, photos, index: Math.min(Math.max(idx, 0), photos.length - 1), title: h?.name || "" });
    logDiscover("package_hotel_photo_open", evtBase(h, i));
  };
  const openRooms = (i) => {
    setRoomSheet(i);
    logDiscover("package_room_open", { place_name: placeName, hotel_id: choices[i]?.hotelId || choices[i]?.id || null });
  };
  const pickRate = (i, rate) => {
    if (!rate || rate.offerId == null) return;
    const h = choices[i];
    setSelRateByChoice((m) => ({ ...m, [i]: rate }));
    if (i !== selIdx) setSelIdx(i); // choosing a room in a hotel chooses that hotel
    logDiscover("package_room_pick", {
      place_name: placeName, hotel_id: h?.hotelId || h?.id || null, role: h?.role || null,
      offer_id: rate.offerId, room_name: rate.roomName || null, bed_label: bedLabelFor(h, rate),
      board: rate.boardLabel || rate.board || null, price: rate.price ?? null, currency: rate.currency || h?.currency || null,
      refundable: !!rate.freeCancellation,
    });
  };
  // Room-sheet lightbox: the room's supplier photos, titled "Hotel — Room".
  const openRoomPhotos = (i, photos, idx, title) => {
    if (!Array.isArray(photos) || !photos.length) return;
    setPhotoLb({ choiceIdx: i, photos, index: Math.min(Math.max(idx || 0, 0), photos.length - 1), title: title || choices[i]?.name || "" });
    logDiscover("package_hotel_photo_open", { ...evtBase(choices[i], i), room: title || null });
  };
  // Stay areas — from the draft (or the intel that rides beside it). A chip
  // tap recomposes around that area; "Anywhere" recomposes city-wide.
  const stayAreas = (Array.isArray(draft?.stayAreas) ? draft.stayAreas : (Array.isArray(extra?.intel?.stayAreas) ? extra.intel.stayAreas : []))
    .filter((a) => a && typeof a.name === "string" && a.name.trim());
  const pickArea = (name) => {
    if (composing || name === stayAreaSel) return;
    setStayAreaSel(name);
    logDiscover("package_area_pick", { place_name: placeName, area: name || "Anywhere" });
    compose({ stayArea: name });
  };
  const openTour = async (t) => {
    if (!t?.url) return;
    const url = await trackAffiliateClick({
      partner: "viator", targetUrl: viatorProductLink(t.url), productId: t.code, productName: t.title,
      category: "tour", destCity: chosen?.city || draft?.destName, destCountry: chosen?.country,
    });
    openPartner(url || t.url);
  };
  const openEvent = async (ev) => {
    if (!ev?.url) return;
    const url = await trackAffiliateClick({
      partner: "ticketmaster", targetUrl: ev.url, productId: ev.id, productName: ev.name,
      category: "event", destCity: ev.city || chosen?.city || draft?.destName, destCountry: chosen?.country,
    });
    openPartner(url || ev.url);
  };

  // WHAT YOU'LL SEE — selection is purely local Wave-A state (nothing books
  // from these cards); keys survive missing ids by falling back to name+index.
  const attractions = extra?.attractions || [];
  const attrKey = (a, i) => (a?.id != null ? String(a.id) : `${a?.name || "attr"}-${i}`);
  const togglePick = (k) => setPicks((p) => ({ ...p, [k]: !p[k] }));
  const pickedNames = attractions
    .filter((a, i) => picks[attrKey(a, i)])
    .map((a) => a?.name)
    .filter(Boolean);

  // RUNNING ESTIMATE — pure client arithmetic, recomputed every render from
  // the CURRENT draft + selections (a recompose swaps the draft and resets
  // picks, so the block follows along with no extra wiring). A picked
  // attraction is summed only when the worker attached a real supplier price
  // (tourPrice/tourCurrency) AND its currency equals the hotel's — a
  // mismatched or missing price is counted, honestly, as "priced at booking";
  // nothing is ever silently converted. Old workers send neither field and
  // every pick lands in the unpriced bucket.
  const estCurrency = selRate?.currency || chosen?.currency || draft?.currency || "USD";
  const estBase = Number(selRate?.price ?? chosen?.stayTotal ?? chosen?.price);
  // Tour prices are Viator PER-TRAVELER from-rates; the hotel total covers the
  // whole party — so each priced pick multiplies by the party's adults, or the
  // sum quietly understates and mislabels a party-level figure.
  const estAdults = Math.max(1, Number(draft?.party?.adults) || adults || 2);
  let pricedPicks = 0, unpricedPicks = 0, pickedTourSum = 0;
  attractions.forEach((a, i) => {
    if (!picks[attrKey(a, i)]) return;
    const p = Number(a?.tourPrice);
    if (Number.isFinite(p) && p > 0 && a?.tourCurrency === estCurrency) {
      pricedPicks += 1; pickedTourSum += p * estAdults;
    } else {
      unpricedPicks += 1;
    }
  });
  const estTotal = Number.isFinite(estBase) ? Math.round((estBase + pickedTourSum) * 100) / 100 : null;
  const estDisplay = money(estTotal ?? (selRate?.price ?? chosen?.stayTotal ?? chosen?.price), estCurrency);
  const estNights = chosen?.nights || draft?.nights;
  // Inclusion line — three honest cases: no picks → hotel + nights; priced
  // picks → what's actually inside the figure; any unpriced picks append the
  // priced-at-booking count.
  const inclusionLine = [
    pricedPicks > 0
      ? `hotel + ${pricedPicks} tour${pricedPicks === 1 ? "" : "s"} (from-rates × ${estAdults})`
      : `hotel · ${estNights} night${estNights === 1 ? "" : "s"}`,
    unpricedPicks > 0 ? `${unpricedPicks} pick${unpricedPicks === 1 ? "" : "s"} priced at booking` : null,
  ].filter(Boolean).join(" · ");
  // "See tours" on a ticketed card — Wave A has no attraction booking, so this
  // hands off to Viator search for the attraction name through the same
  // payout-wrapped path every tour link uses (never a raw URL).
  const openAttractionTours = async (a) => {
    if (!a?.name) return;
    const target = viatorSearchLink(a.name);
    const url = await trackAffiliateClick({
      partner: "viator", targetUrl: target, productName: a.name,
      category: "tour", destCity: a.city || chosen?.city || draft?.destName, destCountry: chosen?.country,
    });
    openPartner(url || target);
  };

  // Founder-only (?stripetest=1): POST /package/checkout with the draft's
  // server-side package_orders row id (sid, from compose's data.sid) → { url },
  // Stripe's hosted payment page, opened exactly like the hotel checkout does
  // (openPartnerAndWait — native browser sheet; a new tab on web).
  const testCheckout = async () => {
    if (!sid || testBusy) return;
    setTestBusy(true); setTestErr(null);
    const { data, error } = await callWorker(ROUTE.packageCheckout, { orderId: sid });
    if (data?.url) {
      await openPartnerAndWait(data.url);
    } else {
      setTestErr(data?.reason || data?.error || (error ? "network" : "error"));
    }
    setTestBusy(false);
  };

  // ONE caveat list (Wave 0 #6). The worker sends draft.caveats; a draft from
  // before that field is rebuilt from the legacy fields, so nothing that showed
  // before goes quiet. Severity picks the register; `serious` also gates money.
  const caveats = (() => {
    if (!draft) return [];
    if (Array.isArray(draft.caveats)) return draft.caveats.filter((c) => c && typeof c.text === "string" && c.text);
    const out = [];
    if (Number(draft.qualityBar?.pass) === 3) out.push({ severity: "caution", code: "quality_bar_missed", text: "Few top-rated hotels here for these dates — showing the best available" });
    if (typeof draft.stayAreaDropped === "string" && draft.stayAreaDropped) out.push({ severity: "caution", code: "stay_area_dropped", text: `Couldn’t place ${draft.stayAreaDropped} on the map — showing the whole city` });
    if (draft.stayArea?.name && draft.stayArea.radiusKm == null) out.push({ severity: "caution", code: "stay_area_widened", text: `Few hotels in ${draft.stayArea.name} for these dates — showing the whole city, distances measured from ${draft.stayArea.name}` });
    return out;
  })();
  const seriousCaveats = caveats.filter((c) => c.severity === "serious");
  // Wraps every money-moving action: serious caveats → the sheet, once per draft.
  const gate = (proceed) => {
    if (seriousCaveats.length && ackSidRef.current !== (sid || "draft")) { setStillBook({ items: seriousCaveats, proceed }); return; }
    proceed();
  };
  const partyLine = draft
    ? [
        `${fmtDate(draft.checkin)} → ${fmtDate(draft.checkout)}`,
        `${draft.nights} night${draft.nights === 1 ? "" : "s"}`,
        `${draft.party?.adults ?? adults} adult${(draft.party?.adults ?? adults) === 1 ? "" : "s"}`
          + ((draft.party?.children ?? 0) > 0 ? ` · ${draft.party.children} child${draft.party.children === 1 ? "" : "ren"}` : ""),
      ].join(" · ")
    : "";

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F1EADF" }}>
          <ArrowLeft size={18} color={INK} strokeWidth={2.2} />
        </button>
        <div className="min-w-0">
          <div style={{ fontFamily: MONO, color: SUB, fontSize: fs(10.5), letterSpacing: "0.1em" }}>SMART PACKAGE</div>
          <h1 style={{ fontFamily: SERIF, fontSize: fs(26), color: INK, lineHeight: 1.05 }}>Where are we going?</h1>
        </div>
      </div>

      <div className="px-4 pt-2 pb-10" style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* ============ S1 — INPUTS ============ */}
        {/* Destination */}
        {dest ? (
          <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] mb-3" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
            <MapPin size={18} color={ACCENT} strokeWidth={2} className="flex-none" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: SUB }}>Destination</div>
              <div className="font-bold text-[calc(14.5px*var(--fs))] mt-0.5 truncate" style={{ color: INK }}>{dest.name || dest.city}</div>
              {(dest.city || dest.country) && (
                <div className="font-mono text-[calc(10.5px*var(--fs))] truncate" style={{ color: SUB }}>
                  {[dest.city, dest.country].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <button onClick={() => { setDest(null); setStayAreaSel(""); }} aria-label="Clear destination"
              className="w-8 h-8 rounded-full flex items-center justify-center flex-none" style={{ background: "#F1EADF" }}>
              <X size={15} color={INK} strokeWidth={2.2} />
            </button>
          </div>
        ) : (
          <div className="mb-3">
            <form onSubmit={(e) => { e.preventDefault(); searchDest(); }} className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 rounded-[12px]" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
                <Search size={16} color="#94A3B8" strokeWidth={2} />
                <input value={destQuery} onChange={(e) => setDestQuery(e.target.value)} placeholder="Search a city or destination" autoCapitalize="words"
                  className="flex-1 py-3 bg-transparent text-[calc(14px*var(--fs))]" style={{ color: INK, fontFamily: "inherit", outline: "none" }} />
              </div>
              <button type="submit" disabled={!destQuery.trim() || destSearching}
                className="px-4 rounded-[12px] font-bold text-[calc(13px*var(--fs))]"
                style={{ background: IVORY_2, color: INK, border: `1px solid ${EDGE}`, opacity: (!destQuery.trim() || destSearching) ? 0.6 : 1 }}>
                {destSearching ? "…" : "Search"}
              </button>
            </form>
            {destResults.length > 0 && (
              <div className="mt-2 rounded-[14px] overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
                {destResults.slice(0, 6).map((r, i) => (
                  <button key={r.placeId || i} onClick={() => pickDest(r)} className="w-full text-left px-4 py-3 flex items-center gap-3" style={{ borderTop: i ? "1px solid #F5F0E8" : "none" }}>
                    <MapPin size={15} color={ACCENT} strokeWidth={2} className="flex-none" />
                    <div className="min-w-0">
                      <div className="font-semibold text-[calc(14px*var(--fs))] truncate" style={{ color: INK }}>{r.placeName || r.city}</div>
                      {r.address?.formatted && <div className="text-[calc(11.5px*var(--fs))] truncate" style={{ color: INK2 }}>{r.address.formatted}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {destBroad && (
              <div className="mt-2 rounded-[14px] px-4 py-3" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
                <div className="font-mono text-[calc(10px*var(--fs))] tracking-[0.12em] uppercase" style={{ color: SUB }}>
                  Where in {destBroad.name}?
                </div>
                {destBroad.cities.length ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {destBroad.cities.map((c) => (
                      <button key={c} onClick={() => pickCity(c)} disabled={destSearching}
                        className="px-3 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]"
                        style={{ background: IVORY_2, color: INK, border: `1px solid ${EDGE}`, opacity: destSearching ? 0.6 : 1 }}>
                        {c}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[calc(12px*var(--fs))] mt-1" style={{ color: INK2 }}>Type a city name to price a stay there.</div>
                )}
              </div>
            )}
            {destMsg && !destBroad && (
              <div className="text-[calc(12px*var(--fs))] mt-2 px-1" style={{ color: INK2 }}>{destMsg}</div>
            )}
            <div className="font-mono text-[calc(10px*var(--fs))] mt-1.5 px-1 leading-snug" style={{ color: "#9AA0A6" }}>
              Dream search on Home can also find a destination and start a package here
            </div>
          </div>
        )}

        {/* When — FindAHotel's one-calendar pattern */}
        <button onClick={() => setDateOpen(true)} className="w-full rounded-[16px] px-4 py-3.5 mb-3 text-left flex items-center gap-3" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
          <CalendarIcon size={18} color={ACCENT} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: SUB }}>Dates</div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] mt-0.5 truncate" style={{ color: INK }}>
              {range?.from
                ? (range?.to ? `${format(range.from, "EEE, MMM d")} → ${format(range.to, "EEE, MMM d")}` : `${format(range.from, "EEE, MMM d")} → …`)
                : "Pick your dates"}
            </div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: ACCENT_BG, color: ACCENT }}>{range?.from ? "Edit" : "Pick"}</span>
        </button>

        {/* Who — adults/children steppers, per-child ages when any, rooms */}
        <div className="rounded-[16px] px-4 mb-3" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
          <Stepper label="Adults" value={adults} setValue={setAdults} min={1} max={8} />
          <div className="h-px" style={{ background: "#F5F0E8" }} />
          <Stepper label="Children" value={children} setValue={setChildren} min={0} max={6} />
          {children > 0 && (
            <div className="pb-3">
              <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: SUB }}>
                Children&apos;s ages
              </div>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {Array.from({ length: children }, (_, i) => (
                  <label key={i} className="flex items-center gap-1.5">
                    <span className="font-mono text-[calc(10px*var(--fs))]" style={{ color: INK2 }}>#{i + 1}</span>
                    <select
                      value={childAges[i] ?? 8}
                      onChange={(e) => setChildAges((prev) => { const next = [...prev]; next[i] = Number(e.target.value); return next; })}
                      aria-label={`Age of child ${i + 1}`}
                      className="font-mono font-semibold text-[calc(12px*var(--fs))] rounded-[10px] px-2 py-1.5"
                      style={{ color: INK, background: IVORY_2, border: `1px solid ${EDGE}` }}>
                      {Array.from({ length: 18 }, (_, a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="text-[calc(10.5px*var(--fs))] mt-1.5 leading-snug" style={{ color: INK2 }}>
                So we pick baby-friendly flights and the right rooms.
              </div>
            </div>
          )}
          <div className="h-px" style={{ background: "#F5F0E8" }} />
          <Stepper label="Rooms" value={rooms} setValue={setRooms} min={1} max={Math.min(adults, 4)} />
          <div className="text-[calc(10.5px*var(--fs))] -mt-1 pb-3 leading-snug" style={{ color: INK2 }}>
            Pick the rooms your group actually needs.
          </div>
        </div>

        {/* Optional interest → the draft's tour picks */}
        <div className="flex items-center gap-2 px-3 rounded-[12px] mb-4" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
          <Search size={16} color="#94A3B8" strokeWidth={2} />
          <input value={interest} onChange={(e) => setInterest(e.target.value)} maxLength={80}
            placeholder="What do you want to do? (optional)" autoCapitalize="sentences"
            className="flex-1 py-3 bg-transparent text-[calc(14px*var(--fs))]" style={{ color: INK, fontFamily: "inherit", outline: "none" }} />
        </div>

        {/* Compose — the surface's ONE teal until a draft (or fail card) shows;
            then it demotes to quiet ivory so the result owns the primary. */}
        <button onClick={compose} disabled={!canCompose || composing}
          className="w-full py-4 rounded-[16px] font-bold text-[calc(16px*var(--fs))] flex items-center justify-center"
          style={hasResult
            ? { background: "#FFFFFF", color: INK, border: `1px solid ${EDGE}`, opacity: (!canCompose || composing) ? 0.6 : 1 }
            : { background: ACCENT, color: "#FFFFFF", opacity: (!canCompose || composing) ? 0.6 : 1 }}>
          {composing ? "Composing…" : hasResult ? "Compose again" : "Compose my package"}
        </button>
        {!canCompose && !composing && (
          <div className="text-center text-[calc(12px*var(--fs))] mt-2" style={{ color: INK2 }}>
            {!hasCoords && !typedDest ? "Type a destination to compose." : "Pick check-in and check-out dates."}
          </div>
        )}

        {/* ============ S2 — the draft (skeleton while composing) ============ */}
        {composing && <DraftSkeleton />}

        {/* ============ S3 — designed empty / fail ============ */}
        {fail && !composing && (
          <div className="mt-6">
            {fail.reason === "no_hotels" ? (
              <FinderEmptyState
                icon={BedDouble}
                title="No bookable hotels for those dates"
                reason={`Nothing bookable in-app for ${checkin && checkout ? `${fmtDate(checkin)} → ${fmtDate(checkout)}` : "those dates"} — different dates often open up rates`}
                actionLabel="Change dates"
                onAction={() => { setFail(null); setDateOpen(true); }}
                secondaryLabel="Try again"
                onSecondary={compose}
              />
            ) : (
              <FinderEmptyState
                icon={CloudOff}
                title="Couldn't compose your package"
                reason="The pricing service didn't answer — check your connection"
                actionLabel="Try again"
                onAction={compose}
              />
            )}
          </div>
        )}

        {/* data-sid: the server-side package_orders row this draft is priced
            under — carried for debugging and the future booked-status hookup. */}
        {draft && !composing && (
          <div className="mt-6" ref={resultRef} data-sid={sid || undefined} style={{ scrollMarginTop: 12 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: fs(24), color: INK, lineHeight: 1.1 }}>
              Your {draft.destName || dest?.name || "trip"} trip
              {/* "staying in" only when the pool really came from the area
                  (radiusKm set); radiusKm null = the area held too few hotels
                  and the worker widened to the whole city. */}
              {draft.stayArea?.name && draft.stayArea.radiusKm != null ? (
                <span style={{ fontFamily: MONO, fontSize: fs(11), color: SUB, letterSpacing: "0.04em" }}> · staying in {draft.stayArea.name}</span>
              ) : null}
            </h2>
            <div className="font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] mt-1" style={{ color: SUB }}>
              {partyLine}{draft.env === "sandbox" ? " · SANDBOX" : ""}
            </div>
            {/* CAVEATS — one list, one register per severity: info quiet, caution
                amber, serious stamp-red (plus the Still-book sheet before money moves). */}
            {caveats.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {caveats.map((c, i) => (
                  <div key={c.code || i} className="font-mono text-[calc(11px*var(--fs))] leading-snug" style={{ color: c.severity === "serious" ? RUST : c.severity === "caution" ? AMBER : SUB }}>
                    {c.text}{c.source ? <span style={{ opacity: 0.7 }}> · {c.source}</span> : null}
                  </div>
                ))}
              </div>
            )}

            {/* KNOW BEFORE YOU GO — additive intel; absent renders nothing */}
            <IntelCard intel={extra?.intel} />

            {/* WHERE IN <CITY>? — the draft's stay areas as chips. "Anywhere" is
                the default; a tap recomposes around that area (stamp ring =
                the selection; never a second teal). Self-hides without areas. */}
            {stayAreas.length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: SUB }}>
                  Where in {draft.destName || dest?.name || "the city"}?
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[{ name: "", label: "Anywhere" }, ...stayAreas.map((a) => ({ name: a.name, label: a.name, why: a.why }))].map((c) => {
                    const on = c.name === stayAreaSel;
                    return (
                      <button key={c.name || "__any"} onClick={() => pickArea(c.name)} aria-pressed={on} disabled={composing}
                        className="px-3 py-1.5 rounded-full font-semibold text-[calc(12.5px*var(--fs))]"
                        style={{ background: on ? "#FFFFFF" : IVORY_2, color: INK, border: `1px solid ${EDGE}`, boxShadow: on ? `0 0 0 2px ${STAMP}` : "none" }}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const why = stayAreas.find((a) => a.name === stayAreaSel)?.why;
                  return typeof why === "string" && why.trim() ? (
                    <div className="font-mono text-[calc(10px*var(--fs))] mt-1.5 px-1 leading-snug" style={{ color: SUB }}>{why}</div>
                  ) : null;
                })()}
              </div>
            )}

            {/* THE TWO CHOICES — exactly what the draft returned, the first pre-selected */}
            <div className={`grid gap-2.5 mt-4 ${choices.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {choices.map((h, i) => (
                <HotelChoiceCard
                  key={h.id || h.hotelId || i}
                  choice={h}
                  selected={i === selIdx}
                  onSelect={() => selectChoice(i)}
                  onOpenPhotos={(idx) => openChoicePhotos(i, idx)}
                  onOpenRooms={() => openRooms(i)}
                  selRate={selRateByChoice[i] || null}
                  currency={draft.currency}
                  nights={draft.nights}
                  roleLabel={ROLE_LABEL[h.role] || "OPTION"}
                  distanceFrom={draft.stayArea?.name || undefined}
                />
              ))}
            </div>

            {/* QUALITY BAR — which pass the pair came from. Passes 1–2 state the
                bar in the quiet mono register; pass 3 is the honest amber line. */}
            {draft.qualityBar && (() => {
              const qb = draft.qualityBar;
              const pass = Number(qb.pass);
              const city = draft.destName || dest?.name || "this city";
              // The pool's true scope: the stay area's ring when the search was
              // re-centred there, else the whole destination.
              const scope = draft.stayArea?.name && draft.stayArea.radiusKm != null ? `near ${draft.stayArea.name}` : `in ${city}`;
              const stars = Number.isFinite(Number(qb.minStars)) ? Number(qb.minStars) : (pass === 2 ? 3 : 4);
              const rating = Number.isFinite(Number(qb.minRating)) ? Number(qb.minRating).toFixed(1) : (pass === 2 ? "8.0" : "8.5");
              if (pass === 3) return null;   // said once, in the caveats list at the top
              if (pass === 1) {
                return (
                  <div className="font-mono text-[calc(10px*var(--fs))] mt-2.5 px-1 leading-snug" style={{ color: SUB }}>
                    {choices.length > 1 ? "Both drawn" : "Drawn"} from {stars}★+ hotels scoring {rating}+ {scope} · supplier ratings
                  </div>
                );
              }
              if (pass === 2) {
                return (
                  <div className="font-mono text-[calc(10px*var(--fs))] mt-2.5 px-1 leading-snug" style={{ color: SUB }}>
                    {stars}★+ hotels scoring {rating}+ {scope} · supplier ratings
                  </div>
                );
              }
              return null;
            })()}

            {/* HONEST NOTES — FindAHotel's dropped-filters register: one quiet
                amber mono line per note, only when the worker sent one. */}
            {/* Notes describe the SELECTED hotel: per-choice notes when the worker
                sent them, else the legacy draft-level note (first choice). */}
            {(chosen && "acNote" in chosen ? chosen.acNote : extra?.acNote) && (
              <div className="font-mono text-[calc(11px*var(--fs))] mt-3 px-1 leading-snug" style={{ color: AMBER }}>{chosen && "acNote" in chosen ? chosen.acNote : extra.acNote}</div>
            )}
            {/* Once the traveler has picked a breakfast-included rate, the
                base-rate breakfast note is no longer the story. */}
            {!selRate?.breakfast && (chosen && "breakfastNote" in chosen ? chosen.breakfastNote : extra?.breakfastNote) && (
              <div className="font-mono text-[calc(11px*var(--fs))] mt-2 px-1 leading-snug" style={{ color: AMBER }}>{chosen && "breakfastNote" in chosen ? chosen.breakfastNote : extra.breakfastNote}</div>
            )}

            {/* WHAT YOU'LL SEE — additive attractions rail. Tapping a card is a
                local pick (stamp-red ring + check, the hotel-choice pattern);
                nothing books from these cards in Wave A. */}
            {attractions.length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: SUB }}>
                  What you&apos;ll see
                </div>
                <div className="flex gap-2.5 mt-2 overflow-x-auto pb-1.5" style={{ WebkitOverflowScrolling: "touch" }}>
                  {attractions.map((a, i) => {
                    const k = attrKey(a, i);
                    const selected = !!picks[k];
                    const mi = Number(a?.mi);
                    return (
                      <div key={k} role="button" tabIndex={0} aria-pressed={selected}
                        onClick={() => togglePick(k)}
                        onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePick(k); } }}
                        className="relative flex-none rounded-2xl overflow-hidden"
                        style={{ width: 150, background: "#FFFFFF", border: `1px solid ${EDGE}`, boxShadow: selected ? `0 0 0 2px ${STAMP}` : "none", cursor: "pointer" }}>
                        <AttractionThumb photoUrl={a?.photoUrl} name={a?.name} />
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: STAMP }}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </div>
                        )}
                        <div className="px-2.5 pt-2 pb-2.5">
                          <div className="leading-snug" style={{ fontFamily: SERIF, fontSize: fs(14), color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {a?.name}
                          </div>
                          {Number.isFinite(mi) && (
                            <div className="font-mono text-[calc(9.5px*var(--fs))] mt-1" style={{ color: SUB }}>
                              ~{mi >= 10 ? Math.round(mi) : Math.round(mi * 10) / 10} mi away
                            </div>
                          )}
                          {/* Real supplier price when the worker matched a tour
                              (tourPrice/tourCurrency are additive — absent on
                              old workers, and the card renders as before). */}
                          {Number.isFinite(Number(a?.tourPrice)) && Number(a.tourPrice) > 0 && a?.tourCurrency ? (
                            <div className="font-mono font-semibold text-[calc(10px*var(--fs))] mt-1" style={{ color: INK }}>
                              from {money(Number(a.tourPrice), a.tourCurrency)}
                            </div>
                          ) : null}
                          {a?.ticketedHint && (
                            <div className="flex items-center justify-between gap-1 mt-1">
                              <span className="font-mono text-[calc(9px*var(--fs))] uppercase tracking-[0.08em]" style={{ color: SUB }}>tours available</span>
                              <button onClick={(e) => { e.stopPropagation(); openAttractionTours(a); }}
                                className="font-mono font-semibold underline flex-none text-[calc(9.5px*var(--fs))]"
                                style={{ color: SUB, textUnderlineOffset: 2 }}>
                                See tours
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* THINGS TO DO — booked separately, honest per-partner labels */}
            {(draft.tours?.length > 0 || draft.event) && (
              <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
                <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold px-4 pt-3.5 pb-1" style={{ color: SUB }}>
                  Things to do
                </div>
                {(draft.tours || []).map((t, i) => (
                  <button key={t.code || i} onClick={() => openTour(t)} className="w-full text-left px-4 py-3 flex items-center gap-3" style={{ borderTop: i ? "1px solid #F5F0E8" : "none" }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[calc(13.5px*var(--fs))] leading-snug" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</div>
                      <div className="font-mono text-[calc(10px*var(--fs))] mt-0.5" style={{ color: SUB }}>
                        {[t.duration, t.freeCancellation ? "free cancellation" : null].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex-none text-right">
                      <div className="font-mono font-bold text-[calc(12.5px*var(--fs))]" style={{ color: INK }}>{money(t.price, t.currency)}</div>
                      <div className="font-mono text-[calc(9px*var(--fs))] uppercase tracking-[0.08em]" style={{ color: SUB }}>per Viator</div>
                    </div>
                  </button>
                ))}
                {draft.event && (
                  <button onClick={() => openEvent(draft.event)} className="w-full text-left px-4 py-3 flex items-center gap-3" style={{ borderTop: draft.tours?.length ? "1px solid #F5F0E8" : "none" }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[calc(9px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: STAMP }}>
                        {draft.event.date === todayIso ? "Tonight" : fmtDate(draft.event.date)}
                      </div>
                      <div className="font-semibold text-[calc(13.5px*var(--fs))] leading-snug mt-0.5" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{draft.event.name}</div>
                      {draft.event.venue && <div className="font-mono text-[calc(10px*var(--fs))] mt-0.5 truncate" style={{ color: SUB }}>{draft.event.venue}</div>}
                    </div>
                    <div className="flex-none text-right">
                      <div className="font-mono font-bold text-[calc(12.5px*var(--fs))]" style={{ color: INK }}>from {money(draft.event.fromPrice, draft.event.currency)}</div>
                      <div className="font-mono text-[calc(9px*var(--fs))] uppercase tracking-[0.08em]" style={{ color: SUB }}>per Ticketmaster</div>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* YOUR PICKS — the local "What you'll see" selections, honest
                about what the distance figures meant */}
            {pickedNames.length > 0 && (
              <div className="font-mono text-[calc(10.5px*var(--fs))] mt-3 px-1 leading-snug" style={{ color: SUB }}>
                Your picks: {pickedNames.join(" · ")} — distances are from the city center
              </div>
            )}

            {/* RUNNING ESTIMATE — the live figure: selected hotel's stay total
                plus only the picked attractions whose supplier tour price is in
                the hotel's own currency. The inclusion line says exactly what
                is inside; everything else is "priced at booking". Reacts
                instantly to the hotel-choice ring and every pick toggle. */}
            {chosen && (
              <div className="mt-4 rounded-2xl px-4 py-4" style={{ background: IVORY_2, border: `1px solid ${EDGE}` }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: SUB }}>Trip estimate</span>
                  <span style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, fontVariantNumeric: "tabular-nums" }}>
                    {estDisplay ? `≈ ${estDisplay}` : ""}
                  </span>
                </div>
                <div className="font-mono text-[calc(10.5px*var(--fs))] mt-1.5 leading-snug" style={{ color: SUB }}>
                  {inclusionLine}
                </div>
                {/* No payment-plan / split line on the composer — it's the
                    decision surface (real total wanted), and no payment option
                    exists at checkout yet. The full "Flexible payment options"
                    presentation debuts when our own Klarna checkout is live. */}
              </div>
            )}

            {/* PRIMARY — the one teal: hand the selected choice to the existing checkout */}
            {chosen && (
              <>
                <button onClick={() => gate(() => setBookSheet(chosen))}
                  className="w-full py-4 rounded-[16px] font-bold text-white text-[calc(16px*var(--fs))] mt-4"
                  style={{ background: ACCENT }}>
                  Book this hotel
                </button>
                <div className="font-mono text-[calc(10px*var(--fs))] text-center mt-2" style={{ color: SUB }}>
                  {selRate ? "Secure checkout comes next" : "Room choice and secure checkout come next."}
                </div>
                {/* Founder-only Stripe test lane — hidden unless ?stripetest=1;
                    needs sid (the server-side order this draft is priced under). */}
                {stripeTest && sid && (
                  <>
                    <button onClick={() => gate(testCheckout)} disabled={testBusy}
                      className="w-full py-3 rounded-[12px] mt-3 font-mono text-[calc(10px*var(--fs))] tracking-[0.14em] uppercase font-semibold"
                      style={{ background: "#FFFFFF", color: SUB, border: `1px dashed ${EDGE}`, opacity: testBusy ? 0.6 : 1 }}>
                      {testBusy ? "Starting test checkout…" : "Test package checkout · Stripe"}
                    </button>
                    {testErr && (
                      <div className="text-center text-[calc(12px*var(--fs))] mt-2" style={{ color: INK2 }}>
                        Test checkout couldn't start — {testErr === "network" ? "check your connection" : testErr}.
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="font-mono text-[calc(9.5px*var(--fs))] mt-4 px-1 leading-relaxed" style={{ color: "#9AA0A6" }}>
              Prices are live and can change until booked · cancellation terms shown per rate.
            </div>
          </div>
        )}
      </div>

      {/* Date-range calendar — FindAHotel's one-popup pattern */}
      {dateOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setDateOpen(false)}>
          <div className="w-full sm:max-w-sm bg-white rounded-t-[22px] sm:rounded-[22px] p-4 sm:m-4" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 -8px 40px -12px rgba(0,0,0,0.25)" }}>
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="font-bold text-[calc(15px*var(--fs))]" style={{ color: INK }}>Select dates</div>
              <button onClick={() => setRange(undefined)} className="text-[calc(13px*var(--fs))] font-semibold" style={{ color: ACCENT }}>Clear</button>
            </div>
            <div className="text-[calc(12px*var(--fs))] mb-1 px-1" style={{ color: INK2 }}>Tap your check-in, then your check-out.</div>
            <div style={{ "--rdp-accent-color": ACCENT, "--rdp-background-color": ACCENT_BG, display: "flex", justifyContent: "center" }}>
              <DayPicker mode="range" selected={range} onSelect={setRange} numberOfMonths={1} disabled={{ before: todayStart }} />
            </div>
            <button onClick={() => setDateOpen(false)} className="w-full mt-1 py-3 rounded-[14px] font-bold text-white text-[calc(14px*var(--fs))]" style={{ background: ACCENT }}>Done</button>
          </div>
        </div>
      )}

      {/* STILL BOOK? — serious caveats stop the flow once, before money moves. */}
      {stillBook && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(22,17,13,0.55)" }} role="dialog" aria-modal="true" aria-label="Before you book">
          <div className="w-full max-w-md rounded-t-[20px] px-5 pt-5 pb-8" style={{ background: "#FFFCF7" }}>
            <div className="font-mono uppercase tracking-[0.12em] text-[calc(10px*var(--fs))] font-semibold" style={{ color: RUST }}>Before you book</div>
            <div className="mt-1.5" style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, lineHeight: 1.1 }}>Still book?</div>
            <div className="mt-3 flex flex-col gap-2">
              {stillBook.items.map((c, i) => (
                <div key={c.code || i} className="text-[calc(13.5px*var(--fs))] leading-snug" style={{ color: INK }}>
                  {c.text}{c.source ? <span className="font-mono text-[calc(10.5px*var(--fs))]" style={{ color: SUB }}> · {c.source}</span> : null}
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setStillBook(null)} className="flex-1 py-3.5 rounded-[14px] font-semibold text-[calc(14px*var(--fs))]" style={{ background: "#FFFFFF", color: INK, border: `1px solid ${EDGE}` }}>Go back</button>
              <button onClick={() => { ackSidRef.current = sid || "draft"; const proceed = stillBook.proceed; setStillBook(null); proceed(); }} className="flex-1 py-3.5 rounded-[14px] font-semibold text-white text-[calc(14px*var(--fs))]" style={{ background: RUST }}>Still book</button>
            </div>
          </div>
        </div>
      )}

      {/* The existing in-app checkout — the draft choice is a superset of the
          search hotel object (offerId, price, rates[], name, city, …), so it
          hands straight in; the sheet ignores the extra role/stayTotal fields.
          initialOfferId = the room plan picked here (undefined → the sheet's
          own room step / cheapest, exactly as before).
          sid ties this draft to its server-side package_orders row (see compose). */}
      {bookSheet && draft && (
        <HotelBookSheet
          hotel={bookSheet}
          checkin={draft.checkin}
          checkout={draft.checkout}
          adults={draft.party?.adults ?? adults}
          children={draft.party?.children ?? children}
          dest={{ city: bookSheet.city || draft.destName || "", country: bookSheet.country || "" }}
          initialOfferId={selRate?.offerId ?? undefined}
          onClose={() => setBookSheet(null)}
        />
      )}

      {/* ROOM CHOOSER — FilterSheet-hosted; a pick stores the rate for that
          choice and closes. Its photo taps open the same lightbox below. */}
      <RoomChooserSheet
        open={roomSheet != null && !!choices[roomSheet]}
        choice={roomSheet != null ? choices[roomSheet] : null}
        selRate={roomSheet != null ? (selRateByChoice[roomSheet] || null) : null}
        onPick={(rate) => pickRate(roomSheet, rate)}
        onClose={() => setRoomSheet(null)}
        onOpenPhotos={(photos, idx, title) => openRoomPhotos(roomSheet, photos, idx, title)}
        currency={draft?.currency}
        nights={draft?.nights}
      />

      {/* THE ONE LIGHTBOX — hotel gallery or a room's photos; portal at
          z-[9999] so it sits over the room sheet too. */}
      <PhotoLightbox
        photos={photoLb?.photos || []}
        index={photoLb ? photoLb.index : null}
        onClose={() => setPhotoLb(null)}
        onIndexChange={(i) => setPhotoLb((p) => (p ? { ...p, index: i } : p))}
        title={photoLb?.title || ""}
        credit={PHOTO_CREDIT}
      />
    </div>
  );
}
