// RoomChooserSheet — pick the bed / room plan for a composer hotel choice.
//
// FilterSheet-hosted bottom sheet (z 9995/9996), titled with the hotel name.
// Rates arrive cheapest-first from the worker (≤6 — two-choice spirit, so at
// most 6 are ever shown) and are GROUPED by room: one card per room with the
// supplier photo, bed label, supplier room name and what's known about it;
// the room's plans (board · whole-stay price · delta vs the cheapest ·
// refundability) are the tap targets. Tapping a plan selects it (stamp-red
// ring) and closes the sheet.
//
// Every line maps to a supplier field; a room the worker could not link to
// /data/hotel simply shows the raw rate (name, sleeps from maxOccupancy) and a
// serif-initial tile instead of a photo. Nothing is guessed.
//
// Props:
//   open          — sheet visibility.
//   choice        — the draft hotel choice (rates[], rooms[], description,
//                   checkinTime / checkoutTime, name, currency).
//   selRate       — the currently chosen rate (matched by offerId) or null.
//   onPick        — (rate) → owner stores the choice; the sheet then closes.
//   onClose       — close handler.
//   onOpenPhotos  — (photos:[{src,hd}], index, title) → owner opens the
//                   lightbox over that room's photos. Optional.
//   currency      — draft-level currency fallback.
//   nights        — draft-level nights (the "total for your stay" line).
import React, { useState } from "react";
import FilterSheet from "@/components/finder/FilterSheet";
import { roomForRate } from "@/components/hotels/HotelChoiceCard";
import { IVORY_2 } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = "#16110D", SUB = "#736657", EDGE = "#E6DFD0", INK2 = "#6B7280";
const STAMP = "#B0472F", OK = "#2E7D46", ACCENT_BG = "#E4F1EF", ACCENT = "#0E7C73";
const fs = (n) => `calc(${n}px*var(--fs))`;
const MAX_RATES = 6;
// Worker room-amenity ids → labels; the founder's fridge / microwave /
// kitchenette first, then the rest. Only what the supplier lists.
const ROOM_AMENITY_LABEL = {
  fridge: "Fridge", microwave: "Microwave", kitchenette: "Kitchenette", ac: "Air conditioning",
  balcony: "Balcony", bath: "Bathtub", shower: "Shower", washer: "Washer", coffee: "Coffee/tea maker",
  minibar: "Minibar", safe: "Safe", tv: "TV",
};
const ROOM_AMENITY_ORDER = ["fridge", "microwave", "kitchenette", "ac", "balcony", "bath", "shower", "washer", "coffee", "minibar", "safe", "tv"];
const roomAmenityLine = (room) => {
  const have = new Set((Array.isArray(room?.amenities) ? room.amenities : []).filter((a) => typeof a === "string"));
  return ROOM_AMENITY_ORDER.filter((k) => have.has(k)).map((k) => ROOM_AMENITY_LABEL[k]).slice(0, 6).join(" · ");
};

const money = (amt, cur) => {
  if (amt == null || !Number.isFinite(Number(amt))) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(Number(amt)); }
  catch { return `${Math.round(Number(amt))} ${cur || ""}`; }
};

// 64px supplier room photo; serif-initial tile when there is none or it fails.
function RoomThumb({ url, name, onOpen }) {
  const [broken, setBroken] = useState(false);
  const initial = (String(name || "").trim().charAt(0) || "?").toUpperCase();
  const tappable = typeof onOpen === "function";
  const tile = (
    <div className="flex items-center justify-center w-full h-full" aria-hidden="true"
      style={{ background: `linear-gradient(135deg, ${ACCENT_BG}, ${IVORY_2})` }}>
      <span style={{ fontFamily: SERIF, fontSize: fs(24), color: ACCENT, lineHeight: 1 }}>{initial}</span>
    </div>
  );
  const body = (!url || broken)
    ? tile
    : <img src={url} alt={name || ""} loading="lazy" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  if (!tappable) {
    return <div className="flex-none rounded-[12px] overflow-hidden" style={{ width: 64, height: 64, border: `1px solid ${EDGE}` }}>{body}</div>;
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label={`Photos of ${name || "this room"}`}
      className="flex-none rounded-[12px] overflow-hidden" style={{ width: 64, height: 64, border: `1px solid ${EDGE}`, padding: 0, background: "transparent", cursor: "pointer" }}>
      {body}
    </button>
  );
}

