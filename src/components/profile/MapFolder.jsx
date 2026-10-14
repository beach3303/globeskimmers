// MapFolder: ON MY MAP (Profile.dc.html L166-183; bible.profile.sections 5). The kraft
// folder Home's nearby services use, because these are places: MY FAVORITE PLACES as
// white chips with a solid cloth line and a MapPin, ON THE HORIZON with a dashed line and
// a Plane (dashed: not visited yet). Both are free words, as many as the worker keeps
// (50 of 60 characters each).
//
//   <MapFolder favorites dreams editing onFavorites onDreams cloth readOnly ownerFirst
//              className style />
//   favorites, dreams   arrays of strings.
//   editing             the owner's edit mode: an add field under each list and an X on
//                       every chip. onFavorites / onDreams receive the next array.
//   readOnly            someone else's map: tab 'On {First}’s map', the horizon reads
//                       '{FIRST} DREAMS OF' (an invitation, bible.profile.visiting).
// Hidden when both lists are empty and the owner isn't editing.
import React, { useState } from "react";
import { MapPin, Plane, Plus, X } from "lucide-react";
import { Folder } from "@/components/redesign/Zone";
import { NEUTRAL, ZONE, fs } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";

const MAX_PLACES = 50;
const MAX_CHARS = 60;
const UMBER = ZONE.services.tab;

const LABEL = { margin: 0, fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: fs(9.5), lineHeight: 1.26, fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", overflowWrap: "anywhere", color: UMBER };

function Chip({ text, Icon, dashed, c, onRemove }) {
  return (
    <li style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, maxWidth: "100%", boxSizing: "border-box", padding: onRemove ? "0 2px 0 10px" : "0 12px 0 10px", borderRadius: 999, background: NEUTRAL.white, border: `1px ${dashed ? "dashed" : "solid"} ${c.cloth}`, fontSize: fs(13), lineHeight: 1.25, fontWeight: 500, color: NEUTRAL.ink2 }}>
      <Icon size={14} strokeWidth={2} color={c.cloth} aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0 }} />
      <span style={{ minWidth: 0, padding: "6px 0", overflowWrap: "anywhere" }}>{text}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${text}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: "-6px -4px -6px -6px", flexShrink: 0, padding: 0, background: "transparent", border: 0, color: c.cloth, cursor: "pointer" }}>
          <X size={14} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        </button>
      ) : null}
    </li>
  );
}

function AddField({ label, placeholder, c, onAdd, full }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (!v || full) return; onAdd(v); setDraft(""); };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))} placeholder={placeholder} aria-label={label}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        disabled={full}
        style={{ flex: 1, minWidth: 0, height: 44, boxSizing: "border-box", padding: "0 12px", borderRadius: 12, background: NEUTRAL.white, border: `1px solid ${c.fieldLine}`, fontSize: fs(14), color: NEUTRAL.ink, outline: "none" }} />
      <button type="button" onClick={add} disabled={!draft.trim() || full}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, padding: "0 14px", borderRadius: 12, background: NEUTRAL.white, border: `1.5px solid ${c.cloth}`, fontFamily: "inherit", fontSize: fs(13.5), fontWeight: 600, color: c.cloth, opacity: !draft.trim() || full ? 0.5 : 1, cursor: !draft.trim() || full ? "default" : "pointer" }}>
        <Plus size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" /> Add
      </button>
    </div>
  );
}

function Section({ label, items, Icon, dashed, c, editing, onChange, addLabel, placeholder, style = undefined }) {
  if (!items.length && !editing) return null;
  return (
    <div style={style}>
      <h3 style={LABEL}>{label}</h3>
      {items.length ? (
        <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 0", padding: 0, listStyle: "none" }}>
          {items.map((t, i) => (
            <Chip key={`${t}-${i}`} text={t} Icon={Icon} dashed={dashed} c={c}
              onRemove={editing ? () => onChange(items.filter((_, j) => j !== i)) : undefined} />
          ))}
        </ul>
      ) : null}
      {editing ? <AddField label={addLabel} placeholder={placeholder} c={c} full={items.length >= MAX_PLACES} onAdd={(v) => onChange([...items, v])} /> : null}
    </div>
  );
}

/**
 * @param {{
 *   favorites?: string[], dreams?: string[], editing?: boolean, onFavorites?: (next: string[]) => void,
 *   onDreams?: (next: string[]) => void, cloth?: any, readOnly?: boolean, ownerFirst?: string|null,
 *   className?: string, style?: import('react').CSSProperties,
 * }} props
 */
export default function MapFolder({
  favorites = [],
  dreams = [],
  editing = false,
  onFavorites = undefined,
  onDreams = undefined,
  cloth = undefined,
  readOnly = false,
  ownerFirst = null,
  className = undefined,
  style = undefined,
}) {
  const c = clothRow(cloth);
  const edit = editing && !readOnly;
  const favs = (Array.isArray(favorites) ? favorites : []).filter(Boolean);
  const horizon = (Array.isArray(dreams) ? dreams : []).filter(Boolean);
  if (!edit && !favs.length && !horizon.length) return null;
  const first = String(ownerFirst ?? "").trim();
  const tab = readOnly ? (first ? `On ${first}’s map` : "On their map") : "On my map";
  return (
    <Folder stock="services" size="profile" tab={tab} padding="16px" className={className} style={style}>
      <Section label={readOnly ? "Favorite places" : "My favorite places"} items={favs} Icon={MapPin} c={c}
        editing={edit} onChange={(next) => onFavorites?.(next)}
        addLabel="Add a favorite place" placeholder="Anywhere you love: a city, a beach, a diner…" />
      <Section label={readOnly ? (first ? `${first} dreams of` : "Dreams of") : "On the horizon"} items={horizon} Icon={Plane} dashed c={c}
        editing={edit} onChange={(next) => onDreams?.(next)}
        addLabel="Add a place on your horizon" placeholder="Santorini, Kyoto, the Northern Lights…"
        style={favs.length || edit ? { marginTop: 12 } : undefined} />
    </Folder>
  );
}
