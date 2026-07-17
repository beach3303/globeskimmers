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
  getShoppingPlaces: 'shopping',
  getConvenienceStores: 'convenience-stores',
  getATMLocations: 'atm-locations',
  getRestroomLocations: 'restroom-locations',
  getRestroomAIDetails: 'restroom-ai-details',
  getMoneyExchangeLocations: 'money-exchange',
  getActivities: 'activities',
  getRestaurants: 'restaurants-full',
  getAnalytics: 'analytics-bundle',
  InvokeLLM: 'invoke-llm',

  // Engagement — living homepage rows (owned-data carousels, POST /home/rows)
  getHomeRows: 'home/rows',
};
