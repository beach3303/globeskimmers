// Shopping: The Boutique (the new look, Shopping.dc.html; plan S17).
//
// The blush plate with its swing tag ('30 NEARBY'), "Shops & markets", the location and
// the unit; then Open now / Luxury / Filters (food shopping) / List | Map, and the shop
// kinds; numbered cards with a swing-tag number, a photo (or two side by side) or the
// plum strip, the kind as a mono pill, the street, the serif name as written, the facts
// line, up to three blush tags and the plum action row; a map with plum pins.
//
// Honest by design: open words read the shop's clock (Google's utcOffsetMinutes, or the
// device's in current-location mode; unknown hours read 'Hours not listed'); a rating
// under 5 reviews says FEW REVIEWS; tags are never repeated and never more than three,
// and 'Open late' is left to the hours. No venue colours, no rainbow, no emoji. No search
// field, no Boutiques or Books chips and no neighbourhood: no data backs them (plan open
// question 13).
import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { useLocation as useRouterLocation } from "react-router-dom";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { logSearch } from "@/lib/logSearch";
import { openPartner } from "@/lib/openPartner";
import { openStateFor } from "@/lib/openState";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import { WorldChip, ChipRow, WorldSegmented, ResultLine } from "@/components/finder/FinderControls";
import { WorldCard, worldGrid, NumberMark, FactsLine, WorldTag, TagRow, CardKicker, CardName, ActionRow, WorldSkeleton } from "@/components/finder/FinderCard";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet, { FilterGroupLabel, FilterToggleRow } from "@/components/finder/FilterSheet";
import { SwingTag } from "@/components/finder/motifs";
import {
  AlertCircle, Apple, Beef, Building2, Carrot, Clock, Gem, Gift, MapPin, Moon, Package, Plane, Scissors, SearchX,
  ShoppingBag, ShoppingCart, SlidersHorizontal, Store, Tag, Tent, X,
} from "lucide-react";
import { WORLD, NEUTRAL, fs } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

const W = WORLD.shopping;
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

// The kinds of shop the worker can look for ('all' is the plain list). Luxury is the
// Luxury chip in the first row, so it is not repeated here.
const CATEGORIES = [
  { id: "supermarkets", label: "Groceries" },
  { id: "general_shopping", label: "Shops" },
  { id: "souvenir_shopping", label: "Souvenirs" },
  { id: "markets_bazaars", label: "Bazaars" },
  { id: "night_markets", label: "Night markets" },
  { id: "local_crafts", label: "Crafts" },
  { id: "malls", label: "Malls" },
  { id: "outlets", label: "Outlets" },
  { id: "duty_free", label: "Duty free" },
];
const KNOWN_CATEGORIES = new Set(["all", "luxury_shopping", ...CATEGORIES.map((c) => c.id)]);

// The kind's line icon (the worker's shoppingSubtype; its emoji and colour are ignored).
const SUBTYPE_ICON = {
  supermarket: ShoppingCart, warehouse_club: Package, farmers_market: Carrot, fresh_market: Apple, bodega: Store,
  butcher_shop: Beef, outlet: Tag, night_market: Moon, bazaar: Tent, souvenir: Gift, crafts: Scissors, luxury: Gem,
  duty_free: Plane, mall: Building2, shopping: ShoppingBag,
};

