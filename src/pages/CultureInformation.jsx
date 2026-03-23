import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Loader2, Navigation, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";

// ============================================================================
// FIX: CACHING SYSTEM - Saves ~$100-300/month in LLM costs
// Culture data rarely changes, so we cache it for 30 days
// ============================================================================
const CACHE_VERSION = 'v1';
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const getCacheKey = (country, city) => `culture_cache_${CACHE_VERSION}_${country}_${city}`;

const getCachedData = (country, city) => {
  try {
    const key = getCacheKey(country, city);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    // Check if cache is still valid (30 days)
    if (age > CACHE_DURATION_MS) {
      localStorage.removeItem(key);
      return null;
    }
    
    console.log(`📦 Using cached culture data for ${country}/${city} (age: ${Math.round(age / 86400000)} days)`);
    return data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
};

const setCachedData = (country, city, data) => {
  try {
    const key = getCacheKey(country, city);
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
    console.log(`💾 Cached culture data for ${country}/${city}`);
  } catch (error) {
    console.error('Cache write error:', error);
    // If localStorage is full, try to clear old culture caches
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('culture_cache_'));
      if (keys.length > 10) {
        // Remove oldest 5 entries
        keys.slice(0, 5).forEach(k => localStorage.removeItem(k));
        // Try again
        localStorage.setItem(getCacheKey(country, city), JSON.stringify({ data, timestamp: Date.now() }));
      }
    } catch (e) {
      console.error('Cache cleanup failed:', e);
    }
  }
};

