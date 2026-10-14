// MoneyExchange: Banknote (the new look, Money.dc.html; plan S12).
//
// The mint plate (MONEY EXCHANGE · RATES UPDATED OCT 13, "What your money is worth", the
// location and the unit), then the converter: a guilloche band, the rate both ways, FROM
// and TO with their currency pills and the rose swap, and quick currencies. Then OR,
// "Exchange near you", a tip, Open now, and numbered rows: open words, distance and
// street, "Rates not listed: ask at the counter", Directions / Map / Call / More. A map
// with green numbered pins and word-only popups.
//
// Honest by design: the rate is ExchangeRate-API's mid-market rate, dated by the
// provider's own update time (never the device's clock). No counter's rate, stock or
// "best rate" is claimed: we know none. TO reads '—' until there is an amount and two
// currencies, never '0.00'. Open words read the place's clock (its utcOffsetMinutes, or
// the device's in current-location mode); unknown hours read "Hours not listed", never
// "Closed". The conversion runs on the phone from one rate per currency pair, so typing
// costs no requests.
import React, { useState, useEffect, useMemo, useRef, useId } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel, isCityLocation } from "@/components/location/locationLabel";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import LocationModePicker from "@/components/location/LocationModePicker";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { openPartner } from "@/lib/openPartner";
import { openStateFor } from "@/lib/openState";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import { WorldChip, ChipRow, ResultLine } from "@/components/finder/FinderControls";
import { WorldCard, worldGrid, NumberMark, FactsLine, CardKicker, CardName, ActionRow, WorldSkeleton } from "@/components/finder/FinderCard";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import { Guilloche } from "@/components/finder/motifs";
import CurrencyPicker, { PILL_WIDTH } from "@/components/money/CurrencyPicker";
import { currencyByCode, currencyForCountry, parseAmount, formatMoney, formatRate, formatAmount } from "@/components/money/currencies";
import NameLanguageHelp from "@/components/NameLanguageHelp";
import MapAppSelector from "@/components/MapAppSelector";
import { AlertCircle, ArrowUpDown, Clock, MapPin, SearchX, X } from "lucide-react";
import { WORLD, NEUTRAL, fs } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

const W = WORLD.money;
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

// A wide net, nearest first; no radius control.
const RADIUS_MILES = 25;
// Rows shown at first and per "Show more".
const PAGE = 10;
// The quick currencies under the converter (Money.dc.html L102-108).
const QUICK = ["EUR", "JPY", "MXN", "GBP", "CAD"];

// ─── RATES ──────────────────────────────────────────────────────────────────
// One rate per pair, kept for 30 minutes (the provider updates daily); its inverse comes
// free, so a swap costs nothing. The converted amount is worked out here.
const RATE_TTL_MS = 30 * 60 * 1000;
const RATES = new Map();

function cachedRate(from, to) {
  const hit = RATES.get(`${from}>${to}`);
  return hit && Date.now() - hit.at < RATE_TTL_MS ? hit : null;
}

async function loadRate(from, to, force) {
  const { data, error } = await callWorker(ROUTE.getExchangeRate, { from, to, amount: 1, forceRefresh: !!force });
  const rate = Number(data?.exchange_rate);
  if (error || !data || data.error || !Number.isFinite(rate) || rate <= 0) throw new Error(error || data?.error || "No rate");
  const at = Date.now();
  const lastUpdated = data.last_updated || null;
  RATES.set(`${from}>${to}`, { rate, lastUpdated, at });
  RATES.set(`${to}>${from}`, { rate: 1 / rate, lastUpdated, at });
  return { rate, lastUpdated };
}

