import React from "react";
import { Phone, Navigation, MapPin, Clock, Star } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORY_INFO = {
  mall: { icon: "🛍️", label: "Mall", color: "bg-[#E0E5EA] text-[#3A6EA5]" },
  malls: { icon: "🛍️", label: "Mall", color: "bg-[#E0E5EA] text-[#3A6EA5]" },
  outlet: { icon: "🏷️", label: "Outlet", color: "bg-[#E0E5EA] text-[#E47E6B]" },
  outlets: { icon: "🏷️", label: "Outlet", color: "bg-[#E0E5EA] text-[#E47E6B]" },
  plaza: { icon: "🏬", label: "Plaza", color: "bg-[#E0E5EA] text-[#4AB8A1]" },
  plazas: { icon: "🏬", label: "Plaza", color: "bg-[#E0E5EA] text-[#4AB8A1]" },
  market: { icon: "🧺", label: "Market", color: "bg-[#E0E5EA] text-[#4CAF88]" },
  markets: { icon: "🧺", label: "Market", color: "bg-[#E0E5EA] text-[#4CAF88]" },
  souvenir: { icon: "🎁", label: "Souvenirs", color: "bg-[#E0E5EA] text-[#E6B85C]" },
  souvenirs: { icon: "🎁", label: "Souvenirs", color: "bg-[#E0E5EA] text-[#E6B85C]" },
  street: { icon: "🏙️", label: "Shopping Street", color: "bg-[#E0E5EA] text-[#89C7E8]" },
  streets: { icon: "🏙️", label: "Shopping Street", color: "bg-[#E0E5EA] text-[#89C7E8]" }
};

export default function ShoppingCard({ place, onGetDirections, onViewOnMap }) {
  const categoryInfo = CATEGORY_INFO[place.category] || CATEGORY_INFO.plaza;

  const handleCall = () => {
    if (place.phone) {
      window.location.href = `tel:${place.phone}`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden hover:border-pink-300 hover:shadow-lg transition-all"
    >
      {/* Images - Horizontal Scroll */}
      {place.photos && place.photos.length > 0 && (
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide bg-gray-100">
          {place.photos.map((photo, idx) => (
            <div key={idx} className="flex-shrink-0 w-full h-48 snap-center">
              <img
                src={photo}
                alt={`${place.name} ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">{place.name}</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${categoryInfo.color}`}>
                {categoryInfo.icon} {categoryInfo.label}
              </span>
              <span className="text-sm text-gray-600">{place.distanceText}</span>
            </div>
          </div>
        </div>

        {/* Rating */}
        {place.rating && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-semibold text-gray-900">{place.rating}</span>
            <span className="text-xs text-gray-500">({place.ratingsCount})</span>
          </div>
        )}

        {/* Open Status & Hours */}
        {place.isOpen !== null && place.isOpen !== undefined && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className={`text-sm font-semibold ${place.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                {place.isOpen ? 'Open now' : 'Closed'}
              </span>
            </div>
            {place.hours && place.hours.length > 0 && (
              <p className="text-xs text-gray-600 ml-6">
                {place.hours[new Date().getDay()]}
              </p>
            )}
          </div>
        )}

        {/* Phone */}
        {place.phone && (
          <div className="flex items-center gap-2 mb-3">
            <Phone className="w-4 h-4 text-gray-500" />
            <a href={`tel:${place.phone}`} className="text-sm text-blue-600 hover:underline">
              {place.phone}
            </a>
          </div>
        )}

        {/* Address */}
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{place.address}</p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onGetDirections}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-2.5 rounded-xl font-semibold hover:shadow-lg transition-shadow"
          >
            <Navigation className="w-4 h-4" />
            Directions
          </button>
          
          {place.phone ? (
            <button
              onClick={handleCall}
              className="flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
          ) : (
            <button
              onClick={onViewOnMap}
              className="flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Map
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}