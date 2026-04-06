import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation } from 'lucide-react';

export default function MapAppSelector({ isOpen, onClose, destination, userLat, userLng }) {
  if (!isOpen || !destination) return null;

  const { latitude, longitude, name, address } = destination;
  const origin = userLat && userLng;

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}${origin?`&origin=${userLat},${userLng}`:""}`;
    window.open(url, '_blank');
    onClose();
  };

  const openWaze = () => {
    const url = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes&zoom=17`;
    window.open(url, '_blank');
    onClose();
  };

  const openAppleMaps = () => {
    const url = `http://maps.apple.com/?daddr=${latitude},${longitude}${origin?`&saddr=${userLat},${userLng}`:""}&dirflg=d&t=m`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
          />

          {/* Modal - Slide up from bottom */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-[18px] font-bold text-gray-900">
                Get Directions
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Destination Info */}
            <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[14px] text-gray-900">
                    {name}
                  </p>
                  {address && (
                    <p className="text-[12px] text-gray-600 mt-0.5">
                      {address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Map App Options */}
            <div className="p-5 space-y-3">
              {/* Google Maps */}
              <button
                onClick={openGoogleMaps}
                className="w-full flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-2xl">🗺️</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-[16px] text-gray-900">
                    Google Maps
                  </p>
                  <p className="text-[13px] text-gray-500">
                    Navigate with Google Maps
                  </p>
                </div>
                <Navigation className="w-5 h-5 text-gray-400" />
              </button>

              {/* Waze */}
              <button
                onClick={openWaze}
                className="w-full flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-100 to-cyan-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-2xl">🚗</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-[16px] text-gray-900">
                    Waze
                  </p>
                  <p className="text-[13px] text-gray-500">
                    Navigate with Waze
                  </p>
                </div>
                <Navigation className="w-5 h-5 text-gray-400" />
              </button>

              {/* Apple Maps */}
              <button
                onClick={openAppleMaps}
                className="w-full flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-2xl">🍎</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-[16px] text-gray-900">
                    Apple Maps
                  </p>
                  <p className="text-[13px] text-gray-500">
                    Navigate with Apple Maps
                  </p>
                </div>
                <Navigation className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Cancel Button */}
            <div className="px-5 pb-5">
              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Safe area padding for mobile */}
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}