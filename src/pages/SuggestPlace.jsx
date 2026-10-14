// SuggestPlace — "Suggest a place to stamp" (founder decisions 2026-10-10;
// mockup screens 2 and 3). Locals and people who've been name a real, public
// place, set where it is (their own GPS, or a pin on the map), say why they
// recommend it, and may add a photo. The worker decides who may suggest
// (the banner asks it as soon as a point is set), moderates the words and the
// photo, and folds a duplicate — the same name within 1 km — into the place
// already there; one person counts once per place. Then the thanks screen:
// the count toward 5, the top reason, and a nudge to ask friends who've been.
// ?id=<place> is "I recommend it too": the place's name and pin come filled
// in and stay put, so the suggestion lands on that place. Teens see the hold
// note instead of the form — suggesting is publishing.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Camera, Check, ChevronLeft, Crosshair, Info, Loader2, MapPin, Share } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useDismissable } from "@/lib/dismissStack";
import { useLocation } from "@/components/location/LocationContext";
import { showToast } from "@/components/Toast";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import HomeCityField from "@/components/home/HomeCityField";
import { getStampFix } from "@/lib/geolocation";
import { resizePhoto } from "@/lib/resizePhoto";
import { setAgeGate, splitDob } from "@/lib/passport";
import { REASONS, REVIEW_AT, reasonOf, checkSuggest, suggestPlace, getSuggestion, cityAt, progressLabel, progressPct, progressSpoken, placeWhere } from "@/lib/suggestions";

// Leaflet's default marker images resolve against the bundle and 404 — the
// same CDN fix as MoneyExchange.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#0F1419", INK2 = "#3D4550", INK3 = "#5B6470";
const TEAL = "#0E7C73", TEAL_DARK = "#0A5F58", TEAL_SOFT = "#E8F4F2";
const IVORY = "#FFFCF7", SAND = "#F7F4EC", TRACK = "#E6E1D6";
const EDGE = "rgba(15,20,25,.14)", LINE = "rgba(15,20,25,.08)";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const field = { minHeight: 48, boxSizing: "border-box", padding: "0 14px", borderRadius: 12, border: `1px solid ${EDGE}`, background: "#FFFFFF", fontSize: fs(15), color: INK, width: "100%", fontFamily: "inherit" };
const label = { fontSize: fs(13), fontWeight: 600, color: INK };
const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;
const SITE = "https://globeskimmers.io";

// Back where the traveler came from; a page opened cold goes to `fallback`.
function useBack(fallback) {
  const navigate = useNavigate();
  return () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(createPageUrl(fallback));
  };
}

// headRef: the title takes focus when a dialog closes and the button that
// opened it is gone (2026-10-12).
function Header({ title, onBack, headRef }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1.5" style={{ marginLeft: -10 }}>
      <button type="button" onClick={onBack} aria-label="Back" className="flex-none flex items-center justify-center"
        style={{ width: 44, height: 44, color: INK, background: "none", border: "none" }}>
        <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
      </button>
      <h1 ref={headRef} tabIndex={-1} style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(28), color: INK, lineHeight: 1.1, outline: "none" }}>{title}</h1>
    </div>
  );
}

// Taps on the map drop (or move) the pin.
// The pin keeps the map's own (unwrapped) longitude, so past the 180° line it
// is drawn where it was tapped; Done wraps it (2026-10-12).
function MapTaps({ onTap }) {
  useMapEvents({ click: (e) => { const ll = e.latlng; onTap({ lat: ll.lat, lng: ll.lng }); } });
  return null;
}
// Whether the map is still moving (an arrow key's glide, a flick's inertia).
function MapMotion({ movingRef }) {
  const map = useMap();
  useEffect(() => {
    const on = () => { movingRef.current = true; }, off = () => { movingRef.current = false; };
    map.on("movestart", on); map.on("moveend", off);
    return () => { map.off("movestart", on); map.off("moveend", off); };
  }, [map, movingRef]);
  return null;
}
// A map that mounts inside a just-opened sheet can measure itself before the
// sheet has its size — one re-measure once it has painted.
function SizeFix() {
  const map = useMap();
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 80); return () => clearTimeout(t); }, [map]);
  return null;
}

