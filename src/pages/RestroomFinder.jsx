// RestroomFinder: the Powder Room (the new look's iris world, Restrooms.dc.html).
//
// The lavender plate (count, "The nearest restroom", the location with its GPS lead and
// the unit), then the urgent "Nearest open restroom" button, Open now / Free / Accessible
// and the place types; numbered cards with an access plaque; the map with plaque-stepped
// pins, a legend and a bottom sheet.
//
// Honest by design: access reads in words, an icon and a fill step (never colour alone),
// with the worker's confidence word only when it sent one; the planet DB's own toilets
// say "Access unclear". Amenity tags are only what Google or reviews back: toilet paper,
// bidets and squat toilets also come from country norms, so cards leave them out. Open
// words read the place's clock (openState): with no time zone from Google, a verdict only
// in current-location mode. A rating always names Google.
import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/location/LocationContext";
import { useLocation as useRouterLocation } from "react-router-dom";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { openPartner } from "@/lib/openPartner";
import { openStateFor } from "@/lib/openState";
import RestroomAIDetails from "@/components/RestroomAIDetails";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import {
  AlertCircle, ArrowRight, Accessibility, Baby, Check, CircleHelp, Clock, Coffee, Coins, Crosshair, Footprints,
  Fuel, Info, Landmark, Loader2, LocateFixed, MapPin, SearchX, ShoppingBag, Sparkles, Stethoscope, Ticket,
  TrainFront, Trees, X,
} from "lucide-react";
import { WORLD, NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import { WorldChip, ChipRow, ResultLine, WorldNote } from "@/components/finder/FinderControls";
import { WorldCard, worldGrid, NumberMark, FactsLine, WorldTag, TagRow, CardKicker, CardName, QuietRows, ActionRow, WorldSkeleton } from "@/components/finder/FinderCard";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import FinderEmptyState from "@/components/finder/FinderEmptyState";

const W = WORLD.restroom;
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

// ─── PLACE TYPES ────────────────────────────────────────────────────────────
// The second chip row: the worker's venueType ids. One at a time; tapping the chosen
// one again shows every kind ('all').
const VENUE_TYPES = [
  { id: "public", label: "Public", icon: Landmark },
  { id: "transit", label: "Transit", icon: TrainFront },
  { id: "coffee_food", label: "Coffee & food", icon: Coffee },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "medical", label: "Medical", icon: Stethoscope },
  { id: "outdoor", label: "Parks", icon: Trees },
  { id: "fuel", label: "Gas & convenience", icon: Fuel },
];

// ─── ACCESS PLAQUES ─────────────────────────────────────────────────────────
// Stepped by lightness so they read without colour (Restrooms.dc.html L114-118): Free
// solid sage; Customers only honey; Inside a ticketed venue an iris outline; Fee
// required a dashed umber outline; Access unclear plain. Each has its words and icon.
const PLAQUES = W.plaques || {};
const ACCESS = {
  free:           { label: "Free restroom",         icon: Check,       plaque: "free" },
  customers_only: { label: "Customers only",        icon: ShoppingBag, plaque: "customers" },
  ticketed_entry: { label: "Inside ticketed venue", icon: Ticket,      plaque: "ticketed" },
  fee_required:   { label: "Fee required",          icon: Coins,       plaque: "fee" },
  unknown:        { label: "Access unclear",        icon: CircleHelp,  plaque: "unclear" },
};
// The planet DB's toilets carry no access rule: they read "Access unclear".
const accessOf = (r) => (r.source === "owned" ? "unknown" : (ACCESS[r.accessType] ? r.accessType : "unknown"));
// The worker's confidence in the access (rrDeriveConfidence), only when it sent one.
const CONFIDENCE = { high: "Confirmed", medium: "Likely", low: "Possible" };
const confidenceOf = (r) => (r.source === "owned" ? null : CONFIDENCE[r.confidence] || null);
const plaqueStyle = (key) => {
  const p = PLAQUES[ACCESS[key].plaque] || {};
  return { bg: p.bg || NEUTRAL.white, ink: p.ink || NEUTRAL.ink3, border: p.border ? `1px ${p.borderStyle || "solid"} ${p.border}` : "0" };
};

