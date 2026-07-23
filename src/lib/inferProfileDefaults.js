// Infer sensible profile defaults so onboarding doesn't have to ASK for currency,
// language, temperature scale, or distance unit — we derive them from the user's
// home country + device locale. Every value is a soft default the user can change
// in Settings; the goal is a usable first run with the fewest possible questions.
//
// home_country is stored as a country NAME (e.g. "United States") — see countries.js.
import { COUNTRIES } from "@/lib/countries";

const CODE_BY_NAME = Object.fromEntries(COUNTRIES.map((c) => [c.name, c.code]));

// ISO2 → ISO4217 currency. Covers the common travel markets + the whole eurozone;
// anything unmapped falls back to USD (a safe, changeable default).
const CURRENCY_BY_CC = {
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD", JP: "JPY", CN: "CNY",
  IN: "INR", KR: "KRW", BR: "BRL", MX: "MXN", CH: "CHF", RU: "RUB", ZA: "ZAR",
  SG: "SGD", HK: "HKD", TW: "TWD", TH: "THB", ID: "IDR", MY: "MYR", PH: "PHP",
  VN: "VND", TR: "TRY", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", IL: "ILS",
  EG: "EGP", MA: "MAD", NG: "NGN", KE: "KES", GH: "GHS", AR: "ARS", CL: "CLP",
  CO: "COP", PE: "PEN", UY: "UYU", SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", UA: "UAH", PK: "PKR",
  BD: "BDT", LK: "LKR", NP: "NPR",
  // Eurozone
  AT: "EUR", BE: "EUR", HR: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
  DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR",
  MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR",
};

// Countries that use Fahrenheit / miles day-to-day.
const FAHRENHEIT_CC = new Set(["US", "BS", "BZ", "KY", "PW", "FM", "MH", "LR"]);
const MILES_CC = new Set(["US", "GB", "LR", "MM"]);

// Language codes the app supports (LanguageStep). Base-subtag match; default 'en'.
const SUPPORTED_LANGS = new Set([
  "en", "ar", "bn", "cs", "da", "nl", "fi", "fr", "de", "el", "he", "hi", "hu",
  "id", "it", "ja", "ko", "ms", "no", "pl", "pt", "ro", "ru", "es", "sv", "th",
  "tr", "uk", "vi",
]);

function inferLanguage() {
  try {
    const loc = (navigator.language || navigator.languages?.[0] || "en").toLowerCase();
    if (loc.startsWith("zh")) {
      return /tw|hant|hk|mo/.test(loc) ? "zh-TW" : "zh-CN";
    }
    const base = loc.split("-")[0];
    return SUPPORTED_LANGS.has(base) ? base : "en";
  } catch {
    return "en";
  }
}

// Returns { currency, language, tempUnit ('F'|'C'), distanceUnit ('mi'|'km') }.
// Pass the home-country NAME (or null). Language always comes from the device.
export function inferProfileDefaults(homeCountryName) {
  const cc = homeCountryName ? CODE_BY_NAME[homeCountryName] : null;
  return {
    currency: (cc && CURRENCY_BY_CC[cc]) || "USD",
    language: inferLanguage(),
    tempUnit: cc && FAHRENHEIT_CC.has(cc) ? "F" : "C",
    distanceUnit: cc && MILES_CC.has(cc) ? "mi" : "km",
  };
}