// Enter or Space on the focused map pins its centre, under the cross, as
// "Pin the centre" does: Leaflet's own keys only move and zoom it. The map
// is a named region, as maps elsewhere are, and its name says the keys.
// Keys on the zoom buttons, the pin and the credit inside it stay theirs
// (2026-10-12).
function CentreKeys({ onCentre }) {
  const map = useMap();
  const centreRef = useRef(onCentre);
  centreRef.current = onCentre;
  useEffect(() => {
    const el = map.getContainer();
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Map. Arrow keys move it, plus and minus zoom, Enter puts the pin at the centre.");
    const onKey = (e) => {
      if (e.target !== el || e.altKey || e.ctrlKey || e.metaKey || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      centreRef.current();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [map]);
  return null;
}

// What Tab can land on inside the pin map (Leaflet's map, pin, zoom buttons
// and credit link, and the buttons under it) and the home sheet (the search,
// its results, Cancel).
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
// The map runs edge to edge; its zoom buttons and credit clear the notch in
// iPhone landscape (2026-10-12). Below it, "Pin the centre" has a row of its
// own above Cancel and Done on a phone held upright; from 540 px wide — a
// phone on its side — the three share a row, so the map keeps more height,
// and the lines above and below the map run wider, clear of a notch, so each
// label fits on one line (2026-10-12).
const PIN_MAP_CSS = ".gs-pin-map .leaflet-left{left:env(safe-area-inset-left,0px)}.gs-pin-map .leaflet-right{right:env(safe-area-inset-right,0px)}"
  + ".gs-pin-w{max-width:28rem}.gs-pin-bar{display:flex;flex-wrap:wrap;gap:8px}.gs-pin-bar>button{flex:1 1 0}.gs-pin-bar>.gs-pin-centre{flex-basis:100%}"
  + "@media (min-width:540px){.gs-pin-w{max-width:min(42rem,calc(100% - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px)))}.gs-pin-bar>.gs-pin-centre{flex-basis:0}}";

// "Pin it on the map": a full-screen map, centred on the point already set or
// where the traveler is; tap to drop the pin, tap again or drag to move it.
// Not on the swipe-down dismiss stack — a downward pan would close it.
// returnTo: where focus goes on close when the button that opened it is gone
// or never took focus (2026-10-12).
// Without a tap (2026-10-12): a cross marks the map's centre, and "Pin the
// centre" — or Enter on the map — puts the pin there, so a keyboard moves the
// map with its arrow keys and then drops the pin.
function PinMap({ start, center, onCancel, onDone, returnTo }) {
  const [pin, setPin] = useState(start || null);
  const [centred, setCentred] = useState(0);   // pins put at the centre, for the screen-reader line
  const boxRef = useRef(null);
  const headRef = useRef(null);
  const mapRef = useRef(null);                  // the Leaflet map (MapContainer's ref)
  const moving = useRef(false);                 // MapMotion keeps it
  const waiting = useRef(false);                // a centre pin waiting for the map to stop
  const pinCentre = () => {
    const map = mapRef.current;
    if (!map || waiting.current) return;
    const put = () => { waiting.current = false; const ll = map.getCenter(); setPin({ lat: ll.lat, lng: ll.lng }); setCentred((n) => n + 1); };
    // Mid-glide the centre is still on its way: pin where the map comes to
    // rest, under the cross (2026-10-12).
    if (!moving.current) { put(); return; }
    waiting.current = true;
    let late = null;
    const settle = () => { clearTimeout(late); map.off("moveend", settle); put(); };
    late = setTimeout(settle, 1500);   // never stuck waiting for an end that doesn't come
    map.on("moveend", settle);
  };
  // The latest onCancel, for the listeners below that stay put while it's open.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // A dialog (2026-10-12): it takes focus at its heading and hands it back on
  // close, Tab and Shift+Tab go round inside it, and Escape cancels.
  useEffect(() => {
    const opener = document.activeElement;
    headRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { cancelRef.current(); return; }
      if (e.key !== "Tab" || !boxRef.current) return;
      const els = [...boxRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      const at = els.indexOf(document.activeElement);
      if (!els.length || (e.shiftKey ? at <= 0 : at === -1 || at === els.length - 1)) {
        e.preventDefault();
        if (els.length) (e.shiftKey ? els[els.length - 1] : els[0]).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // The GPS hint's link leaves once the pin is moved; a tap in Safari
      // doesn't focus a button at all (2026-10-12).
      const to = opener?.isConnected && opener !== document.body ? opener : returnTo?.current;
      if (to?.isConnected && typeof to.focus === "function") to.focus();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Android's back key closes the map, not the page (and the form with it).
  // Nothing else in the app listens for it, and Capacitor goes back in
  // history only while nothing does — so its default returns on close.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let handle = null, gone = false;
    Promise.resolve(App.addListener("backButton", () => cancelRef.current()))
      .then((h) => { if (gone) h?.remove(); else handle = h; })
      .catch(() => {});
    return () => { gone = true; handle?.remove(); };
  }, []);

  const c = start || center || null;
  return (
    <div ref={boxRef} className="fixed inset-0 z-[9998] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="gs-pin-h"
      style={{ background: IVORY, color: INK, paddingTop: "env(safe-area-inset-top)" }}>
      <style>{PIN_MAP_CSS}</style>
      <div className="gs-pin-w w-full mx-auto px-4 pt-4 pb-3">
        <h2 id="gs-pin-h" ref={headRef} tabIndex={-1} style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(26), lineHeight: 1.1, outline: "none" }}>Pin it on the map</h2>
        <p style={{ margin: "4px 0 0", fontSize: fs(13), lineHeight: 1.4, color: INK2 }}>Tap the map where the place is, or line the cross up with it and press &ldquo;Pin the centre&rdquo;. Tap again, or drag the pin, to move it.</p>
      </div>
      <div className="gs-pin-map relative flex-1 min-h-0" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <MapContainer ref={mapRef} center={c ? [c.lat, c.lng] : [20, 0]} zoom={start ? 17 : c ? 15 : 2} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          <MapTaps onTap={setPin} />
          <SizeFix />
          <CentreKeys onCentre={pinCentre} />
          <MapMotion movingRef={moving} />
          {pin && (
            <Marker position={[pin.lat, pin.lng]} draggable
              eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); setPin({ lat: ll.lat, lng: ll.lng }); } }} />
          )}
        </MapContainer>
        {/* The centre: over the map, under its buttons; taps go through it. */}
        <div aria-hidden="true" className="gs-pin-cross absolute" style={{ left: "50%", top: "50%", width: 30, height: 30, margin: "-15px 0 0 -15px", pointerEvents: "none", zIndex: 500 }}>
          <Crosshair size={30} strokeWidth={4} color="#FFFFFF" className="absolute inset-0" />
          <Crosshair size={30} strokeWidth={1.75} color={INK} className="absolute inset-0" />
        </div>
      </div>
      <div role="status" className="sr-only">{centred > 0 && <span key={centred}>Pin placed at the centre of the map.</span>}</div>
      <div className="gs-pin-bar gs-pin-w w-full mx-auto px-4 pt-3" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={pinCentre} className="gs-pin-centre flex items-center justify-center gap-2 font-semibold"
          style={{ minHeight: 48, padding: "4px 10px", borderRadius: 14, border: `1px solid ${EDGE}`, background: "#FFFFFF", color: TEAL_DARK, fontSize: fs(15), lineHeight: 1.2 }}>
          <Crosshair size={17} strokeWidth={2} className="flex-none" aria-hidden="true" />
          Pin the centre
        </button>
        <button type="button" onClick={onCancel} className="font-semibold"
          style={{ minHeight: 48, padding: "4px 10px", borderRadius: 14, border: `1px solid ${EDGE}`, background: "#FFFFFF", color: INK, fontSize: fs(15), lineHeight: 1.2 }}>Cancel</button>
        <button type="button" onClick={() => { if (!pin) return; const w = L.latLng(pin.lat, pin.lng).wrap(); onDone({ lat: w.lat, lng: w.lng }); }} disabled={!pin} className="font-semibold disabled:opacity-50"
          style={{ minHeight: 48, padding: "4px 10px", borderRadius: 14, border: "none", background: TEAL, color: "#FFFFFF", fontSize: fs(15), lineHeight: 1.2 }}>
          {pin ? "Done" : "Tap the map first"}
        </button>
      </div>
    </div>
  );
}

