import React, { useState } from "react";
import { Navigation, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function MapRecenterButton({ map, homeLocation, onRecenter }) {
  const [loading, setLoading] = useState(false);

  const handleRecenter = async () => {
    if (!homeLocation || !onRecenter) return;
    
    setLoading(true);
    
    try {
      // Always recenter to home location (the location set on home page)
      onRecenter(homeLocation);
    } catch (err) {
      console.error("Error recentering map:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!homeLocation) {
    return null;
  }

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleRecenter}
      disabled={loading}
      className="absolute bottom-4 right-4 z-[1000] w-12 h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      title="Recenter to home location"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Navigation className="w-5 h-5" />
      )}
    </motion.button>
  );
}