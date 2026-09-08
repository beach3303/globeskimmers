// HotelChoiceCard — one of the composer's two hotel choices (Passport Standard).
//
// Replaces the inline card in SmartPackages. The root is a div[role=button]
// (NOT a <button> — it contains the photo tap and the "Choose room" button);
// selection is the stamp-red ring only, never a second teal.
//
// Every rendered claim maps to a supplier field on `choice` / `selRate`, all
// read defensively: photos, description, amenities, rooms and the rate's
// room / breakfast / boardLabel are Wave-C additive fields — an old draft
// (or a cached one) carries none of them, and every row that has nothing to
// say hides itself.
//
// Props:
//   choice        — draft.hotelChoices[i] (legacy fields: id, hotelId, name,
//                   thumbnail, stars, reviewScore, reviewCount, distanceMiles,
//                   price, stayTotal, currency, nights, roomName, board,
//                   freeCancellation, cancelBy, maxOccupancy, rates[];
//                   Wave C: photos[{url,hd}], description, amenities[],
//                   rooms[], rates[].room / breakfast / boardLabel).
//   selected      — the stamp ring + STAMP kicker.
//   onSelect      — tap / Enter / Space on the card body.
//   onOpenPhotos  — (idx) → owner opens the lightbox over choice.photos.
//   onOpenRooms   — () → owner opens the room chooser sheet.
//   selRate       — the rate chosen in the room sheet, or null (cheapest).
//   currency      — draft-level currency fallback.
//   nights        — draft-level nights fallback.
//   roleLabel     — mono kicker text (owner maps role → label).
//   distanceFrom  — optional area name; "· X mi from <area>" when the draft
//                   was composed around a stay area.
import React from "react";
import { BedDouble } from "lucide-react";
import PhotoOrIcon from "@/components/finder/PhotoOrIcon";
import { TEAL_DEEP } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = "#16110D", SUB = "#736657", EDGE = "#E6DFD0", INK2 = "#6B7280";
const STAMP = "#B0472F", OK = "#2E7D46";
const fs = (n) => `calc(${n}px*var(--fs))`;

const money = (amt, cur) => {
  if (amt == null || !Number.isFinite(Number(amt))) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(Number(amt)); }
  catch { return `${Math.round(Number(amt))} ${cur || ""}`; }
};

// Canonical worker amenity ids → honest labels. Order of preference for the
// ≤6 pills: breakfast (rate-level) → A/C → pool → airport shuttle → the
// CHOSEN ROOM's fridge / microwave / kitchenette (the specific, rarer facts
// the founder asked for, placed before the common hotel-wide ones so the cap
// never hides them) → WiFi → gym → spa → restaurant → parking.
const HOTEL_LABEL = {
  ac: "Air conditioning", pool: "Pool", airport_shuttle: "Airport shuttle",
  free_wifi: "Free WiFi", wifi: "WiFi",   // 'wifi' alone never says free — the worker only emits free_wifi for "Free WiFi"
  gym: "Gym", spa: "Spa", restaurant: "Restaurant", parking: "Parking",
};
const HOTEL_FIRST = ["ac", "pool", "airport_shuttle"];
const HOTEL_REST = ["free_wifi", "wifi", "gym", "spa", "restaurant", "parking"];
const ROOM_LABEL = { fridge: "Fridge", microwave: "Microwave", kitchenette: "Kitchenette" };
const ROOM_ORDER = ["fridge", "microwave", "kitchenette"];
const MAX_TAGS = 6;

// The /data/hotel room the chosen rate maps to, when the worker linked one.
export function roomForRate(choice, rate) {
  const id = rate?.room?.id;
  if (id == null) return null;
  const rooms = Array.isArray(choice?.rooms) ? choice.rooms : [];
  return rooms.find((r) => r && r.id != null && String(r.id) === String(id)) || null;
}

// A bed label that only ever comes from the supplier: the worker's bedLabel
// on the rate's room link or the linked room; otherwise the raw room name.
export function bedLabelFor(choice, rate) {
  const room = roomForRate(choice, rate);
  return rate?.room?.bedLabel || room?.bedLabel || null;
}