// Tags, deduplicated across the worker's highlights (words) and props (flags): one key
// per idea, in the order a shopper scans them. 'Open late' is left to the hours, and
// 'Food shopping' to the kind.
const TAGS = [
  { key: "crafts", label: "Local crafts", highlight: ["Local Crafts"], prop: "hasLocalCrafts" },
  { key: "bargain", label: "Bargain / haggle", highlight: ["Bargain Hunting"], prop: "isBargain" },
  { key: "tourist", label: "Tourist favorite", highlight: ["Tourist Favorite", "Tourist Friendly"], prop: "isTouristFav" },
  { key: "dutyfree", label: "Duty free", highlight: ["Duty Free"], prop: "isDutyFree" },
  { key: "outdoor", label: "Open air", highlight: ["Open Air"], prop: "isOutdoor" },
  { key: "food", label: "Food & dining", highlight: ["Food & Dining"], prop: "hasFoodCourt" },
  { key: "fresh", label: "Fresh produce", highlight: ["Fresh Produce"], prop: "hasFreshProduce" },
  { key: "organic", label: "Organic options", highlight: ["Organic Options"] },
  { key: "intl", label: "International foods", highlight: ["International Foods"] },
  { key: "prepared", label: "Prepared foods", highlight: ["Prepared Foods"] },
  { key: "budget", label: "Budget friendly", highlight: ["Budget Friendly"], prop: "isBudget" },
  { key: "parking", label: "Free parking", prop: "hasFreeParking" },
];
function tagsOf(p) {
  const hi = new Set(Array.isArray(p.highlights) ? p.highlights : []);
  const props = p.props || {};
  const out = [];
  if (props.isLuxury || hi.has("Luxury Brands")) out.push({ key: "luxury", label: "Luxury", luxury: true });
  TAGS.forEach((t) => {
    if ((t.highlight || []).some((h) => hi.has(h)) || (t.prop && props[t.prop])) out.push(t);
  });
  return out.slice(0, 3);
}

const nameOf = (p) => p.displayName?.text || p.name || "Shop";

