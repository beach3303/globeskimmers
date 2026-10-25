// Events: what's on where you're looking (founder, 2026-10-25: "what shows are happening … what games …
// festivals … chorales … orchestra … plays … shows where kids can go … free things … local seasonal
// holiday farmers market … as organized and harmonious as page D"; decision sheet: official page +
// "Tickets on Ticketmaster", the nine kinds). Opened from Home's Nearby page and from search.
//
// One page: the place (📍 · Change), a search box for a name (an artist, a team, a show, a choir), the
// time (Today · This weekend · This week · This month), the nine kinds as tiles, then one blue-tab
// section per kind with its next few and "See all". A kind opens on its own, by day, with its own
// sub-kinds (Music: Orchestra · Choirs · Concerts · Jazz · Opera). A row opens its sheet: the when and
// where, the price for planning, and its ways out — Tickets on Ticketmaster, Official page, Look it up
// (a festival), Open in Maps (a market) — each tap counted (event_ticket_click). Nothing is sold here.
//
// It says nothing untrue: a skeleton while it loads, Try again when it fails, and a plain line when a
// kind has nothing listed — never a made-up event. Router state from search: { when, kind, q }.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { Baby, CalendarHeart, Carrot, ChevronLeft, ChevronRight, Drama, ExternalLink, FerrisWheel, Gift, MapPin, Music, PartyPopper, Search, Ticket, Trophy, X } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { countryCode } from "@/lib/countries";
import { EV_KINDS, EV_WHEN, trackEventTap, whatsOn } from "@/lib/events";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { HOME_TAB } from "@/components/redesign/Zone";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import { trackEvent } from "@/Layout";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = NEUTRAL.airmailBlue;
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const ICON = { festivals: PartyPopper, fairs: FerrisWheel, kids: Baby, music: Music, stage: Drama, games: Trophy, free: Gift, markets: Carrot, holidays: CalendarHeart };
const SUBS = {
  music: ["Orchestra", "Choir", "Concert", "Jazz", "Opera"],
  stage: ["Play", "Musical", "Comedy", "Dance", "Show"],
};
const SUB_LABEL = { Choir: "Choirs", Concert: "Concerts", Play: "Plays", Musical: "Musicals", Show: "Shows" };
const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dayOf = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const longDay = (s) => dayOf(s).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
const clock = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};
const money = (n, cur) => {
  if (!Number.isFinite(n) || n <= 0) return null;
  try { return `From ${new Intl.NumberFormat([], { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(n)}`; } catch { return `From ${Math.round(n)}`; }
};

