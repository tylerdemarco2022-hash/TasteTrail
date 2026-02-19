# AI Menu Parser System

## Overview
The AI Menu Parser system automatically transforms raw menu text into clean, structured JSON that your app can display. When you click "Scrape Menu" on a restaurant, the system:

1. **Scrapes** the restaurant's website (finds official site → navigates to menu → detects format)
2. **Extracts** text or images (HTML parsing, PDF text extraction, or visual OCR)
3. **Parses** raw text using AI to identify items, categories, and prices
4. **Cleans** the data and enriches with descriptions
5. **Returns** structured JSON ready to display

## Architecture

### Components

#### 1. **Backend Scraper** (`scrapeMenuDynamic.js`)
Finds and retrieves menu content from restaurant websites.

**Functions:**
- `scrapeMenuDynamic(restaurantName, location)` - Main orchestrator
- `findOfficialWebsite()` - Google search + website ranking
- `navigateToMenu(page, startUrl)` - Clicks menu links
- `detectMenuFormat(page)` - Identifies HTML/PDF/Image
- `downloadPDF(url, restaurant)` - Downloads PDF files
- `extractTextFromPDF(pdfPath)` - Uses pdf-parse library
- `parseMenuText()` - Regex-based text extraction
- `scrapeFullMenu(page)` - DOM parsing for HTML menus

**Returns:**
```json
{
  "success": true,
  "categories": [...],
  "source": "HTML|PDF|Image",
  "itemCount": 42,
  "pdfPath": "/path/to/menu.pdf",
  "error": "NEEDS_OCR"
}
```

#### 2. **AI Menu Parser** (`menuParser.js`)
Transforms raw text into clean structured JSON using Claude 3.5 Sonnet.

**Functions:**
- `parseMenuWithAI(rawText, restaurantName, location)` - AI-powered parsing
- `validateMenuStructure(menuData)` - Ensures correct format
- `enrichMenuWithDescriptions(menuData, restaurantName)` - Adds AI-generated descriptions

**Example:**
```javascript
const result = await parseMenuWithAI(
  "Grilled Chicken $12.99\nFish Tacos $14.50",
  "Joe's Restaurant",
  "Charlotte NC"
)
// Returns:
// {
//   success: true,
//   categories: [{
//     category: "Entrees",
//     items: [
//       { name: "Grilled Chicken", price: 12.99 },
//       { name: "Fish Tacos", price: 14.50 }
//     ]
//   }]
// }
```

#### 3. **Fast Text Parser** (`parseMenuText.js`)
Fallback regex-based parsing when AI not needed or cost-sensitive.

**Functions:**
- `parseMenuText(text)` - Basic line-by-line parsing
- `parseMenuTextAggressive(text)` - More aggressive pattern matching
- `mergeParseResults(...results)` - Combines multiple parse attempts

**Speed:** Instant (no API calls)  
**Accuracy:** 60-80% (works for well-formatted menus)

#### 4. **OCR Agent** (`ocr_agent.js`)
Claude Vision API for extracting text from PDF/Image menus using visual recognition.

**Function:**
- `processMenuWithOCR(pdfPath, imagePath, restaurantName, location)` - Extracts menu from images

## API Endpoints

### 1. **Scrape Single Restaurant**
```
GET /api/restaurant/:name/scrape?location=City,State
```

**Example:**
```bash
curl "http://localhost:8787/api/restaurant/Olive%20Garden/scrape?location=Charlotte,NC"
```

**Response:**
```json
{
  "success": true,
  "restaurant": "Olive Garden",
  "location": "Charlotte, NC",
  "categories": [
    {
      "category": "Appetizers",
      "items": [
        { "name": "Soup or Salad", "price": 0 }
      ]
    }
  ],
  "source": "HTML",
  "itemCount": 42
}
```

