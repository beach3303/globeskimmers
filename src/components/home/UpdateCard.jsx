// UpdateCard — 'Get alerts on this phone' on Home (founder, 2026-10-24: "only my phone has
// notification … can we spread the love to all iphones and androids?"). Alerts need the newest
// store build; this card shows only on a phone whose store has a newer one (src/lib/appUpdate.js)
// and opens the App Store / Google Play page. Two choices: Update, Not now (a week's quiet).
// Adults hear about alerts; anyone else (alerts are adults-only) just hears there's an update.
//
//   <UpdateCard />
import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { storeUpdate } from "@/lib/appUpdate";
import { NEUTRAL, TEAL_DEEP, fs } from "@/components/redesign/constants";

const SNOOZE = "gs_update_snooze_v1";
const WEEK = 7 * 24 * 3600 * 1000;
const snoozed = () => { try { return Date.now() - Number(localStorage.getItem(SNOOZE) || 0) < WEEK; } catch { return false; } };

export default function UpdateCard() {
  const { socialTier, socialTierReady } = useAuth();
  const [update, setUpdate] = useState(null);
  const [hidden, setHidden] = useState(snoozed);
  useEffect(() => {
    if (hidden) return undefined;
    let gone = false;
    storeUpdate().then((u) => { if (!gone) setUpdate(u); });
    return () => { gone = true; };
  }, [hidden]);
  if (hidden || !update || !socialTierReady) return null;
  const alerts = update.alerts && socialTier === "adult";
  const notNow = () => { try { localStorage.setItem(SNOOZE, String(Date.now())); } catch { /* storage off */ } setHidden(true); };
  return (
    // The zones' own column: px-4 outside, the same max width inside (Zone.jsx columnClass).
    <div className="px-4" style={{ marginTop: 12 }}>
      <section aria-label={alerts ? "Get alerts on this phone" : "A new GlobeSkimmers is ready"} className="mx-auto max-w-md md:max-w-[720px]"
        style={{ boxSizing: "border-box", padding: "12px 14px", background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailLine}`, borderRadius: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span aria-hidden="true" style={{ flex: "none", width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.airmailLine}`, color: NEUTRAL.airmailBlue }}>
            <Bell size={18} strokeWidth={2} focusable="false" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: fs(15), fontWeight: 700, color: NEUTRAL.ink, lineHeight: 1.3 }}>{alerts ? "Get alerts on this phone" : "A new GlobeSkimmers is ready"}</div>
            <p style={{ margin: "2px 0 0", fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              {alerts
                ? `Update GlobeSkimmers ${update.where} to know the moment a postcard or telegram arrives.`
                : `Update it ${update.where}.`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <a href={update.url} target="_blank" rel="noreferrer"
            style={{ flex: 1, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: TEAL_DEEP, color: NEUTRAL.white, fontSize: fs(14), fontWeight: 600, textDecoration: "none" }}>
            Update
          </a>
          <button type="button" onClick={notNow}
            style={{ flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>
            Not now
          </button>
        </div>
      </section>
    </div>
  );
}
