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
// The stamp action is the cream rubber stamp (redesign/RubberStamp), the same
// in every world, so a card keeps one solid button: its Directions. The detail
// cards print in the page's world (the default export's `world`, Things to Do
// by default): white with the world line, serif titles, mono kickers and lucide
// icons in the world ink. No emoji.
import React, { useEffect, useId, useRef, useState } from "react";
import {
  Accessibility, ArrowUpRight, Backpack, BookOpen, CalendarCheck, CalendarClock, CalendarDays, Camera, CameraOff,
  Check, ChevronDown, ClipboardList, DoorOpen, Info, Lock, Shirt, SquareParking, Ticket, Timer,
} from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { addStamp, reportStamp, STAMP_REFUSALS, setStampNote, setStampArt } from "@/lib/passport";
import { respectPlaceFor } from "@/lib/respectPlaces";
import RespectPlaceSheet from "@/components/passport/RespectPlaceSheet";
import { resolveStampVariant } from "@/lib/stampVariants";
import { countryCode } from "@/lib/countries";
import { localISODate } from "@/lib/localDate";
import { getStampFix } from "@/lib/geolocation";
import { showToast } from "@/components/Toast";
import { openPartner } from "@/lib/openPartner";
import Guestbook from "@/components/Guestbook";
import { useLocation } from "@/components/location/LocationContext";
import { useDistanceUnit } from "@/components/location/distanceUnit";
import RubberStamp, { STAMP_LABEL } from "@/components/redesign/RubberStamp";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { worldRow } from "@/components/finder/FinderControls";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

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

