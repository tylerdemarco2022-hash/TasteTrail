const supabase = require('./supabaseClient')

async function upsertRestaurant(restaurant) {
  try {
    const payload = {
      name: restaurant.name || null,
      address: restaurant.address || null,
      city: restaurant.city || null,
      state: restaurant.state || null,
      website: restaurant.website || null,
      place_id: restaurant.place_id || null,
      latitude: (restaurant.latitude != null) ? restaurant.latitude : null,
      longitude: (restaurant.longitude != null) ? restaurant.longitude : null
    }
    const { data: resData, error: resError } = await supabase.from('restaurants').upsert(payload, { onConflict: 'place_id' }).select('id').limit(1)
    if (resError) {
      console.error('Restaurant upsert error:', resError)
      throw resError
    }
    const id = resData && resData[0] && resData[0].id
    return { id }
  } catch (e) {
    console.warn('Upsert restaurant failed:', e instanceof Error ? e.message : String(e))
    return { id: null }
  }
}

async function storeMenu(restaurant, normalizedMenu) {
  try {
    const r = await upsertRestaurant(restaurant)
    const restaurant_id = r.id
    if (!restaurant_id) return { dishesInserted: 0 }
    let dishesInserted = 0

    for (const cat of normalizedMenu.categories || []) {
      try {
        const catPayload = { restaurant_id, name: cat.category }
        const { data: catData, error: catError } = await supabase.from('categories').upsert(catPayload, { onConflict: ['restaurant_id', 'name'] }).select('id').limit(1)
        if (catError) {
          console.error('Category upsert error:', catError)
          throw catError
        }
        const category_id = catData && catData[0] && catData[0].id
        for (const it of cat.items || []) {
          try {
            const { error: dishError } = await supabase
              .from('dishes')
              .upsert({
                restaurant_id,
                category_id,
                name: it.name || it.dish_name || null,
                description: it.description || null,
                price: it.price || null
              })

            if (dishError) {
              console.error('Dish upsert error:', dishError);
            } else {
              dishesInserted++
            }
          } catch (ie) {
            console.warn('Insert item failed:', ie instanceof Error ? ie.message : String(ie))
            continue
          }
        }
      } catch (ce) {
        console.warn('Insert category failed:', ce instanceof Error ? ce.message : String(ce))
        continue
      }
    }

    return { dishesInserted }
  } catch (e) {
    console.warn('storeMenu failed:', e instanceof Error ? e.message : String(e))
    return { dishesInserted: 0 }
  }
}

module.exports = { storeMenu, upsertRestaurant }
