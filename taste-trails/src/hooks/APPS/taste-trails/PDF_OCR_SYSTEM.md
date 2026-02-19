# Auto-Detect PDF/Image Menu System

## Overview
The menu scraper now automatically detects and processes PDF/Image menus:

1. **PDF Detection** → Download & Extract Text
2. **Image Detection** → Send to OCR
3. **OCR Fallback** → Claude Vision processes visuals
4. **HTML Fallback** → Standard scraping

## Flow Diagram

```
Restaurant Menu Request
    ↓
[Find Official Website]
    ↓
[Navigate to Menu Page]
    ↓
[Detect Format]
    ├─→ PDF File
    │    ├─→ Download
    │    ├─→ Extract Text (pdf-parse)
    │    └─→ Parse Menu Items
    │         ├─→ Success: Save menu.json
    │         └─→ Fail: Send to OCR
    │
    ├─→ Image File
    │    ├─→ Download
    │    └─→ Send to OCR Agent (Claude Vision)
    │         └─→ Extract items & prices
    │
    └─→ HTML Page
         ├─→ Scrape with Playwright
         └─→ Parse & Save

[OCR Agent]
  ├─ Input: PDF/Image (base64)
  ├─ Process: Claude 3.5 Sonnet Vision
  └─ Output: Structured JSON menu
```

## API Endpoints

### 1. Scrape Menu (Auto-detects format)
```http
GET /api/scrape-menu?restaurant=Restaurant%20Name&location=City%20SC
```

**Response (HTML Success):**
```json
{
  "success": true,
  "restaurant": "Restaurant Name",
  "location": "City SC",
  "categories": [
    {
      "category": "Appetizers",
      "items": [
        { "name": "Bruschetta", "price": 8.99 }
      ]
    }
  ],
  "itemCount": 45,
  "source": "HTML"
}
```

**Response (PDF/Image Detected):**
```json
{
  "success": false,
  "error": "NEEDS_OCR",
  "format": "PDF",
  "pdfPath": "/path/to/menu.pdf",
  "websiteUrl": "https://restaurant.com",
  "message": "PDF menu downloaded. OCR processing required."
}
```

### 2. Process with OCR Agent
```http
POST /api/ocr/process
Content-Type: application/json

{
  "pdfPath": "/absolute/path/to/menu.pdf",
  "imagePath": "/absolute/path/to/menu.jpg",
  "restaurant": "Restaurant Name",
  "location": "City SC"
}
```

**Response:**
```json
{
  "success": true,
  "restaurant": "Restaurant Name",
  "location": "City SC",
  "categories": [
    {
      "category": "Entrees",
      "items": [
        {
          "name": "Grilled Salmon",
          "price": 24.50,
          "description": "with seasonal vegetables"
        }
      ]
    }
  ],
  "itemCount": 38,
  "method": "OCR",
  "source": "PDF"
}
```

## Supported Formats

| Format | Detection | Processing | Output |
|--------|-----------|------------|--------|
| HTML | URL check | Playwright scraper | Structured JSON |
| PDF | Embedded/linked | pdf-parse → text | Menu items or OCR |
| Image | Embedded/linked | Download → OCR | Menu items (Claude Vision) |

## Installation Requirements

```bash
# Core dependencies
npm install playwright node-fetch

# Optional: Better PDF extraction
npm install pdf-parse pdfjs-dist

# API client (if not using fetch)
npm install @anthropic-ai/sdk
```

## Usage Examples

### JavaScript/Node.js

```javascript
// 1. Auto-detect and scrape
const result = await fetch(
  'http://localhost:8787/api/scrape-menu?restaurant=Olive%20Garden&location=Charlotte%20NC'
).then(r => r.json())

if (result.success) {
  console.log(`Found ${result.itemCount} items from ${result.source}`)
} else if (result.error === 'NEEDS_OCR') {
  // 2. Process with OCR
  const ocrResult = await fetch('http://localhost:8787/api/ocr/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfPath: result.pdfPath,
      restaurant: result.restaurant,
      location: result.location
    })
  }).then(r => r.json())
  
  console.log(`OCR extracted ${ocrResult.itemCount} items`)
}
```

### PowerShell

```powershell
# Scrape menu
$response = Invoke-RestMethod `
  -Uri "http://localhost:8787/api/scrape-menu?restaurant=Firebirds&location=Fort%20Mill%20SC"

if ($response.success) {
  Write-Host "Success: $($response.itemCount) items from $($response.source)"
} elseif ($response.error -eq "NEEDS_OCR") {
  # Process with OCR
  $ocrResult = Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8787/api/ocr/process" `
    -Headers @{ 'Content-Type' = 'application/json' } `
    -Body (@{
      pdfPath = $response.pdfPath
      restaurant = $response.restaurant
      location = $response.location
    } | ConvertTo-Json)
  
  Write-Host "OCR: $($ocrResult.itemCount) items extracted"
}
```

## File Structure

```
backend/
├── scraper/
│   └── scrapeMenuDynamic.js      # Main scraper with format detection
├── agent/
│   └── ocr_agent.js               # Claude Vision OCR processor
└── restaurants/
    └── [Restaurant_Name]/
        ├── menu.json              # Final structured menu
        ├── menu.pdf               # Downloaded PDF (if applicable)
        └── menu-image.jpg         # Downloaded image (if applicable)
```

## Key Features

✅ **Auto-Detection**: Finds PDF/Image/HTML menus automatically
✅ **PDF Extraction**: Text extraction with fallback to OCR
✅ **Image Recognition**: Claude Vision handles handwritten/image menus
✅ **Price Parsing**: Extracts numeric prices from any format
✅ **Category Grouping**: Organizes items by menu sections
✅ **Persistent Cache**: Saves PDFs/images for future processing
✅ **Fallback Logic**: Never returns empty; always attempts extraction

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "No official site found" | Website lookup failed | Provide menu URL manually |
| "NEEDS_OCR" | PDF/Image detected | Call `/api/ocr/process` endpoint |
| "OCR extraction failed" | Image too blurry/poor quality | Manually verify menu |
| "Menu page not reachable" | Website blocked/changed | Check URL manually |

## Configuration

Environment variables:
```bash
PORT=8787                    # Server port
ANTHROPIC_API_KEY=...       # Required for OCR processing
```

## Next Steps

1. **Batch Processing**: Run bulk menu scrapes with auto-OCR fallback
2. **Menu Caching**: Store extracted menus locally to avoid re-scraping
3. **Verification**: Manual review UI for OCR accuracy
4. **Analytics**: Track scrape success rates by format