// Who may suggest here, once a point is set (founder: locals and people who've been).
// noHome: the profile has no home city or pin, so a local here can't count
// as one yet — the not-eligible banner offers to add one right here, in a
// sheet over the form (2026-10-12).
// check.quiet: a send refused as not eligible turned it, and the alert under
// the button says those same words — so this change isn't read out again.
function EligibilityBanner({ check, noHome, onAddHome }) {
  if (!check || check.status === "error") return null;
  const ok = check.status === "done" && check.eligible;
  const no = check.status === "done" && !check.eligible;
  const tone = ok ? { background: TEAL_SOFT, color: TEAL_DARK } : no ? { background: "#FFF3DC", color: "#8A5A00" } : { background: SAND, color: INK2 };
  return (
    <div role="status" aria-live={check.quiet ? "off" : "polite"} className="flex items-center gap-2" style={{ ...tone, padding: "10px 12px", borderRadius: 12, fontSize: fs(13), lineHeight: 1.35 }}>
      {check.status === "checking" ? <Loader2 size={18} className="flex-none animate-spin" aria-hidden="true" />
        : ok ? <Check size={18} strokeWidth={2} className="flex-none" aria-hidden="true" />
        : <Info size={18} strokeWidth={2} className="flex-none" aria-hidden="true" />}
      <span>
        {check.status === "checking" ? "Checking who can suggest here…"
          : ok && check.who === "local" ? <>You can suggest here: <b>{check.homeCity ? `you live in ${check.homeCity}` : "you live nearby"}</b>. People with a stamp nearby can too.</>
          : ok ? <>You can suggest here: <b>you have a stamp nearby</b>.</>
          : <>Suggestions come from locals and people who&rsquo;ve been — get a stamp near here first.</>}
        {no && noHome && (
          <span className="block" style={{ marginTop: 4 }}>
            Live here?{" "}
            <button type="button" onClick={onAddHome}
              style={{ padding: 0, border: "none", background: "none", color: "inherit", fontSize: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 }}>
              Add your home city
            </button>
          </span>
        )}
      </span>
    </div>
  );
}