### 2. **Parse Raw Menu Text (AI)**
```
POST /api/parse-menu-text
Content-Type: application/json

{
  "rawText": "Chicken Parm $14.99\nVegan Pasta $12.99",
  "restaurantName": "Tony's Italian",
  "location": "Charlotte, NC",
  "enrichDescriptions": true
}
```

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "category": "Entrees",
      "items": [
        { 
          "name": "Chicken Parm", 
          "price": 14.99,
          "description": "Breaded chicken breast with marinara and melted mozzarella"
        }
      ]
    }
  ],
  "itemCount": 2
}
```

### 3. **Parse Raw Menu Text (Fast/Free)**
```
POST /api/parse-menu-text-fast
Content-Type: application/json

{
  "rawText": "Chicken Parm $14.99\nVegan Pasta $12.99"
}
```

**Response:**
```json
{
  "success": true,
  "categories": [...],
  "itemCount": 2,
  "method": "regex-based"
}
```

### 4. **Validate Menu JSON**
```
POST /api/validate-menu
Content-Type: application/json

{
  "menuData": {
    "categories": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "categories": [...],
  "itemCount": 42
}
```

### 5. **Full Pipeline (Scrape + Parse + Validate)**
```
GET /api/restaurant/:name/full-menu?location=City,State&parseWithAI=true&enrichDescriptions=true
```

**Example:**
```bash
curl "http://localhost:8787/api/restaurant/Firebirds/full-menu?location=Fort%20Mill,SC&parseWithAI=true&enrichDescriptions=true"
```

**Response:**
```json
{
  "success": true,
  "restaurant": "Firebirds",
  "location": "Fort Mill, SC",
  "categories": [
    {
      "category": "Wood-Fired Steaks",
      "items": [
        {
          "name": "New York Strip",
          "price": 38.99,
          "description": "14oz hand-cut USDA Prime beef grilled over hardwood fire"
        }
      ]
    }
  ],
  "source": "AI-parsed",
  "itemCount": 82
}
```

## Frontend Integration

### Trigger Scrape from Restaurant Click

When user clicks a restaurant in your app:

```javascript
// In your component
const handleRestaurantClick = async (restaurant) => {
  setMenuLoading(true)
  try {
    const res = await fetch(
      `/api/restaurant/${encodeURIComponent(restaurant.name)}/full-menu?` +
      `location=${encodeURIComponent(restaurant.location)}&` +
      `parseWithAI=true&enrichDescriptions=true`
    )
    
    const data = await res.json()
    
    if (data.success) {
      displayMenu(data.categories)
    } else if (data.needsOCR) {
      alert(`PDF menu found. Needs OCR processing at: ${data.pdfPath}`)
    }
  } finally {
    setMenuLoading(false)
  }
}
```

### Display Parsed Menu

```jsx
function MenuDisplay({ categories }) {
  return (
    <div className="menu">
      {categories.map(cat => (
        <div key={cat.category} className="category">
          <h3>{cat.category}</h3>
          {cat.items.map(item => (
            <div key={item.name} className="item">
              <div className="name">{item.name}</div>
              <div className="price">${item.price}</div>
              {item.description && (
                <div className="description">{item.description}</div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

## Configuration

### Environment Variables

```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-...          # Claude API key (for AI parsing)
PLAYWRIGHT_HEADLESS=true              # Browser automation
MENU_CACHE_DIR=./cache                # Where to store cached menus
MENU_CACHE_TTL=86400000               # 24 hours in milliseconds
```

### Installation

```bash
# Required dependencies already in package.json:
npm install

# If missing, add manually:
npm install @anthropic-ai/sdk pdf-parse
```

## Flow Diagram

```
User clicks restaurant
         ↓
/api/restaurant/:name/full-menu
         ↓
    scrapeMenuDynamic()
         ↓
    ┌─────┴─────┬──────────┐
    ↓           ↓          ↓
  HTML        PDF      IMAGE
    ↓           ↓          ↓
  Parse      Extract    Download
  HTML        Text       File
    ↓           ↓          ↓
  ✅ OK?   ┌─OK?─┘          ↓
    │       │              ↓
    │      NO          processMenuWithOCR()
    │       ↓               ↓
    │   NEEDS_OCR      Claude Vision
    │       ↓               ↓
    └───→ Return ←──────────┘
         Categories
              ↓
      Display to User
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `No official site found` | Website not indexed by Google | Provide manual URL or search terms |
| `NEEDS_OCR` | PDF/Image menu detected | Use `/api/ocr/process` endpoint |
| `Failed to extract text from PDF` | Scanned/image PDF | Automatically falls back to OCR |
| `Invalid menu structure` | Unexpected format | Use `/api/validate-menu` to clean |

### Recovery Strategy

```javascript
async function robustMenuFetch(restaurant) {
  try {
    // Try full pipeline with AI
    const res = await fetch(
      `/api/restaurant/${name}/full-menu?parseWithAI=true`
    )
    const data = await res.json()
    
    if (data.success) return data
    
    if (data.needsOCR && data.pdfPath) {
      // Fall back to OCR
      const ocrRes = await fetch('/api/ocr/process', {
        method: 'POST',
        body: JSON.stringify({
          pdfPath: data.pdfPath,
          restaurant: name,
          location: restaurant.location
        })
      })
      return await ocrRes.json()
    }
    
    throw new Error(data.error)
  } catch (e) {
    // Show user sample menu as last resort
    return generateSampleMenu(restaurant)
  }
}
```

## Performance Optimization

### Caching

Menus are cached for 24 hours in `backend/cache/`:

```
cache/
  Firebirds_Wood_Fired_Grill.json
  Olive_Garden_Italian_Restaurant.json
  ...
```

Check cache before scraping:

```javascript
const cached = readFileSync(`./cache/${restaurantName}.json`)
if (cached && isFresh(cached)) {
  return JSON.parse(cached)
}
```

### API Cost Optimization

- **HTML menus:** Free (uses regex parsing)
- **AI parsing:** ~$0.10 per menu (Claude API usage)
- **OCR processing:** ~$0.50 per image (Claude Vision)

**Save costs:**
1. Use `/api/parse-menu-text-fast` for simple menus
2. Cache results aggressively (24-hour TTL)
3. Only use AI parsing when needed (complex layouts)

### Timeout Settings

```javascript
// Browser automation timeout
const SCRAPE_TIMEOUT = 60000  // 60 seconds

// PDF parsing timeout
const PDF_TIMEOUT = 30000  // 30 seconds

// API request timeout
const API_TIMEOUT = 120000  // 2 minutes
```

## Testing

### Test Scraping
```bash
curl -X GET "http://localhost:8787/api/restaurant/Firebirds/scrape?location=Fort%20Mill,SC"
```

### Test AI Parsing
```bash
curl -X POST "http://localhost:8787/api/parse-menu-text" \
  -H "Content-Type: application/json" \
  -d '{
    "rawText": "Grilled Chicken $12.99\nFish Tacos $14.50",
    "restaurantName": "Test Restaurant",
    "location": "Charlotte, NC"
  }'
```

### Test Full Pipeline
```bash
curl -X GET "http://localhost:8787/api/restaurant/Olive%20Garden/full-menu?location=Charlotte,NC&parseWithAI=true"
```

## Troubleshooting

### Server won't start
```bash
# Check Node process on port 8787
lsof -i :8787

# Kill existing process
kill -9 <PID>

# Restart server
npm run server
```

### Scraping returns "No official site found"
- Restaurant name needs to match Google results (try "131 Main Street Restaurant")
- Some restaurants have limited web presence
- Provide manual URL: `?websiteUrl=https://restaurant.com/menu`

### AI parsing returns empty categories
- Menu text might be corrupted (control characters)
- Try `/api/parse-menu-text-fast` instead
- Check that `ANTHROPIC_API_KEY` is set

### PDF extraction fails
- PDF might be scanned/image-based
- Falls back to OCR automatically
- Ensure `ANTHROPIC_API_KEY` is configured

## Future Enhancements

- [ ] Manual menu upload UI
- [ ] Bulk restaurant import (CSV)
- [ ] Menu history tracking (price changes)
- [ ] Community menu contributions
- [ ] Menu image annotation tools
- [ ] Multi-language menu support
- [ ] Allergen detection from descriptions
- [ ] Nutritional info parsing
