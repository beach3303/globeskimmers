import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { searchHomeCities, resolveHomePlace } from "@/lib/homePlace";
import { searchCountries, countryCode } from "@/lib/countries";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, User, Mail, Check, Globe, DollarSign, Languages, Thermometer, Loader2, MessageCircle, MapPin, AtSign, ChevronRight, ChevronDown, Search, BarChart3, RefreshCw, CreditCard, LogOut, Trash2 } from "lucide-react";
import ContactUsModal from "../components/ContactUsModal";
import RefreshAccessModal from "../components/RefreshAccessModal";
import { ADMIN_EMAILS } from "@/lib/admins";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { CAT, TEAL_DEEP, IVORY } from "@/components/redesign/constants";
import { getHandle, setHandle } from "@/lib/passport";
import { useIsTablet } from "@/lib/useIsTablet";
import { useFontScale } from "@/components/a11y/FontScaleContext";
import { useLocation, readOpenBehavior, writeOpenBehavior } from "@/components/location/LocationContext";
import { clearAppCache } from "@/lib/clearAppCache";

// ADMIN_EMAILS now imported from @/lib/admins (single source of truth, 4 admins).

// iPad editorial design tokens (design handoff: "Settings · iPad"). Mirrors the
// shipped PlacesToEat / CultureInformation token block so this page joins the
// same editorial system. The font stack is loaded in index.html.
const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const ED_INK = "#16110D", ED_INK2 = "#3A3128", ED_INK3 = "#736657";
const ED_RULE = "rgba(22,17,13,.10)";
// Respect the app-wide text-scale variable, with a safe 1 fallback.
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// 2-line clamp for multi-line titles — combined with min-height (never a fixed
// height) so enlarging the text scale grows the element instead of clipping it.
const CLAMP_2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

