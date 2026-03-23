import React, { useState } from "react";
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CUISINE_OPTIONS = [
  { value: 'italian', label: 'Italian', icon: '🍝' },
  { value: 'mexican', label: 'Mexican', icon: '🌮' },
  { value: 'chinese', label: 'Chinese', icon: '🥡' },
  { value: 'japanese', label: 'Japanese', icon: '🍣' },
  { value: 'thai', label: 'Thai', icon: '🍜' },
  { value: 'indian', label: 'Indian', icon: '🍛' },
  { value: 'american', label: 'American', icon: '🍔' },
  { value: 'french', label: 'French', icon: '🥖' },
  { value: 'korean', label: 'Korean', icon: '🍲' },
  { value: 'mediterranean', label: 'Mediterranean', icon: '🥙' },
  { value: 'vietnamese', label: 'Vietnamese', icon: '🍲' },
  { value: 'greek', label: 'Greek', icon: '🥙' },
  { value: 'spanish', label: 'Spanish', icon: '🥘' },
  { value: 'turkish', label: 'Turkish', icon: '🥙' },
  { value: 'lebanese', label: 'Lebanese', icon: '🥙' },
  { value: 'seafood', label: 'Seafood', icon: '🦞' },
  { value: 'filipino', label: 'Filipino', icon: '🍚' },
  { value: 'pizza', label: 'Pizza', icon: '🍕' },
  { value: 'sushi', label: 'Sushi', icon: '🍣' },
  { value: 'ramen', label: 'Ramen', icon: '🍜' },
  { value: 'steakhouse', label: 'Steakhouse', icon: '🥩' },
];

const PRICE_OPTIONS = [
  { value: 1, label: '$', description: 'Budget' },
  { value: 2, label: '$$', description: 'Moderate' },
  { value: 3, label: '$$$', description: 'Upscale' },
  { value: 4, label: '$$$$', description: 'Fine Dining' }
];

const QUICK_MEAL_OPTIONS = [
  { value: 'quick', label: 'Fast foods', icon: '🍔' },
];

const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'halal', label: 'Halal', icon: '☪️' },
  { value: 'kosher', label: 'Kosher', icon: '✡️' },
];

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast', icon: '🍳' },
  { value: 'brunch', label: 'Brunch', icon: '🥞' },
  { value: 'lunch', label: 'Lunch', icon: '🍱' },
  { value: 'dinner', label: 'Dinner', icon: '🍽️' },
];

const AMENITY_OPTIONS = [
  { value: 'outdoorSeating', label: 'Outdoor Seating', icon: '🌳' },
  { value: 'liveMusic', label: 'Live Music', icon: '🎵' },
  { value: 'goodForChildren', label: 'Good for Kids', icon: '👶' },
  { value: 'goodForGroups', label: 'Good for Groups', icon: '👥' },
  { value: 'goodForWatchingSports', label: 'Sports Viewing', icon: '📺' },
  { value: 'servesVegetarianFood', label: 'Vegetarian Options', icon: '🥗' },
  { value: 'wifi', label: 'Wi-Fi', icon: '📶' },
  { value: 'workFriendly', label: 'Work Friendly', icon: '💻' },
  { value: 'buffet', label: 'Buffet/AYCE', icon: '🍱' },
  { value: 'reservationOnly', label: 'Reservations', icon: '📅' },
];

const TRAVELER_CATEGORIES = [
  { id: 'local_gem', label: 'Local Gems', icon: '💎', color: 'purple' },
  { id: 'safe_familiar', label: 'Safe & Familiar', icon: '🏠', color: 'blue' },
  { id: 'budget_eats', label: 'Budget Eats', icon: '💰', color: 'green' },
  { id: 'nice_dinner', label: 'Nice Dinner', icon: '⭐', color: 'yellow' },
  { id: 'quick_bite', label: 'Quick Bite', icon: '⚡', color: 'orange' },
  { id: 'walking_distance', label: 'Walking Distance', icon: '🚶', color: 'teal' },
];

const COLOR_CLASSES = {
  purple: { activeBg: 'bg-purple-600', activeText: 'text-white' },
  blue: { activeBg: 'bg-blue-600', activeText: 'text-white' },
  green: { activeBg: 'bg-green-600', activeText: 'text-white' },
  yellow: { activeBg: 'bg-yellow-600', activeText: 'text-white' },
  orange: { activeBg: 'bg-orange-600', activeText: 'text-white' },
  teal: { activeBg: 'bg-teal-600', activeText: 'text-white' },
};

const RATING_OPTIONS = [
  { value: 1.0, label: '1.0+ ⭐' },
  { value: 2.0, label: '2.0+ ⭐' },
  { value: 3.0, label: '3.0+ ⭐' },
  { value: 4.0, label: '4.0+ ⭐' },
  { value: 5.0, label: '5.0 ⭐' },
];

