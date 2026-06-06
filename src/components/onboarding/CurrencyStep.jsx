import React, { useState } from "react";
import { DollarSign, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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

export default function CurrencyStep({ onNext, onSkip }) {
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCurrencies = CURRENCIES.filter(currency =>
    currency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    currency.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinue = () => {
    if (selectedCurrency) {
      onNext({ preferred_currency: selectedCurrency });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <DollarSign className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          Preferred Currency
        </h2>
        
        <p className="text-gray-600 mb-8 text-center">
          Choose your preferred currency for prices and expenses
        </p>

        <input
          type="text"
          placeholder="Search for a currency..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 mb-4 border-2 border-gray-300 rounded-xl focus:border-[#088395] focus:outline-none"
        />

        <div className="max-h-96 overflow-y-auto mb-6 border-2 border-gray-200 rounded-xl">
          {filteredCurrencies.map((currency) => (
            <button
              key={currency.code}
              onClick={() => {
                // Same fix as HomeCountryStep — tapping a result should
                // both confirm the selection AND fill the search box so the
                // user sees their pick in the field. Use the human-readable
                // currency name (e.g. "Philippine Peso") not the bare code
                // so the input reads naturally.
                setSelectedCurrency(currency.code);
                setSearchQuery(currency.name);
              }}
              className={`w-full px-4 py-3 text-left border-b border-gray-200 hover:bg-blue-50 transition-colors flex items-center justify-between ${
                selectedCurrency === currency.code
                  ? 'bg-[#088395] text-white hover:bg-[#088395]'
                  : 'text-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currency.flag}</span>
                <div>
                  <div className="font-semibold">{currency.code}</div>
                  <div className={`text-sm ${
                    selectedCurrency === currency.code ? 'text-white' : 'text-gray-600'
                  }`}>
                    {currency.name}
                  </div>
                </div>
              </div>
              <span className="text-lg font-bold">{currency.symbol}</span>
            </button>
          ))}
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selectedCurrency}
          className="w-full bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>

        <button
          onClick={() => onSkip()}
          className="w-full mt-4 text-gray-500 hover:text-gray-700 text-sm"
        >
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}