// The provider's update time ('Tue, 13 Oct 2026 00:02:31 +0000'), in the reader's locale.
const providerDate = (s) => {
  const d = s ? new Date(s) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const shortDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dateTime = (d) => d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The last pair this device used, so the converter opens where it was left.
const PAIR_KEY = "gs_money_pair";
function savedPair() {
  try {
    const p = JSON.parse(window.localStorage.getItem(PAIR_KEY) || "null");
    return { from: currencyByCode(p?.from)?.code || null, to: currencyByCode(p?.to)?.code || null };
  } catch {
    return { from: null, to: null };
  }
}

// An amount's type size: smaller as it grows, so it stays in view (Money.dc.html L66: 40).
const amountSize = (text) => {
  const n = String(text || "").length;
  return fs(n <= 7 ? 40 : n <= 9 ? 34 : n <= 11 ? 28 : 24);
};

// ─── STORES ─────────────────────────────────────────────────────────────────
function mapStore(p) {
  const address = p.address || p.formattedAddress || "";
  return {
    ...p,
    id: p.placeId || p.place_id || p.id || null,
    name: p.name || p.displayName?.text || "Currency exchange",
    lat: p.latitude ?? p.lat ?? p.location?.latitude ?? null,
    lng: p.longitude ?? p.lng ?? p.location?.longitude ?? null,
    address,
    street: String(p.shortAddress || p.shortFormattedAddress || address).split(",")[0].trim(),
    distanceMiles: Number.isFinite(p.distance_miles) ? p.distance_miles : Number.isFinite(p.distanceMiles) ? p.distanceMiles : null,
    hours: Array.isArray(p.hours) ? p.hours : [],
    phone: p.phone || p.nationalPhoneNumber || null,
    website: p.website || p.websiteUri || null,
  };
}

// What the counter is, in words, from what its name, address and Google type say; nothing
// when they don't say.
const GENERIC_TYPES = new Set(["store", "point_of_interest", "establishment", "finance", "service"]);
function kindOf(s) {
  // Accents folded, so 'Câmbios' reads as 'cambios'.
  const text = `${s.name} ${s.address}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(airport|terminal)\b/.test(text)) return "Airport counter";
  if (/exchange|cambio|bureau|forex|wechsel|travelex|\bchange\b|\bfx\b/.test(text)) return "Currency exchange";
  if (/western union|moneygram|\bria\b|remit|money transfer|intermex|viamericas|sigue/.test(text)) return "Money transfer";
  if (s.primaryType === "bank" || /\bbank\b|credit union|\bbanco\b|\bbanque\b/.test(text)) return "Bank";
  if (s.primaryType && !GENERIC_TYPES.has(s.primaryType)) {
    const t = String(s.primaryType).replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return null;
}

const openNow = (s, isLocal) => openStateFor(s, { isLocal }).status === "open";

function MoreRow({ label, children }) {
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${W.line}` }}>
      <div style={{ marginBottom: 4, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".12em", textTransform: "uppercase", color: W.iconInk }}>{label}</div>
      <div style={{ fontSize: fs(13.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>{children}</div>
    </div>
  );
}

// ─── EXCHANGE ROW (Money.dc.html L130-155) ──────────────────────────────────
// A quiet card: the serif numeral inline, the mono kicker, the serif name; the facts line
// (open words, distance, street); "Rates not listed: ask at the counter"; Directions
// (the one solid button), Map, Call, More (hours, address, website).
function ExchangeRow({ s, n, isLocal, formatDistance, onDirections, onShowOnMap, highlighted, cardRef }) {
  const [expanded, setExpanded] = useState(false);
  const moreId = useId();
  const os = openStateFor(s, { isLocal });
  const dist = Number.isFinite(s.distanceMiles) ? formatDistance(s.distanceMiles) : null;
  const kind = kindOf(s);
  const week = (os.week || []).some((d) => d.text) ? os.week : [];
  return (
    <WorldCard world="money" as="li" ref={cardRef}
      style={{ padding: "14px 16px", ...(highlighted ? { boxShadow: `0 0 0 3px ${W.ink}, ${W.cardShadow}` } : null) }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <NumberMark n={n} world="money" place="inline" />
        <div style={{ minWidth: 0 }}>
          {kind ? <CardKicker world="money">{kind}</CardKicker> : null}
          <CardName world="money" as="h3" style={{ marginTop: kind ? 3 : 0, fontSize: fs(22) }}>{s.name}</CardName>
        </div>
      </div>
      {s.id ? <div style={{ marginTop: 2 }}><NameLanguageHelp placeId={s.id} name={s.name} world="money" /></div> : null}
      <FactsLine world="money" open={os} items={[dist, s.street]} style={{ marginTop: 6 }} />
      <p style={{ margin: "6px 0 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>Rates not listed: ask at the counter</p>
      <ActionRow world="money" name={s.name} onDirections={() => onDirections(s)} onMap={onShowOnMap} phone={s.phone}
        onMore={() => setExpanded((e) => !e)} moreIcon moreExpanded={expanded} moreControls={moreId} />
      {expanded && (
        <div id={moreId} style={{ marginTop: 12 }}>
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
    </WorldCard>
  );
}

// ─── MAP ────────────────────────────────────────────────────────────────────
// A pin with the row's serif numeral: mint with a green ring, the one picked in green.
function pinIcon(n, active) {
  const sz = active ? 34 : 28;
  const html = `<div style="width:${sz}px;height:${sz}px;box-sizing:border-box;border-radius:50%;background:${active ? W.ink : W.plate};border:${active ? 3 : 2}px solid ${active ? NEUTRAL.white : W.ink};box-shadow:0 3px 10px rgba(21,23,28,.3);display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:${active ? 17 : 15}px;line-height:1;color:${active ? NEUTRAL.white : W.ink};">${n}</div>`;
  return L.divIcon({ html, className: "", iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2], popupAnchor: [0, -sz / 2] });
}
const YOU_ICON = L.divIcon({
  html: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
  className: "", iconSize: [16, 16], iconAnchor: [8, 8],
});

function MapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true });
  }, [center?.[0], center?.[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** @param {any} props */
function StoreMap({ stores, lat, lng, isLocal, formatDistance, activePin, setActivePin, onDirections, onDetails, onClose }) {
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const picked = activePin != null ? stores[activePin] : null;
  const center = picked && picked.lat != null ? [picked.lat, picked.lng] : [lat, lng];

  // The picked row's popup opens once the map has its pins.
  useEffect(() => {
    if (activePin == null) return undefined;
    const t = setTimeout(() => markerRefs.current[activePin]?.openPopup(), 300);
    return () => clearTimeout(t);
  }, [activePin]);

  const btn = (solid) => ({
    flex: 1, minHeight: 44, border: solid ? 0 : `1px solid ${W.line}`, borderRadius: 12, background: solid ? W.cta : NEUTRAL.white,
    color: solid ? W.ctaInk : NEUTRAL.ink2, fontWeight: 600, fontSize: fs(13), cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div style={{ position: "relative", height: "calc(100vh - 300px)", minHeight: 360, borderRadius: 16, overflow: "hidden", border: `1px solid ${W.line}` }}>
      <div role="region" aria-label="Map of exchange counters" style={{ height: "100%", width: "100%" }}>
        <MapContainer ref={mapRef} center={center} zoom={picked ? 16 : 13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
          <MapView center={center} zoom={picked ? 16 : 13} />
          <Marker position={[lat, lng]} icon={YOU_ICON} keyboard={false}>
            <Tooltip permanent direction="bottom" offset={[0, 12]} opacity={1} className="gs-user-tooltip">
              <span style={{ padding: "2px 4px", fontWeight: 600, color: NEUTRAL.ink, fontSize: fs(11) }}>You are here</span>
            </Tooltip>
          </Marker>
          {stores.map((s, i) => {
            if (s.lat == null || s.lng == null) return null;
            const os = openStateFor(s, { isLocal });
            const tone = { open: NEUTRAL.open, closed: NEUTRAL.stamp, muted: NEUTRAL.ink3 }[os.tone] || NEUTRAL.ink2;
            const dist = Number.isFinite(s.distanceMiles) ? formatDistance(s.distanceMiles) : "";
            const kind = kindOf(s);
            return (
              <Marker key={s.id || i} position={[s.lat, s.lng]} icon={pinIcon(i + 1, activePin === i)} title={`${i + 1}. ${s.name}`}
                ref={(m) => { markerRefs.current[i] = m; }} eventHandlers={{ popupopen: () => setActivePin(i) }}>
                <Popup className="gs-popup" closeButton={false} maxWidth={280} autoPanPaddingTopLeft={[0, 160]} autoPanPaddingBottomRight={[20, 20]}>
                  <div style={{ width: 256, position: "relative", fontFamily: "inherit" }}>
                    <button type="button" aria-label="Close" onClick={() => mapRef.current?.closePopup()}
                      style={{ position: "absolute", top: 4, right: 4, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "transparent", cursor: "pointer" }}>
                      <X size={18} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <div style={{ padding: "14px 16px 16px" }}>
                      {kind ? <div style={{ paddingRight: 36, fontFamily: MONO, fontSize: fs(10), lineHeight: 1.4, letterSpacing: ".12em", textTransform: "uppercase", color: W.ink }}>{kind}</div> : null}
                      <button type="button" onClick={() => onDetails(i)}
                        style={{ display: "block", margin: "4px 0 0", padding: "0 30px 0 0", border: 0, background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.15, color: NEUTRAL.ink }}>
                        {s.name}
                      </button>
                      <div style={{ marginTop: 6, fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
                        <span style={{ fontWeight: 600, color: tone }}>{os.word}</span>{dist ? ` · ${dist}` : ""}
                      </div>
                      {s.address ? <div style={{ marginTop: 4, fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>{s.address}</div> : null}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={() => onDirections(s)} style={btn(true)}>Directions</button>
                        <button type="button" onClick={() => onDetails(i)} style={btn(false)}>Details</button>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      <button type="button" onClick={onClose} aria-label="Back to the list"
        style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0, border: `1px solid ${W.line}`, borderRadius: 999, background: NEUTRAL.white, boxShadow: "0 2px 10px rgba(21,23,28,.15)", cursor: "pointer" }}>
        <X size={20} color={W.ink} strokeWidth={2} aria-hidden="true" />
      </button>
      {/* The legend, in words. */}
      <div role="group" aria-label="Legend" style={{ position: "absolute", bottom: 14, left: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 5, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.95)", border: `1px solid ${W.line}`, boxShadow: "0 2px 10px rgba(21,23,28,.10)" }}>
        {[
          { bg: W.plate, border: W.ink, label: "Exchange counter" },
          { bg: W.ink, border: W.ink, label: "Picked" },
        ].map((k) => (
          <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(11), lineHeight: 1.2, color: NEUTRAL.ink2 }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, boxSizing: "border-box", borderRadius: 999, background: k.bg, border: `2px solid ${k.border}` }} />
            {k.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CONVERTER (Money.dc.html L54-109) ──────────────────────────────────────
const fieldLabel = (color) => ({ display: "block", fontFamily: MONO, fontSize: fs(10), fontWeight: 500, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase", color });
const amountStyle = (text) => ({
  display: "block", width: "100%", minWidth: 0, margin: 0, padding: 0, border: 0, background: "transparent", outline: "none",
  fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: amountSize(text), lineHeight: 1.05, color: W.ink,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
});
const fieldRow = (bg) => ({
  display: "flex", alignItems: "center", gap: 8, minHeight: 64, boxSizing: "border-box", padding: "6px 10px 6px 14px",
  border: `1px solid ${W.line}`, borderRadius: 14, background: bg,
});

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function MoneyExchangePage() {
  const isTablet = useIsTablet();
  const { profile } = useAuth();
  const { activeLocation, locationMode, initialized } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const { unit, setUnit, formatDistance } = useDistanceUnit(activeLocation);
  // The device's clock is the place's clock only in current-location mode.
  const isLocal = locationMode === "current";
  const fromId = useId();
  const toId = useId();

  // ── Currencies ──
  const saved = useMemo(savedPair, []);
  const home = currencyByCode(profile?.preferred_currency)?.code || "USD";
  const local = currencyForCountry(activeLocation?.address?.country);
  const [from, setFrom] = useState(() => saved.from || currencyByCode(profile?.preferred_currency)?.code || "USD");
  const [to, setTo] = useState(() => (saved.to && saved.to !== (saved.from || "USD") ? saved.to : ""));
  const [amountText, setAmountText] = useState("100");
  const fromRef = useRef(from);
  fromRef.current = from;

  // Where the traveler is decides TO: the local currency abroad; at home the last one used
  // here, or the euro (the dollar for someone converting from euros).
  const lastLocalRef = useRef(undefined);
  useEffect(() => {
    if (!initialized || lastLocalRef.current === local) return;
    lastLocalRef.current = local;
    setTo((cur) => {
      const f = fromRef.current;
      if (local && local !== f) return local;
      if (cur && cur !== f) return cur;
      return f === "EUR" ? "USD" : "EUR";
    });
  }, [initialized, local]);

  useEffect(() => {
    if (!from || !to) return;
    try { window.localStorage.setItem(PAIR_KEY, JSON.stringify({ from, to })); } catch { /* storage blocked */ }
  }, [from, to]);

  // Picking the currency already on the other side swaps them.
  const pickFrom = (code) => { if (code === to && from) setTo(from); setFrom(code); };
  const pickTo = (code) => { if (code === from && to) setFrom(to); setTo(code); };
  const swap = () => { if (!to) return; setFrom(to); setTo(from); };

  // ── The rate ──
  const [rateState, setRateState] = useState(/** @type {{ key: string, rate: number } | null} */ (null));
  const [lastUpdated, setLastUpdated] = useState(/** @type {string | null} */ (null));
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState(false);
  const [rateTick, setRateTick] = useState(0);
  const forceRateRef = useRef(false);
  useEffect(() => {
    if (!from || !to || from === to) { setRateError(false); return undefined; }
    const key = `${from}>${to}`;
    const force = forceRateRef.current; forceRateRef.current = false;
    const hit = force ? null : cachedRate(from, to);
    if (hit) {
      setRateState({ key, rate: hit.rate });
      if (hit.lastUpdated) setLastUpdated(hit.lastUpdated);
      setRateError(false);
      return undefined;
    }
    let cancelled = false;
    setRateLoading(true);
    setRateError(false);
    loadRate(from, to, force)
      .then((v) => {
        if (cancelled) return;
        setRateState({ key, rate: v.rate });
        if (v.lastUpdated) setLastUpdated(v.lastUpdated);
      })
      .catch(() => { if (!cancelled) setRateError(true); })
      .finally(() => { if (!cancelled) setRateLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, rateTick]);

  const rate = from && to ? (from === to ? 1 : rateState?.key === `${from}>${to}` ? rateState.rate : null) : null;
  const amount = parseAmount(amountText);
  const converted = amount != null && amount > 0 && rate != null ? amount * rate : null;
  const toText = converted != null ? formatAmount(converted, to) : "—";
  const updated = providerDate(lastUpdated);

  // ── Stores ──
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [storesTick, setStoresTick] = useState(0);
  const forceStoresRef = useRef(false);
  useEffect(() => {
    if (!lat || !lng) { setStoresLoading(false); return undefined; } // no location yet: never spin
    let cancelled = false;
    setStoresLoading(true);
    setStoresError(null);
    const force = forceStoresRef.current; forceStoresRef.current = false;
    (async () => {
      try {
        // Google's exchange counters (handleMoneyExchange), nearest first. Open only goes
        // to the worker too, for its wider fetch; the hours decide below.
        const { data, error } = await callWorker(ROUTE.getMoneyExchangeLocations, {
          latitude: lat, longitude: lng, radiusMiles: RADIUS_MILES, radius: RADIUS_MILES * 1609, maxResults: 60,
          sortBy: "distance", openOnly, forceRefresh: force,
        });
        if (cancelled) return;
        if (error) throw new Error(error);
        const raw = data?.locations || data?.places || [];
        setStores(raw.map(mapStore));
        // No counters is not an error: the empty state offers another place.
        if (!raw.length && data?.error) setStoresError(data.error);
      } catch (e) {
        if (cancelled) return;
        setStores([]); // a failed fetch must not leave the old list's count on screen
        setStoresError("Check your connection and try again.");
      } finally {
        if (!cancelled) setStoresLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng, openOnly, storesTick]);

  // Open now, as the rows say it: only when the listed hours put the counter open at its
  // own clock. With no clock to read (another city, no time zone), it can't be told.
  const canTellOpen = isLocal || stores.some((s) => Number.isFinite(s.utcOffsetMinutes));
  const list = useMemo(() => (openOnly ? stores.filter((s) => openNow(s, isLocal)) : stores), [stores, openOnly, isLocal]);
  useEffect(() => { setShown(PAGE); }, [list]);
  const openCount = useMemo(() => list.filter((s) => openNow(s, isLocal)).length, [list, isLocal]);
  const settled = !!lat && !!lng && !storesLoading && !storesError;

  const handleRefresh = () => {
    forceRateRef.current = true; setRateTick((t) => t + 1);
    forceStoresRef.current = true; setStoresTick((t) => t + 1);
  };

  // ── List and map ──
  const [viewMode, setViewMode] = useState("list");
  const [activePin, setActivePin] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [directionsTo, setDirectionsTo] = useState(null);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const cardRefs = useRef({});
  const scrollToNearYou = () => setTimeout(() => document.getElementById("money-near-you")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  const showOnMap = (i) => { setActivePin(i); setViewMode("map"); scrollToNearYou(); };
  const viewInList = (i) => {
    setViewMode("list");
    if (i >= shown) setShown(Math.ceil((i + 1) / PAGE) * PAGE);
    setHighlightIdx(i);
    setTimeout(() => cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    setTimeout(() => setHighlightIdx(null), 2800);
  };

  const presets = local && local !== home ? [[home, local], [local, home]] : [];
  const suggested = [
    ...(local ? [{ code: local, note: "Local currency" }] : []),
    { code: home, note: "Your currency" },
  ];
  const toName = currencyByCode(to)?.code;

  return (
    <div className="font-sans" style={{ background: W.paper, minHeight: "100vh", paddingTop: 12 }}>
      <style>{`
        .gs-mx-field:focus-within { box-shadow: 0 0 0 2px ${W.ink}; }
        .gs-popup .leaflet-popup-content-wrapper { border-radius:16px; padding:0; overflow:hidden; box-shadow:0 8px 32px rgba(21,23,28,.18); }
        .gs-popup .leaflet-popup-content { margin:0; }
        .gs-popup .leaflet-popup-tip-container { display:none; }
      `}</style>

      {/* ── THE PLATE (Money.dc.html L28-52): the provider's update date in the kicker; no
          count (the rows have their own line). ── */}
      <FinderHeader
        world="money"
        count={null}
        kickerExtras={updated ? [`Rates updated ${shortDate(updated)}`] : undefined}
        onRefresh={handleRefresh}
        refreshing={rateLoading || storesLoading}
        refreshTitle="Refresh rates and counters"
        location={{ label: getLocationLabel(activeLocation), onChange: () => setShowLocPicker(true) }}
        unit={{ value: unit, onChange: setUnit }}
        isCity={isCityLocation(activeLocation)}
        cityName={activeLocation?.address?.city || activeLocation?.placeName}
      >
        {/* ── THE CONVERTER ── */}
        <section aria-label="Currency converter" style={{ background: NEUTRAL.white, border: `1px solid ${W.line}`, borderRadius: 22, overflow: "hidden", boxShadow: W.cardShadow }}>
          <Guilloche world="money" variant="card" />
          {/* One column on a phone; on iPad the rate on the left, the amounts on the right. */}
          <div style={isTablet
            ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 32, alignItems: "start", padding: "18px 24px 20px" }
            : { padding: "14px 16px 16px" }}>
            <div>
              {/* The rate both ways, or why there is none. */}
              <div aria-live="polite" aria-busy={rateLoading || undefined}>
                {rate != null && from !== to ? (
                  [[from, to, rate], [to, from, 1 / rate]].map(([a, b, r], i) => (
                    <div key={`${a}${b}`} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, minHeight: 34, padding: "2px 0", borderTop: i ? `1px solid ${W.line}` : 0 }}>
                      <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(28), lineHeight: 1.2, color: W.ink, overflowWrap: "anywhere" }}>
                        {formatMoney(1, a)} = {formatRate(r, b)}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, letterSpacing: ".12em", color: NEUTRAL.ink3, whiteSpace: "nowrap" }}>
                        {a} → {b}
                      </span>
                    </div>
                  ))
                ) : rateError ? (
                  <div role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink }}>Couldn&rsquo;t get today&rsquo;s rate.</span>
                    <button type="button" onClick={() => { forceRateRef.current = true; setRateTick((t) => t + 1); }}
                      style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: `1px solid ${W.line}`, background: NEUTRAL.white, fontFamily: "inherit", fontSize: fs(13), fontWeight: 600, color: W.ink, cursor: "pointer" }}>
                      Try again
                    </button>
                  </div>
                ) : (
                  <p style={{ margin: 0, minHeight: 34, display: "flex", alignItems: "center", fontSize: fs(14), color: NEUTRAL.ink3 }}>
                    {!from || !to ? "Pick a currency to see the rate." : from === to ? "Same currency on both sides." : "Getting today’s rate…"}
                  </p>
                )}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: fs(12), lineHeight: 1.35, color: NEUTRAL.ink2 }}>
                Mid-market rate{updated ? ` · Updated ${dateTime(updated)}` : ""}
              </p>
              <p style={{ margin: 0, fontSize: fs(12), lineHeight: 1.35, color: NEUTRAL.ink3 }}>
                Source: ExchangeRate-API. Counters may charge 2–5% or more.
              </p>
              {!isTablet && <div aria-hidden="true" style={{ height: 1, marginTop: 12, background: W.line }} />}
            </div>

            <div>
              {/* FROM and TO, with the rose swap between them, left of the pills. */}
              <div style={{ position: "relative", marginTop: isTablet ? 0 : 14 }}>
                <div className="gs-mx-field" style={fieldRow(NEUTRAL.white)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label htmlFor={fromId} style={fieldLabel(NEUTRAL.ink3)}>From</label>
                    <input id={fromId} type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done" maxLength={16}
                      value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,\s]/g, ""))}
                      onFocus={(e) => e.target.select()}
                      aria-describedby={`${fromId}-cur`} style={amountStyle(amountText)} />
                    <span id={`${fromId}-cur`} className="sr-only">{currencyByCode(from)?.name || ""}</span>
                  </div>
                  <span aria-hidden="true" style={{ width: 44, flexShrink: 0 }} />
                  <CurrencyPicker world="money" label="From" value={from} onChange={pickFrom} suggested={suggested} />
                </div>
                <div style={{ ...fieldRow(W.wash), marginTop: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label htmlFor={toId} style={fieldLabel(W.ink)}>To</label>
                    <output id={toId} htmlFor={fromId} style={amountStyle(toText)}>
                      {toText}
                      {converted != null && toName ? <span className="sr-only"> {currencyByCode(to)?.name}</span> : null}
                    </output>
                  </div>
                  <span aria-hidden="true" style={{ width: 44, flexShrink: 0 }} />
                  <CurrencyPicker world="money" label="To" value={to} onChange={pickTo} suggested={suggested} />
                </div>
                <button type="button" onClick={swap} aria-label="Swap currencies" aria-disabled={!to || undefined}
                  style={{
                    position: "absolute", top: "calc(50% - 22px)", right: `calc(19px + ${PILL_WIDTH})`, width: 44, height: 44, padding: 0,
                    boxSizing: "border-box", borderRadius: 999, background: NEUTRAL.white, border: `1.5px solid ${W.rose}`,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: to ? "pointer" : "default",
                    boxShadow: "0 4px 12px -6px rgba(156,58,96,.45)", opacity: to ? 1 : 0.5,
                  }}>
                  <ArrowUpDown size={18} color={W.rose} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              {/* Quick currencies set TO; the presets set both sides. */}
              <ChipRow label="Quick currencies" wrap style={{ marginTop: 8 }}>
                {QUICK.filter((c) => c !== from).map((c) => (
                  <WorldChip key={c} world="money" active={to === c} clearable={false} onClick={() => pickTo(c)}
                    aria-label={`${c}, ${currencyByCode(c)?.name}`}>
                    <span style={{ fontFamily: MONO, fontSize: fs(12), fontWeight: 500, letterSpacing: ".06em" }}>{c}</span>
                  </WorldChip>
                ))}
                {presets.map(([a, b]) => (
                  <WorldChip key={`${a}${b}`} world="money" active={from === a && to === b} clearable={false}
                    onClick={() => { setFrom(a); setTo(b); }} aria-label={`${a} to ${b}`}>
                    <span style={{ fontFamily: MONO, fontSize: fs(12), fontWeight: 500, letterSpacing: ".06em" }}>{a} → {b}</span>
                  </WorldChip>
                ))}
              </ChipRow>
            </div>
          </div>
        </section>
      </FinderHeader>

      {/* ── NEAR YOU (Money.dc.html L111-128) ── */}
      <div style={finderColumnStyle(isTablet)}>
        <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
          <span style={{ flex: 1, height: 1, background: W.line }} />
          <span style={{ fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, lineHeight: 1.34, letterSpacing: ".18em", color: NEUTRAL.ink3 }}>OR</span>
          <span style={{ flex: 1, height: 1, background: W.line }} />
        </div>
        <h2 id="money-near-you" style={{ margin: "12px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: fs(24), lineHeight: 1.17, color: NEUTRAL.ink, scrollMarginTop: 12 }}>
          Exchange <em style={{ fontStyle: "italic", color: W.rose }}>near you</em>
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
          <span style={{ marginRight: 6, fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, letterSpacing: ".14em", color: W.ink }}>TIP</span>
          Airport counters usually pay less. Call ahead to check they have {toName || "the currency you need"}.
        </p>
        <ChipRow label="Filters" style={{ marginTop: 8 }}>
          <WorldChip world="money" icon={Clock} label="Open now" active={openOnly} onClick={() => setOpenOnly((o) => !o)}
            disabled={!openOnly && !canTellOpen && settled} hint="Open now needs the counters’ local time, which this search didn’t give." />
        </ChipRow>
        {settled && list.length > 0 && (
          <ResultLine live items={[{ count: list.length, label: list.length === 1 ? "counter" : "counters" }, { count: openCount, label: "open now" }]} />
        )}
      </div>

      {(!lat || !lng) ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 20 }}>
          <FinderEmptyState world="money" icon={MapPin} title="Choose a location" reason="Use your current position or pick a city to find exchange counters nearby."
            actionLabel="Choose a location" onAction={() => setShowLocPicker(true)} />
        </div>
      ) : storesLoading ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 12 }}>
          <WorldSkeleton world="money" variant="entry" count={3} label="Finding exchange counters nearby" />
        </div>
      ) : storesError ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 20 }}>
          <FinderEmptyState world="money" icon={AlertCircle} title="Couldn’t load exchange counters" reason={storesError}
            actionLabel="Try again" onAction={() => { forceStoresRef.current = true; setStoresTick((t) => t + 1); }}
            secondaryLabel="Search somewhere else" onSecondary={() => setShowLocPicker(true)} />
        </div>
      ) : viewMode === "map" && list.length > 0 ? (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 12, paddingBottom: 100 }}>
          <StoreMap stores={list} lat={lat} lng={lng} isLocal={isLocal} formatDistance={formatDistance}
            activePin={activePin} setActivePin={setActivePin} onDirections={setDirectionsTo}
            onDetails={viewInList} onClose={() => setViewMode("list")} />
        </div>
      ) : (
        <div style={{ ...finderColumnStyle(isTablet), paddingTop: 12, paddingBottom: isTablet ? 170 : 100 }}>
          {list.length === 0 ? (
            <FinderEmptyState world="money" icon={SearchX} title="No exchange counters found"
              reason={openOnly ? "None of the counters here are open now." : "Nothing within 25 miles of this location."}
              actionLabel="Search somewhere else" onAction={() => setShowLocPicker(true)}
              secondaryLabel={openOnly ? "Show all counters" : undefined} onSecondary={openOnly ? () => setOpenOnly(false) : undefined} />
          ) : (
            <>
              <ol aria-label="Exchange counters" style={worldGrid(isTablet)}>
                {list.slice(0, shown).map((s, i) => (
                  <ExchangeRow key={s.id || i} s={s} n={i + 1} isLocal={isLocal} formatDistance={formatDistance}
                    onDirections={setDirectionsTo} onShowOnMap={() => showOnMap(i)} highlighted={highlightIdx === i}
                    cardRef={(el) => { cardRefs.current[i] = el; }} />
                ))}
              </ol>
              {list.length > shown && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 16 }}>
                  <p style={{ margin: 0, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".12em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>
                    Showing {shown} of {list.length}
                  </p>
                  <button type="button" onClick={() => setShown((n) => n + PAGE)}
                    style={{ minHeight: 44, padding: "0 18px", borderRadius: 14, border: `1px solid ${W.line}`, background: NEUTRAL.white, fontFamily: "inherit", fontSize: fs(14), fontWeight: 600, color: W.ink, cursor: "pointer" }}>
                    Show {Math.min(PAGE, list.length - shown)} more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
