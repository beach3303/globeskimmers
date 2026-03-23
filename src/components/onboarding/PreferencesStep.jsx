import React, { useState } from "react";
import { Globe, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", 
  "France", "Spain", "Italy", "Japan", "China", "India", "Brazil",
  "Mexico", "Netherlands", "Sweden", "Norway", "Denmark", "Switzerland",
  "Singapore", "South Korea", "United Arab Emirates", "Other"
];

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
];

export default function PreferencesStep({ onComplete }) {
  const [country, setCountry] = useState("");
  const [currency1, setCurrency1] = useState("");
  const [currency2, setCurrency2] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!country) {
      setError("Please select your country of residence");
      return;
    }
    if (!currency1) {
      setError("Please select your first preferred currency");
      return;
    }
    if (!currency2) {
      setError("Please select your second preferred currency");
      return;
    }
    if (currency1 === currency2) {
      setError("Please select two different currencies");
      return;
    }

    onComplete({
      country_of_residence: country,
      preferred_currencies: [currency1, currency2]
    });
  };

  const availableCurrencies2 = CURRENCIES.filter(c => c.code !== currency1);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#088395] to-[#05BFDB] rounded-full flex items-center justify-center">
          <Globe className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-[#0A4D68] mb-4 text-center">
          Tell Us About Yourself
        </h2>
        
        <p className="text-gray-600 mb-8 text-center">
          This helps us personalize your travel experience
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <div>
            <Label htmlFor="country" className="text-[#0A4D68] font-semibold mb-2 block">
              Country of Residence
            </Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-[#088395]">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="currency1" className="text-[#0A4D68] font-semibold mb-2 block">
              Primary Currency
            </Label>
            <Select value={currency1} onValueChange={setCurrency1}>
              <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-[#088395]">
                <SelectValue placeholder="Select primary currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.symbol} {curr.code} - {curr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="currency2" className="text-[#0A4D68] font-semibold mb-2 block">
              Secondary Currency
            </Label>
            <Select 
              value={currency2} 
              onValueChange={setCurrency2}
              disabled={!currency1}
            >
              <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-[#088395]">
                <SelectValue placeholder="Select secondary currency" />
              </SelectTrigger>
              <SelectContent>
                {availableCurrencies2.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.symbol} {curr.code} - {curr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          className="w-full mt-8 bg-gradient-to-r from-[#088395] to-[#05BFDB] hover:opacity-90 text-white h-12 text-lg font-semibold"
        >
          Complete Setup
          <CheckCircle2 className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}