import React from "react";
import { MapPin, Star, Clock, Phone, Navigation, Share2 } from "lucide-react";
import { motion } from "framer-motion";

const PRICE_DISPLAY = {
  0: '$',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$'
};

export default function RestaurantCard({ restaurant, onClick, onGetDirections, distanceUnit = "km" }) {
  const formatDistance = (distanceMeters) => {
    if (!distanceMeters) return 'N/A';
    
    if (distanceUnit === "miles") {
      const miles = distanceMeters * 0.000621371;
      return `${miles.toFixed(1)} mi`;
    } else {
      const km = distanceMeters / 1000;
      return `${km.toFixed(1)} km`;
    }
  };

  const getCategoryIcon = (category) => {
    const categoryMap = {
      'Restaurant': '🍽️',
      'Cafe': '☕',
      'Bar': '🍺',
      'FastFood': '🍔',
      'Bakery': '🥐',
      'Pizza': '🍕',
      'Asian': '🥢',
      'Italian': '🍝',
      'Mexican': '🌮',
    };
    return categoryMap[category] || '🍽️';
  };

  const getTodayHours = () => {
    if (!restaurant.openingHours?.weekday_text) return null;
    const today = new Date().getDay();
    const todayText = restaurant.openingHours.weekday_text[today];
    if (!todayText) return null;
    
    const hours = todayText.split(': ')[1];
    return hours || null;
  };

  const handleShare = (e) => {
    e.stopPropagation();
    
    const shareText = `Check out ${restaurant.name}!\n\n` +
      `📍 ${restaurant.address}\n` +
      `⭐ ${restaurant.rating?.toFixed(1)} (${restaurant.userRatingsTotal} reviews)\n` +
      `💰 ${PRICE_DISPLAY[restaurant.priceLevel] || 'N/A'}\n` +
      `📞 ${restaurant.phoneNumber || 'Phone not available'}`;
    
    if (navigator.share) {
      navigator.share({
        title: restaurant.name,
        text: shareText,
      }).catch(() => {
        // Fallback to SMS
        window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
      });
    } else {
      // Fallback to SMS
      window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
    }
  };

  const todayHours = getTodayHours();
  const mainPhoto = restaurant.photos && restaurant.photos.length > 0 
    ? restaurant.photos[0].url 
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all"
      onClick={onClick}
    >
      {/* Image */}
      {mainPhoto ? (
        <div className="relative h-48 overflow-hidden">
          <img
            src={mainPhoto}
            alt={restaurant.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div 
            className="hidden w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 items-center justify-center"
            style={{ display: 'none' }}
          >
            <span className="text-6xl">{getCategoryIcon(restaurant.category)}</span>
          </div>

          {/* Photo Count Badge */}
          {restaurant.photos && restaurant.photos.length > 1 && (
            <div className="absolute bottom-3 right-3">
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-black/60 text-white backdrop-blur-sm">
                📷 {restaurant.photos.length}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <span className="text-6xl">{getCategoryIcon(restaurant.category)}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-bold text-lg text-gray-900 line-clamp-1 mb-2">
          {restaurant.name}
        </h3>

        {/* Category & Status Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {restaurant.category && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">
              {restaurant.category}
            </span>
          )}
          
          {/* Open/Closed Status Badge */}
          {restaurant.openNow !== undefined && (
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
              restaurant.openNow 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {restaurant.openNow ? '🟢 Open' : '🔴 Closed'}
            </span>
          )}
        </div>

        {/* Rating & Price */}
        <div className="flex items-center gap-2 mb-3">
          {restaurant.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-gray-900">{restaurant.rating.toFixed(1)}</span>
              {restaurant.userRatingsTotal && (
                <span className="text-xs text-gray-500">({restaurant.userRatingsTotal})</span>
              )}
            </div>
          )}
          
          {restaurant.priceLevel !== undefined && restaurant.priceLevel > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">•</span>
              <span className="font-bold text-gray-700">{PRICE_DISPLAY[restaurant.priceLevel]}</span>
            </div>
          )}
        </div>

        {/* Today's Hours */}
        {todayHours && (
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2 bg-blue-50 px-2 py-1.5 rounded-lg">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-blue-900">{todayHours}</span>
          </div>
        )}

        {/* Phone Number */}
        {restaurant.phoneNumber && (
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
            <Phone className="w-4 h-4 text-gray-500" />
            <a 
              href={`tel:${restaurant.phoneNumber}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-gray-700 hover:text-blue-600 transition-colors"
            >
              {restaurant.phoneNumber}
            </a>
          </div>
        )}

        {/* Address with Distance below */}
        <div className="mb-3">
          <div className="flex items-start gap-1 text-sm text-gray-600 mb-1">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-gray-700 line-clamp-2 text-xs leading-relaxed flex-1">
              {restaurant.address}
            </p>
          </div>
          {/* Distance under address */}
          <div className="flex items-center gap-1 text-xs text-gray-500 ml-5">
            <span className="font-semibold">{formatDistance(restaurant.distanceMeters)} away</span>
          </div>
        </div>

        {/* Cuisine Types - NEW */}
        {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {restaurant.cuisineTypes.slice(0, 3).map((cuisine, idx) => (
              <span key={idx} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-full font-medium border border-orange-200">
                {cuisine}
              </span>
            ))}
            {restaurant.cuisineTypes.length > 3 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                +{restaurant.cuisineTypes.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Service Options */}
        <div className="flex gap-2 mb-3">
          {restaurant.dineIn && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
              💺 Dine-In
            </span>
          )}
          {restaurant.takeout && (
            <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded font-medium">
              📦 Takeout
            </span>
          )}
          {restaurant.delivery && (
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded font-medium">
              🚚 Delivery
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex-1 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            View Details
          </button>
          <button
            onClick={handleShare}
            className="w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-lg flex items-center justify-center transition-colors"
          >
            <Share2 className="w-5 h-5 text-blue-700" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGetDirections(restaurant);
            }}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
          >
            <Navigation className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}