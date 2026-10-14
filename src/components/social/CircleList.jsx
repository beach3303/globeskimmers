// CircleList: the people on one tab of the Circle screen, read like an address book
// (Circle.dc.html L137-345; bible.profile.circle_screen). A white sheet, A-Z dividers in
// mono, then a row per person: their face (44px, ringed in their cloth), the name in
// Instrument Serif with their OfficialSeal and 'BOTH WAYS' for your inner circle, '@handle'
// (and their country when the list sends one), and the action the relationship asks for:
//   'Following' (outline; asks before it unfollows), 'Follow back' (solid, only with a
//   handle: the worker follows by handle), 'Requested' (words).
// A ••• on every row holds Unfollow (or Cancel request) where you follow them, Report, and
// Block only where the worker can honour it (useCircle.canBlock). Within the tab the order
// is A-Z, never by popularity, and nobody's counts are shown.
//
// The line under a row is their latest stamp, only when it is real: the row's own `latest`
// (backend item B7) or their newest stamp in your feed (`latest` here, by handle). The house
// account reads 'The house account' instead. Nothing is invented for anyone else.
//
//   <CircleList rows circle latest cloth canVisit emptyLabel className style />
//   rows      the tab's people (op:list rows).
//   circle    useCircle(): relations and actions.
//   latest    Map of lower-case handle -> a feed stamp row ({ name, kind, visited_on,
//             created_at }).
//   canVisit  names open /Traveler?h= (useCircle().canVisit).
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Stamp } from "lucide-react";
import { createPageUrl } from "@/utils";
import { showToast } from "@/components/Toast";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";
import { Face, TwoRingMark } from "@/components/social/SocialMarks";
import OfficialSeal from "@/components/passport/OfficialSeal";
import InviteButton from "@/components/passport/InviteButton";
import { ReportSheet } from "@/components/social/Envelope";
import { workerMessage } from "@/components/social/FollowByHandle";
import { MoreMenu } from "@/components/social/TravelerActions";
import UnfollowConfirm from "@/components/social/UnfollowConfirm";

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const HAIR = "#E3E9EF";

const handleOf = (p) => String(p?.handle ?? "").trim().replace(/^@+/, "");
const nameOf = (p) => String(p?.name ?? "").trim() || (handleOf(p) ? `@${handleOf(p)}` : "A traveler");
const whoOf = (p) => (handleOf(p) ? `@${handleOf(p)}` : String(p?.name ?? "").trim() || "this traveler");
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sortKey = (p) => fold(String(p?.name ?? "").trim() || handleOf(p));
const letterOf = (p) => { const ch = sortKey(p).replace(/^[^a-z0-9]+/, "").charAt(0).toUpperCase(); return /[A-Z]/.test(ch) ? ch : "#"; };

// 'Oct 10' for a stamp's day ('YYYY-MM-DD' is a calendar date, anything else a timestamp).
function dayLabel(v) {
  const s = String(v ?? "");
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
}

function LatestLine({ row, feedRow }) {
  if (row?.verified && row?.seal === "teal") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: fs(12.5), lineHeight: 16 / 12.5, color: NEUTRAL.ink2 }}>
        <Globe size={12} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        <span>The house account</span>
      </div>
    );
  }
  const l = row?.latest && typeof row.latest === "object" ? row.latest : feedRow;
  const place = String(l?.name ?? "").trim();
  if (!place) return null;
  const day = dayLabel(l.date ?? l.visited_on ?? l.created_at);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, minWidth: 0, fontSize: fs(12.5), lineHeight: 16 / 12.5, color: NEUTRAL.ink2 }}>
      <Stamp size={12} strokeWidth={2} color={NEUTRAL.stamp} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
      <span className="sr-only">Latest stamp:</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place}</span>
      {day ? <span style={{ flexShrink: 0, color: NEUTRAL.ink3 }}>· {day}</span> : null}
    </div>
  );
}

