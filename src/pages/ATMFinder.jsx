// ATMFinder: Carbon Copy (the new look, ATMs.dc.html; the founder's pick of 2026-10-13).
//
// The cornflower plate (ATMS · N NEAR YOU · K OPEN NOW, "Cash, nearby", the location and
// the unit), then Open only / Open 24 hours / Fee-free / Banks, the fee note and the
// result line; numbered cards with a receipt (network, fees, today's hours); a map with
// word-only popups.
//
// Honest by design: no ranking we can't ground (no "Best overall", no "Safest");
// "Fee-free" only for the Allpoint, MoneyPass and CO-OP networks; the receipt's fees say
// "Typically …" only for a bank or network we matched by name, and an independent ATM's
// fees read "Not listed: ask your bank", never a made-up range. Open words read the
// place's clock (Google's utcOffsetMinutes; the device's in current-location mode).
import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { openPartner } from "@/lib/openPartner";
import { openStateFor } from "@/lib/openState";
import AtmAIDetails from "@/components/AtmAIDetails";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import { WorldChip, ChipRow, ResultLine, WorldNote } from "@/components/finder/FinderControls";
import { WorldCard, worldGrid, NumberMark, FactsLine, WorldTag, TagRow, CardKicker, CardName, QuietRows, ActionRow, WorldSkeleton } from "@/components/finder/FinderCard";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet from "@/components/finder/FilterSheet";
import PhotoGalleryModal from "@/components/coffee/PhotoGalleryModal";
import MapAppSelector from "@/components/MapAppSelector";
import { AlertCircle, BadgeCheck, Clock, Info, Landmark, MapPin, SearchX, Timer, X } from "lucide-react";
import { WORLD, NEUTRAL, fs } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

const W = WORLD.atm;
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

// The networks whose members withdraw without a surcharge: the only "Fee-free" ATMs.
const FEE_FREE = new Set(["Allpoint", "MoneyPass", "CO-OP"]);

// Where the ATM stands, in words (the worker's venueType).
const VENUE_LABELS = {
  airport: "Airport", transit: "Transit", hospital: "Hospital", hotel: "Hotel", gas: "Gas station",
  convenience: "Convenience store", mall: "Shopping mall", grocery: "Grocery", entertainment: "Entertainment",
  bank: "Bank branch", education: "Campus", community: "Community", liquor: "Corner shop",
  theme_park: "Theme park", casino: "Casino", standalone: "Standalone ATM",
};

const nameOf = (atm) => atm.displayName?.text || atm.name || "ATM";
const knownNetwork = (atm) => (atm.network && atm.network !== "Independent" ? atm.network : null);

