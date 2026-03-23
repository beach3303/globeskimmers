import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const API_BASE_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

const STORE_CATEGORIES = {
  convenience: { label: "Convenience Store", icon: "🏪" },
  drugstore: { label: "Drugstore", icon: "💊" },
  gas_station: { label: "Gas Station Mart", icon: "⛽" },
  mini_market: { label: "Mini Market", icon: "🛒" },
  grocery_express: { label: "Grocery Express", icon: "🥬" },
  transit_kiosk: { label: "Transit Kiosk", icon: "🚇" }
};

const LOCATION_CONTEXTS = {
  standalone: { label: "Standalone", icon: "🏬" },
  gas_station: { label: "In Gas Station", icon: "⛽" },
  subway: { label: "Subway/Transit", icon: "🚇" },
  airport: { label: "Airport", icon: "✈️" },
  mall: { label: "Inside Mall", icon: "🛍️" },
  highway: { label: "Highway/Roadside", icon: "🛣️" }
};

const COUNTRY_PAYMENT_NORMS = {
  US: { cards: "high", tip: "Cards and Apple Pay widely accepted" },
  CA: { cards: "high", tip: "Cards widely accepted" },
  GB: { cards: "high", tip: "Contactless very common" },
  JP: { cards: "high", tip: "IC cards work everywhere" },
  KR: { cards: "high", tip: "Cards accepted everywhere" },
  DE: { cards: "medium", tip: "Cash still preferred in many places" },
  CH: { cards: "high", tip: "Cards widely accepted" },
  PH: { cards: "low", tip: "Cash preferred. GCash/Maya growing" },
  TH: { cards: "medium", tip: "Big chains accept cards" },
  MX: { cards: "medium", tip: "OXXO accepts cards" },
  CO: { cards: "medium", tip: "Cash common at small stores" },
  AU: { cards: "high", tip: "Tap-to-pay very common" },
  AE: { cards: "high", tip: "Cards and Apple Pay widely accepted" },
  IL: { cards: "high", tip: "Cards widely accepted" },
  IR: { cards: "none", tip: "Cash only. International cards do not work" },
  DEFAULT: { cards: "medium", tip: "Payment methods may vary" }
};

const CHAIN_DATABASE = {
  "7-Eleven": { category: "convenience", services: ["atm", "hot_food", "coffee"], open_24h: true, payments: ["visa", "mastercard", "apple_pay", "cash"], score: 95 },
  "Circle K": { category: "convenience", services: ["atm", "hot_food", "fuel"], open_24h: true, payments: ["visa", "mastercard", "apple_pay", "cash"], gas: true, score: 90 },
  "FamilyMart": { category: "convenience", services: ["atm", "hot_food", "coffee"], open_24h: true, payments: ["visa", "mastercard", "cash"], score: 92 },
  "Wawa": { category: "convenience", services: ["atm", "hot_food", "coffee", "fuel"], open_24h: true, payments: ["visa", "mastercard", "apple_pay", "cash"], score: 94 },
  "Sheetz": { category: "convenience", services: ["atm", "hot_food", "fuel"], open_24h: true, payments: ["visa", "mastercard", "apple_pay", "cash"], score: 93 },
  "CVS": { category: "drugstore", services: ["atm", "pharmacy"], payments: ["visa", "mastercard", "apple_pay", "cash"], score: 88 },
  "Walgreens": { category: "drugstore", services: ["atm", "pharmacy"], payments: ["visa", "mastercard", "apple_pay", "cash"], score: 87 },
  "OXXO": { category: "convenience", services: ["atm", "hot_food"], open_24h: true, payments: ["visa", "mastercard", "cash"], score: 90 },
  "Lawson": { category: "convenience", services: ["atm", "hot_food", "coffee"], open_24h: true, payments: ["visa", "mastercard", "cash"], score: 93 },
  "CU": { category: "convenience", services: ["atm", "hot_food"], open_24h: true, payments: ["visa", "mastercard", "cash"], score: 90 },
  "GS25": { category: "convenience", services: ["atm", "hot_food"], open_24h: true, payments: ["visa", "mastercard", "cash"], score: 90 },
  "Mercury Drug": { category: "drugstore", services: ["pharmacy"], payments: ["cash", "gcash"], score: 85 },
  "Alfamart": { category: "convenience", services: [], payments: ["cash", "gcash"], score: 75 },
  "Indomaret": { category: "convenience", services: ["atm"], payments: ["visa", "mastercard", "cash"], score: 78 },
  "Tesco Express": { category: "grocery_express", services: ["atm"], payments: ["visa", "mastercard", "apple_pay", "cash"], score: 85 },
  "Boots": { category: "drugstore", services: ["pharmacy"], payments: ["visa", "mastercard", "apple_pay", "cash"], score: 88 },
  "Coop Pronto": { category: "convenience", services: ["atm", "coffee"], payments: ["visa", "mastercard", "cash"], score: 85 },
  "Migrolino": { category: "convenience", services: ["atm", "hot_food"], payments: ["visa", "mastercard", "cash"], score: 85 },
  "Shell": { category: "gas_station", services: ["atm", "fuel"], payments: ["visa", "mastercard", "cash"], gas: true, score: 82 },
  "BP": { category: "gas_station", services: ["atm", "fuel"], payments: ["visa", "mastercard", "cash"], gas: true, score: 80 },
  "Zoom": { category: "convenience", services: ["atm"], open_24h: true, payments: ["visa", "mastercard", "apple_pay", "cash"], score: 85 },
  "AMPM": { category: "convenience", services: ["atm", "hot_food"], open_24h: true, payments: ["visa", "mastercard", "cash"], score: 88 }
};

