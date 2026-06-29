
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Star, Clock, DollarSign,
  Navigation, Share2, Bookmark, Camera,
  ThumbsUp, MessageCircle, ChevronLeft, ChevronRight,
  Info, AlertCircle, X, TrendingUp, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from "@/utils";
import MapAppSelector from '../components/MapAppSelector';
import { invokeLLM } from "@/lib/callWorker";
import { showToast } from "../components/Toast";
import { useDismissable } from '@/lib/dismissStack';

export default function ActivityDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activity, setActivity] = useState(null);
  const [activityLocation, setActivityLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showShareModal, setShowShareModal] = useState(false);
  const [enhancedDetails, setEnhancedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [imageLoading, setImageLoading] = useState({});
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [showTimeExplanation, setShowTimeExplanation] = useState(false);

  useEffect(() => {
    loadActivityDetails();
    loadDistancePreference();
  }, []);

  useDismissable(showShareModal, () => setShowShareModal(false));

  const loadDistancePreference = () => {
    try {
      const saved = localStorage.getItem('distance_unit') || 'km';
      setDistanceUnit(saved);
    } catch (error) {
      console.error('Error loading distance preference:', error);
    }
  };

  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distance_unit', newUnit);
  };

  const convertDistance = (km) => {
    return {
      km: Math.round(km * 10) / 10,
      mi: Math.round(km * 0.621371 * 10) / 10
    };
  };

  const displayDistance = (distanceKm) => {
    const { km, mi } = convertDistance(distanceKm);
    return distanceUnit === 'km' ? `${km} km` : `${mi} mi`;
  };

  const getDefaultTimeReasons = (bestTime) => {
    const reasons = {
      'Morning': [
        'Fewer crowds before peak hours',
        'Cooler temperatures for comfortable exploring',
        'Better natural lighting for photos',
        'More time to explore at your own pace'
      ],
      'Afternoon': [
        'More activities and tours available',
        'All facilities fully operational',
        'Ideal temperature and lighting conditions'
      ],
      'Evening': [
        'Beautiful sunset views',
        'Fewer daytime crowds',
        'Unique nighttime atmosphere',
        'Special evening programs often available'
      ],
      'Sunset': [
        'Spectacular sunset views',
        'Perfect golden hour lighting for photography',
        'Romantic atmosphere',
        'Transition to nighttime entertainment'
      ],
      'Anytime': [
        'Flexible visiting hours',
        'Indoor attraction - weather independent',
        'Consistent experience throughout the day'
      ]
    };

    return reasons[bestTime] || reasons['Morning'];
  };

  const loadActivityDetails = async () => {
    setLoading(true);
    try {
      const storedActivity = sessionStorage.getItem('current_activity');
      const storedLocation = sessionStorage.getItem('activity_location');

      if (storedActivity) {
        const activityData = JSON.parse(storedActivity);
        setActivity(activityData);

        if (storedLocation) {
          setActivityLocation(JSON.parse(storedLocation));
        }

        const saved = localStorage.getItem('saved_activities') || '[]';
        setIsSaved(JSON.parse(saved).includes(activityData.id));

        await loadEnhancedDetails(activityData);
      }
    } catch (error) {
      console.error('Error loading activity:', error);
    }
    setLoading(false);
  };

  const loadEnhancedDetails = async (activityData) => {
    setLoadingDetails(true);
    try {
      const result = await invokeLLM({
        prompt: `Provide 3-5 visitor tips for: ${activityData.name}. Return JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            tips: { type: "array", items: { type: "string" } }
          }
        },
        add_context_from_internet: true
      });

      setEnhancedDetails(result);
    } catch (error) {
      console.error('Error loading enhanced details:', error);
    }
    setLoadingDetails(false);
  };

  const handleSaveActivity = () => {
    const saved = JSON.parse(localStorage.getItem('saved_activities') || '[]');

    if (isSaved) {
      const updated = saved.filter(id => id !== activity.id);
      localStorage.setItem('saved_activities', JSON.stringify(updated));
      setIsSaved(false);
    } else {
      saved.push(activity.id);
      localStorage.setItem('saved_activities', JSON.stringify(saved));
      setIsSaved(true);
    }
  };

  const handleShare = async () => {
    // Try to use native share if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: activity.name,
          text: `Check out ${activity.name} on Globeskimmers!`,
          url: window.location.href
        });
        return;
      } catch {
        // If share fails (e.g., in iframe or user cancels), fall back to modal
      }
    }
    
    // Fallback to custom share modal
    setShowShareModal(true);
  };

  const getPriceDisplay = (priceLevel) => {
    switch (priceLevel) {
      case 'free': return 'Free Entry';
      case 'budget': return '$';
      case 'moderate': return '$$';
      case 'expensive': return '$$$';
      default: return 'N/A';
    }
  };

  const getCategoryEmoji = (category) => {
    const categoryMap = {
      'museum': '🏛️',
      'park': '🌳',
      'amusement_park': '🎢',
      'zoo': '🦁',
      'aquarium': '🐠',
      'art_gallery': '🎨',
      'tourist_attraction': '🗼',
      'restaurant': '🍽️',
      'shopping': '🛍️',
      'beach': '🏖️',
      'temple': '⛩️',
      'church': '⛪',
      'castle': '🏰',
      'monument': '🗿'
    };
    return categoryMap[category] || '🎯';
  };

  const getSimilarActivityImage = (activityName, category) => {
    // Use Unsplash Source API for relevant images
    const searchQuery = activityName.replace(/\s+/g, ',');
    return `https://source.unsplash.com/400x400/?${encodeURIComponent(searchQuery)},landmark,travel`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-5">
        <AlertCircle className="w-16 h-16 text-gray-400 mb-3" />
        <p className="text-[calc(18px*var(--fs))] font-bold text-gray-900 mb-2">Activity Not Found</p>
        <p className="text-[calc(14px*var(--fs))] text-gray-600 mb-4">We couldn't find this activity.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const photos = activity.photos || [];
  const reviews = activity.reviews || [];

  return (
    <div className="min-h-screen pb-20 font-sans" style={{ background: '#FFFCF7' }}>
      {/* Floating Header - Over Photo */}
      <div className="fixed top-0 left-0 right-0 z-30">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent pointer-events-none"></div>

        <div className="relative max-w-[600px] mx-auto flex items-center justify-between px-5 py-4">
          <button
            onClick={() => navigate(createPageUrl("ThingsToDo"))}
            className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-md hover:bg-white flex items-center justify-center transition-all shadow-lg"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-md hover:bg-white flex items-center justify-center transition-all shadow-lg"
            >
              <Share2 className="w-5 h-5 text-gray-900" />
            </button>

            <button
              onClick={handleSaveActivity}
              className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-lg ${
                isSaved
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-white/90 hover:bg-white'
              }`}
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isSaved ? 'fill-white text-white' : 'text-gray-900'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative mt-0">
        <div className="h-[300px] bg-gray-200 relative overflow-hidden">
          {photos.length > 0 ? (
            <>
              {!imageLoading[currentImageIndex] && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse"></div>
              )}

              <img
                src={photos[currentImageIndex]}
                alt={activity.name}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoading[currentImageIndex] ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoading(prev => ({...prev, [currentImageIndex]: true}))}
                loading="eager"
              />

              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? photos.length - 1 : prev - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === photos.length - 1 ? 0 : prev + 1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-[calc(12px*var(--fs))] font-semibold z-10">
                    {currentImageIndex + 1} / {photos.length}
                  </div>
                </>
              )}

              <button
                onClick={() => setShowFullGallery(true)}
                className="absolute bottom-3 left-3 px-4 py-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-900 text-[calc(13px*var(--fs))] font-semibold flex items-center gap-2 hover:bg-white transition-colors shadow-lg z-10"
              >
                <Camera className="w-4 h-4" />
                View All {photos.length} Photo{photos.length > 1 ? 's' : ''}
              </button>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
              <span className="text-white/80 text-6xl">
                {activity.category === 'museum' ? '🏛️' :
                 activity.category === 'park' ? '🌳' :
                 activity.category === 'amusement_park' ? '🎢' :
                 activity.category === 'zoo' ? '🦁' :
                 activity.category === 'aquarium' ? '🐠' :
                 activity.category === 'art_gallery' ? '🎨' : '🎯'}
              </span>
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide bg-gray-50">
            {photos.map((photo, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentImageIndex
                    ? 'border-purple-600 scale-105 shadow-md'
                    : 'border-gray-300 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={photo}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-[600px] mx-auto px-5">
        {/* Title & Info */}
        <div className="bg-white rounded-b-[24px] shadow-md px-5 py-5 -mt-6 relative z-10">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-[calc(24px*var(--fs))] font-bold text-gray-900 leading-tight">
              {activity.name}
            </h1>
            {activity.popular && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 rounded-full flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <span className="text-[calc(11px*var(--fs))] font-bold text-orange-600">Popular</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-[calc(16px*var(--fs))] text-gray-900">{activity.rating}</span>
              <span className="text-[calc(14px*var(--fs))] text-gray-600">({activity.reviews_count})</span>
            </div>

            <span className="text-gray-400">•</span>

            <div className="flex items-center gap-1.5 text-[calc(14px*var(--fs))] font-semibold text-gray-700">
              <DollarSign className="w-4 h-4" />
              <span>{getPriceDisplay(activity.price_level)}</span>
            </div>
          </div>

          {/* Distance with toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[calc(14px*var(--fs))] text-gray-700">
              <MapPin className="w-4 h-4 text-purple-600" />
              <span className="font-semibold">
                {displayDistance(activity.distance_km)} away
              </span>
            </div>

            <button
              onClick={toggleDistanceUnit}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span className="text-[calc(13px*var(--fs))] font-semibold text-gray-700">
                Switch to {distanceUnit === 'km' ? 'miles' : 'km'}
              </span>
            </button>
          </div>

          {/* Duration & Best Time Cards with thumbnails */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 overflow-hidden">
              {activity.mainPhoto && (
                <div className="absolute inset-0 opacity-20">
                  <img src={activity.mainPhoto} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-[calc(11px*var(--fs))] text-white/80 font-semibold uppercase">Duration</span>
                </div>
                <p className="text-[calc(18px*var(--fs))] font-bold text-white">
                  {activity.duration || '2-3 hours'}
                </p>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 overflow-hidden">
              {activity.mainPhoto && (
                <div className="absolute inset-0 opacity-20">
                  <img src={activity.mainPhoto} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <Sun className="w-4 h-4 text-white" />
                  <span className="text-[calc(11px*var(--fs))] text-white/80 font-semibold uppercase">Best Time</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[calc(18px*var(--fs))] font-bold text-white">
                    {activity.best_time || 'Morning'}
                  </p>
                  <button
                    onClick={() => setShowTimeExplanation(!showTimeExplanation)}
                    className="w-5 h-5 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors"
                  >
                    <span className="text-[calc(11px*var(--fs))] font-bold text-white">?</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Time Explanation (expandable) */}
          <AnimatePresence>
            {showTimeExplanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 overflow-hidden"
              >
                <h4 className="text-[calc(14px*var(--fs))] font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Why {activity.best_time || 'Morning'} is Best
                </h4>
                <ul className="space-y-2 text-[calc(13px*var(--fs))] text-blue-800">
                  {(activity.best_time_reasons || getDefaultTimeReasons(activity.best_time || 'Morning')).map((reason, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-blue-500">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {activity.opening_hours && (
            <div className="mb-4">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[calc(13px*var(--fs))] font-bold ${
                activity.opening_hours.open_now
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  activity.opening_hours.open_now ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                {activity.opening_hours.open_now ? 'Open Now' : 'Closed'}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (activityLocation) {
                  setShowMapSelector(true);
                }
              }}
              className="flex-1 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold text-[calc(15px*var(--fs))] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md"
            >
              <Navigation className="w-5 h-5" />
              Get Directions
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 mt-4 overflow-x-auto scrollbar-hide">
          {['overview', 'reviews'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl font-semibold text-[calc(14px*var(--fs))] whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-500'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-5">
              <h3 className="text-[calc(17px*var(--fs))] font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-purple-600" />
                About
              </h3>
              <p className="text-[calc(15px*var(--fs))] text-gray-700 leading-relaxed">
                {activity.description}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-5">
              <h3 className="text-[calc(17px*var(--fs))] font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600" />
                Location
              </h3>
              <p className="text-[calc(14px*var(--fs))] text-gray-700">{activity.address}</p>
            </div>

            {/* Opening Hours Section */}
            {activity.opening_hours && activity.opening_hours.weekday_text && activity.opening_hours.weekday_text.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-5">
                <h3 className="text-[calc(17px*var(--fs))] font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  Opening Hours
                </h3>
                <div className="space-y-2">
                  {activity.opening_hours.weekday_text.map((daySchedule, index) => {
                    const [day, hours] = daySchedule.split(': ');
                    // JavaScript getDay() returns 0 for Sunday, 1 for Monday... 6 for Saturday
                    // Google Place API weekday_text is typically formatted: Monday, Tuesday, ... Sunday
                    // If Google's format consistently starts with Monday, then index 0 is Monday, index 6 is Sunday.
                    // Today's day (0=Sunday, 1=Monday, ..., 6=Saturday)
                    // We need to map Google's order (Mon-Sun) to JS getDay() (Sun-Sat)
                    const today = new Date().getDay(); // 0 (Sun) - 6 (Sat)
                    const googleDaysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    const currentDayName = googleDaysOrder[index];
                    
                    // Map currentDayName to JS getDay() value
                    const dayIndexMap = {
                      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
                      'Thursday': 4, 'Friday': 5, 'Saturday': 6
                    };
                    const isToday = dayIndexMap[currentDayName] === today;
                    
                    return (
                      <div
                        key={index}
                        className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                          isToday ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'
                        }`}
                      >
                        <span className={`text-[calc(14px*var(--fs))] font-semibold ${
                          isToday ? 'text-purple-700' : 'text-gray-700'
                        }`}>
                          {day}
                        </span>
                        <span className={`text-[calc(14px*var(--fs))] ${
                          isToday ? 'text-purple-600 font-semibold' : 'text-gray-600'
                        }`}>
                          {hours}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pricing Section */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <h3 className="text-[calc(17px*var(--fs))] font-bold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Pricing
              </h3>

              <div className="text-center py-4">
                <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-[calc(14px*var(--fs))] text-gray-600 mb-2">
                  Price Level: {getPriceDisplay(activity.price_level)}
                </p>
                <p className="text-[calc(13px*var(--fs))] text-gray-500">
                  Contact venue for detailed pricing information
                </p>
              </div>
            </div>

            {(enhancedDetails?.tips || activity.tip) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="text-[calc(16px*var(--fs))] font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Good to Know
                </h3>
                <ul className="space-y-2">
                  {activity.tip && (
                    <li className="text-[calc(14px*var(--fs))] text-blue-800 flex gap-2">
                      <span className="text-blue-500">•</span>
                      <span>{activity.tip}</span>
                    </li>
                  )}
                  {enhancedDetails?.tips && enhancedDetails.tips.map((tip, index) => (
                    <li key={index} className="text-[calc(14px*var(--fs))] text-blue-800 flex gap-2">
                      <span className="text-blue-500">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-[calc(48px*var(--fs))] font-bold text-gray-900">{activity.rating}</div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(activity.rating)
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-[calc(12px*var(--fs))] text-gray-600">{activity.reviews_count} reviews</div>
                </div>
              </div>
            </div>

            {reviews.length > 0 ? (
              reviews.map((review, index) => (
                <div key={index} className="bg-white rounded-xl shadow-md p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-[calc(14px*var(--fs))] flex-shrink-0">
                      {review.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-[calc(15px*var(--fs))] text-gray-900">{review.author_name}</p>
                        <span className="text-[calc(12px*var(--fs))] text-gray-500">
                          {new Date(review.time * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[calc(14px*var(--fs))] text-gray-700 leading-relaxed">{review.text}</p>
                      <button className="flex items-center gap-2 mt-3 text-[calc(13px*var(--fs))] text-gray-600 hover:text-purple-600 transition-colors">
                        <ThumbsUp className="w-4 h-4" />
                        <span>Helpful ({review.helpful_count})</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl shadow-md p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-[calc(15px*var(--fs))] text-gray-600">No reviews yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-[24px] w-full max-w-[600px] p-5 pb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[calc(18px*var(--fs))] font-bold text-gray-900">Share Activity</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  // Replaced alert('Link copied!') with the global toast
                  // helper — alerts look like a browser dialog in a
                  // native app, which is jarring on the polished detail
                  // modal that already has motion / blur / glass styling.
                  showToast('Link copied to clipboard', 'success');
                  setShowShareModal(false);
                }}
                className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-semibold text-[calc(15px*var(--fs))] text-gray-900">Copy Link</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activityLocation && (
        <MapAppSelector
          isOpen={showMapSelector}
          onClose={() => setShowMapSelector(false)}
          destination={{
            latitude: activityLocation.latitude,
            longitude: activityLocation.longitude,
            name: activity.name,
            address: activity.address
          }}
        />
      )}

    </div>
  );
}
