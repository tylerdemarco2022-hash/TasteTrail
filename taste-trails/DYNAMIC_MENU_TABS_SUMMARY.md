# Dynamic Menu Type Tabs - Implementation Summary

## Overview
Added dynamic top-level menu type tabs (Breakfast, Lunch, Dinner, Drinks) that appear only when a restaurant has multiple menu types.

## Backend Changes

### New Endpoint: `GET /api/restaurants/:name/types`

**File**: `backend/server/routes/menu.js`

**Functionality**:
- Accepts restaurant name (URL-encoded)
- Searches for restaurant in database
- Queries DISTINCT menu_type from menu_items where restaurant_id matches
- Returns JSON with restaurant name and available types (sorted)

**Response Example**:
```json
{
  "restaurant": "Crunkleton",
  "available_types": ["breakfast", "lunch", "dinner"]
}
```

**Query Building**:
- Finds restaurant by name (case-insensitive ILIKE search)
- Gets restaurant ID
- Queries menu_items table for distinct menu_type values
- Filters out null/empty values
- Sorts in order: breakfast → lunch → dinner → drinks

---

## Frontend Changes

### State Variables
**File**: `src/components/MenuView.jsx`

```javascript
const [availableTypes, setAvailableTypes] = useState([]);
const [activeType, setActiveType] = useState(null);
```

### New Function: `fetchMenuTypes()`

**Purpose**: Fetch available menu types and auto-select logic

**Logic**:
```javascript
async function fetchMenuTypes() {
  fetch(`/api/restaurants/{name}/types`)
  
  // Auto-selection:
  if (available_types.length === 1) {
    setActiveType(available_types[0])  // Single type → select it
  } else if (available_types.includes('dinner')) {
    setActiveType('dinner')            // Multiple types → default to dinner
  } else {
    setActiveType(available_types[0])  // No dinner → select first
  }
}
```

### Updated Function: `fetchMenuFromBackend()`

Now passes `activeType` to all API calls:
```javascript
const typeParam = activeType ? activeType : 'dinner'
// Example: GET /api/restaurants/123/full-menu?type=breakfast
```

### useEffect Hooks

**Effect 1**: Fetch available types on mount
```javascript
useEffect(() => {
  if (restaurantName) fetchMenuTypes()
}, [restaurantName])
```

**Effect 2**: Refetch menu when activeType changes
```javascript
useEffect(() => {
  if ((restaurantId || restaurantName) && activeType) {
    fetchMenuFromBackend({ restaurantId, restaurantName })
  }
}, [activeType])
```

### Tab Rendering

**Conditional Rendering**:
```jsx
{availableTypes.length > 1 && (
  <div className="menu-type-tabs">
    {['breakfast', 'lunch', 'dinner', 'drinks'].map(type => (
      availableTypes.includes(type) && (
        <button
          onClick={() => setActiveType(type)}
          className={activeType === type ? 'active' : ''}
        >
          {emoji} {capitalize(type)}
        </button>
      )
    ))}
  </div>
)}
```

**Key Features**:
- Tabs hidden if availableTypes.length ≤ 1
- Only displays types that have menu items
- Clicking tab updates activeType state
- Menu re-fetches with selectedType parameter
- Active tab highlighted with border and color

---

## Data Flow

### Load Restaurant Menu
```
1. MenuView mounts with restaurantName
   ↓
2. useEffect triggers → fetchMenuTypes()
   ↓
3. GET /api/restaurants/{name}/types
   ↓
4. Parse response → setAvailableTypes([...])
   ↓
5. Auto-select:
   - If 1 type → setActiveType(that_type)
   - Else → setActiveType('dinner') if present
   - Else → setActiveType(first_type)
   ↓
6. activeType now set → second useEffect triggers
   ↓
7. fetchMenuFromBackend() called with activeType
   ↓
8. GET /api/restaurants/{name}?type={activeType}
   ↓
9. Menu renders with type-specific sections
```

### User Switches Tab
```
1. User clicks "🌅 Breakfast" tab
   ↓
2. onClick handler → setActiveType('breakfast')
   ↓
3. State updates → activeType changed
   ↓
4. useEffect[activeType] triggers
   ↓
5. fetchMenuFromBackend() with activeType='breakfast'
   ↓
6. GET /api/restaurants/{name}?type=breakfast
   ↓
7. Menu re-renders with breakfast items/sections
```

---

## Behavior Examples

### Single Menu Type (breakfast only)
```
availableTypes = ['breakfast']
→ No tabs rendered
→ activeType auto-set to 'breakfast'
→ Menu loads directly
```

### Multiple Types (breakfast, lunch, dinner)
```
availableTypes = ['breakfast', 'lunch', 'dinner']
→ Tabs rendered for all 3 types
→ activeType auto-set to 'dinner' (default)
→ Clicking breakfast tab switches menu
```

### Custom Order (drinks, breakfast, dinner)
```
availableTypes = ['breakfast', 'dinner', 'drinks']
→ Tabs rendered in standard order (breakfast, dinner, drinks)
→ activeType auto-set to 'breakfast' (first if no dinner)
→ Selection persists while viewing restaurant
```

---

## Testing Checklist

- [ ] Restaurant with 1 menu type: tabs not shown
- [ ] Restaurant with >1 types: tabs shown for available types only
- [ ] Clicking tab updates activeType state
- [ ] Menu refetches with ?type parameter
- [ ] Only 1 type present → auto-selected
- [ ] Multiple types → defaults to 'dinner' if available
- [ ] Tab styling: active tab highlighted, others grayed out
- [ ] Emojis display correctly (🌅 🌞 🌙 🍹)
- [ ] Browser console shows debug logs
- [ ] API calls include ?type=VALUE parameter

---

## Files Modified

1. `backend/server/routes/menu.js`
   - Added: `GET /:name/types` endpoint

2. `src/components/MenuView.jsx`
   - Changed state: `availableMenuTypes` → `availableTypes`, `selectedMenuType` → `activeType`
   - Added: `fetchMenuTypes()` function
   - Updated: `fetchMenuFromBackend()` to use `activeType`
   - Updated: useEffect hooks for type fetching and menu refetching
   - Updated: Tab rendering to use new state names

---

## Performance Notes

- Tab fetch happens once per restaurant load (not every render)
- Menu re-fetches only on activeType change
- Composite index `idx_menu_items_restaurant_type` ensures fast queries
- Frontend auto-selection happens synchronously (no extra API calls)
