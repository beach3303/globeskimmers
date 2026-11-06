// StayPicker — "Where I'm staying" (cards-and-passport, 2026-11-06): the lodging places around the
// phone's own reading, nearest first, each with the card's Stamp button under the Stay category.
// Private by default: the card reads "Accommodation · <city>" to everyone else unless the owner shows
// the hotel's name (Settings, or stamp by stamp on the card). Nothing is stamped until you tap.
//
//   <StayPicker onClose />
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BedDouble, X } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { getStampFix } from "@/lib/geolocation";
import { useDismissable } from "@/lib/dismissStack";
import { fs } from "@/components/redesign/constants";
import { PRIVACY_LINE } from "@/lib/crossings";
import { showHotelNamesByDefault } from "@/lib/cityCards";
import CityCardStampButton from "@/components/citycards/CityCardStampButton";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RED = "#B0472F", NAVY = "#24316B";

export default function StayPicker({ onClose }) {
  useDismissable(true, onClose);
  const [state, setState] = useState({ busy: true, places: [], error: null });
  useEffect(() => {
    let gone = false;
    (async () => {
      let fix = null;
      try { fix = await getStampFix(); } catch (e) { if (!gone) setState({ busy: false, places: [], error: e?.code === 1 ? "Location is off for GlobeSkimmers — turn it on in Settings, then try again." : "We couldn’t get a GPS reading just now — give it a moment and try again." }); return; }
      const qs = `latitude=${fix.lat}&longitude=${fix.lng}&types=lodging&radius=400&maxResults=8&rankBy=DISTANCE`;
      const { data, error } = await callWorker(`places/nearby?${qs}`, {});
      if (gone) return;
      const places = Array.isArray(data?.places) ? data.places.filter((p) => p && (p.id || p.placeId) && p.name) : [];
      setState({ busy: false, places, error: error && !places.length ? "Couldn’t look around just now — try again." : null });
    })();
    return () => { gone = true; };
  }, []);
  const showing = showHotelNamesByDefault();
  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9997, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="gs-stay-h" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "88vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "12px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: RED }}>Your card · a stay</div>
            <h2 id="gs-stay-h" style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: INK }}>Where I’m <em style={{ fontStyle: "italic", color: NAVY }}>staying</em></h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 999, background: "transparent", border: 0, color: INK2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: fs(13), lineHeight: 1.45, color: INK2 }}>
          {showing ? "Your card shows the hotel’s name to others (your Settings choice). You can hide any one stamp on the card." : "Private by default: everyone else sees “Accommodation” and the city. Show the hotel’s name any time, stamp by stamp."}
        </p>
        {state.busy ? (
          <p style={{ margin: "16px 0 0", fontFamily: MONO, fontSize: fs(10), letterSpacing: ".14em", textTransform: "uppercase", color: INK3 }}>Looking around you…</p>
        ) : state.error ? (
          <p style={{ margin: "16px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: INK2 }}>{state.error}</p>
        ) : !state.places.length ? (
          <p style={{ margin: "16px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: INK2 }}>No hotel, motel or inn within a few hundred feet of where the phone is. Try again from the lobby or your room.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {state.places.map((p) => {
              const id = p.id || p.placeId;
              return (
                <div key={id} style={{ padding: "12px 12px 10px", borderRadius: 16, background: "#fff", border: "1px solid #EADFC9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span aria-hidden="true" style={{ flex: "none", width: 36, height: 36, borderRadius: 12, background: "#EEF0F8", display: "grid", placeItems: "center" }}><BedDouble size={18} strokeWidth={2} color={NAVY} /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: SERIF, fontSize: fs(18), lineHeight: 1.1, color: INK, overflowWrap: "anywhere" }}>{p.name}</div>
                      {p.formattedAddress ? <div style={{ fontSize: fs(12), color: INK3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.formattedAddress}</div> : null}
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <CityCardStampButton finder="stay" place={{ id, name: p.name, lat: p.lat ?? p.location?.latitude, lng: p.lng ?? p.location?.longitude, types: p.types || [], formattedAddress: p.formattedAddress }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ margin: "14px 0 0", fontSize: fs(11), lineHeight: 1.45, color: INK3, textAlign: "center" }}>{PRIVACY_LINE}</p>
      </div>
    </div>,
    document.body,
  );
}
