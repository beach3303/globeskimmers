import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log("=== Testing Google Maps API ===");
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
        
        if (!apiKey) {
            return Response.json({ 
                success: false,
                error: 'GOOGLE_MAPS_API_KEY not found in environment variables',
                message: 'Please add your Google Maps API key to base44 Secrets'
            });
        }

        console.log("API Key found, testing Places API...");

        // Test 1: Places API (Nearby Search)
        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=34.106,-118.027&radius=16000&type=bank&keyword=currency+exchange&key=${apiKey}`;
        
        const placesResponse = await fetch(placesUrl);
        const placesData = await placesResponse.json();

        console.log("Places API Status:", placesData.status);
        console.log("Places API Results:", placesData.results?.length || 0);

        // Test 2: Geocoding API
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=34.106,-118.027&key=${apiKey}`;
        
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        console.log("Geocoding API Status:", geocodeData.status);

        // Test 3: Places Autocomplete API
        const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Los+Angeles&types=(cities)&key=${apiKey}`;
        
        const autocompleteResponse = await fetch(autocompleteUrl);
        const autocompleteData = await autocompleteResponse.json();

        console.log("Autocomplete API Status:", autocompleteData.status);

        // Compile results
        const results = {
            success: true,
            api_key_found: true,
            places_api: {
                status: placesData.status,
                working: placesData.status === "OK" || placesData.status === "ZERO_RESULTS",
                results_count: placesData.results?.length || 0,
                error_message: placesData.error_message || null,
                sample_result: placesData.results?.[0]?.name || null
            },
            geocoding_api: {
                status: geocodeData.status,
                working: geocodeData.status === "OK",
                error_message: geocodeData.error_message || null,
                sample_result: geocodeData.results?.[0]?.formatted_address || null
            },
            autocomplete_api: {
                status: autocompleteData.status,
                working: autocompleteData.status === "OK",
                error_message: autocompleteData.error_message || null,
                predictions_count: autocompleteData.predictions?.length || 0
            }
        };

        // Overall assessment
        const allWorking = 
            results.places_api.working && 
            results.geocoding_api.working && 
            results.autocomplete_api.working;

        results.overall_status = allWorking ? "✅ ALL APIS WORKING!" : "⚠️ SOME APIS NOT WORKING";

        if (!allWorking) {
            results.recommendations = [];
            
            if (!results.places_api.working) {
                results.recommendations.push("Enable 'Places API' in Google Cloud Console");
            }
            if (!results.geocoding_api.working) {
                results.recommendations.push("Enable 'Geocoding API' in Google Cloud Console");
            }
            if (!results.autocomplete_api.working) {
                results.recommendations.push("Enable 'Places API' (includes Autocomplete) in Google Cloud Console");
            }
        }

        return Response.json(results);

    } catch (error) {
        console.error("Test error:", error);
        return Response.json({ 
            success: false,
            error: 'Test failed',
            details: error.message
        }, { status: 500 });
    }
});