# Menu Type System Implementation Guide

## Overview

The Taste Trails application now supports separate menu categories:
- 🌅 **Breakfast**
- 🌞 **Lunch**  
- 🌙 **Dinner** (default)
- 🍹 **Drinks**

This enables restaurants to maintain distinct menus for different times/occasions, with each menu maintaining its own section hierarchy.

---

## Architecture

### 1. Database Schema

**Migration**: `backend/sql/20260226_add_menu_type_support.sql`

```sql
-- Add menu_type column to menu_items
ALTER TABLE menu_items 
ADD COLUMN menu_type TEXT NOT NULL DEFAULT 'dinner';

-- Add constraint to enforce valid values
ALTER TABLE menu_items 
ADD CONSTRAINT menu_items_menu_type_check 
CHECK (menu_type IN ('breakfast', 'lunch', 'dinner', 'drinks'));

-- Add index for efficient filtering
CREATE INDEX idx_menu_items_restaurant_type 
ON menu_items(restaurant_id, menu_type);

-- Add URL columns to restaurants for multi-type menus
ALTER TABLE restaurants
ADD COLUMN breakfast_url TEXT,
ADD COLUMN lunch_url TEXT,
ADD COLUMN dinner_url TEXT,
ADD COLUMN drinks_url TEXT,
ADD COLUMN menu_types TEXT[] DEFAULT '{"dinner"}';
```

**Key Points**:
- Every menu item has a `menu_type` field (defaults to 'dinner')
- CHECK constraint prevents invalid menu types
- Composite index speeds up queries by (restaurant_id, menu_type)
- Restaurants can track multiple menu URLs for different types

---

### 2. Backend Constants

**File**: `backend/constants/menuTypes.js`

```javascript
export const MENU_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  DRINKS: 'drinks'
};

export const DEFAULT_MENU_TYPE = 'dinner';

// Validation & normalization functions
export function isValidMenuType(type)
export function normalizeMenuType(type)
export function getMenuTypeLabel(type)
```

---

### 3. API Endpoints

#### GET `/api/restaurants/:restaurantId/menu-items`

Fetch menu items for a specific restaurant and menu type.

**Parameters**:
- `restaurantId` (path): Restaurant ID
- `type` (query): Menu type ('breakfast'|'lunch'|'dinner'|'drinks', defaults to 'dinner')

**Example**:
```
GET /api/restaurants/{id}/menu-items?type=breakfast
```

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Eggs Benedict",
      "menu_type": "breakfast",
      "section_name": "Egg Dishes",
      ...
    }
  ]
}
```

---

#### GET `/api/restaurants/:restaurantId/full-menu`

Fetch complete menu with sections for a specific type.

**Parameters**:
- `restaurantId` (path): Restaurant ID
- `type` (query): Menu type (defaults to 'dinner')

**Example**:
```
GET /api/restaurants/{id}/full-menu?type=dinner
```

**Response**:
```json
{
  "sections": [
    {
      "name": "Appetizers",
      "items": [...]
    },
    {
      "name": "Entrees",
      "items": [...]
    }
  ],
  "applied_menu_type": "dinner"
}
```

---

#### GET `/api/restaurants/:restaurantId/menu-types` ⭐ NEW

Returns available menu types for a restaurant (only types with items).

**Example**:
```
GET /api/restaurants/{id}/menu-types
```

**Response**:
```json
{
  "restaurant_id": "uuid",
  "available_menu_types": ["breakfast", "lunch", "dinner", "drinks"],
  "total_types": 4,
  "valid_types": ["breakfast", "lunch", "dinner", "drinks"]
}
```

**Frontend Uses This To**:
- Display only tabs for menu types that have items
- If restaurant only has 'drinks' → show only Drinks tab
- If restaurant only has 'dinner' → show only Dinner tab

---

#### GET `/api/debug/menu-sections/:restaurant?type=VALUE`

Debug endpoint to inspect section breakdown for a menu type.

**Parameters**:
- `restaurant` (path): Restaurant name
- `type` (query): Menu type (defaults to 'dinner')

**Example**:
```
GET /api/debug/menu-sections/Crunkleton?type=breakfast
```

---

### 4. Frontend Menu Type Tabs

**File**: `src/components/MenuView.jsx`

#### New State Variables
```javascript
const [availableMenuTypes, setAvailableMenuTypes] = useState([])
const [selectedMenuType, setSelectedMenuType] = useState('dinner')
const [menuTypesLoading, setMenuTypesLoading] = useState(false)
```

#### New Function
```javascript
async function fetchAvailableMenuTypes() {
  // Fetch available types from API
  // Update availableMenuTypes state
  // Only show tabs for types with items
}
```

#### New useEffect
```javascript
useEffect(() => {
  // Refetch menu when selectedMenuType changes
}, [selectedMenuType])
```

#### UI Tabs Component
```jsx
{availableMenuTypes.length > 1 && (
  <div className="flex gap-2 border-b border-amber-200">
    {['breakfast', 'lunch', 'dinner', 'drinks'].map(type => (
      availableMenuTypes.includes(type) && (
        <button
          onClick={() => setSelectedMenuType(type)}
          className={selectedMenuType === type ? 'active' : ''}
        >
          {/* emoji + type name */}
        </button>
      )
    ))}
  </div>
)}
```

**Behavior**:
- Only shows tabs for menu types that have items
- Clicking tab updates `selectedMenuType` state
- Menu re-fetches with new type parameter
- Maintains section grouping within each type (section_name is type-specific)

---

## Data Flow

### 1. Restaurant Opens Menu
```
MenuView mounted
  ↓
