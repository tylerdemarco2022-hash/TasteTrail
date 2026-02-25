const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// In-memory cache to avoid hammering Overpass API
const cache = {};
const CACHE_TIME = 1000 * 60 * 60; // 1 hour

app.post("/restaurants", async (req, res) => {
    const { lat, lng, radius } = req.body;

    if (!lat || !lng || !radius) {
        return res.status(400).json({ error: "Missing lat, lng, or radius" });
    }

    // Check cache first
    const key = `${lat}-${lng}-${radius}`;
    if (cache[key] && Date.now() - cache[key].timestamp < CACHE_TIME) {
        console.log(`✅ Serving from cache: ${key}`);
        return res.json(cache[key].data);
    }

    // Overpass query - searches for restaurants only (filtered)
    const overpassQuery = `
    [out:json];
    (
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      way["amenity"="restaurant"](around:${radius},${lat},${lng});
      relation["amenity"="restaurant"](around:${radius},${lat},${lng});
    );
    out center;
    `;

    try {
        console.log(`🔍 Querying Overpass API for (${lat}, ${lng}) radius ${radius}m`);
        
        const response = await axios.post(
            "https://overpass-api.de/api/interpreter",
            overpassQuery,
            { headers: { "Content-Type": "text/plain" } }
        );

        // Clean the data - remove garbage
        const restaurants = response.data.elements
            .filter(place => place.tags?.name) // MUST have a name
            .map(place => ({
                id: place.id,
                name: place.tags.name,
                lat: place.lat || place.center?.lat,
                lng: place.lon || place.center?.lon,
                cuisine: place.tags?.cuisine || null,
                phone: place.tags?.phone || null,
                website: place.tags?.website || null,
                address: place.tags?.["addr:street"] || null,
                city: place.tags?.["addr:city"] || null
            }))
            // Remove duplicates by name (case-insensitive)
            .filter((place, index, self) => 
                index === self.findIndex(p => 
                    p.name.toLowerCase() === place.name.toLowerCase()
                )
            );

        console.log(`✅ Found ${restaurants.length} restaurants`);

        // Cache the result
        cache[key] = {
            timestamp: Date.now(),
            data: restaurants
        };

        res.json(restaurants);
    } catch (error) {
        console.error("❌ Overpass query failed:", error.message);
        res.status(500).json({ error: "Overpass query failed" });
    }
});

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", cached_keys: Object.keys(cache).length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Restaurant Discovery Server running on port ${PORT}`);
    console.log(`📍 POST /restaurants with { lat, lng, radius }`);
});