// Every row the page lists, in one shape, from the worker's sources. Markets show on the first day of
// the window they open; family places stay apart ("always open").
function rowsFrom(data) {
  if (!data) return [];
  const days = [];
  for (let d = dayOf(data.from); d <= dayOf(data.to); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(d);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const markets = (data.markets || []).flatMap((m) => {
    const open = days.find((d) => (m.open_days || []).includes(d.getDay()));
    if (!open) return [];
    const line = (m.hours || [])[(open.getDay() + 6) % 7] || null;   // Google's list starts on Monday
    return [{ id: `mkt:${m.id}`, kinds: ["markets", "free"], tags: ["Free"], name: m.name, date: iso(open), venue: m.address, hours: line ? line.replace(/^[^:]+:\s*/, "") : null, maps: m.maps, source: "google" }];
  });
  return [...(data.events || []), ...(data.festivals || []), ...(data.holidays || []), ...markets]
    .sort((a, z) => String(a.date).localeCompare(String(z.date)) || String(a.time || "99").localeCompare(String(z.time || "99")));
}

function Sheet({ item, onClose }) {
  useDismissable(true, onClose);
  if (!item) return null;
  const when = [longDay(item.date), item.end_date ? `to ${longDay(item.end_date)}` : null, clock(item.time)].filter(Boolean).join(" · ");
  const price = money(item.from_price, item.currency);
  const out = (link, href) => { trackEventTap(item, link); window.open(href, "_blank", "noopener"); };
  const btn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 48, borderRadius: 14, font: "inherit", fontSize: fs(15), fontWeight: 650, cursor: "pointer" };
  return (
    <div className="fixed inset-0 z-[10010] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={item.name} className="w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0" }}>
        <AirmailChevron height={4} />
        {item.image ? <img src={item.image} alt="" style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} /> : null}
        <div style={{ padding: "14px 16px calc(22px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <h2 style={{ flex: 1, margin: 0, fontFamily: SERIF, fontSize: fs(26), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>{item.name}</h2>
            <button type="button" onClick={onClose} aria-label="Close" style={{ flex: "none", width: 44, height: 44, margin: "-6px -8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "transparent", cursor: "pointer" }}>
              <X size={20} strokeWidth={2} color={NEUTRAL.ink2} aria-hidden="true" focusable="false" />
            </button>
          </div>
          {item.local_name ? <p style={{ margin: "2px 0 0", fontFamily: SERIF, fontStyle: "italic", fontSize: fs(16), color: NEUTRAL.ink2 }}>{item.local_name}</p> : null}
          <p style={{ margin: "8px 0 0", fontFamily: MONO, fontSize: fs(11.5), letterSpacing: ".06em", textTransform: "uppercase", color: NEUTRAL.stamp }}>{when}</p>
          {item.venue || item.city ? <p style={{ margin: "4px 0 0", fontSize: fs(14.5), color: NEUTRAL.ink }}>{[item.venue, item.city].filter(Boolean).join(" · ")}</p> : null}
          {item.hours ? <p style={{ margin: "2px 0 0", fontSize: fs(13.5), color: NEUTRAL.ink2 }}>Open {item.hours}</p> : null}
          {item.note ? <p style={{ margin: "8px 0 0", fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>{item.note}</p> : null}
          {(item.tags || []).length || price ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {(item.tags || []).map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: fs(10), fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, background: t === "Free" ? "#DDEDE3" : t === "All ages" ? "#F6EBCF" : NEUTRAL.airmailHair, color: t === "Free" ? NEUTRAL.open : t === "All ages" ? "#7A5A12" : BLUE }}>{t}</span>)}
              {price ? <span style={{ fontFamily: MONO, fontSize: fs(10), fontWeight: 700, letterSpacing: ".1em", padding: "3px 8px", borderRadius: 4, background: NEUTRAL.airmailHair, color: BLUE }}>{price.toUpperCase()}</span> : null}
            </div>
          ) : null}
          {price ? <p style={{ margin: "6px 0 0", fontSize: fs(12), color: NEUTRAL.ink3 }}>Prices are for planning. Tickets are bought on Ticketmaster, not in GlobeSkimmers.</p> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {item.tickets ? <button type="button" onClick={() => out("tickets", item.tickets)} style={{ ...btn, border: 0, background: NEUTRAL.stamp, color: NEUTRAL.white }}><Ticket size={18} strokeWidth={2} aria-hidden="true" focusable="false" /> Tickets on Ticketmaster</button> : null}
            {item.official ? <button type="button" onClick={() => out("official", item.official)} style={{ ...btn, border: `1px solid ${BLUE}`, background: NEUTRAL.white, color: BLUE }}><ExternalLink size={17} strokeWidth={2} aria-hidden="true" focusable="false" /> Official page</button> : null}
            {item.search ? <button type="button" onClick={() => out("search", item.search)} style={{ ...btn, border: `1px solid ${BLUE}`, background: NEUTRAL.white, color: BLUE }}><Search size={17} strokeWidth={2} aria-hidden="true" focusable="false" /> Look it up</button> : null}
            {item.maps ? <button type="button" onClick={() => out("maps", item.maps)} style={{ ...btn, border: `1px solid ${BLUE}`, background: NEUTRAL.white, color: BLUE }}><MapPin size={17} strokeWidth={2} aria-hidden="true" focusable="false" /> Open in Maps</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ item, onOpen, showDay = true }) {
  const d = dayOf(item.date);
  const price = money(item.from_price, item.currency);
  const where = [item.venue || item.city, clock(item.time) || item.hours].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={() => onOpen(item)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 58, padding: "8px 0", border: 0, borderBottom: `1px solid ${NEUTRAL.rule}`, background: "transparent", textAlign: "left", font: "inherit", cursor: "pointer" }}>
      {showDay ? (
        <span aria-hidden="true" style={{ flex: "none", width: 38, textAlign: "center" }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".12em", color: NEUTRAL.stamp }}>{WD[d.getDay()]}</span>
          <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(22), lineHeight: 1, color: NEUTRAL.ink }}>{String(d.getDate()).padStart(2, "0")}</span>
          <span style={{ display: "block", fontFamily: MONO, fontSize: fs(8), letterSpacing: ".12em", color: NEUTRAL.ink3 }}>{MON[d.getMonth()]}</span>
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: fs(14.5), fontWeight: 650, lineHeight: 1.25, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{item.name}</span>
        {where ? <span style={{ display: "block", marginTop: 2, fontSize: fs(12.5), color: NEUTRAL.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{where}</span> : null}
        {(item.tags || []).length || price ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {(item.tags || []).slice(0, 2).map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: fs(9), fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, background: t === "Free" ? "#DDEDE3" : t === "All ages" ? "#F6EBCF" : NEUTRAL.airmailHair, color: t === "Free" ? NEUTRAL.open : t === "All ages" ? "#7A5A12" : BLUE }}>{t}</span>)}
            {price ? <span style={{ fontFamily: MONO, fontSize: fs(9), fontWeight: 700, letterSpacing: ".1em", padding: "2px 6px", borderRadius: 3, background: NEUTRAL.airmailHair, color: BLUE }}>{price.toUpperCase()}</span> : null}
          </span>
        ) : null}
      </span>
      <ChevronRight size={18} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
    </button>
  );
}

