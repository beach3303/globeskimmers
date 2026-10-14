// The currencies Money exchange converts, with the countries that use each one.
//
// The list is every cash currency ExchangeRate-API (the worker's /exchange-rate source)
// quotes, less the ones nobody can exchange any more or never could: the retired kuna
// (HRK, Croatia is on the euro), lev (BGN, Bulgaria since 2026-01-01), old leone (SLL),
// Zimbabwe dollar (ZWL) and Antillean guilder (ANG), the IMF's SDR (XDR), Chile's unit of
// account (CLF) and the offshore yuan (CNH). No availability claims: we don't know what any
// counter stocks.
//
//   CURRENCIES             [{ code, name, cc: ['MX', ...] }], A–Z by name
//   currencyByCode(code)   the row, or null
//   currencyForCountry(name)  the local currency's code for a country name (as the location
//                          gives it, 'Mexico'), or null when we can't say
//   searchCurrencies(q)    the rows whose code, name or country matches q ('japan', 'yen', 'jp')
//   parseAmount(text)      a typed amount ('1,250.50', '1.250,50', '12,5') -> number | null
//   fractionDigits(code)   the currency's minor units (JPY 0, KWD 3, else 2)
//   formatMoney(n, code)   '$1.00', 'MX$18.42' in the device's locale
//   formatRate(rate, code) a rate with enough digits to mean something: '¥149.20',
//                          '€0.8634', '$0.00003941'
//   formatAmount(n, code)  the converted amount without a symbol ('1,842.00')
import { COUNTRIES, countryCode } from '@/lib/countries';

/** @typedef {{ code: string, name: string, cc: string[] }} Currency */

