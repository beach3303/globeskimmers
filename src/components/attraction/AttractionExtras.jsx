// AttractionExtras — what makes a Things to Do card THE page for an attraction
// (founder, 2026-10-03): a GPS-only stamp button, verified ticket prices and
// parking (for planning a day and a budget — never booking), and the place's
// guestbook. Shown inside the full-screen card.
//
// Stamps: an iconic place (a stampable D1 row, found via /attractions/link)
// earns its official stamp; every other attraction earns a typographic
// "I was here" stamp. Either way only when a fresh GPS fix is inside the
// footprint — checked here, then again by the worker against its own
// coordinates (the fix rides along for that check and is never stored).
import React, { useEffect, useState } from "react";
import { DollarSign, MapPin } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { addStamp, metersBetween } from "@/lib/passport";
import { stampRadiusFor } from "@/lib/stampRadius";
import { resolveStampVariant } from "@/lib/stampVariants";
import { countryCode } from "@/lib/countries";
import { localISODate } from "@/lib/localDate";
import { getCurrentPositionSmart } from "@/lib/geolocation";
import { showToast } from "@/components/Toast";
import { openPartner } from "@/lib/openPartner";
import Guestbook from "@/components/Guestbook";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK3 = "#736657", RULE = "rgba(22,17,13,.12)", STAMP = "#B0472F";
const fs = (n) => `calc(${n}px*var(--fs))`;

const idKind = (id) => {
  const v = String(id || "");
  if (/^[a-z]+:/.test(v) || /^[a-z]{2}-[a-z0-9-]+$/.test(v)) return "d1";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "owned";
  return v.length >= 16 && /[A-Z]/.test(v) && /^[A-Za-z0-9_-]+$/.test(v) ? "google" : null;   // Google ids are mixed-case
};