// A picked home city by name — "Pasadena, United States" — and whether two
// picks are the same place (its time zone aside: a second look-up that fell
// back to the country's zone doesn't make it another city) (2026-10-12).
const homeName = (p) => [p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "your home city";
const sameHome = (a, b) => ["city", "country", "latitude", "longitude"].every((k) => a[k] === b[k]);

// "Live here?" — the home city, picked without leaving the form (2026-10-12):
// the picker Settings and onboarding use; the page saves it. A dialog like the
// pin map: focus in at its heading and back on close, Tab and Shift+Tab go
// round inside, and Escape, a tap outside, a swipe down and Android's back key
// all cancel. openerRef: the button that opened it; fallbackRef: where focus
// goes when that button is gone (a saved home city takes the "Live here?"
// line away). saving: the city being saved, by name, so a mis-tap shows; a
// pick made meanwhile is saved after it. error: { text, n } — a save that
// didn't go, said in an alert inside the sheet, where a screen reader in it
// hears it (2026-10-12).
function HomeSheet({ saving, error, openerRef, fallbackRef, onPick, onCancel }) {
  const boxRef = useRef(null);
  const headRef = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useDismissable(true, onCancel);

  useEffect(() => {
    const opener = openerRef?.current;
    headRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { cancelRef.current(); return; }
      if (e.key !== "Tab" || !boxRef.current) return;
      const els = [...boxRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      const at = els.indexOf(document.activeElement);
      if (!els.length || (e.shiftKey ? at <= 0 : at === -1 || at === els.length - 1)) {
        e.preventDefault();
        if (els.length) (e.shiftKey ? els[els.length - 1] : els[0]).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const to = opener?.isConnected ? opener : fallbackRef?.current;
      if (to?.isConnected && typeof to.focus === "function") to.focus();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Android's back key closes the sheet, not the page — as on the pin map.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let handle = null, gone = false;
    Promise.resolve(App.addListener("backButton", () => cancelRef.current()))
      .then((h) => { if (gone) h?.remove(); else handle = h; })
      .catch(() => {});
    return () => { gone = true; handle?.remove(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" onClick={() => cancelRef.current()} style={{ background: "rgba(15,20,25,.45)" }}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="gs-home-h" aria-busy={!!saving} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col"
        style={{ gap: 12, padding: "20px 18px calc(18px + env(safe-area-inset-bottom))", borderRadius: "22px 22px 0 0", background: IVORY, color: INK,
          maxHeight: "calc(100% - 16px - env(safe-area-inset-top))", overflowY: "auto" }}>
        <div>
          <h2 id="gs-home-h" ref={headRef} tabIndex={-1} style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(26), lineHeight: 1.1, outline: "none" }}>Where&rsquo;s home?</h2>
          <p style={{ margin: "4px 0 0", fontSize: fs(13), lineHeight: 1.4, color: INK2 }}>It&rsquo;s saved to your profile — you can change it in Settings.</p>
        </div>
        <HomeCityField onSelect={onPick} />
        {saving && (
          <div className="flex items-center gap-2" style={{ fontSize: fs(13), color: INK2 }}>
            <Loader2 size={16} className="flex-none animate-spin" aria-hidden="true" />
            <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>Saving {saving}…</span>
          </div>
        )}
        {error && (
          <p key={error.n} role="alert" style={{ margin: 0, fontSize: fs(12.5), lineHeight: 1.4, color: "#B0472F" }}>{error.text}</p>
        )}
        <button type="button" onClick={() => cancelRef.current()} className="font-semibold"
          style={{ height: 48, borderRadius: 14, border: `1px solid ${EDGE}`, background: "#FFFFFF", color: INK, fontSize: fs(15) }}>Cancel</button>
      </div>
    </div>
  );
}

// After sending (mockup screen 3): where the place stands now.
function Thanks({ result, onSeeAll }) {
  const p = result.place;
  const count = p.count || 0;
  const where = placeWhere(p);
  const top = reasonOf(p.top_reason);
  const topLine = !top ? null : top.key === "other" ? "in their own words" : top.label.charAt(0).toLowerCase() + top.label.slice(1);
  // A held, declined or removed place never gets here: the worker refuses it
  // (409) with its own message.
  const approved = p.status === "approved";
  const counted = count >= REVIEW_AT ? <><b>{count} suggestions</b> — it&rsquo;s in review</> : <><b>{count} of {REVIEW_AT}</b> suggestions</>;
  const body = approved ? <><b>{p.name}</b> is already a Local favorite stamp, now recommended by <b>{people(count)}</b>.</>
    : !result.added ? <>You&rsquo;d suggested <b>{p.name}</b> before, so we updated yours — you still count once. It has {counted}.</>
    : count >= REVIEW_AT ? <><b>{p.name}</b> now has {counted}. Approved places become a Local favorite stamp.</>
    : <><b>{p.name}</b> now has {counted}. When it reaches {REVIEW_AT}, we review it, and approved places become a Local favorite stamp.</>;

  // A new screen under a screen reader: it starts at the heading (2026-10-12).
  const headRef = useRef(null);
  useEffect(() => { headRef.current?.focus(); }, []);

  // The ask says where the place stands now: a stamp, in review, or still
  // gathering suggestions (2026-10-12).
  const ask = async () => {
    const been = `Been to ${p.name}${where ? ` in ${where}` : ""}?`;
    const text = approved ? `${been} It's a Local favorite stamp on GlobeSkimmers, recommended by ${people(count)} who've been there. If you've been too, add yours. ${SITE}`
      : count >= REVIEW_AT ? `${been} I suggested it as a Local favorite stamp on GlobeSkimmers. ${count} people have, and it's in review. If you've been too, add yours. ${SITE}`
      : `${been} I suggested it as a Local favorite stamp on GlobeSkimmers. If you've been too, suggest it: once ${REVIEW_AT} people do, it's reviewed to become a stamp. ${SITE}`;
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share")) {
        const { Share: NativeShare } = await import("@capacitor/share");
        await NativeShare.share({ title: p.name, text });
      } else if (navigator.share) {
        await navigator.share({ title: p.name, text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast("Copied — paste it to a friend", "success");
      }
    } catch (e) {
      if (e?.name !== "AbortError" && !/cancel/i.test(String(e?.message || e))) showToast(e?.message || "Couldn't open sharing", "error");
    }
  };

  return (
    <div className="flex flex-col justify-center" style={{ minHeight: "68vh", gap: 22, padding: "20px 8px" }}>
      <div className="self-center flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: "50%", background: TEAL_SOFT, color: TEAL }}>
        <Check size={38} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div className="flex flex-col text-center" style={{ gap: 8 }}>
        <h1 ref={headRef} tabIndex={-1} style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(34), lineHeight: 1.05, color: INK, outline: "none" }}>
          {result.added ? "Thanks for the tip!" : "Your suggestion is updated"}
        </h1>
        <p style={{ margin: 0, fontSize: fs(15.5), lineHeight: 1.45, color: INK2 }}>{body}</p>
      </div>

      <div className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 16, background: "#FFFFFF", border: `1px solid ${LINE}` }}>
        <div className="flex justify-between gap-3" style={{ fontSize: fs(13), fontWeight: 600, color: INK }}>
          <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>{[p.name, where].filter(Boolean).join(" · ")}</span>
          <span className="flex-none" style={{ color: TEAL }}>{approved ? "Local favorite" : progressLabel(count)}</span>
        </div>
        <div role="img" aria-label={approved ? "A Local favorite stamp" : progressSpoken(count)} className="overflow-hidden" style={{ height: 8, borderRadius: 99, background: TRACK }}>
          <div style={{ height: 8, borderRadius: 99, background: TEAL, width: approved ? "100%" : progressPct(count) }} />
        </div>
        {topLine && <div style={{ fontSize: fs(12.5), color: INK3 }}>Top reason so far: {topLine}</div>}
      </div>

      <div className="flex flex-col" style={{ gap: 10 }}>
        <button type="button" onClick={ask} className="flex items-center justify-center gap-2 font-semibold"
          style={{ minHeight: 52, borderRadius: 14, border: "none", background: TEAL, color: "#FFFFFF", fontSize: fs(16) }}>
          <Share size={18} strokeWidth={2} aria-hidden="true" />
          Ask friends who&rsquo;ve been
        </button>
        <button type="button" onClick={onSeeAll} className="flex items-center justify-center font-semibold"
          style={{ minHeight: 48, background: "none", border: "none", color: TEAL, fontSize: fs(15) }}>
          See everyone&rsquo;s suggestions
        </button>
      </div>
      {!approved && <div className="text-center" style={{ fontSize: fs(12.5), color: INK3 }}>We&rsquo;ll let you know if it becomes a stamp.</div>}
    </div>
  );
}

