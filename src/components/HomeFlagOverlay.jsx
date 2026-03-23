import React from "react";

/**
 * HomeFlagOverlay v3 — 194 countries, bold-left 75% / fade-right 25%
 * Special: Japan gets NO fade (full red circle, out of respect)
 * Text overlay layer helps readability over vivid flag colors.
 */

const FLAG_CONFIG = {
  AD: { accent: "#0032A0", light: false, name: "Andorra" },
  AE: { accent: "#00732F", light: false, name: "United Arab Emirates" },
  AF: { accent: "#000000", light: false, name: "Afghanistan" },
  AG: { accent: "#000000", light: false, name: "Antigua and Barbuda" },
  AL: { accent: "#E41E20", light: false, name: "Albania" },
  AM: { accent: "#D90012", light: false, name: "Armenia" },
  AO: { accent: "#CC092F", light: false, name: "Angola" },
  AR: { accent: "#6CACE4", light: true, name: "Argentina" },
  AT: { accent: "#C8102E", light: false, name: "Austria" },
  AU: { accent: "#00008B", light: false, name: "Australia" },
  AZ: { accent: "#0092BC", light: false, name: "Azerbaijan" },
  BA: { accent: "#002395", light: false, name: "Bosnia and Herzegovina" },
  BB: { accent: "#00267F", light: false, name: "Barbados" },
  BD: { accent: "#006A4E", light: false, name: "Bangladesh" },
  BE: { accent: "#2D2926", light: false, name: "Belgium" },
  BF: { accent: "#009E49", light: false, name: "Burkina Faso" },
  BG: { accent: "#00966E", light: false, name: "Bulgaria" },
  BH: { accent: "#CE1126", light: false, name: "Bahrain" },
  BI: { accent: "#1EB53A", light: false, name: "Burundi" },
  BJ: { accent: "#008751", light: false, name: "Benin" },
  BN: { accent: "#F7E017", light: false, name: "Brunei" },
  BO: { accent: "#007934", light: false, name: "Bolivia" },
  BR: { accent: "#009B3A", light: false, name: "Brazil" },
  BS: { accent: "#00778B", light: false, name: "Bahamas", coverLeft: true },
  BT: { accent: "#FF4E12", light: false, name: "Bhutan" },
  BW: { accent: "#6DA9D2", light: false, name: "Botswana" },
  BY: { accent: "#C8313E", light: false, name: "Belarus" },
  BZ: { accent: "#003F87", light: false, name: "Belize" },
  CA: { accent: "#FF0000", light: true, name: "Canada" },
  CD: { accent: "#007FFF", light: false, name: "Democratic Republic of the Congo" },
  CF: { accent: "#003082", light: false, name: "Central African Republic" },
  CG: { accent: "#009543", light: false, name: "Republic of the Congo" },
  CH: { accent: "#D52B1E", light: false, name: "Switzerland" },
  CI: { accent: "#F77F00", light: false, name: "Ivory Coast" },
  CL: { accent: "#0039A6", light: false, name: "Chile" },
  CM: { accent: "#007A5E", light: false, name: "Cameroon" },
  CN: { accent: "#DE2910", light: false, name: "China" },
  CO: { accent: "#FCD116", light: false, name: "Colombia" },
  CR: { accent: "#002B7F", light: false, name: "Costa Rica" },
  CU: { accent: "#002A8F", light: false, name: "Cuba", coverLeft: true },
  CV: { accent: "#003893", light: false, name: "Cape Verde" },
  CY: { accent: "#D47600", light: true, name: "Cyprus" },
  CZ: { accent: "#11457E", light: false, name: "Czech Republic", coverLeft: true },
  DE: { accent: "#DD0000", light: false, name: "Germany" },
  DJ: { accent: "#6AB2E7", light: false, name: "Djibouti", coverLeft: true },
  DK: { accent: "#C8102E", light: false, name: "Denmark" },
  DM: { accent: "#006B3F", light: false, name: "Dominica" },
  DO: { accent: "#002D62", light: false, name: "Dominican Republic" },
  DZ: { accent: "#006233", light: false, name: "Algeria" },
  EC: { accent: "#FFD100", light: false, name: "Ecuador" },
  EE: { accent: "#0072CE", light: false, name: "Estonia" },
  EG: { accent: "#C8102E", light: false, name: "Egypt" },
  ER: { accent: "#4189DD", light: false, name: "Eritrea", coverLeft: true },
  ES: { accent: "#AA151B", light: false, name: "Spain" },
  ET: { accent: "#009B3A", light: false, name: "Ethiopia" },
  FI: { accent: "#003580", light: true, name: "Finland" },
  FJ: { accent: "#68BFE5", light: false, name: "Fiji" },
  FM: { accent: "#6797B5", light: false, name: "Micronesia" },
  FR: { accent: "#002395", light: false, name: "France" },
  GA: { accent: "#009E60", light: false, name: "Gabon" },
  GB: { accent: "#012169", light: false, name: "United Kingdom" },
  GD: { accent: "#CE1126", light: false, name: "Grenada" },
  GE: { accent: "#FF0000", light: true, name: "Georgia" },
  GH: { accent: "#006B3F", light: false, name: "Ghana" },
  GM: { accent: "#3A7728", light: false, name: "Gambia" },
  GN: { accent: "#CE1126", light: false, name: "Guinea" },
  GQ: { accent: "#3E9A00", light: false, name: "Equatorial Guinea", coverLeft: true },
  GR: { accent: "#0D5EAF", light: false, name: "Greece" },
  GT: { accent: "#4997D0", light: true, name: "Guatemala" },
  GW: { accent: "#CE1126", light: false, name: "Guinea-Bissau" },
  GY: { accent: "#009E49", light: false, name: "Guyana", coverLeft: true },
  HN: { accent: "#0073CF", light: true, name: "Honduras" },
  HR: { accent: "#171796", light: false, name: "Croatia" },
  HT: { accent: "#00209F", light: false, name: "Haiti" },
  HU: { accent: "#436F4D", light: false, name: "Hungary" },
  ID: { accent: "#CE1126", light: false, name: "Indonesia" },
  IE: { accent: "#169B62", light: false, name: "Ireland" },
  IL: { accent: "#0038B8", light: true, name: "Israel" },
  IN: { accent: "#FF9933", light: false, name: "India" },
  IQ: { accent: "#007A3D", light: false, name: "Iraq" },
  IR: { accent: "#239F40", light: false, name: "Iran" },
  IS: { accent: "#003897", light: false, name: "Iceland" },
  IT: { accent: "#008C45", light: false, name: "Italy" },
  JM: { accent: "#009B3A", light: false, name: "Jamaica" },
  JO: { accent: "#007A3D", light: false, name: "Jordan", coverLeft: true },
  JP: { accent: "#BC002D", light: true, name: "Japan", noFade: true },
  KE: { accent: "#BB0000", light: false, name: "Kenya" },
  KG: { accent: "#E8112D", light: false, name: "Kyrgyzstan" },
  KH: { accent: "#032EA1", light: false, name: "Cambodia" },
  KI: { accent: "#CE1126", light: false, name: "Kiribati" },
  KM: { accent: "#3A7728", light: false, name: "Comoros", coverLeft: true },
  KN: { accent: "#009E49", light: false, name: "Saint Kitts and Nevis" },
  KP: { accent: "#024FA2", light: false, name: "North Korea" },
  KR: { accent: "#003478", light: true, name: "South Korea" },
  KW: { accent: "#007A3D", light: false, name: "Kuwait" },
  KZ: { accent: "#00AFCA", light: false, name: "Kazakhstan" },
  LA: { accent: "#002868", light: false, name: "Laos" },
  LB: { accent: "#EE161F", light: false, name: "Lebanon" },
  LC: { accent: "#65CFFF", light: false, name: "Saint Lucia" },
  LI: { accent: "#002B7F", light: false, name: "Liechtenstein" },
  LK: { accent: "#8B2346", light: false, name: "Sri Lanka" },
  LR: { accent: "#BF0A30", light: false, name: "Liberia" },
  LS: { accent: "#00209F", light: false, name: "Lesotho" },
  LT: { accent: "#006A44", light: false, name: "Lithuania" },
  LU: { accent: "#00A1DE", light: false, name: "Luxembourg" },
  LV: { accent: "#9E3039", light: false, name: "Latvia" },
  LY: { accent: "#239E46", light: false, name: "Libya" },
  MA: { accent: "#C1272D", light: false, name: "Morocco" },
  MC: { accent: "#CE1126", light: false, name: "Monaco" },
  MD: { accent: "#003DA5", light: false, name: "Moldova" },
  ME: { accent: "#D3AE3B", light: false, name: "Montenegro" },
  MG: { accent: "#007E3A", light: false, name: "Madagascar" },
  MH: { accent: "#003893", light: false, name: "Marshall Islands" },
  MK: { accent: "#D20000", light: false, name: "North Macedonia" },
  ML: { accent: "#14B53A", light: false, name: "Mali" },
  MM: { accent: "#FECB00", light: false, name: "Myanmar" },
  MN: { accent: "#C4272F", light: false, name: "Mongolia" },
  MR: { accent: "#006233", light: false, name: "Mauritania" },
  MT: { accent: "#CF142B", light: true, name: "Malta" },
  MU: { accent: "#1A206D", light: false, name: "Mauritius" },
  MV: { accent: "#007E3A", light: false, name: "Maldives" },
  MW: { accent: "#CE1126", light: false, name: "Malawi" },
  MX: { accent: "#006341", light: false, name: "Mexico" },
  MY: { accent: "#010066", light: false, name: "Malaysia" },
  MZ: { accent: "#007168", light: false, name: "Mozambique", coverLeft: true },
  NA: { accent: "#003580", light: false, name: "Namibia" },
  NE: { accent: "#E05206", light: false, name: "Niger" },
  NG: { accent: "#008751", light: false, name: "Nigeria" },
  NI: { accent: "#0067C6", light: true, name: "Nicaragua" },
  NL: { accent: "#21468B", light: false, name: "Netherlands" },
  NO: { accent: "#BA0C2F", light: false, name: "Norway" },
  NP: { accent: "#DC143C", light: false, name: "Nepal" },
  NR: { accent: "#002B7F", light: false, name: "Nauru" },
  NZ: { accent: "#00247D", light: false, name: "New Zealand" },
  OM: { accent: "#DB161B", light: false, name: "Oman" },
  PA: { accent: "#005293", light: true, name: "Panama" },
  PE: { accent: "#D91023", light: false, name: "Peru" },
  PG: { accent: "#CE1126", light: false, name: "Papua New Guinea" },
  PH: { accent: "#0038A8", light: false, name: "Philippines", coverLeft: true },
  PK: { accent: "#01411C", light: false, name: "Pakistan" },
  PL: { accent: "#DC143C", light: true, name: "Poland" },
  PT: { accent: "#006600", light: false, name: "Portugal" },
  PW: { accent: "#4AADD6", light: false, name: "Palau" },
  PY: { accent: "#D52B1E", light: false, name: "Paraguay" },
  QA: { accent: "#8A1538", light: false, name: "Qatar" },
  RO: { accent: "#002B7F", light: false, name: "Romania" },
  RS: { accent: "#0C4076", light: false, name: "Serbia" },
  RU: { accent: "#0039A6", light: false, name: "Russia" },
  RW: { accent: "#00A1DE", light: false, name: "Rwanda" },
  SA: { accent: "#006C35", light: false, name: "Saudi Arabia" },
  SB: { accent: "#0051A5", light: false, name: "Solomon Islands" },
  SC: { accent: "#003F87", light: false, name: "Seychelles" },
  SD: { accent: "#007229", light: false, name: "Sudan", coverLeft: true },
  SE: { accent: "#006AA7", light: false, name: "Sweden" },
  SG: { accent: "#EE2536", light: false, name: "Singapore" },
  SI: { accent: "#003DA5", light: false, name: "Slovenia" },
  SK: { accent: "#0B4EA2", light: false, name: "Slovakia" },
  SL: { accent: "#1EB53A", light: false, name: "Sierra Leone" },
  SM: { accent: "#5EB6E4", light: true, name: "San Marino" },
  SN: { accent: "#00853F", light: false, name: "Senegal" },
  SO: { accent: "#4189DD", light: false, name: "Somalia" },
  SR: { accent: "#377E3F", light: false, name: "Suriname" },
  SS: { accent: "#078930", light: false, name: "South Sudan", coverLeft: true },
  ST: { accent: "#12AD2B", light: false, name: "Sao Tome and Principe" },
  SV: { accent: "#0F47AF", light: false, name: "El Salvador" },
  SY: { accent: "#CE1126", light: false, name: "Syria" },
  SZ: { accent: "#3E5EB9", light: false, name: "Eswatini" },
  TD: { accent: "#002664", light: false, name: "Chad" },
  TG: { accent: "#006A4E", light: false, name: "Togo" },
  TH: { accent: "#241D4F", light: false, name: "Thailand" },
  TJ: { accent: "#060", light: false, name: "Tajikistan" },
  TL: { accent: "#DC241F", light: false, name: "Timor-Leste", coverLeft: true },
  TM: { accent: "#28AE66", light: false, name: "Turkmenistan" },
  TN: { accent: "#E70013", light: false, name: "Tunisia" },
  TO: { accent: "#C10000", light: false, name: "Tonga" },
  TR: { accent: "#E30A17", light: false, name: "Turkey" },
  TT: { accent: "#CE1126", light: false, name: "Trinidad and Tobago" },
  TV: { accent: "#009FDA", light: false, name: "Tuvalu" },
  TZ: { accent: "#1EB53A", light: false, name: "Tanzania" },
  UA: { accent: "#005BBB", light: false, name: "Ukraine" },
  UG: { accent: "#D90000", light: false, name: "Uganda" },
  US: { accent: "#002868", light: false, name: "United States" },
  UY: { accent: "#001489", light: false, name: "Uruguay" },
  UZ: { accent: "#1EB53A", light: false, name: "Uzbekistan" },
  VA: { accent: "#FFE000", light: true, name: "Vatican City" },
  VC: { accent: "#009E60", light: false, name: "Saint Vincent and the Grenadines" },
  VE: { accent: "#003DA5", light: false, name: "Venezuela" },
  VN: { accent: "#DA251D", light: false, name: "Vietnam" },
  VU: { accent: "#009543", light: false, name: "Vanuatu", coverLeft: true },
  WS: { accent: "#CE1126", light: false, name: "Samoa" },
  YE: { accent: "#CE1126", light: false, name: "Yemen" },
  ZA: { accent: "#007A4D", light: false, name: "South Africa", coverLeft: true },
  ZM: { accent: "#198A00", light: false, name: "Zambia" },
  ZW: { accent: "#006400", light: false, name: "Zimbabwe", coverLeft: true },
};