/** @type {Currency[]} */
const RAW = [
  { code: 'AED', name: 'UAE Dirham', cc: ['AE'] },
  { code: 'AFN', name: 'Afghan Afghani', cc: ['AF'] },
  { code: 'ALL', name: 'Albanian Lek', cc: ['AL'] },
  { code: 'AMD', name: 'Armenian Dram', cc: ['AM'] },
  { code: 'AOA', name: 'Angolan Kwanza', cc: ['AO'] },
  { code: 'ARS', name: 'Argentine Peso', cc: ['AR'] },
  { code: 'AUD', name: 'Australian Dollar', cc: ['AU', 'CX', 'CC', 'HM', 'NF', 'NR', 'KI', 'TV'] },
  { code: 'AWG', name: 'Aruban Florin', cc: ['AW'] },
  { code: 'AZN', name: 'Azerbaijani Manat', cc: ['AZ'] },
  { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', cc: ['BA'] },
  { code: 'BBD', name: 'Barbadian Dollar', cc: ['BB'] },
  { code: 'BDT', name: 'Bangladeshi Taka', cc: ['BD'] },
  { code: 'BHD', name: 'Bahraini Dinar', cc: ['BH'] },
  { code: 'BIF', name: 'Burundian Franc', cc: ['BI'] },
  { code: 'BMD', name: 'Bermudian Dollar', cc: ['BM'] },
  { code: 'BND', name: 'Brunei Dollar', cc: ['BN'] },
  { code: 'BOB', name: 'Bolivian Boliviano', cc: ['BO'] },
  { code: 'BRL', name: 'Brazilian Real', cc: ['BR'] },
  { code: 'BSD', name: 'Bahamian Dollar', cc: ['BS'] },
  { code: 'BTN', name: 'Bhutanese Ngultrum', cc: ['BT'] },
  { code: 'BWP', name: 'Botswana Pula', cc: ['BW'] },
  { code: 'BYN', name: 'Belarusian Ruble', cc: ['BY'] },
  { code: 'BZD', name: 'Belize Dollar', cc: ['BZ'] },
  { code: 'CAD', name: 'Canadian Dollar', cc: ['CA'] },
  { code: 'CDF', name: 'Congolese Franc', cc: ['CD'] },
  { code: 'CHF', name: 'Swiss Franc', cc: ['CH', 'LI'] },
  { code: 'CLP', name: 'Chilean Peso', cc: ['CL'] },
  { code: 'CNY', name: 'Chinese Yuan', cc: ['CN'] },
  { code: 'COP', name: 'Colombian Peso', cc: ['CO'] },
  { code: 'CRC', name: 'Costa Rican Colón', cc: ['CR'] },
  { code: 'CUP', name: 'Cuban Peso', cc: ['CU'] },
  { code: 'CVE', name: 'Cape Verdean Escudo', cc: ['CV'] },
  { code: 'CZK', name: 'Czech Koruna', cc: ['CZ'] },
  { code: 'DJF', name: 'Djiboutian Franc', cc: ['DJ'] },
  { code: 'DKK', name: 'Danish Krone', cc: ['DK', 'GL', 'FO'] },
  { code: 'DOP', name: 'Dominican Peso', cc: ['DO'] },
  { code: 'DZD', name: 'Algerian Dinar', cc: ['DZ'] },
  { code: 'EGP', name: 'Egyptian Pound', cc: ['EG'] },
  { code: 'ERN', name: 'Eritrean Nakfa', cc: ['ER'] },
  { code: 'ETB', name: 'Ethiopian Birr', cc: ['ET'] },
  {
    code: 'EUR',
    name: 'Euro',
    cc: [
      'AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK',
      'SI', 'ES', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK', 'GF', 'GP', 'MQ', 'YT', 'RE', 'BL', 'MF', 'PM', 'AX',
    ],
  },
  { code: 'FJD', name: 'Fijian Dollar', cc: ['FJ'] },
  { code: 'FKP', name: 'Falkland Islands Pound', cc: ['FK'] },
  { code: 'FOK', name: 'Faroese Króna', cc: [] },
  { code: 'GBP', name: 'British Pound', cc: ['GB', 'GG', 'JE', 'IM', 'GS'] },
  { code: 'GEL', name: 'Georgian Lari', cc: ['GE'] },
  { code: 'GGP', name: 'Guernsey Pound', cc: [] },
  { code: 'GHS', name: 'Ghanaian Cedi', cc: ['GH'] },
  { code: 'GIP', name: 'Gibraltar Pound', cc: ['GI'] },
  { code: 'GMD', name: 'Gambian Dalasi', cc: ['GM'] },
  { code: 'GNF', name: 'Guinean Franc', cc: ['GN'] },
  { code: 'GTQ', name: 'Guatemalan Quetzal', cc: ['GT'] },
  { code: 'GYD', name: 'Guyanese Dollar', cc: ['GY'] },
  { code: 'HKD', name: 'Hong Kong Dollar', cc: ['HK'] },
  { code: 'HNL', name: 'Honduran Lempira', cc: ['HN'] },
  { code: 'HTG', name: 'Haitian Gourde', cc: ['HT'] },
  { code: 'HUF', name: 'Hungarian Forint', cc: ['HU'] },
  { code: 'IDR', name: 'Indonesian Rupiah', cc: ['ID'] },
  { code: 'ILS', name: 'Israeli New Shekel', cc: ['IL', 'PS'] },
  { code: 'IMP', name: 'Manx Pound', cc: [] },
  { code: 'INR', name: 'Indian Rupee', cc: ['IN'] },
  { code: 'IQD', name: 'Iraqi Dinar', cc: ['IQ'] },
  { code: 'IRR', name: 'Iranian Rial', cc: ['IR'] },
  { code: 'ISK', name: 'Icelandic Króna', cc: ['IS'] },
  { code: 'JEP', name: 'Jersey Pound', cc: [] },
  { code: 'JMD', name: 'Jamaican Dollar', cc: ['JM'] },
  { code: 'JOD', name: 'Jordanian Dinar', cc: ['JO'] },
  { code: 'JPY', name: 'Japanese Yen', cc: ['JP'] },
  { code: 'KES', name: 'Kenyan Shilling', cc: ['KE'] },
  { code: 'KGS', name: 'Kyrgyzstani Som', cc: ['KG'] },
  { code: 'KHR', name: 'Cambodian Riel', cc: ['KH'] },
  { code: 'KID', name: 'Kiribati Dollar', cc: [] },
  { code: 'KMF', name: 'Comorian Franc', cc: ['KM'] },
  { code: 'KRW', name: 'South Korean Won', cc: ['KR'] },
  { code: 'KWD', name: 'Kuwaiti Dinar', cc: ['KW'] },
  { code: 'KYD', name: 'Cayman Islands Dollar', cc: ['KY'] },
  { code: 'KZT', name: 'Kazakhstani Tenge', cc: ['KZ'] },
  { code: 'LAK', name: 'Lao Kip', cc: ['LA'] },
  { code: 'LBP', name: 'Lebanese Pound', cc: ['LB'] },
  { code: 'LKR', name: 'Sri Lankan Rupee', cc: ['LK'] },
  { code: 'LRD', name: 'Liberian Dollar', cc: ['LR'] },
  { code: 'LSL', name: 'Lesotho Loti', cc: ['LS'] },
  { code: 'LYD', name: 'Libyan Dinar', cc: ['LY'] },
  { code: 'MAD', name: 'Moroccan Dirham', cc: ['MA', 'EH'] },
  { code: 'MDL', name: 'Moldovan Leu', cc: ['MD'] },
  { code: 'MGA', name: 'Malagasy Ariary', cc: ['MG'] },
  { code: 'MKD', name: 'Macedonian Denar', cc: ['MK'] },
  { code: 'MMK', name: 'Myanmar Kyat', cc: ['MM'] },
  { code: 'MNT', name: 'Mongolian Tögrög', cc: ['MN'] },
  { code: 'MOP', name: 'Macanese Pataca', cc: ['MO'] },
  { code: 'MRU', name: 'Mauritanian Ouguiya', cc: ['MR'] },
  { code: 'MUR', name: 'Mauritian Rupee', cc: ['MU'] },
  { code: 'MVR', name: 'Maldivian Rufiyaa', cc: ['MV'] },
  { code: 'MWK', name: 'Malawian Kwacha', cc: ['MW'] },
  { code: 'MXN', name: 'Mexican Peso', cc: ['MX'] },
  { code: 'MYR', name: 'Malaysian Ringgit', cc: ['MY'] },
  { code: 'MZN', name: 'Mozambican Metical', cc: ['MZ'] },
  { code: 'NAD', name: 'Namibian Dollar', cc: ['NA'] },
  { code: 'NGN', name: 'Nigerian Naira', cc: ['NG'] },
  { code: 'NIO', name: 'Nicaraguan Córdoba', cc: ['NI'] },
  { code: 'NOK', name: 'Norwegian Krone', cc: ['NO', 'SJ', 'BV'] },
  { code: 'NPR', name: 'Nepalese Rupee', cc: ['NP'] },
  { code: 'NZD', name: 'New Zealand Dollar', cc: ['NZ', 'CK', 'NU', 'PN', 'TK'] },
  { code: 'OMR', name: 'Omani Rial', cc: ['OM'] },
  { code: 'PAB', name: 'Panamanian Balboa', cc: [] },
  { code: 'PEN', name: 'Peruvian Sol', cc: ['PE'] },
  { code: 'PGK', name: 'Papua New Guinean Kina', cc: ['PG'] },
  { code: 'PHP', name: 'Philippine Peso', cc: ['PH'] },
  { code: 'PKR', name: 'Pakistani Rupee', cc: ['PK'] },
  { code: 'PLN', name: 'Polish Złoty', cc: ['PL'] },
  { code: 'PYG', name: 'Paraguayan Guaraní', cc: ['PY'] },
  { code: 'QAR', name: 'Qatari Riyal', cc: ['QA'] },
  { code: 'RON', name: 'Romanian Leu', cc: ['RO'] },
  { code: 'RSD', name: 'Serbian Dinar', cc: ['RS'] },
  { code: 'RUB', name: 'Russian Ruble', cc: ['RU'] },
  { code: 'RWF', name: 'Rwandan Franc', cc: ['RW'] },
  { code: 'SAR', name: 'Saudi Riyal', cc: ['SA'] },
  { code: 'SBD', name: 'Solomon Islands Dollar', cc: ['SB'] },
  { code: 'SCR', name: 'Seychellois Rupee', cc: ['SC'] },
  { code: 'SDG', name: 'Sudanese Pound', cc: ['SD'] },
  { code: 'SEK', name: 'Swedish Krona', cc: ['SE'] },
  { code: 'SGD', name: 'Singapore Dollar', cc: ['SG'] },
  { code: 'SHP', name: 'Saint Helena Pound', cc: ['SH'] },
  { code: 'SLE', name: 'Sierra Leonean Leone', cc: ['SL'] },
  { code: 'SOS', name: 'Somali Shilling', cc: ['SO'] },
  { code: 'SRD', name: 'Surinamese Dollar', cc: ['SR'] },
  { code: 'SSP', name: 'South Sudanese Pound', cc: ['SS'] },
  { code: 'STN', name: 'São Tomé and Príncipe Dobra', cc: ['ST'] },
  { code: 'SYP', name: 'Syrian Pound', cc: ['SY'] },
  { code: 'SZL', name: 'Eswatini Lilangeni', cc: ['SZ'] },
  { code: 'THB', name: 'Thai Baht', cc: ['TH'] },
  { code: 'TJS', name: 'Tajikistani Somoni', cc: ['TJ'] },
  { code: 'TMT', name: 'Turkmenistani Manat', cc: ['TM'] },
  { code: 'TND', name: 'Tunisian Dinar', cc: ['TN'] },
  { code: 'TOP', name: 'Tongan Paʻanga', cc: ['TO'] },
  { code: 'TRY', name: 'Turkish Lira', cc: ['TR'] },
  { code: 'TTD', name: 'Trinidad and Tobago Dollar', cc: ['TT'] },
  { code: 'TVD', name: 'Tuvaluan Dollar', cc: [] },
  { code: 'TWD', name: 'New Taiwan Dollar', cc: ['TW'] },
  { code: 'TZS', name: 'Tanzanian Shilling', cc: ['TZ'] },
  { code: 'UAH', name: 'Ukrainian Hryvnia', cc: ['UA'] },
  { code: 'UGX', name: 'Ugandan Shilling', cc: ['UG'] },
  {
    code: 'USD',
    name: 'US Dollar',
    cc: ['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM', 'EC', 'SV', 'PA', 'TL', 'FM', 'MH', 'PW', 'BQ', 'TC', 'VG', 'IO'],
  },
  { code: 'UYU', name: 'Uruguayan Peso', cc: ['UY'] },
  { code: 'UZS', name: 'Uzbekistani Som', cc: ['UZ'] },
  { code: 'VES', name: 'Venezuelan Bolívar', cc: ['VE'] },
  { code: 'VND', name: 'Vietnamese Đồng', cc: ['VN'] },
  { code: 'VUV', name: 'Vanuatu Vatu', cc: ['VU'] },
  { code: 'WST', name: 'Samoan Tālā', cc: ['WS'] },
  { code: 'XAF', name: 'Central African CFA Franc', cc: ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA'] },
  { code: 'XCD', name: 'East Caribbean Dollar', cc: ['AG', 'DM', 'GD', 'KN', 'LC', 'VC', 'AI', 'MS'] },
  { code: 'XCG', name: 'Caribbean Guilder', cc: ['CW', 'SX'] },
  { code: 'XOF', name: 'West African CFA Franc', cc: ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] },
  { code: 'XPF', name: 'CFP Franc', cc: ['PF', 'NC', 'WF'] },
  { code: 'YER', name: 'Yemeni Rial', cc: ['YE'] },
  { code: 'ZAR', name: 'South African Rand', cc: ['ZA'] },
  { code: 'ZMW', name: 'Zambian Kwacha', cc: ['ZM'] },
  { code: 'ZWG', name: 'Zimbabwe Gold', cc: ['ZW'] },
];

/** @type {Currency[]} */
export const CURRENCIES = Object.freeze([...RAW].sort((a, b) => a.name.localeCompare(b.name, 'en')));

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));
const BY_CC = new Map();
CURRENCIES.forEach((c) => c.cc.forEach((cc) => { if (!BY_CC.has(cc)) BY_CC.set(cc, c.code); }));

