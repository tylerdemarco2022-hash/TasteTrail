# Dietary Preference Filtering - Restaurant Mapping

## Filtering Logic

The following restaurants are mapped to dietary preferences based on keywords in their name/description:

### Filtering Rules:

**VEGETARIAN** (`pref === 'vegetarian'`)
- Shows: Restaurants with vegetarian keywords (salad, bowl, pasta, pizza, asian, italian, etc.)
- Hides: Pure steakhouse, smokehouse, bbq joint, or seafood-only restaurants
- Keywords: vegetarian, vegan, salad, bowl, pasta, pizza, mexican, asian, thai, indian, mediterranean, italian, cafe, kitchen, grill, bar, taphouse, cuisine, greek, bistro, house, postino

**VEGAN** (`pref === 'vegan'`)
- Stricter filter - only restaurants with vegan keywords
- Keywords: vegan, plant-based, plant based, vegetarian, salad, bowl

**KETO** (`pref === 'keto'`)
- Shows: Meat, seafood, grilled-focused restaurants
- Keywords: steak, steakhouse, burger, bbq, grilled, seafood, meat, keto, smokehouse, grill, firegrill, grille, fish, sea level, captain

**GLUTEN_FREE** (`pref === 'gluten_free'`)
- All restaurants can accommodate (default: true)

**DAIRY_FREE** (`pref === 'dairy_free'`)
- Excludes: Pure pizza/pizzeria restaurants
- Includes: Asian, Mexican, Grilled restaurants
- Default: true for most

**HALAL** (`pref === 'halal'`)
- Keywords: halal, middle eastern, mediterranean, persian, turkish

**KOSHER** (`pref === 'kosher'`)
- Keywords: kosher, jewish

---

## Charlotte Restaurants Mapping

Based on restaurant names from `/backend/restaurants/`:

### Steakhouse/Burger/BBQ (✅ KETO)
- **Dean's Steakhouse** - Keyword: "steakhouse" → Keto ✅
- **Blue Bar Smokehouse** - Keyword: "smokehouse" → Keto ✅
- **Firebirds Wood Fired Grill** - Keywords: "grill" → Keto ✅
- **The Improper Pig** - Keyword: "pig" → Keto focused ✅

### Seafood (✅ KETO, ❌ VEGETARIAN)
- **Captain Steve's Family Seafood Restaurant** - Keyword: "seafood" → Keto ✅, Not Vegetarian ❌
- **Sea Grill Diner** - Keyword: "seafood" → Keto ✅, Not Vegetarian ❌
- **Sea Level NC** - Keyword: "sea" → Keto ✅, Not Vegetarian ❌

### Italian/Pasta (✅ VEGETARIAN)
- **Mama Ricotta's** - Keyword: "italian" implied → Vegetarian ✅
- **North Italia** - Keyword: "italian" → Vegetarian ✅
- **Salmeris Italian Kitchen** - Keywords: "italian", "kitchen" → Vegetarian ✅
- **La Belle Helene** - Likely French/Italian fusion → Vegetarian ✅

### Asian (✅ VEGETARIAN, ✅ VEGAN, ✅ DAIRY_FREE)
- **Spice Asian Kitchen** - Keywords: "asian", "kitchen" → Vegetarian ✅, Vegan ✅

### Mediterranean/Greek (✅ VEGETARIAN, ✅ HALAL)
- **Ilios Crafted Greek** - Keyword: "greek" → Vegetarian ✅, Halal ✅
- **Restaurant Constance** - Greek/Mediterranean cuisine → Vegetarian ✅, Halal ✅

### Cafe/Kitchen (✅ VEGETARIAN, ✅ VEGAN)
- **Poppyseed Kitchen** - Keywords: "kitchen" → Vegetarian ✅, Vegan ✅
- **Lupie's Cafe** - Keyword: "cafe" → Vegetarian ✅, Vegan ✅

### Grill/Bar (✅ VEGETARIAN, ✅ KETO)
- **Postino** - Keyword: "postino" (trendy, diverse menu) → Vegetarian ✅
- **Jekyll & Hyde Taphouse Grill** - Keywords: "grill", "taphouse" → Vegetarian ✅, Keto ✅
- **The Cellar at Duckworth's** - Keyword: "bar" → Vegetarian ✅
- **The Foxhole Restaurant and Bar** - Keyword: "bar" → Vegetarian ✅
- **Grapevine** - Typically wine bar with diverse menu → Vegetarian ✅
- **Whitakers** - Restaurant/bar → Vegetarian ✅
- **Supper Land** - Restaurant → Vegetarian ✅

### Fast Casual/Modern (✅ VEGETARIAN, ✅ VEGAN, ✅ GLUTEN_FREE)
- **Link Pin** - Modern casual → Vegetarian ✅
- **Culinary Dropout** - Modern American → Vegetarian ✅
- **STIR Charlotte** - Modern cuisine → Vegetarian ✅
- **Figtree** - Contemporary → Vegetarian ✅
- **Peppervine** - Contemporary cuisine → Vegetarian ✅
- **Fahrenheit** - Contemporary American → Vegetarian ✅
- **Postino** - Contemporary American → Vegetarian ✅

### Mexican (✅ VEGETARIAN, ✅ DAIRY_FREE)
- **Letty's** - Mexican → Vegetarian ✅, Dairy Free ✅

### Wine/Upscale (✅ VEGETARIAN)
- **Sixty Vines** - Wine bar/restaurant → Vegetarian ✅
- **The Goodyear House** - Upscale restaurant → Vegetarian ✅

### Unclassified
- **131 Main** - Name doesn't indicate type (may need cuisine info)
- **Angeline's** - Cannot determine from name
- **Bulla Gastrobar** - Gastrobar (trendy) → Vegetarian ✅

---

## Summary by Preference

### VEGETARIAN (✅ - Should Show)
Most restaurants except pure seafood/steakhouse

### VEGAN (✅ - Should Show)
- Spice Asian Kitchen
- Poppyseed Kitchen
- Lupie's Cafe
- Asian-focused restaurants
- Modern contemporary venues

### KETO (✅ - Should Show)
- Dean's Steakhouse
- Blue Bar Smokehouse
- Firebirds Wood Fired Grill
- Captain Steve's
- Sea Grill Diner
- Sea Level NC
- The Improper Pig
- Grill-focused venues

### GLUTEN_FREE (✅ - Should Show)
All restaurants (default: true)

### DAIRY_FREE (✅ - Should Show)
All except pure pizza/pizzeria (most restaurants)

### HALAL (✅ - Should Show)
- Ilios Crafted Greek
- Restaurant Constance
- Mediterranean restaurants

### KOSHER (⚠️ - Currently None)
Need to identify kosher-certified restaurants

---

## To Verify:
1. Test with each dietary preference selected
2. Check browser console for debug logs showing shown/hidden restaurants
3. Compare actual filtered results with mappings above
4. Update restaurant metadata if available (cuisine field) for more accurate filtering