// ════════════════════════════════════════════════════
// NAME → CODE reverse lookup
// ════════════════════════════════════════════════════
const NAME_TO_CODE = {};
Object.entries(FLAG_CONFIG).forEach(([code, cfg]) => {
  NAME_TO_CODE[cfg.name.toLowerCase()] = code;
});
NAME_TO_CODE["usa"] = "US";
NAME_TO_CODE["uk"] = "GB";
NAME_TO_CODE["england"] = "GB";
NAME_TO_CODE["south korea"] = "KR";
NAME_TO_CODE["north korea"] = "KP";
NAME_TO_CODE["uae"] = "AE";
NAME_TO_CODE["czech republic"] = "CZ";
NAME_TO_CODE["czechia"] = "CZ";
NAME_TO_CODE["ivory coast"] = "CI";
NAME_TO_CODE["cote d'ivoire"] = "CI";
NAME_TO_CODE["côte d'ivoire"] = "CI";
NAME_TO_CODE["congo"] = "CG";
NAME_TO_CODE["drc"] = "CD";
NAME_TO_CODE["dr congo"] = "CD";
NAME_TO_CODE["cape verde"] = "CV";
NAME_TO_CODE["cabo verde"] = "CV";
NAME_TO_CODE["east timor"] = "TL";
NAME_TO_CODE["timor-leste"] = "TL";
NAME_TO_CODE["burma"] = "MM";
NAME_TO_CODE["eswatini"] = "SZ";
NAME_TO_CODE["swaziland"] = "SZ";
NAME_TO_CODE["north macedonia"] = "MK";
NAME_TO_CODE["macedonia"] = "MK";
NAME_TO_CODE["são tomé and príncipe"] = "ST";
NAME_TO_CODE["laos"] = "LA";

