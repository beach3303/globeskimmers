import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { searchCountries } from "@/lib/countries";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, User, Mail, Edit3, Check, Globe, DollarSign, Languages, Thermometer, Shield, Loader2, MessageCircle, MapPin, ChevronRight, ChevronDown, Search, BarChart3, RefreshCw, CreditCard, LogOut } from "lucide-react";
import ContactUsModal from "../components/ContactUsModal";
import RefreshAccessModal from "../components/RefreshAccessModal";
import { ADMIN_EMAILS } from "@/lib/admins";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

// ADMIN_EMAILS now imported from @/lib/admins (single source of truth, 4 admins).

// iPad editorial design tokens (design handoff: "Settings · iPad"). Mirrors the
// shipped PlacesToEat / CultureInformation token block so this page joins the
// same editorial system. The font stack is loaded in index.html.
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_IVORY2 = "#EFE8D9", ED_RULE = "rgba(22,17,13,.10)";
// Respect the app-wide text-scale variable, with a safe 1 fallback.
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// ── iPad editorial settings primitives (tablet-only presentation) ───────────
// A settings group: JetBrains-Mono UPPERCASE kicker over a soft-white rounded
// card whose rows are separated by the editorial hairline rule.
function EdGroup({ kicker, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <p
        className="uppercase"
        style={{ fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".14em", color: ED_INK3, margin: "0 6px 12px" }}
      >
        {kicker}
      </p>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          overflow: "hidden",
          border: `1px solid ${ED_RULE}`,
          boxShadow: "0 16px 40px -28px rgba(22,17,13,.4)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// A single settings row: icon chip + serif/strong label + description, with an
// optional control on the right. Last-of-type drops the hairline via `last`.
function EdRow({ icon: Icon, iconBg, title, desc, control, last }) {
  return (
    <div
      className="flex items-center gap-4"
      style={{ padding: "20px 24px", borderBottom: last ? "none" : `1px solid ${ED_RULE}` }}
    >
      {Icon && (
        <div
          className="flex items-center justify-center flex-none"
          style={{ width: 44, height: 44, borderRadius: 13, background: iconBg, color: "#fff" }}
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(20), color: ED_INK, lineHeight: 1.1 }}>{title}</p>
        {desc && <p style={{ fontSize: fs(13), color: ED_INK3, marginTop: 3, lineHeight: 1.35 }}>{desc}</p>}
        {/* Stacked controls (editable fields) live under the label. */}
        {control && control.below && <div style={{ marginTop: 12 }}>{control.node}</div>}
      </div>
      {control && !control.below && <div className="flex-none">{control.node}</div>}
    </div>
  );
}

// Editorial pill toggle — brand teal when on, ivory track when off.
function EdToggle({ on, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className="relative inline-flex items-center transition-colors flex-none"
      style={{ width: 56, height: 32, borderRadius: 999, background: on ? TEAL_DEEP : "#CFC7B8" }}
    >
      <span
        className="inline-block rounded-full bg-white transition-transform"
        style={{ width: 24, height: 24, marginLeft: 4, boxShadow: "0 2px 6px rgba(0,0,0,.25)", transform: on ? "translateX(24px)" : "translateX(0)" }}
      />
    </button>
  );
}

// The read-only "value" pill used in non-editing rows (serif strong text).
function EdValue({ children }) {
  return <span className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(17), color: ED_INK2 }}>{children}</span>;
}


const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", flag: "🇨🇭" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "MXN", name: "Mexican Peso", symbol: "$", flag: "🇲🇽" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", flag: "🇸🇦" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
].sort((a, b) => a.name.localeCompare(b.name));
CURRENCIES.push({ code: "OTHER", name: "Not Listed", symbol: "—", flag: "🌍" });

