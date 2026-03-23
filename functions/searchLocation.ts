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
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.types,places.primaryType'
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
        
        for (const place of data.places.slice(0, 8)) {
            // VALIDATION: Check if location is specific enough
            const types = place.types || [];
            const primaryType = place.primaryType || '';
            
            // Skip pure administrative areas
            const isOnlyAdministrative = types.length > 0 && types.every(type => 
                ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 
                 'country', 'political', 'sublocality'].includes(type)
            );
            
            // Check if it has a specific location type
            const hasSpecificType = types.some(type =>
                ['street_address', 'premise', 'point_of_interest', 'establishment',
                 'airport', 'train_station', 'transit_station', 'bus_station', 'subway_station',
                 'tourist_attraction', 'lodging', 'restaurant', 'park', 'shopping_mall',
                 'store', 'museum', 'stadium', 'university', 'school', 'cafe'].includes(type)
            ) || ['airport', 'lodging', 'tourist_attraction', 'shopping_mall', 'store', 
                  'restaurant', 'train_station', 'museum', 'park'].includes(primaryType);
            
            // Skip if it's ONLY administrative without specific location
            if (isOnlyAdministrative && !hasSpecificType) {
                console.log(`Skipping administrative area: ${place.displayName?.text}`);
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
            
            results.push({
                placeId: place.id,
                placeName: place.displayName?.text || "",
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
            return Response.json({ 
                results: [],
                message: "Please search for a specific address, landmark, or place (not just a city or country)"
            });
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