const REGIONAL_TERMS = {
  usa: ["convenience store", "7-Eleven", "CVS", "Walgreens", "gas station"],
  japan: ["convenience store", "konbini", "Lawson", "FamilyMart"],
  korea: ["convenience store", "CU", "GS25"],
  philippines: ["convenience store", "Mercury Drug", "sari-sari"],
  europe: ["convenience store", "Tesco Express", "Spar"],
  default: ["convenience store", "mini mart", "drugstore", "pharmacy"]
};

function detectCountryCode(lat, lng) {
  if (lat >= 24 && lat <= 50 && lng >= -130 && lng <= -65) return "US";
  if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) return "CA";
  if (lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86) return "MX";
  if (lat >= -4 && lat <= 13 && lng >= -82 && lng <= -66) return "CO";
  if (lat >= 4 && lat <= 21 && lng >= 116 && lng <= 127) return "PH";
  if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154) return "JP";
  if (lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132) return "KR";
  if (lat >= 49 && lat <= 61 && lng >= -11 && lng <= 2) return "GB";
  if (lat >= 45.5 && lat <= 48 && lng >= 5.5 && lng <= 10.5) return "CH";
  if (lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57) return "AE";
  if (lat >= 29 && lat <= 34 && lng >= 34 && lng <= 36) return "IL";
  if (lat >= -45 && lat <= -10 && lng >= 110 && lng <= 155) return "AU";
  return "DEFAULT";
}

function getRegion(countryCode) {
  const map = {
    US: "usa", CA: "usa", MX: "usa",
    JP: "japan", KR: "korea",
    PH: "philippines", TH: "philippines", ID: "philippines",
    GB: "europe", DE: "europe", FR: "europe", CH: "europe"
  };
  return map[countryCode] || "default";
}

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function matchChain(name) {
  const lower = name.toLowerCase();
  for (const chainName of Object.keys(CHAIN_DATABASE)) {
    if (lower.includes(chainName.toLowerCase())) {
      const info = CHAIN_DATABASE[chainName];
      return { name: chainName, ...info };
    }
  }
  return null;
}

function detectContext(place) {
  const name = ((place.displayName && place.displayName.text) || place.name || "").toLowerCase();
  const types = (place.types || []).join(" ");
  if (name.includes("airport") || name.includes("terminal")) return "airport";
  if (name.includes("station") || name.includes("metro") || name.includes("subway")) return "subway";
  if (name.includes("mall") || name.includes("plaza")) return "mall";
  if (name.includes("highway") || name.includes("truck stop")) return "highway";
  if (types.includes("gas_station") || name.includes("gas") || name.includes("petrol")) return "gas_station";
  return "standalone";
}

function analyzePayments(chainInfo, countryCode) {
  const norms = COUNTRY_PAYMENT_NORMS[countryCode] || COUNTRY_PAYMENT_NORMS.DEFAULT;
  if (chainInfo && chainInfo.payments) {
    return {
      payments: chainInfo.payments,
      confidence: "likely",
      sources: ["Chain standard"],
      warnings: [],
      tip: norms.tip,
      acceptsCards: chainInfo.payments.includes("visa") || chainInfo.payments.includes("mastercard"),
      acceptsMobile: chainInfo.payments.includes("apple_pay") || chainInfo.payments.includes("google_pay"),
      cashOnly: chainInfo.payments.length === 1 && chainInfo.payments[0] === "cash"
    };
  }
  if (norms.cards === "high") {
    return { payments: ["visa", "mastercard", "cash"], confidence: "estimated", sources: ["Country norm"], warnings: [], tip: norms.tip, acceptsCards: true, acceptsMobile: false, cashOnly: false };
  } else if (norms.cards === "none") {
    return { payments: ["cash"], confidence: "estimated", sources: ["Country norm"], warnings: ["International cards do not work"], tip: norms.tip, acceptsCards: false, acceptsMobile: false, cashOnly: true };
  } else {
    return { payments: ["cash"], confidence: "unknown", sources: ["Country norm"], warnings: ["Cards may not be accepted"], tip: norms.tip, acceptsCards: false, acceptsMobile: false, cashOnly: true };
  }
}