export default function SuggestPlacePage() {
  const navigate = useNavigate();
  const goBack = useBack("Home");
  const routerLocation = useRouterLocation();
  const prefillId = new URLSearchParams(routerLocation.search).get("id");
  const { socialTier, refreshSocialTier, profile, user, refreshProfile } = useAuth();
  const { currentGpsLocation, activeLocation } = useLocation();

  const [prefill, setPrefill] = useState(null);       // the place "I recommend it too" is for
  const [prefillBusy, setPrefillBusy] = useState(!!prefillId);
  const [name, setName] = useState("");
  const [point, setPoint] = useState(null);           // { lat, lng }
  const [source, setSource] = useState(null);         // 'gps' | 'map' | 'place'
  const [geo, setGeo] = useState(null);               // { city, region, country }
  const [geoBusy, setGeoBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [fixAcc, setFixAcc] = useState(null);         // metres, when the point came from GPS
  const [mapOpen, setMapOpen] = useState(false);
  const [check, setCheck] = useState(null);           // { status: 'checking'|'done'|'error', eligible, who, homeCity, quiet }
  const [reason, setReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [photo, setPhoto] = useState(null);           // data URL from resizePhoto
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needBirthday, setNeedBirthday] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [result, setResult] = useState(null);         // { added, place } → the thanks screen
  const [sendError, setSendError] = useState(null);   // { text, n }: the last send's error, under the button
  const [homeOpen, setHomeOpen] = useState(false);    // "Live here?": the home-city sheet
  const [homeSaving, setHomeSaving] = useState(null); // the city being saved, by name — null when none is
  const [homeError, setHomeError] = useState(null);   // { text, n }: the last home save that didn't go, in the sheet
  const fileRef = useRef(null);
  const bdayRef = useRef(null);
  const titleRef = useRef(null);                      // the page title
  const mapBtnRef = useRef(null);                     // "Pin it on the map" / "Move the pin"
  const homeFrom = useRef(null);                      // the button that opened the home sheet
  const homeBusy = useRef(false);
  const homePick = useRef(null);                      // the newest home city picked, not saved yet
  const homeShown = useRef(false);                    // the sheet is open, for a save that ends after it closed
  homeShown.current = homeOpen;
  const whereSeq = useRef(0);                         // bumped by every new point, and by starting over
  const spot = useRef(null);                          // the point set last, for asking again after a wait
  const checkSeq = useRef(0);                         // bumped by every ask of who may suggest; an older answer is dropped
  const photoSeq = useRef(0);                         // the newest photo read; an older one is dropped
  const errSeq = useRef(0);                           // numbers each alert (send or home save), so the same words are said anew

  // A send that didn't go says why under the button, in an alert a screen
  // reader speaks (each one anew, even the same words again), until the next
  // edit. The toast shows the same words but stays quiet, so they're heard
  // once (2026-10-12).
  const fail = (text) => { setSendError({ text, n: ++errSeq.current }); showToast(text, "error", 3000, { silent: true }); };
  const edited = () => setSendError(null);

  // The birthday step appears: its field takes focus (2026-10-12).
  useEffect(() => { if (needBirthday) bdayRef.current?.focus(); }, [needBirthday]);

  // Ask the worker who may suggest at pt. A newer point, or a newer ask about
  // this one (a home city just saved), wins over a slower answer (2026-10-12).
  const askWho = async (pt, city) => {
    const my = whereSeq.current, n = ++checkSeq.current;
    setCheck({ status: "checking" });
    const res = await checkSuggest({ lat: pt.lat, lng: pt.lng, city: city || undefined });
    if (my !== whereSeq.current || n !== checkSeq.current) return;
    if (res.code === "teen_hold" || res.code === "under_age") refreshSocialTier();
    setCheck(res.error ? { status: "error" } : { status: "done", eligible: res.eligible, who: res.who, homeCity: res.homeCity });
  };

  // A point is set: name its town (the place's own record), then ask the
  // worker who may suggest there. A newer point wins over a slower answer.
  const setWhere = async (pt, how, known) => {
    const my = ++whereSeq.current;
    spot.current = pt;
    edited();
    setPoint(pt); setSource(how);
    setCheck({ status: "checking" });
    let g = known || null;
    if (g) { setGeo(g); setGeoBusy(false); }
    else {
      setGeo(null); setGeoBusy(true);
      g = await cityAt(pt.lat, pt.lng);
      if (my !== whereSeq.current) return;
      setGeo(g); setGeoBusy(false);
    }
    await askWho(pt, g?.city);
  };

  // A home city picked in the sheet is saved the way Settings saves one: the
  // same profile fields, and its fallback for a database without the home_*
  // columns. true when it's saved.
  const writeHome = async (place) => {
    const patch = { home_city: place.city, home_country: place.country, home_city_country: place.country, home_lat: place.latitude, home_lng: place.longitude, home_timezone: place.timezone };
    try {
      let { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error && /home_(city|lat|lng|timezone)/.test(error.message || "")) {
        const safe = { ...patch };
        delete safe.home_city; delete safe.home_lat; delete safe.home_lng; delete safe.home_timezone;
        ({ error } = await supabase.from("profiles").update(safe).eq("id", user.id));
      }
      return !error;
    } catch { return false; }
  };

  // The last pick wins (2026-10-12): a city picked while a save runs waits,
  // and is saved once that one is done — a mis-tap put right isn't dropped,
  // and the same city twice is saved once. Only then is the profile read
  // again, the sheet closed, and the banner asked again about the same
  // point; the draft stays as it is.
  const saveHome = async (place) => {
    if (!user?.id) return;
    homePick.current = place;
    setHomeSaving(homeName(place));
    if (homeBusy.current) return;                     // the save running now takes it next
    homeBusy.current = true;
    setHomeError(null);
    let saved = null, failed = null;                  // the last pick saved, and the newest that wasn't
    do {
      let wrote = false;
      while (homePick.current) {
        const p = homePick.current;
        homePick.current = null;
        if (saved && sameHome(p, saved)) { failed = null; continue; }
        if (await writeHome(p)) { saved = p; failed = null; wrote = true; } else failed = p;
      }
      // Saved but not read back: the banner still asks the worker, which reads the saved home.
      if (wrote) { try { await refreshProfile(); } catch { /* see above */ } }
    } while (homePick.current);                       // picked while the profile was read
    homeBusy.current = false; setHomeSaving(null);
    if (saved) {
      // Cancelled mid-save, focus went back to "Add your home city" — which
      // this save takes away — so the title has it instead.
      if (document.activeElement === homeFrom.current) titleRef.current?.focus();
      edited();
      if (spot.current) askWho(spot.current);
    }
    if (!failed) { setHomeOpen(false); setHomeError(null); return; }
    // Said in the sheet, where a screen reader in it hears it: the toast shows
    // the same words, and speaks them only when the sheet has closed — a
    // cancel mid-save (2026-10-12).
    const text = `Couldn’t save ${homeName(failed)} — check your connection.${saved ? ` Your home city is ${homeName(saved)} for now.` : ""}`;
    if (homeShown.current) setHomeError({ text, n: ++errSeq.current });
    showToast(text, "error", 3000, { silent: homeShown.current });
  };

  // "I recommend it too": the place's name and pin, and my earlier reason.
  useEffect(() => {
    if (!prefillId) { setPrefill(null); setPrefillBusy(false); return undefined; }
    let gone = false;
    setPrefillBusy(true);
    (async () => {
      const { place, error, notFound } = await getSuggestion(prefillId);
      if (gone) return;
      setPrefillBusy(false);
      if (!place) {
        showToast(notFound ? "That place isn’t taking suggestions — you can suggest a place below" : (error || "Couldn’t load that place"), "error");
        return;
      }
      setPrefill(place);
      setName(place.name);
      if (place.my?.reason) setReason(place.my.reason);
      setWhere({ lat: place.lat, lng: place.lng }, "place", { city: place.city, region: place.region, country: place.country });
    })();
    return () => { gone = true; };
  }, [prefillId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearPrefill = () => {
    whereSeq.current += 1;
    spot.current = null;
    edited();
    setPrefill(null); setName(""); setPoint(null); setSource(null); setGeo(null); setCheck(null);
    navigate(createPageUrl("SuggestPlace"), { replace: true });
  };

  // GPS takes seconds: a point set meanwhile — the place "I recommend it too"
  // is for, a map pin, or starting over — wins, and the late fix is dropped
  // (2026-10-12). whereSeq tells, not the prefill state this closure saw.
  const locateMe = async () => {
    if (locBusy) return;
    setLocBusy(true);
    const seq = whereSeq.current;
    let fix = null;
    try { fix = await getStampFix(); }
    catch (e) {
      if (seq === whereSeq.current) {
        showToast(e?.code === 1 ? "Location is off for GlobeSkimmers — turn it on in Settings, or pin the place on the map"
          : "We couldn’t get a GPS reading just now — pin the place on the map instead", "error");
      }
    }
    setLocBusy(false);
    if (!fix || seq !== whereSeq.current) return;
    setFixAcc(Number.isFinite(fix.acc) ? fix.acc : null);
    setWhere({ lat: fix.lat, lng: fix.lng }, "gps");
  };

  // While a photo is read the send waits for it (the button says so); a
  // newer pick or Remove drops an older read still going (2026-10-12).
  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const my = ++photoSeq.current;
    edited();
    setPhotoBusy(true);
    try {
      const url = await resizePhoto(f);
      if (my === photoSeq.current) setPhoto(url);
    } catch (err) {
      if (my === photoSeq.current) showToast(err?.message || "Couldn't read that photo", "error");
    }
    if (my === photoSeq.current) setPhotoBusy(false);
  };
  const removePhoto = () => { photoSeq.current += 1; edited(); setPhoto(null); setPhotoBusy(false); };

  // Send; a missing birthday is asked here once (like every posting door)
  // and the send goes again.
  const submit = async () => {
    if (busy || photoBusy) return;
    const n = name.trim(), why = otherText.trim();
    const seq = whereSeq.current, sent = photo;   // the point and photo this send is for
    edited();
    if (!point) { fail("Set where the place is — use your location or pin it on the map"); return; }
    if (n.length < 2) { fail("Enter the place’s name"); return; }
    if (!reason) { fail("Pick why you recommend it"); return; }
    if (reason === "other" && why.length < 2) { fail("Tell us why, in a few words"); return; }
    setBusy(true);
    if (needBirthday) {
      const dob = splitDob(birthday);
      if (!dob) { setBusy(false); fail("Enter your full birthday"); return; }
      const { error: ageErr } = await setAgeGate(dob.year, dob.md);
      if (ageErr && ageErr !== "age_required") { setBusy(false); fail(ageErr); return; }
      setNeedBirthday(false);
      const tier = await refreshSocialTier(); // a teen sees the hold, an under-13 the freeze, right away
      if (tier === "teen" || tier === "blocked") { setBusy(false); return; }
    }
    const send = () => suggestPlace({
      name: n, lat: point.lat, lng: point.lng,
      city: geo?.city, region: geo?.region, country: geo?.country,
      reason, other_text: reason === "other" ? why : undefined, image: sent || undefined,
    });
    let res = await send();
    if (res.code === "age_required") {
      // The field takes focus and says its label, these same words: the
      // toast only shows (2026-10-12).
      if (res.code === "age_required") { setBusy(false); setNeedBirthday(true); showToast("One thing first — your birthday", "success", 3000, { silent: true }); return; }
    }
    setBusy(false);
    if (res.error) {
      if (res.code === "teen_hold" || res.code === "under_age") refreshSocialTier();
      // The banner turns to "not here" — unless the point moved since, which
      // has its own check running. It turns quietly: the alert below says the
      // same words, and a check still on its way is older news (2026-10-12).
      if (res.code === "not_eligible" && seq === whereSeq.current) {
        checkSeq.current += 1;
        setCheck((c) => ({ ...c, status: "done", eligible: false, who: null, quiet: true }));
      }
      if (res.code === "photo_blocked") setPhoto((cur) => (cur === sent ? null : cur));
      // Everything else — held or declined (409) too — in the worker's own words.
      fail(res.error);
      return;
    }
    if (!res.place) { showToast("Thanks — your suggestion is in", "success"); navigate(createPageUrl("Suggestions")); return; }
    setResult({ added: res.added, place: res.place });
    window.scrollTo(0, 0);
  };

  const shell = (children, title = "Suggest a place") => (
    <div className="min-h-screen pb-28" style={{ background: IVORY, color: INK }}>
      <div className="max-w-md md:max-w-2xl mx-auto px-4">
        {title && <Header title={title} onBack={goBack} headRef={titleRef} />}
        {children}
      </div>
    </div>
  );

  // 13–17: suggesting is publishing — the hold note (founder, 2026-10-11).
  if (socialTier === "teen") return shell(<TeenHoldNote className="mt-3" />);
  if (result?.place) return shell(<Thanks result={result} onSeeAll={() => navigate(createPageUrl("Suggestions"))} />, null);

  const lc = currentGpsLocation?.coordinates || activeLocation?.coordinates;
  const mapCenter = Number.isFinite(lc?.latitude) && Number.isFinite(lc?.longitude) ? { lat: lc.latitude, lng: lc.longitude } : null;
  const whereText = geo ? [geo.city, geo.region, geo.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ") : "";
  const blocked = check?.status === "done" && !check.eligible;
  // No home on file at all — no city, no pin (unknown until the profile loads).
  const noHome = !!profile && !profile.home_city && (profile.home_lat == null || profile.home_lng == null);
  const pickBtn = (on) => ({ flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${on ? TEAL : EDGE}`, background: on ? TEAL_SOFT : "#FFFFFF", color: on ? TEAL_DARK : INK, fontSize: fs(14), fontWeight: 600 });

  return shell(
    <>
      {mapOpen && (
        <PinMap start={point} center={mapCenter} returnTo={mapBtnRef} onCancel={() => setMapOpen(false)}
          onDone={(pt) => { setMapOpen(false); setWhere(pt, "map"); }} />
      )}
      {homeOpen && (
        <HomeSheet saving={homeSaving} error={homeError} openerRef={homeFrom} fallbackRef={titleRef}
          onPick={saveHome} onCancel={() => { setHomeOpen(false); setHomeError(null); }} />
      )}
      <div className="flex flex-col pt-1" style={{ gap: 16 }}>
        <EligibilityBanner check={check} noHome={noHome} onAddHome={(e) => { homeFrom.current = e.currentTarget; setHomeOpen(true); }} />

        <div className="flex flex-col" style={{ gap: 6 }}>
          <label htmlFor="gs-sp-name" style={label}>The place</label>
          <input id="gs-sp-name" type="text" value={name} onChange={(e) => { setName(e.target.value.slice(0, 80)); edited(); }} readOnly={!!prefill}
            placeholder={prefillBusy ? "Loading the place…" : "Its name, as people know it"} autoCapitalize="words" autoComplete="off" maxLength={80}
            style={{ ...field, ...(prefill ? { background: SAND } : {}) }} />
          {prefill ? (
            <>
              <div className="flex items-center gap-1.5" style={{ fontSize: fs(12.5), color: TEAL_DARK, fontWeight: 600 }}>
                <MapPin size={14} aria-hidden="true" />
                <span>{[whereText || "On the map", `suggested by ${people(prefill.count || 0)}`].join(" · ")}</span>
              </div>
              {prefill.my?.suggested && (
                <div style={{ fontSize: fs(12.5), color: INK3 }}>You&rsquo;ve suggested it before — sending again updates your reason. You still count once.</div>
              )}
              <button type="button" onClick={clearPrefill} className="self-start"
                style={{ fontSize: fs(12.5), fontWeight: 600, color: TEAL, background: "none", border: "none", padding: 0 }}>Suggest a different place</button>
            </>
          ) : prefillBusy ? (
            // "I recommend it too" is loading: its pin is on the way, so no
            // other way to set one yet (2026-10-12).
            <div role="status" className="flex items-center gap-1.5" style={{ fontSize: fs(12.5), color: INK3 }}>
              <Loader2 size={14} className="flex-none animate-spin" aria-hidden="true" />
              <span>Loading its spot on the map…</span>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button type="button" onClick={locateMe} disabled={locBusy} aria-pressed={source === "gps"}
                  className="flex items-center justify-center gap-1.5" style={pickBtn(source === "gps")}>
                  {locBusy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Finding you…</>
                    : source === "gps" ? <><Check size={15} aria-hidden="true" /> My location</> : "Use my location"}
                </button>
                <button ref={mapBtnRef} type="button" onClick={() => setMapOpen(true)} aria-pressed={source === "map"}
                  className="flex items-center justify-center gap-1.5" style={pickBtn(source === "map")}>
                  {source === "map" ? <><Check size={15} aria-hidden="true" /> Move the pin</> : "Pin it on the map"}
                </button>
              </div>
              {point && (
                <div className="flex items-center gap-1.5" style={{ fontSize: fs(12.5), color: TEAL_DARK, fontWeight: 600 }}>
                  <MapPin size={14} aria-hidden="true" />
                  <span>{geoBusy ? "Finding the town…" : whereText || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}</span>
                </div>
              )}
              {/* "Use my location" puts the phone's own spot on the pin, and
                  the pin becomes the stamp's spot (150 m around it): one line
                  says so, with the way to move it — a rough reading says that
                  too, in the same line (2026-10-12). */}
              {point && source === "gps" && (
                <div style={{ fontSize: fs(12.5), lineHeight: 1.4, color: fixAcc > 100 ? "#8A5A00" : INK2 }}>
                  {fixAcc > 100
                    ? <>Pinned where you&rsquo;re standing now, from a rough GPS reading (about {Math.round(fixAcc)} m). Not at the place, or not right on it?</>
                    : <>Pinned where you&rsquo;re standing now. Not at the place?</>}{" "}
                  <button type="button" onClick={() => setMapOpen(true)}
                    style={{ padding: 0, border: "none", background: "none", color: "inherit", fontSize: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 }}>
                    Pin it on the map
                  </button>
                </div>
              )}
              <div style={{ fontSize: fs(12.5), color: INK3 }}>Already suggested by someone? Yours adds to its count.</div>
            </>
          )}
        </div>

        <div className="flex flex-col" style={{ gap: 6 }}>
          <label htmlFor="gs-sp-why" style={label}>Why do you recommend it?</label>
          <select id="gs-sp-why" value={reason} onChange={(e) => { setReason(e.target.value); edited(); }} style={{ ...field, padding: "0 12px", color: reason ? INK : INK3 }}>
            <option value="" disabled>Pick a reason</option>
            {REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          {reason === "other" && (
            <>
              <label htmlFor="gs-sp-other" style={{ ...label, marginTop: 6 }}>Tell us why</label>
              <textarea id="gs-sp-other" rows={3} value={otherText} onChange={(e) => { setOtherText(e.target.value.slice(0, 140)); edited(); }} maxLength={140}
                placeholder="Best sunset in the valley, and the walk there is easy"
                style={{ ...field, minHeight: 0, padding: "12px 14px", resize: "none" }} />
              <div className="text-right" style={{ fontSize: fs(11.5), color: INK3 }}>{otherText.length}/140</div>
            </>
          )}
        </div>

        <div className="flex flex-col" style={{ gap: 6 }}>
          <div style={label}>Add a photo <span style={{ fontWeight: 400, color: INK3 }}>(optional)</span></div>
          {photo ? (
            <div className="relative overflow-hidden" style={{ borderRadius: 14, border: `1px solid ${LINE}` }}>
              <img src={photo} alt="Your photo of the place" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold"
                  style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,.94)", color: INK, fontSize: fs(12.5), border: "none" }}>Change</button>
                <button type="button" onClick={removePhoto} className="font-semibold"
                  style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,.94)", color: INK, fontSize: fs(12.5), border: "none" }}>Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy}
              className="flex items-center justify-center gap-2 font-semibold"
              style={{ height: 88, borderRadius: 14, border: "1.5px dashed rgba(15,20,25,.22)", background: SAND, color: INK2, fontSize: fs(14) }}>
              {photoBusy ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Camera size={20} strokeWidth={2} aria-hidden="true" />}
              {photoBusy ? "Reading the photo…" : "Choose a photo"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        </div>

        <div style={{ fontSize: fs(12.5), lineHeight: 1.45, color: INK3 }}>
          Real, public places only. No homes or private property. When {REVIEW_AT} people suggest it, we review it before it becomes a stamp.
        </div>

        {needBirthday && (
          <div className="rounded-[14px] p-3.5" style={{ background: "#FFFBF0", border: "1px solid #EAD9AE" }}>
            <label htmlFor="gs-sp-birthday" style={{ display: "block", fontSize: fs(13), color: INK, fontWeight: 600 }}>One thing first — your birthday</label>
            <p id="gs-sp-birthday-note" style={{ fontSize: fs(12), color: INK3, marginTop: 1 }}>Asked once, never shown.</p>
            <input id="gs-sp-birthday" ref={bdayRef} type="date" value={birthday} onChange={(e) => { setBirthday(e.target.value); edited(); }} autoComplete="bday" aria-describedby="gs-sp-birthday-note"
              min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
              className="mt-1.5 w-44 h-11 rounded-xl px-3 outline-none" style={{ border: `1px solid ${EDGE}`, background: "#FFFFFF", fontSize: fs(14) }} />
          </div>
        )}

        <div className="pt-1" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          <button type="button" onClick={submit} disabled={busy || blocked || prefillBusy || photoBusy}
            className="w-full flex items-center justify-center gap-2 font-semibold disabled:opacity-60"
            style={{ minHeight: 52, borderRadius: 14, border: "none", background: TEAL, color: "#FFFFFF", fontSize: fs(16) }}>
            {busy ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Sending…</>
              : photoBusy ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Reading the photo…</>
              : "Suggest this place"}
          </button>
          {sendError && (
            <p key={sendError.n} role="alert" style={{ margin: "8px 0 0", fontSize: fs(12.5), lineHeight: 1.4, color: "#B0472F" }}>{sendError.text}</p>
          )}
        </div>
      </div>
    </>
  );
}
