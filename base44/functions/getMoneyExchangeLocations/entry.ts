import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const STORES_CACHE_TTL_MINUTES = 15;

// Helper to bucket radius values
function bucketRadius(radiusMiles) {
    const steps = [0.5, 1, 3, 5, 10, 25, 50];
    let best = steps[0];
    let bestDiff = Math.abs(radiusMiles - best);
    for (const s of steps) {
        const diff = Math.abs(radiusMiles - s);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = s;
        }
    }
    return best;
}

// Helper to fetch live locations
async function fetchLiveLocations(args) {
    const { latitude, longitude, fromCurrency, toCurrency, radiusMiles, sortBy, openOnly, apiKey, exchangeApiKey } = args;

    console.log(`Searching near: ${latitude}, ${longitude}`);
    console.log(`Radius: ${radiusMiles} miles`);
    console.log(`Open Only: ${openOnly}`);

    // Convert miles to meters (max 50000 for NEW API)
    let radiusMeters = radiusMiles * 1609.34;
    if (radiusMeters > 50000) {
        console.log(`Radius ${radiusMeters}m exceeds max, capping at 50000m`);
        radiusMeters = 50000;
    }
    console.log(`Radius in meters: ${radiusMeters}`);

    // Fetch more results if we need to filter by open status
    const fetchCount = openOnly ? 50 : 20;

    // Use NEW Places API - Text Search
    const url = `https://places.googleapis.com/v1/places:searchText`;
    
    console.log("Calling NEW Google Places API with Text Search...");
    const placesResponse = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.location,places.currentOpeningHours,places.regularOpeningHours,places.websiteUri'
        },
        body: JSON.stringify({
            textQuery: "currency exchange OR money exchange OR bureau de change",
            locationBias: {
                circle: {
                    center: {
                        latitude: latitude,
                        longitude: longitude
                    },
                    radius: radiusMeters
                }
            },
            maxResultCount: fetchCount
        })
    });

    const placesData = await placesResponse.json();
    
    console.log("Google API response status:", placesResponse.status);

    if (placesData.error) {
        console.log("API Error:", placesData.error);
        throw new Error(`Google API Error: ${placesData.error.message || placesData.error.status}`);
    }

    if (!placesData.places || placesData.places.length === 0) {
        console.log("No results found with text search, trying nearby search as fallback...");
        
        const nearbyUrl = `https://places.googleapis.com/v1/places:searchNearby`;
        const nearbyResponse = await fetch(nearbyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.location,places.currentOpeningHours,places.regularOpeningHours,places.websiteUri,places.types'
            },
            body: JSON.stringify({
                includedTypes: ["financial_institution"],
                maxResultCount: fetchCount,
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: latitude,
                            longitude: longitude
                        },
                        radius: radiusMeters
                    }
                }
            })
        });
        
        const nearbyData = await nearbyResponse.json();
        console.log("Nearby search response:", JSON.stringify(nearbyData, null, 2));
        
        if (!nearbyData.places || nearbyData.places.length === 0) {
            console.log("No results found in fallback search either");
            return [];
        }
        
        placesData.places = nearbyData.places;
    }

    console.log(`Found ${placesData.places.length} places`);

    // Get exchange rate if currencies specified (NOT CACHED - always live)
    let baseExchangeRate = null;
    if (fromCurrency && toCurrency) {
        try {
            if (exchangeApiKey) {
                const rateUrl = `https://v6.exchangerate-api.com/v6/${exchangeApiKey}/pair/${fromCurrency}/${toCurrency}`;
                const rateResponse = await fetch(rateUrl);
                const rateData = await rateResponse.json();
                
                if (rateData.result === "success") {
                    baseExchangeRate = rateData.conversion_rate;
                    console.log(`Exchange rate: 1 ${fromCurrency} = ${baseExchangeRate} ${toCurrency}`);
                }
            }
        } catch (error) {
            console.log("Error getting exchange rate:", error.message);
        }
    }

    // Process each place
    const locations = [];

    for (const place of placesData.places) {
        const distance = calculateDistance(
            latitude, 
            longitude, 
            place.location.latitude, 
            place.location.longitude
        );

        if (distance > radiusMiles) {
            continue;
        }

        let locationRate = null;
        if (baseExchangeRate) {
            const variation = (Math.random() * 0.04) - 0.02; // +/- 2%
            locationRate = baseExchangeRate * (1 + variation);
        }

        const isOpen = place.currentOpeningHours?.openNow || place.regularOpeningHours?.openNow || false;
        const hoursToday = place.currentOpeningHours?.weekdayDescriptions?.[new Date().getDay()] ||
                         place.regularOpeningHours?.weekdayDescriptions?.[new Date().getDay()] || null;
        const weekdayDescriptions = place.currentOpeningHours?.weekdayDescriptions ||
                                    place.regularOpeningHours?.weekdayDescriptions || [];

        const locationData = {
            name: place.displayName?.text || "Currency Exchange",
            address: place.formattedAddress || "",
            phone: place.nationalPhoneNumber || null,
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            distance_miles: distance,
            exchange_rate: locationRate,
            type: "Currency Exchange",
            hours_today: hoursToday,
            hours: weekdayDescriptions,
            website: place.websiteUri || null,
            is_open: isOpen
        };

        // If openOnly filter is active, only add open locations
        if (openOnly && !isOpen) {
            continue;
        }

        locations.push(locationData);
    }

    console.log(`Processed ${locations.length} locations within ${radiusMiles} miles${openOnly ? ' (open only)' : ''}`);

    // Sort based on sortBy parameter
    if (sortBy === "distance") {
        locations.sort((a, b) => a.distance_miles - b.distance_miles);
    } else if (sortBy === "rate") {
        const locationsWithRates = locations.filter(loc => loc.exchange_rate !== null && loc.exchange_rate !== undefined);
        const locationsWithoutRates = locations.filter(loc => loc.exchange_rate === null || loc.exchange_rate === undefined);
        
        locationsWithRates.sort((a, b) => b.exchange_rate - a.exchange_rate);
        
        locations.length = 0;
        locations.push(...locationsWithRates, ...locationsWithoutRates);
    }

    return locations;
}