export function amenityTags(choice, selRate) {
  const hotel = new Set((Array.isArray(choice?.amenities) ? choice.amenities : []).filter((a) => typeof a === "string"));
  const room = roomForRate(choice, selRate);
  const roomAm = new Set((Array.isArray(room?.amenities) ? room.amenities : []).filter((a) => typeof a === "string"));
  const out = [];
  // The worker's boardLabel is the specific meal plan ("Breakfast + dinner",
  // "All inclusive") and is null whenever breakfast is false — prefer it.
  if (selRate?.breakfast) out.push(selRate.boardLabel || "Breakfast included");
  for (const k of HOTEL_FIRST) if (hotel.has(k)) out.push(HOTEL_LABEL[k]);
  for (const k of ROOM_ORDER) if (roomAm.has(k)) out.push(ROOM_LABEL[k]);
  for (const k of HOTEL_REST) {
    if (k === "wifi" && hotel.has("free_wifi")) continue; // one WiFi pill, the stronger true one
    if (hotel.has(k)) out.push(HOTEL_LABEL[k]);
  }
  return out.slice(0, MAX_TAGS);
}

// The rate the card describes: the traveler's pick from the room sheet, else
// the choice's own base rate (matched by offerId), else the cheapest listed.
// Before any pick, the base rate's supplier facts (breakfast, bed, size) are
// still real facts about the default — they must not wait for the sheet.
export function effectiveRate(choice, selRate) {
  if (selRate) return selRate;
  const rates = Array.isArray(choice?.rates) ? choice.rates : [];
  return rates.find((r) => r && choice?.offerId != null && String(r.offerId) === String(choice.offerId)) || rates[0] || null;
}