function processStore(place, userLat, userLng, countryCode) {
  const name = (place.displayName && place.displayName.text) || place.name || "Unknown";
  const lat = (place.location && place.location.latitude) || (place.geometry && place.geometry.location && place.geometry.location.lat);
  const lng = (place.location && place.location.longitude) || (place.geometry && place.geometry.location && place.geometry.location.lng);
  if (!lat || !lng) return null;

  const distance = calcDistance(userLat, userLng, lat, lng);
  const chain = matchChain(name);
  const context = (chain && chain.gas) ? "gas_station" : detectContext(place);
  const paymentInfo = analyzePayments(chain, countryCode);

  let category = "convenience";
  const types = place.types || [];
  if (chain) {
    category = chain.category;
  } else if (types.includes("pharmacy") || types.includes("drugstore")) {
    category = "drugstore";
  } else if (types.includes("gas_station")) {
    category = "gas_station";
  } else if (types.includes("supermarket")) {
    category = "mini_market";
  }

  const hours = place.currentOpeningHours || place.regularOpeningHours || {};
  const isOpen = hours.openNow != null ? hours.openNow : null;
  const is24h = (chain && chain.open_24h) || false;
  const services = (chain && chain.services) || [];
  const photos = (place.photos || []).slice(0, 3);
  const catInfo = STORE_CATEGORIES[category] || { label: "Store", icon: "🏪" };
  const locInfo = LOCATION_CONTEXTS[context] || { label: "Standalone", icon: "🏬" };

  return {
    id: place.id || place.place_id || `store-${lat}-${lng}`,
    place_id: place.id || place.place_id,
    name,
    address: place.formattedAddress || place.vicinity || "",
    latitude: lat,
    longitude: lng,
    distance_miles: Math.round(distance * 100) / 100,
    rating: place.rating || null,
    review_count: place.userRatingCount || 0,
    category,
    category_label: catInfo.label,
    category_icon: catInfo.icon,
    location_context: context,
    location_context_label: locInfo.label,
    location_context_icon: locInfo.icon,
    is_in_gas_station: context === "gas_station",
    is_standalone: context === "standalone",
    is_open: isOpen,
    is_24_hours: is24h,
    hours: hours.weekdayDescriptions || [],
    has_atm: services.includes("atm"),
    has_restroom: services.includes("restroom"),
    has_pharmacy: services.includes("pharmacy") || category === "drugstore",
    has_hot_food: services.includes("hot_food"),
    has_coffee: services.includes("coffee"),
    has_fuel: services.includes("fuel"),
    payments: paymentInfo.payments,
    payment_confidence: paymentInfo.confidence,
    payment_sources: paymentInfo.sources,
    payment_warnings: paymentInfo.warnings,
    payment_country_tip: paymentInfo.tip,
    accepts_cards: paymentInfo.acceptsCards,
    accepts_mobile_pay: paymentInfo.acceptsMobile,
    cash_only: paymentInfo.cashOnly,
    foreign_cards_friendly: paymentInfo.acceptsCards,
    is_known_chain: !!chain,
    matched_chain: chain ? chain.name : null,
    traveler_score: chain ? chain.score : 50,
    photos: photos.map((p, i) => ({ name: p.name, type: i === 0 ? "exterior" : "interior" })),
    has_photos: photos.length > 0,
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    google_maps_url: place.googleMapsUri || null
  };
}

