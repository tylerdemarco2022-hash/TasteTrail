# MenuView Debug Verification Guide

## How to Verify the Dynamic Menu Tabs Implementation

### Step 1: Start the Backend
```bash
node backend/server/index.js
```
⚠️ **Important**: If you get database schema errors, the migration SQL hasn't been run. 
See [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) for how to apply the menu_type column.

### Step 2: Open Browser DevTools
1. Load your Taste Trails app (typically `http://localhost:5173`)
2. Navigate to a restaurant menu
3. Press **F12** to open DevTools
4. Click **Console** tab

### Step 3: Verify Function Execution
Look for this log when the menu page loads:
```
🔍 fetchMenuTypes() called for restaurant: [RESTAURANT_NAME]
```
**What this means:**
- ✅ The fetchMenuTypes() function is executing
- If NOT present: Function not running (check if useEffect[restaurantName] is in MenuView.jsx)

---

## Step 4: Verify API Response
Look for this log immediately after:
```
TYPES API RESPONSE: {restaurant: "RestaurantName", available_types: ["breakfast", "lunch", "dinner"]}
```

### Possible Response Variations:

**✅ Success with multiple types** (tabs will show):
```
TYPES API RESPONSE: {restaurant: "Crunkleton", available_types: ["lunch", "dinner"]}
```
→ Tabs will render (length > 1)

**✅ Success with single type** (tabs will NOT show - this is correct):
```
TYPES API RESPONSE: {restaurant: "Restaurant", available_types: ["dinner"]}
```
→ Tabs hidden (length = 1)

**❌ API Failed** (check backend error):
```
API Response was not ok
```
→ Falls back to availableTypes=['dinner'], activeType='dinner'

**❌ Empty Response** (restaurant has no menu items):
```
TYPES API RESPONSE: {restaurant: "Name", available_types: []}
```
→ No menu displayed (no items for any type)

---

## Step 5: Verify Tab Render Decision
Look for this log showing the exact tab rendering logic:
```
🔍 TAB RENDER CHECK: availableTypes= ["breakfast", "lunch", "dinner"] | length= 3 | will render tabs? true
```

**Reading this log:**
- `availableTypes=` → Array of menu types that have items
- `length=` → How many types are available
- `will render tabs?=` → Boolean showing if condition `availableTypes.length > 1` is true

### Interpretation Guide:

| availableTypes | Length | Will Render Tabs? | Result |
|---|---|---|---|
| ["dinner"] | 1 | false | ✅ Single type, no tabs (correct) |
| ["lunch", "dinner"] | 2 | true | ✅ Multiple types, tabs shown |
| ["breakfast", "lunch", "dinner", "drinks"] | 4 | true | ✅ All types, tabs shown |
| [] | 0 | false | ⚠️ No menu items at all |

---

## Step 6: Verify Render-Time State
These logs appear **on every render**:
```
AVAILABLE TYPES: ["breakfast", "lunch", "dinner"]
ACTIVE TYPE: "lunch"
```

**What this shows:**
- First line: All types available for this restaurant
- Second line: Which type is currently selected (used for the menu fetch)

You'll see these logs update when:
- Page first loads (initial state)
- You click a different tab (activeType changes)
- Menu refetches (available types re-queried)

---

## Step 7: Test Tab Clicking
1. Look at the rendered page - if `availableTypes.length > 1`, you should see colored tabs above the menu
2. Click a different tab (e.g., from "Dinner" to "Lunch")
3. Check console for:
   - `ACTIVE TYPE: "lunch"` (changed from previous value)
   - Menu re-fetches with `?type=lunch` parameter

---

## Complete Log Flow on Page Load