function Plaque({ r, top = 12, inline = false }) {
  const key = accessOf(r);
  const a = ACCESS[key];
  const p = plaqueStyle(key);
  const conf = confidenceOf(r);
  const Icon = a.icon;
  return (
    <span style={{
      ...(inline ? { position: "relative" } : { position: "absolute", top, right: 12, maxWidth: "calc(100% - 92px)" }),
      display: "inline-flex", minHeight: 26, boxSizing: "border-box", border: p.border, borderRadius: 6, overflow: "hidden",
      background: NEUTRAL.white, boxShadow: inline ? "none" : "0 1px 3px rgba(22,17,13,.10)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, padding: "3px 8px", background: p.bg, color: p.ink, fontSize: fs(12), fontWeight: 600, lineHeight: 1.2 }}>
        <Icon size={12} color={p.ink} strokeWidth={2.6} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</span>
      </span>
      {conf && (
        <span style={{ display: "flex", alignItems: "center", padding: "0 7px", background: NEUTRAL.white, color: conf === "Possible" ? (W.confidence?.possible || NEUTRAL.ink3) : (W.confidence?.likely || NEUTRAL.open), fontFamily: MONO, fontSize: fs(9.5), fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {conf}
        </span>
      )}
    </span>
  );
}

// ─── AMENITIES ──────────────────────────────────────────────────────────────
// At most three tags in the world's wash, each backed by Google or the reviews: Google's
// wheelchair-accessible entrance, and what reviews say about cleanliness, families and
// stairs. Toilet paper, bidets and squat toilets are left out: the worker fills them from
// country norms as well as reviews, and a card never states a norm as a fact.
function amenitiesOf(r) {
  const p = r.properties || {};
  const out = [];
  if (p.isAccessible) out.push({ key: "accessible", label: "Accessible", icon: Accessibility });
  if (p.isClean) out.push({ key: "clean", label: "Clean", icon: Sparkles });
  if (p.hasFamily) out.push({ key: "family", label: "Family-friendly", icon: Baby });
  if (r.reachability === "moderate") out.push({ key: "stairs", label: "May have stairs", icon: Footprints });
  return out.slice(0, 3);
}

// Open now: the hours decide when the place's clock is known; otherwise Google's flag
// from the search, or "open 24 hours" from the reviews.
function isOpenNow(r, isLocal) {
  const os = openStateFor(r, { isLocal });
  if (os.status === "open") return true;
  if (os.status === "closed") return false;
  return r.isOpen === true || r.properties?.is24Hours === true;
}

const nameOf = (r) => r.name || r.displayName?.text || "Restroom";
const photosOf = (list) => (list || []).map((p) => (typeof p === "string" ? p : (p?.url || p?.full || p?.thumbnail || null))).filter(Boolean);

function MoreRow({ label, children }) {
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${W.line}` }}>
      <div style={{ marginBottom: 4, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".12em", textTransform: "uppercase", color: W.iconInk }}>{label}</div>
      <div style={{ fontSize: fs(13.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>{children}</div>
    </div>
  );
}

// The week's hours, Monday first; today is the place's own day, marked only when known.
function WeekLines({ week }) {
  return (
    <dl style={{ margin: 0 }}>
      {week.map((d) => (
        <div key={d.day} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0", fontWeight: d.today ? 600 : 400, color: d.today ? W.ink : NEUTRAL.ink2 }}>
          <dt>{d.day}</dt>
          <dd style={{ margin: 0, textAlign: "right", color: /^closed$/i.test(String(d.text || "")) ? NEUTRAL.stamp : undefined }}>{d.text || "Not listed"}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── RESTROOM CARD (Restrooms.dc.html L110-139) ─────────────────────────────
// Numbered; a 16:9 photo or the tile strip with the toilet; the access plaque top right.
// Then the kind (mono), the serif name, Say it / Translate, the facts line (open words,
// distance, a Google rating), the smart note, the address, at most three amenity tags,
// the AI details, and Directions, Map, Call and More (the week's hours and the website).
function RestroomCard({ r, n, isLocal, formatDistance, onDirections, onShowOnMap, highlighted, cardRef }) {
  const [enriched, setEnriched] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [gallery, setGallery] = useState({ open: false, idx: 0 });
  const moreId = useId();

  // A planet-DB restroom fetches its real photo and hours when the card mounts, so the
  // list shows photos without a tap. Owned→Google resolves once and is cached.
  useEffect(() => {
    if (enriched || r.source !== "owned") return;
    callWorker("places/enrich-owned", { id: r.id || r.placeId, name: r.name, lat: r.lat, lng: r.lng, maxPhotos: 2 })
      .then(({ data }) => { if (data && data.matched) setEnriched(data); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const name = nameOf(r);
  const photos = photosOf(enriched?.photos?.length ? enriched.photos : r.photos);
  const hoursRow = enriched?.hours?.weekdayDescriptions?.length ? { ...r, weekdayDescriptions: enriched.hours.weekdayDescriptions } : r;
  const os = openStateFor(hoursRow, { isLocal });
  const dist = Number.isFinite(r.distanceMiles) ? formatDistance(r.distanceMiles) : null;
  const rating = r.rating && r.source !== "owned" ? { rating: r.rating, source: "google" } : null;
  const kicker = r.venueLabel || (r.source === "owned" ? "Public restroom" : null);
  const tags = amenitiesOf(r);
  const phone = r.nationalPhoneNumber || r.internationalPhoneNumber || null;
  const website = r.websiteUri || r.website || null;
  const week = (os.week || []).some((d) => d.text) ? os.week : [];
  const hasMore = week.length > 0 || !!website;
  // The smart note, unless the plaque already says it.
  const note = r.smartNote && r.smartNote !== ACCESS[accessOf(r)].label ? r.smartNote : null;

  return (
    <WorldCard world="restroom" as="li" ref={cardRef} style={highlighted ? { boxShadow: `0 0 0 3px ${W.ink}, ${W.cardShadow}` } : undefined}>
      <PhotoOrIcon world="restroom" photos={photos} alt={name} onClick={photos.length ? (i) => setGallery({ open: true, idx: Number.isFinite(i) ? i : 0 }) : undefined}>
        <NumberMark n={n} world="restroom" place={photos.length ? "corner" : "middle"} />
        <Plaque r={r} top={photos.length ? 12 : 23} />
      </PhotoOrIcon>
      <div style={{ padding: "12px 16px 16px" }}>
        {kicker && <CardKicker world="restroom">{kicker}</CardKicker>}
        <CardName world="restroom" as="h3">{name}</CardName>
        <div style={{ marginTop: 2 }}><NameLanguageHelp placeId={r.placeId || r.id} name={name} world="restroom" /></div>
        <FactsLine world="restroom" open={os} items={[dist, rating]} style={{ marginTop: 4 }} />
        {note && (
          <p style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
            <Info size={15} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{note}</span>
          </p>
        )}
        {r.formattedAddress && <p style={{ margin: "4px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink3 }}>{r.formattedAddress}</p>}
        {tags.length > 0 && (
          <TagRow max={3} style={{ marginTop: 10 }}>
            {tags.map((t) => <WorldTag key={t.key} world="restroom" tone="wash" icon={t.icon}>{t.label}</WorldTag>)}
          </TagRow>
        )}
        <QuietRows world="restroom" style={{ marginTop: 12 }}>
          <RestroomAIDetails world="restroom" placeId={r.placeId || r.id} placeName={name} venueLabel={r.venueLabel} venueCategory={r.venueCategory} accessType={r.accessType} />
        </QuietRows>
        <ActionRow world="restroom" name={name} onDirections={() => onDirections(r)} onMap={onShowOnMap} phone={phone}
          onMore={hasMore ? () => setExpanded((e) => !e) : undefined} moreIcon moreExpanded={hasMore ? expanded : undefined} moreControls={hasMore ? moreId : undefined}
          style={{ marginTop: 4 }} />
        {hasMore && expanded && (
          <div id={moreId} style={{ marginTop: 12 }}>
            {week.length > 0 && <MoreRow label="Hours"><WeekLines week={week} /></MoreRow>}
            {website && (
              <MoreRow label="Website">
                <button type="button" onClick={() => openPartner(website)}
                  style={{ display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-12px 0", padding: 0, background: "transparent", border: 0, fontFamily: "inherit", fontSize: "inherit", color: W.ink, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer", overflowWrap: "anywhere", textAlign: "left" }}>
                  {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </button>
              </MoreRow>
            )}
          </div>
        )}
      </div>
      <PhotoGalleryModal photos={photos} initialIndex={gallery.idx} isOpen={gallery.open} onClose={() => setGallery({ open: false, idx: 0 })} />
    </WorldCard>
  );
}

// ─── MAP ────────────────────────────────────────────────────────────────────
// A pin in the plaque's step: the card's serif numeral on the plaque's fill and border.
function pinHtml(r, n, active) {
  const p = plaqueStyle(accessOf(r));
  const sz = active ? 36 : 30;
  const border = p.border === "0" ? `1px solid ${W.line}` : p.border.replace(/^1px/, active ? "3px" : "2px");
  return `<div style="width:${sz}px;height:${sz}px;box-sizing:border-box;border-radius:50%;background:${p.bg};border:${border};box-shadow:0 3px 10px ${rgba(W.ink, 0.35)};display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:${active ? 18 : 16}px;line-height:1;color:${p.ink};">${n}</div>`;
}

// The map's bottom sheet in iris (drag down to close, up to see more): the kind and
// name, the plaque, the facts and tags; when open, the address and the smart note;
// Directions and Call.
function MapSheet({ r, n, expanded, onExpand, onClose, onDirections, formatDistance, isLocal }) {
  const name = nameOf(r);
  const os = openStateFor(r, { isLocal });
  const dist = Number.isFinite(r.distanceMiles) ? formatDistance(r.distanceMiles) : null;
  const rating = r.rating && r.source !== "owned" ? { rating: r.rating, source: "google" } : null;
  const tags = amenitiesOf(r);
  const phone = r.nationalPhoneNumber || r.internationalPhoneNumber || null;
  const note = r.smartNote && r.smartNote !== ACCESS[accessOf(r)].label ? r.smartNote : null;
  return (
    <motion.div
      role="dialog" aria-label={`${n}. ${name}`}
      initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
      drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}
      onDragEnd={(e, info) => {
        if (info.offset.y > 100) onClose();
        else if (info.offset.y < -50) onExpand(true);
        else if (info.offset.y > 50) onExpand(false);
      }}
      style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1001, maxHeight: expanded ? "78%" : "46%", overflow: "hidden", background: NEUTRAL.white, borderTop: `1px solid ${W.line}`, borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 30px rgba(22,17,13,.15)", transition: "max-height .3s ease" }}
    >
      <button type="button" onClick={() => onExpand(!expanded)} aria-label={expanded ? "Show less" : "Show more"} aria-expanded={expanded}
        style={{ display: "flex", justifyContent: "center", width: "100%", minHeight: 28, padding: "10px 0 6px", background: "transparent", border: 0, cursor: "pointer" }}>
        <span aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, background: W.line }} />
      </button>
      <button type="button" onClick={onClose} aria-label="Close"
        style={{ position: "absolute", top: 6, right: 8, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, background: "transparent", border: 0, cursor: "pointer" }}>
        <X size={20} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" />
      </button>
      <div style={{ padding: "0 16px 18px", overflowY: expanded ? "auto" : "hidden", maxHeight: "calc(100% - 44px)" }}>
        {(r.venueLabel || r.source === "owned") && <CardKicker world="restroom">{r.venueLabel || "Public restroom"}</CardKicker>}
        <div style={{ paddingRight: 36, marginTop: 2, fontFamily: SERIF, fontSize: fs(22), lineHeight: 1.12, color: NEUTRAL.ink }}>{n}. {name}</div>
        <div style={{ marginTop: 8 }}><Plaque r={r} inline /></div>
        <FactsLine world="restroom" open={os} items={[dist, rating]} style={{ marginTop: 8 }} />
        {tags.length > 0 && (
          <TagRow max={3} style={{ marginTop: 8 }}>
            {tags.map((t) => <WorldTag key={t.key} world="restroom" tone="wash" icon={t.icon}>{t.label}</WorldTag>)}
          </TagRow>
        )}
        {expanded && r.formattedAddress && <p style={{ margin: "10px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink3 }}>{r.formattedAddress}</p>}
        {expanded && note && <p style={{ margin: "6px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>{note}</p>}
        <ActionRow world="restroom" name={name} onDirections={onDirections} phone={phone} style={{ marginTop: 12 }} />
      </div>
    </motion.div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function RestroomFinderPage() {
  const [restrooms, setRestrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // phase 2 (the full list) after the quick 3
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [refreshTick, setRefreshTick] = useState(0);
  const forceNextRef = useRef(false);
  const autoExpandRef = useRef(false); // set: a 5 mi search that finds nothing usable widens to 10 mi once
  const handleRefresh = () => { forceNextRef.current = true; setRefreshTick((t) => t + 1); };
  const [venueType, setVenueType] = useState("all");
  // "public restroom", "restroom in the station" from Search → that place type.
  const presetVenue = useRouterLocation().state?.presetVenueType;
  useEffect(() => {
    if (presetVenue && VENUE_TYPES.some((v) => v.id === presetVenue)) setVenueType(presetVenue);
  }, [presetVenue]);
  const [radius, setRadius] = useState(25); // a wide net, nearest first; no radius control
  const [openOnly, setOpenOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [accessOnly, setAccessOnly] = useState(false);
  const [widened, setWidened] = useState(false); // the urgent search widened from 5 to 10 miles
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [directionsRR, setDirectionsRR] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [activeMapPin, setActiveMapPin] = useState(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const cardRefs = useRef({});
  const mapRef = useRef(null);
  const mapInstRef = useRef(null);
  const markersRef = useRef([]);

  const { activeLocation, switchToCurrentLocation, locationMode } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);
  // The device's clock is the place's clock only in current-location mode.
  const isLocal = locationMode === "current";
  const isTablet = useIsTablet();
  // The fetch reads these without re-running when they change.
  const openOnlyRef = useRef(openOnly); openOnlyRef.current = openOnly;
  const isLocalRef = useRef(isLocal); isLocalRef.current = isLocal;

  // Snap to live GPS: restrooms are urgent ("I need one NOW"). Searches the exact spot
  // at 5 mi and widens to 10 mi once if nothing usable turns up (the fetch below);
  // forceRefresh and the tick make it a fresh "now" search even at the same coords. The
  // urgent button also turns Open now on, so it lists only places open now.
  const handleUseCurrentLocation = async ({ urgent = false } = {}) => {
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      await switchToCurrentLocation();
      if (urgent) { setOpenOnly(true); openOnlyRef.current = true; }
      autoExpandRef.current = true;
      setWidened(false);
      setRadius(5);
      forceNextRef.current = true;
      setRefreshTick((t) => t + 1);
    } catch { /* GPS denied or unavailable: "Change" still picks a place by hand */ }
    finally { setGpsLoading(false); }
  };

  useEffect(() => {
    setRadius(25); // the fixed wide net
    setWidened(false);
  }, [activeLocation?.placeId]);

  // Fetch
  useEffect(() => {
    if (!lat || !lng) { setLoading(false); setLoadingMore(false); return; }
    setLoading(true); setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;
    const radiusMeters = radius * 1609.34;
    let ignore = false;
    let gotQuick = false;
    let widening = false;
    const enrich = (raw) => raw.map((r) => ({
      ...r,
      lat: r.location?.latitude || r.lat || 0,
      lng: r.location?.longitude || r.lng || 0,
    }));

    (async () => {
      // Phase 1: the nearest few, fast (one distance-ranked query), so the first
      // results paint at once. Best effort; phase 2 is the source of truth.
      try {
        const q = await callWorker(ROUTE.getRestroomOwned, {
          latitude: lat, longitude: lng, radius: radiusMeters, maxResults: 3, venueType,
          forceRefresh: force, quick: true,
        });
        const quickRaw = q.data?.restrooms || q.data?.places || [];
        if (!ignore && quickRaw.length) {
          gotQuick = true;
          setRestrooms(enrich(quickRaw));
          setLoading(false);
          setLoadingMore(true);
        }
      } catch { /* the full pass below */ }

      // Phase 2: the full list, which replaces the quick teaser. Google's venues first,
      // the planet DB's public toilets after (thin in some areas).
      try {
        const { data, error: workerError } = await callWorker(ROUTE.getRestroomOwned, {
          latitude: lat, longitude: lng, radius: radiusMeters, maxResults: 30, venueType,
          forceRefresh: force,
        });
        if (ignore) return;
        if (workerError) throw new Error(workerError);
        const raw = enrich(data?.restrooms || data?.places || []);
        // The urgent search needs something usable: open now when it asked for that.
        const usable = openOnlyRef.current ? raw.filter((x) => isOpenNow(x, isLocalRef.current)) : raw;
        if (autoExpandRef.current && radius < 10 && usable.length === 0) {
          // Nothing usable at 5 mi right after the GPS snap: widen to 10 mi, once.
          autoExpandRef.current = false;
          widening = true;
          setWidened(true);
          setRadius(10);
        } else if (raw.length > 0) {
          setRestrooms(raw);
          autoExpandRef.current = false;
        } else if (!gotQuick) {
          autoExpandRef.current = false;
          setRestrooms([]);
          setError(data?.error || `Nothing within ${radius} miles of this location.`);
        }
        // else: the full pass came back empty, but the quick results stay.
      } catch (e) {
        if (!ignore && !gotQuick) setError(`Failed to load: ${e.message}`);
      } finally {
        // A widening search keeps the loading state into its next pass.
        if (!ignore && !widening) { setLoading(false); setLoadingMore(false); }
      }
    })();

    return () => { ignore = true; };
  }, [lat, lng, radius, venueType, refreshTick]);

  const filtered = useMemo(() => {
    let r = [...restrooms];
    if (openOnly) r = r.filter((x) => isOpenNow(x, isLocal));
    if (freeOnly) r = r.filter((x) => accessOf(x) === "free");
    if (accessOnly) r = r.filter((x) => x.properties?.isAccessible);
    return r;
  }, [restrooms, openOnly, freeOnly, accessOnly, isLocal]);
  const anyFilter = openOnly || freeOnly || accessOnly || venueType !== "all";
  const clearFilters = () => { setOpenOnly(false); setFreeOnly(false); setAccessOnly(false); setVenueType("all"); };

  const handleShowOnMap = (index) => {
    setViewMode("map"); setActiveMapPin(index); setSheetExpanded(false);
    setTimeout(() => {
      const r = filtered[index];
      if (mapInstRef.current && r?.lat && r?.lng) mapInstRef.current.setView([r.lat, r.lng], 17);
    }, 300);
  };
  const backToList = () => {
    const i = activeMapPin;
    setViewMode("list");
    setActiveMapPin(null);
    if (i != null) {
      setHighlightIdx(i);
      setTimeout(() => cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      setTimeout(() => setHighlightIdx(null), 2800);
    }
  };

  // Map
  useEffect(() => {
    if (viewMode !== "map" || !mapRef.current || !lat || !lng) return;
    const init = () => {
      if (mapInstRef.current) mapInstRef.current.remove();
      markersRef.current = [];
      const map = window.L.map(mapRef.current).setView([lat, lng], 15);
      // OpenStreetMap's tiles, as on every other map (CARTO's now answer "API key required").
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
      mapInstRef.current = map;
      // Where you are: the blue dot, with its words below it.
      window.L.marker([lat, lng], { icon: window.L.divIcon({ html: '<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>', iconSize: [14, 14], className: "" }) })
        .addTo(map)
        .bindTooltip(`<div style="padding:5px 9px;font-family:inherit;font-weight:600;color:${NEUTRAL.ink};font-size:calc(11px * var(--fs, 1));">You are here</div>`, { permanent: true, direction: "bottom", opacity: 1, offset: [0, 12], className: "gs-user-tooltip", interactive: false });
      // Each restroom: a plaque-stepped pin with its card's number; a tap opens the sheet.
      filtered.forEach((r, i) => {
        if (!r.lat || !r.lng) return;
        const isActive = activeMapPin === i;
        const size = isActive ? 36 : 30;
        const marker = window.L.marker([r.lat, r.lng], { icon: window.L.divIcon({ html: pinHtml(r, i + 1, isActive), iconSize: [size, size], className: "" }), keyboard: true, title: `${i + 1}. ${nameOf(r)}` }).addTo(map);
        marker.on("click", () => { setActiveMapPin(i); setSheetExpanded(false); });
        markersRef.current[i] = marker;
      });
      if (activeMapPin !== null && filtered[activeMapPin]) {
        const r = filtered[activeMapPin];
        map.setView([r.lat, r.lng], 17);
      }
    };
    if (!window.L) {
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link);
      const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = init; document.head.appendChild(s);
    } else init();
    return () => {
      if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
    };
  }, [viewMode, filtered, lat, lng, activeMapPin]);

  const selectedRestroom = activeMapPin !== null ? filtered[activeMapPin] : null;
  const miles = (n) => (unit === "km" ? `${Math.round(n * 1.609)} km` : `${n} miles`);

  // The plate's GPS lead: search from my exact spot, nothing filtered.
  const gpsLead = (
    <button type="button" onClick={() => handleUseCurrentLocation()} disabled={gpsLoading} aria-label="Search from my exact spot"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "0 -12px 0 -14px", padding: 0, background: "transparent", border: 0, cursor: gpsLoading ? "default" : "pointer", flexShrink: 0 }}>
      {gpsLoading
        ? <Loader2 size={16} color={W.plateAccent} strokeWidth={2.2} className="animate-spin" aria-hidden="true" />
        : <Crosshair size={16} color={W.plateAccent} strokeWidth={2.2} aria-hidden="true" />}
    </button>
  );

  return (
    <div className="font-sans" style={{ background: W.paper, minHeight: "100vh", paddingTop: 12 }}>

      {/* ── THE PLATE + CONTROLS (Restrooms.dc.html L28-108): the lavender plate with the
          count, the title, the location (its GPS lead) and the unit; under it the urgent
          button, Open now / Free / Accessible and the place types. ── */}
      <FinderHeader
        world="restroom"
        count={(!lat || !lng || loading || error) ? null : filtered.length}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh restrooms"
        location={{ label: locLabel, onChange: () => setShowLocPicker(true), locating: gpsLoading, lead: gpsLead }}
        unit={{ value: unit, onChange: setUnit }}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
      >
        {/* The urgent button (L54-61): your exact spot, open places only. */}
        <button type="button" onClick={() => handleUseCurrentLocation({ urgent: true })} disabled={gpsLoading} aria-busy={gpsLoading || undefined}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, boxSizing: "border-box", padding: "8px 16px", border: 0, borderRadius: 14, background: W.cta, color: W.ctaInk, textAlign: "left", fontFamily: "inherit", cursor: gpsLoading ? "default" : "pointer", boxShadow: `0 12px 24px -16px ${rgba(W.cta, 0.7)}` }}>
          {gpsLoading
            ? <Loader2 size={20} color={W.ctaInk} strokeWidth={2} className="animate-spin" aria-hidden="true" style={{ flexShrink: 0 }} />
            : <LocateFixed size={20} color={W.ctaInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />}
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: fs(15), fontWeight: 600, lineHeight: 1.2 }}>{gpsLoading ? "Finding you…" : "Nearest open restroom"}</span>
            <span style={{ fontFamily: MONO, fontSize: fs(9.5), fontWeight: 500, lineHeight: 1.3, letterSpacing: ".12em", textTransform: "uppercase", color: rgba("#FFFFFF", 0.82) }}>Nearest now · from your exact spot</span>
          </span>
          <ArrowRight size={18} color={W.ctaInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
        </button>
        <ChipRow label="Quick filters" style={{ marginTop: 10 }}>
          <WorldChip world="restroom" icon={Clock} label="Open now" active={openOnly} onClick={() => setOpenOnly((o) => !o)} />
          <WorldChip world="restroom" icon={Check} label="Free" active={freeOnly} onClick={() => setFreeOnly((f) => !f)} />
          <WorldChip world="restroom" icon={Accessibility} label="Accessible" active={accessOnly} onClick={() => setAccessOnly((a) => !a)} />
        </ChipRow>
        <ChipRow label="Place types" bleed style={{ marginTop: 2 }}>
          {VENUE_TYPES.map((v) => (
            <WorldChip key={v.id} world="restroom" icon={v.icon} label={v.label} active={venueType === v.id} onClick={() => setVenueType(venueType === v.id ? "all" : v.id)} />
          ))}
        </ChipRow>
        {loadingMore && !loading && <ResultLine live>Finding more restrooms nearby&hellip;</ResultLine>}
      </FinderHeader>

      {/* ── CONTENT ── */}
      {(!lat || !lng) ? (
        /* No location yet (first run, permission denied): the GPS snap first, the picker
           second; never a spinner or a misleading "nothing found". */
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 28 }}>
          <FinderEmptyState world="restroom" icon={MapPin} title="Set your location"
            reason="Find the nearest restroom right now: use your exact position, or pick a place."
            actionLabel={gpsLoading ? "Finding you…" : "Use my current location"} onAction={() => handleUseCurrentLocation()}
            secondaryLabel="Choose a location" onSecondary={() => setShowLocPicker(true)} />
        </div>
      ) : loading ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14 }}>
          <WorldSkeleton world="restroom" variant="card" count={2} label="Finding restrooms nearby" />
        </div>
      ) : error ? (
        /* The search already runs at the 25-mile cap, so there is no radius to widen:
           the honest actions are to try again or to search somewhere else. */
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 28 }}>
          {/^Failed/.test(error)
            ? <FinderEmptyState world="restroom" icon={AlertCircle} title="Couldn’t load restrooms" reason={error} actionLabel="Try again" onAction={handleRefresh} secondaryLabel="Search somewhere else" onSecondary={() => setShowLocPicker(true)} />
            : <FinderEmptyState world="restroom" icon={SearchX} title="No restrooms found" reason={error} actionLabel="Search somewhere else" onAction={() => setShowLocPicker(true)} secondaryLabel="Try again" onSecondary={handleRefresh} />}
        </div>
      ) : viewMode === "list" ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14, paddingBottom: isTablet ? 170 : 100 }}>
          {widened && radius === 10 && (
            <WorldNote world="restroom" icon={Info} title={`Nothing ${openOnly ? "open " : ""}within ${miles(5)} of you`} style={{ marginBottom: 12 }}>
              So this looks out to {miles(10)}.
            </WorldNote>
          )}
          {filtered.length === 0 ? (
            <FinderEmptyState world="restroom" icon={SearchX} title="No matches" reason="Nothing here passes the current filters."
              actionLabel="Search somewhere else" onAction={() => setShowLocPicker(true)}
              secondaryLabel={anyFilter ? "Clear filters" : undefined} onSecondary={anyFilter ? clearFilters : undefined} />
          ) : (
            <ol aria-label="Restrooms" style={worldGrid(isTablet)}>
              {filtered.map((r, i) => (
                <RestroomCard key={r.id || r.placeId || i} r={r} n={i + 1} isLocal={isLocal} formatDistance={formatDistance}
                  onDirections={setDirectionsRR} onShowOnMap={() => handleShowOnMap(i)} highlighted={highlightIdx === i}
                  cardRef={(el) => { cardRefs.current[i] = el; }} />
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 12, paddingBottom: 100 }}>
          <div style={{ position: "relative", height: "calc(100vh - 300px)", minHeight: 360, borderRadius: 16, overflow: "hidden", border: `1px solid ${W.line}` }}>
            <div ref={mapRef} role="region" aria-label="Map of restrooms" style={{ height: "100%", width: "100%" }} />

            {/* Back to the list */}
            <button type="button" onClick={backToList} aria-label="Back to the list"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, border: `1px solid ${W.line}`, borderRadius: 999, background: NEUTRAL.white, boxShadow: "0 2px 10px rgba(22,17,13,.15)", cursor: "pointer" }}>
              <X size={20} color={W.ink} strokeWidth={2} aria-hidden="true" />
            </button>

            {/* The legend: the five plaques, in their steps and words. */}
            <div aria-label="Legend" role="group" style={{ position: "absolute", top: 12, left: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 5, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.95)", border: `1px solid ${W.line}`, boxShadow: "0 2px 10px rgba(22,17,13,.10)" }}>
              {Object.keys(ACCESS).map((k) => {
                const p = plaqueStyle(k);
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(11), lineHeight: 1.2, color: NEUTRAL.ink2 }}>
                    <span aria-hidden="true" style={{ width: 12, height: 12, boxSizing: "border-box", borderRadius: 999, background: p.bg, border: p.border === "0" ? `1px solid ${W.line}` : p.border }} />
                    {ACCESS[k].label}
                  </div>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedRestroom && (
                <MapSheet r={selectedRestroom} n={activeMapPin + 1} expanded={sheetExpanded} onExpand={setSheetExpanded}
                  onClose={() => setActiveMapPin(null)} onDirections={() => setDirectionsRR(selectedRestroom)}
                  formatDistance={formatDistance} isLocal={isLocal} />
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <MapAppSelector
        isOpen={!!directionsRR}
        onClose={() => setDirectionsRR(null)}
        destination={{
          name: directionsRR ? nameOf(directionsRR) : "Restroom",
          address: directionsRR?.formattedAddress || directionsRR?.vicinity || directionsRR?.address || "",
          latitude: directionsRR?.lat,
          longitude: directionsRR?.lng,
        }}
        userLat={lat}
        userLng={lng}
      />
      <LocationModePicker isOpen={showLocPicker} onClose={() => setShowLocPicker(false)} />
    </div>
  );
}