/** @param {string | null | undefined} code @returns {Currency | null} */
export function currencyByCode(code) {
  return (code && BY_CODE.get(String(code).toUpperCase())) || null;
}

/** @param {string | null | undefined} country @returns {string | null} */
export function currencyForCountry(country) {
  const cc = countryCode(country || '');
  return (cc && BY_CC.get(String(cc).toUpperCase())) || null;
}

// What a search matches: the code, the name and the names of the countries using it, folded
// to plain lower-case letters ('Złoty' finds 'zloty').
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase();
const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [String(c.code).toUpperCase(), c.name]));
const HAYSTACK = new Map(
  CURRENCIES.map((c) => [c.code, fold([c.code, c.name, ...c.cc, ...c.cc.map((cc) => COUNTRY_NAMES.get(cc) || '')].join(' '))]),
);

/** @param {string} q @returns {Currency[]} */
export function searchCurrencies(q) {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...CURRENCIES];
  const hits = CURRENCIES.filter((c) => terms.every((t) => HAYSTACK.get(c.code).includes(t)));
  // A typed code goes first ('eur' -> Euro before 'Europe'-ish matches).
  const exact = fold(q).trim().toUpperCase();
  return hits.sort((a, b) => Number(b.code === exact) - Number(a.code === exact));
}

