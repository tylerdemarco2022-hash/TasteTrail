# Discovery Engine v2 API Examples & Usage Guide

Practical examples for integrating with the new discovery engine endpoints and features.

## 🌐 API Endpoints

### GET /api/restaurants
**Location-aware restaurant discovery with trending & filtering**

#### Basic Search
```bash
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5"
```

#### Sort by Trending
```bash
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5&sort=trending"
```

#### Include Closed Restaurants
```bash
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5&include_closed=true"
```

#### Complete Example with All Parameters
```bash
curl "http://localhost:8081/api/restaurants" \
  -G \
  -d "lat=35.2271" \
  -d "lng=-80.8431" \
  -d "radius=10" \
  -d "sort=trending" \
  -d "include_closed=false"
```

---

### POST /api/admin/restaurants/{id}/flag-closed
**Report a restaurant as closed**

#### Report Closure
```bash
curl -X POST "http://localhost:8081/api/admin/restaurants/123/flag-closed" \
  -H "Content-Type: application/json"
```

---

## 📋 Response Examples

### Successful Search Response (sort=distance)
```json
{
  "success": true,
  "searchCenter": {
    "lat": 35.2271,
    "lng": -80.8431
  },
  "radiusMiles": 5,
  "sortBy": "distance",
  "count": 3,
  "tile": {
    "city": "Charlotte",
    "priority": 6
  },
  "restaurants": [
    {
      "id": "123",
      "name": "Blue Bar Smokehouse",
      "cuisine": "BBQ",
      "cover_photo_url": "https://...",
      "distance": 0.52,
      "badge": "Verified",
      "confidence": 4.5,
      "trending_score": 15.0,
      "trending_badge": "🔥 Trending",
      "flagged_closed": false,
      "views_7d": 5,
      "confirms_30d": 2
    },
    {
      "id": "456",
      "name": "Fahrenheit",
      "cuisine": "Modern American",
      "cover_photo_url": "https://...",
      "distance": 1.23,
      "badge": "Strong Data",
      "confidence": 3.8,
      "trending_score": 8.0,
      "trending_badge": null,
      "flagged_closed": false,
      "views_7d": 2,
      "confirms_30d": 1
    },
    {
      "id": "789",
      "name": "Closed Restaurant",
      "cuisine": "Italian",
      "cover_photo_url": "https://...",
      "distance": 2.15,
      "badge": "New",
      "confidence": 1.5,
      "trending_score": 0,
      "trending_badge": null,
      "flagged_closed": true,
      "views_7d": 0,
      "confirms_30d": 1
    }
  ]
}
```

---

### Successful Search Response (sort=trending)
```json
{
  "success": true,
  "searchCenter": {
    "lat": 35.2271,
    "lng": -80.8431
  },
  "radiusMiles": 5,
  "sortBy": "trending",
  "count": 3,
  "restaurants": [
    {
      "id": "123",
      "name": "Blue Bar Smokehouse",
      "distance": 0.52,
      "trending_score": 15.0,
      "trending_badge": "🔥 Trending",
      "confidence": 4.5,
      "badge": "Verified",
      "flagged_closed": false
    },
    {
      "id": "456",
      "name": "Fahrenheit",
      "distance": 1.23,
      "trending_score": 8.0,
      "trending_badge": null,
      "confidence": 3.8,
      "badge": "Strong Data",
      "flagged_closed": false
    }
  ]
}
```

---

### Successful Closure Reporting Response
```json
{
  "success": true,
  "restaurantId": "123",
  "flagged_closed": true,
  "updated_confidence": 2.5,
  "message": "Thank you for reporting. This restaurant may be closed."
}
```

---

### Error Response - Missing Parameters
```json
{
  "error": "Missing required parameters: lat and lng",
  "example": "/api/restaurants?lat=35.2271&lng=-80.843&radius=5&sort=distance"
}
```

---

### Error Response - Invalid Coordinates
```json
{
  "error": "Invalid coordinates"
}
```

---

### Error Response - Restaurant Not Found
```json
{
  "error": "Restaurant not found"
}
```

---