/**
 * @param {{
 *   rows?: any[], circle: any, latest?: Map<string, any>|null, cloth?: any, canVisit?: boolean,
 *   emptyLabel?: string, emptyInvite?: boolean, className?: string, style?: CSS,
 * }} props
 */
export default function CircleList({ rows = [], circle, latest = null, cloth = undefined, canVisit = false, emptyLabel = "No one here yet", emptyInvite = true, className = undefined, style = undefined }) {
  const c = clothRow(cloth);
  const [confirm, setConfirm] = useState(/** @type {null|{ person: any, mode: 'unfollow'|'inner'|'cancel'|'block' }} */ (null));
  const [busy, setBusy] = useState(/** @type {string|null} */ (null));
  const [reporting, setReporting] = useState(/** @type {any} */ (null));

  const sorted = useMemo(() => [...(Array.isArray(rows) ? rows : [])].sort((a, b) => sortKey(a).localeCompare(sortKey(b))), [rows]);

  const followBack = async (p) => {
    const h = handleOf(p);
    if (!h || busy) return;
    setBusy(String(p.user_id ?? h));
    const res = await circle.follow({ handle: h, ...(p.user_id ? { user_id: p.user_id } : {}) });
    setBusy(null);
    if (!res.ok) { showToast(workerMessage(res.error, "Couldn’t follow them. Try again."), "error"); return; }
    showToast(res.data?.status === "pending" ? `Asked to follow @${h} — they approve first` : `Following @${h}`, "success");
  };

  const act = async () => {
    if (!confirm || busy) return;
    const { person, mode } = confirm;
    setBusy(String(person.user_id ?? handleOf(person)));
    const res = mode === "block" ? await circle.block({ user_id: person.user_id }) : await circle.unfollow({ user_id: person.user_id, handle: handleOf(person) });
    setBusy(null);
    if (!res.ok) { showToast(workerMessage(res.error, "That didn’t go through. Try again."), "error"); return; }
    setConfirm(null);
    showToast(mode === "block" ? `Blocked ${whoOf(person)}` : mode === "cancel" ? "Request cancelled" : `Unfollowed ${whoOf(person)}`, "success");
  };

  if (!sorted.length) {
    return (
      <div className={className} style={{ padding: "20px 16px", background: NEUTRAL.white, border: `1px solid ${c.line}`, borderRadius: 16, textAlign: "center", ...style }}>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>{emptyLabel}</p>
        {emptyInvite ? <InviteButton color={c.key} style={{ marginTop: 14 }} /> : null}
      </div>
    );
  }

  let prev = null;
  return (
    <div className={className} style={{ padding: "4px 0 12px", background: NEUTRAL.white, border: `1px solid ${c.line}`, borderRadius: 16, ...style }}>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {sorted.map((p) => {
          const letter = letterOf(p);
          const divider = letter !== prev;
          prev = letter;
          const h = handleOf(p);
          const rel = circle.relationOf(p);
          const inner = rel === "inner";
          const id = String(p.user_id ?? h);
          const who = whoOf(p);
          const place = String(p.country ?? "").trim();
          const feedRow = h && latest ? latest.get(h.toLowerCase()) : null;
          const items = [
            inner || rel === "following" ? { key: "unfollow", label: "Unfollow", onSelect: () => setConfirm({ person: p, mode: inner ? "inner" : "unfollow" }) } : null,
            rel === "requested" ? { key: "cancel", label: "Cancel request", onSelect: () => setConfirm({ person: p, mode: "cancel" }) } : null,
            h ? { key: "report", label: "Report", onSelect: () => setReporting({ payload: { kind: "handle", ref: h.toLowerCase(), note: `${nameOf(p)} (@${h})` }, subject: `${nameOf(p)}’s page` }) } : null,
            circle.canBlock && p.user_id ? { key: "block", label: "Block", danger: true, onSelect: () => setConfirm({ person: p, mode: "block" }) } : null,
          ].filter(Boolean);
          /** @type {CSS} */
          const pill = { display: "flex", alignItems: "center", minHeight: 30, padding: "0 10px", borderRadius: 999, fontSize: fs(12), fontWeight: 600, whiteSpace: "nowrap" };
          let action = null;
          if (inner || rel === "following") {
            action = (
              <button type="button" onClick={() => setConfirm({ person: p, mode: inner ? "inner" : "unfollow" })} aria-label={`Following ${nameOf(p)}. Unfollow?`}
                style={{ display: "flex", alignItems: "center", minHeight: 44, padding: 0, margin: "-7px 0", background: "transparent", border: 0, cursor: "pointer", flexShrink: 0 }}>
                <span style={{ ...pill, background: NEUTRAL.white, border: `1px solid ${c.cloth}`, color: c.cloth }}>Following</span>
              </button>
            );
          } else if (rel === "requested") {
            action = <span style={{ ...pill, flexShrink: 0, color: NEUTRAL.ink3, fontWeight: 500 }}>Requested</span>;
          } else if (rel === "follower" && h) {
            action = (
              <button type="button" onClick={() => followBack(p)} aria-busy={busy === id || undefined} aria-label={`Follow ${nameOf(p)} back`}
                style={{ display: "flex", alignItems: "center", minHeight: 44, padding: 0, margin: "-7px 0", background: "transparent", border: 0, cursor: busy === id ? "progress" : "pointer", flexShrink: 0 }}>
                <span style={{ ...pill, background: c.cloth, border: `1px solid ${c.cloth}`, color: NEUTRAL.white }}>{busy === id ? "One moment…" : "Follow back"}</span>
              </button>
            );
          }
          const name = canVisit && h ? (
            <Link to={`${createPageUrl("Traveler")}?h=${encodeURIComponent(h)}`}
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-12px 0", fontFamily: SERIF, fontSize: fs(18), lineHeight: 20 / 18, color: NEUTRAL.ink, textDecoration: "none", overflowWrap: "anywhere" }}>
              {nameOf(p)}
            </Link>
          ) : (
            <span style={{ fontFamily: SERIF, fontSize: fs(18), lineHeight: 20 / 18, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{nameOf(p)}</span>
          );
          return (
            <li key={id} style={{ padding: "4px 0" }}>
              {divider ? (
                <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 12, padding: "0 14px" }}>
                  <span style={{ fontFamily: MONO, fontSize: fs(10), lineHeight: 1.2, letterSpacing: ".2em", color: NEUTRAL.ink3 }}>{letter}</span>
                  <span style={{ flex: 1, height: 1, background: HAIR }} />
                </div>
              ) : null}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 8, padding: "0 6px 0 14px" }}>
                <Face name={p.name} handle={h} avatar={p.avatar} cloth={p.cloth} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2 }}>
                        {name}
                        {p.verified && p.seal ? <OfficialSeal size={14} tier={p.seal} style={undefined} /> : null}
                        {inner ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: MONO, fontSize: fs(9), lineHeight: 12 / 9, letterSpacing: ".06em", color: c.cloth, whiteSpace: "nowrap" }}>
                            <TwoRingMark color={c.cloth} strokeWidth={1.2} />BOTH WAYS
                          </span>
                        ) : null}
                      </div>
                      {h || place ? (
                        <div style={{ marginTop: 2, fontFamily: MONO, fontSize: fs(10.5), lineHeight: 14 / 10.5, color: NEUTRAL.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {h ? `@${h}` : ""}{h && place ? " · " : ""}{place ? place.toUpperCase() : ""}
                        </div>
                      ) : null}
                    </div>
                    {action}
                    <MoreMenu label={`More options for ${who}`} items={items} style={{ margin: "-7px 0" }} />
                  </div>
                  <LatestLine row={p} feedRow={feedRow} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <UnfollowConfirm person={confirm?.person || null} mode={confirm?.mode || "unfollow"} busy={!!busy} onConfirm={act} onClose={() => setConfirm(null)} />
      <ReportSheet payload={reporting?.payload} subject={reporting?.subject} onClose={() => setReporting(null)} />
    </div>
  );
}