// ── Editorial settings primitives (phone + tablet, phone-tuned via `isTablet`)
// A settings group: JetBrains-Mono UPPERCASE kicker over a soft-white rounded
// card whose rows are separated by the editorial hairline rule. Phone gets a
// tighter radius / kicker; tablet keeps its larger sizing.
function EdGroup({ kicker, children, isTablet }) {
  return (
    <div style={{ marginTop: isTablet ? 28 : 22 }}>
      <p
        className="uppercase"
        style={{ fontFamily: ED_MONO, fontSize: fs(isTablet ? 11 : 10), letterSpacing: ".14em", color: ED_INK3, margin: "0 6px 10px" }}
      >
        {kicker}
      </p>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: isTablet ? 24 : 20,
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
//
// Robust at every text-scale step: the right-hand VALUE (a non-`below` control —
// e.g. "Fahrenheit (°F)", "US Dollar") used to sit in a fixed left/right flex,
// so enlarging the glasses size made the long serif value collide with the
// title/description. We now adapt by `step` (from useFontScale): at the larger
// steps the row becomes a COLUMN and the value drops to its own full-width line
// under the title+desc; at small steps it stays side-by-side but is allowed to
// WRAP (items-start + flex-wrap) so the value can never overlap or get clipped.
// `below` controls (editable fields) always stack, unchanged.
function EdRow({ icon: Icon, iconBg, title, desc, control, last, isTablet, step = 0 }) {
  const chip = isTablet ? 44 : 38;
  // A side-value present at a large text size needs the stacked column layout so
  // the long value never crowds the title. Tablet has more room, so it only
  // stacks at the top step; phone stacks one step earlier. Fixed-width toggles
  // never overlap (the title wraps beside them), so they stay inline always.
  const sideValue = control && !control.below;
  const isToggle = sideValue && React.isValidElement(control.node) && control.node.type === EdToggle;
  const stack = sideValue && !isToggle && step >= (isTablet ? 3 : 2);
  return (
    <div
      className={stack ? "flex flex-col" : "flex flex-wrap items-start gap-x-4 gap-y-2"}
      style={{ padding: isTablet ? "20px 24px" : "16px 16px", minHeight: isTablet ? 84 : 70, borderBottom: last ? "none" : `1px solid ${ED_RULE}` }}
    >
      <div className={stack ? "flex items-start gap-4 w-full" : "flex items-start gap-4 flex-1 min-w-0"}>
        {Icon && (
          <div
            className="flex items-center justify-center flex-none"
            style={{ width: chip, height: chip, borderRadius: isTablet ? 13 : 11, background: iconBg, color: "#fff" }}
          >
            <Icon className={isTablet ? "w-5 h-5" : "w-[18px] h-[18px]"} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(isTablet ? 20 : 20), color: ED_INK, lineHeight: 1.1, ...CLAMP_2 }}>{title}</p>
          {desc && <p style={{ fontSize: fs(isTablet ? 13 : 13.5), color: ED_INK3, marginTop: 3, lineHeight: 1.35, ...CLAMP_2 }}>{desc}</p>}
          {/* Stacked controls (editable fields) live under the label. */}
          {control && control.below && <div style={{ marginTop: 12 }}>{control.node}</div>}
        </div>
      </div>
      {sideValue && (
        // When stacked, the value sits on its own full-width line under the label
        // (offset to align under the title, past the icon chip) and reads left.
        // When inline, it keeps its place at the right edge and is allowed to wrap.
        <div
          className={stack ? "min-w-0" : "flex-none min-w-0 max-w-[55%]"}
          style={stack ? { marginTop: 6, marginLeft: Icon ? chip + 16 : 0 } : undefined}
        >
          {/* When stacked, left-align the value (it now leads its own line). The
              value node is an <EdValue> that honours an `align` prop. */}
          {stack && React.isValidElement(control.node) && control.node.type === EdValue
            ? React.cloneElement(control.node, { align: "left" })
            : control.node}
        </div>
      )}
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
// `align` follows the row layout: right-aligned when the value sits inline at the
// row's right edge, left-aligned when the row has stacked it onto its own line.
// `block` + word-break let a long value (e.g. "South African Rand") wrap to a
// second line instead of overflowing — it grows the row height, never clips.
function EdValue({ children, align = "right" }) {
  return (
    <span
      className={`font-semibold block ${align === "left" ? "text-left" : "text-right"}`}
      style={{ fontFamily: ED_SERIF, fontSize: fs(16), color: ED_INK2, overflowWrap: "anywhere", ...CLAMP_2 }}
    >
      {children}
    </span>
  );
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
  // Toast surface intentionally no-op pending a real toast system.
  void message; void type;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet(); // gates the iPad editorial layout; phone untouched
  const { step: fontStep } = useFontScale(); // larger steps → rows stack value below
  const { autoFollow, setAutoFollow } = useLocation(); // silent auto-follow toggle (localStorage-backed)
  const [openBehavior, setOpenBehaviorState] = useState(() => readOpenBehavior()); // 'ask' | 'current' | 'continue'
  const [suggestArrivals, setSuggestArrivals] = useState(() => { try { return localStorage.getItem("pp_suggest_arrivals") !== "0"; } catch { return true; } });
  const [cityPrompt, setCityPrompt] = useState(() => { try { return localStorage.getItem("pp_city_prompt") !== "0"; } catch { return true; } });
  // Nearby-stamp sensing on the Passport page (default ON; the page has its own small switch too).
  const [suggestNearby, setSuggestNearby] = useState(() => { try { return localStorage.getItem("pp_suggest_nearby") !== "0"; } catch { return true; } });
  // Username (Social P0, 2026-09-29): claimed through the worker, 2 changes a
  // month. Empty until the traveler picks one; the social layer needs it.
  const [handle, setHandleState] = useState("");
  const [handleDraft, setHandleDraft] = useState("");
  const [handleBusy, setHandleBusy] = useState(false);
  useEffect(() => { (async () => { const { handle: h } = await getHandle(); if (h) { setHandleState(h); setHandleDraft(h); } })(); }, []);
  const saveHandle = async () => {
    const want = handleDraft.trim().toLowerCase();
    if (!want || want === handle) return;
    setHandleBusy(true);
    const { handle: h, error } = await setHandle(want);
    setHandleBusy(false);
    if (error) { showToast(error, "error"); return; }
    setHandleState(h); setHandleDraft(h);
    showToast(`You're @${h}`, "success");
  };

  const { logout, deleteAccount, profile, user: authUser, refreshProfile, canRefresh } = useAuth(); // Supabase
  const countryBoxRef = useRef(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  // Home CITY search (drives home_country + exact home_timezone). countryQuery is
  // reused as the search text; these hold the city results + async states.
  const [cityResults, setCityResults] = useState([]);
  const [citySearching, setCitySearching] = useState(false);
  const [cityResolving, setCityResolving] = useState(false);
  // Home COUNTRY picker (drives the home flag). Picking a home city still fills
  // the country in (last pick wins, visible in this row right above); the
  // traveler can then choose a different country here.
  const homeCountryBoxRef = useRef(null);
  const [homeCountryOpen, setHomeCountryOpen] = useState(false);
  const [homeCountryQuery, setHomeCountryQuery] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  // Guards the name input from being reseeded (clobbered) by an async profile
  // refresh while the user is mid-edit — everything auto-saves now, so refreshes
  // can land at any time.
  const firstNameFocused = useRef(false);
  const [homeCountry, setHomeCountry] = useState("");
  const [homeCity, setHomeCity] = useState("");
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
  // Account deletion (Apple 5.1.1(v) / Google Play in-app delete requirement)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
      home_city: profile?.home_city || "",
      show_home_flag: !!profile?.show_home_flag,
      show_home_country_info: !!profile?.show_home_country_info,
      preferred_currencies: [profile?.preferred_currency || "USD"],
      primary_banking_currency: profile?.primary_banking_currency || profile?.preferred_currency || "USD",
      preferred_language: profile?.preferred_language || "en",
      preferred_temperature_scale: profile?.temp_unit === "C" ? "celsius" : "fahrenheit",
      preferred_distance_unit: profile?.distance_unit === "mi" ? "miles" : "km",
    });
    // Seed editable fields from the profile. Everything auto-saves, so this also
    // runs after each save's refresh — values simply re-seed to what we saved.
    // Skip the name field while it's focused so a refresh can't clobber typing.
    if (!firstNameFocused.current) setFirstName(profile?.first_name || "");
    setHomeCountry(profile?.home_country || "");
    setHomeCity(profile?.home_city || "");
    setPreferredCurrency(profile?.preferred_currency || "USD");
    setPrimaryBankingCurrency(profile?.primary_banking_currency || profile?.preferred_currency || "USD");
    setPreferredLanguage(profile?.preferred_language || "en");
    setPreferredTempScale(profile?.temp_unit === "C" ? "celsius" : "fahrenheit");
    setPreferredDistanceUnit(profile?.distance_unit === "mi" ? "miles" : "km");
    setShowHomeCountryInfo(!!profile?.show_home_country_info);
    setShowHomeFlag(!!profile?.show_home_flag);
    setLoading(false);
  }, [profile, authUser]);

  // Close the home-country dropdown when tapping outside it.
  useEffect(() => {
    if (!countryOpen) return;
    const onDoc = (e) => { if (countryBoxRef.current && !countryBoxRef.current.contains(e.target)) setCountryOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, [countryOpen]);

  // Close the home-COUNTRY list when tapping outside it.
  useEffect(() => {
    if (!homeCountryOpen) return;
    const onDoc = (e) => { if (homeCountryBoxRef.current && !homeCountryBoxRef.current.contains(e.target)) setHomeCountryOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, [homeCountryOpen]);

  // Debounced home-city search while the picker is open.
  useEffect(() => {
    if (!countryOpen) return;
    const q = countryQuery.trim();
    if (q.length < 3) { setCityResults([]); setCitySearching(false); return; }
    setCitySearching(true);
    const t = setTimeout(async () => {
      const r = await searchHomeCities(q);
      setCityResults(r);
      setCitySearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [countryQuery, countryOpen]);

  // Pick a city → resolve its exact timezone, then set home fields (country from
  // the city drives the flag). Nothing persists until the user taps Save.
  const pickHomeCity = async (result) => {
    if (cityResolving) return;
    setCityResolving(true);
    const place = await resolveHomePlace(result);
    setCityResolving(false);
    setHomeCity(place.city);
    setHomeCountry(place.country);
    setCountryOpen(false);
    setCountryQuery("");
    setCityResults([]);
    persist({ home_city: place.city, home_country: place.country, home_lat: place.latitude, home_lng: place.longitude, home_timezone: place.timezone });
  };

  // Pick the home COUNTRY directly (the flag). Leaves the home city and its
  // coordinates/timezone untouched. Always saves: a city pick's own save may
  // still be in flight, so the loaded profile can be stale.
  const pickHomeCountry = (name) => {
    setHomeCountry(name);
    setHomeCountryOpen(false);
    setHomeCountryQuery("");
    persist({ home_country: name });
  };

  // Auto-save a PARTIAL profile update. Every editable control calls this on
  // change (selects/toggles) or blur (text) — there's no manual Save anymore, so
  // a toggle takes effect instantly without hunting for a Save button. Keeps the
  // pre-migration fallback that strips the home_* columns if they don't exist yet.
  const persist = async (patch) => {
    if (!authUser?.id) return;
    setSaving(true);
    try {
      let { error } = await supabase.from("profiles").update(patch).eq("id", authUser.id);
      if (error && /home_(city|lat|lng|timezone)/.test(error.message || "")) {
        const safe = { ...patch };
        delete safe.home_city; delete safe.home_lat; delete safe.home_lng; delete safe.home_timezone;
        ({ error } = await supabase.from("profiles").update(safe).eq("id", authUser.id));
      }
      if (error) throw error;
      await refreshProfile(); // re-pull so Home + Settings reflect the change
    } catch (e) {
      console.error("Auto-save failed:", e);
      showToast("Couldn't save — check your connection.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Permanently delete this account + all its data. On success AuthContext
  // clears the session, so App.jsx re-renders the signed-out gate and this
  // page unmounts (no need to reset `deleting`). On failure we surface the
  // error and keep the confirm dialog open so the user can retry or cancel.
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccount();
    } catch (e) {
      setDeleteError(e?.message || "Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
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

  // ════════════════════════════════════════════════════════════════════════
  // EDITORIAL LAYOUT — ivory canvas, settings grouped into soft-white rounded
  // cards with mono UPPERCASE kickers, serif row labels, hairline rules, and a
  // brand-teal accent. Renders at BOTH widths: tablet keeps the larger sizing
  // and ~1024 centered column; phone gets a phone-tuned, compact variant in the
  // existing single max-w-md column. All state / handlers are shared.
  // ════════════════════════════════════════════════════════════════════════
  // The country now has its own row, so the city field shows just the city.
  const homeCityLabel = homeCity || "";
  const homeCountryCode = countryCode(homeCountry);
  const countryMatches = homeCountryOpen ? searchCountries(homeCountryQuery) : [];
  const homeCountryDropdown = (
      <div className="relative w-full" ref={homeCountryBoxRef} style={{ minWidth: isTablet ? 280 : 0 }}>
        <button type="button" onClick={() => setHomeCountryOpen((o) => !o)} disabled={cityResolving} aria-expanded={homeCountryOpen} className="w-full flex items-center justify-between text-left" style={{ height: 48, padding: "0 16px", borderRadius: 14, border: `1px solid ${ED_RULE}`, background: "#fff", opacity: cityResolving ? 0.6 : 1 }}>
          <span className="flex items-center gap-2 min-w-0">
            {homeCountryCode && (
              <img key={homeCountryCode} src={`https://flagcdn.com/h40/${homeCountryCode.toLowerCase()}.png`} alt="" className="flex-none rounded-[2px]" style={{ height: 14, width: "auto", filter: "drop-shadow(0 0 0.5px rgba(22,17,13,.6))" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            <span className="truncate" style={{ fontSize: fs(15), color: homeCountry ? ED_INK : ED_INK3 }}>{homeCountry || "Select your home country"}</span>
          </span>
          <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: ED_INK3 }} />
        </button>
        {homeCountryOpen && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden" style={{ borderRadius: 14, border: `1px solid ${ED_RULE}`, background: "#fff", boxShadow: "0 16px 40px -20px rgba(22,17,13,.45)" }}>
            <div className="flex items-center gap-2" style={{ padding: "10px 14px", borderBottom: `1px solid ${ED_RULE}` }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: ED_INK3 }} />
              <input autoFocus value={homeCountryQuery} onChange={(e) => setHomeCountryQuery(e.target.value)} placeholder="Type a country (e.g. Philippines, USA)…" className="flex-1 outline-none bg-transparent" style={{ fontSize: fs(14), color: ED_INK }} />
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {countryMatches.map((c) => (
                <button key={c.code} type="button" onClick={() => pickHomeCountry(c.name)} className="w-full text-left flex items-center justify-between" style={{ padding: "10px 16px", background: c.code === homeCountryCode ? "#F7F4EC" : "transparent" }}>
                  <span style={{ fontSize: fs(14), color: ED_INK }}>{c.name}</span>
                  {c.code === homeCountryCode && <Check className="w-4 h-4 flex-shrink-0" style={{ color: TEAL_DEEP }} />}
                </button>
              ))}
              {countryMatches.length === 0 && (<div style={{ padding: "12px 16px", fontSize: fs(13), color: ED_INK3 }}>No country matches.</div>)}
            </div>
          </div>
        )}
      </div>
    );
  const countryDropdown = (
      <div className="relative w-full" ref={countryBoxRef} style={{ minWidth: isTablet ? 280 : 0 }}>
        <button type="button" onClick={() => setCountryOpen((o) => !o)} className="w-full flex items-center justify-between text-left" style={{ height: 48, padding: "0 16px", borderRadius: 14, border: `1px solid ${ED_RULE}`, background: "#fff" }}>
          <span className="truncate" style={{ fontSize: fs(15), color: homeCityLabel ? ED_INK : ED_INK3 }}>{homeCityLabel || "Search your home city"}</span>
          <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: ED_INK3 }} />
        </button>
        {countryOpen && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden" style={{ borderRadius: 14, border: `1px solid ${ED_RULE}`, background: "#fff", boxShadow: "0 16px 40px -20px rgba(22,17,13,.45)" }}>
            <div className="flex items-center gap-2" style={{ padding: "10px 14px", borderBottom: `1px solid ${ED_RULE}` }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: ED_INK3 }} />
              <input autoFocus value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} placeholder="Type your home city (e.g. Los Angeles)…" className="flex-1 outline-none bg-transparent" style={{ fontSize: fs(14), color: ED_INK }} />
              {(citySearching || cityResolving) && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: ED_INK3 }} />}
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {cityResults.map((r, i) => (
                <button key={r.placeId || i} type="button" onClick={() => pickHomeCity(r)} disabled={cityResolving} className="w-full text-left flex items-center gap-2" style={{ padding: "10px 16px" }}>
                  <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: ED_INK3 }} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ fontSize: fs(14), color: ED_INK }}>{r.placeName || r.address?.city || r.city}</span>
                    <span className="block truncate" style={{ fontSize: fs(12), color: ED_INK3 }}>{r.address?.formatted || r.full_name}</span>
                  </span>
                </button>
              ))}
              {!citySearching && countryQuery.trim().length >= 3 && cityResults.length === 0 && (<div style={{ padding: "12px 16px", fontSize: fs(13), color: ED_INK3 }}>No cities match — try &ldquo;City, Country&rdquo;.</div>)}
              {countryQuery.trim().length < 3 && (<div style={{ padding: "12px 16px", fontSize: fs(13), color: ED_INK3 }}>Type your home city (at least 3 letters).</div>)}
            </div>
          </div>
        )}
      </div>
    );

    // Refresh app data — the old FloatingNav refresh action, moved here as a
    // quiet Settings row (same impl): confirm → clearAppCache (cached RESULTS
    // only, never auth/prefs/saved) → reload to refetch fresh data.
    const handleRefreshData = () => {
      if (typeof window !== "undefined" && !window.confirm("Refresh all cached results? The app will reload with fresh data.")) return;
      clearAppCache();
      setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 600);
    };

    const navItems = [
      { show: true, onClick: () => navigate(createPageUrl("SavedLocations")), icon: MapPin, bg: CAT.money.ink, title: "Saved Locations", desc: "Manage your favorite places" },
      { show: isAdmin, onClick: () => navigate(createPageUrl("AdminAnalytics")), icon: BarChart3, bg: CAT.transit.ink, title: "Admin Portal", desc: "Users, sign-ups & usage analytics" },
      { show: isAdmin, onClick: () => setShowRefreshAccess(true), icon: RefreshCw, bg: CAT.atm.ink, title: "Refresh Access", desc: "Grant the refresh button to users" },
      { show: true, onClick: () => setShowContactUs(true), icon: MessageCircle, bg: CAT.restroom.ink, title: "Contact Us", desc: "Get in touch with our team" },
      // Same admin gate the old FloatingNav button had — the Refresh Access grant flow below stays meaningful.
      { show: canRefresh, onClick: handleRefreshData, icon: RefreshCw, bg: CAT.coffee.ink, title: "Refresh app data", desc: "Clear cached results and reload with fresh data" },
    ].filter((n) => n.show);

    return (
      <div className="font-sans" style={{ background: IVORY, minHeight: "100vh" }}>
        <div className={isTablet ? "max-w-[1024px] mx-auto" : "max-w-md mx-auto"} style={{ padding: isTablet ? "20px 24px 64px" : "16px 16px 56px" }}>
          {/* Header: back + sign-out, serif title + kicker subtitle */}
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(createPageUrl("Home"))} className="flex items-center justify-center transition-colors" style={{ width: 44, height: 44, borderRadius: 999, background: "#FFFFFF", border: `1px solid ${ED_RULE}` }} aria-label="Close settings">
              <X className="w-5 h-5" style={{ color: ED_INK }} />
            </button>
            <button onClick={logout} className="flex items-center gap-2 transition-colors" style={{ height: 44, padding: "0 20px", borderRadius: 999, background: "#FFFFFF", border: `1px solid ${ED_RULE}`, color: TEAL_DEEP, fontWeight: 600, fontSize: fs(14) }}>
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>

          <h1 style={{ fontFamily: ED_SERIF, fontSize: fs(isTablet ? 52 : 30), lineHeight: 1, color: ED_INK, margin: isTablet ? "20px 0 6px" : "18px 0 5px" }}>Settings</h1>
          <p className="uppercase" style={{ fontFamily: ED_MONO, fontSize: fs(isTablet ? 11 : 10), letterSpacing: ".14em", color: ED_INK3 }}>Tailor Globeskimmers to how you travel</p>

          {/* Profile card — brand-teal feature surface with Edit / Save-Cancel.
              On phone the avatar + name stack above the action button so the
              compact column never crowds; tablet keeps the single roomy row. */}
          <div className={isTablet ? "flex items-center gap-5" : "flex flex-col gap-4"} style={{ marginTop: isTablet ? 26 : 20, background: `linear-gradient(110deg, ${TEAL_DEEP}, #0A554E)`, color: "#fff", borderRadius: isTablet ? 24 : 20, padding: isTablet ? "26px 28px" : "20px 20px", boxShadow: "0 22px 48px -26px rgba(14,110,102,.6)" }}>
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="flex items-center justify-center flex-none" style={{ width: isTablet ? 72 : 56, height: isTablet ? 72 : 56, borderRadius: isTablet ? 22 : 18, background: "rgba(255,255,255,.18)" }}>
                <User className={isTablet ? "w-8 h-8 text-white" : "w-7 h-7 text-white"} />
              </div>
              <div className="min-w-0 flex-1">
                <p style={{ fontFamily: ED_SERIF, fontSize: fs(isTablet ? 32 : 26), lineHeight: 1.05, ...CLAMP_2 }}>{user?.first_name || user?.full_name || "Traveler"}</p>
                <p className="truncate" style={{ fontSize: fs(isTablet ? 15 : 13.5), opacity: 0.9, marginTop: 5 }}>{user?.email}</p>
              </div>
            </div>
            {/* Auto-save indicator (replaces the old Edit / Save-Cancel). Grayed
                + non-interactive: every change saves on its own, so there's no
                button to hunt for. Shows a live "Saving…" while a write is in
                flight. */}
            <div aria-live="polite" className={`flex items-center justify-center gap-1.5 flex-none ${isTablet ? "" : "w-full"}`} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", color: "rgba(255,255,255,.72)", borderRadius: 999, padding: isTablet ? "12px 22px" : "11px 22px", fontSize: fs(isTablet ? 15 : 14), fontWeight: 600 }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : "Auto-save changes"}
            </div>
          </div>

          {/* Travel preferences group */}
          <EdGroup kicker="Travel preferences" isTablet={isTablet}>
            <EdRow isTablet={isTablet} step={fontStep} icon={Mail} iconBg={CAT.atm.ink} title="Email" desc="Your sign-in address" control={{ node: <EdValue>{user?.email}</EdValue> }} />
            <EdRow isTablet={isTablet} step={fontStep} icon={User} iconBg={CAT.culture.ink} title="First Name" desc="Used to greet you across the app"
              control={{ below: true, node: <Input type="text" value={firstName} onFocus={() => { firstNameFocused.current = true; }} onBlur={() => { firstNameFocused.current = false; const v = firstName.trim(); if (v !== (profile?.first_name || "")) persist({ first_name: v }); }} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter your first name" className="h-12 rounded-xl" style={{ borderColor: ED_RULE }} /> }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={Globe} iconBg={CAT.restroom.ink} title="Home Country" desc={homeCity ? "Sets your home flag" : "Sets your home flag · add a home city for exact home time"}
              control={{ below: true, node: homeCountryDropdown }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={MapPin} iconBg={CAT.money.ink} title="Home City" desc="Sets your local time & fills in your country"
              control={{ below: true, node: countryDropdown }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={Globe} iconBg={CAT.transit.ink} title="Show Home Country Time" desc="Display home country time on home page"
              control={{ node: <EdToggle on={showHomeCountryInfo} onClick={() => { const next = !showHomeCountryInfo; setShowHomeCountryInfo(next); persist({ show_home_country_info: next }); }} label="Toggle home country time" /> }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={Globe} iconBg={CAT.weather.ink} title="Show Home Country Flag" desc="Display your flag on the home page"
              control={{ node: <EdToggle on={showHomeFlag} onClick={() => { const next = !showHomeFlag; setShowHomeFlag(next); persist({ show_home_flag: next }); }} label="Toggle home country flag" /> }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={MapPin} iconBg={CAT.transit.ink} title="When I open the app" desc="Where Globeskimmers starts each time"
              control={{ below: true, node: (
                <Select value={openBehavior} onValueChange={(v) => { setOpenBehaviorState(v); writeOpenBehavior(v); }}>
                  <SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ask">Ask me each time</SelectItem>
                    <SelectItem value="current">Use my current location</SelectItem>
                    <SelectItem value="continue">Continue where I left off</SelectItem>
                  </SelectContent>
                </Select>
              ) }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={MapPin} iconBg={CAT.transit.ink} title="Update location as I move" desc="Refresh results automatically when you travel to a new city. Off by default — we'll ask before switching."
              control={{ node: <EdToggle on={autoFollow} onClick={() => setAutoFollow(!autoFollow)} label="Toggle auto-follow location" /> }}
              last
            />
          </EdGroup>

          {/* Virtual Passport group */}
          <EdGroup kicker="Virtual Passport" isTablet={isTablet}>
            <EdRow isTablet={isTablet} step={fontStep} icon={MapPin} iconBg={CAT.transit.ink} title="Airport arrival stamps" desc="Offer a passport stamp when you land at an airport. Your passport stays private — only you can see it."
              control={{ node: <EdToggle on={suggestArrivals} onClick={() => { const next = !suggestArrivals; setSuggestArrivals(next); try { localStorage.setItem("pp_suggest_arrivals", next ? "1" : "0"); } catch { /* ignore */ } }} label="Toggle airport arrival stamps" /> }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={MapPin} iconBg={CAT.transit.ink} title="New-city pop-ups" desc="Offer a stamp when you arrive in — or open the app in — a new city or country. Turn off to never be prompted (you can still add stamps yourself)."
              control={{ node: <EdToggle on={cityPrompt} onClick={() => { const next = !cityPrompt; setCityPrompt(next); try { localStorage.setItem("pp_city_prompt", next ? "1" : "0"); } catch { /* ignore */ } }} label="Toggle new-city pop-ups" /> }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={MapPin} iconBg={CAT.transit.ink} title="Sense nearby stamps" desc="When you open your Passport, offer the attraction or airport you're standing in. Turn off to never see that pop-up (the Passport page has the same switch)."
              control={{ node: <EdToggle on={suggestNearby} onClick={() => { const next = !suggestNearby; setSuggestNearby(next); try { localStorage.setItem("pp_suggest_nearby", next ? "1" : "0"); } catch { /* ignore */ } }} label="Toggle nearby stamp sensing" /> }}
              last={false}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={AtSign} iconBg={CAT.culture.ink} title="Username" desc="Your @name for tagging and, soon, followers. Letters, numbers and underscore; you can change it twice a month."
              control={{ below: true, node: (
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex items-center rounded-xl px-3 h-12" style={{ border: `1px solid ${ED_RULE}`, background: '#fff' }}>
                    <span style={{ color: ED_INK3, fontWeight: 700 }}>@</span>
                    <input value={handleDraft} onChange={(e) => setHandleDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                      placeholder="yourname" aria-label="Username" autoCapitalize="none" autoCorrect="off"
                      className="flex-1 outline-none bg-transparent pl-1" style={{ fontSize: 15 }} />
                  </div>
                  <button type="button" onClick={saveHandle} disabled={handleBusy || !handleDraft.trim() || handleDraft.trim() === handle}
                    className="h-12 px-4 rounded-xl font-semibold disabled:opacity-50" style={{ background: TEAL_DEEP, color: '#fff', fontSize: 14 }}>
                    {handleBusy ? 'Saving…' : handle ? 'Change' : 'Claim'}
                  </button>
                </div>
              ) }}
              last
            />
          </EdGroup>

          {/* Currency & language group */}
          <EdGroup kicker="Currency & language" isTablet={isTablet}>
            <EdRow isTablet={isTablet} step={fontStep} icon={DollarSign} iconBg={CAT.money.ink} title="Preferred Currency" desc="How prices are displayed across the app"
              control={{ below: true, node: (<Select value={preferredCurrency} onValueChange={(v) => { setPreferredCurrency(v); persist({ preferred_currency: v }); }}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue placeholder="Select preferred currency" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{CURRENCIES.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.flag} {currency.name} ({currency.code})</SelectItem>))}</SelectContent></Select>) }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={CreditCard} iconBg={CAT.atm.ink} title="Primary Banking Currency" desc="The currency of the bank account or card you'll use at ATMs"
              control={{ below: true, node: (<Select value={primaryBankingCurrency} onValueChange={(v) => { setPrimaryBankingCurrency(v); persist({ primary_banking_currency: v }); }}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue placeholder="Select banking currency" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{CURRENCIES.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.flag} {currency.name} ({currency.code})</SelectItem>))}</SelectContent></Select>) }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={Languages} iconBg={CAT.transit.ink} title="Preferred Language" desc="Translates menus, signs & phrases"
              control={{ below: true, node: (<Select value={preferredLanguage} onValueChange={(v) => { setPreferredLanguage(v); persist({ preferred_language: v }); }}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue placeholder="Select preferred language" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{LANGUAGES.map((language) => (<SelectItem key={language.code} value={language.code}>{language.flag} {language.name}</SelectItem>))}</SelectContent></Select>) }}
              last
            />
          </EdGroup>

          {/* Units group */}
          <EdGroup kicker="Units" isTablet={isTablet}>
            <EdRow isTablet={isTablet} step={fontStep} icon={Thermometer} iconBg={CAT.weather.ink} title="Temperature Scale" desc="Used across Weather & finders"
              control={{ below: true, node: (<Select value={preferredTempScale} onValueChange={(v) => { setPreferredTempScale(v); persist({ temp_unit: v === "celsius" ? "C" : "F" }); }}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="celsius">Celsius (°C)</SelectItem><SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem></SelectContent></Select>) }}
            />
            <EdRow isTablet={isTablet} step={fontStep} icon={MapPin} iconBg={CAT.money.ink} title="Distance Unit" desc="Used across all finders"
              control={{ below: true, node: (<Select value={preferredDistanceUnit} onValueChange={(v) => { setPreferredDistanceUnit(v); persist({ distance_unit: v === "miles" ? "mi" : "km" }); }}><SelectTrigger className="h-12 rounded-xl" style={{ borderColor: ED_RULE }}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="km">Kilometers (km)</SelectItem><SelectItem value="miles">Miles (mi)</SelectItem></SelectContent></Select>) }}
              last
            />
          </EdGroup>

          {/* Account & navigation group */}
          <EdGroup kicker="Account" isTablet={isTablet}>
            {navItems.map((n) => (
              <button key={n.title} onClick={n.onClick} className="w-full flex items-center gap-4 text-left transition-colors" style={{ padding: isTablet ? "20px 24px" : "16px 16px", minHeight: isTablet ? 84 : 70, borderBottom: `1px solid ${ED_RULE}` }}>
                <div className="flex items-center justify-center flex-none" style={{ width: isTablet ? 44 : 38, height: isTablet ? 44 : 38, borderRadius: isTablet ? 13 : 11, background: n.bg, color: "#fff" }}><n.icon className={isTablet ? "w-5 h-5" : "w-[18px] h-[18px]"} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(20), color: ED_INK, lineHeight: 1.1, ...CLAMP_2 }}>{n.title}</p>
                  <p style={{ fontSize: fs(isTablet ? 13 : 13.5), color: ED_INK3, marginTop: 3, lineHeight: 1.35, ...CLAMP_2 }}>{n.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 flex-none" style={{ color: ED_INK3, opacity: 0.6 }} />
              </button>
            ))}
            <button onClick={logout} className="w-full flex items-center justify-center gap-3 transition-colors" style={{ padding: isTablet ? "20px 24px" : "16px 16px" }}>
              <LogOut className="w-5 h-5" style={{ color: TEAL_DEEP }} />
              <span className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(isTablet ? 19 : 18), color: TEAL_DEEP }}>Sign Out</span>
            </button>
          </EdGroup>

          {/* Danger zone — in-app account deletion (Apple Guideline 5.1.1(v) /
              Google Play requirement: account-creation apps must let users
              delete their account + data from inside the app). */}
          <EdGroup kicker="Danger zone" isTablet={isTablet}>
            <button onClick={() => { setDeleteError(""); setConfirmDelete(true); }} className="w-full flex items-center justify-center gap-3 transition-colors" style={{ padding: isTablet ? "20px 24px" : "16px 16px" }}>
              <Trash2 className="w-5 h-5" style={{ color: "#C0362C" }} />
              <span className="font-semibold" style={{ fontFamily: ED_SERIF, fontSize: fs(isTablet ? 19 : 18), color: "#C0362C" }}>Delete Account</span>
            </button>
          </EdGroup>

          <p className="text-center" style={{ marginTop: isTablet ? 32 : 26, fontFamily: ED_MONO, fontSize: fs(isTablet ? 11 : 10), letterSpacing: ".08em", color: ED_INK3, textTransform: "uppercase" }}>Made for travelers worldwide · © 2025 Globeskimmers</p>
        </div>

        <ContactUsModal isOpen={showContactUs} onClose={() => setShowContactUs(false)} />
        <RefreshAccessModal isOpen={showRefreshAccess} onClose={() => setShowRefreshAccess(false)} />

        {/* Delete-account confirmation. Stays open during the async delete
            (e.preventDefault on the action stops Radix auto-closing) so we can
            show progress + errors; on success the page unmounts to the gate. */}
        <AlertDialog open={confirmDelete} onOpenChange={(open) => { if (!open && !deleting) { setConfirmDelete(false); setDeleteError(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your Globeskimmers account and all associated data — your profile, preferences, and saved locations. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <p style={{ color: "#C0362C", fontSize: 13.5, lineHeight: 1.4, margin: "2px 0 0" }}>{deleteError}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleting ? "Deleting…" : "Delete Account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
}