const LANGUAGES = [
  { code: "af", name: "Afrikaans", flag: "🇿🇦" },
  { code: "ak", name: "Akan", flag: "🇬🇭" },
  { code: "sq", name: "Albanian", flag: "🇦🇱" },
  { code: "am", name: "Amharic", flag: "🇪🇹" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "ar-eg", name: "Arabic (Egyptian)", flag: "🇪🇬" },
  { code: "ar-ma", name: "Arabic (Moroccan)", flag: "🇲🇦" },
  { code: "ar-lb", name: "Arabic (Lebanese)", flag: "🇱🇧" },
  { code: "ar-iq", name: "Arabic (Iraqi)", flag: "🇮🇶" },
  { code: "ar-sy", name: "Arabic (Syrian)", flag: "🇸🇾" },
  { code: "ar-tn", name: "Arabic (Tunisian)", flag: "🇹🇳" },
  { code: "ar-dz", name: "Arabic (Algerian)", flag: "🇩🇿" },
  { code: "ar-jo", name: "Arabic (Jordanian)", flag: "🇯🇴" },
  { code: "ar-ae", name: "Arabic (Gulf)", flag: "🇦🇪" },
  { code: "ar-sd", name: "Arabic (Sudanese)", flag: "🇸🇩" },
  { code: "hy", name: "Armenian", flag: "🇦🇲" },
  { code: "as", name: "Assamese", flag: "🇮🇳" },
  { code: "ay", name: "Aymara", flag: "🇧🇴" },
  { code: "az", name: "Azerbaijani", flag: "🇦🇿" },
  { code: "bm", name: "Bambara", flag: "🇲🇱" },
  { code: "eu", name: "Basque", flag: "🇪🇸" },
  { code: "be", name: "Belarusian", flag: "🇧🇾" },
  { code: "bn", name: "Bengali", flag: "🇧🇩" },
  { code: "bn-in", name: "Bengali (Indian)", flag: "🇮🇳" },
  { code: "bh", name: "Bhojpuri", flag: "🇮🇳" },
  { code: "bi", name: "Bislama", flag: "🇻🇺" },
  { code: "bs", name: "Bosnian", flag: "🇧🇦" },
  { code: "br", name: "Breton", flag: "🇫🇷" },
  { code: "bg", name: "Bulgarian", flag: "🇧🇬" },
  { code: "my", name: "Burmese", flag: "🇲🇲" },
  { code: "yue", name: "Cantonese", flag: "🇭🇰" },
  { code: "ca", name: "Catalan", flag: "🇪🇸" },
  { code: "ceb", name: "Cebuano", flag: "🇵🇭" },
  { code: "ny", name: "Chichewa", flag: "🇲🇼" },
  { code: "zh", name: "Chinese (Mandarin)", flag: "🇨🇳" },
  { code: "zh-tw", name: "Chinese (Traditional)", flag: "🇹🇼" },
  { code: "zh-hk", name: "Chinese (Hong Kong)", flag: "🇭🇰" },
  { code: "zh-sg", name: "Chinese (Singaporean)", flag: "🇸🇬" },
  { code: "co", name: "Corsican", flag: "🇫🇷" },
  { code: "cr", name: "Cree", flag: "🇨🇦" },
  { code: "hr", name: "Croatian", flag: "🇭🇷" },
  { code: "cs", name: "Czech", flag: "🇨🇿" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "prs", name: "Dari", flag: "🇦🇫" },
  { code: "dv", name: "Dhivehi", flag: "🇲🇻" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "nl-be", name: "Dutch (Flemish)", flag: "🇧🇪" },
  { code: "dz", name: "Dzongkha", flag: "🇧🇹" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "en-us", name: "English (American)", flag: "🇺🇸" },
  { code: "en-au", name: "English (Australian)", flag: "🇦🇺" },
  { code: "en-ca", name: "English (Canadian)", flag: "🇨🇦" },
  { code: "en-in", name: "English (Indian)", flag: "🇮🇳" },
  { code: "en-ie", name: "English (Irish)", flag: "🇮🇪" },
  { code: "en-nz", name: "English (New Zealand)", flag: "🇳🇿" },
  { code: "en-sg", name: "English (Singaporean)", flag: "🇸🇬" },
  { code: "en-za", name: "English (South African)", flag: "🇿🇦" },
  { code: "en-ph", name: "English (Philippine)", flag: "🇵🇭" },
  { code: "eo", name: "Esperanto", flag: "🌍" },
  { code: "et", name: "Estonian", flag: "🇪🇪" },
  { code: "ee", name: "Ewe", flag: "🇬🇭" },
  { code: "fo", name: "Faroese", flag: "🇫🇴" },
  { code: "fj", name: "Fijian", flag: "🇫🇯" },
  { code: "fil", name: "Filipino (Tagalog)", flag: "🇵🇭" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "fr-be", name: "French (Belgian)", flag: "🇧🇪" },
  { code: "fr-ca", name: "French (Canadian)", flag: "🇨🇦" },
  { code: "fr-ch", name: "French (Swiss)", flag: "🇨🇭" },
  { code: "fr-sn", name: "French (Senegalese)", flag: "🇸🇳" },
  { code: "fr-ci", name: "French (Ivorian)", flag: "🇨🇮" },
  { code: "fy", name: "Frisian", flag: "🇳🇱" },
  { code: "ff", name: "Fula", flag: "🇬🇳" },
  { code: "gl", name: "Galician", flag: "🇪🇸" },
  { code: "ka", name: "Georgian", flag: "🇬🇪" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "de-at", name: "German (Austrian)", flag: "🇦🇹" },
  { code: "de-ch", name: "German (Swiss)", flag: "🇨🇭" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "gn", name: "Guarani", flag: "🇵🇾" },
  { code: "gu", name: "Gujarati", flag: "🇮🇳" },
  { code: "ht", name: "Haitian Creole", flag: "🇭🇹" },
  { code: "ha", name: "Hausa", flag: "🇳🇬" },
  { code: "haw", name: "Hawaiian", flag: "🇺🇸" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "hil", name: "Hiligaynon", flag: "🇵🇭" },
  { code: "hmn", name: "Hmong", flag: "🇱🇦" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺" },
  { code: "is", name: "Icelandic", flag: "🇮🇸" },
  { code: "ig", name: "Igbo", flag: "🇳🇬" },
  { code: "ilo", name: "Ilocano", flag: "🇵🇭" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "iu", name: "Inuktitut", flag: "🇨🇦" },
  { code: "ga", name: "Irish (Gaeilge)", flag: "🇮🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "it-ch", name: "Italian (Swiss)", flag: "🇨🇭" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "jv", name: "Javanese", flag: "🇮🇩" },
  { code: "kn", name: "Kannada", flag: "🇮🇳" },
  { code: "ks", name: "Kashmiri", flag: "🇮🇳" },
  { code: "kk", name: "Kazakh", flag: "🇰🇿" },
  { code: "km", name: "Khmer", flag: "🇰🇭" },
  { code: "rw", name: "Kinyarwanda", flag: "🇷🇼" },
  { code: "rn", name: "Kirundi", flag: "🇧🇮" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ku", name: "Kurdish (Kurmanji)", flag: "🇮🇶" },
  { code: "ckb", name: "Kurdish (Sorani)", flag: "🇮🇶" },
  { code: "ky", name: "Kyrgyz", flag: "🇰🇬" },
  { code: "lo", name: "Lao", flag: "🇱🇦" },
  { code: "la", name: "Latin", flag: "🇻🇦" },
  { code: "lv", name: "Latvian", flag: "🇱🇻" },
  { code: "ln", name: "Lingala", flag: "🇨🇩" },
  { code: "lt", name: "Lithuanian", flag: "🇱🇹" },
  { code: "lg", name: "Luganda", flag: "🇺🇬" },
  { code: "lb", name: "Luxembourgish", flag: "🇱🇺" },
  { code: "mk", name: "Macedonian", flag: "🇲🇰" },
  { code: "mg", name: "Malagasy", flag: "🇲🇬" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "ms-sg", name: "Malay (Singaporean)", flag: "🇸🇬" },
  { code: "ml", name: "Malayalam", flag: "🇮🇳" },
  { code: "mt", name: "Maltese", flag: "🇲🇹" },
  { code: "gv", name: "Manx", flag: "🇮🇲" },
  { code: "mi", name: "Māori", flag: "🇳🇿" },
  { code: "mr", name: "Marathi", flag: "🇮🇳" },
  { code: "mh", name: "Marshallese", flag: "🇲🇭" },
  { code: "mn", name: "Mongolian", flag: "🇲🇳" },
  { code: "nah", name: "Nahuatl", flag: "🇲🇽" },
  { code: "ne", name: "Nepali", flag: "🇳🇵" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "nb", name: "Norwegian (Bokmål)", flag: "🇳🇴" },
  { code: "nn", name: "Norwegian (Nynorsk)", flag: "🇳🇴" },
  { code: "oc", name: "Occitan", flag: "🇫🇷" },
  { code: "or", name: "Odia (Oriya)", flag: "🇮🇳" },
  { code: "om", name: "Oromo", flag: "🇪🇹" },
  { code: "ps", name: "Pashto", flag: "🇦🇫" },
  { code: "fa", name: "Persian (Farsi)", flag: "🇮🇷" },
  { code: "fa-af", name: "Persian (Dari)", flag: "🇦🇫" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "pt-br", name: "Portuguese (Brazilian)", flag: "🇧🇷" },
  { code: "pt-mz", name: "Portuguese (Mozambican)", flag: "🇲🇿" },
  { code: "pt-ao", name: "Portuguese (Angolan)", flag: "🇦🇴" },
  { code: "pa", name: "Punjabi", flag: "🇮🇳" },
  { code: "pa-pk", name: "Punjabi (Pakistani)", flag: "🇵🇰" },
  { code: "qu", name: "Quechua", flag: "🇵🇪" },
  { code: "ro", name: "Romanian", flag: "🇷🇴" },
  { code: "ro-md", name: "Romanian (Moldovan)", flag: "🇲🇩" },
  { code: "rm", name: "Romansh", flag: "🇨🇭" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "sm", name: "Samoan", flag: "🇼🇸" },
  { code: "sg", name: "Sango", flag: "🇨🇫" },
  { code: "sa", name: "Sanskrit", flag: "🇮🇳" },
  { code: "gd", name: "Scottish Gaelic", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { code: "sr", name: "Serbian", flag: "🇷🇸" },
  { code: "sn", name: "Shona", flag: "🇿🇼" },
  { code: "sd", name: "Sindhi", flag: "🇵🇰" },
  { code: "si", name: "Sinhala", flag: "🇱🇰" },
  { code: "sk", name: "Slovak", flag: "🇸🇰" },
  { code: "sl", name: "Slovenian", flag: "🇸🇮" },
  { code: "so", name: "Somali", flag: "🇸🇴" },
  { code: "st", name: "Sotho (Southern)", flag: "🇱🇸" },
  { code: "nso", name: "Sotho (Northern/Sepedi)", flag: "🇿🇦" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "es-mx", name: "Spanish (Mexican)", flag: "🇲🇽" },
  { code: "es-ar", name: "Spanish (Argentine)", flag: "🇦🇷" },
  { code: "es-co", name: "Spanish (Colombian)", flag: "🇨🇴" },
  { code: "es-cl", name: "Spanish (Chilean)", flag: "🇨🇱" },
  { code: "es-pe", name: "Spanish (Peruvian)", flag: "🇵🇪" },
  { code: "es-ve", name: "Spanish (Venezuelan)", flag: "🇻🇪" },
  { code: "es-cu", name: "Spanish (Cuban)", flag: "🇨🇺" },
  { code: "es-gt", name: "Spanish (Guatemalan)", flag: "🇬🇹" },
  { code: "es-do", name: "Spanish (Dominican)", flag: "🇩🇴" },
  { code: "es-us", name: "Spanish (US)", flag: "🇺🇸" },
  { code: "es-pr", name: "Spanish (Puerto Rican)", flag: "🇵🇷" },
  { code: "su", name: "Sundanese", flag: "🇮🇩" },
  { code: "sw", name: "Swahili", flag: "🇰🇪" },
  { code: "sw-tz", name: "Swahili (Tanzanian)", flag: "🇹🇿" },
  { code: "ss", name: "Swati", flag: "🇸🇿" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "tl", name: "Tagalog", flag: "🇵🇭" },
  { code: "tg", name: "Tajik", flag: "🇹🇯" },
  { code: "ta", name: "Tamil", flag: "🇮🇳" },
  { code: "ta-lk", name: "Tamil (Sri Lankan)", flag: "🇱🇰" },
  { code: "ta-sg", name: "Tamil (Singaporean)", flag: "🇸🇬" },
  { code: "ta-my", name: "Tamil (Malaysian)", flag: "🇲🇾" },
  { code: "tt", name: "Tatar", flag: "🇷🇺" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "tet", name: "Tetum", flag: "🇹🇱" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "bo", name: "Tibetan", flag: "🇨🇳" },
  { code: "ti", name: "Tigrinya", flag: "🇪🇷" },
  { code: "to", name: "Tongan", flag: "🇹🇴" },
  { code: "ts", name: "Tsonga", flag: "🇿🇦" },
  { code: "tn", name: "Tswana", flag: "🇧🇼" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "tk", name: "Turkmen", flag: "🇹🇲" },
  { code: "tw", name: "Twi", flag: "🇬🇭" },
  { code: "ug", name: "Uyghur", flag: "🇨🇳" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "ur", name: "Urdu", flag: "🇵🇰" },
  { code: "uz", name: "Uzbek", flag: "🇺🇿" },
  { code: "ve", name: "Venda", flag: "🇿🇦" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "cy", name: "Welsh", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "wo", name: "Wolof", flag: "🇸🇳" },
  { code: "xh", name: "Xhosa", flag: "🇿🇦" },
  { code: "yi", name: "Yiddish", flag: "🇮🇱" },
  { code: "yo", name: "Yoruba", flag: "🇳🇬" },
  { code: "zu", name: "Zulu", flag: "🇿🇦" },
].sort((a, b) => a.name.localeCompare(b.name));

const showToast = (message, type) => {
  console.log(`Toast (${type}): ${message}`);
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet(); // gates the iPad editorial layout; phone untouched
  const { logout, profile, user: authUser, refreshProfile } = useAuth(); // Supabase
  const countryBoxRef = useRef(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [showHomeCountryInfo, setShowHomeCountryInfo] = useState(false);
  const [showHomeFlag, setShowHomeFlag] = useState(false);
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  // primary_banking_currency = currency of the bank account / card the user
  // will actually withdraw FROM at ATMs. Distinct from preferred_currencies
  // (which is a DISPLAY preference). The spec is explicit these should not
  // be conflated — nationality is NOT a reliable proxy for banking currency.
  const [primaryBankingCurrency, setPrimaryBankingCurrency] = useState("USD");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [preferredTempScale, setPreferredTempScale] = useState("fahrenheit");
  const [preferredDistanceUnit, setPreferredDistanceUnit] = useState("km");
  const [showContactUs, setShowContactUs] = useState(false);
  const [showRefreshAccess, setShowRefreshAccess] = useState(false);

  // Profile lives in the Supabase `profiles` row (loaded by AuthContext). Reshape
  // it into the Base44-style `user` object the display JSX already reads, and seed
  // the editable fields. Re-runs whenever the profile changes (e.g. after a save
  // calls refreshProfile()), so Home and Settings stay in sync. Field-seeding is
  // skipped while editing so an async refresh can't clobber in-progress edits.
  useEffect(() => {
    if (!profile && !authUser) return;
    setUser({
      email: authUser?.email || "",
      first_name: profile?.first_name || "",
      full_name: profile?.first_name || "",
      home_country: profile?.home_country || "",
      show_home_flag: !!profile?.show_home_flag,
      show_home_country_info: !!profile?.show_home_country_info,
      preferred_currencies: [profile?.preferred_currency || "USD"],
      primary_banking_currency: profile?.primary_banking_currency || profile?.preferred_currency || "USD",
      preferred_language: profile?.preferred_language || "en",
      preferred_temperature_scale: profile?.temp_unit === "C" ? "celsius" : "fahrenheit",
      preferred_distance_unit: profile?.distance_unit === "mi" ? "miles" : "km",
    });
    if (!editing) {
      setFirstName(profile?.first_name || "");
      setHomeCountry(profile?.home_country || "");
      setPreferredCurrency(profile?.preferred_currency || "USD");
      setPrimaryBankingCurrency(profile?.primary_banking_currency || profile?.preferred_currency || "USD");
      setPreferredLanguage(profile?.preferred_language || "en");
      setPreferredTempScale(profile?.temp_unit === "C" ? "celsius" : "fahrenheit");
      setPreferredDistanceUnit(profile?.distance_unit === "mi" ? "miles" : "km");
      setShowHomeCountryInfo(!!profile?.show_home_country_info);
      setShowHomeFlag(!!profile?.show_home_flag);
    }
    setLoading(false);
  }, [profile, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the home-country dropdown when tapping outside it.
  useEffect(() => {
    if (!countryOpen) return;
    const onDoc = (e) => { if (countryBoxRef.current && !countryBoxRef.current.contains(e.target)) setCountryOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, [countryOpen]);

  const handleSave = async () => {
    if (!authUser?.id) { showToast("Not signed in.", "error"); return; }
    setSaving(true);
    try {
      // Write to the Supabase profiles row using the SCHEMA's column names/values
      // (singular preferred_currency; temp_unit 'C'/'F'; distance_unit 'mi'/'km')
      // — exactly what Home + the ATM calculator read, so the home page updates.
      const update = {
        first_name: firstName.trim(),
        home_country: homeCountry,
        show_home_flag: showHomeFlag,
        show_home_country_info: showHomeCountryInfo,
        preferred_currency: preferredCurrency,
        primary_banking_currency: primaryBankingCurrency,
        preferred_language: preferredLanguage,
        temp_unit: preferredTempScale === "celsius" ? "C" : "F",
        distance_unit: preferredDistanceUnit === "miles" ? "mi" : "km",
      };
      const { error } = await supabase.from("profiles").update(update).eq("id", authUser.id);
      if (error) throw error;
      setEditing(false);
      await refreshProfile(); // re-pull profile → Home + Settings reflect the change
      showToast("✅ Profile updated successfully!", "success");
    } catch (error) {
      console.error("Error saving profile:", error);
      showToast("Failed to update profile. Please try again.", "error");
    }
    setSaving(false);
  };

  // Guard against `user.email` being undefined. Reported as a white
  // screen on Settings: `user.email.toLowerCase()` threw a TypeError
  // when user was truthy but the email field was missing (can happen
  // in Capacitor builds where the SDK occasionally hands back a
  // partial user object during the auth handshake). React with no
  // error boundary in this tree renders nothing — exactly the symptom.
  // Optional-chain it so a missing email just means "not admin".
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

  if (loading) {
    return (<div className="min-h-screen bg-gradient-to-b from-[#f7fafc] to-[#e2e8f0] flex items-center justify-center"><div className="w-16 h-16 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div></div>);
  }

  // Cancel handler shared by the editorial layout's Edit toolbar (reverts the
  // in-progress edits to the last-saved `user` snapshot — identical logic to
  // the phone Cancel buttons, just referenced from one place).
  const cancelEdit = () => {
    setEditing(false);
    setFirstName(user?.first_name || "");
    setHomeCountry(user?.home_country || "");
    setShowHomeCountryInfo(user?.show_home_country_info || false);
    setShowHomeFlag(user?.show_home_flag || false);
    setPreferredCurrency(user?.preferred_currencies?.[0] || "USD");
    setPrimaryBankingCurrency(user?.primary_banking_currency || user?.preferred_currencies?.[0] || "USD");
    setPreferredLanguage(user?.preferred_language || "en");
    setPreferredTempScale(user?.preferred_temperature_scale || "fahrenheit");
    setPreferredDistanceUnit(user?.preferred_distance_unit || "km");
  };

  // ════════════════════════════════════════════════════════════════════════
  // iPad EDITORIAL LAYOUT — ivory canvas, ~1024 centered column, settings
  // grouped into soft-white rounded cards with mono UPPERCASE kickers, serif
  // row labels, hairline rules, and a brand-teal accent. Tablet-only; the phone
  // layout below is byte-identical. All state / handlers are shared.
  // ════════════════════════════════════════════════════════════════════════
  if (isTablet) {
    const countryDropdown = (
      <div className="relative" ref={countryBoxRef} style={{ minWidth: 280 }}>
        <button type="button" onClick={() => setCountryOpen((o) => !o)} className="w-full flex items-center justify-between text-left" style={{ height: 48, padding: "0 16px", borderRadius: 14, border: `1px solid ${ED_RULE}`, background: "#fff" }}>
          <span style={{ fontSize: fs(15), color: homeCountry ? ED_INK : ED_INK3 }}>{homeCountry || "Select your home country"}</span>
          <ChevronDown className="w-5 h-5" style={{ color: ED_INK3 }} />
        </button>
        {countryOpen && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden" style={{ borderRadius: 14, border: `1px solid ${ED_RULE}`, background: "#fff", boxShadow: "0 16px 40px -20px rgba(22,17,13,.45)" }}>
            <div className="flex items-center gap-2" style={{ padding: "10px 14px", borderBottom: `1px solid ${ED_RULE}` }}>
              <Search className="w-4 h-4" style={{ color: ED_INK3 }} />
              <input autoFocus value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} placeholder="Type a country (e.g. US, USA)…" className="flex-1 outline-none bg-transparent" style={{ fontSize: fs(14), color: ED_INK }} />
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {searchCountries(countryQuery).map((c) => (
                <button key={c.code} type="button" onClick={() => { setHomeCountry(c.name); setCountryOpen(false); setCountryQuery(""); }} className="w-full text-left flex items-center justify-between" style={{ padding: "10px 16px", background: c.name === homeCountry ? ED_IVORY2 : "transparent" }}>
                  <span style={{ fontSize: fs(14), color: ED_INK }}>{c.name}</span>
                  {c.name === homeCountry && <Check className="w-4 h-4" style={{ color: TEAL_DEEP }} />}
                </button>
              ))}
              {searchCountries(countryQuery).length === 0 && (<div style={{ padding: "12px 16px", fontSize: fs(13), color: ED_INK3 }}>No match</div>)}
            </div>
          </div>
        )}
      </div>
    );

    const navItems = [
      { show: true, onClick: () => navigate(createPageUrl("SavedLocations")), icon: MapPin, bg: CAT.money.ink, title: "Saved Locations", desc: "Manage your favorite places" },
      { show: isAdmin, onClick: () => navigate(createPageUrl("AdminDashboard")), icon: Shield, bg: CAT.shopping.ink, title: "Admin Portal", desc: "Manage app and users" },
      { show: isAdmin, onClick: () => navigate(createPageUrl("AdminAnalytics")), icon: BarChart3, bg: CAT.transit.ink, title: "Analytics", desc: "Page views, searches, zero-results" },
      { show: isAdmin, onClick: () => setShowRefreshAccess(true), icon: RefreshCw, bg: CAT.atm.ink, title: "Refresh Access", desc: "Grant the refresh button to users" },
      { show: true, onClick: () => setShowContactUs(true), icon: MessageCircle, bg: CAT.restroom.ink, title: "Contact Us", desc: "Get in touch with our team" },
    ].filter((n) => n.show);

    return (
      <div className="font-sans" style={{ background: IVORY, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1024, margin: "0 auto", padding: "20px 24px 64px" }}>
          {/* Header: back + sign-out, serif title + kicker subtitle */}
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(createPageUrl("Home"))} className="flex items-center justify-center transition-colors" style={{ width: 44, height: 44, borderRadius: 999, background: "#FFFFFF", border: `1px solid ${ED_RULE}` }} aria-label="Close settings">
              <X className="w-5 h-5" style={{ color: ED_INK }} />
            </button>
            <button onClick={logout} className="flex items-center gap-2 transition-colors" style={{ height: 44, padding: "0 20px", borderRadius: 999, background: "#FFFFFF", border: `1px solid ${ED_RULE}`, color: TEAL_DEEP, fontWeight: 600, fontSize: fs(14) }}>
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>

          <h1 style={{ fontFamily: ED_SERIF, fontSize: fs(52), lineHeight: 1, color: ED_INK, margin: "20px 0 6px" }}>Settings</h1>
          <p className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".14em", color: ED_INK3 }}>Tailor Globeskimmers to how you travel</p>

          {/* Profile card — brand-teal feature surface with Edit / Save-Cancel */}
          <div className="flex items-center gap-5" style={{ marginTop: 26, background: `linear-gradient(110deg, ${TEAL_DEEP}, #0A554E)`, color: "#fff", borderRadius: 24, padding: "26px 28px", boxShadow: "0 22px 48px -26px rgba(14,110,102,.6)" }}>
            <div className="flex items-center justify-center flex-none" style={{ width: 72, height: 72, borderRadius: 22, background: "rgba(255,255,255,.18)" }}>
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p style={{ fontFamily: ED_SERIF, fontSize: fs(32), lineHeight: 1 }}>{user?.first_name || user?.full_name || "Traveler"}</p>
              <p className="truncate" style={{ fontSize: fs(15), opacity: 0.9, marginTop: 5 }}>{user?.email}</p>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 flex-none" style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 999, padding: "12px 22px", fontSize: fs(15), fontWeight: 600 }}><Edit3 className="w-4 h-4" />Edit</button>
            ) : (
              <div className="flex items-center gap-2 flex-none">
                <button onClick={cancelEdit} style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "12px 18px", fontSize: fs(14), fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 disabled:opacity-50" style={{ background: "#fff", color: TEAL_DEEP, borderRadius: 999, padding: "12px 20px", fontSize: fs(14), fontWeight: 700 }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save</button>
              </div>
            )}
          </div>

          {/* Travel preferences group */}
          <EdGroup kicker="Travel preferences">
            <EdRow icon={Mail} iconBg={CAT.atm.ink} title="Email" desc="Your sign-in address" control={{ node: <EdValue>{user?.email}</EdValue> }} />
            <EdRow icon={User} iconBg={CAT.culture.ink} title="First Name" desc="Used to greet you across the app"
              control={editing
                ? { below: true, node: <Input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter your first name" className="h-12 rounded-xl" style={{ borderColor: ED_RULE }} /> }
                : { node: <EdValue>{user?.first_name || user?.full_name || "Not set"}</EdValue> }}
            />
            <EdRow icon={Globe} iconBg={CAT.restroom.ink} title="Home Country" desc="Sets your home flag & currency"
              control={editing
                ? { below: true, node: countryDropdown }
                : { node: <EdValue>{user?.home_country || "Not set"}</EdValue> }}
            />
            {editing && (
              <EdRow icon={Globe} iconBg={CAT.transit.ink} title="Show Home Country Time" desc="Display home country time on home page"
                control={{ node: <EdToggle on={showHomeCountryInfo} onClick={() => setShowHomeCountryInfo(!showHomeCountryInfo)} label="Toggle home country time" /> }}
              />
            )}
            {editing && (
              <EdRow icon={Globe} iconBg={CAT.weather.ink} title="Show Home Country Flag" desc="Display your flag on the home page card"
                control={{ node: <EdToggle on={showHomeFlag} onClick={() => setShowHomeFlag(!showHomeFlag)} label="Toggle home country flag" /> }}
                last
              />
            )}
          </EdGroup>

          {/* Currency & language group */}
          <EdGroup kicker="Currency & language">
            <EdRow icon={DollarSign} iconBg={CAT.money.ink} title="Preferred Currency" desc="How prices are displayed across the app"
              control={editing
                ? { below: true, node: (<Select value={preferredCurrency} onValueChange={setPreferredCurrency}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue placeholder="Select preferred currency" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{CURRENCIES.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.flag} {currency.name} ({currency.code})</SelectItem>))}</SelectContent></Select>) }
                : { node: <EdValue>{user?.preferred_currencies?.[0] ? CURRENCIES.find(c => c.code === user.preferred_currencies[0])?.name : "Not set"}</EdValue> }}
            />
            <EdRow icon={CreditCard} iconBg={CAT.atm.ink} title="Primary Banking Currency" desc="The currency of the bank account or card you'll use at ATMs"
              control={editing
                ? { below: true, node: (<Select value={primaryBankingCurrency} onValueChange={setPrimaryBankingCurrency}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue placeholder="Select banking currency" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{CURRENCIES.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.flag} {currency.name} ({currency.code})</SelectItem>))}</SelectContent></Select>) }
                : { node: <EdValue>{user?.primary_banking_currency ? (CURRENCIES.find(c => c.code === user.primary_banking_currency)?.name || user.primary_banking_currency) : "Not set"}</EdValue> }}
            />
            <EdRow icon={Languages} iconBg={CAT.transit.ink} title="Preferred Language" desc="Translates menus, signs & phrases"
              control={editing
                ? { below: true, node: (<Select value={preferredLanguage} onValueChange={setPreferredLanguage}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue placeholder="Select preferred language" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{LANGUAGES.map((language) => (<SelectItem key={language.code} value={language.code}>{language.flag} {language.name}</SelectItem>))}</SelectContent></Select>) }
                : { node: <EdValue>{LANGUAGES.find(l => l.code === user?.preferred_language)?.name || "Not set"}</EdValue> }}
              last
            />
          </EdGroup>

          {/* Units group */}
          <EdGroup kicker="Units">
            <EdRow icon={Thermometer} iconBg={CAT.weather.ink} title="Temperature Scale" desc="Used across Weather & finders"
              control={editing
                ? { below: true, node: (<Select value={preferredTempScale} onValueChange={setPreferredTempScale}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="celsius">Celsius (°C)</SelectItem><SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem></SelectContent></Select>) }
                : { node: <EdValue>{user?.preferred_temperature_scale === 'celsius' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}</EdValue> }}
            />
            <EdRow icon={MapPin} iconBg={CAT.money.ink} title="Distance Unit" desc="Used across all finders"
              control={editing
                ? { below: true, node: (<Select value={preferredDistanceUnit} onValueChange={setPreferredDistanceUnit}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="km">Kilometers (km)</SelectItem><SelectItem value="miles">Miles (mi)</SelectItem></SelectContent></Select>) }
                : { node: <EdValue>{user?.preferred_distance_unit === 'miles' ? 'Miles (mi)' : 'Kilometers (km)'}</EdValue> }}
              last
            />
          </EdGroup>

          {/* Account & navigation group */}
          <EdGroup kicker="Account">
            {navItems.map((n) => (
              <button key={n.title} onClick={n.onClick} className="w-full flex items-center gap-4 text-left transition-colors" style={{ padding: "20px 24px", borderBottom: `1px solid ${ED_RULE}` }}>
                <div className="flex items-center justify-center flex-none" style={{ width: 44, height: 44, borderRadius: 13, background: n.bg, color: "#fff" }}><n.icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(20), color: ED_INK, lineHeight: 1.1 }}>{n.title}</p>
                  <p style={{ fontSize: fs(13), color: ED_INK3, marginTop: 3, lineHeight: 1.35 }}>{n.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 flex-none" style={{ color: ED_INK3, opacity: 0.6 }} />
              </button>
            ))}
            <button onClick={logout} className="w-full flex items-center justify-center gap-3 transition-colors" style={{ padding: "20px 24px" }}>
              <LogOut className="w-5 h-5" style={{ color: TEAL_DEEP }} />
              <span className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(19), color: TEAL_DEEP }}>Sign Out</span>
            </button>
          </EdGroup>

          <p className="text-center" style={{ marginTop: 32, fontFamily: ED_MONO, fontSize: fs(11), letterSpacing: ".08em", color: ED_INK3, textTransform: "uppercase" }}>Made for travelers worldwide · © 2025 Globeskimmers</p>
        </div>

        <ContactUsModal isOpen={showContactUs} onClose={() => setShowContactUs(false)} />
        <RefreshAccessModal isOpen={showRefreshAccess} onClose={() => setShowRefreshAccess(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7fafc] via-[#eef2ff] to-[#f3e8ff]">
      <div className="relative bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10"><div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-center justify-between mb-4">
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all shadow-lg active:scale-95"><X className="w-6 h-6" /></button>
          <button onClick={logout} className="flex items-center gap-2 px-4 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white font-semibold text-[calc(13px*var(--fs))] transition-all shadow-lg active:scale-95"><LogOut className="w-4 h-4" />Sign Out</button>
        </div>
        <div className="relative z-10"><h1 className="text-[calc(32px*var(--fs))] font-extrabold mb-2 tracking-tight">Settings</h1><p className="text-[calc(15px*var(--fs))] text-white/90">Manage your account and preferences</p></div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 pb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-6 mb-6 border border-white/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-lg"><User className="w-6 h-6 text-white" /></div>
              <h2 className="text-[calc(22px*var(--fs))] font-bold text-gray-900">Profile</h2>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-md"><Edit3 className="w-4 h-4" />Edit</button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setEditing(false); setFirstName(user?.first_name || ""); setHomeCountry(user?.home_country || ""); setShowHomeCountryInfo(user?.show_home_country_info || false); setShowHomeFlag(user?.show_home_flag || false); setPreferredCurrency(user?.preferred_currencies?.[0] || "USD"); setPrimaryBankingCurrency(user?.primary_banking_currency || user?.preferred_currencies?.[0] || "USD"); setPreferredLanguage(user?.preferred_language || "en"); setPreferredTempScale(user?.preferred_temperature_scale || "fahrenheit"); setPreferredDistanceUnit(user?.preferred_distance_unit || "km"); }} className="px-2.5 py-1.5 text-xs text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-2.5 py-1.5 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}Save</button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><Mail className="w-4 h-4" />Email</label><div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-700 font-medium border border-gray-200">{user?.email}</div></div>

            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><User className="w-4 h-4" />First Name</label>
              {editing ? (<Input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter your first name" className="h-12 rounded-xl border-gray-300 focus:border-[#667eea] focus:ring-[#667eea]" />) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.first_name || user?.full_name || "Not set"}</div>)}
            </div>

            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><Globe className="w-4 h-4" />Home Country</label>
              {editing ? (
                <div className="relative" ref={countryBoxRef}>
                  <button type="button" onClick={() => setCountryOpen((o) => !o)} className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white flex items-center justify-between text-left">
                    <span className={homeCountry ? "text-gray-900 font-medium" : "text-gray-400"}>{homeCountry || "Select your home country"}</span>
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </button>
                  {countryOpen && (
                    <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input autoFocus value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} placeholder="Type a country (e.g. US, USA)…" className="flex-1 outline-none bg-transparent text-gray-900 text-[calc(14px*var(--fs))]" />
                      </div>
                      <div className="max-h-[260px] overflow-y-auto">
                        {searchCountries(countryQuery).map((c) => (
                          <button key={c.code} type="button" onClick={() => { setHomeCountry(c.name); setCountryOpen(false); setCountryQuery(""); }} className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between ${c.name === homeCountry ? "bg-indigo-50" : ""}`}>
                            <span className="text-gray-900 text-[calc(14px*var(--fs))]">{c.name}</span>
                            {c.name === homeCountry && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                        ))}
                        {searchCountries(countryQuery).length === 0 && (<div className="px-4 py-3 text-gray-400 text-[calc(13px*var(--fs))]">No match</div>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.home_country || "Not set"}</div>)}
            </div>

            {editing && (<div className="flex items-center justify-between p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 shadow-sm"><div><p className="font-bold text-gray-900 text-[calc(15px*var(--fs))]">Show Home Country Time</p><p className="text-sm text-gray-600 mt-0.5">Display home country time on home page</p></div><button onClick={() => setShowHomeCountryInfo(!showHomeCountryInfo)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${showHomeCountryInfo ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2]' : 'bg-gray-300'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${showHomeCountryInfo ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>)}

            {editing && (<div className="flex items-center justify-between p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 shadow-sm"><div><p className="font-bold text-gray-900 text-[calc(15px*var(--fs))]">Show Home Country Flag</p><p className="text-sm text-gray-600 mt-0.5">Display your flag on the home page card</p></div><button onClick={() => setShowHomeFlag(!showHomeFlag)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${showHomeFlag ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2]' : 'bg-gray-300'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${showHomeFlag ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>)}

            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><DollarSign className="w-4 h-4" />Preferred Currency</label>
              <p className="text-xs text-gray-500 -mt-1 mb-2">How prices are displayed across the app.</p>
              {editing ? (<Select value={preferredCurrency} onValueChange={setPreferredCurrency}><SelectTrigger className="h-12 rounded-xl border-gray-300"><SelectValue placeholder="Select preferred currency" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{CURRENCIES.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.flag} {currency.name} ({currency.code})</SelectItem>))}</SelectContent></Select>) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.preferred_currencies?.[0] ? CURRENCIES.find(c => c.code === user.preferred_currencies[0])?.name : "Not set"}</div>)}
            </div>

            {/* Primary banking currency — the currency of the bank account or
                card the user actually withdraws FROM at ATMs. Used by the ATM
                Finder Withdrawal Calculator to set the default "Withdraw From"
                currency. Distinct from Preferred Currency above per the ATM
                redesign spec. */}
            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><CreditCard className="w-4 h-4" />Primary Banking Currency</label>
              <p className="text-xs text-gray-500 -mt-1 mb-2">The currency of the bank account or card you'll use at ATMs.</p>
              {editing ? (<Select value={primaryBankingCurrency} onValueChange={setPrimaryBankingCurrency}><SelectTrigger className="h-12 rounded-xl border-gray-300"><SelectValue placeholder="Select banking currency" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{CURRENCIES.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.flag} {currency.name} ({currency.code})</SelectItem>))}</SelectContent></Select>) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.primary_banking_currency ? (CURRENCIES.find(c => c.code === user.primary_banking_currency)?.name || user.primary_banking_currency) : "Not set"}</div>)}
            </div>

            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><Languages className="w-4 h-4" />Preferred Language</label>
              {editing ? (<Select value={preferredLanguage} onValueChange={setPreferredLanguage}><SelectTrigger className="h-12 rounded-xl border-gray-300"><SelectValue placeholder="Select preferred language" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{LANGUAGES.map((language) => (<SelectItem key={language.code} value={language.code}>{language.flag} {language.name}</SelectItem>))}</SelectContent></Select>) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{LANGUAGES.find(l => l.code === user?.preferred_language)?.name || "Not set"}</div>)}
            </div>

            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><Thermometer className="w-4 h-4" />Temperature Scale</label>
              {editing ? (<Select value={preferredTempScale} onValueChange={setPreferredTempScale}><SelectTrigger className="h-12 rounded-xl border-gray-300"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="celsius">Celsius (°C)</SelectItem><SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem></SelectContent></Select>) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.preferred_temperature_scale === 'celsius' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}</div>)}
            </div>

            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><MapPin className="w-4 h-4" />Distance Unit</label>
              {editing ? (<Select value={preferredDistanceUnit} onValueChange={setPreferredDistanceUnit}><SelectTrigger className="h-12 rounded-xl border-gray-300"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="km">Kilometers (km)</SelectItem><SelectItem value="miles">Miles (mi)</SelectItem></SelectContent></Select>) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.preferred_distance_unit === 'miles' ? 'Miles (mi)' : 'Kilometers (km)'}</div>)}
            </div>

            {editing && (<div className="flex gap-2 pt-2">
              <button onClick={() => { setEditing(false); setFirstName(user?.first_name || ""); setHomeCountry(user?.home_country || ""); setShowHomeCountryInfo(user?.show_home_country_info || false); setShowHomeFlag(user?.show_home_flag || false); setPreferredCurrency(user?.preferred_currencies?.[0] || "USD"); setPrimaryBankingCurrency(user?.primary_banking_currency || user?.preferred_currencies?.[0] || "USD"); setPreferredLanguage(user?.preferred_language || "en"); setPreferredTempScale(user?.preferred_temperature_scale || "fahrenheit"); setPreferredDistanceUnit(user?.preferred_distance_unit || "km"); }} className="flex-1 px-4 py-3 text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save</button>
            </div>)}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3 mb-6">
          <button onClick={() => navigate(createPageUrl("SavedLocations"))} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><MapPin className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[calc(15px*var(--fs))] font-bold text-white">Saved Locations</p><p className="text-[calc(13px*var(--fs))] text-white/90">Manage your favorite places</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>
          {isAdmin && (<button onClick={() => navigate(createPageUrl("AdminDashboard"))} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><Shield className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[calc(15px*var(--fs))] font-bold text-white">Admin Portal</p><p className="text-[calc(13px*var(--fs))] text-white/90">Manage app and users</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>)}
          {isAdmin && (<button onClick={() => navigate(createPageUrl("AdminAnalytics"))} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><BarChart3 className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[calc(15px*var(--fs))] font-bold text-white">Analytics</p><p className="text-[calc(13px*var(--fs))] text-white/90">Page views, searches, zero-results</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>)}
          {isAdmin && (<button onClick={() => setShowRefreshAccess(true)} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><RefreshCw className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[calc(15px*var(--fs))] font-bold text-white">Refresh Access</p><p className="text-[calc(13px*var(--fs))] text-white/90">Grant the refresh button to users</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>)}
          <button onClick={() => setShowContactUs(true)} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><MessageCircle className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[calc(15px*var(--fs))] font-bold text-white">Contact Us</p><p className="text-[calc(13px*var(--fs))] text-white/90">Get in touch with our team</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>
          <button onClick={logout} className="w-full flex items-center justify-center gap-3 p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-all text-gray-700 font-medium"><LogOut className="w-5 h-5" /><span>Sign Out</span></button>
        </motion.div>

        <div className="mt-8 text-center text-sm text-gray-500 pb-8"><p className="font-medium">Made with ❤️ for travelers worldwide</p><p className="mt-2 text-xs">© 2025 Globeskimmers. All rights reserved.</p></div>
      </div>

      <ContactUsModal isOpen={showContactUs} onClose={() => setShowContactUs(false)} />
      <RefreshAccessModal isOpen={showRefreshAccess} onClose={() => setShowRefreshAccess(false)} />
    </div>
  );
}