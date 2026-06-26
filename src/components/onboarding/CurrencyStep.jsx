import React, { useState } from "react";
import { DollarSign } from "lucide-react";
import OnboardingStepLayout from "./OnboardingStepLayout";

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", flag: "🇨🇭" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "MXN", name: "Mexican Peso", symbol: "$", flag: "🇲🇽" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", flag: "🇵🇭" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", flag: "🇷🇺" },
];

// Single-select → tapping a currency advances immediately (no Continue).
export default function CurrencyStep({ onNext, onSkip, onBack }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCurrencies = CURRENCIES.filter(currency =>
    currency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    currency.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <OnboardingStepLayout
      icon={<DollarSign className="w-8 h-8 text-white" />}
      title="Preferred Currency"
      subtitle="Choose your preferred currency for prices and expenses"
      onBack={onBack}
      footer={
        <button
          onClick={() => onSkip()}
          className="w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Skip for now
        </button>
      }
    >
      <input
        type="text"
        placeholder="Search for a currency..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-3 mb-4 border-2 border-gray-300 rounded-xl focus:border-[#088395] focus:outline-none"
      />

      <div className="max-h-96 overflow-y-auto border-2 border-gray-200 rounded-xl">
        {filteredCurrencies.map((currency) => (
          <button
            key={currency.code}
            onClick={() => onNext({ preferred_currency: currency.code })}
            className="w-full px-4 py-3 text-left border-b border-gray-200 hover:bg-blue-50 transition-colors flex items-center justify-between text-gray-800"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currency.flag}</span>
              <div>
                <div className="font-semibold">{currency.code}</div>
                <div className="text-sm text-gray-600">{currency.name}</div>
              </div>
            </div>
            <span className="text-lg font-bold">{currency.symbol}</span>
          </button>
        ))}
        {filteredCurrencies.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500">
            No currencies match &quot;{searchQuery}&quot; 🔍
          </div>
        )}
      </div>
    </OnboardingStepLayout>
  );
}