// The device's decimal mark, so '1,5' reads as 1.5 where a comma is the decimal mark.
const DECIMAL = (() => {
  try {
    return (1.5).toLocaleString().includes(',') ? ',' : '.';
  } catch {
    return '.';
  }
})();

/** @param {unknown} text @returns {number | null} */
export function parseAmount(text) {
  let s = String(text ?? '').replace(/[\s  '’]/g, '');
  if (!s) return null;
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    // Both marks: the later one is the decimal mark ('1,250.50' or '1.250,50').
    const dec = dot > comma ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (comma >= 0) {
    const parts = s.split(',');
    // '1,250' and '1,250,000' group thousands, unless the comma is this device's decimal mark.
    const grouping = parts.length > 2 || (parts[1].length === 3 && DECIMAL === '.');
    s = grouping ? parts.join('') : parts.join('.');
  } else if (dot >= 0 && s.split('.').length > 2) {
    s = s.split('.').join(''); // '1.250.000'
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** @param {string} code @returns {number} */
export function fractionDigits(code) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function fmt(n, code, opts) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, ...opts }).format(n);
  } catch {
    return `${code} ${Number(n).toFixed(2)}`;
  }
}

/** '$1.00' (two decimals even for yen, as a rate's left side). */
export function formatMoney(n, code) {
  return fmt(n, code, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A rate: two decimals from 1 up, four below 1, four significant digits below a cent. */
export function formatRate(rate, code) {
  if (!Number.isFinite(rate)) return '';
  if (rate >= 1) return fmt(rate, code, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (rate >= 0.01) return fmt(rate, code, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return fmt(rate, code, { maximumSignificantDigits: 4 });
}

/** The converted amount, in the currency's own minor units, without a symbol. */
export function formatAmount(n, code) {
  if (!Number.isFinite(n)) return '';
  const d = fractionDigits(code);
  try {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return n.toFixed(d);
  }
}
