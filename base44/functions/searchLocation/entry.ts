import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        let user;
        try {
            user = await base44.auth.me();
        } catch (authError) {
            console.error('Auth error:', authError);
            return Response.json({ 
                error: 'Authentication failed', 
                message: 'Please try logging in again',
                results: [] 
            }, { status: 200 });
        }
        
        if (!user) {
            return Response.json({ 
                error: 'Not authenticated', 
                message: 'Please log in to search locations',
                results: [] 
            }, { status: 200 });
        }
        
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error('JSON parse error:', e);
            return Response.json({ 
                error: 'Invalid request', 
                message: 'Please try again',
                results: [] 
            }, { status: 200 });
        }
        
        const query = body?.query;
        
        if (!query || typeof query !== 'string') {
            return Response.json({ 
                error: 'Query required', 
                message: 'Please enter a search term',
                results: [] 
            }, { status: 200 });
        }
        
        const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
        
        if (!apiKey) {
            console.error('GOOGLE_PLACES_API_KEY not set in environment');
            return Response.json({ 
                error: 'Service unavailable',
                message: 'Location search is temporarily unavailable. Please try again later.',
                results: [] 
            }, { status: 200 });
        }
        
        // Use Places API (new) - Text Search with detailed fields
        const url = `https://places.googleapis.com/v1/places:searchText`;
        
        // Check if searching for hotels
        const isHotelSearch = query.toLowerCase().includes('hotel') || 
                             query.toLowerCase().includes('lodging') ||
                             query.toLowerCase().includes('accommodation');
        
        const requestBody = {
            textQuery: query,
            ...(isHotelSearch && {
                includedType: 'lodging',
                rankPreference: 'RELEVANCE'
            })
        };
        
        console.log('=== SEARCH LOCATION DEBUG ===');
        console.log('Query:', query);
        console.log('Is Hotel Search:', isHotelSearch);
        console.log('Request Body:', JSON.stringify(requestBody, null, 2));
        console.log('API Key exists:', !!apiKey);
        console.log('API Key length:', apiKey?.length);
        
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.addressComponents,places.types,places.primaryType'
                },
                body: JSON.stringify(requestBody)
            });
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            return Response.json({ 
                error: 'Network error',
                message: 'Unable to reach location service. Please check your connection and try again.',
                results: [] 
            }, { status: 200 });
        }
        
        console.log('Google API Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('=== GOOGLE API ERROR ===');
            console.error('Status:', response.status);
            console.error('Status Text:', response.statusText);
            console.error('Error Response:', errorText);
            console.error('========================');
            
            return Response.json({ 
                error: 'Location search unavailable',
                message: 'Unable to search locations at this time. Please try again.',
                results: [] 
            }, { status: 200 });
        }
        
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('JSON parse error from Google API:', jsonError);
            return Response.json({ 
                error: 'Invalid response',
                message: 'Received invalid data from location service. Please try again.',
                results: [] 
            }, { status: 200 });
        }
        
        console.log('=== GOOGLE API SUCCESS ===');
        console.log('Places found:', data.places?.length || 0);
        if (data.places && data.places.length > 0) {
            console.log('First result:', JSON.stringify(data.places[0], null, 2));
        }
        console.log('=========================');
        
        if (data.error) {
            console.error('Data contains error:', data.error);
            return Response.json({ 
                error: `Google API Error: ${data.error.message || data.error.status}`,
                message: data.error.message || 'Location search failed',
                results: [] 
            }, { status: 200 });
        }
        
        if (!data.places || data.places.length === 0) {
            console.log('No places found in response');
            return Response.json({ 
                results: [],
                message: isHotelSearch ? 'No hotels found. Try searching with a specific hotel name or area.' : 'No locations found. Try a different search term.'
            });
        }
        
        // Process and validate results
        const results = [];
        let rejectedTooBroadCount = 0;

        for (const place of data.places.slice(0, 8)) {
            const types = place.types || [];
            const primaryType = place.primaryType || '';

            // Granularity classifier — determines how to label, search, and radius this result.
            // - address: specific street address (most precise)
            // - place: landmark, business, hotel, attraction, etc.
            // - city: city / sublocality / postal town (allowed; needs special UX)
            // - state / country: too broad — REJECTED with helpful message
            const hasSpecificType = types.some(type =>
                ['street_address', 'premise', 'point_of_interest', 'establishment',
                 'airport', 'train_station', 'transit_station', 'bus_station', 'subway_station',
                 'tourist_attraction', 'lodging', 'restaurant', 'park', 'shopping_mall',
                 'store', 'museum', 'stadium', 'university', 'school', 'cafe'].includes(type)
            ) || ['airport', 'lodging', 'tourist_attraction', 'shopping_mall', 'store',
                  'restaurant', 'train_station', 'museum', 'park'].includes(primaryType);

            const isStreetAddress = types.includes('street_address') || types.includes('premise');
            const isCity = types.includes('locality') || types.includes('sublocality') || types.includes('postal_town');
            const isState = types.includes('administrative_area_level_1') && !isCity;
            const isCountry = types.includes('country') && !types.includes('administrative_area_level_1') && !isCity;

            let granularity: 'address' | 'place' | 'city' | 'state' | 'country';
            if (isStreetAddress) granularity = 'address';
            else if (hasSpecificType) granularity = 'place';
            else if (isCity) granularity = 'city';
            else if (isState) granularity = 'state';
            else if (isCountry) granularity = 'country';
            else granularity = 'place'; // safe fallback

            // Reject state / country — too broad for nearby search
            if (granularity === 'state' || granularity === 'country') {
                console.log(`Rejecting ${granularity}: ${place.displayName?.text}`);
                rejectedTooBroadCount++;
                continue;
            }
            
            const components = place.addressComponents || [];
            
            // Extract address components
            const streetNumber = components.find(c => c.types.includes("street_number"))?.longText || "";
            const route = components.find(c => c.types.includes("route"))?.longText || "";
            const street = streetNumber && route ? `${streetNumber} ${route}` : route || streetNumber;
            
            const city = components.find(c => c.types.includes("locality"))?.longText || 
                        components.find(c => c.types.includes("sublocality"))?.longText ||
                        components.find(c => c.types.includes("postal_town"))?.longText || "";
            
            const state = components.find(c => c.types.includes("administrative_area_level_1"))?.shortText || "";
            const postalCode = components.find(c => c.types.includes("postal_code"))?.longText || "";
            const countryComp = components.find(c => c.types.includes("country"));
            const country = countryComp?.longText || "";
            
            let stateOrCountry = "";
            if (countryComp?.shortText === "US" || countryComp?.shortText === "CA") {
                stateOrCountry = state || country;
            } else {
                stateOrCountry = country;
            }
            
            // Determine place type for display
            let placeType = "location";
            if (types.includes("airport") || primaryType === "airport") placeType = "airport";
            else if (types.includes("lodging") || primaryType === "lodging") placeType = "hotel";
            else if (types.includes("restaurant") || primaryType === "restaurant") placeType = "restaurant";
            else if (types.includes("shopping_mall") || types.includes("store") || primaryType === "shopping_mall") placeType = "shopping";
            else if (types.includes("tourist_attraction") || types.includes("museum") || primaryType === "tourist_attraction") placeType = "attraction";
            else if (types.includes("park") || primaryType === "park") placeType = "park";
            else if (types.includes("transit_station") || types.includes("train_station") || types.includes("bus_station") || primaryType === "train_station") placeType = "transit";

            // For city granularity, derive a sensible default search radius from
            // Google's viewport (NE/SW corners). Half-diagonal in miles, capped 5–25.
            // Falls back to 15mi when viewport is missing.
            let suggestedRadius: number | null = null;
            if (granularity === 'city') {
                const vp = place.viewport;
                if (vp?.high?.latitude && vp?.low?.latitude) {
                    const halfDiagMi = haversineMiles(
                        vp.high.latitude, vp.high.longitude,
                        vp.low.latitude,  vp.low.longitude
                    ) / 2;
                    suggestedRadius = Math.max(5, Math.min(25, Math.round(halfDiagMi)));
                } else {
                    suggestedRadius = 15;
                }
            }

            results.push({
                placeId: place.id,
                placeName: place.displayName?.text || "",
                granularity,
                suggestedRadius,
                address: {
                    formatted: place.formattedAddress || "",
                    street: street,
                    city: city,
                    state: state,
                    postalCode: postalCode,
                    country: country
                },
                coordinates: {
                    latitude: place.location?.latitude || 0,
                    longitude: place.location?.longitude || 0
                },
                placeType: placeType,
                types: types,
                // Legacy format for backward compatibility
                city: place.displayName?.text || city,
                state_or_country: stateOrCountry,
                latitude: place.location?.latitude || 0,
                longitude: place.location?.longitude || 0,
                full_name: place.formattedAddress || ""
            });
        }

        // If no valid results after filtering, return helpful message
        if (results.length === 0) {
            const message = rejectedTooBroadCount > 0
                ? "That's too broad — please add a city (e.g. \"Paris, France\") or pick a specific address or landmark."
                : "No locations found. Try a different search term.";
            return Response.json({ results: [], message });
        }

        return Response.json({ results });
        
    } catch (error) {
        console.error("Search location error:", error);
        console.error("Error stack:", error.stack);
        
        return Response.json({
            error: 'Search failed',
            message: 'An unexpected error occurred. Please try again.',
            results: []
        }, { status: 200 });
    }
});

// Haversine distance in miles between two lat/lng pairs.
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}