import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, User, Mail, Edit3, Check, Globe, DollarSign, Languages, Thermometer, Shield, Loader2, MessageCircle, MapPin, ChevronRight, BarChart3 } from "lucide-react";
import ContactUsModal from "../components/ContactUsModal";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ADMIN_EMAILS = ['maizasimeon@gmail.com', 'founder@globeskimmers.io'];

// ═══ ALL 194 COUNTRIES (193 UN members + Vatican City) ═══
const COUNTRIES = [
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [showHomeCountryInfo, setShowHomeCountryInfo] = useState(false);
  const [showHomeFlag, setShowHomeFlag] = useState(false);
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [preferredTempScale, setPreferredTempScale] = useState("fahrenheit");
  const [preferredDistanceUnit, setPreferredDistanceUnit] = useState("km");
  const [showContactUs, setShowContactUs] = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) { base44.auth.redirectToLogin(window.location.pathname); return; }
      const userData = await base44.auth.me();
      setUser(userData);
      if (userData.first_name) { setFirstName(userData.first_name); }
      else if (userData.full_name) { setFirstName(userData.full_name.split(" ")[0] || ""); }
      else { setFirstName(""); }
      setHomeCountry(userData.home_country || "");
      setPreferredCurrency(userData.preferred_currencies?.[0] || "USD");
      setPreferredLanguage(userData.preferred_language || "en");
      setPreferredTempScale(userData.preferred_temperature_scale || "fahrenheit");
      setPreferredDistanceUnit(userData.preferred_distance_unit || "km");
      setShowHomeCountryInfo(userData.show_home_country_info || false);
      setShowHomeFlag(userData.show_home_flag || false);
      setLoading(false);
    } catch (error) { console.error("Error loading user:", error); base44.auth.redirectToLogin(window.location.pathname); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        first_name: firstName.trim(), home_country: homeCountry,
        show_home_country_info: showHomeCountryInfo, show_home_flag: showHomeFlag,
        preferred_currencies: [preferredCurrency], preferred_language: preferredLanguage,
        preferred_temperature_scale: preferredTempScale, preferred_distance_unit: preferredDistanceUnit
      };
      await base44.auth.updateMe(updates);
      window.dispatchEvent(new CustomEvent('globeskimmers:profileUpdated'));
      window.dispatchEvent(new CustomEvent('globeskimmers:homeCountryChanged', { detail: { homeCountry, showHomeCountryInfo } }));
      showToast("✅ Profile updated successfully!", "success");
      setEditing(false);
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
    } catch (error) { console.error("Error saving profile:", error); showToast("Failed to update profile. Please try again.", "error"); }
    setSaving(false);
  };

  const isAdmin = user && ADMIN_EMAILS.includes(user.email.toLowerCase());

  if (loading) {
    return (<div className="min-h-screen bg-gradient-to-b from-[#f7fafc] to-[#e2e8f0] flex items-center justify-center"><div className="w-16 h-16 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div></div>);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7fafc] via-[#eef2ff] to-[#f3e8ff]">
      <div className="relative bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10"><div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <button onClick={() => navigate(createPageUrl("Home"))} className="relative z-10 mb-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all shadow-lg active:scale-95"><X className="w-6 h-6" /></button>
        <div className="relative z-10"><h1 className="text-[32px] font-extrabold mb-2 tracking-tight">Settings</h1><p className="text-[15px] text-white/90">Manage your account and preferences</p></div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 pb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-6 mb-6 border border-white/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-lg"><User className="w-6 h-6 text-white" /></div>
              <h2 className="text-[22px] font-bold text-gray-900">Profile</h2>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-md"><Edit3 className="w-4 h-4" />Edit</button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setEditing(false); setFirstName(user?.first_name || ""); setHomeCountry(user?.home_country || ""); setShowHomeCountryInfo(user?.show_home_country_info || false); setShowHomeFlag(user?.show_home_flag || false); setPreferredCurrency(user?.preferred_currencies?.[0] || "USD"); setPreferredLanguage(user?.preferred_language || "en"); setPreferredTempScale(user?.preferred_temperature_scale || "fahrenheit"); setPreferredDistanceUnit(user?.preferred_distance_unit || "km"); }} className="px-2.5 py-1.5 text-xs text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-all">Cancel</button>
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
              {editing ? (<Select value={homeCountry} onValueChange={setHomeCountry}><SelectTrigger className="h-12 rounded-xl border-gray-300"><SelectValue placeholder="Select your home country" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.name}>{country.name}</SelectItem>))}</SelectContent></Select>) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.home_country || "Not set"}</div>)}
            </div>

            {editing && (<div className="flex items-center justify-between p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 shadow-sm"><div><p className="font-bold text-gray-900 text-[15px]">Show Home Country Time</p><p className="text-sm text-gray-600 mt-0.5">Display home country time on home page</p></div><button onClick={() => setShowHomeCountryInfo(!showHomeCountryInfo)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${showHomeCountryInfo ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2]' : 'bg-gray-300'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${showHomeCountryInfo ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>)}

            {editing && (<div className="flex items-center justify-between p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 shadow-sm"><div><p className="font-bold text-gray-900 text-[15px]">Show Home Country Flag</p><p className="text-sm text-gray-600 mt-0.5">Display your flag on the home page card</p></div><button onClick={() => setShowHomeFlag(!showHomeFlag)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${showHomeFlag ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2]' : 'bg-gray-300'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${showHomeFlag ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>)}

            <div><label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2"><DollarSign className="w-4 h-4" />Preferred Currency</label>
              {editing ? (<Select value={preferredCurrency} onValueChange={setPreferredCurrency}><SelectTrigger className="h-12 rounded-xl border-gray-300"><SelectValue placeholder="Select preferred currency" /></SelectTrigger><SelectContent className="max-h-[300px] rounded-xl">{CURRENCIES.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.flag} {currency.name} ({currency.code})</SelectItem>))}</SelectContent></Select>) : (<div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl text-gray-900 font-medium border border-gray-200">{user?.preferred_currencies?.[0] ? CURRENCIES.find(c => c.code === user.preferred_currencies[0])?.name : "Not set"}</div>)}
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
              <button onClick={() => { setEditing(false); setFirstName(user?.first_name || ""); setHomeCountry(user?.home_country || ""); setShowHomeCountryInfo(user?.show_home_country_info || false); setShowHomeFlag(user?.show_home_flag || false); setPreferredCurrency(user?.preferred_currencies?.[0] || "USD"); setPreferredLanguage(user?.preferred_language || "en"); setPreferredTempScale(user?.preferred_temperature_scale || "fahrenheit"); setPreferredDistanceUnit(user?.preferred_distance_unit || "km"); }} className="flex-1 px-4 py-3 text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save</button>
            </div>)}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3 mb-6">
          <button onClick={() => navigate(createPageUrl("SavedLocations"))} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><MapPin className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[15px] font-bold text-white">Saved Locations</p><p className="text-[13px] text-white/90">Manage your favorite places</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>
          {isAdmin && (<button onClick={() => navigate(createPageUrl("AdminDashboard"))} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><Shield className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[15px] font-bold text-white">Admin Portal</p><p className="text-[13px] text-white/90">Manage app and users</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>)}
          {isAdmin && (<button onClick={() => navigate(createPageUrl("AdminAnalytics"))} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><BarChart3 className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[15px] font-bold text-white">Analytics</p><p className="text-[13px] text-white/90">Page views, searches, zero-results</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>)}
          <button onClick={() => setShowContactUs(true)} className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"><div className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg"><MessageCircle className="w-6 h-6 text-white" /></div><div className="text-left flex-1"><p className="text-[15px] font-bold text-white">Contact Us</p><p className="text-[13px] text-white/90">Get in touch with our team</p></div><ChevronRight className="w-5 h-5 text-white/80" /></button>
          <button onClick={() => base44.auth.logout()} className="w-full flex items-center justify-center gap-3 p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-all text-gray-700 font-medium"><span className="text-lg">🚪</span><span>Sign Out</span></button>
        </motion.div>

        <div className="mt-8 text-center text-sm text-gray-500 pb-8"><p className="font-medium">Made with ❤️ for travelers worldwide</p><p className="mt-2 text-xs">© 2025 Globeskimmers. All rights reserved.</p></div>
      </div>

      <ContactUsModal isOpen={showContactUs} onClose={() => setShowContactUs(false)} />
    </div>
  );
}