function Section({ kind, items, onOpen, onAll }) {
  const label = EV_KINDS.find((k) => k.id === kind)?.label || kind;
  return (
    <section aria-label={label} style={{ marginTop: 18 }}>
      <div style={{ display: "flex" }}>
        <span style={{ marginLeft: 12, padding: "5px 12px 4px", borderRadius: "8px 8px 0 0", fontFamily: MONO, fontSize: fs(9.5), fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", ...HOME_TAB }}>{label} · {items.length}</span>
      </div>
      <div style={{ padding: "2px 12px 4px", background: NEUTRAL.cream, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 16 }}>
        {items.slice(0, 2).map((it) => <Row key={`${kind}-${it.id}`} item={it} onOpen={onOpen} />)}
        {items.length > 2 ? (
          <button type="button" onClick={onAll} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, width: "100%", minHeight: 40, border: 0, background: "transparent", font: "inherit", fontSize: fs(13), fontWeight: 650, color: BLUE, cursor: "pointer" }}>
            See all {items.length} <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" />
          </button>
        ) : <div style={{ height: 6 }} />}
      </div>
    </section>
  );
}

export default function EventsPage() {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const preset = routerLocation.state || {};
  const { activeLocation, getActiveLocation } = useLocation();
  const loc = activeLocation || getActiveLocation?.() || null;
  const lat = loc?.coordinates?.latitude;
  const lng = loc?.coordinates?.longitude;
  const city = loc?.address?.city || loc?.name || null;
  const country = loc?.address?.country || null;
  const cc = loc?.address?.countryCode ? String(loc.address.countryCode).toUpperCase() : countryCode(country);
  const [when, setWhen] = useState(EV_WHEN.some((w) => w.id === preset.when) ? preset.when : "weekend");
  const [kind, setKind] = useState(EV_KINDS.some((k) => k.id === preset.kind) ? preset.kind : null);
  const [sub, setSub] = useState(null);
  const [q, setQ] = useState(typeof preset.q === "string" ? preset.q : "");
  const [asked, setAsked] = useState(typeof preset.q === "string" ? preset.q.trim() : "");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [picker, setPicker] = useState(false);
  const live = useRef(0);
  const [tick, setTick] = useState(0);   // Try again

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const n = ++live.current;
    setData(null);
    whatsOn({ lat, lng, city, country, cc, when, q: asked }).then((r) => { if (n === live.current) setData(r); });
  }, [lat, lng, when, asked, tick]);   // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => rowsFrom(data), [data]);
  const byKind = useMemo(() => Object.fromEntries(EV_KINDS.map((k) => [k.id, rows.filter((r) => (r.kinds || []).includes(k.id))])), [rows]);
  const family = data?.family || [];
  const pickKind = (k) => { setKind(k); setSub(null); trackEvent("events_kind", { kind: k }); window.scrollTo(0, 0); };
  const back = () => {
    if (kind) { setKind(null); setSub(null); return; }
    if (window.history.length > 1) navigate(-1); else navigate(createPageUrl("Home"));
  };
  const search = (e) => { e.preventDefault(); setKind(null); setAsked(q.trim()); };

  const chip = (on) => ({ minHeight: 34, padding: "0 12px", borderRadius: 999, border: `1px solid ${on ? NEUTRAL.ink : NEUTRAL.airmailLine}`, background: on ? NEUTRAL.ink : NEUTRAL.white, color: on ? NEUTRAL.white : NEUTRAL.ink2, font: "inherit", fontSize: fs(13), fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" });
  const label = EV_KINDS.find((k) => k.id === kind)?.label;
  const subs = kind && SUBS[kind] ? SUBS[kind].filter((s) => byKind[kind].some((r) => (r.tags || []).includes(s))) : [];
  const list = kind ? byKind[kind].filter((r) => !sub || (r.tags || []).includes(sub)) : [];

  let body;
  if (!Number.isFinite(lat)) {
    body = <p style={{ margin: "16px 0 0", fontSize: fs(14), color: NEUTRAL.ink2 }}>Pick a place first, and we’ll show what’s on there.</p>;
  } else if (!data) {
    body = (
      <div style={{ marginTop: 16 }}>
        <span className="sr-only" role="status">Finding what’s on</span>
        {[0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="animate-pulse motion-reduce:animate-none" style={{ height: 110, marginTop: i ? 12 : 0, borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}` }} />)}
      </div>
    );
  } else if (data.error && !rows.length) {
    body = (
      <div style={{ marginTop: 16, padding: 16, borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}` }}>
        <p style={{ margin: 0, fontSize: fs(14), color: NEUTRAL.ink2 }}>Couldn’t load what’s on.</p>
        <button type="button" onClick={() => setTick((t) => t + 1)} style={{ ...chip(false), marginTop: 10 }}>Try again</button>
      </div>
    );
  } else if (asked) {
    body = rows.length ? (
      <div style={{ marginTop: 12, padding: "2px 12px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}`, borderRadius: 16 }}>
        {rows.map((r) => <Row key={r.id} item={r} onOpen={setOpen} />)}
      </div>
    ) : <p style={{ margin: "14px 0 0", fontSize: fs(14), lineHeight: 1.5, color: NEUTRAL.ink2 }}>Nothing called “{asked}” in our listings near {city || "here"} this month. Small local shows aren’t always listed yet.</p>;
  } else if (kind) {
    let lastDay = null;
    body = (
      <>
        {subs.length > 1 ? (
          <div role="group" aria-label={`Kinds of ${label}`} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            <button type="button" onClick={() => setSub(null)} aria-pressed={!sub} style={chip(!sub)}>All</button>
            {subs.map((s) => <button key={s} type="button" onClick={() => setSub(s)} aria-pressed={sub === s} style={chip(sub === s)}>{SUB_LABEL[s] || s}</button>)}
          </div>
        ) : null}
        {list.length ? (
          <div style={{ marginTop: 10 }}>
            {list.map((r) => {
              const head = r.date !== lastDay ? longDay(r.date).toUpperCase() : null;
              lastDay = r.date;
              return (
                <React.Fragment key={r.id}>
                  {head ? <div style={{ marginTop: 14, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".18em", color: BLUE }}>{head}</div> : null}
                  <div style={{ padding: "0 12px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}`, borderRadius: 14, marginTop: 6 }}><Row item={r} onOpen={setOpen} showDay={false} /></div>
                </React.Fragment>
              );
            })}
          </div>
        ) : <p style={{ margin: "14px 0 0", fontSize: fs(14), lineHeight: 1.5, color: NEUTRAL.ink2 }}>Nothing listed for {EV_WHEN.find((w) => w.id === when)?.label.toLowerCase()} near {city || "here"}. Try a longer time above.</p>}
        {kind === "kids" && family.length ? (
          <section aria-label="Always open" style={{ marginTop: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".18em", color: NEUTRAL.open }}>ALWAYS OPEN FOR FAMILIES</div>
            <div style={{ marginTop: 6, padding: "0 12px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.rule}`, borderRadius: 14 }}>
              {family.map((p) => (
                <button key={p.id} type="button" onClick={() => { if (p.maps) { trackEventTap({ id: `fam:${p.id}`, name: p.name, kinds: ["kids"], source: "google", city }, "maps"); window.open(p.maps, "_blank", "noopener"); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, border: 0, borderBottom: `1px solid ${NEUTRAL.rule}`, background: "transparent", textAlign: "left", font: "inherit", cursor: "pointer" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: fs(14.5), fontWeight: 650, color: NEUTRAL.ink }}>{p.name}</span>
                    <span style={{ display: "block", fontSize: fs(12.5), color: NEUTRAL.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.address}</span>
                  </span>
                  <MapPin size={16} strokeWidth={2} color={BLUE} aria-hidden="true" focusable="false" />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </>
    );
  } else {
    const any = EV_KINDS.some((k) => byKind[k.id].length);
    body = (
      <>
        <div role="group" aria-label="Kinds" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
          {EV_KINDS.map((k) => {
            const Icon = ICON[k.id];
            const n = byKind[k.id].length;
            return (
              <button key={k.id} type="button" onClick={() => pickKind(k.id)} aria-label={`${k.label}, ${n}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 72, padding: "8px 4px", borderRadius: 14, border: `1px solid ${NEUTRAL.rule}`, background: NEUTRAL.white, font: "inherit", cursor: "pointer", opacity: n ? 1 : 0.55 }}>
                <Icon size={22} strokeWidth={1.8} color={BLUE} aria-hidden="true" focusable="false" />
                <span style={{ fontSize: fs(12.5), fontWeight: 650, color: NEUTRAL.ink, textAlign: "center", lineHeight: 1.15 }}>{k.label}</span>
                <span style={{ fontFamily: MONO, fontSize: fs(9.5), color: NEUTRAL.ink3 }}>{n}</span>
              </button>
            );
          })}
        </div>
        {any ? EV_KINDS.filter((k) => byKind[k.id].length).map((k) => (
          <Section key={k.id} kind={k.id} items={byKind[k.id]} onOpen={setOpen} onAll={() => pickKind(k.id)} />
        )) : <p style={{ margin: "16px 0 0", fontSize: fs(14), lineHeight: 1.5, color: NEUTRAL.ink2 }}>Nothing listed for {EV_WHEN.find((w) => w.id === when)?.label.toLowerCase()} near {city || "here"} yet. Try This month.</p>}
      </>
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div aria-hidden="true" style={{ height: 8 }} />
      <header className={COLUMN} style={{ paddingTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" onClick={back} aria-label={kind ? "All kinds" : "Back"}
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "0 0 0 -12px", border: 0, background: "transparent", color: BLUE, cursor: "pointer" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>{kind ? `Events · ${label}` : "Nearby · Events & festivals"}</div>
        </div>
        <h1 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(30), fontWeight: 400, lineHeight: 1.05, color: NEUTRAL.ink }}>
          {kind ? <>{label} in <em style={{ fontStyle: "italic", color: BLUE }}>{city || "your area"}</em></> : <>What’s on in <em style={{ fontStyle: "italic", color: BLUE }}>{city || "your area"}</em></>}
        </h1>
        <button type="button" onClick={() => setPicker(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, marginTop: 8, padding: "0 12px", borderRadius: 999, border: `1px solid ${NEUTRAL.rule}`, background: NEUTRAL.white, font: "inherit", fontSize: fs(13), color: NEUTRAL.ink2, cursor: "pointer" }}>
          <MapPin size={14} strokeWidth={2} color={NEUTRAL.brandTeal} aria-hidden="true" focusable="false" />
          <b style={{ fontWeight: 650, color: NEUTRAL.ink }}>{city || "Pick a place"}</b>
          <span style={{ color: NEUTRAL.brandTeal, fontWeight: 650, textDecoration: "underline", textUnderlineOffset: 2 }}>Change</span>
        </button>
        <form onSubmit={search} role="search" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "0 12px", minHeight: 46, borderRadius: 999, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white }}>
          <Search size={17} strokeWidth={2} color={NEUTRAL.brandTeal} aria-hidden="true" focusable="false" />
          <label htmlFor="ev-q" className="sr-only">Search events by name</label>
          <input id="ev-q" value={q} onChange={(e) => { setQ(e.target.value.slice(0, 80)); if (!e.target.value.trim()) setAsked(""); }} placeholder="A show, a team, a choir…" enterKeyHint="search"
            style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", font: "inherit", fontSize: fs(15), color: NEUTRAL.ink }} />
          {q ? <button type="button" onClick={() => { setQ(""); setAsked(""); }} aria-label="Clear" style={{ border: 0, background: "transparent", padding: 4, cursor: "pointer" }}><X size={16} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" /></button> : null}
        </form>
        {!asked ? (
          <div role="group" aria-label="When" style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", scrollbarWidth: "none" }}>
            {EV_WHEN.map((w) => <button key={w.id} type="button" onClick={() => setWhen(w.id)} aria-pressed={when === w.id} style={chip(when === w.id)}>{w.label}</button>)}
          </div>
        ) : null}
      </header>
      <div style={{ marginTop: 14 }}><AirmailChevron height={5} /></div>
      <div className={COLUMN}>
        {body}
        {data && !data.error ? (
          <p style={{ margin: "22px 0 0", fontSize: fs(12), lineHeight: 1.5, color: NEUTRAL.ink3 }}>
            Concerts, games and shows from Ticketmaster. Holidays from a public-holiday calendar, festivals from a calendar we keep, markets from Google. Nothing is sold in the app.
          </p>
        ) : null}
      </div>
      {open ? <Sheet item={open} onClose={() => setOpen(null)} /> : null}
      <LocationModePicker isOpen={picker} onClose={() => setPicker(false)} lastLocation={getActiveLocation?.() || null} onSnoozeToday={() => {}} />
    </div>
  );
}
