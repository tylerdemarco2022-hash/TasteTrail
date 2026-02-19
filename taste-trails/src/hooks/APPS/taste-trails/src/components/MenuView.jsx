import React, { useState, useEffect, useRef } from 'react'
import StarRating from './StarRating'
import { posts, restaurants as allRestaurants } from '../data'
import Reviews from './Reviews'
import ItemRating from './ItemRating'
import { API_BASE } from "../config";

export default function MenuView({ post, onBack, showAI }) {
  const [aiMenu, setAiMenu] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRating, setNewRating] = useState(4)
  const [newImage, setNewImage] = useState(null)
  const [newPrice, setNewPrice] = useState(2)
  const [savedItemsState, setSavedItemsState] = useState([])
  
  // Dish summary modal state
  const [showSummary, setShowSummary] = useState(false)
  const [summaryDish, setSummaryDish] = useState(null)
  const [dishDescription, setDishDescription] = useState('')
  
  // Menu fetching state
  const [fetchedMenu, setFetchedMenu] = useState(null)
  const [menuLoading, setMenuLoading] = useState(false)
  
  // Dish rating state
  const [dishRatings, setDishRatings] = useState({}) // dishName -> { totalRating, count, userRating }
  const [ratingDish, setRatingDish] = useState(null) // Currently rating dish
  const [userDishRating, setUserDishRating] = useState(5) // User's rating input (1-10)
  const [showItemRating, setShowItemRating] = useState(false)
  const [ratingItem, setRatingItem] = useState(null)
  const [triedFilter, setTriedFilter] = useState('all') // 'all', 'tried', 'not-tried'
  const didAutoGenerateMenu = useRef(false)

  const API_BASE = import.meta.env.VITE_API_BASE || ''

  if (!post) return null

  // Load dish ratings from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(`dishRatings-${post.restaurant || post.name}`)
    if (saved) {
      try {
        setDishRatings(JSON.parse(saved))
      } catch (e) {
        console.warn('Failed to load dish ratings:', e)
      }
    }
  }, [post.restaurant, post.name])

  React.useEffect(() => {
    // Always try to fetch full menu from backend if restaurant name is available
    if (post.restaurant) {
      fetchMenuFromBackend(post.restaurant)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.restaurant])

  async function triggerMenuScrape() {
    console.log('🔄 Triggering menu scrape for:', post.restaurant || post.name)
    setMenuLoading(true)
    try {
      const restaurantName = post.restaurant || post.name
      const location = post.location || 'Charlotte, NC'
      
      // Try full pipeline first
      const res = await fetch(
        `${API_BASE}/api/restaurant/${encodeURIComponent(restaurantName)}/full-menu?location=${encodeURIComponent(location)}&parseWithAI=true&enrichDescriptions=true`
      )
      
      const data = await res.json()
      
      if (data.success && data.categories && data.categories.length > 0) {
        console.log('✅ Scraped', data.itemCount, 'items from', data.source)
        // Flatten categories into items array
        const allItems = data.categories.flatMap(cat => 
          cat.items.map(item => ({ 
            name: item.name, 
            price: item.price,
            description: item.description,
            category: cat.category 
          }))
        )
        setFetchedMenu(allItems)
      } else if (data.needsOCR && data.pdfPath) {
        console.log('⚠️ PDF detected, needs OCR processing')
        alert(`PDF menu found! Path: ${data.pdfPath}\nYou can send this to OCR for processing.`)
      } else {
        console.warn('Scrape failed:', data.error)
        alert(`Could not fetch menu: ${data.error}`)
      }
    } catch (e) {
      console.error('Scrape error:', e.message)
      alert(`Error scraping menu: ${e.message}`)
    }
    setMenuLoading(false)
  }

  async function autoFetchFullMenu() {
    console.log('🤖 Auto-fetching menu from web...')
    setMenuLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auto-fetch-menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: post.restaurant || post.name,
          location: post.location || 'Charlotte, NC'
        })
      })
      
      const data = await res.json()
      
      if (data.status === 'SUCCESS' && data.menuData) {
        // Flatten all categories into one array
        const allItems = data.menuData.flatMap(cat => 
          cat.items.map(item => ({ ...item, category: cat.category }))
        )
        console.log('✅ Auto-fetched', allItems.length, 'items from web')
        setFetchedMenu(allItems)
      } else if (data.status === 'NEEDS_OCR') {
        alert('This restaurant has a PDF menu. Please check: ' + data.url)
      } else {
        console.warn('Auto-fetch failed:', data.status)
      }
    } catch (e) {
      console.error('Auto-fetch error:', e.message)
    }
    setMenuLoading(false)
  }

  async function fetchMenuFromBackend(restaurantId) {
    setMenuLoading(true);
    try {
      console.log("Fetching menu for UUID:", restaurantId);
      const url = `${API_BASE}/api/restaurants/${restaurantId}/full-menu`;
      const res = await fetch(url);
      const data = await res.json();
      console.log("Full menu response:", data);

      if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
        const allItems = data.categories.flatMap((cat) =>
          (cat.items || []).map((item) => ({
            name: item.name,
            price: item.price,
            description: item.description,
            category: cat.category
          }))
        );
        setFetchedMenu(allItems);
      } else {
        console.warn("Menu fetch failed:", data.error);
      }
    } catch (e) {
      console.error("Menu fetch error:", e.message);
    }
    setMenuLoading(false);
  }

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('savedItems')) || [];
    setSavedItemsState(saved);
  }, []);

  async function aiFindMenu() {
    setLoading(true)
    // look for a matching post with a menu
    const needle = (post.restaurant || post.name || '').toLowerCase()
    const found = posts.find((p) => (p.restaurant || p.name || '').toLowerCase().includes(needle))
    if (found && found.menu && found.menu.length) {
      // simulate AI returning structured menu
      setAiMenu(found.menu)
      setLoading(false)
      return
    }

    // fallback: simulate AI generating a small menu based on name
    await new Promise((r) => setTimeout(r, 700))
    const nameForGen = post.restaurant || post.name || 'This Place'
    const generated = [
      { name: `${nameForGen} Signature Dish`, rating: 4.2 },
      { name: 'House Special', rating: 4.0 },
      { name: 'Side Salad', rating: 3.8 }
    ]
    setAiMenu(generated)
    setLoading(false)
  }

  const displayMenu =
    (Array.isArray(fetchedMenu) && fetchedMenu.length ? fetchedMenu : null) ||
    (Array.isArray(aiMenu) && aiMenu.length ? aiMenu : null) ||
    post.menu || []

  const normalizeMenuItems = (menu) => {
    if (Array.isArray(menu)) {
      return menu.flatMap((entry) => {
        if (typeof entry === 'string' || entry?.name || entry?.dish_name || entry?.dish || entry?.title) {
          return [entry]
        }
        if (Array.isArray(entry?.items)) return entry.items
        return []
      })
    }
    if (menu && Array.isArray(menu.categories)) {
      return menu.categories.flatMap((cat) => cat.items || [])
    }
    return []
  }

  const effectiveMenu = React.useMemo(() => {
    return normalizeMenuItems(displayMenu)
  }, [displayMenu])
  
  React.useEffect(() => {
    console.log('MenuView state - Fetched:', fetchedMenu?.length || 0, 'AI:', aiMenu?.length || 0, 'Post:', post.menu?.length || 0, 'Display:', effectiveMenu.length, 'MenuLoading:', menuLoading)
  }, [effectiveMenu, fetchedMenu, aiMenu, post.menu, menuLoading])

  React.useEffect(() => {
    if (menuLoading || didAutoGenerateMenu.current) return
    const hasItems =
      (Array.isArray(fetchedMenu) && fetchedMenu.length > 0) ||
      (Array.isArray(aiMenu) && aiMenu.length > 0) ||
      (Array.isArray(post.menu) && post.menu.length > 0)
    if (!hasItems) {
      didAutoGenerateMenu.current = true
      aiFindMenu()
    }
  }, [menuLoading, fetchedMenu, aiMenu, post.menu, post.restaurant, post.name])

  async function handleAddItem() {
    if (!newName) return
    const item = { name: newName, rating: newRating, price: newPrice }
    if (newImage) item.image = newImage

    // update local display
    const next = [item, ...effectiveMenu]
    setAiMenu ? setAiMenu(next) : (post.menu = next)

    // also try to update central restaurants list if possible
    try {
      const needle = (post.restaurant || post.name || '').toLowerCase()
      const r = allRestaurants.find((x) => (x.name || '').toLowerCase().includes(needle))
      if (r) {
        r.menu = r.menu || []
        r.menu.unshift(item)
      }
    } catch (e) {}

    // reset and close
    setNewName('')
    setNewRating(4)
    setNewPrice(2)
    setNewImage(null)
    setShowAddItem(false)
  }

  const toggleSaveItem = async (item) => {
    const saved = JSON.parse(localStorage.getItem('savedItems')) || [];
    const isSaved = saved.some((savedItem) => savedItem.name === item.name);

    if (isSaved) {
      // Remove item from savedItems
      const updatedSaved = saved.filter((savedItem) => savedItem.name !== item.name);
      localStorage.setItem('savedItems', JSON.stringify(updatedSaved));
      console.log('Unsaved item:', item); // Log the unsaved item
      
      // Remove from database
      try {
        await fetch(`${API_BASE}/api/saved-items`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: localStorage.getItem('currentProfileId') || 'defaultProfile',
            restaurant_name: post.restaurant || post.name,
            item_name: item.name
          })
        });
      } catch (e) {
        console.error('Failed to remove from database:', e);
      }
    } else {
      // Add item to savedItems
      const profileId = localStorage.getItem('currentProfileId') || 'defaultProfile';
      saved.push({ ...item, restaurant: post.restaurant || post.name, profileId });
      localStorage.setItem('savedItems', JSON.stringify(saved));
      console.log('Saved item:', item); // Log the saved item
      
      // Save to database
      try {
        await fetch(`${API_BASE}/api/saved-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: localStorage.getItem('currentProfileId') || 'defaultProfile',
            restaurant_id: post.id || post.yelpId || null,
            restaurant_name: post.restaurant || post.name,
            item_name: item.name,
            item_rating: item.rating,
            item_image: item.image
          })
        });
      } catch (e) {
        console.error('Failed to save to database:', e);
      }
    }

    // Emit custom event to notify other components
    const event = new Event('savedItemsUpdated');
    window.dispatchEvent(event);

    setSavedItemsState(JSON.parse(localStorage.getItem('savedItems')));
  };

  const isItemSaved = (item) => {
    return savedItemsState.some((savedItem) => savedItem.name === item.name);
  };

  const generateDishSummary = (dishName, restaurantName) => {
    // Simple AI-like description generator based on dish name keywords
    const descriptions = {
      // Asian dishes
      'bao': 'Soft, fluffy steamed buns filled with savory ingredients. A popular street food originating from China, these pillowy buns offer a perfect balance of texture and flavor.',
      'biryani': 'A fragrant rice dish layered with aromatic spices, herbs, and tender meat or vegetables. This beloved South Asian specialty is slow-cooked to perfection, creating complex flavors in every bite.',
      'ramen': 'Japanese noodle soup featuring rich broth, springy noodles, and various toppings. Each bowl is a comforting combination of umami flavors and satisfying textures.',
      'sushi': 'Traditional Japanese dish of vinegared rice paired with fresh fish, vegetables, or other ingredients. An art form that celebrates simplicity and freshness.',
      'pad thai': 'Stir-fried rice noodles with eggs, vegetables, and protein in a sweet-savory tamarind sauce. Thailand\'s most famous street food, perfectly balanced in flavor.',
      'pho': 'Vietnamese noodle soup with aromatic broth, rice noodles, herbs, and meat. A warming, fragrant bowl that\'s both light and deeply satisfying.',
      
      // Italian dishes
      'pizza': 'Classic Italian flatbread topped with tomato sauce, cheese, and various toppings, baked to perfection. Crispy crust meets melty cheese in this universally loved comfort food.',
      'pasta': 'Italian noodles served with a variety of sauces and ingredients. From creamy carbonara to rich bolognese, each pasta dish tells a delicious story.',
      'risotto': 'Creamy Italian rice dish cooked slowly with broth and finished with butter and cheese. Each grain is tender yet firm, creating a luxurious texture.',
      'lasagna': 'Layered pasta dish with meat sauce, cheese, and bechamel. Baked until bubbly and golden, it\'s the ultimate comfort food.',
      
      // American dishes
      'burger': 'Juicy grilled patty served in a soft bun with fresh toppings. A classic American favorite that\'s endlessly customizable and always satisfying.',
      'steak': 'Premium cut of beef grilled or pan-seared to your preference. Rich, savory, and tender, it\'s a timeless choice for meat lovers.',
      'bbq': 'Slow-smoked meats with tangy or sweet sauce. This American tradition delivers fall-off-the-bone tenderness and deep, smoky flavors.',
      'wings': 'Crispy chicken wings tossed in flavorful sauce. Perfect for sharing, these bite-sized treats pack big flavor in every piece.',
      'sandwich': 'Layered ingredients between slices of bread. Simple yet versatile, sandwiches can be customized to any taste preference.',
      
      // Mexican dishes
      'taco': 'Mexican tortilla filled with seasoned meat, vegetables, and toppings. A handheld delight bursting with fresh flavors and textures.',
      'burrito': 'Large flour tortilla wrapped around rice, beans, meat, and toppings. Hearty and filling, it\'s a complete meal in portable form.',
      'quesadilla': 'Grilled tortilla filled with melted cheese and other ingredients. Crispy on the outside, gooey on the inside.',
      
      // Breakfast items
      'toast': 'Toasted bread topped with spreads or ingredients. Simple yet versatile, from classic avocado to sweet fruit toppings.',
      'pancake': 'Fluffy griddle cakes served with syrup and toppings. A breakfast classic that\'s light, airy, and delicious.',
      'omelette': 'Beaten eggs cooked and folded with various fillings. Customizable and protein-packed to start your day right.',
      'waffle': 'Crispy on the outside, fluffy inside breakfast treat. Golden-brown with signature pockets perfect for holding syrup.',
      
      // Desserts
      'cake': 'Sweet baked dessert with layers of flavor and frosting. From chocolate to vanilla, each slice is a celebration.',
      'ice cream': 'Frozen dessert made from cream, sugar, and flavorings. Smooth, creamy, and refreshing in countless varieties.',
      'brownie': 'Rich, fudgy chocolate dessert square. Dense and decadent, perfect for chocolate lovers.',
      
      // Drinks
      'tea': 'Aromatic beverage brewed from tea leaves. Can be served hot or cold, plain or sweetened.',
      'coffee': 'Brewed beverage from roasted coffee beans. Rich, energizing, and available in countless preparations.',
      'smoothie': 'Blended drink of fruits, vegetables, and liquids. Refreshing and nutritious in a glass.',
      'bubble tea': 'Sweet tea-based drink with chewy tapioca pearls. Fun, flavorful, and endlessly customizable.',
      
      // Salads & Healthy
      'salad': 'Fresh vegetables and greens with dressing. Light, crisp, and full of vitamins and nutrients.',
      'bowl': 'Grain or protein base topped with vegetables and sauce. Healthy, balanced, and Instagram-worthy.',
      
      // Seafood
      'salmon': 'Rich, flaky fish packed with omega-3s. Grilled, baked, or raw, it\'s both delicious and nutritious.',
      'shrimp': 'Sweet, tender shellfish prepared in countless ways. From grilled to fried, these little bites pack big flavor.',
    }
    
    const lowerDish = dishName.toLowerCase()
    
    // Check for matching keywords
    for (const [keyword, description] of Object.entries(descriptions)) {
      if (lowerDish.includes(keyword)) {
        return description
      }
    }
    
    // Default description
    return `${dishName} is a signature dish at ${restaurantName}. This carefully crafted item combines fresh ingredients and expert preparation to deliver a memorable dining experience. Each element is thoughtfully selected to create a harmonious balance of flavors and textures that will delight your palate.`
  }

  const submitDishRating = async (dish, rating) => {
    const userId = localStorage.getItem('currentUserId');
    if (!userId) {
      alert("You must be logged in to rate.");
      return;
    }

    if (!dish.id) {
      console.error("Dish ID is missing. Ensure dish data is loaded correctly.");
      alert("Dish data is missing. Please try again.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: dish.id,
          user_id: userId,
          rating: Number(rating)
        })
      });

      if (!response.ok) {
        const text = await response.text()
        console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
        let err
        try {
          err = JSON.parse(text)
        } catch (e) {
          console.error("NOT JSON RESPONSE:", text.slice(0, 200))
          throw e
        }
        console.error("Rating failed:", err);
        alert("Rating failed. Please try again.");
        return;
      }

      // Refetch menu data after successful rating submission
      await fetchMenuFromBackend(post.restaurant || post.name);

      setShowItemRating(false);
      setRatingItem(null);
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("An error occurred while submitting your rating. Please try again later.");
    }
  }

  const submitFakeRatings = async () => {
    const menuItems = Array.isArray(effectiveMenu) ? effectiveMenu.filter((item) => item && item.id) : []
    console.log('Menu items:', menuItems)
    if (!menuItems.length) {
      return
    }

    const userId = localStorage.getItem('currentUserId')
    if (!userId) {
      console.warn('No currentUserId found for fake ratings')
      return
    }

    const fakeRatings = menuItems.slice(0, 3).map((item, index) => ({
      dish_id: item.id,
      user_id: userId,
      rating: Math.max(1, Math.min(5, 5 - index))
    }))

    for (const fakeRating of fakeRatings) {
      try {
        console.log('Submitting rating payload:', fakeRating)
        const response = await fetch(`${API_BASE}/api/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fakeRating),
        });

        if (!response.ok) {
          const text = await response.text()
          console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
          let err
          try {
            err = JSON.parse(text)
          } catch (e) {
            console.error("NOT JSON RESPONSE:", text.slice(0, 200))
            throw e
          }
          console.error('Fake rating submission failed:', err);
        } else {
          console.log('Fake rating submitted successfully:', fakeRating);
        }
      } catch (error) {
        console.error('Error submitting fake rating:', error);
      }
    }
  };

  // Call the function to submit fake ratings for testing
  const didSubmitFakeRatings = useRef(false)
  useEffect(() => {
    if (didSubmitFakeRatings.current) return
    if (!Array.isArray(effectiveMenu) || !effectiveMenu.length) return
    didSubmitFakeRatings.current = true
    submitFakeRatings()
  }, [effectiveMenu]);

  const getAverageDishRating = (dishName) => {
    const data = dishRatings[dishName]
    if (!data || !data.average) return null
    return data.average.toFixed(1)
  }

  const getDishRatingCount = (dishName) => {
    const data = dishRatings[dishName]
    return data ? data.count : 0
  }

  const getFakeItemRating = (itemName) => {
    const seed = String(itemName || 'item').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
    const rating = 6.8 + (seed % 28) / 10
    const count = 3 + (seed % 37)
    return { rating: rating.toFixed(1), count }
  }

  const getDisplayItemRating = (item) => {
    const localCount = getDishRatingCount(item?.name)
    if (localCount > 0) {
      const avg = getAverageDishRating(item?.name) || '0.0'
      return {
        rating: avg,
        count: localCount,
        isFake: false
      }
    }
    const ratingValue = Number(item?.rating_bayesian || 0)
    const ratingCount = Number(item?.rating_count || 0)
    if (ratingCount > 0) {
      return {
        rating: ratingValue ? ratingValue.toFixed(1) : '0.0',
        count: ratingCount,
        isFake: false
      }
    }
    const fake = getFakeItemRating(item?.name)
    return { rating: fake.rating, count: fake.count, isFake: true }
  }

  const handleShowSummary = (item) => {
    setSummaryDish(item)
    const description = generateDishSummary(item.name, post.restaurant || post.name)
    setDishDescription(description)
    setShowSummary(true)
  }

  const getPriceDisplay = (price) => {
    if (!price) return '$8.99'
    // If it's a number under 10, treat it as price level and convert to actual price
    if (typeof price === 'number' && price <= 10) {
      const priceMap = { 1: 6.99, 2: 9.99, 3: 14.99, 4: 19.99, 5: 29.99 }
      return '$' + (priceMap[Math.round(price)] || 9.99).toFixed(2)
    }
    // If it's already a price string or larger number, return formatted
    if (typeof price === 'string') return price
    return '$' + Number(price).toFixed(2)
  }

  const getCategory = (name = '') => {
    const n = name.toLowerCase()
    if (/(pizza|margherita|pepperoni|formaggi)/.test(n)) return 'Pizza'
    if (/(pasta|lasagna|carbonara|fettuccine|ravioli|risotto|spaghetti|penne)/.test(n)) return 'Pasta'
    if (/(bao|dumpling|noodle|ramen|pho|pad thai|spring roll|biryani|curry|korma|tikka)/.test(n)) return 'Asian'
    if (/(burger|sandwich|wings|fries|steak|bbq|mac and cheese)/.test(n)) return 'American'
    if (/(salad|bowl|toast|quinoa|acai|smoothie)/.test(n)) return 'Salads & Bowls'
    if (/(dessert|cake|tiramisu|brownie|ice cream|pudding)/.test(n)) return 'Desserts'
    if (/(coffee|tea|latte|smoothie|shake|drink|lemonade)/.test(n)) return 'Drinks'
    if (/(seafood|shrimp|salmon|fish|calamari)/.test(n)) return 'Seafood'
    return 'Other'
  }

  const getItemName = (item) => {
    if (typeof item === 'string') return item
    return item?.name || item?.dish_name || item?.dish || item?.title || ''
  }

  const hasUserTried = (itemName) => {
    const data = dishRatings[itemName]
    return data && data.count > 0
  }

  const filteredMenu = React.useMemo(() => {
    if (triedFilter === 'all') return effectiveMenu
    if (triedFilter === 'tried') {
      return effectiveMenu.filter(item => hasUserTried(getItemName(item)))
    }
    if (triedFilter === 'not-tried') {
      return effectiveMenu.filter(item => !hasUserTried(getItemName(item)))
    }
    return effectiveMenu
  }, [effectiveMenu, triedFilter, dishRatings])

  const groupedMenu = React.useMemo(() => {
    const groups = {}
    filteredMenu.forEach((item) => {
      const cat = getCategory(getItemName(item))
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    return groups
  }, [filteredMenu])

  const heroImage = post.image || post.image_url || post.imageUrl || post.photo || (post.photos && post.photos[0]) || post.cover || ''
  const heroStyle = heroImage
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.18)), url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(255,255,255,0.1))'
      }

  const restaurantDescription = post.description || post.about || post.summary || post.caption || 'No description available yet.'

  const handleRatingSubmit = (reviewData) => {
    // Save to dish ratings
    const restaurantKey = post.restaurant || post.name
    const existing = dishRatings[reviewData.dishName] || { ratings: [], count: 0, sum: 0, reviews: [] }
    
    // Add new rating
    const newRatings = [...(existing.ratings || []), reviewData.rating]
    const newCount = newRatings.length
    const newSum = newRatings.reduce((a, b) => a + b, 0)
    
    // Add review details
    const newReviews = [...(existing.reviews || []), reviewData]
    
    const updated = {
      ...dishRatings,
      [reviewData.dishName]: {
        ratings: newRatings,
        count: newCount,
        sum: newSum,
        average: newSum / newCount,
        reviews: newReviews
      }
    }
    
    setDishRatings(updated)
    localStorage.setItem(`dishRatings-${restaurantKey}`, JSON.stringify(updated))

    // Persist to "My Ratings" for profile tab
    try {
      const stored = JSON.parse(localStorage.getItem('my-rated-items') || '[]')
      const entryId = `${restaurantKey}-${reviewData.dishName}`
      const existingIdx = stored.findIndex((r) => r.entryId === entryId)
      const newEntry = {
        entryId,
        restaurant: restaurantKey,
        dish: reviewData.dishName,
        rating: reviewData.rating,
        image: reviewData.photo || post.image || null,
        comment: reviewData.comment || '',
        timestamp: Date.now()
      }
      if (existingIdx >= 0) {
        stored[existingIdx] = newEntry
      } else {
        stored.unshift(newEntry)
      }
      localStorage.setItem('my-rated-items', JSON.stringify(stored))
      window.dispatchEvent(new Event('ratingSaved'))
    } catch (e) {
      console.warn('Failed to persist rated item:', e)
    }

    // Close rating page
    setShowItemRating(false)
    setRatingItem(null)
  }

  async function handleMenuDiscovery() {
    console.log('🔄 Checking menu discovery status for:', post.id);
    setMenuLoading(true);
    try {
      const restaurantId = post.id || '';
      const res = await fetch(`${API_BASE}/api/restaurants/${encodeURIComponent(restaurantId)}/menu-source`);
      const text = await res.text();
      if (!res.ok) {
        console.warn('Menu discovery request failed:', text.slice(0, 200));
        alert(`Error starting menu discovery: ${text.slice(0, 200)}`);
        setMenuLoading(false);
        return;
      }
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('MENU DISCOVERY PARSE ERROR:', err);
      }
      console.log('Menu discovery response:', data);
      setMenuLoading(false);
    } catch (e) {
      console.error('Error during menu discovery:', e.message);
      alert(`Error during menu discovery: ${e.message}`);
      setMenuLoading(false);
    }
  }

  async function handleMenuButtonClick() {
    console.log('🍽️ Menu button clicked for restaurant:', post.id);
    console.log('handleMenuButtonClick fired with:', post.id);
    setMenuLoading(true);

    try {
      const res = await fetch(`${API_BASE}/restaurants/${post.id}`);
      const restaurant = await res.json();

      if (restaurant.menu_status === "ready") {
        console.log('✅ Menu is ready for:', post.id);
        setFetchedMenu({
          dinner_url: restaurant.dinner_url,
          lunch_url: restaurant.lunch_url,
          drinks_url: restaurant.drinks_url,
          pdf_url: restaurant.pdf_url
        });
        setMenuLoading(false);
        return;
      }

      console.log('⏳ Menu not ready, triggering discovery for:', post.id);
      const discoveryRes = await fetch(`${API_BASE}/api/restaurants/${encodeURIComponent(post.id)}/menu-source`);
      const discoveryText = await discoveryRes.text();
      if (!discoveryRes.ok) {
        console.warn('Menu discovery request failed:', discoveryText.slice(0, 200));
        alert(`Error starting menu discovery: ${discoveryText.slice(0, 200)}`);
        setMenuLoading(false);
        return;
      }
      let discoveryData = null;
      try {
        discoveryData = JSON.parse(discoveryText);
      } catch (err) {
        console.error('MENU DISCOVERY PARSE ERROR:', err);
      }
      console.log('Menu discovery response:', discoveryData);
      setMenuLoading(false);
    } catch (e) {
      console.error('Error during menu button flow:', e.message);
      alert(`Error during menu button flow: ${e.message}`);
      setMenuLoading(false);
    }
  }

  React.useEffect(() => {
    if (post.menu_status && post.menu_status !== 'ready') {
      handleMenuDiscovery();
    }
  }, [post.menu_status]);

  if (showItemRating && ratingItem) {
    return (
      <ItemRating
        item={ratingItem}
        restaurant={post.restaurant || post.name}
        onBack={() => {
          setShowItemRating(false)
          setRatingItem(null)
        }}
        onSubmit={handleRatingSubmit}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-amber-100 shadow-2xl shadow-amber-100/60 p-6 lg:p-8">

          <div className="overflow-hidden rounded-3xl border border-amber-100 shadow-lg shadow-amber-100/60 mb-6">
            <div className="relative h-56 flex items-end p-6" style={heroStyle}>
              <div className="text-white drop-shadow space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] font-semibold text-amber-100/90">Menu</div>
                <h2 className="text-3xl lg:text-4xl font-black leading-tight">{post.restaurant}</h2>
                <div className="flex gap-2 pt-1">
                  {post.opentable_id ? (
                    <a href={`https://www.opentable.com/restref/client/?rid=${post.opentable_id}&lang=en-US`} target="_blank" rel="noreferrer" className="inline-block bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-sm font-semibold shadow">Reserve with OpenTable</a>
                  ) : (
                    <a href={`https://www.opentable.com/s?dateTime=2026-01-04T19%3A00&covers=2&term=${encodeURIComponent((post.restaurant||'').replace(/\s+/g,'-'))}&metroId=0`} target="_blank" rel="noreferrer" className="inline-block bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-sm font-semibold shadow">Reserve with OpenTable</a>
                  )}
                </div>
                {post.dish && <div className="text-sm text-amber-100/90">Signature: {post.dish}</div>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {menuLoading && <span className="px-2 py-1 rounded-full bg-white/25">Loading menu…</span>}
                  <span className="px-2 py-1 rounded-full bg-white/25">{effectiveMenu.length} items</span>
                </div>
              </div>
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <button onClick={() => setShowAddItem(true)} className="px-3 py-2 bg-white/90 text-gray-900 border border-white/50 rounded-lg shadow-sm hover:shadow">Add Item</button>
                <button onClick={onBack} className="px-3 py-2 bg-white/70 text-gray-800 rounded-lg border border-white/50 hover:bg-white">Back</button>
              </div>
            </div>
          </div>

      {/* Filter Dropdown */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Menu Items</h3>
        <div className="relative">
          <select
            value={triedFilter}
            onChange={(e) => setTriedFilter(e.target.value)}
            className="px-4 py-2 pr-10 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent appearance-none cursor-pointer font-medium text-gray-700"
          >
            <option value="all">All Items ({effectiveMenu.length})</option>
            <option value="tried">Tried ({effectiveMenu.filter(i => hasUserTried(getItemName(i))).length})</option>
            <option value="not-tried">Not Tried Yet ({effectiveMenu.filter(i => !hasUserTried(getItemName(i))).length})</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {filteredMenu.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            {triedFilter === 'tried' && 'No items tried yet. Rate some items to see them here!'}
            {triedFilter === 'not-tried' && 'You\'ve tried all items! 🎉'}
            {triedFilter === 'all' && (loading ? 'Loading menu items...' : 'No menu available for this restaurant.')}
          </div>
        )}

        {Object.entries(groupedMenu).map(([category, items]) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">{category}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{items.length} items</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item, idx) => {
                const itemName = getItemName(item) || 'Untitled'
                const itemDescription = item?.description || item?.desc || item?.details || ''
                const itemPrice = item?.price ?? item?.price_level ?? item?.priceLevel
                const itemImage = item?.image
                const itemForActions = typeof item === 'object' && item !== null ? (item?.name ? item : { ...item, name: itemName }) : { name: itemName }
                return (
                <div key={item.id || itemName || idx} className="bg-white rounded-2xl p-4 shadow-sm border border-amber-50/60 hover:shadow-md transition h-full flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    {itemImage && <img src={itemImage} alt="" className="w-12 h-12 object-cover rounded" />}
                    <div className="flex-1">
                      <div className="font-semibold leading-tight text-gray-900">{itemName}</div>
                      {itemPrice && <div className="text-xs text-amber-600 font-semibold">{getPriceDisplay(itemPrice)}</div>}
                      {itemDescription && (
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{itemDescription}</p>
                      )}
                      {!itemDescription && (
                        <p className="text-xs text-gray-500 mt-1 italic">{generateDishSummary(itemName, post.restaurant || post.name)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleSaveItem(itemForActions)}
                      className={`p-2 rounded-full ${isItemSaved(item) ? 'bg-green-500' : 'bg-red-500'} text-white shadow-sm`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-auto pt-3 border-t border-dashed border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const display = getDisplayItemRating(itemForActions)
                        return (
                          <div className="text-sm text-gray-700">
                            <span className="text-gray-500 mr-1">Dish Score</span>
                            <span className="font-semibold">{display.rating}</span>
                          </div>
                        )
                      })()}
                    </div>
                    <button
                      onClick={() => {
                        setRatingItem(itemForActions);
                        setShowItemRating(true);
                      }}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Rate
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}
      </div>

      {showAddItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Add Menu Item</h3>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border p-2 rounded" />
            </div>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Rating (1-10)</label>
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="10" step="0.1" value={newRating} onChange={(e) => setNewRating(Number(e.target.value))} className="flex-1" />
                <span className="text-sm font-semibold w-8">{newRating.toFixed(1)}</span>
              </div>
            </div>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Price Level</label>
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="5" step="1" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} className="flex-1" />
                <span className="text-sm font-semibold text-amber-600 w-16">{getPriceDisplay(newPrice)}</span>
              </div>
            </div>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Image (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files && e.target.files[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = (ev) => setNewImage(ev.target.result)
                reader.readAsDataURL(f)
              }} />
              {newImage && <img src={newImage} className="mt-2 w-full h-32 object-cover rounded" alt="preview" />}
            </div>
            <div className="flex justify-end space-x-2 mt-3">
              <button onClick={() => setShowAddItem(false)} className="px-3 py-2 bg-gray-100 rounded">Cancel</button>
              <button onClick={handleAddItem} className="px-3 py-2 bg-yellow-500 text-white rounded">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Dish Summary Modal */}
      {showSummary && summaryDish && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {summaryDish.image && <img src={summaryDish.image} alt="" className="w-16 h-16 object-cover rounded" />}
                <div>
                  <h3 className="text-xl font-bold">{summaryDish.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <StarRating value={summaryDish.rating} />
                    {summaryDish.price && <span className="text-sm font-semibold text-amber-600">{getPriceDisplay(summaryDish.price)}</span>}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowSummary(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">📖 About this dish</h4>
              <p className="text-gray-600 leading-relaxed">{dishDescription}</p>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowSummary(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setShowSummary(false)
                  toggleSaveItem(summaryDish)
                }}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                {isItemSaved(summaryDish) ? 'Unsave' : 'Save to Favorites'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dish Rating Modal */}
      {ratingDish && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Rate "{ratingDish}"</h3>
            
            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-3">How would you rate this dish?</label>
              <div className="flex items-center justify-between gap-4">
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  step="0.5" 
                  value={userDishRating} 
                  onChange={(e) => setUserDishRating(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{userDishRating.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">/10</div>
                </div>
              </div>
            </div>

            {/* Show current average */}
            {item.rating_count > 0 && (
              <div className="mb-4 p-3 bg-gray-100 rounded">
                <div className="text-sm text-gray-600">
                  <strong>Community Rating:</strong> {item.rating_bayesian}/10 ({item.rating_count} ratings)
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => setRatingDish(null)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button 
                onClick={() => submitDishRating(ratingDish, userDishRating)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  )
}
