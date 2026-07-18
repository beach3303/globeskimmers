import React, { useState } from "react";
import { X, Star, MapPin, Phone, Globe, Clock, Navigation, Share2, Heart, Info, ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDismissable } from '@/lib/dismissStack';
import useHorizontalSwipe from '@/lib/useHorizontalSwipe';

const PRICE_DISPLAY = {
  0: '$',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$'
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RestaurantDetail({ restaurant, isOpen, onClose, onGetDirections, distanceUnit = "km" }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSaved, setIsSaved] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useDismissable(!!(isOpen && restaurant), onClose);

  // Swipe left/right on the header photo to page through the gallery.
  const swipe = useHorizontalSwipe({ onLeft: () => nextPhoto(), onRight: () => prevPhoto() });

  if (!isOpen || !restaurant) return null;

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

  const getWalkTime = (distanceMeters) => {
    if (!distanceMeters) return null;
    const minutes = Math.round((distanceMeters / 1000) * 12);
    return minutes;
  };

  const handleShare = () => {
    const shareText = `Check out ${restaurant.name}!\n\n` +
      `📍 ${restaurant.address}\n` +
      `⭐ ${restaurant.rating?.toFixed(1)} (${restaurant.userRatingsTotal} reviews)\n` +
      `💰 ${PRICE_DISPLAY[restaurant.priceLevel] || 'N/A'}\n` +
      `📞 ${restaurant.phoneNumber || 'Phone not available'}\n` +
      `🌐 ${restaurant.website || 'Website not available'}`;
    
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

  const handleSave = () => {
    setIsSaved(!isSaved);
  };

  const nextPhoto = () => {
    if (restaurant.photos && restaurant.photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % restaurant.photos.length);
    }
  };

  const prevPhoto = () => {
    if (restaurant.photos && restaurant.photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev - 1 + restaurant.photos.length) % restaurant.photos.length);
    }
  };

  const walkTime = getWalkTime(restaurant.distanceMeters);
  const photos = restaurant.photos || [];
  const currentPhoto = photos[currentPhotoIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="bg-white w-full sm:max-w-2xl sm:rounded-t-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto pb-32"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Image Gallery */}
          {photos.length > 0 ? (
            <div className="relative h-64 overflow-hidden" {...swipe}>
              <img
                src={currentPhoto.url}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg z-10"
              >
                <X className="w-6 h-6 text-gray-900" />
              </button>

              {/* Photo Navigation */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      prevPhoto();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-900" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextPhoto();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-900" />
                  </button>

                  {/* Photo Indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPhotoIndex(idx);
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentPhotoIndex
                            ? 'bg-white w-6'
                            : 'bg-white/60 hover:bg-white/80'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="relative h-64 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-8xl">🍽️</span>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
              >
                <X className="w-6 h-6 text-gray-900" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {/* Title & Actions */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{restaurant.name}</h2>
                
                {/* Rating & Price */}
                <div className="flex items-center gap-3 mb-2">
                  {restaurant.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-gray-900">{restaurant.rating.toFixed(1)}</span>
                      {restaurant.userRatingsTotal && (
                        <span className="text-sm text-gray-500">({restaurant.userRatingsTotal})</span>
                      )}
                    </div>
                  )}
                  
                  {restaurant.priceLevel !== undefined && restaurant.priceLevel > 0 && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="font-bold text-gray-700 text-lg">{PRICE_DISPLAY[restaurant.priceLevel]}</span>
                    </>
                  )}

                  {restaurant.category && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">{restaurant.category}</span>
                    </>
                  )}
                </div>

                {/* Distance with Open/Closed Status */}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-gray-900">{formatDistance(restaurant.distanceMeters)}</span>
                  
                  {/* Open/Closed Status next to distance */}
                  {restaurant.openNow !== undefined && (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      restaurant.openNow 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {restaurant.openNow ? '🟢 Open' : '🔴 Closed'}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                </button>
                <button
                  onClick={handleShare}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <Share2 className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>

            {/* Service Options */}
            {(restaurant.dineIn || restaurant.takeout || restaurant.delivery) && (
              <div className="flex gap-2 mb-4">
                {restaurant.dineIn && (
                  <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-semibold">
                    💺 Dine-In
                  </span>
                )}
                {restaurant.takeout && (
                  <span className="text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-semibold">
                    📦 Takeout
                  </span>
                )}
                {restaurant.delivery && (
                  <span className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg font-semibold">
                    🚚 Delivery
                  </span>
                )}
              </div>
            )}

            {/* Tabs - Only Overview and Hours */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab("overview")}
                className={`pb-3 px-4 text-sm font-semibold transition-colors ${
                  activeTab === "overview"
                    ? 'text-[#667eea] border-b-2 border-[#667eea]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Info className="w-4 h-4 inline mr-1" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab("hours")}
                className={`pb-3 px-4 text-sm font-semibold transition-colors ${
                  activeTab === "hours"
                    ? 'text-[#667eea] border-b-2 border-[#667eea]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-1" />
                Hours
              </button>
              <button
                onClick={() => setActiveTab("menu")}
                className={`pb-3 px-4 text-sm font-semibold transition-colors ${
                  activeTab === "menu"
                    ? 'text-[#667eea] border-b-2 border-[#667eea]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Utensils className="w-4 h-4 inline mr-1" />
                Menu
              </button>
            </div>

            {/* Tab Content */}
            <div className="mb-6">
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* Address */}
                  {restaurant.address && (
                    <div className="flex gap-3">
                      <MapPin className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">Address</p>
                        <p className="text-sm text-gray-700">{restaurant.address}</p>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {restaurant.phoneNumber && (
                    <div className="flex gap-3">
                      <Phone className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">Phone</p>
                        <a href={`tel:${restaurant.phoneNumber}`} className="text-sm text-blue-600 hover:underline">
                          {restaurant.phoneNumber}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Website */}
                  {restaurant.website && (
                    <div className="flex gap-3">
                      <Globe className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">Website</p>
                        <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                          Visit Website
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Cuisine Types */}
                  {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">Cuisine</p>
                      <div className="flex flex-wrap gap-2">
                        {restaurant.cuisineTypes.map((cuisine, idx) => (
                          <span key={idx} className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                            {cuisine}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "hours" && (
                <div>
                  {restaurant.openingHours?.weekday_text ? (
                    <div className="space-y-2">
                      {DAYS.map((day, idx) => {
                        const dayText = restaurant.openingHours.weekday_text[idx];
                        const isToday = new Date().getDay() === idx;
                        
                        return (
                          <div
                            key={day}
                            className={`flex justify-between py-2 px-3 rounded-lg ${
                              isToday ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                            }`}
                          >
                            <span className={`font-semibold ${isToday ? 'text-blue-900' : 'text-gray-700'}`}>
                              {day}
                            </span>
                            <span className={`text-sm ${isToday ? 'text-blue-800' : 'text-gray-600'}`}>
                              {dayText?.split(': ')[1] || 'Closed'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-center py-8">Hours information not available</p>
                  )}
                </div>
              )}

              {activeTab === "menu" && (
                <div>
                  {restaurant.website ? (
                    <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-6 text-center">
                      <Utensils className="w-12 h-12 text-orange-600 mx-auto mb-3" />
                      <h3 className="font-bold text-gray-900 mb-2">View Full Menu</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Visit the restaurant's website to see their complete menu with prices and descriptions.
                      </p>
                      <a
                        href={restaurant.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                      >
                        View Menu on Website →
                      </a>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center">
                      <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <h3 className="font-bold text-gray-900 mb-2">Menu Not Available</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        The restaurant's menu is not available online. Please call them directly for menu information.
                      </p>
                      {restaurant.phoneNumber && (
                        <a
                          href={`tel:${restaurant.phoneNumber}`}
                          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                          📞 Call Restaurant
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Get Directions Button */}
            <button
              onClick={() => {
                onGetDirections(restaurant);
                onClose();
              }}
              className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
            >
              <Navigation className="w-6 h-6" />
              Get Directions
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}