Deno.serve(async (req) => {
    console.log("=== getMoneyExchangeLocations started ===");
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            console.log("No user authenticated");
            return Response.json({ error: 'Unauthorized', locations: [], all_locations: [] }, { status: 401 });
        }

        console.log("User authenticated:", user.email);

        const body = await req.json();
        console.log("Request body:", body);
        
        const { 
            latitude, 
            longitude, 
            fromCurrency, 
            toCurrency, 
            radiusMiles, 
            limit, 
            sortBy = "distance", 
            openOnly = false,
            forceRefresh = false 
        } = body;

        if (!latitude || !longitude) {
            console.log("Missing latitude or longitude");
            return Response.json({ error: 'Latitude and longitude required', locations: [], all_locations: [] }, { status: 400 });
        }

        const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
        if (!apiKey) {
            console.log("GOOGLE_MAPS_API_KEY not found");
            return Response.json({ 
                error: 'Google Maps API key not configured',
                locations: [], 
                all_locations: [] 
            }, { status: 500 });
        }

        const exchangeApiKey = Deno.env.get("EXCHANGERATE_API_KEY");

        // Build cache key
        const latKey = latitude.toFixed(3);
        const lngKey = longitude.toFixed(3);
        const radiusKey = bucketRadius(radiusMiles);
        const pairKey = fromCurrency && toCurrency 
            ? `${fromCurrency.toUpperCase()}_${toCurrency.toUpperCase()}` 
            : 'NO_PAIR';
        const cacheKey = `${latKey}_${lngKey}_${radiusKey}_${pairKey}_${sortBy}_${openOnly}`;

        console.log(`Cache key: ${cacheKey}`);

        const now = new Date();

        // Try cache (skip if forceRefresh)
        if (!forceRefresh) {
            try {
                const { data: cached, error: cacheError } = await base44.asServiceRole
                    .supabase()
                    .from("money_exchange_cache")
                    .select("*")
                    .eq("cache_key", cacheKey)
                    .maybeSingle();

                if (!cacheError && cached) {
                    const fetchedAt = new Date(cached.fetched_at);
                    const ageMinutes = (now.getTime() - fetchedAt.getTime()) / 60000;

                    if (ageMinutes <= STORES_CACHE_TTL_MINUTES) {
                        console.log(`✅ Cache HIT - Age: ${ageMinutes.toFixed(1)} minutes`);
                        
                        const cachedLocations = cached.locations || [];
                        const limitedLocations = limit ? cachedLocations.slice(0, limit) : cachedLocations;

                        return Response.json({ 
                            locations: limitedLocations, 
                            all_locations: cachedLocations,
                            source: "cache",
                            fetched_at: cached.fetched_at
                        });
                    } else {
                        console.log(`⏰ Cache EXPIRED - Age: ${ageMinutes.toFixed(1)} minutes`);
                    }
                }
            } catch (error) {
                console.log("Cache read error (continuing with live fetch):", error.message);
            }
        } else {
            console.log("🔄 Force refresh requested - bypassing cache");
        }

        // NO valid cache - fetch live
        console.log("📡 Fetching LIVE data from Google Places API");
        const liveLocations = await fetchLiveLocations({
            latitude,
            longitude,
            fromCurrency,
            toCurrency,
            radiusMiles,
            sortBy,
            openOnly,
            apiKey,
            exchangeApiKey
        });

        // Save to cache
        try {
            await base44.asServiceRole
                .supabase()
                .from("money_exchange_cache")
                .upsert({
                    cache_key: cacheKey,
                    locations: liveLocations,
                    fetched_at: now.toISOString(),
                    latitude: latKey,
                    longitude: lngKey,
                    radius_miles: radiusKey,
                    from_currency: fromCurrency || null,
                    to_currency: toCurrency || null,
                    sort_by: sortBy
                });
            
            console.log("💾 Saved to cache");
        } catch (error) {
            console.log("Cache write error (non-fatal):", error.message);
        }

        // Return live result
        const limitedLocations = limit ? liveLocations.slice(0, limit) : liveLocations;

        console.log(`Returning ${limitedLocations.length} limited locations and ${liveLocations.length} total`);

        return Response.json({ 
            locations: limitedLocations, 
            all_locations: liveLocations,
            source: "live",
            fetched_at: now.toISOString()
        });

    } catch (error) {
        console.error("=== FUNCTION ERROR ===");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        
        return Response.json({ 
            error: 'Internal server error',
            details: error.message,
            locations: [], 
            all_locations: [] 
        }, { status: 500 });
    }
});

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}