const clearCache = (country, city) => {
  try {
    localStorage.removeItem(getCacheKey(country, city));
    console.log(`🗑️ Cleared cache for ${country}/${city}`);
  } catch (error) {
    console.error('Cache clear error:', error);
  }
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function CultureInformationPage() {
  const navigate = useNavigate();
  const { activeLocation, locationMode, initialized, switchToCurrentLocation } = useLocation();
  const [loading, setLoading] = useState(true);
  const [cultureData, setCultureData] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    if (initialized && activeLocation?.address) {
      loadCultureData();
    }
  }, [activeLocation, initialized]);

  // ============================================================================
  // LLM CALL FUNCTIONS (only called on cache miss)
  // ============================================================================
  const getCountryBasics = async (country) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `For ${country}, provide current leadership and basic information.
      
      CRITICAL: Use FULL names and proper titles.
      
      Include top 3-5 leaders based on:
      - If monarchy: Monarch, Crown Prince/Princess, Prime Minister, Deputy PM
      - If republic: President, Vice President, Prime Minister (if exists), Speaker
      
      For ${country}, who are the current top leaders?`,
      response_json_schema: {
        type: "object",
        properties: {
          country_name: { type: "string" },
          has_monarchy: { type: "boolean" },
          leadership: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                name: { type: "string" },
                position: { type: "string" }
              },
              required: ["title", "name", "position"]
            }
          },
          capital: { type: "string" },
          languages: { type: "array", items: { type: "string" } },
          currency: { type: "string" },
          population: { type: "string" },
          national_motto: { type: "string" },
          motto_english: { type: "string" }
        },
        required: ["country_name", "has_monarchy", "leadership", "capital", "languages", "currency", "population"]
      },
      add_context_from_internet: true
    });
    return result;
  };

  const getReligionData = async (country) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `For ${country}, provide specific religious demographics.
      
      CRITICAL RULES:
      - DO NOT just say "Christianity" - specify denomination (Roman Catholic, Protestant, Orthodox, etc.)
      - Use % symbol, not the word "percentage"
      - List religions from highest to lowest percentage
      - Be specific about Protestant types if significant (Evangelical, Pentecostal, etc.)
      
      What are the specific religious demographics for ${country}?`,
      response_json_schema: {
        type: "object",
        properties: {
          religions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                percentage: { type: "string" }
              },
              required: ["name", "percentage"]
            }
          }
        },
        required: ["religions"]
      },
      add_context_from_internet: true
    });
    return result;
  };

  const getFestivalsAndCelebrations = async (country) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `For ${country}, provide 4-6 major festivals and celebrations with dates and descriptions.`,
      response_json_schema: {
        type: "object",
        properties: {
          festivals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                date: { type: "string" },
                description: { type: "string" }
              },
              required: ["name", "date", "description"]
            }
          }
        },
        required: ["festivals"]
      },
      add_context_from_internet: true
    });
    return result;
  };

  const getClimateAndNature = async (country) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `For ${country}, provide climate and nature information with 3-5 top nature spots, and 5-7 wildlife species.`,
      response_json_schema: {
        type: "object",
        properties: {
          climate: {
            type: "object",
            properties: {
              type: { type: "string" },
              best_time_to_visit: { type: "string" },
              what_to_pack: { type: "array", items: { type: "string" } }
            },
            required: ["type", "best_time_to_visit", "what_to_pack"]
          },
          top_nature_spots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                activities: { type: "array", items: { type: "string" } }
              },
              required: ["name", "description", "activities"]
            }
          },
          wildlife: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" }
              },
              required: ["name", "description"]
            }
          }
        },
        required: ["climate", "top_nature_spots", "wildlife"]
      },
      add_context_from_internet: true
    });
    return result;
  };

  const getFoodAndEtiquette = async (country) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `For ${country}, provide 5-7 national dishes and cultural etiquette (DO and DON'T lists).`,
      response_json_schema: {
        type: "object",
        properties: {
          national_dishes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } },
                fun_fact: { type: "string" }
              },
              required: ["name", "description", "ingredients"]
            }
          },
          cultural_etiquette: {
            type: "object",
            properties: {
              do: { type: "array", items: { type: "string" } },
              dont: { type: "array", items: { type: "string" } }
            },
            required: ["do", "dont"]
          }
        },
        required: ["national_dishes", "cultural_etiquette"]
      },
      add_context_from_internet: true
    });
    return result;
  };

  const getHistoryAndHero = async (country) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `For ${country}, provide 3-5 historical highlights and the national hero with accomplishments.`,
      response_json_schema: {
        type: "object",
        properties: {
          historical_highlights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                significance: { type: "string" }
              },
              required: ["name", "description", "significance"]
            }
          },
          national_hero: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              accomplishments: { type: "array", items: { type: "string" } }
            },
            required: ["name", "description", "accomplishments"]
          }
        },
        required: ["historical_highlights", "national_hero"]
      },
      add_context_from_internet: true
    });
    return result;
  };

  const getCityInfo = async (city, country) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `For ${city}, ${country}, provide city-specific information.
      
      CRITICAL: Include FULL names and titles for city leaders (Mayor, Vice Mayor).
      Include what the city is known for, local dishes specific to this city, language/dialect, famous products, fun facts.`,
      response_json_schema: {
        type: "object",
        properties: {
          city_leadership: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                name: { type: "string" },
                full_title: { type: "string" }
              },
              required: ["title", "name"]
            }
          },
          known_for: { type: "string" },
          city_wildlife: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" }
              },
              required: ["name", "description"]
            }
          },
          local_dishes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } }
              },
              required: ["name", "description", "ingredients"]
            }
          },
          historical_contributions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                event: { type: "string" },
                significance: { type: "string" }
              },
              required: ["event", "significance"]
            }
          },
          fun_facts: { type: "array", items: { type: "string" } },
          language_dialect: {
            type: "object",
            properties: {
              name: { type: "string" },
              difference: { type: "string" }
            },
            required: ["name"]
          },
          famous_products: { type: "array", items: { type: "string" } }
        },
        required: ["city_leadership", "known_for", "local_dishes", "fun_facts", "language_dialect", "famous_products"]
      },
      add_context_from_internet: true
    });
    return result;
  };

  // ============================================================================
  // MAIN LOAD FUNCTION - WITH CACHING
  // ============================================================================
  const loadCultureData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setIsFromCache(false);
    
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      
      if (!isAuthenticated) {
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }

      if (!activeLocation?.address) return;

      const country = activeLocation.address.country;
      const city = activeLocation.address.city || activeLocation.placeName;
      
      // ============================================================================
      // FIX: CHECK CACHE FIRST - This saves 7 LLM calls (~$0.35) per cached hit
      // ============================================================================
      if (!forceRefresh) {
        const cached = getCachedData(country, city);
        if (cached) {
          setCultureData(cached);
          setIsFromCache(true);
          setLoading(false);
          return;
        }
      } else {
        // Clear cache if force refresh
        clearCache(country, city);
      }
      
      console.log(`🌐 Fetching fresh culture data for ${country}/${city} (7 LLM calls)...`);
      
      // Call all APIs in parallel for faster loading
      const [basics, religion, festivals, climateNature, foodEtiquette, history, cityInfo] = await Promise.all([
        getCountryBasics(country),
        getReligionData(country),
        getFestivalsAndCelebrations(country),
        getClimateAndNature(country),
        getFoodAndEtiquette(country),
        getHistoryAndHero(country),
        getCityInfo(city, country)
      ]);
      
      // Combine all data
      const combinedData = {
        country: {
          ...basics,
          religion: religion.religions,
          festivals: festivals.festivals,
          climate: climateNature.climate,
          nature_spots: climateNature.top_nature_spots,
          wildlife: climateNature.wildlife,
          dishes: foodEtiquette.national_dishes,
          etiquette: foodEtiquette.cultural_etiquette,
          history: history.historical_highlights,
          hero: history.national_hero
        },
        city: cityInfo
      };
      
      // ============================================================================
      // FIX: SAVE TO CACHE for next time
      // ============================================================================
      setCachedData(country, city, combinedData);
      
      setCultureData(combinedData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading culture data:", error);
      setError("Failed to load cultural information. Please try again.");
      setLoading(false);
    }
  };

  // Force refresh handler
  const handleForceRefresh = () => {
    loadCultureData(true);
  };

  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#D8F3FF] to-[#FFFFFF] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#088395] animate-spin mx-auto mb-4" />
          <p className="text-[#0A4D68] font-semibold">Loading culture information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="bg-gradient-to-br from-[#0d9488] to-[#14b8a6] text-white px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back to Home</span>
          </button>
          
          {/* Refresh button with cache indicator */}
          <button
            onClick={handleForceRefresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            title={isFromCache ? "Data from cache - Click to refresh" : "Click to refresh data"}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-medium">
              {isFromCache ? '📦 Cached' : 'Refresh'}
            </span>
          </button>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">{cultureData?.country?.country_name || 'Loading...'}</h1>
          <p className="text-base opacity-90">Country Information</p>
          {isFromCache && (
            <p className="text-xs opacity-70 mt-1">📦 Using cached data • Tap refresh for latest</p>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto -mt-4">
        {/* Location Display */}
        <div className="px-6 mb-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-2xl flex-shrink-0">
                  {locationMode === 'current' ? '📍' : '🧭'}
                </div>
                <div className="flex-1 min-w-0">
                  {(() => {
                    if (!activeLocation) return <p className="text-sm text-gray-600">Loading location...</p>;
                    
                    return (
                      <>
                        <p className="text-base font-bold text-gray-900 truncate">
                          {locationMode === 'navigate' ? activeLocation.placeName : activeLocation.address?.city}
                        </p>
                        {activeLocation.address?.city && locationMode === 'navigate' && (
                          <p className="text-sm text-gray-600 truncate">
                            {activeLocation.address.city}, {activeLocation.address.state || activeLocation.address.country}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {locationMode === 'navigate' && (
                  <button
                    onClick={() => switchToCurrentLocation()}
                    className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                    title="Use Current Location"
                  >
                    <Navigation className="w-4 h-4 text-blue-600" />
                  </button>
                )}
                <button
                  onClick={() => setShowLocationPicker(true)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2 flex-shrink-0"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={() => loadCultureData()}
              className="mt-4 px-6 py-2 bg-[#088395] text-white rounded-lg hover:bg-[#066d7d]"
            >
              Retry
            </button>
          </div>
        ) : cultureData ? (
          <div className="px-4 py-6 space-y-4 pb-24">
            {/* Leadership */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-4">Current Leadership</h3>
                <div className="space-y-3">
                  {cultureData.country.leadership?.map((leader, index) => (
                    <div key={index} className="pb-3 border-b border-gray-100 last:border-0">
                      <p className="text-xs text-gray-500 mb-1">{leader.position}</p>
                      <p className="font-semibold text-gray-900">{leader.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Religion */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">🕌</span>
                  Religion
                </h3>
                <div className="space-y-2.5">
                  {cultureData.country.religion?.map((r, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">{r.name}</span>
                      <span className="font-semibold text-gray-900">{r.percentage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Festivals & Celebrations */}
            {cultureData.country.festivals && cultureData.country.festivals.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                    <span className="text-xl">🎉</span>
                    Festivals & Celebrations
                  </h3>
                  <div className="space-y-3">
                    {cultureData.country.festivals.map((festival, index) => (
                      <div key={index} className="pb-3 border-b border-gray-100 last:border-0">
                        <p className="font-semibold text-gray-900 mb-1">{festival.name}</p>
                        <p className="text-xs text-teal-600 font-medium mb-1">{festival.date}</p>
                        <p className="text-sm text-gray-600">{festival.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Climate */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">☀️</span>
                  Climate
                </h3>
                <p className="text-sm text-gray-700 mb-3">{cultureData.country.climate?.type}</p>
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Best Time to Visit</p>
                  <p className="text-sm font-medium text-gray-900">{cultureData.country.climate?.best_time_to_visit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">What to Pack</p>
                  <div className="flex flex-wrap gap-2">
                    {cultureData.country.climate?.what_to_pack?.map((item, index) => (
                      <span key={index} className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Nature */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">🌿</span>
                  Nature
                </h3>
                <div className="space-y-4">
                  {cultureData.country.nature_spots?.slice(0, 3).map((spot, index) => (
                    <div key={index} className="pb-3 border-b border-gray-100 last:border-0">
                      <p className="font-semibold text-gray-900 mb-1">{spot.name}</p>
                      <p className="text-sm text-gray-600 mb-2">{spot.description}</p>
                      {spot.activities && spot.activities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {spot.activities.slice(0, 3).map((activity, i) => (
                            <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                              {activity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {cultureData.country.wildlife && cultureData.country.wildlife.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Wildlife</p>
                    <div className="space-y-2">
                      {cultureData.country.wildlife.slice(0, 4).map((animal, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-green-600 font-bold text-xs">•</span>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{animal.name}</p>
                            <p className="text-xs text-gray-600">{animal.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Food */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">🍽️</span>
                  Food
                </h3>
                <div className="space-y-4">
                  {cultureData.country.dishes?.slice(0, 5).map((dish, index) => (
                    <div key={index} className="pb-3 border-b border-gray-100 last:border-0">
                      <p className="font-semibold text-gray-900 mb-1">{dish.name}</p>
                      <p className="text-sm text-gray-600 mb-1">{dish.description}</p>
                      <p className="text-xs text-gray-500">Ingredients: {dish.ingredients?.slice(0, 5).join(', ')}</p>
                      {dish.fun_fact && <p className="text-xs text-amber-600 mt-1 italic">💡 {dish.fun_fact}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Etiquette */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">🤝</span>
                  Etiquette
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-green-600 mb-2 text-sm flex items-center gap-1">
                      <span className="text-lg">✅</span> DO
                    </p>
                    <ul className="space-y-1.5">
                      {cultureData.country.etiquette?.do?.slice(0, 5).map((rule, index) => (
                        <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-500 font-bold text-xs mt-0.5">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-3 border-t border-gray-100">
                    <p className="font-semibold text-red-600 mb-2 text-sm flex items-center gap-1">
                      <span className="text-lg">❌</span> DON'T
                    </p>
                    <ul className="space-y-1.5">
                      {cultureData.country.etiquette?.dont?.slice(0, 5).map((rule, index) => (
                        <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-red-500 font-bold text-xs mt-0.5">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* History */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">📜</span>
                  History
                </h3>
                <div className="space-y-4">
                  {cultureData.country.history?.slice(0, 4).map((event, index) => (
                    <div key={index} className="pb-3 border-b border-gray-100 last:border-0">
                      <p className="font-semibold text-gray-900 mb-1">{event.name}</p>
                      <p className="text-sm text-gray-600 mb-1">{event.description}</p>
                      <p className="text-xs text-teal-600">{event.significance}</p>
                    </div>
                  ))}
                </div>
                
                {cultureData.country.hero && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">National Hero</p>
                    <p className="font-bold text-gray-900 mb-1">{cultureData.country.hero.name}</p>
                    <p className="text-sm text-gray-600 mb-2">{cultureData.country.hero.description}</p>
                    {cultureData.country.hero.accomplishments && cultureData.country.hero.accomplishments.length > 0 && (
                      <ul className="space-y-1">
                        {cultureData.country.hero.accomplishments.slice(0, 3).map((acc, index) => (
                          <li key={index} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-teal-600 font-bold">•</span>
                            <span>{acc}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
            
            {/* Useful Tips */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-gradient-to-br from-[#0d9488] to-[#14b8a6] rounded-xl shadow-sm p-5 text-white">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="text-xl">💡</span>
                Useful Tips
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <p>Always greet locals with a smile and respect local customs</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <p>Learn a few basic phrases in the local language</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <p>Respect religious sites and dress modestly when visiting</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <p>Try local cuisine and ask locals for their favorite spots</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <p>Keep emergency contacts and embassy information handy</p>
                </div>
              </div>
            </motion.div>

            {/* City Specific Information */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="bg-gradient-to-br from-[#0d9488] to-[#14b8a6] rounded-xl shadow-sm p-5 text-white">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📍</span>
                <h2 className="text-xl font-bold">{activeLocation.address.city || activeLocation.placeName}</h2>
              </div>

              {cultureData.city?.known_for && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2 text-base">About</h3>
                  <p className="text-sm opacity-95">{cultureData.city.known_for}</p>
                </div>
              )}

              {cultureData.city?.city_leadership?.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2 text-base">City Leadership</h3>
                  <div className="space-y-1">
                    {cultureData.city.city_leadership.map((leader, index) => (
                      <p key={index} className="text-sm opacity-95">{leader.full_title || leader.title}: {leader.name}</p>
                    ))}
                  </div>
                </div>
              )}

              {cultureData.city?.language_dialect && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2 text-base">Language/Dialect</h3>
                  <p className="text-sm opacity-95">{cultureData.city.language_dialect.name}</p>
                  {cultureData.city.language_dialect.difference && (
                    <p className="text-xs opacity-85 mt-1">{cultureData.city.language_dialect.difference}</p>
                  )}
                </div>
              )}

              {cultureData.city?.famous_products?.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2 text-base">Famous Products</h3>
                  <div className="flex flex-wrap gap-2">
                    {cultureData.city.famous_products.map((product, index) => (
                      <span key={index} className="px-2.5 py-1 bg-white/25 backdrop-blur-sm rounded-full text-xs">
                        {product}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {cultureData.city?.fun_facts && cultureData.city.fun_facts.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-base">Fun Facts</h3>
                  <ul className="space-y-1.5">
                    {cultureData.city.fun_facts.slice(0, 4).map((fact, index) => (
                      <li key={index} className="text-sm opacity-95 flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            {/* City Local Dishes */}
            {cultureData.city?.local_dishes?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                    <span className="text-xl">🍜</span>
                    {activeLocation.address.city || activeLocation.placeName} Food
                  </h3>
                  <div className="space-y-3">
                    {cultureData.city.local_dishes.slice(0, 4).map((dish, index) => (
                      <div key={index} className="pb-3 border-b border-gray-100 last:border-0">
                        <p className="font-semibold text-gray-900 mb-1">{dish.name}</p>
                        <p className="text-sm text-gray-600 mb-1">{dish.description}</p>
                        <p className="text-xs text-gray-500">Ingredients: {dish.ingredients?.slice(0, 4).join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Historical Contributions */}
            {cultureData.city?.historical_contributions?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg mb-4">Historical Events</h3>
                  <div className="space-y-3">
                    {cultureData.city.historical_contributions.slice(0, 4).map((contrib, index) => (
                      <div key={index} className="pb-3 border-b border-gray-100 last:border-0">
                        <p className="font-semibold text-gray-900 mb-1">{contrib.event}</p>
                        <p className="text-sm text-gray-600">{contrib.significance}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* City Wildlife */}
            {cultureData.city?.city_wildlife?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5"></div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                    <span className="text-xl">🦜</span>
                    Local Wildlife
                  </h3>
                  <div className="space-y-2.5">
                    {cultureData.city.city_wildlife.slice(0, 4).map((animal, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-teal-600 font-bold text-sm">•</span>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{animal.name}</p>
                          <p className="text-xs text-gray-600">{animal.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        ) : null}
      </div>

      <LocationModePicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />
    </div>
  );
}