// ════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════

export function resolveCode(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (FLAG_CONFIG[upper]) return upper;
  return NAME_TO_CODE[trimmed.toLowerCase()] || null;
}

export function getFlagConfig(input) {
  const code = resolveCode(input);
  if (!code) return null;
  return { ...FLAG_CONFIG[code], code };
}

export function getFlagUrl(input) {
  const code = resolveCode(input);
  if (!code) return null;
  return `https://flagcdn.com/w640/${code.toLowerCase()}.png`;
}

// ════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════

export default function HomeFlagOverlay({ showFlag, countryCode, children }) {
  const code = resolveCode(countryCode);

  if (!showFlag || !code) {
    return <>{children}</>;
  }

  const config = FLAG_CONFIG[code];
  const isLight = config?.light || false;
  const noFade = config?.noFade || false;
  const fullFlag = config?.fullFlag || false;
  const coverLeft = config?.coverLeft || false;
  const imgUrl = `https://flagcdn.com/w640/${code.toLowerCase()}.png`;

  // Japan & other noFade flags: show full flag, bold vivid colors
  // All others: bold 75% left → fade 25% right
  const maskStyle = noFade
    ? { opacity: 0.85 }
    : {
        maskImage:
          "linear-gradient(to right, black 0%, black 65%, rgba(0,0,0,0.3) 85%, transparent 98%)",
        WebkitMaskImage:
          "linear-gradient(to right, black 0%, black 65%, rgba(0,0,0,0.3) 85%, transparent 98%)",
      };

  // coverLeft (Philippines): fills card but anchors left so triangle+sun+stars visible
  // fullFlag: contain fit for flags that must show every element
  // default: cover centered
  const fitStyle = coverLeft
    ? { objectFit: "cover", objectPosition: "left center" }
    : fullFlag
      ? { objectFit: "contain", objectPosition: "left center" }
      : { objectFit: "cover", objectPosition: "center" };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* ── Layer 1: Flag image ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        <img
          src={imgUrl}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            ...fitStyle,
            ...maskStyle,
          }}
        />
      </div>

      {/* ── Layer 2: Content ── */}
      <div style={{ position: "relative", zIndex: 3 }}>{children}</div>
    </div>
  );
}