function MoreRow({ label, children }) {
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${W.line}` }}>
      <div style={{ marginBottom: 4, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".12em", textTransform: "uppercase", color: W.iconInk }}>{label}</div>
      <div style={{ fontSize: fs(13.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>{children}</div>
    </div>
  );
}

// ─── SHOP CARD (Shopping.dc.html L86-112) ───────────────────────────────────
function ShopCard({ p, n, isLocal, formatDistance, onDirections, onShowOnMap, highlighted, cardRef, forceExpanded, batchEnrich }) {
  const [expanded, setExpanded] = useState(false);
  const [gallery, setGallery] = useState({ open: false, idx: 0 });
  const [enriched, setEnriched] = useState(null);
  const moreId = useId();
  useEffect(() => { if (forceExpanded) setExpanded(true); }, [forceExpanded]);
  // Real Google photos and hours for planet-DB shops (owned records carry none). The page
  // batch-enriches every visible owned shop in one worker call and hands this card its
  // slice through batchEnrich (undefined: the batch is in flight, wait). A card the batch
  // missed (null) falls back to its own call; both share the worker's per-item cache.
  useEffect(() => {
    if (enriched || p.source !== "owned") return;
    const key = p.id || p.placeId;
    if (key && batchEnrich === undefined) return;
    if (batchEnrich) { if (batchEnrich.matched) setEnriched(batchEnrich); return; }
    callWorker("places/enrich-owned", { id: key, name: nameOf(p), lat: p.lat, lng: p.lng, maxPhotos: 3 })
      .then(({ data }) => { if (data && data.matched) setEnriched(data); }).catch(() => {});
  }, [batchEnrich]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = nameOf(p);
  const photos = (enriched?.photos?.length ? enriched.photos : (p.photos || []))
    .map((x) => (typeof x === "string" ? x : (x?.url || null))).filter(Boolean);
  // The open words read the shop's clock: the enriched weekly hours when the planet-DB
  // row had none (never its cached openNow), else the row's own.
  const statusRow = enriched?.hours?.weekdayDescriptions?.length
    ? { ...p, currentOpeningHours: { weekdayDescriptions: enriched.hours.weekdayDescriptions }, utcOffsetMinutes: enriched.utcOffsetMinutes ?? p.utcOffsetMinutes ?? null }
    : p;
  const os = openStateFor(statusRow, { isLocal });
  const week = (os.week || []).some((d) => d.text) ? os.week : [];
  const KindIcon = SUBTYPE_ICON[p.shoppingSubtype] || ShoppingBag;
  const street = String(p.shortFormattedAddress || p.formattedAddress || "").split(",")[0].trim();
  const dist = Number.isFinite(p.distanceMiles) ? formatDistance(p.distanceMiles) : null;
  const count = Number(p.userRatingCount) || 0;
  const few = p.rating > 0 && count < 5;
  const tags = tagsOf(p);
  const phone = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
  const website = p.websiteUri || null;
  const hasMore = week.length > 0 || !!p.formattedAddress || !!website;

  return (
    <WorldCard world="shopping" as="li" ref={cardRef} style={highlighted ? { boxShadow: `0 0 0 3px ${W.ink}, ${W.cardShadow}` } : undefined}>
      <PhotoOrIcon world="shopping" photos={photos} alt={name} split={photos.length >= 2}
        onClick={photos.length ? (i) => setGallery({ open: true, idx: Number.isFinite(i) ? i : 0 }) : undefined}>
        <NumberMark n={n} world="shopping" />
        {p.venueLabel ? (
          <span style={{ position: "absolute", top: photos.length ? 12 : 20, right: 12, display: "inline-flex", alignItems: "center", gap: 5, minHeight: 24, maxWidth: "calc(100% - 80px)", boxSizing: "border-box", padding: "0 9px 0 8px", borderRadius: 999, background: NEUTRAL.white, fontFamily: MONO, fontSize: fs(9.5), fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase", color: W.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <KindIcon size={12} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />{p.venueLabel}
          </span>
        ) : null}
      </PhotoOrIcon>
      <div style={{ padding: "14px 16px 16px" }}>
        {street ? <CardKicker world="shopping">{street}</CardKicker> : null}
        <CardName world="shopping" as="h3">{name}</CardName>
        <div style={{ marginTop: 2 }}><NameLanguageHelp placeId={p.placeId || p.id} name={name} world="shopping" /></div>
        <FactsLine world="shopping" open={os}
          items={[dist, { rating: p.rating, count, source: "google" },
            few ? <span key="few" style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".1em", color: NEUTRAL.ink3 }}>FEW REVIEWS</span> : null]}
          style={{ marginTop: 6 }} />
        {tags.length > 0 && (
          <TagRow max={3} style={{ marginTop: 10 }}>
            {tags.map((t) => (t.luxury
              ? <WorldTag key={t.key} world="shopping" tone="outline" icon={Gem} style={{ borderColor: W.ink, color: W.ink }}>{t.label}</WorldTag>
              : <WorldTag key={t.key} world="shopping" tone="wash">{t.label}</WorldTag>))}
          </TagRow>
        )}
        <ActionRow world="shopping" name={name} onDirections={() => onDirections(p)} onMap={onShowOnMap} phone={phone}
          onMore={hasMore ? () => setExpanded((e) => !e) : undefined} moreIcon moreExpanded={hasMore ? expanded : undefined} moreControls={hasMore ? moreId : undefined}
          style={{ marginTop: 12 }} />
        {hasMore && expanded && (
          <div id={moreId} style={{ marginTop: 12 }}>
            {week.length > 0 && (
              <MoreRow label="Hours">
                <dl style={{ margin: 0 }}>
                  {week.map((d) => (
                    <div key={d.day} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0", fontWeight: d.today ? 600 : 400, color: d.today ? W.ink : NEUTRAL.ink2 }}>
                      <dt>{d.day}</dt>
                      <dd style={{ margin: 0, textAlign: "right", color: /^closed$/i.test(String(d.text || "")) ? NEUTRAL.stamp : undefined }}>{d.text || "Not listed"}</dd>
                    </div>
                  ))}
                </dl>
              </MoreRow>
            )}
            {p.formattedAddress ? <MoreRow label="Address">{p.formattedAddress}</MoreRow> : null}
            {website ? (
              <MoreRow label="Website">
                <button type="button" onClick={() => openPartner(website)}
                  style={{ display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-12px 0", padding: 0, background: "transparent", border: 0, fontFamily: "inherit", fontSize: "inherit", color: W.ink, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer", overflowWrap: "anywhere", textAlign: "left" }}>
                  {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
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

// A plum pin with the card's serif numeral; the one picked in blush with a plum ring.
function pinHtml(n, active) {
  const sz = active ? 34 : 28;
  return `<div style="width:${sz}px;height:${sz}px;box-sizing:border-box;border-radius:50%;background:${active ? W.plate : W.ink};border:${active ? 3 : 2}px solid ${active ? W.ink : NEUTRAL.white};box-shadow:0 3px 10px rgba(21,23,28,.3);display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:${active ? 17 : 15}px;line-height:1;color:${active ? W.ink : NEUTRAL.white};">${n}</div>`;
}

function popupHtml(p, i, isLocal, fmt) {
  const os = openStateFor(p, { isLocal });
  const tone = { open: NEUTRAL.open, closed: NEUTRAL.stamp, muted: NEUTRAL.ink3 }[os.tone] || NEUTRAL.ink2;
  const dist = Number.isFinite(p.distanceMiles) && fmt ? fmt(p.distanceMiles) : "";
  const btn = (call, label, solid) => `<button onclick="${call}" style="flex:1;min-height:44px;border:${solid ? "0" : `1px solid ${W.line}`};border-radius:12px;background:${solid ? W.cta : "#fff"};color:${solid ? W.ctaInk : NEUTRAL.ink2};font-weight:600;font-size:${mapFs(13)};cursor:pointer;font-family:inherit;">${label}</button>`;
  const xSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${NEUTRAL.ink3}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  return `<div style="width:256px;position:relative;font-family:inherit;">`
    + `<button onclick="window._gsMapInstance&&window._gsMapInstance.closePopup()" aria-label="Close" style="position:absolute;top:4px;right:4px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;cursor:pointer;">${xSvg}</button>`
    + `<div style="padding:14px 16px 16px;">`
    + `<div style="padding-right:36px;font-family:${MONO};font-size:${mapFs(10)};line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:${W.ink};">${esc(p.venueLabel || "Shopping")}</div>`
    + `<button onclick="window._gsViewShop&&window._gsViewShop(${i})" style="display:block;margin:4px 0 0;padding:0 30px 0 0;border:0;background:transparent;text-align:left;cursor:pointer;font-family:${SERIF};font-size:${mapFs(20)};line-height:1.15;color:${NEUTRAL.ink};">${esc(nameOf(p))}</button>`
    + `<div style="margin-top:6px;font-size:${mapFs(13)};line-height:1.4;color:${NEUTRAL.ink2};"><span style="font-weight:600;color:${tone};">${esc(os.word)}</span>${dist ? ` · ${esc(dist)}` : ""}</div>`
    + (p.formattedAddress ? `<div style="margin-top:4px;font-size:${mapFs(12.5)};line-height:1.4;color:${NEUTRAL.ink3};">${esc(p.formattedAddress)}</div>` : "")
    + `<div style="display:flex;gap:8px;margin-top:12px;">${btn(`window._gsShopDirs&&window._gsShopDirs(${i})`, "Directions", true)}${btn(`window._gsViewShop&&window._gsViewShop(${i})`, "Details", false)}</div>`
    + `</div></div>`;
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ShoppingFinder() {
  const isTablet = useIsTablet();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const forceNextRef = useRef(false);
  const handleRefresh = () => { forceNextRef.current = true; setRefreshTick((t) => t + 1); };
  const [viewMode, setViewMode] = useState("list");
  const [showSheet, setShowSheet] = useState(false);
  const [category, setCategory] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [luxOnly, setLuxOnly] = useState(false);
  const [foodOnly, setFoodOnly] = useState(false);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [directionsTo, setDirectionsTo] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [activeMapPin, setActiveMapPin] = useState(null);
  const cardRefs = useRef({});
  const mapRef = useRef(null);
  const mapInstRef = useRef(null);
  const markersRef = useRef([]);

  const { activeLocation, locationMode } = useLocation();
  // Physically here: the device clock is the shop's clock (mirrors LocationContext's isLive).
  const isLocal = locationMode === "current" || activeLocation?.placeType === "current_location";
  // Smart Search hands a category over in router state (the spine's shopping-query
  // mapping); it selects that kind once.
  const routerLocation = useRouterLocation();
  const presetCatRanRef = useRef(false);
  useEffect(() => {
    const pc = routerLocation.state?.presetCategory;
    if (presetCatRanRef.current || !pc) return;
    if (KNOWN_CATEGORIES.has(pc)) { presetCatRanRef.current = true; setCategory(pc); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state?.presetCategory]);
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);

  // ── Fetch ──
  useEffect(() => {
    if (!lat || !lng) { setLoading(false); return undefined; } // no location yet: never spin
    let cancelled = false;
    setLoading(true);
    setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;
    (async () => {
      try {
        // Google's shops (getShoppingPlaces): a 25-mile wide net, nearest first, the kind
        // filtered on the server.
        const { data, error: workerError } = await callWorker(ROUTE.getShoppingPlaces, { latitude: lat, longitude: lng, radius: 25 * 1609, maxResults: 30, category, forceRefresh: force });
        if (cancelled) return;
        if (workerError) throw new Error(workerError);
        const raw = data?.places || [];
        // distanceMiles on every row, so the unit formatter has a number.
        setPlaces(raw.map((p) => {
          if (p.distanceMiles != null || !p.lat || !p.lng) return p;
          const R = 3959, dLat = (p.lat - lat) * Math.PI / 180, dLon = (p.lng - lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          return { ...p, distanceMiles: R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
        }));
      } catch (e) {
        if (cancelled) return;
        setPlaces([]); // a failed fetch must not leave the old list's count on screen
        setError("Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng, category, refreshTick]);

  const filtered = useMemo(() => {
    let r = places;
    if (openOnly) r = r.filter((p) => openStateFor(p, { isLocal }).status === "open"); // the cards' own clock rule
    if (luxOnly) r = r.filter((p) => p.props?.isLuxury);
    if (foodOnly) r = r.filter((p) => p.shoppingFamily === "food_shopping");
    return r;
  }, [places, openOnly, luxOnly, foodOnly, isLocal]);

  // Batch-enrich every visible planet-DB shop in calls of 20 (the worker's cap).
  // ownedEnrich[key]: undefined while pending, the payload, or null when missed (that card
  // then makes its own call; the cache is shared server-side).
  const [ownedEnrich, setOwnedEnrich] = useState({});
  const ownedEnrichAsked = useRef(new Set());
  useEffect(() => {
    const owned = filtered.filter((p) => p.source === "owned")
      .map((p) => ({ id: p.id || p.placeId, name: nameOf(p), lat: p.lat, lng: p.lng }))
      .filter((p) => p.id && !ownedEnrichAsked.current.has(p.id));
    if (!owned.length) return;
    owned.forEach((p) => ownedEnrichAsked.current.add(p.id));
    (async () => {
      for (let i = 0; i < owned.length; i += 20) {
        const chunk = owned.slice(i, i + 20);
        const { data } = await callWorker("places/enrich-owned", { places: chunk, maxPhotos: 3 });
        const res = data?.results || {};
        setOwnedEnrich((prev) => { const nx = { ...prev }; chunk.forEach((p) => { nx[p.id] = res[p.id] ?? null; }); return nx; });
      }
    })();
  }, [filtered]);

  const settled = !!lat && !!lng && !loading && !error;
  const openCount = useMemo(() => filtered.filter((p) => openStateFor(p, { isLocal }).status === "open").length, [filtered, isLocal]);
  const hasFilters = openOnly || luxOnly || foodOnly;
  const clearFilters = () => { setOpenOnly(false); setLuxOnly(false); setFoodOnly(false); };
  const pickCategory = (id) => {
    const next = category === id ? "all" : id;
    setCategory(next);
    if (next !== "all") logSearch("shopping", CATEGORIES.find((c) => c.id === next)?.label || next, { category: next });
  };

  const handleShowOnMap = (index) => {
    setViewMode("map");
    setActiveMapPin(index);
    setTimeout(() => {
      const p = filtered[index];
      if (mapInstRef.current && p?.lat && p?.lng) {
        mapInstRef.current.setView([p.lat, p.lng], 17);
        markersRef.current[index]?.openPopup();
      }
    }, 350);
  };
  const viewInList = (i) => {
    setViewMode("list");
    setExpandedIdx(i);
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
      window._gsViewShop = (i) => { map.closePopup(); viewInList(i); };
      window._gsShopDirs = (i) => setDirectionsTo(filtered[i]);
      // Where you are: the blue dot, its words below it (clear of the popups above).
      window.L.marker([lat, lng], { icon: window.L.divIcon({ html: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>', iconSize: [16, 16], className: "" }) })
        .addTo(map)
        .bindTooltip(`<div style="padding:5px 9px;font-family:inherit;font-weight:600;color:${NEUTRAL.ink};font-size:${mapFs(11)};">You are here</div>`, { permanent: true, direction: "bottom", opacity: 1, offset: [0, 12], className: "gs-user-tooltip", interactive: false });
      filtered.forEach((p, i) => {
        if (!p.lat || !p.lng) return;
        const isActive = activeMapPin === i;
        const size = isActive ? 34 : 28;
        const marker = window.L.marker([p.lat, p.lng], { icon: window.L.divIcon({ html: pinHtml(i + 1, isActive), iconSize: [size, size], className: "" }), keyboard: true, title: `${i + 1}. ${nameOf(p)}` }).addTo(map);
        marker.bindPopup(popupHtml(p, i, isLocal, formatDistance), { maxWidth: 280, closeButton: false, autoPan: true, autoPanPaddingTopLeft: [0, 160], autoPanPaddingBottomRight: [20, 20], keepInView: true, className: "gs-popup" });
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
      delete window._gsViewShop;
      delete window._gsShopDirs;
      if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
    };
  }, [viewMode, filtered, lat, lng, activeMapPin, unit, isLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="font-sans" style={{ background: W.paper, minHeight: "100vh", paddingTop: 12 }}>

      {/* ── THE PLATE + CONTROLS (Shopping.dc.html L26-84): the count on the swing tag,
          then the filters with List | Map, and the kinds of shop. ── */}
      <FinderHeader
        world="shopping"
        count={null}
        plateTag={settled && filtered.length > 0 ? <SwingTag size="plate" label={`${filtered.length} nearby`} /> : null}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh shopping"
        location={{ label: locLabel, onChange: () => setShowLocPicker(true) }}
        unit={{ value: unit, onChange: setUnit }}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
      >
        <ChipRow label="Filters">
          <WorldChip world="shopping" icon={Clock} label="Open now" active={openOnly} onClick={() => setOpenOnly((o) => !o)} />
          <WorldChip world="shopping" icon={Gem} label="Luxury" active={luxOnly} onClick={() => setLuxOnly((o) => !o)} />
          <WorldChip world="shopping" icon={SlidersHorizontal} label={foodOnly ? "Filters · 1" : "Filters"} opensSheet onClick={() => setShowSheet(true)} />
        </ChipRow>
        <ChipRow label="Kinds of shop">
          {CATEGORIES.map((c) => (
            <WorldChip key={c.id} world="shopping" label={c.label} active={category === c.id} onClick={() => pickCategory(c.id)} />
          ))}
        </ChipRow>
        {/* The result line, and List | Map right above the results it switches. */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, marginTop: 2 }}>
          <div style={{ minWidth: 0 }}>
            {settled && filtered.length > 0 ? <ResultLine live style={{ margin: 0 }} items={[{ count: filtered.length, label: filtered.length === 1 ? "shop" : "shops" }, { count: openCount, label: "open now" }]} /> : null}
          </div>
          <WorldSegmented world="shopping" label="View" mode="pressed" value={viewMode} onChange={(v) => { if (v) setViewMode(v); }}
            options={[{ value: "list", label: "List" }, { value: "map", label: "Map" }]} style={{ flexShrink: 0, marginLeft: "auto" }} />
        </div>
      </FinderHeader>

      {(!lat || !lng) ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 24 }}>
          <FinderEmptyState world="shopping" icon={MapPin} title="Choose a location" hint="Malls, markets, boutiques, souks and night markets near where you are."
            actionLabel="Choose a location" onAction={() => setShowLocPicker(true)} />
        </div>
      ) : loading ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14 }}>
          <WorldSkeleton world="shopping" variant="card" count={2} label="Finding shopping nearby" />
        </div>
      ) : error ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 24 }}>
          <FinderEmptyState world="shopping" icon={AlertCircle} title="Couldn’t load shopping" hint={error} actionLabel="Try again" onAction={handleRefresh}
            secondaryLabel="Search somewhere else" onSecondary={() => setShowLocPicker(true)} />
        </div>
      ) : viewMode === "list" ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14, paddingBottom: 24 }}>
          {filtered.length === 0 ? (
            <FinderEmptyState world="shopping" icon={SearchX} title="No shops found"
              hint={hasFilters ? "No shops here match these filters." : "Nothing within 25 miles of this location."}
              actionLabel="Search somewhere else" onAction={() => setShowLocPicker(true)}
              secondaryLabel={hasFilters ? "Clear filters" : undefined} onSecondary={hasFilters ? clearFilters : undefined} />
          ) : (
            <ol aria-label="Shops" style={worldGrid(isTablet)}>
              {filtered.map((p, i) => (
                <ShopCard key={p.id || i} p={p} n={i + 1} isLocal={isLocal} formatDistance={formatDistance}
                  onDirections={setDirectionsTo} onShowOnMap={() => handleShowOnMap(i)} highlighted={highlightIdx === i}
                  cardRef={(el) => { cardRefs.current[i] = el; }} forceExpanded={expandedIdx === i} batchEnrich={ownedEnrich[p.id || p.placeId]} />
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 12, paddingBottom: 24 }}>
          <div style={{ position: "relative", height: "calc(100vh - 300px)", minHeight: 360, borderRadius: 16, overflow: "hidden", border: `1px solid ${W.line}` }}>
            <div ref={mapRef} role="region" aria-label="Map of shops" style={{ height: "100%", width: "100%" }} />
            <button type="button" onClick={() => setViewMode("list")} aria-label="Back to the list"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, border: `1px solid ${W.line}`, borderRadius: 999, background: NEUTRAL.white, boxShadow: "0 2px 10px rgba(21,23,28,.15)", cursor: "pointer" }}>
              <X size={20} color={W.ink} strokeWidth={2} aria-hidden="true" />
            </button>
            {/* The legend, in words. */}
            <div role="group" aria-label="Legend" style={{ position: "absolute", bottom: 14, left: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 5, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.95)", border: `1px solid ${W.line}`, boxShadow: "0 2px 10px rgba(21,23,28,.10)" }}>
              {[
                { bg: W.ink, border: NEUTRAL.white, label: "Shop" },
                { bg: W.plate, border: W.ink, label: "Picked" },
              ].map((k) => (
                <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(11), lineHeight: 1.2, color: NEUTRAL.ink2 }}>
                  <span aria-hidden="true" style={{ width: 12, height: 12, boxSizing: "border-box", borderRadius: 999, background: k.bg, border: `2px solid ${k.border}`, boxShadow: "0 0 0 1px rgba(21,23,28,.2)" }} />
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

      {/* Filters: food shopping only (groceries, markets and fresh produce). */}
      <FilterSheet world="shopping" open={showSheet} onClose={() => setShowSheet(false)} title="Filters"
        onClear={foodOnly ? () => setFoodOnly(false) : undefined}>
        <FilterGroupLabel>Show only</FilterGroupLabel>
        <FilterToggleRow world="shopping" icon={ShoppingCart} label="Food shopping only" description="Groceries, markets and fresh produce" checked={foodOnly} onChange={() => setFoodOnly((x) => !x)} />
      </FilterSheet>

      <LocationModePicker isOpen={showLocPicker} onClose={() => setShowLocPicker(false)} />
      {directionsTo && (
        <MapAppSelector
          isOpen={true}
          onClose={() => setDirectionsTo(null)}
          destination={{ name: nameOf(directionsTo), address: directionsTo.formattedAddress || directionsTo.shortFormattedAddress || directionsTo.vicinity || "", latitude: directionsTo.lat, longitude: directionsTo.lng }}
          userLat={lat}
          userLng={lng}
        />
      )}
    </div>
  );
}