// Coordinates, distance and up to two photo URLs on each row.
function enrichATM(atm, userLat, userLng) {
  const lat = atm.location?.latitude || atm.lat || 0;
  const lng = atm.location?.longitude || atm.lng || 0;
  let distanceMiles = Number.isFinite(atm.distanceMiles) ? atm.distanceMiles : null;
  if (distanceMiles == null && userLat && userLng && lat && lng) {
    const R = 3959;
    const dLat = (lat - userLat) * Math.PI / 180;
    const dLon = (lng - userLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    distanceMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  let photos = Array.isArray(atm.photos) ? atm.photos.map((p) => (typeof p === "string" ? p : p?.url)).filter(Boolean).slice(0, 2) : [];
  if (!photos[0] && atm.photoUrl) photos[0] = atm.photoUrl;
  if (!photos[1] && atm.photoUrl2) photos[1] = atm.photoUrl2;
  photos = photos.filter(Boolean);
  return { ...atm, lat, lng, distanceMiles, photos };
}

// Open around the clock: all seven of Google's lines say so (needs no time zone).
const is24 = (atm) => openStateFor(atm).allDay === true;
// Open now, as the cards say it: only when the listed hours put the place open at its
// own clock. (Google's open flag rides in a cache and can be days old, and a count that
// disagrees with "Hours not listed" on the card would not be honest.)
const openNow = (atm, isLocal) => openStateFor(atm, { isLocal }).status === "open";

// The receipt's fees. A bank or network matched by name gets what its ATMs usually
// charge, hedged with "Typically"; anything else reads "Not listed: ask your bank".
function feeLines(atm) {
  if (!knownNetwork(atm) || !atm.feeInfo) return ["Not listed: ask your bank"];
  const info = String(atm.feeInfo).trim();
  const lines = [`Typically ${info.charAt(0).toLowerCase()}${info.slice(1)}`];
  const s = String(atm.surcharge || "").replace(/\s*non-customer$/i, "").trim();
  if (s && !/^\$0\b/.test(s)) lines.push(/^varies/i.test(s) ? "Others: varies, plus your bank’s fee" : `Others ${s} + your bank’s fee`);
  return lines;
}

// The receipt (ATMs.dc.html L104-110): copy paper with a dashed cornflower tear line and
// mono rows: who runs it, the fees, and today's hours at the place.
function Receipt({ atm, os }) {
  const network = knownNetwork(atm) ? (atm.networkName || atm.network) : "Independent";
  const hours = os.todayText || (os.status === "hours" ? os.word : null) || "Not listed";
  const rows = [["Network", [network]], ["Fees", feeLines(atm)], ["Hours", [hours]]];
  return (
    <div style={{ position: "relative", marginTop: 10, padding: "10px 12px", borderRadius: 12, background: W.receipt }}>
      <span aria-hidden="true" style={{ position: "absolute", top: 0, left: 10, right: 10, borderTop: `1px dashed ${W.tearLine}` }} />
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 10, rowGap: 4, fontFamily: MONO, fontSize: fs(11.5), lineHeight: 1.4 }}>
        {rows.map(([k, lines]) => (
          <React.Fragment key={k}>
            <dt style={{ minWidth: 56, letterSpacing: ".08em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>{k}</dt>
            <dd style={{ margin: 0, color: W.ink, overflowWrap: "break-word" }}>{lines.map((l, i) => <div key={i}>{l}</div>)}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
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

// ─── ATM CARD (ATMs.dc.html L92-129) ────────────────────────────────────────
// Numbered by the card-chip mark; a 16:9 photo or the 52px strip; the ATM's network as a
// white pill (never for an independent ATM). Then the venue and street (mono), the serif
// name, the facts line (open words, distance), at most two tags (24/7, Fee-free
// network), the receipt, AI details, and Directions / Map / Call / More (hours, website).
function ATMCard({ atm, n, isLocal, formatDistance, onDirections, onShowOnMap, highlighted, cardRef }) {
  const [expanded, setExpanded] = useState(false);
  const [gallery, setGallery] = useState({ open: false, idx: 0 });
  const [enriched, setEnriched] = useState(null);
  const moreId = useId();

  // A planet-DB ATM (its id is a uuid) fetches its photo when the card mounts; a Google
  // row without photos is Google saying it has none.
  useEffect(() => {
    if (enriched || (atm.photos && atm.photos.length) || !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(atm.id || atm.placeId || ""))) return;
    callWorker("places/enrich-owned", { id: atm.id || atm.placeId, name: nameOf(atm), lat: atm.lat, lng: atm.lng, maxPhotos: 2 })
      .then(({ data }) => { if (data && data.matched) setEnriched(data); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const name = nameOf(atm);
  const photos = (enriched?.photos?.length ? enriched.photos : (atm.photos || []))
    .map((p) => (typeof p === "string" ? p : (p?.url || p?.full || p?.thumbnail || null))).filter(Boolean);
  const os = openStateFor(atm, { isLocal });
  const dist = Number.isFinite(atm.distanceMiles) ? formatDistance(atm.distanceMiles) : null;
  const network = knownNetwork(atm);
  const street = String(atm.shortFormattedAddress || atm.formattedAddress || "").split(",")[0].trim();
  const kicker = [VENUE_LABELS[atm.venueType] || "ATM", street].filter(Boolean).join(" · ");
  const tags = [
    os.allDay ? { key: "24", label: "24/7", tone: "solid" } : null,
    network && FEE_FREE.has(network) ? { key: "free", label: "Fee-free network", tone: "wash", icon: BadgeCheck } : null,
  ].filter(Boolean);
  const phone = atm.nationalPhoneNumber || atm.internationalPhoneNumber || null;
  const website = atm.websiteUri || atm.website || null;
  const week = (os.week || []).some((d) => d.text) ? os.week : [];
  const hasMore = week.length > 0 || !!website;

  return (
    <WorldCard world="atm" as="li" ref={cardRef} style={highlighted ? { boxShadow: `0 0 0 3px ${W.ink}, ${W.cardShadow}` } : undefined}>
      <PhotoOrIcon world="atm" photos={photos} alt={name} onClick={photos.length ? (i) => setGallery({ open: true, idx: Number.isFinite(i) ? i : 0 }) : undefined}>
        <NumberMark n={n} world="atm" place={photos.length ? "corner" : "middle"} />
        {network && (
          <span style={{ position: "absolute", top: photos.length ? 12 : 15, right: 12, display: "flex", alignItems: "center", minHeight: 22, maxWidth: "calc(100% - 96px)", boxSizing: "border-box", padding: "0 8px", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${W.line}`, fontFamily: MONO, fontSize: fs(11), fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: W.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {atm.networkName || network}
          </span>
        )}
      </PhotoOrIcon>
      <div style={{ padding: "12px 16px 16px" }}>
        <CardKicker world="atm">{kicker}</CardKicker>
        <CardName world="atm" as="h3">{name}</CardName>
        <FactsLine world="atm" open={os} items={[dist]} style={{ marginTop: 4 }} />
        {tags.length > 0 && (
          <TagRow max={3} style={{ marginTop: 10 }}>
            {tags.map((t) => <WorldTag key={t.key} world="atm" tone={t.tone} icon={t.icon}>{t.label}</WorldTag>)}
          </TagRow>
        )}
        <Receipt atm={atm} os={os} />
        <QuietRows world="atm" style={{ marginTop: 12 }}>
          <AtmAIDetails world="atm" placeId={atm.placeId || atm.id} placeName={name} page="ATMFinder" />
        </QuietRows>
        <ActionRow world="atm" name={name} onDirections={() => onDirections(atm)} onMap={onShowOnMap} phone={phone}
          onMore={hasMore ? () => setExpanded((e) => !e) : undefined} moreIcon moreExpanded={hasMore ? expanded : undefined} moreControls={hasMore ? moreId : undefined}
          style={{ marginTop: 4 }} />
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
// Text for Leaflet's HTML strings: names and addresses come from Google, so every one is
// escaped.
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mapFs = (px) => `calc(${px}px * var(--fs, 1))`;

// A pin with the card's serif numeral: a bank or network ATM on cornflower, an
// independent one on white; the one picked in carbon.
function pinHtml(atm, n, active) {
  const sz = active ? 34 : 28;
  const bg = active ? W.ink : (knownNetwork(atm) ? W.plate : NEUTRAL.white);
  const ink = active ? NEUTRAL.white : W.ink;
  return `<div style="width:${sz}px;height:${sz}px;box-sizing:border-box;border-radius:50%;background:${bg};border:${active ? 3 : 2}px solid ${active ? NEUTRAL.white : W.ink};box-shadow:0 3px 10px rgba(21,23,28,.3);display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:${active ? 17 : 15}px;line-height:1;color:${ink};">${n}</div>`;
}

// A word-only popup: the venue and network, the name (it opens the card), the open words,
// the address and the distance; Directions (cornflower, carbon label) and Details.
function popupHtml(atm, i, isLocal, fmt) {
  const os = openStateFor(atm, { isLocal });
  const tone = { open: NEUTRAL.open, closed: NEUTRAL.stamp, muted: NEUTRAL.ink3 }[os.tone] || NEUTRAL.ink2;
  const kicker = [VENUE_LABELS[atm.venueType] || "ATM", knownNetwork(atm) ? (atm.networkName || atm.network) : null].filter(Boolean).join(" · ");
  const dist = Number.isFinite(atm.distanceMiles) && fmt ? fmt(atm.distanceMiles) : "";
  const addr = atm.formattedAddress || atm.shortFormattedAddress || "";
  const btn = (call, label, solid) => `<button onclick="${call}" style="flex:1;min-height:44px;border:${solid ? "0" : `1px solid ${W.line}`};border-radius:12px;background:${solid ? W.cta : "#fff"};color:${solid ? W.ctaInk : NEUTRAL.ink2};font-weight:600;font-size:${mapFs(13)};cursor:pointer;font-family:inherit;">${label}</button>`;
  const xSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${NEUTRAL.ink3}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  return `<div style="width:256px;position:relative;font-family:inherit;">`
    + `<button onclick="window._gsMapInstance&&window._gsMapInstance.closePopup()" aria-label="Close" style="position:absolute;top:4px;right:4px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;cursor:pointer;">${xSvg}</button>`
    + `<div style="padding:14px 16px 16px;">`
    + `<div style="padding-right:36px;font-family:${MONO};font-size:${mapFs(10)};line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:${W.ink};">${esc(kicker)}</div>`
    + `<button onclick="window._gsViewATM&&window._gsViewATM(${i})" style="display:block;margin:4px 0 0;padding:0 30px 0 0;border:0;background:transparent;text-align:left;cursor:pointer;font-family:${SERIF};font-size:${mapFs(20)};line-height:1.15;color:${NEUTRAL.ink};">${esc(nameOf(atm))}</button>`
    + `<div style="margin-top:6px;font-size:${mapFs(13)};line-height:1.4;color:${NEUTRAL.ink2};"><span style="font-weight:600;color:${tone};">${esc(os.word)}</span>${dist ? ` · ${esc(dist)}` : ""}</div>`
    + (addr ? `<div style="margin-top:4px;font-size:${mapFs(12.5)};line-height:1.4;color:${NEUTRAL.ink3};">${esc(addr)}</div>` : "")
    + `<div style="display:flex;gap:8px;margin-top:12px;">${btn(`window._gsATMDirs&&window._gsATMDirs(${i})`, "Directions", true)}${btn(`window._gsViewATM&&window._gsViewATM(${i})`, "Details", false)}</div>`
    + `</div></div>`;
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function ATMFinderPage() {
  const isTablet = useIsTablet();
  const [atms, setATMs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const forceNextRef = useRef(false);
  const handleRefresh = () => { forceNextRef.current = true; setRefreshTick((t) => t + 1); };
  const [viewMode, setViewMode] = useState("list");
  const [bankFilter, setBankFilter] = useState("all");
  const [showBankSheet, setShowBankSheet] = useState(false);
  const [availableBanks, setAvailableBanks] = useState([]);
  const [openOnly, setOpenOnly] = useState(false);
  const [open24Only, setOpen24Only] = useState(false);
  const [feeFreeOnly, setFeeFreeOnly] = useState(false);
  const [radius, setRadius] = useState(25); // a wide net, nearest first; no radius control
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [directionsATM, setDirectionsATM] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [activeMapPin, setActiveMapPin] = useState(null);

  const cardRefs = useRef({});
  const mapRef = useRef(null);
  const mapInstRef = useRef(null);
  const markersRef = useRef([]);

  const { activeLocation, locationMode } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const locLabel = getLocationLabel(activeLocation);
  const isCity = isCityLocation(activeLocation);
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);
  // The device's clock is the place's clock only in current-location mode.
  const isLocal = locationMode === "current";

  useEffect(() => {
    setRadius(25); // the fixed wide net
  }, [activeLocation?.placeId]);

  // ── Fetch ──
  useEffect(() => {
    if (!lat || !lng) { setLoading(false); return undefined; } // no location yet: never spin
    let cancelled = false;
    setLoading(true);
    setError(null);
    const force = forceNextRef.current; forceNextRef.current = false;
    (async () => {
      try {
        // Google's ATMs (handleAtmLocations): it returns the bank list and each ATM's
        // open status, so Banks and Open only work on the server.
        const { data, error: workerError } = await callWorker(ROUTE.getATMLocations, {
          latitude: lat, longitude: lng, radius: radius * 1609, maxResults: 40, bankFilter, openOnly, forceRefresh: force,
        });
        if (cancelled) return;
        if (workerError) throw new Error(workerError);
        const rawList = data?.atms || data?.places || [];
        if (rawList.length > 0) {
          setATMs(rawList.map((p) => enrichATM(p, lat, lng)));
          if (data?.banks?.length > 0) setAvailableBanks(data.banks);
        } else {
          // No ATMs is not an error: the empty state offers another place. Only a real
          // message from the worker is one.
          setATMs([]);
          if (data?.error) setError(data.error);
        }
      } catch (e) {
        if (cancelled) return;
        setATMs([]); // a failed fetch must not leave the old list's count on screen
        setError(`Failed to load: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng, radius, bankFilter, openOnly, refreshTick]);

  // Open 24 hours and Fee-free filter here; nearest first as the worker sent them.
  const filtered = useMemo(() => {
    let r = atms;
    if (open24Only) r = r.filter(is24);
    if (feeFreeOnly) r = r.filter((a) => FEE_FREE.has(knownNetwork(a)));
    return r;
  }, [atms, open24Only, feeFreeOnly]);

  const handleShowOnMap = (index) => {
    setViewMode("map");
    setActiveMapPin(index);
    setTimeout(() => {
      const atm = filtered[index];
      if (mapInstRef.current && atm?.lat && atm?.lng) {
        mapInstRef.current.setView([atm.lat, atm.lng], 17);
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
      window._gsViewATM = (i) => { map.closePopup(); viewInList(i); };
      window._gsATMDirs = (i) => setDirectionsATM(filtered[i]);
      // Where you are: the blue dot, its words below it (clear of the popups above).
      window.L.marker([lat, lng], { icon: window.L.divIcon({ html: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>', iconSize: [16, 16], className: "" }) })
        .addTo(map)
        .bindTooltip(`<div style="padding:5px 9px;font-family:inherit;font-weight:600;color:${NEUTRAL.ink};font-size:${mapFs(11)};">You are here</div>`, { permanent: true, direction: "bottom", opacity: 1, offset: [0, 12], className: "gs-user-tooltip", interactive: false });
      filtered.forEach((atm, i) => {
        if (!atm.lat || !atm.lng) return;
        const isActive = activeMapPin === i;
        const size = isActive ? 34 : 28;
        const marker = window.L.marker([atm.lat, atm.lng], { icon: window.L.divIcon({ html: pinHtml(atm, i + 1, isActive), iconSize: [size, size], className: "" }), keyboard: true, title: `${i + 1}. ${nameOf(atm)}` }).addTo(map);
        marker.bindPopup(popupHtml(atm, i, isLocal, formatDistance), { maxWidth: 280, closeButton: false, autoPan: true, autoPanPaddingTopLeft: [0, 160], autoPanPaddingBottomRight: [20, 20], keepInView: true, className: "gs-popup" });
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
      delete window._gsViewATM;
      delete window._gsATMDirs;
      if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
    };
  }, [viewMode, filtered, lat, lng, activeMapPin, unit, isLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  // The counts are only true once a fetch for this place has finished.
  const settled = !!lat && !!lng && !loading && !error;
  const stats = {
    total: filtered.length,
    banks: filtered.filter((a) => knownNetwork(a)).length,
    open: filtered.filter((a) => openNow(a, isLocal)).length,
  };
  const hasFilters = openOnly || open24Only || feeFreeOnly || bankFilter !== "all";
  const clearFilters = () => { setOpenOnly(false); setOpen24Only(false); setFeeFreeOnly(false); setBankFilter("all"); };

  return (
    <div className="font-sans" style={{ background: W.paper, minHeight: "100vh", paddingTop: 12 }}>

      {/* ── THE PLATE + CONTROLS (ATMs.dc.html L28-98): the cornflower plate with its
          counts, "Cash, nearby", the location and the unit; under it the chips, the fee
          note and the result line. The card-network chips are left out: no data says
          which networks an ATM takes. ── */}
      <FinderHeader
        world="atm"
        count={settled ? stats.total : null}
        kickerExtras={settled ? [{ count: stats.open, label: "open now" }] : undefined}
        onRefresh={handleRefresh}
        refreshing={loading}
        refreshTitle="Refresh ATMs"
        location={{ label: locLabel, onChange: () => setShowLocPicker(true) }}
        unit={{ value: unit, onChange: setUnit }}
        isCity={isCity}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
      >
        <ChipRow label="Filters" style={{ marginTop: 2 }}>
          <WorldChip world="atm" icon={Clock} label="Open only" active={openOnly} onClick={() => setOpenOnly((o) => !o)} />
          <WorldChip world="atm" icon={Timer} label="Open 24 hours" active={open24Only} onClick={() => setOpen24Only((o) => !o)} />
          <WorldChip world="atm" icon={BadgeCheck} label="Fee-free" active={feeFreeOnly} onClick={() => setFeeFreeOnly((f) => !f)} />
          {availableBanks.length > 0 && (
            <WorldChip world="atm" icon={Landmark} label={bankFilter === "all" ? "Banks" : bankFilter} active={bankFilter !== "all"} opensSheet onClick={() => setShowBankSheet(true)} />
          )}
        </ChipRow>
        <WorldNote world="atm" icon={Info} title="Fees vary by your bank. Check before you withdraw." style={{ marginTop: 10 }} />
        {settled && <ResultLine live items={[{ count: stats.banks, label: "banks" }, { count: stats.open, label: "open now" }]} />}
      </FinderHeader>

      {/* ── CONTENT ── */}
      {(!lat || !lng) ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 28 }}>
          <FinderEmptyState world="atm" icon={MapPin} title="Choose a location" reason="Use your current position or pick a city to find ATMs nearby."
            actionLabel="Choose a location" onAction={() => setShowLocPicker(true)} />
        </div>
      ) : loading ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14 }}>
          <WorldSkeleton world="atm" variant="card" count={2} label="Finding ATMs nearby" />
        </div>
      ) : error ? (
        /* Every search already starts at the 25-mile cap, so there is no radius to widen:
           try again, or search somewhere else. */
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 28 }}>
          <FinderEmptyState world="atm" icon={AlertCircle} title="Couldn’t load ATMs" reason={error} actionLabel="Try again" onAction={handleRefresh}
            secondaryLabel="Search somewhere else" onSecondary={() => setShowLocPicker(true)} />
        </div>
      ) : viewMode === "list" ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 14, paddingBottom: isTablet ? 170 : 100 }}>
          {filtered.length === 0 ? (
            <FinderEmptyState world="atm" icon={SearchX} title="No ATMs found"
              reason={hasFilters ? "No ATMs here match these filters." : "Nothing within 25 miles of this location."}
              actionLabel="Search somewhere else" onAction={() => setShowLocPicker(true)}
              secondaryLabel={hasFilters ? "Clear filters" : undefined} onSecondary={hasFilters ? clearFilters : undefined} />
          ) : (
            <ol aria-label="ATMs" style={worldGrid(isTablet)}>
              {filtered.map((atm, i) => (
                <ATMCard key={atm.id || atm.placeId || i} atm={atm} n={i + 1} isLocal={isLocal} formatDistance={formatDistance}
                  onDirections={setDirectionsATM} onShowOnMap={() => handleShowOnMap(i)} highlighted={highlightIdx === i}
                  cardRef={(el) => { cardRefs.current[i] = el; }} />
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 12, paddingBottom: 100 }}>
          <div style={{ position: "relative", height: "calc(100vh - 300px)", minHeight: 360, borderRadius: 16, overflow: "hidden", border: `1px solid ${W.line}` }}>
            <div ref={mapRef} role="region" aria-label="Map of ATMs" style={{ height: "100%", width: "100%" }} />
            <button type="button" onClick={() => setViewMode("list")} aria-label="Back to the list"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, border: `1px solid ${W.line}`, borderRadius: 999, background: NEUTRAL.white, boxShadow: "0 2px 10px rgba(21,23,28,.15)", cursor: "pointer" }}>
              <X size={20} color={W.ink} strokeWidth={2} aria-hidden="true" />
            </button>
            {/* The legend, in words. */}
            <div role="group" aria-label="Legend" style={{ position: "absolute", bottom: 14, left: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 5, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.95)", border: `1px solid ${W.line}`, boxShadow: "0 2px 10px rgba(21,23,28,.10)" }}>
              {[
                { bg: W.plate, border: W.ink, label: "Bank or network ATM" },
                { bg: NEUTRAL.white, border: W.ink, label: "Independent ATM" },
                { bg: W.ink, border: W.ink, label: "Picked" },
              ].map((k) => (
                <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(11), lineHeight: 1.2, color: NEUTRAL.ink2 }}>
                  <span aria-hidden="true" style={{ width: 12, height: 12, boxSizing: "border-box", borderRadius: 999, background: k.bg, border: `2px solid ${k.border}` }} />
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

      {/* Banks: one at a time; picking closes the sheet. */}
      <FilterSheet world="atm" open={showBankSheet} onClose={() => setShowBankSheet(false)} title="Banks"
        onClear={bankFilter !== "all" ? () => { setBankFilter("all"); setShowBankSheet(false); } : undefined} clearLabel="Clear">
        <ChipRow label="Banks" wrap>
          <WorldChip world="atm" label="All banks" active={bankFilter === "all"} clearable={false} onClick={() => { setBankFilter("all"); setShowBankSheet(false); }} />
          {availableBanks.map((b) => (
            <WorldChip key={b} world="atm" label={b} active={bankFilter === b} onClick={() => { setBankFilter(bankFilter === b ? "all" : b); setShowBankSheet(false); }} />
          ))}
        </ChipRow>
      </FilterSheet>

      <LocationModePicker isOpen={showLocPicker} onClose={() => setShowLocPicker(false)} />
      {directionsATM && (
        <MapAppSelector
          isOpen={true}
          onClose={() => setDirectionsATM(null)}
          destination={{
            name: nameOf(directionsATM),
            address: directionsATM.formattedAddress || directionsATM.shortFormattedAddress || directionsATM.vicinity || "",
            latitude: directionsATM.lat,
            longitude: directionsATM.lng,
          }}
          userLat={lat}
          userLng={lng}
        />
      )}
    </div>
  );
}
