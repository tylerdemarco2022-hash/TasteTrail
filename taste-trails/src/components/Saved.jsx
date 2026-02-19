import React, { useEffect, useState } from 'react';

export default function Saved() {
  const [savedItems, setSavedItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [sortBy, setSortBy] = useState('restaurant'); // 'restaurant', 'date', 'rating'

  const getPriceDisplay = (priceLevel) => {
    if (!priceLevel) return '$$'
    return '$'.repeat(Math.min(Math.max(priceLevel, 1), 5))
  };

  const handleUnsave = async (item) => {
    const profileId = localStorage.getItem('currentProfileId') || 'defaultProfile';
    const saved = JSON.parse(localStorage.getItem('savedItems')) || [];
    const updatedSaved = saved.filter(
      savedItem => !(savedItem.name === item.name && savedItem.restaurant === item.restaurant)
    );
    localStorage.setItem('savedItems', JSON.stringify(updatedSaved));
    
    // Remove from database
    try {
      await fetch(`${API_BASE_URL}/api/saved-items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profileId,
          restaurant_id: item.restaurant_id,
          item_name: item.name
        })
      });
    } catch (e) {
      console.error('Failed to remove from database:', e);
    }
    
    // Update local state
    setSavedItems(updatedSaved.filter((i) => i.profileId === profileId));
    
    // Emit event to notify other components
    const event = new Event('savedItemsUpdated');
    window.dispatchEvent(event);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditRating(item.user_rating || 0);
    setEditComment(item.user_comment || '');
  };

  const handleSaveEdit = async (item) => {
    const profileId = localStorage.getItem('currentProfileId') || 'defaultProfile';
    
    // Update in database
    try {
      await fetch(`${API_BASE_URL}/api/saved-items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profileId,
          restaurant_id: item.restaurant_id,
          item_name: item.name,
          user_rating: editRating || null,
          user_comment: editComment || null
        })
      });
    } catch (e) {
      console.error('Failed to update in database:', e);
    }
    
    // Update localStorage
    const saved = JSON.parse(localStorage.getItem('savedItems')) || [];
    const updated = saved.map(savedItem => {
      if (savedItem.name === item.name && savedItem.restaurant === item.restaurant) {
        return { ...savedItem, user_rating: editRating || null, user_comment: editComment || null };
      }
      return savedItem;
    });
    localStorage.setItem('savedItems', JSON.stringify(updated));
    
    // Update local state
    setSavedItems(updated.filter((i) => i.profileId === profileId));
    setEditingItem(null);
    
    // Emit event
    const event = new Event('savedItemsUpdated');
    window.dispatchEvent(event);
  };

  // Ensure restaurants are loaded from the backend
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/restaurants`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setSavedItems(data.map(restaurant => ({
            id: restaurant.id,
            name: restaurant.name,
            ...restaurant
          })));
        }
      } catch (error) {
        console.error("Failed to fetch restaurants:", error);
      }
    };

    fetchRestaurants();
  }, []);

  useEffect(() => {
    const fetchSavedItems = async () => {
      const profileId = localStorage.getItem('currentProfileId') || 'defaultProfile';
      
      // Migrate existing items without profileId (one-time fix)
      let saved = JSON.parse(localStorage.getItem('savedItems')) || [];
      const needsMigration = saved.some(item => !item.profileId);
      if (needsMigration) {
        saved = saved.map(item => ({
          ...item,
          profileId: item.profileId || profileId
        }));
        localStorage.setItem('savedItems', JSON.stringify(saved));
      }
      
      // Try to fetch from database first
      try {
        const response = await fetch(`${API_BASE_URL}/api/saved-items?user_id=${profileId}`);
        if (response.ok) {
          const text = await response.text()
          console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
          let data
          try {
            data = JSON.parse(text)
          } catch (e) {
            console.error("NOT JSON RESPONSE:", text.slice(0, 200))
            throw e
          }
          if (data.savedItems && data.savedItems.length > 0) {
            // Transform database format to match localStorage format
            const transformed = data.savedItems.map(item => ({
              name: item.item_name,
              rating: item.item_rating,
              image: item.item_image,
              restaurant_id: item.restaurant_id,
              profileId: item.user_id,
              user_rating: item.user_rating,
              user_comment: item.user_comment
            }));
            setSavedItems(transformed);
            // Sync to localStorage
            localStorage.setItem('savedItems', JSON.stringify(transformed));
            return;
          }
        }
      } catch (e) {
        console.error('Failed to fetch from database, falling back to localStorage:', e);
      }
      
      // Fallback to localStorage (reuse saved variable)
      const filtered = saved.filter((item) => item.profileId === profileId);
      setSavedItems(filtered);
    };

    // Fetch saved items from localStorage on mount
    fetchSavedItems();

    // Add event listener for custom event
    const handleCustomEvent = () => fetchSavedItems();
    window.addEventListener('savedItemsUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('savedItemsUpdated', handleCustomEvent);
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Saved Items</h2>
        
        {/* Sort Dropdown */}
        {savedItems.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            >
              <option value="restaurant">Restaurant (A-Z)</option>
              <option value="restaurant-desc">Restaurant (Z-A)</option>
              <option value="items">Most Items</option>
              <option value="items-desc">Fewest Items</option>
            </select>
          </div>
        )}
      </div>
      
      {savedItems.length === 0 ? (
        <p className="text-gray-500">No saved items yet.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(
            savedItems.reduce((acc, item) => {
              const restaurant = item.restaurant || 'Unknown Restaurant';
              if (!acc[restaurant]) acc[restaurant] = [];
              acc[restaurant].push(item);
              return acc;
            }, {})
          )
          .sort((a, b) => {
            const [restaurantA, itemsA] = a;
            const [restaurantB, itemsB] = b;
            
            switch (sortBy) {
              case 'restaurant':
                return restaurantA.localeCompare(restaurantB);
              case 'restaurant-desc':
                return restaurantB.localeCompare(restaurantA);
              case 'items':
                return itemsB.length - itemsA.length; // Most items first
              case 'items-desc':
                return itemsA.length - itemsB.length; // Fewest items first
              default:
                return 0;
            }
          })
          .map(([restaurant, items]) => (
            <div key={restaurant} className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-lg">{restaurant}</h3>
                <span className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid gap-4">
                {items.map((item, index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0">
                    <div className="flex items-start gap-4">
                      {item.image && <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />}
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          {item.rating && (
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-500">★</span>
                              <span className="text-xs text-gray-600">{item.rating}</span>
                            </div>
                          )}
                          {item.price && (
                            <span className="text-xs text-amber-600 font-semibold">{getPriceDisplay(item.price)}</span>
                          )}
                        </div>
                        
                        {editingItem?.name === item.name && editingItem?.restaurant === item.restaurant ? (
                          <div className="mt-3 space-y-2">
                            <div>
                              <label className="text-xs text-gray-600 block mb-1">My Rating (1-10):</label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="range" 
                                  min="1" 
                                  max="10" 
                                  step="0.1"
                                  value={editRating || 5}
                                  onChange={(e) => setEditRating(Number(e.target.value))}
                                  className="flex-1"
                                />
                                <span className="text-sm font-semibold w-8">{(editRating || 5).toFixed(1)}</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 block mb-1">My Notes:</label>
                              <textarea
                                value={editComment}
                                onChange={(e) => setEditComment(e.target.value)}
                                placeholder="Add your notes..."
                                className="w-full px-2 py-1 text-sm border rounded resize-none"
                                rows="2"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(item)}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            {item.user_rating && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-600">My Rating:</span>
                                <span className="text-sm font-semibold text-yellow-600">{item.user_rating.toFixed(1)}/10</span>
                              </div>
                            )}
                            {item.user_comment && (
                              <p className="text-xs text-gray-700 italic mt-1">{item.user_comment}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="px-3 py-1 text-xs bg-yellow-500 text-white border-2 border-yellow-600 hover:bg-yellow-600 rounded whitespace-nowrap"
                        >
                          {item.user_rating || item.user_comment ? 'Edit' : 'Add Rating'}
                        </button>
                        <button
                          onClick={() => handleUnsave(item)}
                          className="px-3 py-1 text-xs bg-red-500 text-white border-2 border-red-600 hover:bg-red-600 rounded"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}