async function searchStores(lat, lng, radiusM, query) {
  try {
    const url = `${API_BASE_URL}/places/text-search?query=${encodeURIComponent(query)}&latitude=${lat}&longitude=${lng}&radius=${radiusM}&maxResults=20`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.places || [];
  } catch (e) {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      latitude, longitude,
      radius = 10,
      category = "all",
      openOnly = false, open24Hours = false, hasHotFood = false,
      hasATM = false, hasPharmacy = false, hasRestroom = false,
      hasCoffee = false, acceptsCards = false, acceptsMobilePay = false,
      locationType = "all", sortBy = "traveler_best",
      limit = 50, forceRefresh = false
    } = body;

    if (!latitude || !longitude) {
      return Response.json({ error: "Latitude and longitude required", stores: [], total_count: 0 });
    }

    const radiusMiles = parseFloat(radius);
    const radiusMeters = radiusMiles * 1609.34;
    const countryCode = detectCountryCode(latitude, longitude);
    const region = getRegion(countryCode);

    const latKey = Math.round(latitude * 100) / 100;
    const lngKey = Math.round(longitude * 100) / 100;
    const cacheKey = `conv_v6_${latKey}_${lngKey}_${Math.round(radiusMiles)}`;

    let allStores = [];

    // Cache check using Base44 entity
    if (!forceRefresh) {
      try {
        const cached = await base44.asServiceRole.entities.convenience_store_cache.filter({ cache_key: cacheKey });
        if (cached && cached.length > 0) {
          const entry = cached[0];
          const age = Date.now() - new Date(entry.fetched_at).getTime();
          if (age < 30 * 24 * 60 * 60 * 1000 && entry.all_stores && entry.all_stores.length > 0) {
            allStores = entry.all_stores;
          }
        }
      } catch (e) {}
    }

    if (allStores.length === 0) {
      const terms = REGIONAL_TERMS[region] || REGIONAL_TERMS.default;
      const seenIds = {};

      for (const query of terms) {
        const places = await searchStores(latitude, longitude, radiusMeters, query);
        for (const p of places) {
          const id = p.id || p.place_id;
          if (id && !seenIds[id]) {
            seenIds[id] = true;
            const store = processStore(p, latitude, longitude, countryCode);
            if (store && store.distance_miles <= radiusMiles) {
              allStores.push(store);
            }
          }
        }
      }

      if (allStores.length > 0) {
        try {
          const existing = await base44.asServiceRole.entities.convenience_store_cache.filter({ cache_key: cacheKey });
          if (existing && existing.length > 0) {
            await base44.asServiceRole.entities.convenience_store_cache.update(existing[0].id, {
              all_stores: allStores, fetched_at: new Date().toISOString()
            });
          } else {
            await base44.asServiceRole.entities.convenience_store_cache.create({
              cache_key: cacheKey, all_stores: allStores,
              fetched_at: new Date().toISOString(), latitude: latKey, longitude: lngKey
            });
          }
        } catch (e) {}
      }
    }

    let filtered = [...allStores];

    if (category !== "all") filtered = filtered.filter(s => s.category === category);
    if (openOnly) filtered = filtered.filter(s => s.is_open === true || s.is_24_hours);
    if (open24Hours) filtered = filtered.filter(s => s.is_24_hours);
    if (hasHotFood) filtered = filtered.filter(s => s.has_hot_food);
    if (hasATM) filtered = filtered.filter(s => s.has_atm);
    if (hasPharmacy) filtered = filtered.filter(s => s.has_pharmacy);
    if (hasRestroom) filtered = filtered.filter(s => s.has_restroom);
    if (hasCoffee) filtered = filtered.filter(s => s.has_coffee);
    if (acceptsCards) filtered = filtered.filter(s => s.accepts_cards);
    if (acceptsMobilePay) filtered = filtered.filter(s => s.accepts_mobile_pay);
    if (locationType !== "all") filtered = filtered.filter(s => s.location_context === locationType);

    if (sortBy === "nearby") {
      filtered.sort((a, b) => a.distance_miles - b.distance_miles);
    } else if (sortBy === "rating") {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "24h_first") {
      filtered.sort((a, b) => {
        if (a.is_24_hours && !b.is_24_hours) return -1;
        if (!a.is_24_hours && b.is_24_hours) return 1;
        return a.distance_miles - b.distance_miles;
      });
    } else {
      filtered.sort((a, b) => {
        const scoreA = (a.is_known_chain ? 20 : 0) + (a.is_open ? 15 : 0) + (10 - a.distance_miles);
        const scoreB = (b.is_known_chain ? 20 : 0) + (b.is_open ? 15 : 0) + (10 - b.distance_miles);
        return scoreB - scoreA;
      });
    }

    const categoryCounts = {
      all: filtered.length,
      convenience: filtered.filter(s => s.category === "convenience").length,
      drugstore: filtered.filter(s => s.category === "drugstore").length,
      gas_station: filtered.filter(s => s.category === "gas_station").length,
      mini_market: filtered.filter(s => s.category === "mini_market").length
    };

    const commonPayments =
      countryCode === "PH" ? ["GCash", "Maya", "Cash"] :
      countryCode === "JP" ? ["IC Cards", "Cash"] :
      ["Cards", "Apple Pay", "Cash"];

    return Response.json({
      stores: filtered.slice(0, limit),
      all_stores: allStores,
      total_count: filtered.length,
      category_counts: categoryCounts,
      country_code: countryCode,
      region,
      common_payments: commonPayments,
      from_cache: !forceRefresh && allStores.length > 0
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});