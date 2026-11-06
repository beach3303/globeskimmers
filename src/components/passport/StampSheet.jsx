// StampSheet — the bar's Stamp button (navigation redesign, 2026-10-31, step 2). A bottom sheet
// with the two ways a stamp is earned, and the way out for photos that aren't one:
//   Upload photos      one photo or many, from any trip — the photo sorter finds where and when
//   Stamp where I am   at a place right now; the phone's location proves it
//   Just sharing?      post them to a City Board (the Contribute sheet)
// The file input lives IN the sheet: the picker has to open from the tap itself (an iOS WebView
// blocks a file input clicked after a navigation). Picked files are queued the way gallery shares
// arrive (src/lib/sharedPhotos.js), and the Passport opens with its sorter — straight to the
// places, no ask, since the member chose "Upload photos" here.
import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BedDouble, ChevronRight, ImagePlus, MapPin, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useDismissable } from "@/lib/dismissStack";
import { queueSharedPhotos } from "@/lib/sharedPhotos";
import { fs } from "@/components/redesign/constants";
import StayPicker from "@/components/citycards/StayPicker";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657";
const STAMP = "#B0472F", TEAL = "#0E7C73", TEAL_SOFT = "#E3F1EF", AIR_BLUE = "#2B4C8C";

export default function StampSheet({ onClose, onContribute = undefined }) {
  useDismissable(true, onClose);
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [stay, setStay] = useState(false);

  const picked = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    queueSharedPhotos(files, [], { shared: false });
    onClose();
    navigate(createPageUrl("Passport"));
  };
  const here = () => { onClose(); navigate(`${createPageUrl("Passport")}?stamp=here`); };
  const boards = () => { onClose(); if (typeof onContribute === "function") onContribute(); };

  const card = (bg, border) => ({ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: 14, borderRadius: 18, background: bg, border: `1px solid ${border}`, cursor: "pointer", font: "inherit" });
  const chip = (bg) => ({ flex: "none", width: 52, height: 52, borderRadius: 16, background: bg, display: "grid", placeItems: "center" });

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9996, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="gs-stamp-sheet-h" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl" style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "10px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div aria-hidden="true" className="mx-auto" style={{ width: 38, height: 5, borderRadius: 999, background: "#E5DDC8" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
          <div>
            <h2 id="gs-stamp-sheet-h" style={{ margin: 0, fontFamily: SERIF, fontSize: fs(28), fontWeight: 400, lineHeight: 1.05, color: INK }}>
              Add a <em style={{ fontStyle: "italic", color: STAMP }}>stamp</em>
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: fs(14), lineHeight: 1.45, color: INK2 }}>Stamps are earned by being there: right now, or in a photo from the trip.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 999, background: "transparent", border: 0, color: INK2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={picked} />
        <button type="button" onClick={() => fileRef.current?.click()} style={{ ...card("#FBF6EC", "#EADFC9"), marginTop: 16 }}>
          <span aria-hidden="true" style={chip(STAMP)}><ImagePlus size={24} strokeWidth={2} color="#fff" /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: fs(16), fontWeight: 700, color: INK }}>Upload photos</span>
            <span style={{ display: "block", fontSize: fs(12.5), lineHeight: 1.4, color: INK2, marginTop: 2 }}>One photo or many, from any trip. We find where and when each was taken.</span>
          </span>
        </button>
        <button type="button" onClick={here} style={{ ...card("#fff", "#E5DDC8"), marginTop: 10 }}>
          <span aria-hidden="true" style={chip(TEAL_SOFT)}><MapPin size={24} strokeWidth={2} color={TEAL} /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: fs(16), fontWeight: 700, color: INK }}>Stamp where I am</span>
            <span style={{ display: "block", fontSize: fs(12.5), lineHeight: 1.4, color: INK2, marginTop: 2 }}>At a place right now? Your phone’s location proves it.</span>
          </span>
        </button>
        {/* A stay on the card (cards-and-passport, 2026-11-06): private by default. */}
        <button type="button" onClick={() => setStay(true)} style={{ ...card("#fff", "#E5DDC8"), marginTop: 10 }}>
          <span aria-hidden="true" style={chip("#EEF0F8")}><BedDouble size={24} strokeWidth={2} color="#24316B" /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: fs(16), fontWeight: 700, color: INK }}>Where I’m staying</span>
            <span style={{ display: "block", fontSize: fs(12.5), lineHeight: 1.4, color: INK2, marginTop: 2 }}>A stay goes on your card, not your passport. Others see “Accommodation” and the city unless you show the name.</span>
          </span>
        </button>
        {stay ? <StayPicker onClose={() => setStay(false)} /> : null}
        <button type="button" onClick={boards} className="inline-flex items-center gap-1"
          style={{ marginTop: 14, minHeight: 44, padding: "0 4px", background: "transparent", border: 0, color: AIR_BLUE, font: "inherit", fontSize: fs(14), fontWeight: 600, cursor: "pointer" }}>
          Just sharing photos? Post them to a City Board <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        </button>
        <p style={{ margin: "2px 0 0", fontSize: fs(11.5), color: INK3 }}>Public, from “a traveler”. A City Board photo isn’t a stamp.</p>
      </div>
    </div>,
    document.body,
  );
}
