// Canonical country list + helpers, shared by the Settings home-country picker
// and Home's flag lookup. Single source of truth so the flag works for EVERY
// country a user can pick (Home previously had only ~20 codes). `name` values
// match what gets stored in the Supabase profile's `home_country` text column.

export const COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cape Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "CD", name: "Democratic Republic of the Congo" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "CI", name: "Ivory Coast" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "KP", name: "North Korea" },
  { code: "MK", name: "North Macedonia" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "CG", name: "Republic of the Congo" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "KR", name: "South Korea" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatican City" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
].sort((a, b) => a.name.localeCompare(b.name));

// Search aliases — lets users type "US"/"USA"/"America" → United States, etc.
const ALIASES = {
  "United States": ["us", "usa", "u.s.", "u.s.a.", "america", "united states of america", "states"],
  "United Kingdom": ["uk", "u.k.", "britain", "great britain", "england", "scotland", "wales"],
  "United Arab Emirates": ["uae", "u.a.e.", "emirates", "dubai", "abu dhabi"],
  "South Korea": ["korea", "republic of korea", "rok"],
  "North Korea": ["dprk"],
  "Russia": ["russian federation"],
  "Czech Republic": ["czechia"],
  "Netherlands": ["holland"],
  "Vietnam": ["viet nam"],
  "Ivory Coast": ["cote d'ivoire", "côte d'ivoire"],
};

const NAME_TO_CODE = COUNTRIES.reduce((m, c) => { m[c.name] = c.code; return m; }, {});

// Loose matching key. Google's place data (home-city picks, GPS country) spells
// some countries differently from COUNTRIES — "Czechia", "Türkiye", "Côte
// d'Ivoire", "Myanmar (Burma)", "The Bahamas", "Bosnia & Herzegovina", "St
// Lucia" — and those used to resolve to no flag. keepParens=false also drops a
// "(…)" suffix; it's tried second so "Congo (DRC)" can still match its own key.
function looseKey(name, keepParens) {
  let k = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  k = k.replace(/[\u2018\u2019]/g, "'");
  k = keepParens ? k.replace(/[()]/g, " ") : k.replace(/\(.*?\)/g, " ");
  k = k.replace(/&/g, " and ").replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
  k = k.replace(/^the /, "").replace(/\bst /g, "saint ");
  return k;
}

// Spellings and territories COUNTRIES/ALIASES don't cover. Territories have
// their own flag even though the Settings picker doesn't list them.
const EXTRA_SPELLINGS = {
  "turkiye": "TR", "cabo verde": "CV", "swaziland": "SZ", "macedonia": "MK",
  "burma": "MM", "east timor": "TL", "holy see": "VA", "vatican": "VA",
  "congo": "CG", "republic of the congo": "CG", "congo republic": "CG",
  "congo drc": "CD", "dr congo": "CD", "democratic republic of congo": "CD",
  "saint vincent and grenadines": "VC", "lao pdr": "LA",
  "puerto rico": "PR", "hong kong": "HK", "taiwan": "TW", "macau": "MO", "macao": "MO",
  "palestine": "PS", "kosovo": "XK",
};

const LOOSE_TO_CODE = (() => {
  const m = {};
  const add = (label, code) => { const key = looseKey(label, true); if (key && !(key in m)) m[key] = code; };
  COUNTRIES.forEach((c) => add(c.name, c.code));
  Object.entries(ALIASES).forEach(([name, list]) => { const code = NAME_TO_CODE[name]; if (code) list.forEach((a) => add(a, code)); });
  Object.entries(EXTRA_SPELLINGS).forEach(([label, code]) => add(label, code));
  return m;
})();

// name → ISO-2 code (lowercased by callers for flagcdn URLs). null if unknown.
// Exact canonical name first, then the loose key, then the loose key without a
// "(…)" suffix.
export function countryCode(name) {
  if (!name) return null;
  return NAME_TO_CODE[name] || LOOSE_TO_CODE[looseKey(name, true)] || LOOSE_TO_CODE[looseKey(name, false)] || null;
}

// Returns COUNTRIES filtered by `query` (matches name OR an alias like "USA").
// United States is pinned to the top whenever it's in the result set, so the
// default list opens with it above Afghanistan.
export function searchCountries(query) {
  const q = (query || "").trim().toLowerCase();
  let list = COUNTRIES;
  if (q) {
    list = COUNTRIES.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      const al = ALIASES[c.name];
      // One-way: the typed text must be part of an alias ("us" → "usa"). The old
      // reverse check let "australia" match the alias "us" and pinned United
      // States above Australia, Austria, Russia, Belarus, Cyprus, Mauritius.
      return al ? al.some((a) => a.includes(q)) : false;
    });
  }
  const us = list.find((c) => c.name === "United States");
  return us ? [us, ...list.filter((c) => c.name !== "United States")] : list;
}
