// MemberCode — your code on your profile (founder decision 4B, 2026-11-20: "a QR on every profile").
// A friend points their camera at it and lands on your public page (the same /p/ link the invite
// text carries, tagged src=qr for the funnel); in the app that page is your Traveler page, where
// Add friend is one tap. Drawn on the phone with the qrcode package — nothing leaves the device.
//
//   <MemberCode handle cloth style />
//   handle   your @username (the card waits until there is one)
//   cloth    the owner's cloth key or row, for the frame ink
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { getShareLink } from "@/lib/passport";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";
import InviteButton from "@/components/passport/InviteButton";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

export default function MemberCode({ handle, cloth, style = undefined }) {
  const row = clothRow(cloth);
  const ink = row?.cloth || NEUTRAL.airmailBlue;
  const [png, setPng] = useState(null);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!handle) return undefined;
    let gone = false;
    (async () => {
      try {
        const { data } = await getShareLink();
        const base = data?.url || "https://globeskimmers.io";
        const link = `${base}${base.includes("?") ? "&" : "?"}src=qr`;
        const dataUrl = await QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 1, width: 512, color: { dark: "#16110D", light: "#FFFCF7" } });
        if (!gone) { setUrl(link); setPng(dataUrl); }
      } catch { /* no code: the card stays out */ }
    })();
    return () => { gone = true; };
  }, [handle]);
  if (!handle || !png) return null;
  return (
    <section aria-label="Your code" style={{ borderRadius: 18, background: NEUTRAL.white, border: `1px solid ${rgba(ink, 0.3)}`, padding: 16, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <QrCode size={16} strokeWidth={2.1} color={ink} aria-hidden="true" focusable="false" />
        <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>Your code</span>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <img src={png} alt={`A code that opens @${handle}'s page`} width={148} height={148}
          style={{ width: 148, height: 148, flex: "none", borderRadius: 12, border: `1px solid ${rgba(ink, 0.2)}`, background: "#FFFCF7", padding: 6, boxSizing: "border-box", imageRendering: "pixelated" }} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: SERIF, fontSize: fs(22), lineHeight: 1.05, color: NEUTRAL.ink }}>@{handle}</div>
          <p style={{ margin: "6px 0 0", fontSize: fs(13), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
            A friend points their camera at this and lands on your page. Add friend is one tap from there.
          </p>
          {url ? <p style={{ margin: "6px 0 0", fontFamily: MONO, fontSize: fs(10.5), color: NEUTRAL.ink3, overflowWrap: "anywhere" }}>{url.replace(/^https:\/\//, "").replace(/\?src=qr$/, "")}</p> : null}
          <InviteButton label="Share my link" color={cloth} size="md" style={{ marginTop: 10 }} />
        </div>
      </div>
    </section>
  );
}