export default function HotelChoiceCard({
  choice, selected, onSelect, onOpenPhotos, onOpenRooms, selRate, currency, nights, roleLabel, distanceFrom,
}) {
  const h = choice || {};
  const gallery = (Array.isArray(h.photos) ? h.photos : []).filter((p) => p && typeof p.url === "string" && p.url);
  const cover = gallery[0]?.url || h.thumbnail || null;
  const canOpenPhotos = !!(cover && typeof onOpenPhotos === "function");
  const rates = Array.isArray(h.rates) ? h.rates : [];
  const hasRoomChoice = rates.length > 1 || rates.some((r) => r?.room?.bedLabel);
  // Facts come from the effective rate: the pick, else the base rate.
  const eff = effectiveRate(h, selRate);
  const room = roomForRate(h, eff);

  const total = selRate?.price ?? h.stayTotal ?? h.price;
  const cur = selRate?.currency || h.currency || currency;
  const n = h.nights || nights;
  const freeCancel = selRate ? !!selRate.freeCancellation : !!h.freeCancellation;
  const cancelBy = selRate ? selRate.cancelBy : h.cancelBy;

  const bedLabel = bedLabelFor(h, eff);
  const supplierRoom = eff?.roomName || h.roomName || null;
  const roomTitle = bedLabel || supplierRoom || null;
  // The supplier's own room name stays visible under a bed label ("Superior
  // Queen Room" is a fact the traveler booked by; "1 Twin" alone is not).
  const roomSub = bedLabel && supplierRoom && supplierRoom !== bedLabel ? supplierRoom : null;
  const sleeps = room?.sleeps ?? eff?.maxOccupancy ?? (eff ? null : h.maxOccupancy) ?? null;
  const sizeSqm = eff?.room?.sizeSqm ?? room?.sizeSqm ?? null;
  const tags = amenityTags(h, eff);
  const boardLabel = eff?.boardLabel || null;
  const roomMeta = [
    Number.isFinite(Number(sleeps)) && Number(sleeps) > 0 ? `Sleeps ${Number(sleeps)}` : null,
    Number.isFinite(Number(sizeSqm)) && Number(sizeSqm) > 0 ? `${Math.round(Number(sizeSqm))} m²` : null,
    boardLabel && !tags.includes(boardLabel) ? boardLabel : null, // no duplicate of the benefits pill
  ].filter(Boolean).join(" · ");
  // 0 is the supplier's "unrated", never a score.
  const score = Number.isFinite(Number(h.reviewScore)) && Number(h.reviewScore) > 0 ? Number(h.reviewScore).toFixed(1) : null;
  const reviews = Number(h.reviewCount);
  const desc = typeof h.description === "string" ? h.description.trim() : "";

  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(); }
  };

  return (
    <div
      role="button" tabIndex={0} aria-pressed={!!selected}
      onClick={() => onSelect?.()}
      onKeyDown={onKeyDown}
      className="text-left rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "#FFFFFF", border: `1px solid ${EDGE}`, boxShadow: selected ? `0 0 0 2px ${STAMP}` : "none", cursor: "pointer" }}
    >
      {/* Cover — tap opens the gallery (PhotoOrIcon fires onOpenPhotos, the
          wrapper stops the bubble so the card never also toggles selection). */}
      <div className="relative" onClick={canOpenPhotos ? (e) => e.stopPropagation() : undefined}>
        <PhotoOrIcon photos={[cover, h.thumbnail]} alt={h.name || ""} fallbackIcon={BedDouble} tint={TEAL_DEEP}
          height={120} iconSize={32} onClick={canOpenPhotos ? () => onOpenPhotos(0) : undefined} />
        {gallery.length > 1 && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full uppercase tracking-[0.08em] pointer-events-none"
            style={{ fontFamily: MONO, fontSize: fs(9), color: "#FFFFFF", background: "rgba(22,17,13,0.72)" }}>
            {gallery.length} photos
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <div className="uppercase tracking-[0.14em] font-semibold" style={{ fontFamily: MONO, fontSize: fs(9), color: selected ? STAMP : SUB }}>
          {roleLabel || "OPTION"}
        </div>
        <div className="mt-1 leading-snug" style={{ fontFamily: SERIF, fontSize: fs(16), color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {h.name}
        </div>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap" style={{ fontFamily: MONO, fontSize: fs(10), color: SUB }}>
          {h.stars ? <span style={{ color: "#E0922F" }}>{"★".repeat(Math.min(Math.max(Math.round(Number(h.stars)), 1), 5))}</span> : null}
          {score != null && (
            <span>{score}{Number.isFinite(reviews) && reviews > 0 ? ` (${reviews.toLocaleString()} reviews)` : ""}</span>
          )}
          {h.distanceMiles != null && (
            <span>· {h.distanceMiles} mi{distanceFrom ? ` from ${distanceFrom}` : ""}</span>
          )}
        </div>

        {/* Benefits — supplier-backed only; hides itself when nothing is known. */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded-full" style={{ fontFamily: MONO, fontSize: fs(9.5), color: INK, border: `1px solid ${EDGE}`, lineHeight: 1.4 }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* The room — the chosen rate's bed / supplier name, plus what's known. */}
        {(roomTitle || hasRoomChoice) && (
          <div className="mt-2">
            {roomTitle && (
              <div className="leading-snug" style={{ fontFamily: SERIF, fontSize: fs(13), color: INK }}>{roomTitle}</div>
            )}
            {roomSub && (
              <div className="truncate mt-0.5" style={{ fontFamily: MONO, fontSize: fs(9.5), color: SUB }}>{roomSub}</div>
            )}
            {roomMeta && (
              <div className="mt-0.5" style={{ fontFamily: MONO, fontSize: fs(9.5), color: SUB }}>{roomMeta}</div>
            )}
            {hasRoomChoice && typeof onOpenRooms === "function" && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenRooms(); }}
                className="mt-1 underline font-semibold"
                style={{ fontFamily: MONO, fontSize: fs(9.5), color: SUB, textUnderlineOffset: 2, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
              >
                Choose room
              </button>
            )}
          </div>
        )}

        {desc && (
          <div className="mt-2 leading-snug" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(12), color: SUB, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {desc}
          </div>
        )}

        <div className="mt-auto pt-2">
          <div className="font-bold" style={{ fontSize: fs(14.5), color: INK, fontVariantNumeric: "tabular-nums" }}>
            {money(total, cur)} total{n ? ` · ${n} night${n === 1 ? "" : "s"}` : ""}
          </div>
          <div className="mt-0.5" style={{ fontSize: fs(10.5), color: freeCancel ? OK : INK2 }}>
            {freeCancel ? `Free cancellation${cancelBy ? ` until ${String(cancelBy).slice(0, 10)}` : ""}` : "Non-refundable"}
          </div>
        </div>
      </div>
    </div>
  );
}
