// src/lib/workerRoutes.js
//
// Maps the old Base44 logical function names → Cloudflare Worker route paths,
// so call sites stay readable during the Phase 7 migration:
//   base44.functions.invoke('getAIDetails', p)  →  callWorker(ROUTE.getAIDetails, p)
//
// Routes marked "(live)" already exist + are deployed on the Worker. Routes
// marked "(planned)" are ported in later Phase 7 chunks.
export const ROUTE = {
  // Chunk 1 — thin-proxy AI/utility routes (already live on the Worker)
  getAIDetails: 'ai-details',
  getAtmAIDetails: 'atm-ai-details',
  getAttractionAIDetails: 'attraction-ai-details',
  getCafeWorkProfile: 'cafe-work-profile',
  getNameInfo: 'name-info',
  analyzePrice: 'analyze-price',

  // Chunk 2 — logging (live)
  logEvent: 'log-event',

  // Chunk 3+ — ported routes (planned)
  reverseGeocode: 'reverse-geocode',
  searchLocation: 'search-location',
  getExchangeRate: 'exchange-rate',
  getWeatherForecast: 'weather-forecast',
  getCoffeeShops: 'coffee-shops',
  getCoffeeOwned: 'coffee-owned',
  searchCoffee: 'coffee/search',
  coffeeWorkProfiles: 'coffee/work-profiles',
  getShoppingPlaces: 'shopping',
  getShoppingOwned: 'shopping-owned',
  getConvenienceStores: 'convenience-stores',
  getConvenienceOwned: 'convenience-owned',
  getATMLocations: 'atm-locations',
  getATMOwned: 'atm-owned',
  getRestroomLocations: 'restroom-locations',
  getRestroomOwned: 'restroom-owned',
  getRestroomAIDetails: 'restroom-ai-details',
  getMoneyExchangeLocations: 'money-exchange',
  getMoneyExchangeOwned: 'moneyexchange-owned',
  getActivities: 'activities',
  searchActivities: 'activities/search',
  savesPull: 'saves/pull',
  savesPush: 'saves/push',
  getHomeRows: 'home/rows',
  getRestaurants: 'restaurants-full',
  getAnalytics: 'analytics-bundle',
  InvokeLLM: 'invoke-llm',
  parseSearch: 'parse-search',
  destinationGallery: 'destination/gallery',
  destinationIntel: 'destination/intel',


};
