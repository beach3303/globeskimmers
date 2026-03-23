/**
 * ============================================================================
 * GLOBESKIMMERS - getATMLocations v6.0 (WORLDWIDE EXHAUSTIVE COVERAGE)
 * ============================================================================
 *
 * NEW in v6.0:
 * - 11 categories covering every ATM location type on earth:
 *   gas stations (inside + outside), subway, transit, liquor stores,
 *   bodegas, theme parks, schools/universities, casinos, hotels,
 *   community buildings, markets, nightclubs, and more
 * - International ATM terms: cajero, Geldautomat, distributeur, bancomat,
 *   caixa eletrônico, Thai script — catches ATMs regardless of local name
 * - Smart TTL caching by location permanence:
 *     Banks/schools/casinos/theme parks → 14 days (near-permanent)
 *     Hotels, malls, gas stations       → 7-10 days
 *     Transit hubs                      → 2 days (renovations happen)
 * - Deduplication across all parallel search queries
 *
 * ============================================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const API_BASE_URL = "https://globeskimmers-api.maizasimeon.workers.dev";

// ATM network / bank detection
const ATM_NETWORKS: Record<string, { name: string; network: string; feeInfo: string; surcharge: string }> = {
  'chase': { name: 'Chase', network: 'Chase', feeInfo: 'Free for Chase customers', surcharge: '$3.00–$3.50 non-customer' },
  'bank of america': { name: 'Bank of America', network: 'BofA', feeInfo: 'Free for BofA customers', surcharge: '$2.50–$3.00 non-customer' },
  'wells fargo': { name: 'Wells Fargo', network: 'Wells Fargo', feeInfo: 'Free for Wells Fargo customers', surcharge: '$3.00 non-customer' },
  'citibank': { name: 'Citibank', network: 'Citi', feeInfo: 'Free for Citi customers', surcharge: '$2.50–$3.00 non-customer' },
  'citi bank': { name: 'Citibank', network: 'Citi', feeInfo: 'Free for Citi customers', surcharge: '$2.50–$3.00 non-customer' },
  'us bank': { name: 'US Bank', network: 'US Bank', feeInfo: 'Free for US Bank customers', surcharge: '$3.00 non-customer' },
  'u.s. bank': { name: 'US Bank', network: 'US Bank', feeInfo: 'Free for US Bank customers', surcharge: '$3.00 non-customer' },
  'pnc': { name: 'PNC', network: 'PNC', feeInfo: 'Free for PNC customers', surcharge: '$3.00 non-customer' },
  'td bank': { name: 'TD Bank', network: 'TD', feeInfo: 'Free for TD customers', surcharge: '$3.00 non-customer' },
  'capital one': { name: 'Capital One', network: 'Capital One', feeInfo: 'Free for Capital One 360 customers', surcharge: '$0–$2.00 non-customer' },
  'allpoint': { name: 'Allpoint', network: 'Allpoint', feeInfo: 'Fee-free for network members', surcharge: '$0 in-network' },
  'moneypass': { name: 'MoneyPass', network: 'MoneyPass', feeInfo: 'Fee-free for network members', surcharge: '$0 in-network' },
  'co-op': { name: 'CO-OP', network: 'CO-OP', feeInfo: 'Fee-free for credit union members', surcharge: '$0 in-network' },
  'credit union': { name: 'Credit Union', network: 'CO-OP', feeInfo: 'Fee-free for members', surcharge: 'Varies' },
  'hsbc': { name: 'HSBC', network: 'HSBC', feeInfo: 'Free for HSBC customers', surcharge: '$2.50–$5.00 non-customer' },
  'barclays': { name: 'Barclays', network: 'Barclays', feeInfo: 'Free for Barclays customers', surcharge: 'Varies by country' },
  'santander': { name: 'Santander', network: 'Santander', feeInfo: 'Free for Santander customers', surcharge: 'Varies by country' },
  'scotiabank': { name: 'Scotiabank', network: 'Scotiabank', feeInfo: 'Free for Scotiabank customers', surcharge: 'Varies' },
  'bmo': { name: 'BMO', network: 'BMO', feeInfo: 'Free for BMO customers', surcharge: 'Varies' },
  'rbc': { name: 'RBC', network: 'RBC', feeInfo: 'Free for RBC customers', surcharge: 'Varies' },
  'anz': { name: 'ANZ', network: 'ANZ', feeInfo: 'Free for ANZ customers', surcharge: 'Varies' },
  'westpac': { name: 'Westpac', network: 'Westpac', feeInfo: 'Free for Westpac customers', surcharge: 'Varies' },
  'commonwealth': { name: 'Commonwealth Bank', network: 'CommBank', feeInfo: 'Free for CommBank customers', surcharge: 'Varies' },
  'natwest': { name: 'NatWest', network: 'NatWest', feeInfo: 'Free for NatWest customers', surcharge: 'Varies' },
  'lloyds': { name: 'Lloyds', network: 'Lloyds', feeInfo: 'Free for Lloyds customers', surcharge: 'Varies' },
  'deutsche bank': { name: 'Deutsche Bank', network: 'Deutsche Bank', feeInfo: 'Free for DB customers', surcharge: 'Varies' },
};

// ─── SMART CACHE TTL BY LOCATION TYPE ────────────────────────────────────────
// Logic: the more permanent the physical location, the longer we cache.
// ATMs don't move — but their host locations have different lifespans.
const CATEGORY_TTL: Record<string, number> = {
  // "All" — generic street/standalone ATMs. Very stable.
  all:              60 * 60 * 24 * 5,   // 5 days

  // Banks & institutions — essentially permanent. Branch closures are rare/slow.
  safe_lobbies:     60 * 60 * 24 * 14,  // 14 days — banks, credit unions, hospitals, hotels

  // Transit — moderate churn. Airport renovations, station upgrades.
  airport_transit:  60 * 60 * 24 * 2,   // 2 days  — airports, train, subway, metro, ferry

  // Gas stations & convenience stores — very stable. ATMs outlast tenants.
  gas_stations:     60 * 60 * 24 * 7,   // 7 days  — inside/outside gas stations, petrol forecourts

  // Retail & grocery — stable anchor stores, ATMs rarely relocated.
  retail:           60 * 60 * 24 * 5,   // 5 days  — supermarkets, pharmacies, big box

  // Liquor stores, corner shops, small retail — slightly less stable than anchors.
  small_retail:     60 * 60 * 24 * 3,   // 3 days  — liquor stores, corner stores, bodegas

  // Malls & shopping centers — stable, long leases.
  shopping:         60 * 60 * 24 * 7,   // 7 days  — malls, plazas, outlets

  // Education — campuses are permanent. ATMs on campus almost never move.
  education:        60 * 60 * 24 * 14,  // 14 days — universities, colleges, schools

  // Entertainment & leisure — stadiums, casinos, theme parks are fixtures.
  entertainment:    60 * 60 * 24 * 14,  // 14 days — casinos, stadiums, arenas, theme parks

  // Hospitality — hotels & resorts are very stable.
  hospitality:      60 * 60 * 24 * 10,  // 10 days — hotels, resorts, cruise terminals

  // Community — post offices, government, religious sites. Very permanent.
  community:        60 * 60 * 24 * 14,  // 14 days — post offices, libraries, government buildings
};

// ─── WORLDWIDE ATM SEARCH QUERIES BY CATEGORY ────────────────────────────────
// Every category uses international terms so we catch ATMs regardless of what
// they're called locally (cajero, Geldautomat, distributeur, bancomat, etc.)
const CATEGORY_QUERIES: Record<string, string[]> = {

  // ── ALL: Universal baseline — catches standalone ATMs everywhere ──────────
  all: [
    'ATM',
    'cash machine',
    'cash point',
    'cash dispenser',
    'automated teller machine',
    'cajero automático',        // Spanish
    'Geldautomat',              // German
    'distributeur automatique', // French
    'bancomat',                 // Italian/Eastern Europe
    'caixa eletrônico',         // Portuguese/Brazil
    'เครื่องเอทีเอ็ม',           // Thai
    'ATM machine near me',
  ],

  // ── SAFE LOBBIES: Banks, credit unions, hospitals, hotels ─────────────────
  safe_lobbies: [
    'ATM bank lobby',
    'ATM bank branch',
    'ATM credit union',
    'ATM financial center',
    'ATM savings bank',
    'ATM building society',
    'ATM hospital lobby',
    'ATM medical center',
    'ATM hotel lobby',
    'ATM post office',
    'ATM government building',
  ],

  // ── AIRPORT & TRANSIT: All transit hubs worldwide ─────────────────────────
  airport_transit: [
    'ATM airport',
    'ATM airport terminal',
    'ATM departure lounge',
    'ATM arrivals hall',
    'ATM train station',
    'ATM railway station',
    'ATM subway station',
    'ATM metro station',
    'ATM underground station',
    'ATM bus terminal',
    'ATM bus station',
    'ATM ferry terminal',
    'ATM port',
    'ATM transit hub',
    'cash machine train station',
    'ATM tram stop',
  ],

  // ── GAS STATIONS: Inside forecourt, outside forecourt, petrol stations ────
  gas_stations: [
    'ATM gas station',
    'ATM fuel station',
    'ATM petrol station',
    'ATM filling station',
    'ATM service station',
    'ATM forecourt',
    'ATM Shell',
    'ATM BP',
    'ATM Chevron',
    'ATM ExxonMobil',
    'ATM Mobil',
    'ATM Texaco',
    'ATM Valero',
    'ATM Sunoco',
    'ATM Marathon',
    'ATM Circle K',
    'ATM Speedway',
    'ATM Wawa',
    'ATM Casey\'s',
    'ATM RaceTrac',
    'ATM Total',                // Total Energies (international)
    'ATM Esso',                 // international brand
  ],

  // ── RETAIL: Supermarkets, pharmacies, big-box stores ─────────────────────
  retail: [
    'ATM supermarket',
    'ATM grocery store',
    'ATM walmart',
    'ATM target',
    'ATM kroger',
    'ATM safeway',
    'ATM albertsons',
    'ATM costco',
    'ATM whole foods',
    'ATM trader joes',
    'ATM CVS pharmacy',
    'ATM walgreens',
    'ATM rite aid',
    'ATM boots pharmacy',        // UK
    'ATM tesco',                 // UK/EU
    'ATM sainsburys',            // UK
    'ATM aldi',                  // EU/international
    'ATM lidl',                  // EU/international
    'ATM carrefour',             // France/international
    'ATM department store',
  ],

  // ── SMALL RETAIL: Liquor stores, corner shops, bodegas, newsagents ────────
  small_retail: [
    'ATM liquor store',
    'ATM off licence',           // UK term for liquor store
    'ATM bottle shop',           // Australia
    'ATM corner store',
    'ATM bodega',
    'ATM convenience store',
    'ATM 7-eleven',
    'ATM minimart',
    'ATM newsagent',             // UK
    'ATM tobacconist',
    'ATM deli',
    'ATM off-license',
    'ATM pawn shop',
    'ATM check cashing',
    'ATM payday loan',
  ],

  // ── SHOPPING: Malls, plazas, shopping centers, markets ───────────────────
  shopping: [
    'ATM mall',
    'ATM shopping mall',
    'ATM shopping center',
    'ATM shopping centre',       // UK spelling
    'ATM outlet mall',
    'ATM strip mall',
    'ATM retail park',           // UK
    'ATM food court',
    'ATM flea market',
    'ATM public market',
    'ATM bazaar',
    'ATM night market',
  ],

  // ── EDUCATION: Universities, colleges, schools ────────────────────────────
  education: [
    'ATM university',
    'ATM college campus',
    'ATM student union',
    'ATM campus',
    'ATM school',
    'ATM library',
    'ATM cafeteria school',
    'ATM dormitory',
    'ATM community college',
    'ATM polytechnic',
  ],

  // ── ENTERTAINMENT: Casinos, stadiums, theme parks, theaters ──────────────
  entertainment: [
    'ATM casino',
    'ATM hotel casino',
    'ATM resort casino',
    'ATM stadium',
    'ATM sports arena',
    'ATM concert venue',
    'ATM arena',
    'ATM movie theater',
    'ATM cinema',
    'ATM theme park',
    'ATM amusement park',
    'ATM water park',
    'ATM fairground',
    'ATM carnival',
    'ATM bowling alley',
    'ATM bingo hall',
    'ATM racetrack',
    'ATM nightclub',
    'ATM bar',
  ],

  // ── HOSPITALITY: Hotels, resorts, hostels, cruise terminals ──────────────
  hospitality: [
    'ATM hotel',
    'ATM resort',
    'ATM motel',
    'ATM hostel',
    'ATM bed and breakfast',
    'ATM vacation rental',
    'ATM cruise terminal',
    'ATM marina',
    'ATM tourist area',
    'ATM spa resort',
  ],

  // ── COMMUNITY: Post offices, libraries, government, religious ────────────
  community: [
    'ATM post office',
    'ATM library',
    'ATM community center',
    'ATM city hall',
    'ATM government office',
    'ATM courthouse',
    'ATM police station',
    'ATM fire station',
    'ATM church',
    'ATM mosque',
    'ATM temple',
    'ATM laundromat',
    'ATM barbershop',
    'ATM hair salon',
  ],
};

Deno.serve(async (req) => {
  console.log("\n🏧 === getATMLocations v6.0 START ===\n");

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized', atms: [] }, { status: 401 });
    }

    const body = await req.json();
    const {
      latitude,
      longitude,
      radius = 10000,      // default 10km
      maxResults = 40,
      category = 'all',    // all | safe_lobbies | airport_transit | gas_stations | retail | small_retail | shopping | education | entertainment | hospitality | community
      bankFilter = 'all',  // 'all' or specific bank name
      openOnly = false,
    } = body;

    if (!latitude || !longitude) {
      return Response.json({ error: "Latitude and longitude required", atms: [] }, { status: 400 });
    }

    console.log("📋 Request:", { latitude, longitude, radius, category, bankFilter, openOnly });

    // Select queries and TTL based on category
    const queries = CATEGORY_QUERIES[category] || CATEGORY_QUERIES['all'];
    const ttl = CATEGORY_TTL[category] || CATEGORY_TTL['all'];

    const allPlaces: any[] = [];
    const seenPlaceIds = new Set<string>();

    // Run all queries in parallel (batched to avoid rate limit)
    const batchSize = 3;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      await Promise.all(batch.map(async (query) => {
        try {
          const params = new URLSearchParams({
            query,
            latitude: String(latitude),
            longitude: String(longitude),
            radius: String(radius),
            maxResults: '20',
            cacheTtl: String(ttl),
          });

          const url = `${API_BASE_URL}/places/text-search?${params.toString()}`;
          console.log(`📡 Searching: "${query}"`);

          const response = await fetch(url);
          if (!response.ok) {
            console.error(`Search failed: ${response.status} for "${query}"`);
            return;
          }

          const data = await response.json();
          if (data.places && data.places.length > 0) {
            console.log(`   ✅ Found ${data.places.length} for "${query}"`);
            for (const place of data.places) {
              const placeId = place.id || place.placeId;
              if (placeId && !seenPlaceIds.has(placeId)) {
                seenPlaceIds.add(placeId);
                allPlaces.push(place);
              }
            }
          }
        } catch (err) {
          console.error(`Error searching "${query}":`, err);
        }
      }));
    }

    console.log(`📊 Total unique ATMs found: ${allPlaces.length}`);

    if (allPlaces.length === 0) {
      return Response.json({
        atms: [],
        count: 0,
        banks: [],
        error: "No ATMs found in this area. Try expanding your search radius.",
      });
    }

    // Process places
    const processedATMs = allPlaces.map(place => {
      const lat = place.location?.latitude || 0;
      const lng = place.location?.longitude || 0;

      const distance = calculateDistance(latitude, longitude, lat, lng);

      const weekdayDescriptions =
        place.currentOpeningHours?.weekdayDescriptions ||
        place.regularOpeningHours?.weekdayDescriptions ||
        place.hours || [];

      // Build photo URLs — return UP TO 2
      const rawPhotos: string[] = (place.photos || [])
        .map((p: any) => p.url || p)
        .filter(Boolean);
      const photos = rawPhotos.slice(0, 2);

      // Bank/network detection
      const placeName = (place.displayName?.text || place.name || '').toLowerCase();
      let networkInfo = { name: 'Independent ATM', network: 'Independent', feeInfo: 'Standard fees may apply', surcharge: '$2.50–$4.00 typical' };
      for (const [key, info] of Object.entries(ATM_NETWORKS)) {
        if (placeName.includes(key)) {
          networkInfo = info;
          break;
        }
      }

      // Venue type detection for badge
      let venueType = 'standalone';
      let venueIcon = '🏧';
      const types = (place.types || []).join(' ').toLowerCase();
      if (types.includes('airport') || placeName.includes('airport') || placeName.includes('terminal')) {
        venueType = 'airport'; venueIcon = '✈️';
      } else if (types.includes('train') || types.includes('subway') || types.includes('transit') || placeName.includes('station') || placeName.includes('metro')) {
        venueType = 'transit'; venueIcon = '🚇';
      } else if (types.includes('hospital') || placeName.includes('hospital') || placeName.includes('medical')) {
        venueType = 'hospital'; venueIcon = '🏥';
      } else if (types.includes('hotel') || types.includes('lodging') || placeName.includes('hotel')) {
        venueType = 'hotel'; venueIcon = '🏨';
      } else if (types.includes('gas_station') || placeName.includes('shell') || placeName.includes('chevron') || placeName.includes('arco') || placeName.includes('exxon') || placeName.includes('mobil') || placeName.includes('bp')) {
        venueType = 'gas'; venueIcon = '⛽';
      } else if (types.includes('convenience_store') || placeName.includes('7-eleven') || placeName.includes('cvs') || placeName.includes('walgreens') || placeName.includes('wawa') || placeName.includes('circle k')) {
        venueType = 'convenience'; venueIcon = '🏪';
      } else if (types.includes('shopping_mall') || placeName.includes('mall') || placeName.includes('plaza') || placeName.includes('center')) {
        venueType = 'mall'; venueIcon = '🛒';
      } else if (types.includes('supermarket') || types.includes('grocery') || placeName.includes('walmart') || placeName.includes('target') || placeName.includes('costco') || placeName.includes('safeway') || placeName.includes('kroger')) {
        venueType = 'grocery'; venueIcon = '🛒';
      } else if (types.includes('casino') || types.includes('night_club') || types.includes('stadium')) {
        venueType = 'entertainment'; venueIcon = '🎰';
      } else if (types.includes('bank') || types.includes('credit_union') || types.includes('financial')) {
        venueType = 'bank'; venueIcon = '🏦';
      }

      return {
        // Identity
        id: place.id,
        placeId: place.id,

        // Name
        displayName: place.displayName || { text: place.name || '' },
        name: place.displayName?.text || place.name || '',

        // Location
        location: { latitude: lat, longitude: lng },
        lat,
        lng,

        // Address
        formattedAddress: place.formattedAddress || place.address || '',
        shortFormattedAddress: place.shortFormattedAddress || place.shortAddress || '',

        // Distance
        distanceKm: distance,
        distanceMiles: distance * 0.621371,

        // Rating
        rating: place.rating || null,
        userRatingCount: place.userRatingCount || 0,

        // Hours
        currentOpeningHours: {
          openNow: place.isOpen,
          weekdayDescriptions,
        },
        regularOpeningHours: { weekdayDescriptions },
        hours: weekdayDescriptions,
        isOpen: place.isOpen ?? null,

        // Photos — UP TO 2
        photos,
        photoUrl: photos[0] || null,
        photoUrl2: photos[1] || null,

        // Contact
        nationalPhoneNumber: place.nationalPhoneNumber || place.phone || '',
        internationalPhoneNumber: place.internationalPhoneNumber || place.phone || '',

        // Web
        websiteUri: place.websiteUri || place.website || '',
        googleMapsUri: place.googleMapsUri || place.googleMapsUrl || '',

        // Types
        types: place.types || [],
        primaryType: place.primaryType,

        // ATM-specific
        network: networkInfo.network,
        networkName: networkInfo.name,
        feeInfo: networkInfo.feeInfo,
        surcharge: networkInfo.surcharge,

        // Venue context
        venueType,
        venueIcon,

        // Service options
        serviceOptions: place.serviceOptions || {},
      };
    });

    // Apply openOnly filter
    let filtered = processedATMs;
    if (openOnly) {
      filtered = filtered.filter(a => a.isOpen === true);
    }

    // Apply bank filter
    if (bankFilter && bankFilter !== 'all') {
      filtered = filtered.filter(a => a.network === bankFilter);
    }

    // Sort by distance
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);

    // Cap results
    const results = filtered.slice(0, maxResults);

    // Build dynamic bank list for UI filter dropdown
    const bankSet = new Set<string>();
    for (const a of processedATMs) {
      if (a.network && a.network !== 'Independent') bankSet.add(a.network);
    }
    const banks = Array.from(bankSet).sort();

    console.log(`✅ Returning ${results.length} ATMs | Banks found: ${banks.join(', ')}`);

    // Sample log
    if (results.length > 0) {
      const s = results[0];
      console.log("📊 Sample:", {
        name: s.name,
        hasAddress: !!s.formattedAddress,
        hasPhone: !!s.nationalPhoneNumber,
        hasHours: s.hours?.length > 0,
        photoCount: s.photos?.length || 0,
        venueType: s.venueType,
        network: s.network,
      });
    }

    console.log("🏧 === getATMLocations v5.0 END ===\n");

    return Response.json({
      atms: results,
      count: results.length,
      banks,
      version: 'v5.0',
    });

  } catch (error: any) {
    console.error("💥 ERROR:", error.message);
    return Response.json({ error: error.message, atms: [] }, { status: 200 });
  }
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}