// ConvenienceStore: Night Shift (the new look, Convenience.dc.html; plan S16).
//
// The night plate with its lit window (CONVENIENCE · N NEARBY · K OPEN 24 HOURS, "The
// corner store", the location and the unit), then Open now / Open 24 hours / Filters
// (Has an ATM, Hot food) and Pharmacy / Coffee / Gas; numbered cards with a photo or the
// night strip, ONE status pill, the store's kind, the facts line, up to three tags, the
// travelers' finds and the guestbook as quiet rows, and Directions in night with a lime
// label; a map with night pins.
//
// Honest by design: 'Open 24 hours' only when this store's own hours say so (a chain's
// usual policy is not the store's hours), and only then the lime line; open words read
// the store's clock (its utcOffsetMinutes, or the device's in current-location mode) and
// unknown hours read 'Hours not listed', never 'Closed'; cards are never stated as taken
// unless the chain's own standard says so ('Usually takes cards'), else 'Not confirmed'.
// No chain brand colours, no emoji. No search field and no Snacks or SIM chips: no data
// backs them (plan open question 13).
import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { openPartner } from "@/lib/openPartner";
import { openStateFor } from "@/lib/openState";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import Guestbook from "@/components/Guestbook";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import { WorldChip, ChipRow, ResultLine } from "@/components/finder/FinderControls";
import { WorldCard, worldGrid, NumberMark, FactsLine, WorldTag, TagRow, CardKicker, CardName, QuietRow, QuietRows, QuietPanel, ActionRow, WorldSkeleton } from "@/components/finder/FinderCard";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet, { FilterGroupLabel, FilterToggleRow } from "@/components/finder/FilterSheet";
import TravelerDishes from "@/components/finder/TravelerDishes";
import { AlertCircle, BookOpen, Clock, Coffee, CreditCard, Flame, Fuel, Landmark, MapPin, Moon, Pill, SearchX, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { WORLD, NEUTRAL, fs } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

const W = WORLD.convenience;
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const LIME_RING = "rgba(198,226,90,0.55)";

// Used ONLY as the /places/photo img-src base (an <img> src can't go through callWorker).
const API_BASE_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

// Known chains: the name and what the chain is known for (words only: no brand colours,
// no emoji, and no '24hr', which only a store's own hours can say).
const CHAIN_INFO = {
  "7-eleven": { chain: "7-Eleven", features: ["Slurpee"] },
  "cvs": { chain: "CVS", features: ["Photo prints"] },
  "walgreens": { chain: "Walgreens", features: ["Photo prints"] },
  "circle k": { chain: "Circle K", features: ["Drinks"] },
  "wawa": { chain: "Wawa", features: ["Fresh food"] },
  "sheetz": { chain: "Sheetz", features: ["Made-to-order"] },
  "speedway": { chain: "Speedway", features: ["Snacks", "Drinks"] },
  "chevron": { chain: "Chevron", features: [] },
  "shell": { chain: "Shell", features: [] },
  "ampm": { chain: "ampm", features: ["Snacks"] },
  "quiktrip": { chain: "QuikTrip", features: ["Kitchen"] },
  "racetrac": { chain: "RaceTrac", features: [] },
  "family dollar": { chain: "Family Dollar", features: ["Budget"] },
  "dollar general": { chain: "Dollar General", features: ["Budget"] },
  "target": { chain: "Target", features: [] },
  "walmart": { chain: "Walmart", features: [] },
};
function detectChain(name) {
  const n = String(name || "").toLowerCase();
  for (const [key, info] of Object.entries(CHAIN_INFO)) if (n.includes(key)) return info;
  return null;
}

function photoUrl(photo, maxWidth = 800) {
  if (!photo) return null;
  if (typeof photo === "string") return photo;
  if (photo.url) return photo.url;
  if (photo.name) return `${API_BASE_URL}/places/photo?name=${encodeURIComponent(photo.name)}&maxWidth=${maxWidth}`;
  return null;
}

// The worker's row (snake_case) as the page reads it. Payment keeps its confidence: no
// default 'takes cards'.
function normalizeStore(s) {
  const address = s.address || s.formattedAddress || "";
  return {
    id: s.id || s.place_id,
    placeId: s.place_id || s.id,
    name: s.name || "Store",
    address,
    street: String(s.shortAddress || address).split(",")[0].trim(),
    lat: s.lat ?? s.latitude ?? s.location?.latitude ?? null,
    lng: s.lng ?? s.longitude ?? s.location?.longitude ?? null,
    distanceMiles: s.distance_miles ?? s.distance ?? s.distanceMiles ?? null,
    rating: s.rating,
    reviewCount: s.review_count || s.userRatingCount || 0,
    hours: Array.isArray(s.hours) ? s.hours : [],
    utcOffsetMinutes: Number.isFinite(s.utcOffsetMinutes) ? s.utcOffsetMinutes : null,
    hasATM: !!(s.has_atm || s.hasATM),
    hasPharmacy: !!(s.has_pharmacy || s.hasPharmacy),
    hasHotFood: !!(s.has_hot_food || s.hasHotFood),
    hasCoffee: !!(s.has_coffee || s.hasCoffee),
    hasFuel: !!(s.has_fuel || s.hasFuel),
    acceptsCards: s.accepts_cards ?? s.acceptsCards ?? null,
    cashOnly: !!(s.cash_only || s.cashOnly),
    paymentConfidence: s.payment_confidence || "unknown",
    paymentWarnings: Array.isArray(s.payment_warnings) ? s.payment_warnings : [],
    paymentTip: s.payment_country_tip || null,
    phone: s.phone || s.nationalPhoneNumber || null,
    website: s.website || s.websiteUri || null,
    photos: Array.isArray(s.photos) ? s.photos : [],
    categoryLabel: s.category_label || null,
  };
}

// Open around the clock, by the store's own hours: every day says so, or today does.
const is24 = (os) => os.allDay || os.todayText === "Open 24 hours";
// Open now, as the cards say it: only when the hours put the store open at its own clock.
const openNow = (s, isLocal) => openStateFor(s, { isLocal }).status === "open";

// How the store takes payment, in words its confidence can back.
function paymentWords(s) {
  if (s.paymentConfidence === "likely") {
    if (s.cashOnly) return "Usually cash only (the chain's standard)";
    if (s.acceptsCards) return "Usually takes cards (the chain's standard)";
  }
  if (s.paymentConfidence === "estimated" && s.cashOnly) return "Cash is the norm here: bring some";
  return "Not confirmed: carry some cash";
}

// Up to three tags, as words with lucide icons.
function tagsOf(s, chain) {
  const tags = [
    s.hasATM && { key: "atm", label: "ATM", icon: Landmark },
    s.hasHotFood && { key: "food", label: "Hot food", icon: Flame },
    s.hasPharmacy && { key: "rx", label: "Pharmacy", icon: Pill },
    s.hasCoffee && { key: "coffee", label: "Coffee", icon: Coffee },
    s.hasFuel && { key: "gas", label: "Gas", icon: Fuel },
    ...((chain?.features || []).map((f) => ({ key: f, label: f, icon: Sparkles }))),
  ].filter(Boolean);
  return tags.slice(0, 3);
}

// The one status pill on the photo or strip (Convenience.dc.html L73, L104, L132, L160).
function StatusPill({ os, allDay }) {
  /** @type {import('react').CSSProperties} */
  const base = { position: "absolute", left: 50, top: 16, display: "flex", alignItems: "center", gap: 5, minHeight: 28, maxWidth: "calc(100% - 100px)", boxSizing: "border-box", padding: "0 10px", borderRadius: 999, fontSize: fs(12), fontWeight: 600, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  if (allDay) {
    return (
      <span style={{ ...base, background: W.ink, border: `1px solid ${LIME_RING}`, color: W.plateAccent }}>
        <Moon size={13} color={W.plateAccent} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />Open 24 hours
      </span>
    );
  }
  const color = os.status === "open" ? NEUTRAL.open : os.status === "closed" ? NEUTRAL.stamp : os.status === "unknown" ? NEUTRAL.ink3 : NEUTRAL.ink2;
  return (
    <span style={{ ...base, background: NEUTRAL.white, color }}>
      <Clock size={13} color={color} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{os.word}</span>
    </span>
  );
}

function MoreRow({ label, children }) {
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${W.line}` }}>
      <div style={{ marginBottom: 4, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".12em", textTransform: "uppercase", color: W.iconInk }}>{label}</div>
      <div style={{ fontSize: fs(13.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>{children}</div>
    </div>
  );
}

// ─── STORE CARD (Convenience.dc.html L70-97) ────────────────────────────────
function StoreCard({ store, n, isLocal, formatDistance, onDirections, onShowOnMap, highlighted, cardRef }) {
  const [expanded, setExpanded] = useState(false);
  const [guestbookOpen, setGuestbookOpen] = useState(false);
  const [gallery, setGallery] = useState({ open: false, idx: 0 });
  const [enriched, setEnriched] = useState(null);
  const moreId = useId();
  const guestId = useId();

  // A planet-DB store (its id is a uuid) fetches its photos and hours when the card
  // mounts; a Google row without photos is Google saying it has none.
  useEffect(() => {
    if (enriched || store.photos.length || !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(store.id || store.placeId || ""))) return;
    callWorker("places/enrich-owned", { id: store.id || store.placeId, name: store.name, lat: store.lat, lng: store.lng, maxPhotos: 3 })
      .then(({ data }) => { if (data && data.matched) setEnriched(data); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = enriched ? {
    ...store,
    photos: enriched.photos?.length ? enriched.photos : store.photos,
    hours: enriched.hours?.weekdayDescriptions?.length ? enriched.hours.weekdayDescriptions : store.hours,
  } : store;
  const photos = s.photos.map((p) => photoUrl(p)).filter(Boolean);
  const os = openStateFor(s, { isLocal });
  const allDay = is24(os);
  const chain = detectChain(s.name);
  const showChainPill = chain && !s.name.toLowerCase().startsWith(chain.chain.toLowerCase());
  const tags = tagsOf(s, chain);
  const dist = Number.isFinite(s.distanceMiles) ? formatDistance(s.distanceMiles) : null;
  const week = (os.week || []).some((d) => d.text) ? os.week : [];
  const placeId = s.placeId || s.id;

  return (
    <WorldCard world="convenience" as="li" ref={cardRef} style={highlighted ? { boxShadow: `0 0 0 3px ${W.ink}, ${W.cardShadow}` } : undefined}>
      <PhotoOrIcon world="convenience" photos={photos} alt={s.name} litWindow={allDay}
        onClick={photos.length ? (i) => setGallery({ open: true, idx: Number.isFinite(i) ? i : 0 }) : undefined}>
        <NumberMark n={n} world="convenience" style={{ top: 16, left: 14 }} />
        <StatusPill os={os} allDay={allDay} />
        {showChainPill && photos.length > 0 && (
          <span style={{ position: "absolute", top: 16, right: 12, display: "flex", alignItems: "center", minHeight: 28, maxWidth: 120, boxSizing: "border-box", padding: "0 10px", borderRadius: 999, background: NEUTRAL.white, fontSize: fs(12), fontWeight: 600, color: W.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {chain.chain}
          </span>
        )}
      </PhotoOrIcon>
      <div style={{ padding: "14px 16px 16px" }}>
        <CardKicker world="convenience">{s.categoryLabel || "Convenience store"}{showChainPill && !photos.length ? ` · ${chain.chain}` : ""}</CardKicker>
        <CardName world="convenience" as="h3">{s.name}</CardName>
        {placeId ? <div style={{ marginTop: 2 }}><NameLanguageHelp placeId={placeId} name={s.name} world="convenience" /></div> : null}
        <FactsLine world="convenience" open={false}
          items={[s.street, dist, { rating: s.rating, count: s.reviewCount, source: "google" }]}
          style={{ marginTop: 4 }} />
        {tags.length > 0 && (
          <TagRow max={3} style={{ marginTop: 10 }}>
            {tags.map((t) => <WorldTag key={t.key} world="convenience" icon={t.icon}>{t.label}</WorldTag>)}
          </TagRow>
        )}
        <QuietRows world="convenience" style={{ marginTop: 12 }}>
          <TravelerDishes world="convenience" variant="row" place={{ id: placeId, name: s.name, lat: s.lat, lng: s.lng }} kind="store" />
          <QuietRow world="convenience" icon={BookOpen} expanded={guestbookOpen} controls={guestId} onClick={() => setGuestbookOpen((o) => !o)}>
            <span style={{ fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase" }}>Guestbook</span>
          </QuietRow>
          <QuietPanel world="convenience" id={guestId} order={2} hidden={!guestbookOpen} style={{ padding: "12px 14px" }}>
            {guestbookOpen ? <Guestbook entityType="store" entityId={placeId} entityName={s.name} world="convenience" /> : null}
          </QuietPanel>
        </QuietRows>
        <ActionRow world="convenience" name={s.name} onDirections={() => onDirections(s)} onMap={onShowOnMap} phone={s.phone}
          onMore={() => setExpanded((e) => !e)} moreIcon moreExpanded={expanded} moreControls={moreId} style={{ marginTop: 4 }} />
        {expanded && (
          <div id={moreId} style={{ marginTop: 12 }}>
            <MoreRow label="Payment">
              {paymentWords(s)}
              {s.paymentTip ? <div style={{ marginTop: 2, color: NEUTRAL.ink3 }}>Around here: {s.paymentTip}</div> : null}
            </MoreRow>
            <MoreRow label="Hours">
              {week.length > 0 ? (
                <dl style={{ margin: 0 }}>
                  {week.map((d) => (
                    <div key={d.day} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0", fontWeight: d.today ? 600 : 400, color: d.today ? W.ink : NEUTRAL.ink2 }}>
                      <dt>{d.day}</dt>
                      <dd style={{ margin: 0, textAlign: "right", color: /^closed$/i.test(String(d.text || "")) ? NEUTRAL.stamp : undefined }}>{d.text || "Not listed"}</dd>
                    </div>
                  ))}
                </dl>
              ) : "Not listed: call ahead"}
            </MoreRow>
            {s.address ? <MoreRow label="Address">{s.address}</MoreRow> : null}
            {s.website ? (
              <MoreRow label="Website">
                <button type="button" onClick={() => openPartner(s.website)}
                  style={{ display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-12px 0", padding: 0, background: "transparent", border: 0, fontFamily: "inherit", fontSize: "inherit", color: W.ink, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer", overflowWrap: "anywhere", textAlign: "left" }}>
                  {s.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </button>
              </MoreRow>
            ) : null}
          </div>
        )}
      </div>
      <PhotoGalleryModal photos={photos} initialIndex={gallery.idx} isOpen={gallery.open} onClose={() => setGallery({ open: false, idx: 0 })} />
    </WorldCard>
  );
}

// ─── MAP ────────────────────────────────────────────────────────────────────
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mapFs = (px) => `calc(${px}px * var(--fs, 1))`;

// A night pin with the card's serif numeral; a lime ring for a store open 24 hours; the
// one picked in lime with night type.
function pinHtml(n, allDay, active) {
  const sz = active ? 34 : 28;
  const bg = active ? W.plateAccent : W.ink;
  const ink = active ? W.ink : NEUTRAL.white;
  const ring = allDay ? W.plateAccent : NEUTRAL.white;
  return `<div style="width:${sz}px;height:${sz}px;box-sizing:border-box;border-radius:50%;background:${bg};border:${active ? 3 : 2}px solid ${active ? W.ink : ring};box-shadow:0 3px 10px rgba(21,23,28,.3);display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:${active ? 17 : 15}px;line-height:1;color:${ink};">${n}</div>`;
}

function popupHtml(s, i, isLocal, fmt) {
  const os = openStateFor(s, { isLocal });
  const allDay = is24(os);
  const word = allDay ? "Open 24 hours" : os.word;
  const tone = allDay ? W.ink : ({ open: NEUTRAL.open, closed: NEUTRAL.stamp, muted: NEUTRAL.ink3 }[os.tone] || NEUTRAL.ink2);
  const dist = Number.isFinite(s.distanceMiles) && fmt ? fmt(s.distanceMiles) : "";
  const btn = (call, label, solid) => `<button onclick="${call}" style="flex:1;min-height:44px;border:${solid ? "0" : `1px solid ${W.line}`};border-radius:12px;background:${solid ? W.cta : "#fff"};color:${solid ? W.ctaInk : NEUTRAL.ink2};font-weight:600;font-size:${mapFs(13)};cursor:pointer;font-family:inherit;">${label}</button>`;
  const xSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${NEUTRAL.ink3}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  return `<div style="width:256px;position:relative;font-family:inherit;">`
    + `<button onclick="window._gsMapInstance&&window._gsMapInstance.closePopup()" aria-label="Close" style="position:absolute;top:4px;right:4px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;cursor:pointer;">${xSvg}</button>`
    + `<div style="padding:14px 16px 16px;">`
    + `<div style="padding-right:36px;font-family:${MONO};font-size:${mapFs(10)};line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:${W.ink};">${esc(s.categoryLabel || "Convenience store")}</div>`
    + `<button onclick="window._gsViewStore&&window._gsViewStore(${i})" style="display:block;margin:4px 0 0;padding:0 30px 0 0;border:0;background:transparent;text-align:left;cursor:pointer;font-family:${SERIF};font-size:${mapFs(20)};line-height:1.15;color:${NEUTRAL.ink};">${esc(s.name)}</button>`
    + `<div style="margin-top:6px;font-size:${mapFs(13)};line-height:1.4;color:${NEUTRAL.ink2};"><span style="font-weight:600;color:${tone};">${esc(word)}</span>${dist ? ` · ${esc(dist)}` : ""}</div>`
    + (s.address ? `<div style="margin-top:4px;font-size:${mapFs(12.5)};line-height:1.4;color:${NEUTRAL.ink3};">${esc(s.address)}</div>` : "")
    + `<div style="display:flex;gap:8px;margin-top:12px;">${btn(`window._gsStoreDirs&&window._gsStoreDirs(${i})`, "Directions", true)}${btn(`window._gsViewStore&&window._gsViewStore(${i})`, "Details", false)}</div>`
    + `</div></div>`;
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ConvenienceStorePage() {
  const isTablet = useIsTablet();
  const { activeLocation, locationMode } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);
  // The device's clock is the store's clock only in current-location mode.
  const isLocal = locationMode === "current";

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const forceNextRef = useRef(false);
  const handleRefresh = () => { forceNextRef.current = true; setRefreshTick((t) => t + 1); };
  // Server filters (the worker's own params): ATM, hot food, pharmacy, coffee, gas.
  // Open now and open 24 hours are read here from each store's hours.
  const [serverFilters, setServerFilters] = useState({ hasATM: false, hasHotFood: false, hasPharmacy: false, hasCoffee: false, hasGas: false });
  const [openOnly, setOpenOnly] = useState(false);
  const [allDayOnly, setAllDayOnly] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [activeMapPin, setActiveMapPin] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [directionsTo, setDirectionsTo] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const cardRefs = useRef({});
  const mapRef = useRef(null);
  const mapInstRef = useRef(null);
  const markersRef = useRef([]);

  // ── Fetch ──
  useEffect(() => {
    if (!lat || !lng) { setLoading(false); return undefined; } // no location yet: never spin
    let cancelled = false;
    setLoading(true);
    setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;
    (async () => {
      try {
        // Google's stores (handleConvenienceStores): a fixed 25-mile wide net in MILES,
        // the traveler-best order, and the feature filters it supports.
        const { data, error: workerError } = await callWorker(ROUTE.getConvenienceStores, {
          latitude: lat, longitude: lng, radius: 25, maxResults: 50, limit: 50, sortBy: "traveler_best",
          ...serverFilters, forceRefresh: force,
        });
        if (cancelled) return;
        if (workerError) throw new Error(workerError);
        const raw = data?.stores || data?.places || data?.all_stores || [];
        setStores(raw.map(normalizeStore));
      } catch (e) {
        if (cancelled) return;
        setStores([]); // a failed fetch must not leave the old list's count on screen
        setError("Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng, serverFilters, refreshTick]);

  const list = useMemo(() => stores.filter((s) => {
    const os = openStateFor(s, { isLocal });
    if (openOnly && os.status !== "open") return false;
    if (allDayOnly && !is24(os)) return false;
    return true;
  }), [stores, openOnly, allDayOnly, isLocal]);

  // Open now can be told when the device is at the stores, a store gives its clock, or a
  // store is open all day every day (open at any clock).
  const canTellOpen = isLocal || stores.some((s) => Number.isFinite(s.utcOffsetMinutes) || openStateFor(s).allDay);
  const settled = !!lat && !!lng && !loading && !error;
  const stats = {
    total: list.length,
    allDay: list.filter((s) => is24(openStateFor(s, { isLocal }))).length,
    open: list.filter((s) => openNow(s, isLocal)).length,
  };
  const sheetCount = (serverFilters.hasATM ? 1 : 0) + (serverFilters.hasHotFood ? 1 : 0);
  const hasFilters = openOnly || allDayOnly || Object.values(serverFilters).some(Boolean);
  const clearFilters = () => { setOpenOnly(false); setAllDayOnly(false); setServerFilters({ hasATM: false, hasHotFood: false, hasPharmacy: false, hasCoffee: false, hasGas: false }); };
  const toggleServer = (k) => setServerFilters((f) => ({ ...f, [k]: !f[k] }));

  const handleShowOnMap = (index) => {
    setViewMode("map");
    setActiveMapPin(index);
    setTimeout(() => {
      const s = list[index];
      if (mapInstRef.current && s?.lat && s?.lng) {
        mapInstRef.current.setView([s.lat, s.lng], 17);
        markersRef.current[index]?.openPopup();
      }
    }, 350);
  };
  const viewInList = (i) => {
    setViewMode("list");
    setHighlightIdx(i);
    setTimeout(() => cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    setTimeout(() => setHighlightIdx(null), 2800);
  };

  // ── Map ──
  useEffect(() => {
    if (viewMode !== "map" || !mapRef.current || !lat || !lng) return undefined;
    const initMap = () => {
      if (mapInstRef.current) mapInstRef.current.remove();
      markersRef.current = [];
      const map = window.L.map(mapRef.current).setView([lat, lng], 14);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
      mapInstRef.current = map;
      window._gsMapInstance = map;
      // The popups' buttons are HTML: they reach React through these bridges.
      window._gsViewStore = (i) => { map.closePopup(); viewInList(i); };
      window._gsStoreDirs = (i) => setDirectionsTo(list[i]);
      // Where you are: the blue dot, its words below it (clear of the popups above).
      window.L.marker([lat, lng], { icon: window.L.divIcon({ html: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>', iconSize: [16, 16], className: "" }) })
        .addTo(map)
        .bindTooltip(`<div style="padding:5px 9px;font-family:inherit;font-weight:600;color:${NEUTRAL.ink};font-size:${mapFs(11)};">You are here</div>`, { permanent: true, direction: "bottom", opacity: 1, offset: [0, 12], className: "gs-user-tooltip", interactive: false });
      list.forEach((s, i) => {
        if (!s.lat || !s.lng) return;
        const isActive = activeMapPin === i;
        const allDay = is24(openStateFor(s, { isLocal }));
        const size = isActive ? 34 : 28;
        const marker = window.L.marker([s.lat, s.lng], { icon: window.L.divIcon({ html: pinHtml(i + 1, allDay, isActive), iconSize: [size, size], className: "" }), keyboard: true, title: `${i + 1}. ${s.name}` }).addTo(map);
        marker.bindPopup(popupHtml(s, i, isLocal, formatDistance), { maxWidth: 280, closeButton: false, autoPan: true, autoPanPaddingTopLeft: [0, 160], autoPanPaddingBottomRight: [20, 20], keepInView: true, className: "gs-popup" });
        marker.on("popupopen", () => setActiveMapPin(i));
        markersRef.current[i] = marker;
      });
      if (activeMapPin !== null && markersRef.current[activeMapPin]) setTimeout(() => markersRef.current[activeMapPin]?.openPopup(), 200);
    };
    if (!window.L) {
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link);
      const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.onload = initMap; document.head.appendChild(script);
    } else initMap();
    return () => {
      delete window._gsMapInstance;
      delete window._gsViewStore;
      delete window._gsStoreDirs;
      if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
    };
  }, [viewMode, list, lat, lng, activeMapPin, unit, isLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="font-sans" style={{ background: W.paper, minHeight: "100vh", paddingTop: 12 }}>

      {/* ── THE PLATE + CONTROLS (Convenience.dc.html L26-67): the night plate with its
          lit window and counts, then the two chip rows and the result line. ── */}
      <FinderHeader
        world="convenience"
        count={settled ? stats.total : null}
        countLabel="nearby"
        kickerExtras={settled ? [{ count: stats.allDay, label: "open 24 hours" }] : undefined}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh stores"
        location={{ label: locLabel, onChange: () => setShowLocPicker(true) }}
        unit={{ value: unit, onChange: setUnit }}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
      >
        <ChipRow label="Filters" style={{ marginTop: 2 }}>
          <WorldChip world="convenience" icon={Clock} label="Open now" active={openOnly} onClick={() => setOpenOnly((o) => !o)}
            disabled={!openOnly && !canTellOpen && settled} hint="Open now needs the stores’ local time, which this search didn’t give." />
          <WorldChip world="convenience" icon={Moon} label="Open 24 hours" active={allDayOnly} onClick={() => setAllDayOnly((o) => !o)} />
          <WorldChip world="convenience" icon={SlidersHorizontal} label={sheetCount ? `Filters · ${sheetCount}` : "Filters"} active={sheetCount > 0} opensSheet onClick={() => setShowSheet(true)} />
        </ChipRow>
        <ChipRow label="Store types">
          <WorldChip world="convenience" icon={Pill} label="Pharmacy" active={serverFilters.hasPharmacy} onClick={() => toggleServer("hasPharmacy")} />
          <WorldChip world="convenience" icon={Coffee} label="Coffee" active={serverFilters.hasCoffee} onClick={() => toggleServer("hasCoffee")} />
          <WorldChip world="convenience" icon={Fuel} label="Gas" active={serverFilters.hasGas} onClick={() => toggleServer("hasGas")} />
        </ChipRow>
        {settled && list.length > 0 && <ResultLine live items={[{ count: stats.open, label: "open now" }, { count: stats.allDay, label: "open 24 hours" }]} />}
      </FinderHeader>

      {(!lat || !lng) ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 24 }}>
          <FinderEmptyState world="convenience" icon={MapPin} title="Choose a location" hint="Corner stores, drugstores, gas-station marts and mini-marts near where you are."
            actionLabel="Choose a location" onAction={() => setShowLocPicker(true)} />
        </div>
      ) : loading ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14 }}>
          <WorldSkeleton world="convenience" variant="card" count={2} label="Finding stores nearby" />
        </div>
      ) : error ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 24 }}>
          <FinderEmptyState world="convenience" icon={AlertCircle} title="Couldn’t load stores" hint={error} actionLabel="Try again" onAction={handleRefresh}
            secondaryLabel="Search somewhere else" onSecondary={() => setShowLocPicker(true)} />
        </div>
      ) : viewMode === "list" ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14, paddingBottom: 24 }}>
          {list.length === 0 ? (
            <FinderEmptyState world="convenience" icon={SearchX} title="No stores found"
              hint={hasFilters ? "No stores here match these filters." : "No convenience stores within 25 miles of this location."}
              actionLabel="Search somewhere else" onAction={() => setShowLocPicker(true)}
              secondaryLabel={hasFilters ? "Clear filters" : undefined} onSecondary={hasFilters ? clearFilters : undefined} />
          ) : (
            <ol aria-label="Stores" style={worldGrid(isTablet)}>
              {list.map((s, i) => (
                <StoreCard key={s.id || i} store={s} n={i + 1} isLocal={isLocal} formatDistance={formatDistance}
                  onDirections={setDirectionsTo} onShowOnMap={() => handleShowOnMap(i)} highlighted={highlightIdx === i}
                  cardRef={(el) => { cardRefs.current[i] = el; }} />
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 12, paddingBottom: 24 }}>
          <div style={{ position: "relative", height: "calc(100vh - 300px)", minHeight: 360, borderRadius: 16, overflow: "hidden", border: `1px solid ${W.line}` }}>
            <div ref={mapRef} role="region" aria-label="Map of stores" style={{ height: "100%", width: "100%" }} />
            <button type="button" onClick={() => setViewMode("list")} aria-label="Back to the list"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, border: `1px solid ${W.line}`, borderRadius: 999, background: NEUTRAL.white, boxShadow: "0 2px 10px rgba(21,23,28,.15)", cursor: "pointer" }}>
              <X size={20} color={W.ink} strokeWidth={2} aria-hidden="true" />
            </button>
            {/* The legend, in words. */}
            <div role="group" aria-label="Legend" style={{ position: "absolute", bottom: 14, left: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 5, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.95)", border: `1px solid ${W.line}`, boxShadow: "0 2px 10px rgba(21,23,28,.10)" }}>
              {[
                { bg: W.ink, border: NEUTRAL.white, label: "Store" },
                { bg: W.ink, border: W.plateAccent, label: "Open 24 hours" },
                { bg: W.plateAccent, border: W.ink, label: "Picked" },
              ].map((k) => (
                <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(11), lineHeight: 1.2, color: NEUTRAL.ink2 }}>
                  <span aria-hidden="true" style={{ width: 12, height: 12, boxSizing: "border-box", borderRadius: 999, background: k.bg, border: `2px solid ${k.border}`, boxShadow: "0 0 0 1px rgba(21,23,28,.25)" }} />
                  {k.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .gs-popup .leaflet-popup-content-wrapper { border-radius:16px; padding:0; overflow:hidden; box-shadow:0 8px 32px rgba(21,23,28,.18); }
        .gs-popup .leaflet-popup-content { margin:0; }
        .gs-popup .leaflet-popup-tip-container { display:none; }
      `}</style>

      {/* Filters: ATM and hot food, both the worker's own filters. */}
      <FilterSheet world="convenience" open={showSheet} onClose={() => setShowSheet(false)} title="Filters"
        onClear={sheetCount ? () => setServerFilters((f) => ({ ...f, hasATM: false, hasHotFood: false })) : undefined}>
        <FilterGroupLabel>Show only</FilterGroupLabel>
        <FilterToggleRow world="convenience" icon={CreditCard} label="Has an ATM" description="A cash machine on site" checked={serverFilters.hasATM} onChange={() => toggleServer("hasATM")} />
        <FilterToggleRow world="convenience" icon={Flame} label="Hot food" description="Ready-to-eat meals and snacks" checked={serverFilters.hasHotFood} onChange={() => toggleServer("hasHotFood")} />
      </FilterSheet>

      <LocationModePicker isOpen={showLocPicker} onClose={() => setShowLocPicker(false)} />
      {directionsTo && (
        <MapAppSelector
          isOpen={true}
          onClose={() => setDirectionsTo(null)}
          destination={{ name: directionsTo.name, address: directionsTo.address, latitude: directionsTo.lat, longitude: directionsTo.lng }}
          userLat={lat}
          userLng={lng}
        />
      )}
    </div>
  );
}