fetchAvailableMenuTypes() [GET /api/restaurants/{id}/menu-types]
  ↓
availableMenuTypes state updated
  ↓
Render tabs (only for types with items)
  ↓
fetchMenuFromBackend({ type: selectedMenuType })
  ↓
API call with ?type parameter
  ↓
Menu sections rendered
```

### 2. User Switches Menu Type
```
User clicks "🌅 Breakfast" tab
  ↓
setSelectedMenuType('breakfast')
  ↓
useEffect triggers (selectedMenuType changed)
  ↓
fetchMenuFromBackend re-called with new type
  ↓
API returns breakfast-specific menu
  ↓
Sections re-render (e.g., Breakfast Items, Pastries, etc.)
```

### 3. Scraper Saves Items
```
Scraper detects menu_type from config
  ↓
All items from that URL inherit menu_type
  ↓
INSERT INTO menu_items (..., menu_type) VALUES (...)
  ↓
Items queryable by type: 
  SELECT * FROM menu_items 
  WHERE restaurant_id = X AND menu_type = 'breakfast'
```

---

## Section Name Isolation

**Important**: Each menu type has its own section namespace.

Example: Crunkleton's breakfast menu might have:
- Section: "Early Morning"
- Items: Eggs, Pancakes

While dinner menu has:
- Section: "Appetizers"  
- Items: Calamari, Shrimp

The `section_name` field is relative to the menu type. When querying:
```sql
SELECT DISTINCT section_name 
FROM menu_items 
WHERE restaurant_id = '123' AND menu_type = 'breakfast'
```

You only get sections from breakfast, not dinner sections.

---

## Integrity Checking Per Type

**Current**: Integrity checks still run per restaurant (all types combined)

**Future Enhancement**: Could implement per-type integrity:
```javascript
// Check if breakfast menu has data issues
integrity_status_breakfast: 'OK' | 'FAILED'
integrity_status_lunch: 'OK' | 'FAILED'
integrity_status_dinner: 'OK' | 'FAILED'
integrity_status_drinks: 'OK' | 'FAILED'

// So drinks could fail while dinner passes
```

This would allow blocking only the failing menu type's endpoint, not the whole restaurant.

---

## Configuration in Restaurants Table

```json
{
  "id": "uuid",
  "name": "Crunkleton",
  "menu_url": "https://crunkleton.com/menu",
  "breakfast_url": "https://crunkleton.com/breakfast-menu",
  "lunch_url": null,
  "dinner_url": "https://crunkleton.com/dinner-menu", 
  "drinks_url": "https://crunkleton.com/bar-menu",
  "menu_types": ["breakfast", "dinner", "drinks"]
}
```

Each URL is scraped independently and items inherit the corresponding `menu_type`.

---

## Migration Path

1. ✅ Database: Add `menu_type` column with DEFAULT 'dinner'
2. ✅ Constants: Create menu types module
3. ✅ API: Update endpoints to support ?type parameter
4. ✅ Frontend: Add menu type tabs
5. 🔄 Scraper: Enhancement to use breakfast_url, drinks_url, etc.
6. 🔄 Integrity: Per-type validation

---

## Testing

### Test Available Menu Types
```bash
curl "http://localhost:8081/api/restaurants/{id}/menu-types"
# Should return: { "available_menu_types": ["breakfast", "lunch", "dinner", ...] }
```

### Test Menu Filtering
```bash
curl "http://localhost:8081/api/restaurants/{id}/full-menu?type=breakfast"
# Should return only breakfast items
```

### Test Tab Rendering
- View restaurant menu
- If multiple types available: tabs appear
- Click different tabs
- Menu should update to show selected type
- Sections are type-specific (different headers for breakfast vs dinner)

---

## Performance Considerations

- **Index**: `idx_menu_items_restaurant_type` speeds up WHERE (restaurant_id, menu_type)
- **Caching**: Each type+restaurant combination should have separate cache entries
- **Query**: Always filter by both restaurant_id AND menu_type to use composite index

```sql
-- Good (uses index)
SELECT * FROM menu_items 
WHERE restaurant_id = ? AND menu_type = ?

-- Bad (full table scan)
SELECT * FROM menu_items 
WHERE menu_type = ? -- missing restaurant_id
```

---

## Future Enhancements

1. **Per-Type Integrity**: Separate integrity_status per menu_type
2. **Type-Specific Ratings**: Dish ratings could be type-specific
3. **Seasonal Menus**: Extend to support seasonal variants
4. **Time-Based Switching**: Auto-switch to appropriate menu type based on time of day
5. **Scraper Enhancement**: Auto-detect and scrape multiple menu URLs
