import React, { useId } from "react";
import { airportStampConfig, fmtStampDate } from "@/lib/airportStamp";

/**
 * AirportStamp — renders an authentic immigration-style arrival stamp entirely
 * in-app from data (no image, no upload). The country decides the template + ink
 * ("vary by country"), so a passport of arrivals looks authentically varied.
 *
 * Props: iata, city, country, countryCode, date (ISO string|Date), width.
 */
export default function AirportStamp({ iata, city, country, countryCode, date, width = 320 }) {
  const raw = useId();
  const uid = String(raw).replace(/[:]/g, "");
  const { template, ink } = airportStampConfig(countryCode);

  const CITY = String(city || "").toUpperCase();
  const CTRY = String(country || countryCode || "").toUpperCase();   // callers may pass only countryCode
  const CODE = String(iata || "").toUpperCase();
  const dateStr = fmtStampDate(date);
  const [dd = "", mon = "", yyyy = ""] = dateStr.split(" ");

  const plane = `plane-${uid}`;
  const worn = `worn-${uid}`;
  const arcT = `arcT-${uid}`;
  const arcB = `arcB-${uid}`;
  const serif = "Georgia, 'Times New Roman', serif";
  const H = Math.round((width * 224) / 340);

  const body = {
    schengen: (
      <>
        <rect x="14" y="30" width="312" height="164" rx="8" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="22" y="38" width="296" height="148" rx="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <text x="170" y="62" textAnchor="middle" fontFamily={serif} fontSize="14" fontWeight="700" letterSpacing="4" fill="currentColor">{CTRY}</text>
        <line x1="126" y1="78" x2="126" y2="150" stroke="currentColor" strokeWidth="1.3" />
        <line x1="214" y1="78" x2="214" y2="150" stroke="currentColor" strokeWidth="1.3" />
        <text x="74" y="104" textAnchor="middle" fontFamily={serif} fontSize="22" fontWeight="700" fill="currentColor">{dd}</text>
        <text x="74" y="124" textAnchor="middle" fontFamily={serif} fontSize="13" fontWeight="700" letterSpacing="1" fill="currentColor">{mon}</text>
        <text x="74" y="142" textAnchor="middle" fontFamily={serif} fontSize="12" fontWeight="700" fill="currentColor">{yyyy}</text>
        <use href={`#${plane}`} x="158" y="98" width="24" height="24" />
        <path d="M262,102 L280,114 L262,126 Z" fill="currentColor" />
        <text x="170" y="176" textAnchor="middle" fontFamily={serif} fontSize="10.5" fontWeight="700" letterSpacing="1" fill="currentColor">{CITY} — {CODE}</text>
      </>
    ),
    seal: (
      <>
        <circle cx="170" cy="112" r="98" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="170" cy="112" r="86" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <text fontFamily={serif} fontSize="12" fontWeight="700" letterSpacing="2.5" fill="currentColor"><textPath href={`#${arcT}`} startOffset="50%" textAnchor="middle">IMMIGRATION · {CITY}</textPath></text>
        <text fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="3" fill="currentColor"><textPath href={`#${arcB}`} startOffset="50%" textAnchor="middle">★ {CTRY} · ARRIVAL ★</textPath></text>
        <use href={`#${plane}`} x="160" y="62" width="20" height="20" />
        <text x="170" y="118" textAnchor="middle" fontFamily={serif} fontSize="30" fontWeight="700" letterSpacing="2" fill="currentColor">{CODE}</text>
        <rect x="124" y="126" width="92" height="19" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text x="170" y="139" textAnchor="middle" fontFamily={serif} fontSize="11.5" fontWeight="700" letterSpacing="1.5" fill="currentColor">{dateStr}</text>
      </>
    ),
    oval: (
      <>
        <ellipse cx="170" cy="112" rx="150" ry="94" fill="none" stroke="currentColor" strokeWidth="4" />
        <ellipse cx="170" cy="112" rx="138" ry="82" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <text fontFamily={serif} fontSize="12.5" fontWeight="700" letterSpacing="3" fill="currentColor"><textPath href={`#${arcT}`} startOffset="50%" textAnchor="middle">{CITY} · {CTRY}</textPath></text>
        <text fontFamily={serif} fontSize="11.5" fontWeight="700" letterSpacing="4" fill="currentColor"><textPath href={`#${arcB}`} startOffset="50%" textAnchor="middle">★ ARRIVAL ★</textPath></text>
        <use href={`#${plane}`} x="160" y="60" width="21" height="21" />
        <text x="170" y="118" textAnchor="middle" fontFamily={serif} fontSize="30" fontWeight="700" letterSpacing="2" fill="currentColor">{CODE}</text>
        <rect x="124" y="126" width="92" height="19" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text x="170" y="139" textAnchor="middle" fontFamily={serif} fontSize="11.5" fontWeight="700" letterSpacing="1.5" fill="currentColor">{dateStr}</text>
      </>
    ),
    panel: (
      <>
        <rect x="14" y="30" width="312" height="164" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="22" y="38" width="296" height="148" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <text x="170" y="60" textAnchor="middle" fontFamily={serif} fontSize="13" fontWeight="700" letterSpacing="4" fill="currentColor">{CTRY}</text>
        <line x1="120" y1="72" x2="120" y2="176" stroke="currentColor" strokeWidth="1.3" />
        <use href={`#${plane}`} x="56" y="82" width="20" height="20" />
        <path d="M56,124 L74,134 L56,144 Z" fill="currentColor" />
        <text x="66" y="170" textAnchor="middle" fontFamily={serif} fontSize="10" fontWeight="700" letterSpacing="1" fill="currentColor">ENTRY</text>
        <text x="228" y="94" textAnchor="middle" fontFamily={serif} fontSize="13" fontWeight="700" letterSpacing="2" fill="currentColor">{CITY}</text>
        <text x="228" y="128" textAnchor="middle" fontFamily={serif} fontSize="28" fontWeight="700" letterSpacing="2" fill="currentColor">{CODE}</text>
        <rect x="182" y="138" width="92" height="19" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text x="228" y="151" textAnchor="middle" fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="1" fill="currentColor">{dateStr}</text>
      </>
    ),
    ring: (
      <>
        <circle cx="170" cy="112" r="98" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="170" cy="112" r="90" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="170" cy="112" r="86" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <text fontFamily={serif} fontSize="11.5" fontWeight="700" letterSpacing="2" fill="currentColor"><textPath href={`#${arcT}`} startOffset="50%" textAnchor="middle">{CITY}</textPath></text>
        <text fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="3" fill="currentColor"><textPath href={`#${arcB}`} startOffset="50%" textAnchor="middle">★ {CTRY} ★</textPath></text>
        <use href={`#${plane}`} x="160" y="62" width="20" height="20" />
        <text x="170" y="118" textAnchor="middle" fontFamily={serif} fontSize="30" fontWeight="700" letterSpacing="2" fill="currentColor">{CODE}</text>
        <rect x="124" y="126" width="92" height="19" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text x="170" y="139" textAnchor="middle" fontFamily={serif} fontSize="11.5" fontWeight="700" letterSpacing="1.5" fill="currentColor">{dateStr}</text>
      </>
    ),
    hexagon: (
      <>
        <polygon points="60,112 118,34 222,34 280,112 222,190 118,190" fill="none" stroke="currentColor" strokeWidth="4" />
        <polygon points="60,112 118,34 222,34 280,112 222,190 118,190" fill="none" stroke="currentColor" strokeWidth="1.3" transform="translate(170 112) scale(0.9) translate(-170 -112)" />
        <text x="170" y="58" textAnchor="middle" fontFamily={serif} fontSize="12" fontWeight="700" letterSpacing="2.5" fill="currentColor">{CITY}</text>
        <use href={`#${plane}`} x="160" y="66" width="19" height="19" />
        <text x="170" y="120" textAnchor="middle" fontFamily={serif} fontSize="28" fontWeight="700" letterSpacing="2" fill="currentColor">{CODE}</text>
        <rect x="124" y="128" width="92" height="18" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text x="170" y="141" textAnchor="middle" fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="1" fill="currentColor">{dateStr}</text>
        <text x="170" y="170" textAnchor="middle" fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="3" fill="currentColor">★ {CTRY} ★</text>
      </>
    ),
  };

  const arced = template === "seal" || template === "oval" || template === "ring";

  return (
    <svg viewBox="0 0 340 224" width={width} height={H} style={{ color: ink, display: "block" }} role="img"
         aria-label={`Arrival stamp: ${CITY} ${CODE}, ${CTRY}, ${dateStr}`}>
      <defs>
        <symbol id={plane} viewBox="-12 -12 24 24">
          <path fill="currentColor" d="M0,-11 C0.6,-11 1,-9.5 1,-7.5 L1,-4 L11,2 L11,4 L1,1 L0.6,7 L4,10 L4,11.5 L0,10.5 L-4,11.5 L-4,10 L-0.6,7 L-1,1 L-11,4 L-11,2 L-1,-4 L-1,-7.5 C-1,-9.5 -0.6,-11 0,-11 Z" />
        </symbol>
        {arced && template === "oval" && <path id={arcT} d="M52,112 A118,74 0 0 1 288,112" />}
        {arced && template === "oval" && <path id={arcB} d="M58,112 A112,66 0 0 0 282,112" />}
        {arced && template !== "oval" && <path id={arcT} d="M84,112 A86,86 0 0 1 256,112" />}
        {arced && template !== "oval" && <path id={arcB} d="M88,112 A82,82 0 0 0 252,112" />}
        <filter id={worn} x="-16%" y="-16%" width="132%" height="132%">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="11" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.28" result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${worn})`}>{body[template]}</g>
    </svg>
  );
}
