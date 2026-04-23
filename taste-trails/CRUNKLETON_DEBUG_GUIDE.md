# Menu Section Rendering Debug Guide

## Problem Statement
Crunkleton restaurant renders as one large section instead of multiple menu sections in the frontend.

## Root Cause Analysis

The issue could stem from any of these causes:

### 1. **All Items Have Same Category**
- **Symptom**: Debug endpoint shows one dominant category with >80% of items
- **Cause**: Menu scraper assigns all items to the same category/section_name
- **Fix**: Review scraper logic that extracts section headers from the menu

### 2. **Missing section_name Field**
- **Symptom**: Debug endpoint shows NULL or 'MenuItem' values for section_name
- **Cause**: Items were imported without section information
- **Fix**: Re-scrape the menu or manually assign section_name values

### 3. **Category Field Defaults**
- **Symptom**: All items have category=NULL or category='Uncategorized'
- **Cause**: Menu parser didn't extract category data from source
- **Fix**: Re-run menu scraper with improved header detection

### 4. **Frontend Parsing Issue**
- **Symptom**: Backend shows multiple sections, but frontend renders one
- **Cause**: MenuView normalization logic incorrectly merging sections
- **Fix**: Check console logs for section order mismatch

---

## Diagnostic Workflow

### Step 1: Check Backend Data Structure
```bash
# Call the debug endpoint to inspect actual section breakdown
curl "http://localhost:3001/debug/menu-sections/Crunkleton"

# Expected format:
{
  "restaurant": "Crunkleton",
  "totalItems": 45,
  "sectionBreakdown": [
    {
      "section": "Appetizers",
      "count": 12,
      "sampleItems": [
        { "name": "Spring Rolls", "category": "Appetizers", "id": "abc123" },
        { "name": "Chicken Wings", "category": "Appetizers", "id": "def456" }
      ]
    },
    {
      "section": "Entrees",
      "count": 20,
      "sampleItems": [...]
    }
  ],
  "quality": {
    "uncategorized_count": 3,
    "uncategorized_percent": "6.7%",
    "status": "✅ PASSING"
  }
}
```

**Problems to look for**:
- ⚠️ Only ONE section in sectionBreakdown → Data issue (fix backend)
- ⚠️ Multiple sections but one has 90%+ items → Scraper default issue
- ⚠️ "NULL" or "Uncategorized" as section names → Missing section_name field
- ⚠️ Whitespace/casing inconsistencies → Need normalization (e.g., " Appetizers" vs "Appetizers")

---

### Step 2: Check Frontend Rendering
Open browser console (F12) while viewing Crunkleton menu and check for:

```javascript
// You'll see log output like:
🔍 SECTION DEBUG: {
  displaySectionsCount: 5,
  sectionOrderKeys: ["appetizers", "entrees", "desserts", "drinks", "specials"],
  sectionOrderCount: 5,
  orderedSectionsCount: 5,
  sections: [
    { name: "Appetizers", itemCount: 12, firstItem: "Spring Rolls" },
    { name: "Entrees", itemCount: 20, firstItem: "Grilled Chicken" },
    ...
  ],
  totalItems: 45,
  uncategorizedCount: 0
}
```

**Problems to look for**:
- ✅ sectionOrderCount matches orderedSectionsCount → Frontend is working correctly
- ❌ sectionOrderCount = 1 but displaySectionsCount > 1 → Filter bug or grouping issue
- ❌ orderedSectionsCount = 1 → All items being grouped into one section
- ⚠️ High `uncategorizedCount` → Items missing category/section info

---

### Step 3: Inspect Raw Menu Response
Check what the API is returning to the frontend:

```javascript
// In browser console:
fetch('/api/restaurants/{restaurantId}/full-menu')
  .then(r => r.json())
  .then(data => {
    console.log('RAW BACKEND RESPONSE:', data);
    console.log('Sections/Categories count:', 
      data.sections?.length || data.categories?.length || 0);
    console.log('Items per section:', 
      data.sections?.map(s => ({ name: s.name, count: s.items?.length })));
  })
```

---

## Expected vs Actual

### ✅ EXPECTED (Multiple Sections)
```
Menu Structure:
├── Appetizers (12 items)
│   ├── Spring Rolls
│   ├── Chicken Wings
│   └── ...
├── Entrees (20 items)
│   ├── Grilled Chicken
│   ├── Pad Thai
│   └── ...
└── Desserts (8 items)
    ├── Mango Sticky Rice
    └── ...
```

### ❌ ACTUAL (Single Section - Issue)
```
Menu Structure:
└── Menu (45 items)  ← Everything grouped under "Menu"
    ├── Spring Rolls
    ├── Chicken Wings
    ├── Grilled Chicken
    ├── Pad Thai
    └── ... (39 more items in one big list)
```

---

## Quick Fixes by Root Cause

### If: All items have same category in DB
```sql
-- Check what categories exist
SELECT DISTINCT section_name, COUNT(*) as count
FROM menu_items
WHERE restaurant_id = '{crunkleton_id}'
GROUP BY section_name;

-- If section_name is mostly NULL, you need to:
-- 1. Re-scrape the menu OR
-- 2. Manually update the section_name field
```

### If: section_name field is consistently NULL
```sql
-- Migrate category to section_name (temporary fix)
UPDATE menu_items
SET section_name = NULLIF(category, '')
WHERE section_name IS NULL AND restaurant_id = '{crunkleton_id}';
```

### If: Whitespace or casing issues in section names
```sql
-- Normalize section names
UPDATE menu_items
SET section_name = TRIM(LOWER(INITCAP(section_name)))
WHERE restaurant_id = '{crunkleton_id}';
```

---

## Testing After Fix

1. **Backend**: Call debug endpoint and verify multiple sections returned
2. **Frontend**: Open browser console and check SECTION DEBUG log
3. **Visual**: Menu should display with clear section headers and proper grouping

---

## Files Modified for Debugging

- `src/components/MenuView.jsx`: Added detailed sectionOrder console.log
- `backend/server/routes/menu.js`: 
  - Enhanced `/restaurants/{id}/full-menu` to prioritize section_name
  - Enhanced `/debug/menu-sections/{name}` to return sample items per section
