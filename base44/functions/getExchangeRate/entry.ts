import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log("=== getExchangeRate started ===");
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            console.log("No user authenticated");
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("User authenticated:", user.email);

        const body = await req.json();
        const { from, to, amount } = body;

        console.log("Exchange request:", { from, to, amount });

        if (!from || !to) {
            console.log("Missing currency codes");
            return Response.json({ error: 'from and to currencies are required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("EXCHANGERATE_API_KEY");
        
        if (!apiKey) {
            console.log("EXCHANGERATE_API_KEY not found");
            return Response.json({ 
                error: 'Exchange Rate API key not configured'
            }, { status: 500 });
        }

        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from}/${to}`;
        
        console.log("Calling Exchange Rate API...");
        console.log("URL:", url);
        
        const response = await fetch(url);

        console.log("Response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.log("API Error Response:", errorText);
            return Response.json({ 
                error: `Exchange Rate API returned ${response.status}`,
                details: errorText
            }, { status: 500 });
        }

        const data = await response.json();

        console.log("API Response:", data);

        if (data.result !== "success") {
            console.log("API Error:", data);
            return Response.json({ 
                error: 'Exchange rate API error', 
                details: data 
            }, { status: 500 });
        }

        const rate = data.conversion_rate;
        const convertedAmount = amount ? parseFloat(amount) * rate : null;

        console.log("Exchange rate:", rate);
        console.log("Converted amount:", convertedAmount);

        return Response.json({
            from_currency: from,
            to_currency: to,
            exchange_rate: rate,
            rate_description: `1 ${from} = ${rate.toFixed(4)} ${to}`,
            converted_amount: convertedAmount,
            last_updated: data.time_last_update_utc
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