// "6100 Woodley Ave, Van Nuys, CA 91406, USA" → { city, region, country }.
function placeParts(address) {
  const parts = String(address || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return { city: null, region: null, country: null };
  const country = parts[parts.length - 1];
  const region = parts.length >= 3 ? parts[parts.length - 2].replace(/\s*\d[\d\s-]*$/, "").trim() || null : null;
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[0];
  return { city, region, country };
}

// { stamp, gid } for an attraction — its iconic stamp record (or null) and its
// Google id (or null; owned places resolve by name + coords) — `undefined`
// while checking.
export function useAttractionLink(a) {
  const pid = a?.placeId || a?.id;
  const [link, setLink] = useState(undefined);
  useEffect(() => {
    if (!pid) { setLink({ stamp: null, gid: null }); return undefined; }
    let gone = false;
    setLink(undefined);
    callWorker("attractions/link", { placeId: String(pid), name: a.displayName?.text || a.name, lat: a.lat, lng: a.lng })
      .then(({ data }) => {
        if (gone) return;
        const stamp = a?.stamp !== undefined && a.stamp !== null ? a.stamp : (data?.stamp || null);
        setLink({ stamp, gid: data?.gid || (idKind(pid) === "google" ? String(pid) : null) });
      });
    return () => { gone = true; };
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  return link;
}

export function StampHereButton({ a, link: resolved, formatDistance, isTablet }) {
  const link = resolved?.stamp || null;
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(false);
  const [notHere, setNotHere] = useState(null); // null | { meters } | { noFix: true }
  const name = a.displayName?.text || a.name || "this place";
  const pid = String(a.placeId || a.id || "");
  const kind = idKind(pid);
  const iconic = !!link;

  const stamp = async () => {
    if (busy || stamped) return;
    setBusy(true); setNotHere(null);
    const placeLat = Number(link?.lat ?? a.lat), placeLng = Number(link?.lng ?? a.lng);
    let fix = null, meters = null;
    try {
      const pos = await getCurrentPositionSmart({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy ?? null };
      meters = metersBetween(fix.lat, fix.lng, placeLat, placeLng);
    } catch { /* no fix → can't verify right now */ }
    if (!fix || !Number.isFinite(meters)) { setBusy(false); setNotHere({ noFix: true }); return; }
    const radius = stampRadiusFor(iconic
      ? { footprint_radius_m: link.footprint_radius_m, category: link.category }
      : { types: a.types, category: a.activityCategory });
    if (meters > radius + Math.min(fix.acc || 0, 100)) { setBusy(false); setNotHere({ meters }); return; }

    const parts = placeParts(a.formattedAddress);
    const country = link?.country || parts.country || null;
    const variant = iconic ? resolveStampVariant({ name: link.name, lat: fix.lat, lng: fix.lng, country, verified: "gps" }) : null;
    const gid = resolved?.gid || (kind === "google" ? pid : null);
    const entityId = variant ? variant.entity_id
      : iconic ? link.id
      : gid ? `places:${gid}`
      : kind === "owned" ? `owned:${pid}`
      : pid;
    const { data, error } = await addStamp({
      kind: "attraction",
      entity_type: variant ? "landmark" : "place",
      entity_id: entityId,
      name: variant ? variant.name : (link?.name || name),
      city: link?.city || parts.city,
      region: parts.region,
      country,
      cc: countryCode(country) || (/^[A-Za-z]{2}$/.test(country || "") ? country.toUpperCase() : undefined),
      lat: Number.isFinite(placeLat) ? placeLat : null,
      lng: Number.isFinite(placeLng) ? placeLng : null,
      visited_on: localISODate(),
      local_hour: new Date().getHours(),
      verified: "gps",
      category: (link?.category || a.activityCategory || (a.types || [])[0]) || undefined,
      ...(variant && link?.id ? { parent_id: link.id } : {}),   // the worker measures a variant from its parent
      fix,
    });
    setBusy(false);
    if (data?.code === "not_here" && Number.isFinite(data.distance_m)) { setNotHere({ meters: data.distance_m }); return; }
    if (data?.code === "not_here" || data?.code === "unlocatable" || data?.code === "proof_needed") { setNotHere({ message: data.error || null }); return; }
    if (error) { showToast(/sign in/i.test(error) ? "Sign in to stamp your Virtual Passport" : error, "error"); return; }
    setStamped(true);
    showToast(iconic ? "✓ Verified — added to your Virtual Passport 🛂" : "✓ “I was here” — added to your Virtual Passport 🛂", "success");
  };

  return (
    <div>
      <button type="button" onClick={stamp} disabled={busy || stamped}
        style={{ width: "100%", borderRadius: isTablet ? 16 : 14, padding: fs(isTablet ? 15 : 12), border: "none", cursor: "pointer", fontFamily: "inherit",
          fontSize: fs(isTablet ? 18 : 14.5), fontWeight: 700, background: stamped ? "#E7F3EA" : STAMP, color: stamped ? "#266A3B" : "#fff" }}>
        {busy ? "Checking you are here…" : stamped ? "✓ In your Virtual Passport" : iconic ? "📍 Stamp it — I'm here" : "📍 I was here — get the stamp"}
      </button>
      {!stamped && !notHere && (
        <p style={{ fontSize: fs(11.5), color: INK3, textAlign: "center", marginTop: 5 }}>
          {iconic ? "An official GlobeSkimmers stamp" : "A typographic “I was here” stamp"} · only at the place, by GPS
        </p>
      )}
      {notHere && (
        <p style={{ marginTop: 8, borderRadius: 12, border: "1px solid #FCD9A8", background: "#FFF8EC", padding: "10px 12px", fontSize: fs(13), color: "#7A4A0C" }}>
          {notHere.noFix
            ? "We need your location to stamp this — turn on Location for Globeskimmers, then tap again."
            : notHere.message ? notHere.message
            : `This stamp is earned at the place${Number.isFinite(notHere.meters) ? ` — you're about ${formatDistance ? formatDistance(notHere.meters / 1609.34) : `${(notHere.meters / 1000).toFixed(1)} km`} away` : ""}. Tap again when you're here.`}
        </p>
      )}
    </div>
  );
}

// ── Tickets + parking ─────────────────────────────────────────────────────────
// From /attractions/visit-info: every amount shown was read on the page named in
// the source line (the worker drops any price that page doesn't state). Nothing
// found → the official site, never a guess. For planning, not booking.
const AUDIENCE_ORDER = ["adult", "child", "youth", "student", "senior", "military", "resident", "family", "other"];
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const checkedOn = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return null; } };

export function useVisitInfo(id) {
  const [visit, setVisit] = useState(id ? "loading" : null);
  useEffect(() => {
    if (!id) { setVisit(null); return undefined; }
    let gone = false;
    setVisit("loading");
    (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data } = await callWorker("attractions/visit-info", { id }, { timeoutMs: 90000 });
        if (gone) return;
        if (data?.pending) { await new Promise((r) => setTimeout(r, 8000)); if (gone) return; continue; }
        setVisit(data && data.ok ? data : { ok: false, official_site: data?.official_site || null });
        return;
      }
      if (!gone) setVisit({ ok: false });
    })();
    return () => { gone = true; };
  }, [id]);
  return visit;
}

function Card({ icon, title, children }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${RULE}`, borderRadius: 16, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: SERIF, fontSize: fs(21), color: INK, marginBottom: 8 }}>{icon}{title}</div>
      {children}
    </div>
  );
}
function SourceLine({ url, checkedAt }) {
  const host = hostOf(url);
  if (!host) return null;
  return (
    <p style={{ marginTop: 10, fontSize: fs(11.5), color: INK3 }}>
      From <button type="button" onClick={() => openPartner(url)} style={{ textDecoration: "underline", color: "inherit" }}>{host}</button>
      {checkedAt ? ` · checked ${checkedOn(checkedAt)}` : ""} · prices can change
    </p>
  );
}
function OfficialLink({ url, label }) {
  if (!url) return <p style={{ fontSize: fs(13), color: INK3 }}>Prices aren&rsquo;t listed online — ask at the venue.</p>;
  return <button type="button" onClick={() => openPartner(url)} style={{ fontSize: fs(14), fontWeight: 600, color: "#6D28D9", textDecoration: "underline", textAlign: "left" }}>{label} ↗</button>;
}

export function TicketsCard({ visit, website }) {
  const icon = <DollarSign size={18} color="#2E7D46" />;
  if (visit === "loading") {
    return (
      <Card icon={icon} title="Prices">
        <p style={{ fontSize: fs(13), color: INK3, marginBottom: 8 }}>Checking the official site for current prices…</p>
        {[75, 66, 50].map((w) => <div key={w} aria-hidden="true" className="animate-pulse" style={{ height: 12, width: `${w}%`, borderRadius: 6, background: "#ECE6D8", marginTop: 6 }} />)}
      </Card>
    );
  }
  if (!visit) return null;
  const official = visit.official_site || website || null;
  const a = visit.ok ? visit.admission : null;
  const prices = a ? [...a.prices].sort((x, y) => AUDIENCE_ORDER.indexOf(x.audience) - AUDIENCE_ORDER.indexOf(y.audience)) : [];
  const free = a?.free === true;
  const hasAny = free || prices.length || a?.discounts?.length || a?.free_days || a?.reservation;
  return (
    <Card icon={icon} title="Prices">
      {!hasAny && <OfficialLink url={official} label="See prices on the official site" />}
      {free && <p style={{ fontSize: fs(18), fontWeight: 700, color: "#2E7D46" }}>Free admission</p>}
      {prices.length > 0 && (
        <div>
          {prices.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: i ? `1px solid ${RULE}` : "none" }}>
              <span style={{ fontSize: fs(14), color: INK, minWidth: 0 }}>
                {p.label}
                {p.note && <span style={{ display: "block", fontSize: fs(12), color: INK3 }}>{p.note}</span>}
              </span>
              <span style={{ fontSize: fs(16), fontWeight: 700, color: INK, flex: "none" }}>{p.amount === 0 ? "Free" : (p.amount_text || `${p.amount}`)}</span>
            </div>
          ))}
        </div>
      )}
      {a?.discounts?.length > 0 && (
        <ul style={{ marginTop: 6 }}>
          {a.discounts.map((d, i) => <li key={i} style={{ fontSize: fs(13.5), color: INK, display: "flex", gap: 8 }}><span style={{ color: "#2E7D46" }}>✓</span><span>{d.label}</span></li>)}
        </ul>
      )}
      {a?.free_days && <p style={{ marginTop: 6, fontSize: fs(13.5), color: INK }}>🗓️ {a.free_days}</p>}
      {a?.reservation && <p style={{ marginTop: 6, fontSize: fs(13.5), color: INK }}>🎟️ {a.reservation}</p>}
      {hasAny && a && <SourceLine url={a.source_url || official} checkedAt={visit.checked_at} />}
    </Card>
  );
}

export function ParkingCard({ visit, website }) {
  if (!visit || visit === "loading") return null;
  const icon = <MapPin size={18} color="#6D28D9" />;
  const pk = visit.ok ? visit.parking : null;
  const official = visit.official_site || website || null;
  if (!pk?.options?.length && !pk?.note) {
    return official ? <Card icon={icon} title="Parking"><OfficialLink url={official} label="Parking details on the official site" /></Card> : null;
  }
  return (
    <Card icon={icon} title="Parking">
      {pk.options.map((o, i) => (
        <div key={i} style={{ padding: "7px 0", borderTop: i ? `1px solid ${RULE}` : "none" }}>
          <p style={{ fontSize: fs(14), fontWeight: 600, color: INK }}>{o.label}</p>
          {o.price_text && <p style={{ fontSize: fs(13.5), color: INK3 }}>{o.price_text}</p>}
        </div>
      ))}
      {pk.note && <p style={{ marginTop: 6, fontSize: fs(13.5), color: INK }}>{pk.note}</p>}
      <SourceLine url={pk.source_url || official} checkedAt={visit.checked_at} />
    </Card>
  );
}

// Everything above, for one attraction card.
export default function AttractionExtras({ a, formatDistance, isTablet }) {
  const link = useAttractionLink(a);
  const pid = String(a.placeId || a.id || "");
  const kind = idKind(pid);
  // Prices key on the stamp record when there is one (shared with its stamp
  // taps), else on the Google place (owned places resolve to theirs).
  const visitId = link === undefined ? null : (link.stamp?.id || link.gid || (kind === "d1" ? pid : null));
  const visit = useVisitInfo(visitId);
  const name = a.displayName?.text || a.name || "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
      {link !== undefined && <StampHereButton a={a} link={link} formatDistance={formatDistance} isTablet={isTablet} />}
      <TicketsCard visit={visit} website={a.websiteUri} />
      <ParkingCard visit={visit} website={a.websiteUri} />
      <div>
        <div style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".12em", textTransform: "uppercase", color: INK3, margin: "6px 2px 8px" }}>📖 Guestbook</div>
        {link !== undefined && <Guestbook entityType="attraction" entityId={link.gid || pid} entityName={name} />}
      </div>
    </div>
  );
}
