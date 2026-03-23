import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log("=== reverseGeocode started ===");
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            console.log("No user authenticated");
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("User authenticated:", user.email);

        const { latitude, longitude } = await req.json();

        console.log("Coordinates:", latitude, longitude);

        if (!latitude || !longitude) {
            return Response.json({ error: 'Latitude and longitude are required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
        
        if (!apiKey) {
            console.log("GOOGLE_MAPS_API_KEY not found");
            return Response.json({ 
                error: 'Google Maps API key not configured'
            }, { status: 500 });
        }
        
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
        
        console.log("Calling Geocoding API...");
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log("API Error Response:", errorText);
            return Response.json({ 
                error: 'Geocoding API request failed',
                details: errorText
            }, { status: 500 });
        }
        
        const data = await response.json();

        console.log("Geocoding API status:", data.status);

        if (data.status !== "OK") {
            console.log("Geocoding error:", data);
            return Response.json({ 
                error: 'Geocoding error', 
                details: data 
            }, { status: 500 });
        }

        // Find the best result (usually the first one with locality)
        const result = data.results[0];
        const addressComponents = result.address_components || [];
        
        // Extract city and state/country
        let city = "";
        let stateOrCountry = "";
        let country = "";
        
        const cityComponent = addressComponents.find(c => 
            c.types.includes("locality") || c.types.includes("sublocality")
        );
        const stateComponent = addressComponents.find(c => 
            c.types.includes("administrative_area_level_1")
        );
        const countryComponent = addressComponents.find(c => 
            c.types.includes("country")
        );
        
        city = cityComponent?.long_name || "";
        country = countryComponent?.long_name || "";
        
        if (countryComponent?.short_name === "US" || countryComponent?.short_name === "CA") {
            stateOrCountry = stateComponent?.long_name || country;
        } else {
            stateOrCountry = country;
        }

        console.log("Geocoded location:", city, stateOrCountry, country);

        return Response.json({
            city,
            state_or_country: stateOrCountry,
            country,
            latitude,
            longitude,
            formatted_address: result.formatted_address
        });

    } catch (error) {
        console.error("=== FUNCTION ERROR ===");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        
        return Response.json({ 
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
});