// localFavorite (founder, 2026-10-10): an approved suggestion's lf:<id> stamp —
// its own hint line, and never a landmark variant, whose official art a
// Local favorite must not wear ("Niagara Falls overlook" is not Niagara Falls).
// The button is the RubberStamp: idle, busy, stamped (GPS) or reported. Its
// panels (how stamps work, a refusal, a memory, a sensitive place) sit on
// cream or white in the shared inks, with line icons and no emoji. isTablet
// is no longer read: the stamp is the same size on every screen.
// How far from a place a report can come from (the worker refuses farther; keep in step).
const REPORT_MAX_M = 1500;
export function StampHereButton({ a, link: resolved, formatDistance = undefined, localFavorite = false }) {
  const link = resolved?.stamp || null;
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(false);
  // A refusal (founder, 2026-10-10) — what the phone or the worker said, with
  // the request itself so "I'm here, but the app is saying I'm not" can resend
  // it as a report: null | { why, meters?, message?, req }.
  const [refused, setRefused] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [wasReported, setWasReported] = useState(false);
  const [wasHeld, setWasHeld] = useState(false);   // the stamp was already in the passport
  // Distances in the traveler's mi/km (cafés and restaurants pass no formatter).
  const { activeLocation } = useLocation();
  const units = useDistanceUnit(activeLocation);
  const fmtDist = formatDistance || units.formatDistance;
  const [stampedId, setStampedId] = useState(null);
  const [startedPrivate, setStartedPrivate] = useState(false);
  const [memory, setMemory] = useState("");
  const [memBusy, setMemBusy] = useState(false);
  const [memSaved, setMemSaved] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [respect, setRespect] = useState(null);   // { place, stamp } — a place of respect just stamped
  const chooseArt = async (art) => {
    const { error } = await setStampArt(respect.stamp.id, art);
    if (error) { showToast(error, "error"); return; }
    const memorial = respect.place.kind === "memorial";
    setRespect(null);
    if (memorial) showToast(art === "plain" ? "Your stamp shows as text only" : "Your stamp keeps its illustration", "success");
  };
  const saveMemory = async () => {
    if (!stampedId || !memory.trim() || memBusy) return;
    setMemBusy(true);
    const { error } = await setStampNote(stampedId, { note: memory.trim() });
    setMemBusy(false);
    if (error) { showToast(error, "error"); return; }
    setMemSaved(true);
    showToast("Saved privately to your stamp", "success");
  };
  const name = a.displayName?.text || a.name || "this place";
  const pid = String(a.placeId || a.id || "");
  const kind = idKind(pid);
  const iconic = !!link;
  const howId = useId();
  // After a report, the refusal panel that held keyboard focus is gone: hand focus to
  // the stamp, which now reads 'In your Virtual Passport'.
  const stampRef = useRef(null);
  useEffect(() => {
    if (stamped && wasReported && (!document.activeElement || document.activeElement === document.body)) stampRef.current?.focus();
  }, [stamped, wasReported]);

  // A grant, from GPS or from a report: the stamp is in either way. A report
  // never says Verified or shows the Check — the worker answers with the
  // stamp's strongest proof ever, which can be an older GPS visit, not what
  // this tap proved.
  const granted = (data, req, viaReport) => {
    setStamped(true);
    setRefused(null);
    setStampedId(data?.id || null);
    setStartedPrivate(data?.private === true);
    setWasReported(!!viaReport);
    setWasHeld(!!data?.updated);
    showToast(viaReport
      ? (data?.updated ? "Already in your Virtual Passport — thanks for telling us" : "Stamped — added to your Virtual Passport")
      : data?.verified === "gps"
        ? (iconic ? "Verified — added to your Virtual Passport" : "“I was here” — added to your Virtual Passport")
        : "Stamped — added to your Virtual Passport", "success");
    // A place of respect (founder, 2026-10-04): its message first; a memorial also asks illustrated or text only.
    const place = respectPlaceFor({ kind: "attraction", name: req.stampName });
    if (place && data?.id) setRespect({ place, stamp: { id: data.id, name: req.stampName, city: req.city, country: req.country, entity_id: req.entityId } });
  };

  const stamp = async () => {
    if (busy || stamped || reportBusy) return;
    setBusy(true); setRefused(null);
    const placeLat = Number(link?.lat ?? a.lat), placeLng = Number(link?.lng ?? a.lng);
    // The best of 2–3 fresh readings. The worker, not the phone, decides
    // whether that's inside the place — its map has the street shapes and
    // footprints (founder, 2026-10-10: the Walk of Fame refused a stamp under
    // the Dolby Theatre because the phone measured to a single pin).
    let fix = null, noFix = null;
    try { fix = await getStampFix(); }
    catch (e) { noFix = e?.code === 1 ? "denied" : "no_fix"; }
    const parts = placeParts(a.formattedAddress);
    const country = link?.country || parts.country || null;
    const gid = resolved?.gid || (kind === "google" ? pid : null);
    const city = link?.city || parts.city;
    // One request per variant choice. A park within a resort (Disney,
    // Universal, the Grand Canyon rims) is picked by where GPS puts you; a
    // report — sent exactly when GPS is wrong — takes the card's own place
    // instead (its pin: a single park resolves to itself, a resort keeps the
    // resort stamp), so it never grants the park nearest a bad reading.
    const build = (variant) => {
      const entityId = variant ? variant.entity_id
        : iconic ? link.id
        : gid ? `places:${gid}`
        : kind === "owned" ? `owned:${pid}`
        : pid;
      const stampName = variant ? variant.name : (link?.name || name);
      const payload = {
        kind: "attraction",
        entity_type: variant ? "landmark" : "place",
        entity_id: entityId,
        name: stampName,
        city,
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
        ...(fix ? { fix: { lat: fix.lat, lng: fix.lng, ...(Number.isFinite(fix.acc) ? { acc: fix.acc } : {}) } } : {}),
      };
      return { payload, stampName, city, country, entityId };
    };
    const variants = iconic && !localFavorite;
    const pinVariant = variants ? resolveStampVariant({ name: link.name, lat: placeLat, lng: placeLng, country, verified: "self" }) : null;
    const reportReq = build(pinVariant);
    if (!fix) { setBusy(false); setRefused({ why: noFix, req: reportReq }); return; }
    const req = build(variants ? resolveStampVariant({ name: link.name, lat: fix.lat, lng: fix.lng, country, verified: "gps" }) : null);
    const { data, error } = await addStamp(req.payload);
    setBusy(false);
    if (STAMP_REFUSALS.includes(data?.code)) {
      // proof_needed WITH a fix: the worker measured you inside but didn't
      // trust the reading (a VPN, or impossible travel since your last stamp).
      setRefused({ why: data.code === "proof_needed" ? "unconfirmed" : data.code, meters: Number.isFinite(data.distance_m) ? data.distance_m : null, message: data.error || null, inside: data.inside_only === true, req: reportReq });
      return;
    }
    if (error) { showToast(/sign in/i.test(error) ? "Sign in to stamp your Virtual Passport" : error, "error"); return; }
    // A GPS claim that comes back without GPS means the worker measured you
    // inside but didn't trust the reading (a VPN, or impossible travel) on a
    // stamp you already hold — a refusal like any other, so the report button.
    if (data?.verified !== "gps") { setRefused({ why: "unconfirmed", meters: null, message: null, req: reportReq }); return; }
    granted(data, req, false);
  };

  // "I'm here, but the app is saying I'm not" — always grants, always files.
  const report = async () => {
    if (!refused || reportBusy || stamped) return;
    setReportBusy(true);
    const { data, error } = await reportStamp(refused.req.payload);
    setReportBusy(false);
    if (error || !data?.id) { showToast(/sign in/i.test(error || "") ? "Sign in to stamp your Virtual Passport" : (error || "Couldn’t send that — try again"), "error"); return; }
    granted(data, refused.req, true);
  };
  const away = (m) => fmtDist(m / 1609.34);
  // "I'm here, but the app is saying I'm not" is for GPS that drifts — a reading near the place
  // (2026-10-26, now that the stamp is on every card): no reading, or one far away, gets no report.
  const reportable = (r) => !!r && !r.inside && r.why !== "denied" && r.why !== "no_fix" && !(Number.isFinite(r.meters) && r.meters > REPORT_MAX_M);
  // An inside-only place (the Empire State Building) says so in the worker's words (2026-10-18).
  const refusalText = (r) => (
    r.inside && r.message ? r.message
      : r.why === "denied" ? "Location is off for GlobeSkimmers — turn it on in Settings, then tap Stamp again."
      : r.why === "no_fix" ? "We couldn’t get a GPS reading just now — step outside or give it a moment, then tap Stamp again."
      : r.why === "unlocatable" ? "We can’t place this attraction on our map yet."
      : r.why === "unconfirmed" ? "We couldn’t confirm your GPS reading — a VPN, or a long trip today, can cause this."
      : Number.isFinite(r.meters) && r.meters > REPORT_MAX_M ? `You’re about ${away(r.meters)} from ${name}. Stamps open when you’re there.`
      : Number.isFinite(r.meters) ? `Your GPS puts you about ${away(r.meters)} from ${name} on our map.`
      : r.message || "Your GPS doesn’t show you at this place yet."
  );

  const kindWord = localFavorite ? "A Local favorite stamp" : iconic ? "An official GlobeSkimmers stamp" : "A typographic “I was here” stamp";
  const stampState = busy ? "busy" : stamped ? (wasReported ? "reported" : "stamped") : "idle";
  // An outline in stamp red: the passport moment's colour, never a second solid on the card.
  /** @type {import('react').CSSProperties} */
  const stampOutline = {
    display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, boxSizing: "border-box",
    borderRadius: 12, border: `1.5px solid ${NEUTRAL.stamp}`, background: NEUTRAL.white, color: NEUTRAL.stamp,
    fontFamily: "inherit", fontWeight: 700, lineHeight: 1.2, textAlign: "center", cursor: "pointer",
  };

  return (
    <div>
      {respect && <RespectPlaceSheet stamp={respect.stamp} place={respect.place} onChoose={chooseArt} onLater={() => setRespect(null)} />}
      <RubberStamp ref={stampRef} state={stampState} onClick={stamp} disabled={reportBusy} placeName={a.displayName?.text || a.name || undefined}>
        {iconic ? STAMP_LABEL.official : STAMP_LABEL.here}
      </RubberStamp>
      {stamped && wasReported && (
        <p style={{ marginTop: 6, fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink3, textAlign: "center" }}>Thanks for telling us — we&rsquo;ll check our map for {name}.</p>
      )}
      {!stamped && !refused && (
        <p style={{ marginTop: 6, fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink3, textAlign: "center" }}>
          {/* Each separator stays with the words before it when the line wraps. */}
          {kindWord}&nbsp;· Only at the place, by GPS&nbsp;·{" "}
          {/* A 44px hit area that keeps the line's height: the box's own margins take it back. */}
          <button type="button" onClick={() => setHowOpen((v) => !v)} aria-expanded={howOpen} aria-controls={howId}
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-14px 0", padding: 0, background: "transparent", border: 0,
              fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit", color: "inherit", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
            How stamps work
          </button>
        </p>
      )}
      <ul id={howId} hidden={!(howOpen && !stamped)}
        style={{ marginTop: 8, borderRadius: 12, background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, padding: "10px 12px 10px 28px", fontSize: fs(12.5), color: NEUTRAL.ink2, lineHeight: 1.45, listStyle: "disc" }}>
        <li>A stamp is earned by being there: your phone&rsquo;s location has to be inside the place when you tap.</li>
        <li>We never show where you stood — only the place&rsquo;s name and the date.</li>
        <li>Notes and photos are yours: private unless you choose to share them.</li>
        <li>Hospitals, clinics, schools, places of worship and other sensitive places start private. You never have to say why you were there.</li>
      </ul>
      {stamped && startedPrivate && (
        <p style={{ marginTop: 8, display: "flex", alignItems: "flex-start", gap: 8, borderRadius: 12, border: `1px solid ${NEUTRAL.creamRule}`, background: NEUTRAL.cream, padding: "10px 12px", fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
          <Lock size={16} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>This may be a sensitive place — this stamp starts private, so only you can see it. You can share it from your Passport anytime.</span>
        </p>
      )}
      {/* Not for a stamp already held: saving would replace its note, which this page never showed. */}
      {stamped && stampedId && !memSaved && !wasHeld && (
        <div style={{ marginTop: 10, borderRadius: 14, border: `1px solid ${NEUTRAL.creamRule}`, background: NEUTRAL.white, padding: "12px 12px 8px" }}>
          <div style={{ fontFamily: SERIF, fontSize: fs(18), color: NEUTRAL.ink, lineHeight: 1.2 }}>Want to remember something about this moment?</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 4, fontSize: fs(12), lineHeight: 1.4, color: NEUTRAL.ink3 }}>
            <Lock size={13} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Optional, and only you can see it — share it on your passport later if you like.</span>
          </div>
          <textarea value={memory} onChange={(e) => setMemory(e.target.value.slice(0, 280))} rows={2}
            placeholder="Best coffee ever… an important day… who you were with" aria-label="Memory"
            className="placeholder:text-[color:var(--gs-ph)]"
            style={/** @type {import('react').CSSProperties} */ ({ "--gs-ph": NEUTRAL.ink3, display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, borderRadius: 10, border: `1px solid ${NEUTRAL.creamRule}`, padding: "8px 10px", fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink, background: NEUTRAL.white, resize: "none", fontFamily: "inherit" })} />
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            <button type="button" onClick={() => setMemSaved(true)}
              style={{ minHeight: 44, padding: "0 12px", background: "transparent", border: 0, fontFamily: "inherit", fontSize: fs(13), fontWeight: 600, color: NEUTRAL.ink2, cursor: "pointer" }}>Not now</button>
            <button type="button" onClick={saveMemory} disabled={memBusy || !memory.trim()}
              style={{ ...stampOutline, padding: "0 16px", fontSize: fs(13), opacity: memory.trim() ? 1 : 0.5, cursor: memory.trim() ? "pointer" : "default" }}>{memBusy ? "Saving…" : "Save memory"}</button>
          </div>
        </div>
      )}
      {/* Always mounted, so a screen reader hears a refusal as it lands. */}
      <div aria-live="polite">
        {refused && !stamped && (
          <div style={{ marginTop: 8, borderRadius: 14, border: `1px solid ${NEUTRAL.creamRule}`, background: NEUTRAL.cream, padding: "12px 12px 8px" }}>
            <p style={{ fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink }}>{refusalText(refused)}</p>
            {reportable(refused) && (
              <>
                <button type="button" onClick={report} aria-disabled={reportBusy || undefined}
                  style={{ ...stampOutline, marginTop: 10, width: "100%", padding: "8px 12px", fontSize: fs(13.5), cursor: reportBusy ? "default" : "pointer" }}>
                  {reportBusy ? "Sending…" : "I’m here, but the app is saying I’m not"}
                </button>
                <p style={{ marginTop: 6, fontSize: fs(12), lineHeight: 1.4, color: NEUTRAL.ink3, textAlign: "center" }}>You&rsquo;ll get the stamp, and we&rsquo;ll check our map for this place.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// "I was here, get the stamp" on every place card — restaurants, cafés, shops, things to do
// (founder, 2026-10-26: "place and enable … on all … cards"). It used to show only while a
// live GPS fix from this app run sat inside the place, so a phone that reopened on its saved
// location never saw it, even standing at the counter. The proof is the tap: StampHereButton
// takes fresh readings then and the worker measures them against the place. `stamp` is the
// place's official stamp record when the card already knows it (an iconic place).
export function HereStamp({ place, formatDistance = undefined, stamp = null }) {
  const lat = Number(place?.lat), lng = Number(place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const pid = String(place.id || "");
  return (
    <StampHereButton a={{ ...place, lat, lng, placeId: pid, displayName: { text: place.name } }}
      link={{ stamp: stamp || null, gid: idKind(pid) === "google" ? pid : null }} formatDistance={formatDistance} />
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

// The detail cards print in the page's world (plan F6 detail 3; default Things to Do):
// white with a 1px world line, radius 16; a serif title in ink led by a lucide icon in the
// world's icon ink; mono kickers in the world ink, never stamp red (which belongs to the
// stamp and to 'Closed'). Loading bars shimmer on the world wash. Every link and toggle is
// a 44px target; their margins take the extra height back so the cards keep their rhythm.
function Card({ w, icon: Icon, title, children }) {
  return (
    <section style={{ background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 16, padding: "14px 16px" }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", fontFamily: SERIF, fontWeight: 400, fontSize: fs(21), lineHeight: 1.15, color: NEUTRAL.ink }}>
        <Icon size={18} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        <span>{title}</span>
      </h3>
      {children}
    </section>
  );
}
// Loading bars on the world wash (hidden from screen readers; the card's words say what is loading).
function Bars({ w, widths, first = 6 }) {
  return (
    <div aria-hidden="true" style={/** @type {import('react').CSSProperties} */ ({ "--w-wash": w.wash })}>
      {widths.map((x, i) => <span key={x} className="gs-shimmer" style={{ display: "block", height: 12, width: `${x}%`, borderRadius: 6, marginTop: i ? 8 : first }} />)}
    </div>
  );
}
/**
 * A text button with a 44px target. Its words sit `gap` px under whatever is above, on one
 * line or several; the padding and the negative margins make the target without moving them.
 * @param {string} color @param {number} size @param {number} gap
 * @returns {import('react').CSSProperties}
 */
const linkButton = (color, size, gap) => ({
  display: "flex", alignItems: "flex-start", gap: 6, minHeight: 44, boxSizing: "border-box", margin: `${gap - 8}px 0 -12px`, padding: "8px 0",
  background: "transparent", border: 0, fontFamily: "inherit", fontSize: fs(size), lineHeight: 1.3, fontWeight: 600, color, textAlign: "left",
  textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer",
});
// An external link's label and arrow: the arrow stays on the last word's line however the
// label wraps.
function OutLabel({ label, color }) {
  const cut = label.lastIndexOf(" ") + 1;
  return (
    <span>
      {label.slice(0, cut)}
      <span style={{ whiteSpace: "nowrap" }}>
        {label.slice(cut)}
        <ArrowUpRight size={15} color={color} strokeWidth={2} aria-hidden="true" focusable="false" style={{ display: "inline", verticalAlign: "-2px", marginLeft: 4 }} />
      </span>
    </span>
  );
}
// The same 44px target inside a sentence: the line keeps its height.
/** @type {import('react').CSSProperties} */
const inlineButton = {
  display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-14px 0", padding: 0, background: "transparent", border: 0,
  fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit", color: "inherit", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer",
};
function SourceLine({ url, checkedAt }) {
  const host = hostOf(url);
  if (!host) return null;
  return (
    <p style={{ marginTop: 10, fontSize: fs(11.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
      From <button type="button" onClick={() => openPartner(url)} style={inlineButton}>{host}</button>
      {checkedAt ? ` · checked ${checkedOn(checkedAt)}` : ""} · prices can change
    </p>
  );
}
// Prices are kept 3 months (founder, 2026-10-03), so every card that shows them
// offers the official page to confirm — the source page when it is on the
// official site (the tickets or parking page itself), else the official site.
const verifyUrlFor = (src, official) => {
  const sh = hostOf(src), oh = hostOf(official);
  return sh && oh && (sh === oh || sh.endsWith(`.${oh}`) || oh.endsWith(`.${sh}`)) ? src : (official || src || null);
};
function VerifyLink({ w, url, label }) {
  if (!url) return null;
  return (
    <button type="button" onClick={() => openPartner(url)} style={linkButton(w.ink, 13.5, 6)}>
      <OutLabel label={label} color={w.ink} />
    </button>
  );
}
function OfficialLink({ w, url, label }) {
  if (!url) return <p style={{ fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink3 }}>Prices aren&rsquo;t listed online — ask at the venue.</p>;
  return (
    <button type="button" onClick={() => openPartner(url)} style={linkButton(w.ink, 14, 0)}>
      <OutLabel label={label} color={w.ink} />
    </button>
  );
}
// A short line led by a 16px icon in the world's icon ink (free days, booking ahead).
function IconLine({ w, icon: Icon, children }) {
  return (
    <p style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 6, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink }}>
      <Icon size={16} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </p>
  );
}

export function TicketsCard({ visit, website = undefined, world = "todo" }) {
  const w = worldRow(world);
  if (visit === "loading") {
    return (
      <Card w={w} icon={Ticket} title="Prices">
        <p style={{ fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink3, marginBottom: 8 }}>Checking the official site for current prices…</p>
        <Bars w={w} widths={[75, 66, 50]} />
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
    <Card w={w} icon={Ticket} title="Prices">
      {!hasAny && <OfficialLink w={w} url={official} label="See prices on the official site" />}
      {free && <p style={{ fontSize: fs(18), lineHeight: 1.3, fontWeight: 700, color: NEUTRAL.open }}>Free admission</p>}
      {prices.length > 0 && (
        <div>
          {prices.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: i ? `1px solid ${w.line}` : "none" }}>
              <span style={{ fontSize: fs(14), lineHeight: 1.4, color: NEUTRAL.ink, minWidth: 0 }}>
                {p.label}
                {p.note && <span style={{ display: "block", fontSize: fs(12), color: NEUTRAL.ink3 }}>{p.note}</span>}
              </span>
              <span style={{ fontSize: fs(16), lineHeight: 1.3, fontWeight: 700, color: NEUTRAL.ink, flex: "none" }}>{p.amount === 0 ? "Free" : (p.amount_text || `${p.amount}`)}</span>
            </div>
          ))}
        </div>
      )}
      {a?.discounts?.length > 0 && (
        <ul style={{ marginTop: 6 }}>
          {a.discounts.map((d, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink }}>
              <Check size={15} color={NEUTRAL.open} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{d.label}</span>
            </li>
          ))}
        </ul>
      )}
      {a?.free_days && <IconLine w={w} icon={CalendarDays}>{a.free_days}</IconLine>}
      {a?.reservation && <IconLine w={w} icon={CalendarCheck}>{a.reservation}</IconLine>}
      {hasAny && a && <SourceLine url={a.source_url || official} checkedAt={visit.checked_at} />}
      {hasAny && a && <VerifyLink w={w} url={verifyUrlFor(a.source_url, official)} label="Verify the latest prices on the official website" />}
    </Card>
  );
}

export function ParkingCard({ visit, website = undefined, world = "todo" }) {
  const w = worldRow(world);
  if (!visit || visit === "loading") return null;
  const pk = visit.ok ? visit.parking : null;
  const official = visit.official_site || website || null;
  if (!pk?.options?.length && !pk?.note) {
    return official ? <Card w={w} icon={SquareParking} title="Parking"><OfficialLink w={w} url={official} label="Parking details on the official site" /></Card> : null;
  }
  return (
    <Card w={w} icon={SquareParking} title="Parking">
      {pk.options.map((o, i) => (
        <div key={i} style={{ padding: "7px 0", borderTop: i ? `1px solid ${w.line}` : "none" }}>
          <p style={{ fontSize: fs(14), lineHeight: 1.4, fontWeight: 600, color: NEUTRAL.ink }}>{o.label}</p>
          {o.price_text && <p style={{ fontSize: fs(13.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>{o.price_text}</p>}
        </div>
      ))}
      {pk.note && <p style={{ marginTop: 6, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink }}>{pk.note}</p>}
      <SourceLine url={pk.source_url || official} checkedAt={visit.checked_at} />
      <VerifyLink w={w} url={verifyUrlFor(pk.source_url, official)} label="Verify the latest parking info on the official website" />
    </Card>
  );
}

// One polling hook for the on-open lookups (why-visit, before-you-go): the
// worker answers { pending } while another open is writing the same place.
function useOnOpenLookup(route, id, timeoutMs) {
  const [out, setOut] = useState(id ? "loading" : null);
  useEffect(() => {
    if (!id) { setOut(null); return undefined; }
    let gone = false;
    setOut("loading");
    (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await callWorker(route, { id }, { timeoutMs });
        if (gone) return;
        if (data?.pending) { await new Promise((r) => setTimeout(r, 8000)); if (gone) return; continue; }
        setOut(data && data.ok ? data : { ok: false, busy: data?.error === "busy" || error === "busy", official_site: data?.official_site || null });
        return;
      }
      if (!gone) setOut({ ok: false });
    })();
    return () => { gone = true; };
  }, [route, id, timeoutMs]);
  return out;
}
export const useWhyVisit = (id) => useOnOpenLookup("attractions/why-visit", id, 60000);
export const useBeforeYouGo = (id) => useOnOpenLookup("attractions/before-you-go", id, 90000);

// "Something's wrong?" — clears the saved text/facts so the next open redoes
// the lookup, and lands on the admin's event list. One tap per card per open.
function ReportLine({ route, id, children }) {
  const [sent, setSent] = useState(false);
  if (!id) return null;
  if (sent) return <p role="status" style={{ marginTop: 8, fontSize: fs(12), lineHeight: 1.45, color: NEUTRAL.ink3 }}>Thanks — we&rsquo;ll look at this place again.</p>;
  return (
    <button type="button" onClick={async () => { setSent(true); await callWorker(route, { id, report: true }); showToast("Thanks — we'll recheck this place", "success"); }}
      style={{ ...linkButton(NEUTRAL.ink3, 12, 8), fontWeight: 400 }}>{children}</button>
  );
}

// Why visit (top of the page, above the stamp) + what you can do + the story.
// Everything here is ours, written once from public records and kept; a line
// the guards rejected is simply absent, so an empty card never renders.
export function WhyVisitCard({ wv, id = undefined, firstLine = undefined, world = "todo" }) {
  const w = worldRow(world);
  const [open, setOpen] = useState(false);
  const storyId = useId();
  const why = (wv && wv !== "loading" && wv.ok && wv.why_visit) || firstLine || null;
  const canDo = wv && wv !== "loading" && wv.ok && Array.isArray(wv.can_do) ? wv.can_do : [];
  const story = wv && wv !== "loading" && wv.ok && wv.story ? String(wv.story).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean) : [];
  /** @type {import('react').CSSProperties} */
  const box = { background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 16, padding: "14px 16px" };
  if (wv === "loading" && !why) {
    return <section style={box}><Bars w={w} widths={[88, 70]} first={2} /></section>;
  }
  if (!why && !canDo.length && !story.length) return null;
  return (
    <section style={box}>
      {why && (
        <>
          <h3 style={{ margin: "0 0 6px", fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.35, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: w.ink }}>Why visit</h3>
          <p style={{ fontFamily: SERIF, fontSize: fs(18), lineHeight: 1.28, color: NEUTRAL.ink }}>{why}</p>
        </>
      )}
      {canDo.length > 0 && (
        <ul style={{ marginTop: why ? 10 : 0 }}>
          {canDo.map((l, i) => <li key={i} style={{ display: "flex", gap: 8, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink, padding: "3px 0" }}><span aria-hidden="true" style={{ color: w.iconInk, fontWeight: 700 }}>·</span><span>{l}</span></li>)}
        </ul>
      )}
      {story.length > 0 && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${w.line}`, paddingTop: 2 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={storyId}
            style={{ ...linkButton(w.ink, 13.5, 8), textDecoration: "none" }}>
            <BookOpen size={16} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{open ? "Hide the story" : "Read the story"}</span>
            <ChevronDown size={14} color={NEUTRAL.ink3} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2, transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
          </button>
          <div id={storyId} hidden={!open}>
            {story.map((p, i) => <p key={i} style={{ marginTop: i ? 8 : 4, fontSize: fs(14), lineHeight: 1.5, color: NEUTRAL.ink }}>{p}</p>)}
          </div>
        </div>
      )}
      {wv && wv !== "loading" && wv.ok && <ReportLine route="attractions/why-visit" id={id}>Something&rsquo;s off?</ReportLine>}
    </section>
  );
}

// Before you go — the place's own published visiting rules, each line backed
// by a quote from the official site. Nothing here is inferred: a rule we
// couldn't find is "unknown", and the card says so.
const BYG_LIMITS = { faith: "some areas are for worshippers only", gender: "some areas are separated by gender", age: "age limits apply", tour_only: "entry is by guided tour only", permit: "a permit is needed", dress_enforced: "dress rules are enforced at the door", other: "see the rule below" };
const BYG_DRESS = { cover_shoulders: "Cover your shoulders", cover_knees: "Cover your knees", women_cover_hair: "Women cover their hair", men_cover_head: "Men cover their heads", remove_shoes: "Remove your shoes", wraps_provided: "Wraps are provided at the door", other: "" };
const BYG_SECURITY = { bag_check: "Bag check at the entrance", no_large_bags: "No large bags", lockers: "Lockers are available", id_required: "Bring ID", other: "" };
const BYG_CLOSURE = { prayer: "Prayer times", service: "Services", ceremony: "Ceremonies", weekly: "Weekly closure", seasonal: "Seasonal closure", other: "Closure" };
const minutesText = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
// A row's head in words, coloured only where the colour already has a meaning: the open
// green for 'Open to all visitors' and allowed photos, the stamp red ('Closed') for 'Not
// open to visitors'. Cautions read in ink; their words carry them.
const BYG_TONE = { green: NEUTRAL.open, red: NEUTRAL.stamp };
function BygRow({ w, icon: Icon, head, text, quote, tone }) {
  const [open, setOpen] = useState(false);
  const quoteId = useId();
  return (
    <div style={{ padding: "8px 0", borderTop: `1px solid ${w.line}` }}>
      <p style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: fs(14), lineHeight: 1.4, fontWeight: 600, color: BYG_TONE[tone] || NEUTRAL.ink }}>
        <Icon size={18} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{head}</span>
      </p>
      {text && text !== head && <p style={{ fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2, marginTop: 2, paddingLeft: 26 }}>{text}</p>}
      {quote && (
        <div style={{ paddingLeft: 26 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={quoteId}
            style={{ ...linkButton(NEUTRAL.ink3, 12, 3), fontWeight: 400 }}>{open ? "Hide what the site says" : "What the official site says"}</button>
          <p id={quoteId} hidden={!open} style={{ marginTop: -4, fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink3, fontStyle: "italic" }}>&ldquo;{quote}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
export function BeforeYouGoCard({ byg, id = undefined, website = undefined, world = "todo" }) {
  const w = worldRow(world);
  if (!byg) return null;
  if (byg === "loading") {
    return (
      <Card w={w} icon={ClipboardList} title="Before you go">
        <p style={{ fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink3, marginBottom: 8 }}>Reading the official site for visiting rules…</p>
        <Bars w={w} widths={[70, 58]} />
      </Card>
    );
  }
  const official = byg.official_site || website || null;
  if (!byg.ok || !byg.found) {
    return (
      <Card w={w} icon={ClipboardList} title="Before you go">
        <p style={{ fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink }}>{byg.busy ? "Rule lookups are paused for today." : "We couldn't find published visiting rules for this place."} Check the official site before you go.</p>
        <div style={{ marginTop: 6 }}><OfficialLink w={w} url={official} label="Visiting information on the official site" /></div>
      </Card>
    );
  }
  const rows = [];
  const e = byg.entry;
  if (e?.value === "open_to_all") rows.push({ icon: DoorOpen, head: "Open to all visitors", text: e.text, quote: e.quote, tone: "green", src: e.source_url });
  if (e?.value === "restricted") rows.push({ icon: DoorOpen, head: `Entry is limited — ${(e.limits || []).map((l) => BYG_LIMITS[l]).filter(Boolean).join("; ") || "see below"}`, text: e.text, quote: e.quote, tone: "amber", src: e.source_url });
  if (e?.value === "closed_to_visitors") rows.push({ icon: DoorOpen, head: "Not open to visitors", text: e.text, quote: e.quote, tone: "red", src: e.source_url });
  const d = byg.dress;
  if (d?.value === "stated") rows.push({ icon: Shirt, head: (d.items || []).map((x) => BYG_DRESS[x]).filter(Boolean).join(" · ") || "Dress rules apply", text: d.text, quote: d.quote, tone: "amber", src: d.source_url });
  const r = byg.reservation;
  if (r?.value) rows.push({ icon: Ticket, head: r.value === "required" ? "Book ahead — required" : r.value === "recommended" ? "Booking ahead is recommended" : "No booking needed", text: r.text, quote: r.quote, tone: r.value === "required" ? "amber" : "ink", src: r.source_url });
  const t = byg.time_needed;
  if (Number.isFinite(+t?.value)) rows.push({ icon: Timer, head: `Plan about ${minutesText(+t.value)}`, text: t.text, quote: t.quote, tone: "ink", src: t.source_url });
  for (const c of (byg.closures?.items || [])) rows.push({ icon: CalendarClock, head: BYG_CLOSURE[c.kind] || "Closure", text: c.text, quote: c.quote, tone: "amber", src: c.source_url });
  const p = byg.photography;
  if (p?.value) rows.push({ icon: p.value === "allowed" ? Camera : CameraOff, head: p.value === "allowed" ? "Photos are allowed" : p.value === "restricted" ? "Photos are limited in places" : "No photos inside", text: p.text, quote: p.quote, tone: p.value === "allowed" ? "green" : "amber", src: p.source_url });
  const s = byg.security;
  if (s?.value === "stated") rows.push({ icon: Backpack, head: (s.items || []).map((x) => BYG_SECURITY[x]).filter(Boolean).join(" · ") || "Security checks", text: s.text, quote: s.quote, tone: "ink", src: s.source_url });
  const a = byg.accessibility;
  if (a?.value === "stated") rows.push({ icon: Accessibility, head: "Accessibility", text: a.text, quote: a.quote, tone: "ink", src: a.source_url });
  for (const o of (byg.other_rules || [])) rows.push({ icon: Info, head: o.text, text: null, quote: o.quote, tone: "ink", src: o.source_url });
  const firstSrc = rows.find((x) => x.src)?.src || null;
  return (
    <Card w={w} icon={ClipboardList} title="Before you go">
      <div>{rows.map((row, i) => <BygRow key={i} w={w} {...row} />)}</div>
      <p style={{ marginTop: 10, fontSize: fs(11.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>
        From <button type="button" onClick={() => openPartner(firstSrc || official)} style={inlineButton}>{hostOf(firstSrc || official) || "the official site"}</button>
        {byg.checked_at ? ` · checked ${checkedOn(byg.checked_at)}` : ""} · rules can change
      </p>
      <VerifyLink w={w} url={verifyUrlFor(firstSrc, official)} label="Confirm on the official website" />
      <ReportLine route="attractions/before-you-go" id={id}>Something&rsquo;s wrong?</ReportLine>
    </Card>
  );
}

// Everything above, for one attraction card. children: the card's own details
// (hours, AI, website) — they sit above the guestbook, which comes last.
// world: the page's world for the cards (a WORLD row or key; Things to Do by default).
// isTablet is accepted and no longer read.
export default function AttractionExtras({ a, formatDistance = undefined, isTablet: _isTablet = false, children = undefined, world = "todo" }) {
  const w = worldRow(world);
  const guestbookId = useId();
  const link = useAttractionLink(a);
  const pid = String(a.placeId || a.id || "");
  const kind = idKind(pid);
  // Prices key on the stamp record when there is one (shared with its stamp
  // taps), else on the Google place (owned places resolve to theirs).
  const visitId = link === undefined ? null : (link.stamp?.id || link.gid || (kind === "d1" ? pid : null));
  const visit = useVisitInfo(visitId);
  // Why-visit and the visiting rules key the same way (founder, 2026-10-11:
  // written on open, kept forever; no prefill).
  const wv = useWhyVisit(visitId);
  const byg = useBeforeYouGo(visitId);
  const name = a.displayName?.text || a.name || "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
      <WhyVisitCard wv={wv} id={visitId} firstLine={a.whyVisit || null} world={w} />
      {link !== undefined && <StampHereButton a={a} link={link} formatDistance={formatDistance} />}
      <TicketsCard visit={visit} website={a.websiteUri} world={w} />
      <ParkingCard visit={visit} website={a.websiteUri} world={w} />
      <BeforeYouGoCard byg={byg} id={visitId} website={a.websiteUri} world={w} />
      {children}
      <section aria-labelledby={guestbookId}>
        <h3 id={guestbookId} style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 2px 8px", fontFamily: MONO, fontSize: fs(10.5), lineHeight: 1.35, fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase", color: w.ink }}>
          <BookOpen size={14} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
          Guestbook
        </h3>
        {link !== undefined && <Guestbook entityType="attraction" entityId={link.gid || pid} entityName={name} world={w} />}
      </section>
    </div>
  );
}
