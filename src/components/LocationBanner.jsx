import React from 'react';
import { MapPin, Edit3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LocationBanner({ location, onClick }) {
  if (!location) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full bg-gradient-to-r from-[#fa709a] to-[#fee140] text-white px-4 py-3 flex items-center justify-between shadow-md hover:opacity-90 transition-opacity active:scale-[0.99]"
    >
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 flex-shrink-0" />
        <div className="text-left">
          <p className="font-bold text-[15px] leading-tight">
            {location.city}
          </p>
          <p className="text-[13px] opacity-90 leading-tight">
            {location.state_or_country}
          </p>
        </div>
      </div>
      <Edit3 className="w-4 h-4 opacity-80" />
    </motion.button>
  );
}