## 💻 Frontend Integration Examples

### React Hook: useRestaurantSearch
```javascript
import { useState } from 'react';

export function useRestaurantSearch() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('distance');

  const search = async (lat, lng, radius = 5) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        lat,
        lng,
        radius,
        sort: sortBy
      });
      
      const response = await fetch(
        `http://localhost:8081/api/restaurants?${params}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResults(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    results,
    loading,
    error,
    search,
    sortBy,
    setSortBy
  };
}
```

---

### React Component: RestaurantList
```jsx
import { useRestaurantSearch } from './hooks/useRestaurantSearch';
import RestaurantCard from './RestaurantCard';

export default function RestaurantList() {
  const { results, loading, error, search, sortBy, setSortBy } = 
    useRestaurantSearch();

  const handleSearch = (lat, lng) => {
    search(lat, lng, 5);
  };

  const toggleSort = () => {
    const newSort = sortBy === 'distance' ? 'trending' : 'distance';
    setSortBy(newSort);
    // Re-search with new sort
    if (results) {
      search(results.searchCenter.lat, results.searchCenter.lng);
    }
  };

  return (
    <div>
      {/* Sort Toggle */}
      <button onClick={toggleSort}>
        Switch to {sortBy === 'distance' ? '🔥 Trending' : '📍 Distance'}
      </button>

      {/* Loading */}
      {loading && <p>Searching...</p>}

      {/* Error */}
      {error && <p className="error">{error}</p>}

      {/* Results */}
      {results && (
        <div>
          <p>Found {results.count} restaurants</p>
          <div className="grid">
            {results.restaurants.map(restaurant => (
              <RestaurantCard 
                key={restaurant.id} 
                restaurant={restaurant}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Vue.js Composition API
```javascript
import { ref, computed } from 'vue';

export function useDiscoveryEngine() {
  const restaurants = ref([]);
  const loading = ref(false);
  const sortBy = ref('distance');
  const sortOptions = ['distance', 'trending'];

  const fetchRestaurants = async (lat, lng, radius = 5) => {
    loading.value = true;
    
    const url = new URL('http://localhost:8081/api/restaurants');
    url.searchParams.append('lat', lat);
    url.searchParams.append('lng', lng);
    url.searchParams.append('radius', radius);
    url.searchParams.append('sort', sortBy.value);

    try {
      const response = await fetch(url);
      const data = await response.json();
      restaurants.value = data.restaurants;
    } finally {
      loading.value = false;
    }
  };

  const sortedRestaurants = computed(() => {
    if (sortBy.value === 'trending') {
      return [...restaurants.value].sort((a, b) => 
        b.trending_score - a.trending_score
      );
    }
    return restaurants.value;
  });

  return {
    restaurants: sortedRestaurants,
    loading,
    sortBy,
    sortOptions,
    fetchRestaurants
  };
}
```

---

### JavaScript Fetch (Vanilla)
```javascript
// Get nearby restaurants sorted by distance
async function getNearbyRestaurants(lat, lng, radius = 5) {
  try {
    const params = {
      lat,
      lng,
      radius,
      sort: 'distance'
    };

    const query = new URLSearchParams(params).toString();
    const response = await fetch(
      `http://localhost:8081/api/restaurants?${query}`
    );

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success) {
      return data.restaurants;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

// Get trending restaurants
async function getTrendingRestaurants(lat, lng, radius = 10) {
  const params = {
    lat,
    lng,
    radius,
    sort: 'trending'
  };

  const query = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:8081/api/restaurants?${query}`
  );

  const data = await response.json();
  return data.restaurants.filter(r => r.trending_badge);
}

// Report restaurant as closed
async function reportRestaurantClosed(restaurantId) {
  try {
    const response = await fetch(
      `http://localhost:8081/api/admin/restaurants/${restaurantId}/flag-closed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    
    if (data.success) {
      alert('Thank you for reporting!');
      return data;
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('Report failed:', error);
  }
}

// Usage
getNearbyRestaurants(35.2271, -80.8431, 5).then(restaurants => {
  console.log(`Found ${restaurants.length} restaurants`);
  restaurants.forEach(r => {
    console.log(`${r.name} - ${r.distance} mi away`);
  });
});
```

---

### Axios Integration
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8081/api',
  timeout: 10000
});

// Search restaurants
export async function searchRestaurants(lat, lng, options = {}) {
  const {
    radius = 5,
    sort = 'distance',
    includeClosed = false
  } = options;

  const response = await api.get('/restaurants', {
    params: {
      lat,
      lng,
      radius,
      sort,
      include_closed: includeClosed
    }
  });

  return response.data;
}

// Report closure
export async function reportClosure(restaurantId) {
  const response = await api.post(
    `/admin/restaurants/${restaurantId}/flag-closed`
  );

  return response.data;
}

// Usage
try {
  const results = await searchRestaurants(35.2271, -80.8431, {
    radius: 10,
    sort: 'trending'
  });
  
  console.log(`Found: ${results.count}`);
  
  // Report closure on specific restaurant
  const report = await reportClosure(results.restaurants[0].id);
  console.log(report.message);
} catch (error) {
  console.error('API Error:', error.message);
}
```

---

## 🔄 Advanced Usage Patterns

### Real-time Trending Updates
```javascript
// Poll API periodically to catch trending changes
let lastTrendingRestaurants = [];

async function updateTrendingRestaurants(lat, lng) {
  const results = await searchRestaurants(lat, lng, { sort: 'trending' });
  
  const newTrending = results.restaurants
    .filter(r => r.trending_badge)
    .map(r => r.id);
  
  // Check for new trending restaurants
  const justBecameTrending = newTrending.filter(
    id => !lastTrendingRestaurants.includes(id)
  );
  
  if (justBecameTrending.length > 0) {
    console.log('🔥 New trending restaurants found!');
    showNotification('Check out what\'s trending now!');
  }
  
  lastTrendingRestaurants = newTrending;
}

// Update every 5 minutes
setInterval(() => {
  updateTrendingRestaurants(35.2271, -80.8431);
}, 5 * 60 * 1000);
```

---

### Distance-Based Filtering
```javascript
// Get only very close restaurants
async function getFastDelivery(lat, lng, maxDistance = 2) {
  const results = await searchRestaurants(lat, lng, {
    radius: 5,
    sort: 'distance'
  });

  return results.restaurants.filter(r => r.distance <= maxDistance);
}

// Get quality restaurants (high confidence)
async function getQualityRestaurants(lat, lng) {
  const results = await searchRestaurants(lat, lng, {
    radius: 10,
    sort: 'distance'
  });

  return results.restaurants.filter(r => r.confidence >= 4.0);
}

// Get trending within distance
async function getTrendingNearby(lat, lng, maxDistance = 5) {
  const results = await searchRestaurants(lat, lng, {
    radius: 10,
    sort: 'trending'
  });

  return results.restaurants.filter(r => 
    r.distance <= maxDistance && r.trending_badge
  );
}
```

---

### Activity Tracking
```javascript
// Track user searches to build preference profile
class UserSearchHistory {
  constructor() {
    this.searches = [];
    this.preferences = {
      avgRadius: 0,
      preferredAreas: {},
      sortPreference: 'distance'
    };
  }

  recordSearch(results, sortBy) {
    this.searches.push({
      timestamp: new Date(),
      count: results.count,
      radius: results.radiusMiles,
      tile: results.tile,
      sortBy,
      results: results.restaurants.map(r => ({
        id: r.id,
        name: r.name,
        distance: r.distance
      }))
    });

    this.updatePreferences();
  }

  updatePreferences() {
    const searches = this.searches.slice(-10); // Last 10
    
    // Average radius
    this.preferences.avgRadius = 
      searches.reduce((sum, s) => sum + s.radius, 0) / searches.length;
    
    // Most visited areas (by tile)
    searches.forEach(s => {
      if (s.tile) {
        this.preferences.preferredAreas[s.tile.city] = 
          (this.preferences.preferredAreas[s.tile.city] || 0) + 1;
      }
    });
    
    // Most used sort
    const trendingSortCount = searches.filter(s => s.sortBy === 'trending').length;
    this.preferences.sortPreference = trendingSortCount > 5 ? 'trending' : 'distance';
  }

  getRecommendedSearchParams() {
    return {
      radius: Math.round(this.preferences.avgRadius * 10) / 10,
      sort: this.preferences.sortPreference
    };
  }
}

// Usage
const history = new UserSearchHistory();

const results = await searchRestaurants(35.2271, -80.8431, { sort: 'distance' });
history.recordSearch(results, 'distance');

// Later...
const recommendedParams = history.getRecommendedSearchParams();
const nextSearch = await searchRestaurants(lat, lng, recommendedParams);
```

---

### Confidence-Based Ranking
```javascript
// Group restaurants by confidence level
async function groupByConfidence(lat, lng) {
  const results = await searchRestaurants(lat, lng);

  const grouped = {
    verified: [],      // >= 4.0
    strongData: [],    // >= 3.0 && < 4.0
    new: []            // < 3.0
  };

  results.restaurants.forEach(r => {
    if (r.confidence >= 4.0) grouped.verified.push(r);
    else if (r.confidence >= 3.0) grouped.strongData.push(r);
    else grouped.new.push(r);
  });

  return grouped;
}

// Get only verified restaurants
async function getVerifiedOnly(lat, lng) {
  const results = await searchRestaurants(lat, lng);
  return results.restaurants.filter(r => r.badge === 'Verified');
}

// Confidence score analysis
async function getConfidenceStats(lat, lng) {
  const results = await searchRestaurants(lat, lng);

  const scores = results.restaurants.map(r => r.confidence);
  
  return {
    average: scores.reduce((a, b) => a + b, 0) / scores.length,
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    median: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]
  };
}
```

---

## 📊 Data Interpretation Guide

### Trending Score Meaning
- **0-5:** New or rarely viewed
- **5-15:** Moderate interest
- **15-30:** Popular, gaining traction
- **30+:** Viral, trending in community

### Confidence Levels
| Score | Level | Meaning |
|-------|-------|---------|
| 4.0-5.0 | Verified | Multiple data sources confirmed |
| 3.0-3.9 | Strong Data | Good coverage and signals |
| 2.0-2.9 | Building | Growth from community |
| 1.0-1.9 | New Data | Recently added |
| 0.0-0.9 | Unverified | Limited information |

### Badge Meanings
- **🔥 Trending:** High activity in last 7 days, trending_score >= 20
- **⚠️ Reported Closed:** Community reported closure
- **✓ Verified:** Confidence >= 4.0
- **◆ Strong Data:** 3.0 <= Confidence < 4.0
- **○ New:** Confidence < 3.0

---

## ⚡ Performance Tips

1. **Limit Searches:** Debounce user input to reduce API calls
2. **Cache Results:** Store results locally before making new request
3. **Lazy Load Photos:** Use loading="lazy" on cover_photo_url
4. **Pagination:** Consider splitting large result sets
5. **Smart Polling:** Don't update trending every second (5-10 min is better)

---

## 🔗 Cross-Origin (CORS)

If calling from different domain:
```javascript
// Backend must enable CORS for your frontend domain
const corsOptions = {
  origin: 'http://localhost:5174',
  credentials: 'include'
};

app.use(cors(corsOptions));
```

---

## 📞 Troubleshooting API Calls

### Request Times Out
```javascript
// Increase timeout or retry
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}
```

### Network Error
```javascript
// Check if backend is running
// Verify endpoint URL: http://localhost:8081/
// Check browser console for CORS errors
```

### Invalid Parameters Warning
```javascript
// Common issues:
// lat: -90 to 90 (use positive for North)
// lng: -180 to 180 (negative for West)
// radius: > 0
// sort: must be 'distance' or 'trending'
```

---

## 📚 Related Documentation

- See DISCOVERY_ENGINE_V2_TESTING.md for comprehensive tests
- See DISCOVERY_ENGINE_V2_CHANGES.md for implementation details
- See discoveryEngineUtils.js for function signatures
