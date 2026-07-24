// Region-aware same-day rider apps. Country coverage mirrors the Transit page's
// curated list. These are DEEP-LINKS with no destination — they open the rider
// app (or its store) so the user sets their own trip. No commission (utility).
//
// Order matters: local/regional apps first, Uber last as the broad fallback, so
// the region's dominant app leads.
export const RIDE_PROVIDERS = [
  { key: "grab",   name: "Grab",    logo: "🟢", countries: ["PH","SG","MY","TH","VN","ID","KH","MM"],
    app: "grab://open", appStore: "https://apps.apple.com/app/grab/id647268330", playStore: "https://play.google.com/store/apps/details?id=com.grabtaxi.passenger" },
  { key: "gojek",  name: "Gojek",   logo: "🟢", countries: ["ID","SG","VN"],
    app: "gojek://", appStore: "https://apps.apple.com/app/gojek/id944875099", playStore: "https://play.google.com/store/apps/details?id=com.gojek.app" },
  { key: "kakao",  name: "Kakao T", logo: "🟡", countries: ["KR"],
    app: "kakaot://", appStore: "https://apps.apple.com/app/kakao-t/id981110422", playStore: "https://play.google.com/store/apps/details?id=com.kakao.taxi" },
  { key: "careem", name: "Careem",  logo: "🟩", countries: ["AE","SA","EG","JO","PK","QA"],
    app: "careem://", appStore: "https://apps.apple.com/app/careem/id592978487", playStore: "https://play.google.com/store/apps/details?id=com.careem.acma" },
  { key: "didi",   name: "DiDi",    logo: "🟠", countries: ["CN","MX","BR","CL","CO","AU","NZ","JP"],
    app: "didiglobal://open", appStore: "https://apps.apple.com/app/didi/id554499054", playStore: "https://play.google.com/store/apps/details?id=com.didiglobal.passenger" },
  { key: "bolt",   name: "Bolt",    logo: "⚡", countries: ["GB","IE","EE","PL","RO","ZA","NG","KE","PT","ES","FR"],
    app: "bolt://open", appStore: "https://apps.apple.com/app/bolt/id675033630", playStore: "https://play.google.com/store/apps/details?id=ee.mtakso.client" },
  { key: "lyft",   name: "Lyft",    logo: "🩷", countries: ["US","CA"],
    app: "lyft://", appStore: "https://apps.apple.com/app/lyft/id529379082", playStore: "https://play.google.com/store/apps/details?id=me.lyft.android" },
  { key: "uber",   name: "Uber",    logo: "⬛",
    countries: ["US","CA","MX","BR","AU","NZ","GB","FR","DE","ES","IT","IN","JP","KR","TW","HK"],
    excludeCountries: ["PH","SG","MY","TH","VN","ID","CN"],
    web: "https://m.uber.com/ul/?action=setPickup&pickup=my_location",
    app: "https://m.uber.com/ul/?action=setPickup&pickup=my_location",
    appStore: "https://apps.apple.com/app/uber/id368677368", playStore: "https://play.google.com/store/apps/details?id=com.ubercab" },
];

// Country NAME → ISO2 (variants included), mirrors Transit's getCountryCode.
const NAME_TO_CC = {
  PHILIPPINES:"PH", SINGAPORE:"SG", MALAYSIA:"MY", THAILAND:"TH", VIETNAM:"VN", INDONESIA:"ID",
  JAPAN:"JP", "SOUTH KOREA":"KR", KOREA:"KR", CHINA:"CN", TAIWAN:"TW", "HONG KONG":"HK", INDIA:"IN",
  FRANCE:"FR", GERMANY:"DE", ITALY:"IT", SPAIN:"ES", NETHERLANDS:"NL", BELGIUM:"BE", PORTUGAL:"PT",
  AUSTRIA:"AT", GREECE:"GR", IRELAND:"IE", FINLAND:"FI",
  "UNITED KINGDOM":"GB", UK:"GB", ENGLAND:"GB", SCOTLAND:"GB", WALES:"GB",
  SWITZERLAND:"CH", SWEDEN:"SE", NORWAY:"NO", DENMARK:"DK", POLAND:"PL",
  "CZECH REPUBLIC":"CZ", CZECHIA:"CZ", TURKEY:"TR", "TÜRKIYE":"TR",
  "UNITED STATES":"US", USA:"US", CANADA:"CA", MEXICO:"MX", BRAZIL:"BR", ARGENTINA:"AR",
  AUSTRALIA:"AU", "NEW ZEALAND":"NZ",
  UAE:"AE", "UNITED ARAB EMIRATES":"AE", ISRAEL:"IL", EGYPT:"EG", "SOUTH AFRICA":"ZA",
};

// Derive an ISO2 code from a LocationContext activeLocation ({ address: { country } }
// or a plain { country } shape). Falls back to US.
export function ccFromLocation(location) {
  const name = (location?.address?.country || location?.country || "").toString().toUpperCase().trim();
  if (!name) return "US";
  return NAME_TO_CC[name] || name.substring(0, 2);
}

// Rider apps available in a country (regional first, Uber last). Never empty:
// falls back to Uber where nothing else matches.
export function getRideProviders(cc) {
  const code = (cc || "US").toUpperCase();
  const list = RIDE_PROVIDERS.filter(
    (p) => p.countries.includes(code) && !p.excludeCountries?.includes(code)
  );
  return list.length ? list : RIDE_PROVIDERS.filter((p) => p.key === "uber");
}

// Open a rider app: prefer a web/universal link; else try the app scheme and fall
// back to the store after a beat. Call from a user gesture.
export function openRide(p) {
  if (p.web) {
    window.open(p.web, "_blank");
    return;
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  try {
    window.location.href = p.app;
  } catch { /* scheme may be blocked; store fallback below */ }
  setTimeout(() => window.open(isIOS ? p.appStore : p.playStore, "_blank"), 1800);
}
