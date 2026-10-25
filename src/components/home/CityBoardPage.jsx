// CityBoardPage — Home's City Board page (founder, 2026-10-25: "i love separation between current
// city versus the rest of the world"; "boards should just be about photos"; "sad that we lost our city
// board billboard design"). Your city first: its billboard (CityBoardRow's Billboard, lamps and all)
// and its newest photos, each opening the board. Then a navy band under an airmail edge, THE REST OF THE
// WORLD: the boards elsewhere with something new first, by their cover photos, and All City Boards.
//
// Counts stay quiet (founder, 2026-10-16: a small number reads as empty) — a board says "New this
// week" when it has something recent, nothing more. Nothing shows until the age tier is known; a
// held reader sees no boards (the worker's teen_hold), as on Home before.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cityBoard, cityBoards } from "@/lib/passport";
import { boardUrl, cityBoardUrl, cityBoardsUrl } from "@/lib/boardLinks";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { Billboard } from "@/components/home/CityBoardRow";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = NEUTRAL.airmailBlue;
const SHOW = 6;
const sameText = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

function Photo({ src, to, caption, alt }) {
  return (
    <Link to={to} aria-label={alt}
      style={{ position: "relative", display: "block", aspectRatio: "4 / 3.4", borderRadius: 12, overflow: "hidden", background: NEUTRAL.airmailHair, textDecoration: "none" }}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      {caption ? (
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 8px 6px", background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.6))", color: "#FFF", fontSize: fs(11.5), fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{caption}</span>
      ) : null}
    </Link>
  );
}

export default function CityBoardPage({ city = "", country = "", region = "" }) {
  const { socialTier, socialTierReady } = useAuth();
  const c = String(city || "").trim();
  const k = String(country || "").trim();
  const r = String(region || "").trim();
  const social = socialTierReady && String(socialTier || "") !== "blocked";
  const open = social && !!c && !!k;
  const [board, setBoard] = useState(null);
  const [all, setAll] = useState(null);

  useEffect(() => {
    if (!open) { setBoard(null); return undefined; }
    let gone = false;
    cityBoard({ city: c, country: k, region: r || null }).then((res) => { if (!gone) setBoard(res); });
    return () => { gone = true; };
  }, [open, c, k, r]);
  useEffect(() => {
    if (!social) { setAll(null); return undefined; }
    let gone = false;
    cityBoards().then((res) => { if (!gone) setAll(res); });
    return () => { gone = true; };
  }, [social]);

  const here = open && board && !board.held && !board.unavailable && !board.error ? board : null;
  const photos = here ? here.rows.filter((x) => x && x.photo).slice(0, SHOW) : [];
  const toHere = cityBoardUrl(c, k, r);
  const boards = all && !all.held && !all.unavailable && !all.error ? all.boards : [];
  const elsewhere = boards
    .filter((b) => !(sameText(b.city, c) && sameText(b.country, k)))
    .sort((a, z) => (z.recent > 0) - (a.recent > 0) || String(z.last_at || "").localeCompare(String(a.last_at || "")))
    .slice(0, SHOW);

  return (
    <div style={{ paddingTop: 12 }}>
      <div className="px-4">
        <div className="mx-auto max-w-md md:max-w-[720px]">
          {here ? (
            <Billboard to={toHere} title={c} accent="City Board" line="Photos from travelers who were really there" cta="See the board" label={`${c} City Board`} />
          ) : (
            <Billboard to={cityBoardsUrl()} title="City Boards" line="Photo posts from travelers who were really there" cta="Explore" label="City Boards" />
          )}
          {here ? (
            <section aria-label={`Photos from ${c}`} style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
                  Photos from <em style={{ fontStyle: "italic", color: BLUE }}>{c}</em>
                </h2>
                <Link to={toHere} style={{ flex: "none", display: "inline-flex", alignItems: "center", fontSize: fs(13), fontWeight: 650, color: BLUE, textDecoration: "none" }}>
                  See the board <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                </Link>
              </div>
              {photos.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
                  {photos.map((p, i) => {
                    const who = p.anon ? (p.anon === "local" ? "@local" : "@traveler") : p.by?.handle ? `@${p.by.handle}` : null;
                    const where = p.place || p.caption || null;
                    return <Photo key={p.id || i} src={p.photo} to={toHere} caption={[where, who].filter(Boolean).join(" · ")} alt={`Photo${where ? ` of ${where}` : ""}${who ? ` by ${who}` : ""}. Open ${c}’s board`} />;
                  })}
                </div>
              ) : (
                <p style={{ margin: "8px 0 0", fontSize: fs(13.5), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
                  {here.can_post ? "You were here. Post the first photo on its board." : `No photos from ${c} yet. Be there, stamp it, and post the first one.`}
                </p>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {elsewhere.length ? (
        <section aria-label="Boards around the world" style={{ position: "relative", marginTop: 24, background: NEUTRAL.navy, color: "#FBF6EC", padding: "16px 16px 18px" }}>
          <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: -5, height: 5, background: `repeating-linear-gradient(135deg, ${NEUTRAL.stamp} 0 9px, #FBF6EC 9px 14px, ${BLUE} 14px 23px, #FBF6EC 23px 28px)` }} />
          <div className="mx-auto max-w-md md:max-w-[720px]">
            <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".22em", color: NEUTRAL.gold }}>THE REST OF THE WORLD</div>
            <h2 style={{ margin: "3px 0 0", fontFamily: SERIF, fontSize: fs(23), fontWeight: 400, lineHeight: 1.1 }}>Boards around the <em style={{ fontStyle: "italic", color: NEUTRAL.gold }}>globe</em></h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
              {elsewhere.map((b) => {
                const name = b.city || b.name;
                return (
                  <Link key={b.key || `${name}-${b.country}`} to={boardUrl(b)} aria-label={`${name}, ${b.country}${b.recent > 0 ? ", new this week" : ""}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <span style={{ display: "block", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden", background: "linear-gradient(160deg, #FF9A5A, #FF6F7D 45%, #7A4BD0)" }}>
                      {b.cover ? <img src={b.cover} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                    </span>
                    <span style={{ display: "block", marginTop: 5, fontSize: fs(14), fontWeight: 650, lineHeight: 1.2, color: "#FBF6EC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    <span style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".08em", color: b.recent > 0 ? NEUTRAL.gold : "#AFC0D8" }}>{b.recent > 0 ? "NEW THIS WEEK" : String(b.region || b.country || "").toUpperCase()}</span>
                  </Link>
                );
              })}
            </div>
            <Link to={cityBoardsUrl()} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, marginTop: 12, fontSize: fs(13.5), fontWeight: 650, color: NEUTRAL.gold, textDecoration: "none" }}>
              All City Boards <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