### Expected Console Output (in order):
```
🔍 fetchMenuTypes() called for restaurant: Crunkleton
TYPES API RESPONSE: {restaurant: "Crunkleton", available_types: ["breakfast", "lunch", "dinner"]}
AVAILABLE TYPES: ["breakfast", "lunch", "dinner"]
ACTIVE TYPE: null
🔍 TAB RENDER CHECK: availableTypes= ["breakfast", "lunch", "dinner"] | length= 3 | will render tabs? true
AVAILABLE TYPES: ["breakfast", "lunch", "dinner"]
ACTIVE TYPE: "dinner"  // (auto-selected after mount)
```

Each log line tells you:
1. **Function fired** → fetchMenuTypes() executed
2. **API responded** → Got list of types: breakfast, lunch, dinner
3. **Initial state** → availableTypes loaded, activeType not yet set
4. **Tab render check** → Will render tabs because length > 1
5. **Re-render** → availableTypes still there
6. **Active type set** → Auto-select logic chose "dinner" (default when multiple available)

---

## Troubleshooting

### Issue: Don't see "🔍 fetchMenuTypes() called" log
**Cause:** Function not executing  
**Solution:**
1. Check MenuView.jsx line ~560 exists: `const [availableTypes, setAvailableTypes] = useState([])`
2. Check useEffect hook includes: `fetchMenuTypes()` after restaurantName loads
3. Verify restaurantName prop is being passed to MenuView component

### Issue: See "API Response was not ok" error
**Cause:** Backend /api/restaurants/:name/types endpoint failed  
**Solution:**
1. Check backend is running: `node backend/server/index.js`
2. Check menu.js has the /types endpoint (should be around line 1024)
3. Check restaurant name matches database exactly (URL encoding issue?)
4. Try direct API call in terminal:
   ```bash
   curl "http://localhost:3000/api/restaurants/Crunkleton/types"
   ```

### Issue: availableTypes is empty `[]`
**Cause:** Restaurant has no menu items in database  
**Solution:**
1. Check database has menu items for this restaurant
2. Verify restaurant_id matches in menu_items table
3. Ensure menu_type column exists (run migration if needed)

### Issue: availableTypes.length = 1, tabs don't show
**This is expected!** When only one type has items, tabs are hidden (no need to choose).  
To test tabs, add test data with multiple menu types.

### Issue: Only seeing some of the logs
**Cause:** Browser has scrolled past them  
**Solution:**
- Right-click console → **Clear on load** ✓
- Reload the page
- Logs will be at the top

---

## Database Schema Check

If responses are empty, verify menu_type column exists:

```sql
-- Run in psql/Supabase SQL Editor:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='menu_items' 
AND column_name='menu_type';
```

Should return: `menu_type | text`

If no rows, run migration:
```bash
psql -h [HOST] -U [USER] -d [DB] -f backend/sql/20260226_add_menu_type_support.sql
```

---

## Summary: Your 3 Verification Questions

### ❓ "Is fetchMenuTypes() actually firing?"
**Answer Location:** Look for `🔍 fetchMenuTypes() called for restaurant:` in console  
**If present:** ✅ Yes, function is executing  
**If missing:** ❌ Function not running

### ❓ "What does /api/restaurants/:name/types return?"
**Answer Location:** Look for `TYPES API RESPONSE:` in console  
**Format:** `{restaurant: "name", available_types: ["breakfast", "lunch", ...]}`  
**If error:** Check "API Response was not ok" message

### ❓ "Is availableTypes length > 1?"
**Answer Location:** Look for `will render tabs? true/false`  
**true** → Length > 1 (tabs will display)  
**false** → Length ≤ 1 (tabs hidden, single or no types)

---

## Next Steps

✅ **If all logs look correct:**
- Tabs should appear above the menu sections if availableTypes.length > 1
- Clicking tabs should update activeType and refetch menu
- Different menu sections should appear for different types

🔧 **If there are issues:**
- Check the troubleshooting section above
- Verify database schema has menu_type column
- Ensure backend is running and menu_type data exists

📝 **After verification:**
- Remove debug logs: Delete the console.log lines we added
- Test with real restaurant data
- Deploy to production after SQL migration is applied