export default function RoomChooserSheet({ open, choice, selRate, onPick, onClose, onOpenPhotos, currency, nights }) {
  // FilterSheet owns the dismiss-stack registration (useDismissable) and the
  // backdrop / X / global swipe-down; nothing to register here.
  const h = choice || {};
  const rates = (Array.isArray(h.rates) ? h.rates : [])
    .filter((r) => r && r.offerId != null && r.price != null)
    .slice(0, MAX_RATES);
  const cur = h.currency || currency;
  const cheapest = rates.reduce((m, r) => (m == null || Number(r.price) < m ? Number(r.price) : m), null);
  const n = h.nights || nights;

  // Group by the worker's room link, else the supplier room name.
  const groups = [];
  const byKey = new Map();
  rates.forEach((r, i) => {
    const room = roomForRate(h, r);
    const key = r.room?.id != null ? `room:${r.room.id}` : (r.roomName ? `name:${r.roomName}` : `rate:${i}`);
    if (!byKey.has(key)) {
      const g = { key, room, link: r.room || null, roomName: r.roomName || room?.name || null, rates: [] };
      byKey.set(key, g); groups.push(g);
    }
    byKey.get(key).rates.push(r);
  });

  const checkin = typeof h.checkinTime === "string" ? h.checkinTime.trim() : "";
  const checkout = typeof h.checkoutTime === "string" ? h.checkoutTime.trim() : "";
  const desc = typeof h.description === "string" ? h.description.trim() : "";
  const selId = selRate?.offerId ?? null;

  const photosOf = (g) => {
    const list = (Array.isArray(g.room?.photos) ? g.room.photos : [])
      .filter((p) => p && typeof p.url === "string" && p.url)
      .map((p) => ({ src: p.url, hd: p.hd || undefined }));
    if (!list.length && g.link?.photo) list.push({ src: g.link.photo });
    return list;
  };

  return (
    <FilterSheet open={!!open && !!choice} onClose={onClose} title={h.name || "Choose a room"}>
      {(checkin || checkout) && (
        <div className="uppercase tracking-[0.12em]" style={{ fontFamily: MONO, fontSize: fs(9.5), color: SUB }}>
          {[checkin ? `Check-in ${checkin}` : null, checkout ? `Check-out ${checkout}` : null].filter(Boolean).join(" · ")}
        </div>
      )}
      {desc && (
        <div className="mt-1.5 leading-snug" style={{ fontFamily: SERIF, fontSize: fs(13), color: INK, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {desc}
        </div>
      )}

      {rates.length === 0 ? (
        <div className="mt-3" style={{ fontSize: fs(12.5), color: INK2 }}>No room plans came back for this stay.</div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {groups.map((g) => {
            const bedLabel = g.link?.bedLabel || g.room?.bedLabel || null;
            const isSuite = !!(g.link?.isSuite || g.room?.isSuite);
            const title = bedLabel || g.roomName || "Room";
            const sleeps = g.room?.sleeps ?? (g.rates.reduce((m, r) => Math.max(m, Number(r.maxOccupancy) || 0), 0) || null);
            const sqm = Number(g.link?.sizeSqm ?? g.room?.sizeSqm);
            const sizeTxt = Number.isFinite(sqm) && sqm > 0 ? `${Math.round(sqm)} m² (${Math.round(sqm * 10.7639)} ft²)` : null;
            const meta = [sleeps ? `Sleeps ${sleeps}` : null, sizeTxt].filter(Boolean).join(" · ");
            const thumb = g.link?.photo || g.room?.photos?.[0]?.url || null;
            const photos = photosOf(g);
            const openPhotos = photos.length && typeof onOpenPhotos === "function"
              ? () => onOpenPhotos(photos, 0, [h.name, title].filter(Boolean).join(" — "))
              : undefined;
            return (
              <div key={g.key} className="rounded-2xl px-3 py-3" style={{ background: "#FFFFFF", border: `1px solid ${EDGE}` }}>
                <div className="flex items-start gap-3">
                  <RoomThumb url={thumb} name={title} onOpen={openPhotos} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="leading-snug" style={{ fontFamily: SERIF, fontSize: fs(16), color: INK }}>{title}</span>
                      {isSuite && (
                        <span className="px-1.5 py-0.5 rounded-full uppercase tracking-[0.08em]" style={{ fontFamily: MONO, fontSize: fs(9), color: SUB, border: `1px solid ${EDGE}` }}>
                          Suite
                        </span>
                      )}
                    </div>
                    {bedLabel && g.roomName && g.roomName !== bedLabel && (
                      <div className="truncate mt-0.5" style={{ fontFamily: MONO, fontSize: fs(10), color: SUB }}>{g.roomName}</div>
                    )}
                    {meta && (
                      <div className="mt-0.5" style={{ fontFamily: MONO, fontSize: fs(10), color: SUB }}>{meta}</div>
                    )}
                    {roomAmenityLine(g.room) && (
                      <div className="mt-0.5 leading-snug" style={{ fontFamily: MONO, fontSize: fs(9.5), color: INK }}>{roomAmenityLine(g.room)}</div>
                    )}
                    {photos.length > 1 && openPhotos && (
                      <button type="button" onClick={openPhotos} className="mt-1 underline"
                        style={{ fontFamily: MONO, fontSize: fs(9.5), color: SUB, textUnderlineOffset: 2, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                        {photos.length} photos
                      </button>
                    )}
                  </div>
                </div>

                {/* Plans — the tap targets. */}
                <div className="mt-2 flex flex-col gap-1.5">
                  {g.rates.map((r) => {
                    const selected = selId != null && String(r.offerId) === String(selId);
                    const delta = cheapest != null ? Number(r.price) - cheapest : 0;
                    const board = r.boardLabel || r.board || null;
                    return (
                      <button
                        key={String(r.offerId)} type="button"
                        aria-pressed={selected}
                        onClick={() => { onPick?.(r); onClose?.(); }}
                        className="w-full text-left rounded-[14px] px-3 py-2.5 flex items-center gap-3"
                        style={{ background: IVORY_2, border: `1px solid ${EDGE}`, boxShadow: selected ? `0 0 0 2px ${STAMP}` : "none", cursor: "pointer" }}
                      >
                        <div className="flex-1 min-w-0">
                          {board && (
                            <div className="truncate" style={{ fontSize: fs(12.5), color: INK }}>{board}</div>
                          )}
                          <div className="mt-0.5" style={{ fontSize: fs(10.5), color: r.freeCancellation ? OK : INK2 }}>
                            {r.freeCancellation ? `Free cancellation${r.cancelBy ? ` until ${String(r.cancelBy).slice(0, 10)}` : ""}` : "Non-refundable"}
                          </div>
                        </div>
                        <div className="flex-none text-right">
                          <div className="font-bold" style={{ fontSize: fs(13.5), color: INK, fontVariantNumeric: "tabular-nums" }}>
                            {money(r.price, r.currency || cur)}
                          </div>
                          {delta > 0 ? (
                            <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: SUB, fontVariantNumeric: "tabular-nums" }}>+{money(delta, r.currency || cur)}</div>
                          ) : (
                            <div className="uppercase tracking-[0.08em]" style={{ fontFamily: MONO, fontSize: fs(9), color: SUB }}>
                              {n ? `${n} night${n === 1 ? "" : "s"}` : "total"}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 leading-relaxed" style={{ fontFamily: MONO, fontSize: fs(9.5), color: "#9AA0A6" }}>
        Room names and photos come from the hotel&apos;s supplier · every price is the total for your stay
      </div>
    </FilterSheet>
  );
}
