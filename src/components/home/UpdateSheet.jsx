// UpdateSheet — the once-a-day nudge to update from the store (founder, 2026-10-25: "users have to go to
// settings and then click the 'update' in order to get notifications … can we make it simpler"). A
// store build can't update itself and an OTA can't bring notifications, so a phone on an older build
// gets one gentle sheet when the app opens, at most once a day: what the update brings, Update (straight
// to the App Store / Google Play page) and Later (tomorrow). It never opens over another sheet, and not
// before the welcome and the location chooser are done (the caller mounts it after them).
//
//   <UpdateSheet />
import React, { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { storeUpdate } from "@/lib/appUpdate";
import { useDismissable } from "@/lib/dismissStack";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { NEUTRAL, TEAL_DEEP, fs } from "@/components/redesign/constants";

const DAY_KEY = "gs_update_sheet_day_v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const shownToday = () => { try { return localStorage.getItem(DAY_KEY) === today(); } catch { return true; } };
const markToday = () => { try { localStorage.setItem(DAY_KEY, today()); } catch { /* storage off */ } };

function Sheet({ update, alerts, onClose }) {
  useDismissable(true, onClose);
  const go = () => { markToday(); try { window.open(update.url, "_blank", "noopener"); } catch { window.location.href = update.url; } onClose(); };
  return (
    <div className="fixed inset-0 z-[10020] flex items-end justify-center" style={{ background: "rgba(22,17,13,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="gs-update-h" className="w-full max-w-md" onClick={(e) => e.stopPropagation()}
        style={{ background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0" }}>
        <AirmailChevron height={4} />
        <div style={{ padding: "16px 18px calc(22px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span aria-hidden="true" style={{ flex: "none", width: 44, height: 44, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: NEUTRAL.airmailBlue, color: "#FBF6EC" }}>
              <Bell size={21} strokeWidth={2} focusable="false" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id="gs-update-h" style={{ margin: 0, fontFamily: "'Instrument Serif', Georgia, serif", fontSize: fs(25), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
                {alerts ? <>Get <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>notifications</em> on this phone</> : <>A new GlobeSkimmers is <em style={{ fontStyle: "italic", color: NEUTRAL.airmailBlue }}>ready</em></>}
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: fs(14), lineHeight: 1.5, color: NEUTRAL.ink2 }}>
                {alerts
                  ? `Update GlobeSkimmers ${update.where}. It takes a minute, and then you’ll know the moment a postcard or telegram arrives.`
                  : `Update it ${update.where}. It takes a minute.`}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Later" style={{ flex: "none", width: 40, height: 40, margin: "-6px -8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "transparent", cursor: "pointer" }}>
              <X size={19} strokeWidth={2} color={NEUTRAL.ink3} aria-hidden="true" focusable="false" />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" onClick={go}
              style={{ flex: 1, minHeight: 48, borderRadius: 14, border: 0, background: TEAL_DEEP, color: NEUTRAL.white, font: "inherit", fontSize: fs(15), fontWeight: 650, cursor: "pointer" }}>Update</button>
            <button type="button" onClick={onClose}
              style={{ flex: 1, minHeight: 48, borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, font: "inherit", fontSize: fs(15), fontWeight: 600, cursor: "pointer" }}>Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpdateSheet() {
  const { socialTier, socialTierReady } = useAuth();
  const [update, setUpdate] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (shownToday()) return undefined;
    let gone = false;
    storeUpdate().then((u) => {
      if (gone || !u) return;
      setUpdate(u);
      // A breath after the app opens, and never over another sheet.
      setTimeout(() => {
        if (gone || shownToday() || document.querySelector('[role="dialog"]')) return;
        markToday();
        setOpen(true);
      }, 2200);
    });
    return () => { gone = true; };
  }, []);
  if (!open || !update || !socialTierReady) return null;
  return <Sheet update={update} alerts={update.alerts && socialTier === "adult"} onClose={() => setOpen(false)} />;
}
