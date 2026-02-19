import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const client = new Anthropic()

/**
 * OCR Agent: Extracts menu items from PDF/Image using Claude Vision
 * Returns structured menu data with items and prices
 */
export async function processMenuWithOCR(pdfPath, imagePath, restaurant, location) {
  try {
    console.log(`🤖 OCR Agent: Processing menu for "${restaurant}"...`)
    
    let imageSource = null
    
    // Read image or PDF image
    if (imagePath && fs.existsSync(imagePath)) {
      const imageData = fs.readFileSync(imagePath)
      const base64Image = imageData.toString('base64')
      const mediaType = imagePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
      imageSource = {
        type: 'base64',
        media_type: mediaType,
        data: base64Image
      }
    } else if (pdfPath && fs.existsSync(pdfPath)) {
      const pdfData = fs.readFileSync(pdfPath)
      const base64PDF = pdfData.toString('base64')
      imageSource = {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64PDF
      }
    } else {
      return {
        success: false,
        error: 'No valid image or PDF file found'
      }
    }

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: imageSource
            },
            {
              type: 'text',
              text: `You are a menu OCR expert. Extract ALL menu items from this ${pdfPath ? 'PDF' : 'image'} menu for "${restaurant}".

Return ONLY valid JSON with this exact structure:
{
  "categories": [
    {
      "category": "Category Name",
      "items": [
        { "name": "Dish Name", "price": 12.50, "description": "optional" }
      ]
    }
  ]
}

Rules:
1. Extract item NAME and PRICE for each menu item
2. Group items by category (appetizers, entrees, desserts, etc.)
3. Prices should be numeric values (e.g., 12.50, not "$12.50")
4. Only include items with clear prices
5. Return valid JSON only, no markdown or extra text
6. Include descriptions if visible

If you cannot extract menu items, return: { "categories": [] }`
            }
          ]
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('No JSON found in OCR response')
      return {
        success: false,
        error: 'OCR did not return valid menu structure',
        rawResponse: responseText
      }
    }

    const menuData = JSON.parse(jsonMatch[0])
    
    if (!menuData.categories || menuData.categories.length === 0) {
      return {
        success: false,
        error: 'OCR extracted no menu items',
        rawResponse: responseText
      }
    }

    // Validate and clean menu data
    const cleanedCategories = menuData.categories
      .map(cat => ({
        category: cat.category || 'Menu',
        items: (cat.items || [])
          .filter(item => item.name && item.price && typeof item.price === 'number')
          .map(item => ({
            name: item.name.trim(),
            price: parseFloat(item.price),
            description: item.description || ''
          }))
      }))
      .filter(cat => cat.items.length > 0)

    const totalItems = cleanedCategories.reduce((sum, cat) => sum + cat.items.length, 0)

    console.log(`✅ OCR Agent: Extracted ${totalItems} items from ${cleanedCategories.length} categories`)

    const result = {
      success: true,
      restaurant,
      location,
      scrapedAt: new Date().toISOString(),
      categories: cleanedCategories,
      itemCount: totalItems,
      method: 'OCR',
      source: pdfPath ? 'PDF' : 'Image'
    }

    // Save to menu.json
    const restaurantDir = path.join(path.dirname(__dirname), 'restaurants', restaurant.replace(/[^a-z0-9]/gi, '_'))
    fs.mkdirSync(restaurantDir, { recursive: true })
    const menuPath = path.join(restaurantDir, 'menu.json')
    fs.writeFileSync(menuPath, JSON.stringify(result, null, 2))

    console.log(`💾 Saved OCR menu to: ${menuPath}`)

    return result
  } catch (error) {
    console.error(`❌ OCR Agent error: ${error.message}`)
    return {
      success: false,
      error: error.message,
      restaurant,
      location
    }
  }
}

// CLI for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const pdfOrImage = process.argv[2]
  const restaurant = process.argv[3] || 'Restaurant'
  const location = process.argv[4] || 'Location'

  if (!pdfOrImage || !fs.existsSync(pdfOrImage)) {
    console.log('Usage: node backend/agent/ocr_agent.js "<PDF or Image Path>" "[Restaurant]" "[Location]"')
    process.exit(1)
  }

  processMenuWithOCR(
    pdfOrImage.endsWith('.pdf') ? pdfOrImage : null,
    !pdfOrImage.endsWith('.pdf') ? pdfOrImage : null,
    restaurant,
    location
  ).then(result => {
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.success ? 0 : 1)
  })
}