export default function SmartFilters({ filters, onFilterChange, onClearFilters, searchRadius, onRadiusChange, radiusOptions }) {
  const [expanded, setExpanded] = useState(false);

  const handleQuickFilterToggle = (key, value) => {
    const newFilters = { ...filters };
    
    if (newFilters[key] === value) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    
    onFilterChange(newFilters);
  };

  const handleDietaryToggle = (dietary) => {
    const newFilters = { ...filters };
    
    if (!newFilters.dietary) {
      newFilters.dietary = {};
    }
    
    if (newFilters.dietary[dietary]) {
      delete newFilters.dietary[dietary];
      if (Object.keys(newFilters.dietary).length === 0) {
        delete newFilters.dietary;
      }
    } else {
      newFilters.dietary[dietary] = true;
    }
    
    onFilterChange(newFilters);
  };

  const handleMealToggle = (meal) => {
    const newFilters = { ...filters };
    
    if (!newFilters.meals) {
      newFilters.meals = {};
    }
    
    if (newFilters.meals[meal]) {
      delete newFilters.meals[meal];
      if (Object.keys(newFilters.meals).length === 0) {
        delete newFilters.meals;
      }
    } else {
      newFilters.meals[meal] = true;
    }
    
    onFilterChange(newFilters);
  };

  const handleAmenityToggle = (amenity) => {
    const newFilters = { ...filters };
    
    if (newFilters[amenity]) {
      delete newFilters[amenity];
    } else {
      newFilters[amenity] = true;
    }
    
    onFilterChange(newFilters);
  };

  const handleCuisineToggle = (cuisine) => {
    const newFilters = { ...filters };
    const currentCuisines = newFilters.cuisines || [];
    
    if (currentCuisines.includes(cuisine)) {
      newFilters.cuisines = currentCuisines.filter(c => c !== cuisine);
    } else {
      newFilters.cuisines = [...currentCuisines, cuisine];
    }
    
    if (newFilters.cuisines.length === 0) {
      delete newFilters.cuisines;
    }
    
    onFilterChange(newFilters);
  };

  const handlePriceToggle = (price) => {
    const newFilters = { ...filters };
    const currentPrices = newFilters.priceLevels || [];
    
    if (currentPrices.includes(price)) {
      newFilters.priceLevels = currentPrices.filter(p => p !== price);
    } else {
      newFilters.priceLevels = [...currentPrices, price];
    }
    
    if (newFilters.priceLevels.length === 0) {
      delete newFilters.priceLevels;
    }
    
    onFilterChange(newFilters);
  };

  // Count active filters excluding openNow (it's a default)
  const activeFilterCount = Object.keys(filters).filter(key => key !== 'openNow').length;

  return (
    <div className="mb-6">
      {/* Quick Filters - Open Now, Radius, Quick Meal Options */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-2">
        <button
          onClick={() => handleQuickFilterToggle('openNow', true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
            filters.openNow
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-sm">🟢</span>
          <span>Open Now</span>
        </button>

        {/* Search Radius Selector */}
        <Select value={searchRadius.toString()} onValueChange={(value) => onRadiusChange(parseInt(value))}>
          <SelectTrigger className="h-auto px-2.5 py-1.5 rounded-full border border-gray-200 bg-white hover:border-gray-300 transition-colors flex-shrink-0 text-xs font-medium w-[70px]">
            <div className="flex items-center gap-1">
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {radiusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {QUICK_MEAL_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => handleQuickFilterToggle('mealType', option.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              filters.mealType === option.value
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-sm">{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      {/* Advanced Filters Toggle */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          <span>Advanced Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 font-semibold hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl shadow-lg p-5 space-y-5 relative max-h-[70vh] overflow-y-auto">
              {/* Sticky Close Button */}
              <button
                onClick={() => setExpanded(false)}
                className="sticky top-0 right-0 float-right z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors shadow-md"
              >
                <X className="w-4 h-4 text-gray-700" />
              </button>
              {/* Cuisine */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Cuisine</h4>
                <div className="flex flex-wrap gap-2">
                  {CUISINE_OPTIONS.map(cuisine => (
                    <button
                      key={cuisine.value}
                      onClick={() => handleCuisineToggle(cuisine.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        filters.cuisines?.includes(cuisine.value)
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cuisine.icon} {cuisine.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Price</h4>
                <div className="flex gap-2">
                  {PRICE_OPTIONS.map(price => (
                    <button
                      key={price.value}
                      onClick={() => handlePriceToggle(price.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        filters.priceLevels?.includes(price.value)
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="font-bold">{price.label}</div>
                      <div className="text-xs opacity-80">{price.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Dietary</h4>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleDietaryToggle(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        filters.dietary?.[option.value]
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.icon} {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meals */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Meals</h4>
                <div className="flex flex-wrap gap-2">
                  {MEAL_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleMealToggle(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        filters.meals?.[option.value]
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.icon} {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Amenities & Features</h4>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleAmenityToggle(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        filters[option.value]
                          ? 'bg-teal-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.icon} {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Minimum Rating</h4>
                <div className="flex gap-2">
                  {RATING_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleQuickFilterToggle('minRating', option.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        filters.minRating === option.value
                          ? 'bg-yellow-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Options */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Service</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleQuickFilterToggle('dineIn', true)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filters.dineIn
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    💺 Dine-In
                  </button>
                  <button
                    onClick={() => handleQuickFilterToggle('takeout', true)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filters.takeout
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    📦 Takeout
                  </button>
                  <button
                    onClick={() => handleQuickFilterToggle('delivery', true)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      filters.delivery
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🚚 Delivery
                  </button>
                </div>
              </div>

              {/* Traveler Favorites */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-3">Traveler Favorites</h4>
                <div className="flex flex-wrap gap-2">
                  {TRAVELER_CATEGORIES.slice(1).map(category => (
                    <button
                      key={category.id}
                      onClick={() => handleQuickFilterToggle('travelerCategory', category.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        filters.travelerCategory === category.id
                          ? `${COLOR_CLASSES[category.color].activeBg} ${COLOR_CLASSES[category.color].activeText} shadow-md`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category.icon} {category.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}