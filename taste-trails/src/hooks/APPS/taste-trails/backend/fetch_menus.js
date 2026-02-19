import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const YELP_KEY = process.env.YELP_API_KEY
const isPlaceholder = (key, placeholder) => !key || key === placeholder

// Comprehensive menu database for popular restaurants
const RESTAURANT_MENUS = {
  'Bao & Co': {
    type: 'Asian',
    items: [
      { name: 'Pork Belly Bao', rating: 4.7, price: 3, description: 'Steamed buns with tender pork belly, pickled vegetables and cilantro' },
      { name: 'Chicken Bao', rating: 4.5, price: 3, description: 'Soft buns with marinated chicken, cucumber and scallions' },
      { name: 'Shrimp Bao', rating: 4.6, price: 3, description: 'Crispy shrimp buns with avocado and spicy mayo' },
      { name: 'Veggie Bao', rating: 4.3, price: 2, description: 'Plant-based buns with seasonal vegetables and ginger sauce' },
      { name: 'Edamame', rating: 4.4, price: 2, description: 'Steamed soybeans with sea salt' },
      { name: 'Dumpling (6pcs)', rating: 4.6, price: 3, description: 'Pan-fried pork and chive dumplings' },
      { name: 'Spring Rolls (3pcs)', rating: 4.5, price: 3, description: 'Crispy rolls with pork, shrimp and vegetables' },
      { name: 'Bubble Tea', rating: 4.2, price: 2, description: 'Creamy milk tea with tapioca pearls' },
      { name: 'Mango Lassi', rating: 4.4, price: 2, description: 'Refreshing yogurt drink with fresh mango' },
      { name: 'Lychee Lemonade', rating: 4.3, price: 2, description: 'Tropical sweet and tart beverage' },
      { name: 'Sesame Noodles', rating: 4.5, price: 3, description: 'Cold noodles with peanut sesame sauce' },
      { name: 'Crispy Tofu', rating: 4.4, price: 2, description: 'Golden fried tofu with sweet chili sauce' }
    ]
  },
  'Saffron Spoon': {
    type: 'Indian',
    items: [
      { name: 'Lamb Biryani', rating: 4.9, price: 4, description: 'Fragrant basmati rice layered with tender lamb and aromatic spices' },
      { name: 'Chicken Biryani', rating: 4.8, price: 4, description: 'Aromatic rice dish with succulent pieces of marinated chicken' },
      { name: 'Vegetable Biryani', rating: 4.7, price: 3, description: 'Mixed vegetables with fragrant rice and Indian spices' },
      { name: 'Lamb Curry', rating: 4.7, price: 4, description: 'Tender lamb in rich tomato-based gravy' },
      { name: 'Chicken Tikka Masala', rating: 4.8, price: 4, description: 'Charred chicken in creamy tomato sauce' },
      { name: 'Chicken Korma', rating: 4.6, price: 3, description: 'Mild creamy curry with almonds and coconut' },
      { name: 'Paneer Tikka Masala', rating: 4.7, price: 3, description: 'Cottage cheese in spiced tomato cream sauce' },
      { name: 'Chana Masala', rating: 4.5, price: 2, description: 'Chickpeas in aromatic tomato sauce' },
      { name: 'Naan Bread', rating: 4.6, price: 2, description: 'Traditional clay oven-baked Indian bread' },
      { name: 'Garlic Naan', rating: 4.7, price: 2, description: 'Fluffy bread topped with garlic and cilantro' },
      { name: 'Samosa (3pcs)', rating: 4.5, price: 2, description: 'Crispy potato and pea pastries' },
      { name: 'Mango Lassi', rating: 4.6, price: 2, description: 'Sweet yogurt drink with fresh mango' }
    ]
  },
  'Green Fork': {
    type: 'Cafe/Brunch',
    items: [
      { name: 'Avocado Toast', rating: 4.5, price: 3, description: 'Multigrain toast with smashed avocado, cherry tomatoes and microgreens' },
      { name: 'Acai Bowl', rating: 4.7, price: 4, description: 'Acai base topped with granola, fresh berries and coconut' },
      { name: 'Smoked Salmon Toast', rating: 4.6, price: 4, description: 'Sourdough with smoked salmon, cream cheese and capers' },
      { name: 'Shakshuka', rating: 4.6, price: 3, description: 'Eggs poached in spiced tomato sauce' },
      { name: 'Quinoa Bowl', rating: 4.5, price: 4, description: 'Quinoa with roasted vegetables, tahini dressing' },
      { name: 'Organic Salad', rating: 4.4, price: 3, description: 'Mixed greens with seasonal vegetables and vinaigrette' },
      { name: 'Green Smoothie', rating: 4.5, price: 3, description: 'Spinach, banana, apple and almond butter' },
      { name: 'Berry Smoothie Bowl', rating: 4.6, price: 4, description: 'Blended berries with granola and chia seeds' },
      { name: 'Cappuccino', rating: 4.5, price: 2, description: 'Espresso with steamed milk and foam' },
      { name: 'Cold Brew Coffee', rating: 4.4, price: 2, description: 'Smooth and refreshing cold-brewed coffee' },
      { name: 'Matcha Latte', rating: 4.6, price: 3, description: 'Whisked green tea with steamed milk' },
      { name: 'Carrot Cake', rating: 4.7, price: 2, description: 'Moist carrot cake with cream cheese frosting' }
    ]
  },
  'La Pasta Fresca': {
    type: 'Italian',
    items: [
      { name: 'Spaghetti Carbonara', rating: 4.8, price: 4, description: 'Creamy sauce with guanciale, egg yolk and pecorino cheese' },
      { name: 'Fettuccine Alfredo', rating: 4.7, price: 4, description: 'Wide ribbon pasta with butter and parmesan cream' },
      { name: 'Penne Arrabbiata', rating: 4.6, price: 3, description: 'Spicy tomato sauce with red peppers and garlic' },
      { name: 'Risotto Ai Funghi', rating: 4.7, price: 4, description: 'Creamy rice with wild mushrooms and truffle oil' },
      { name: 'Lasagna Bolognese', rating: 4.9, price: 4, description: 'Layers of pasta, meat sauce and béchamel' },
      { name: 'Ravioli di Ricotta', rating: 4.7, price: 4, description: 'Cheese-filled pasta with sage butter sauce' },
      { name: 'Margherita Pizza', rating: 4.8, price: 3, description: 'San Marzano tomatoes, fresh mozzarella and basil' },
      { name: 'Quattro Formaggi Pizza', rating: 4.6, price: 3, description: 'Four cheese blend pizza' },
      { name: 'Osso Buco', rating: 4.8, price: 5, description: 'Braised veal shank with vegetables' },
      { name: 'Bruschetta al Pomodoro', rating: 4.5, price: 2, description: 'Toasted bread with tomatoes, garlic and basil' },
      { name: 'Calamari Fritti', rating: 4.5, price: 3, description: 'Crispy fried squid with marinara sauce' },
      { name: 'Tiramisu', rating: 4.9, price: 2, description: 'Classic Italian dessert with mascarpone and cocoa' }
    ]
  },
  'Burger Bar': {
    type: 'American',
    items: [
      { name: 'Classic Cheeseburger', rating: 4.7, price: 2, description: 'Juicy patty with melted cheddar, lettuce, tomato' },
      { name: 'Bacon Burger', rating: 4.8, price: 3, description: 'Double patty with crispy bacon and two cheeses' },
      { name: 'Mushroom Swiss Burger', rating: 4.6, price: 3, description: 'Sautéed mushrooms and Swiss cheese on beef patty' },
      { name: 'Double Patty Deluxe', rating: 4.7, price: 3, description: 'Double beef patties with all the toppings' },
      { name: 'Crispy Fried Chicken Burger', rating: 4.7, price: 2, description: 'Breaded chicken breast with special sauce' },
      { name: 'Veggie Burger', rating: 4.4, price: 2, description: 'Black bean patty with avocado and sprouts' },
      { name: 'Sweet Potato Fries', rating: 4.6, price: 2, description: 'Crispy oven-baked sweet potato fries' },
      { name: 'Onion Rings', rating: 4.5, price: 2, description: 'Beer-battered onion rings' },
      { name: 'Buffalo Wings', rating: 4.7, price: 3, description: 'Spicy wings with blue cheese dip' },
      { name: 'Homemade Milkshake', rating: 4.8, price: 2, description: 'Creamy vanilla, chocolate or strawberry shake' },
      { name: 'Grilled Cheese Sandwich', rating: 4.5, price: 1, description: 'Melted cheese on buttered bread' },
      { name: 'Mac and Cheese', rating: 4.6, price: 2, description: 'Creamy pasta with three cheese blend' }
    ]
  },
  "Hawthorne's New York Pizza": {
    type: 'Italian/Pizza',
    items: [
      { name: 'Classic New York Style Pizza', rating: 4.8, price: 3, description: 'Thin crust New York pizza with tomato sauce and mozzarella' },
      { name: 'Pepperoni Pizza', rating: 4.9, price: 3, description: 'Classic pepperoni pizza with crispy edges' },
      { name: 'Sicilian Slice', rating: 4.7, price: 3, description: 'Thick, rectangular slice with cheese and tomato' },
      { name: 'BBQ Chicken Pizza', rating: 4.6, price: 4, description: 'Grilled chicken, BBQ sauce, red onion and cilantro' },
      { name: 'Meat Lovers Pizza', rating: 4.8, price: 4, description: 'Pepperoni, sausage, ham and bacon' },
      { name: 'Vegetarian Pizza', rating: 4.5, price: 3, description: 'Fresh vegetables with mozzarella on crispy crust' },
      { name: 'White Pizza', rating: 4.6, price: 3, description: 'Ricotta, mozzarella, garlic and herbs' },
      { name: 'Four Cheese Pizza', rating: 4.7, price: 4, description: 'Mozzarella, ricotta, pecorino and gorgonzola' },
      { name: 'Garlic Knots', rating: 4.7, price: 2, description: 'Garlic-seasoned dough knots' },
      { name: 'Mozzarella Sticks', rating: 4.5, price: 2, description: 'Breaded mozzarella fried until golden' },
      { name: 'Garlic Bread', rating: 4.6, price: 2, description: 'Fresh bread with garlic and butter' },
      { name: 'Tiramisu', rating: 4.8, price: 2, description: 'Classic Italian dessert with espresso and cocoa' }
    ]
  },
  'Poppyseed Kitchen': {
    type: 'Cafe/Brunch',
    items: [
      // Breakfast & Brunch
      { name: 'French American', rating: 4.7, price: 3, description: 'Croissant with bacon, eggs, and cheese' },
      { name: 'Biscuit & Gravy', rating: 4.6, price: 3, description: 'House-made biscuits with sausage gravy and eggs' },
      { name: 'BLT Sandwich', rating: 4.6, price: 3, description: 'Bacon, lettuce, and tomato on toasted sourdough' },
      { name: 'Ranch Hash', rating: 4.5, price: 3, description: 'Crispy potatoes with eggs and vegetables' },
      { name: 'Bird Box Chicken Sandwich', rating: 4.6, price: 3, description: 'Crispy fried chicken sandwich with special sauce' },
      { name: 'Monte Cristo Sandwich', rating: 4.7, price: 3, description: 'French toast sandwich with ham, turkey, and Swiss cheese' },
      { name: 'Sweet Toast', rating: 4.5, price: 3, description: 'Brioche toast with seasonal sweet toppings' },
      { name: 'Savory Toast', rating: 4.6, price: 3, description: 'Artisan toast with smoked salmon and cream cheese' },
      { name: 'Breakfast Pastries', rating: 4.6, price: 2, description: 'Seasonal pastries like apple pie croissant or pumpkin muffin' },
      
      // Coffee & Beverages
      { name: 'Fresh Brewed Coffee', rating: 4.5, price: 2, description: 'House-roasted coffee, hot or iced' },
      { name: 'Specialty Lattes', rating: 4.6, price: 2, description: 'Handcrafted lattes with seasonal flavors' },
      { name: 'Espresso Drinks', rating: 4.5, price: 2, description: 'Espresso, cappuccino, and americano' },
      { name: 'Iced Coffee & Cold Brew', rating: 4.6, price: 2, description: 'Smooth cold brew and iced coffee' },
      
      // Pastries & Baked Goods
      { name: 'Cinnamon Rolls', rating: 4.8, price: 2, description: 'House-made cinnamon rolls with cream cheese frosting' },
      { name: 'Croissants', rating: 4.7, price: 2, description: 'Buttery croissants, plain or filled with chocolate or almond' },
      { name: 'Muffins', rating: 4.5, price: 2, description: 'Seasonal flavored muffins baked fresh daily' },
      { name: 'Scones & Sweet Bars', rating: 4.5, price: 2, description: 'Fruit scones and seasonal sweet bars' },
      
      // Lunch & Light Fare
      { name: 'Caesar Salad', rating: 4.5, price: 3, description: 'Crisp romaine with parmesan, croutons, and Caesar dressing' },
      { name: 'House Salads', rating: 4.4, price: 3, description: 'Fresh mixed greens with seasonal vegetables and vinaigrette' },
      { name: 'Chicken Sandwich', rating: 4.5, price: 3, description: 'Grilled or fried chicken on brioche with toppings' },
      { name: 'Croissant Sandwich', rating: 4.6, price: 3, description: 'Flaky croissant with choice of fillings' }
    ]
  },
  "Salmeri's Italian Kitchen": {
    type: 'Italian',
    items: [
      // Appetizers
      { name: 'Crab and Artichoke Dip', rating: 4.7, price: 3, description: 'Four cheeses, olive oil crumbs, basil pesto, toasted focaccia' },
      { name: 'Flash Fried Semolina Crusted Calamari', rating: 4.6, price: 3, description: 'Pepperoncini, fresh basil, garlic, lemon butter, tomato sauce' },
      { name: 'Crispy Arancini', rating: 4.5, price: 3, description: 'Fried risotto, parmesan, pesto, mozzarella, house gravy, basil' },
      { name: 'Fig and Goat Cheese Flatbread', rating: 4.5, price: 2, description: 'Caramelized onion, prosciutto, arugula, olive oil, balsamic' },
      { name: 'Roasted Cauliflower', rating: 4.4, price: 2, description: 'Marinated, parmesan crust, olive oil crumbs' },
      { name: 'Pepperoni Pull Apart Bread', rating: 4.6, price: 3, description: 'Ricotta, mozzarella, basil, garlic oil, pepperoni sauce' },
      { name: "Salmeri's Meatballs and Polenta", rating: 4.7, price: 2, description: 'Parmesan polenta, fresh basil, house gravy' },
      { name: 'Fried Mozzarella', rating: 4.5, price: 2, description: 'House sauce, parmesan, pesto' },
      { name: 'Warm Olives', rating: 4.2, price: 1, description: 'Orange zest, fennel seed, garlic, thyme, olive oil' },
      { name: 'Meat & Cheese Board (Small)', rating: 4.8, price: 3, description: 'Italian meats and cheeses, olives, jam, candied nuts, crostini' },
      { name: 'Meat & Cheese Board (Large)', rating: 4.8, price: 4, description: 'Italian meats and cheeses, olives, jam, candied nuts, crostini' },
      // Pizzas
      { name: 'Cheese and Tomato Pizza', rating: 4.6, price: 3, description: 'Oregano, fresh mozzarella, sauce, olive oil' },
      { name: 'House Meatball and Ricotta Pizza', rating: 4.7, price: 3, description: 'Caramelized onions, roasted peppers, sauce, basil, mozzarella' },
      { name: 'Margherita Pizza', rating: 4.8, price: 3, description: 'Fresh mozzarella, basil, parmesan, tomato sauce' },
      { name: 'Our Pepperoni Pizza', rating: 4.7, price: 3, description: 'Artisan pepperoni, pepperoni sauce, fresh mozzarella, ricotta, basil' },
      { name: 'Mushroom and Truffle Pizza', rating: 4.7, price: 3, description: 'Caramelized onions, provolone, mozzarella, arugula, herbs' },
      { name: 'Artichoke and Goat Cheese Pizza', rating: 4.6, price: 3, description: 'Prosciutto, smoked goat cheese, spinach, caramelized onions' },
      // Soups & Salads
      { name: 'Baby Mixed Green Salad', rating: 4.4, price: 2, description: 'Shaved veggies, Point Reyes toma, marcona almonds, white balsamic vinaigrette' },
      { name: "Salmeri's Caesar", rating: 4.5, price: 2, description: 'Parmesan frico, lemony caesar, rosemary focaccia croutons' },
      { name: "Salmeri's Caprese", rating: 4.6, price: 2, description: 'Heirloom tomatoes, basil, fresh mozzarella, olive oil, balsamic syrup, ciabatta crumbs' },
      { name: 'Strawberry and Burrata Salad', rating: 4.6, price: 3, description: 'Pistachio, arugula, pickled onion, olive oil, ciabatta, basil' },
      { name: 'Chopped Salad', rating: 4.4, price: 2, description: 'Tomatoes, olives, pepperoncini, bacon, crispy cannellini beans, citrus vinaigrette' },
      { name: 'Italian Wedding Soup', rating: 4.3, price: 2, description: 'Spinach, fennel sausage, acini de pepe, parmesan' },
      { name: 'Tuscan Tomato Bisque', rating: 4.4, price: 2, description: 'Grilled cheese croutons, crystallized basil' },
      { name: 'Roasted Beets & Burrata Salad', rating: 4.5, price: 3, description: 'Golden beets, burrata, arugula, citrus vinaigrette, sourdough' },
      // Pastas
      { name: 'Lobster & Shrimp Ravioli', rating: 4.8, price: 4, description: 'Spinach, roasted tomatoes, asparagus, vodka tarragon pink sauce, olive oil crumbs' },
      { name: "Dylan's Chicken Alfredo", rating: 4.6, price: 3, description: 'Parmesan crusted fried chicken, broccolini, bucatini, aged parmesan' },
      { name: 'Chicken Parmesan Pasta', rating: 4.7, price: 4, description: 'Parmesan crusted chicken, house gravy, mozzarella, bucatini alfredo' },
      { name: 'Cajun Shrimp Fettuccine', rating: 4.6, price: 3, description: 'Roasted mushrooms, spinach, red pepper alfredo' },
      { name: "Jason's Baked Pasta", rating: 4.5, price: 3, description: 'Campanelle, mozzarella, provolone, ricotta, fennel sausage, house gravy' },
      { name: "Brennan's Bolognese", rating: 4.7, price: 4, description: 'Meatballs, fennel sausage, short ribs, pappardelle, pesto' },
      { name: 'Pumpkin Ravioli', rating: 4.6, price: 3, description: 'Butternut squash purée, spinach, pistachio, sage butter sauce' },
      { name: 'Tortellini Primavera', rating: 4.5, price: 3, description: 'Ricotta blend, mushrooms, roasted peppers, broccolini, parmesan cream' },
      { name: 'Urban Gourmet Farms Mushroom Ravioli', rating: 4.5, price: 3, description: 'Tasso ham, oven-roasted peppers, basil, garlic cream' },
      { name: 'Chicken Carbonara', rating: 4.6, price: 3, description: 'Campanelle, smoked bacon, parmesan cream, grilled chicken, spinach' },
      { name: 'Pesto Salmon Pasta', rating: 4.7, price: 4, description: 'Campanelle, blistered tomatoes, spinach, fire-roasted corn, garlic breadcrumbs' },
      { name: 'Simple Pasta', rating: 4.2, price: 2, description: 'Choice of sauce and pasta; add chicken, meatballs, shrimp, or salmon' },
      // Sandwiches
      { name: "Beth's Bolognese Sloppy Joe", rating: 4.5, price: 3, description: 'Meatballs, sausage, short ribs, mozzarella, fontina, roasted peppers; rosemary fries' },
      { name: "Salmeri's Chicken Parmesan Sandwich", rating: 4.6, price: 3, description: 'Pesto, fresh mozzarella, sauce, lemony arugula, ciabatta; rosemary fries' },
      { name: "Salmeri's Burger", rating: 4.5, price: 3, description: 'Mozzarella, provolone, bacon, basil mayo, pickled onions; rosemary fries' },
      { name: 'Meatball Parmesan Sandwich', rating: 4.6, price: 3, description: 'Beef and pork meatballs, fresh mozzarella, tomato sauce, hoagie roll; rosemary fries' },
      { name: 'Eggplant Sandwich', rating: 4.4, price: 3, description: 'Breaded eggplant, mozzarella, marinara, arugula on ciabatta; rosemary fries' },
      // Entrees
      { name: 'Chianti Braised Beef Short Ribs', rating: 4.8, price: 4, description: 'Marsala glazed mushrooms, polenta, broccolini, beef sauce' },
      { name: 'Grilled Cold Water Salmon', rating: 4.6, price: 4, description: 'Roasted red potatoes, charred corn, bacon, spinach, tomato butter' },
      { name: "Salmeri's Shrimp Scampi", rating: 4.6, price: 3, description: 'Cacio e pepe risotto, asparagus, roasted garlic, smoked tomato butter' },
      { name: 'Eggplant Parmesan', rating: 4.5, price: 3, description: 'Bucatini, mozzarella, parmesan, marinara, crispy basil, pesto' },
      // Kids Menu
      { name: 'Kids Chicken Fingers & Fries', rating: 4.4, price: 1, description: 'Crispy chicken tenders with french fries' },
      { name: 'Kids Alfredo', rating: 4.3, price: 2, description: 'Pasta with alfredo sauce, plain or with chicken/shrimp' },
      { name: 'Kids Cheeseburger & Fries', rating: 4.4, price: 2, description: 'Small cheeseburger with fries' },
      { name: 'Kids Hamburger & Fries', rating: 4.4, price: 2, description: 'Small hamburger with fries' },
      { name: 'Kids Cheese Pizza', rating: 4.5, price: 1, description: 'Personal cheese or pepperoni pizza' },
      { name: 'Kids Pepperoni Pizza', rating: 4.5, price: 1, description: 'Personal pepperoni pizza' },
      { name: 'Kids Spaghetti & Meatballs', rating: 4.4, price: 2, description: 'Spaghetti with house-made meatballs and sauce' },
      { name: "Olive's Noodles & Cheese", rating: 4.3, price: 1, description: 'Simple buttered noodles with parmesan' }
    ]
  }

  , 'FM (Fortes Mill) Eatery': {
    type: 'American/Southern',
    items: [
      { name: 'Smoked Pimento Cheese Dip', rating: 4.4, price: 2, description: 'House pimento cheese, warm pita chips' },
      { name: 'Lowcountry Shrimp and Grits', rating: 4.7, price: 4, description: 'Stone-ground grits, tasso ham, scallions, pan sauce' },
      { name: 'Fort Mill Hot Chicken Sandwich', rating: 4.6, price: 3, description: 'Crispy chicken, house hot oil, pickles, brioche bun' },
      { name: 'Blackened Salmon BLT', rating: 4.5, price: 3, description: 'Applewood bacon, tomato jam, lemon aioli, toasted sourdough' },
      { name: 'Smokehouse Brisket Plate', rating: 4.6, price: 4, description: '12-hour brisket, Carolina gold sauce, pickled onions, two sides' },
      { name: 'Buttermilk Fried Pork Chop', rating: 4.5, price: 3, description: 'White pepper gravy, charred green beans, mashed potatoes' },
      { name: 'Summer Peach Salad', rating: 4.4, price: 2, description: 'Local greens, pecans, goat cheese, sorghum vinaigrette' },
      { name: 'Crispy Brussels', rating: 4.5, price: 2, description: 'Bacon, bourbon maple glaze' },
      { name: 'Smoked Wings (8)', rating: 4.6, price: 3, description: 'Dry rub, Alabama white sauce' },
      { name: 'Banana Pudding Jar', rating: 4.7, price: 2, description: 'Vanilla wafers, whipped cream, brûléed bananas' },
      { name: 'Cast Iron Mac and Cheese', rating: 4.5, price: 2, description: 'Sharp cheddar, toasted crumbs' },
      { name: 'House Pickles and Relish', rating: 4.3, price: 1, description: 'Seasonal pickled vegetables' }
    ]
  }

  , 'Firebirds Wood Fired Grill': {
    type: 'Steakhouse/American',
    items: [
      // Starters & Shareables
      { name: 'Lobster Spinach Queso', rating: 4.6, price: 3, description: 'Lobster, spinach, pepper jack cheese, tortilla chips' },
      { name: 'Bacon Deviled Eggs', rating: 4.6, price: 2, description: 'Housemade candied bacon' },
      { name: 'Ranch Rings', rating: 4.5, price: 2, description: 'Breaded onions, roasted garlic ranch' },
      { name: 'Philly Cheesesteak Egg Rolls', rating: 4.5, price: 3, description: 'Thai chili and hot mustard dipping sauces' },
      { name: 'Smoked Chicken Wings', rating: 4.6, price: 3, description: 'Buffalo hot sauce, celery, roasted garlic ranch or bleu cheese' },
      { name: 'Seared Ahi Tuna', rating: 4.7, price: 4, description: 'Sushi-grade tuna, sriracha aioli, cilantro citrus slaw' },
      { name: 'Wood Grilled Chimichurri Shrimp', rating: 4.6, price: 4, description: 'Goat cheese, charred corn salsa' },
      
      // Handhelds & Burgers
      { name: 'Firebirds Durango Burger', rating: 4.6, price: 3, description: 'Chile-spiced, pepper jack, crispy onions, roasted garlic ranch' },
      { name: 'Cheeseburger', rating: 4.5, price: 3, description: 'Cheddar, lettuce, tomato, onion' },
      { name: 'Smokehouse Burger', rating: 4.6, price: 3, description: 'Java BBQ sauce, bacon, smoked cheddar, red onion' },
      { name: 'Hot Honey Chicken Sandwich', rating: 4.6, price: 3, description: 'Crispy chicken, hot honey, bacon, pepper jack, jalapeño mayo' },
      
      // Steaks & Meat Entrees
      { name: 'Filet Mignon', rating: 4.8, price: 5, description: 'Wood-grilled tenderloin with signature seasoning' },
      { name: 'Bleu Cheese Filet', rating: 4.8, price: 5, description: 'Filet mignon with bleu cheese and mushrooms' },
      { name: 'Aged Ribeye', rating: 4.8, price: 5, description: 'Prime aged wood-grilled ribeye' },
      { name: 'Roasted Garlic Sirloin', rating: 4.6, price: 4, description: 'Wood-grilled sirloin with roasted garlic butter' },
      { name: 'Cajun Ribeye', rating: 4.7, price: 5, description: 'Cajun-spiced wood-grilled ribeye' },
      { name: 'Wood Grilled NY Strip', rating: 4.7, price: 5, description: 'New York strip steak with wood-fired flavor' },
      { name: 'Filet & Shrimp', rating: 4.8, price: 5, description: 'Filet mignon paired with grilled shrimp' },
      { name: 'Surf & Turf', rating: 4.9, price: 5, description: 'Steak and lobster tail combination' },
      { name: 'Slow Roast Prime Rib', rating: 4.8, price: 5, description: 'Saturday and Sunday only, slow-roasted prime rib' },
      
      // Seafood
      { name: 'Wood Grilled Salmon', rating: 4.7, price: 4, description: 'Fresh salmon with key lime butter' },
      { name: 'Lobster Fondue Salmon', rating: 4.7, price: 4, description: 'Wood-grilled salmon with lobster fondue' },
      { name: 'Baja Shrimp Pasta', rating: 4.6, price: 4, description: 'Shrimp pasta with Baja-inspired flavors' },
      { name: 'Chilean Sea Bass', rating: 4.8, price: 5, description: 'Fresh seasonal preparation with vegetables' },
      
      // Chicken, Ribs & Other Entrees
      { name: 'Honey Garlic Chicken', rating: 4.6, price: 3, description: 'Grilled chicken with honey garlic glaze and seasonal veggies' },
      { name: 'Firebirds Roasted Chicken', rating: 4.6, price: 4, description: 'Citrus honey roasted chicken' },
      { name: 'Caprese Chicken Pasta', rating: 4.6, price: 4, description: 'Tomatoes, basil, mozzarella in balsamic cream' },
      { name: 'Firebirds Chicken Pasta', rating: 4.6, price: 4, description: 'Asiago cream with bacon and tomatoes' },
      { name: 'Baby Back Ribs', rating: 4.7, price: 4, description: 'Full rack with java BBQ sauce' },
      { name: 'Tomahawk Pork Chop', rating: 4.7, price: 4, description: 'Sticky hot honey, pico de gallo, charred carrots' },
      
      // Signature Salads
      { name: 'Colorado Chicken Salad', rating: 4.6, price: 3, description: 'Mixed greens, grilled chicken, bleu cheese, candied pecans' },
      { name: 'Grilled Tenderloin Salad', rating: 4.7, price: 4, description: 'Tenderloin over mixed greens with toppings' },
      { name: 'Ahi Tuna Superfoods Salad', rating: 4.7, price: 4, description: 'Seared ahi tuna with superfood greens' },
      { name: 'Grilled Salmon Salad', rating: 4.6, price: 4, description: 'Fresh grilled salmon over mixed greens' },
      { name: 'Spinach & Salmon Salad', rating: 4.6, price: 4, description: 'Baby spinach with grilled salmon' },
      { name: 'Grilled Shrimp & Strawberry Salad', rating: 4.6, price: 4, description: 'Grilled shrimp with fresh strawberries and greens' },
      
      // Classic Salads
      { name: 'Mixed Greens', rating: 4.4, price: 2, description: 'Fresh mixed greens with housemade dressing' },
      { name: 'BLT Salad', rating: 4.5, price: 3, description: 'Bacon, lettuce, tomato salad' },
      { name: 'Caesar Salad', rating: 4.5, price: 3, description: 'Classic Caesar with housemade dressing' },
      
      // Sides
      { name: 'Broccoli', rating: 4.4, price: 2, description: 'Fresh steamed broccoli' },
      { name: 'Loaded Baked Potato', rating: 4.5, price: 2, description: 'Loaded with butter, sour cream, cheese, bacon' },
      { name: 'Southwest Au Gratin Potatoes', rating: 4.6, price: 2, description: 'Creamy au gratin with southwest spices' },
      { name: 'Parmesan Mashed Potatoes', rating: 4.5, price: 2, description: 'Creamy mashed potatoes with parmesan' },
      { name: 'Seasoned Steak Fries', rating: 4.5, price: 2, description: 'Thick-cut seasoned fries' },
      { name: 'Tater Tots', rating: 4.4, price: 2, description: 'Crispy golden tater tots' },
      { name: 'Cider Slaw', rating: 4.3, price: 2, description: 'Apple cider coleslaw' },
      { name: 'Portabella Mushrooms', rating: 4.5, price: 2, description: 'Grilled portabella mushrooms' },
      { name: 'Fresh Fruit', rating: 4.3, price: 2, description: 'Seasonal fresh fruit' },
      { name: 'Grilled Street Corn', rating: 4.6, price: 2, description: 'Charred corn with Mexican spices' },
      { name: 'Charred Carrots', rating: 4.4, price: 2, description: 'Wood-fired charred carrots' },
      { name: 'Seasonal Grain Pilaf', rating: 4.4, price: 2, description: 'Seasonal grain medley' },
      
      // Desserts
      { name: 'Crème Brûlée Cheesecake', rating: 4.8, price: 3, description: 'Cheesecake with caramelized sugar topping' },
      { name: 'Chocolate Brownie Sundae', rating: 4.7, price: 3, description: 'Warm brownie with ice cream' },
      { name: 'Big Daddy Chocolate Cake', rating: 4.7, price: 3, description: 'Rich chocolate layer cake' },
      { name: 'Carrot Cake', rating: 4.8, price: 3, description: 'Layered carrot cake with cream cheese frosting' },
      { name: '5-Layer Lemon Cake', rating: 4.7, price: 3, description: 'Light lemon cake with layers' },
      
      // Cocktails & Drinks
      { name: 'Double Black Diamond Martini', rating: 4.6, price: 3, description: 'Signature martini' },
      { name: 'Lemonade Drop', rating: 4.5, price: 3, description: 'Refreshing lemonade cocktail' },
      { name: 'Firebirds Perfect Margarita', rating: 4.6, price: 3, description: 'Classic margarita' },
      { name: 'Moscow Mule', rating: 4.5, price: 3, description: 'Vodka, ginger beer, lime' },
      { name: 'Dirty Bird', rating: 4.5, price: 3, description: 'Signature cocktail' },
      { name: 'Siesta Sangria', rating: 4.6, price: 3, description: 'Red wine sangria' },
      { name: 'Charred Pineapple Agua Fresca', rating: 4.4, price: 2, description: 'Non-alcoholic charred pineapple drink' },
      { name: 'Main Squeeze', rating: 4.3, price: 2, description: 'Non-alcoholic citrus drink' },
      { name: 'Mint Condition', rating: 4.4, price: 2, description: 'Non-alcoholic mint drink' }
    ]
  }

  , 'The Improper Pig': {
    type: 'BBQ',
    items: [
      // BBQ Plates
      { name: 'Pulled Pork Plate', rating: 4.6, price: 3, description: 'Slow-smoked pulled pork with two sides' },
      { name: 'Brisket Plate', rating: 4.7, price: 4, description: 'Smoked beef brisket with two sides' },
      { name: 'St. Louis Rib Plate', rating: 4.7, price: 4, description: 'St. Louis style ribs with two sides' },
      { name: 'Half Chicken Plate', rating: 4.6, price: 3, description: 'Smoked half chicken with two sides' },
      
      // Sandwiches
      { name: 'Pulled Pork Sandwich', rating: 4.6, price: 3, description: 'Tender pulled pork on a bun with pickles' },
      { name: 'Brisket Sandwich', rating: 4.6, price: 3, description: 'Sliced brisket on a bun with BBQ sauce' },
      { name: 'Fried Chicken Sandwich', rating: 4.5, price: 3, description: 'Crispy fried chicken breast with toppings' },
      
      // Tacos
      { name: 'Pork Tacos', rating: 4.5, price: 3, description: 'Pulled pork tacos with slaw and sauce' },
      { name: 'Brisket Tacos', rating: 4.6, price: 3, description: 'Smoked brisket tacos with toppings' },
      { name: 'Shrimp Tacos', rating: 4.5, price: 3, description: 'Grilled or fried shrimp tacos' },
      
      // Burgers
      { name: 'Improper Pig Burger', rating: 4.6, price: 3, description: 'House burger with signature toppings' },
      { name: 'Pimento Cheese Burger', rating: 4.6, price: 3, description: 'Burger topped with house pimento cheese' },
      
      // Salads
      { name: 'House Salad', rating: 4.3, price: 2, description: 'Fresh mixed greens with vegetables' },
      { name: 'Caesar Salad', rating: 4.4, price: 2, description: 'Classic Caesar with romaine and parmesan' },
      
      // Sides
      { name: 'Mac & Cheese', rating: 4.6, price: 2, description: 'Creamy homemade mac and cheese' },
      { name: 'Baked Beans', rating: 4.5, price: 2, description: 'Sweet and savory baked beans' },
      { name: 'French Fries', rating: 4.4, price: 2, description: 'Crispy golden french fries' },
      { name: 'Collard Greens', rating: 4.5, price: 2, description: 'Southern-style collard greens' },
      { name: 'Potato Salad', rating: 4.4, price: 2, description: 'Creamy potato salad' },
      { name: 'Cole Slaw', rating: 4.4, price: 2, description: 'Fresh coleslaw' },
      
      // Desserts
      { name: 'Banana Pudding', rating: 4.7, price: 2, description: 'Classic Southern banana pudding with vanilla wafers' },
      { name: 'Seasonal Cobbler', rating: 4.6, price: 2, description: 'Fresh fruit cobbler with seasonal flavors' }
    ]
  }

  , 'Fort Mill Family Restaurant': {
    type: 'Diner/Breakfast',
    items: [
      // Breakfast
      { name: 'Hearty Omelettes', rating: 4.5, price: 2, description: 'Various styles with veggies, cheese, and meats' },
      { name: 'Pancakes', rating: 4.5, price: 2, description: 'Fluffy pancakes with butter and syrup' },
      { name: 'Apple Cinnamon Pancakes', rating: 4.6, price: 2, description: 'Pancakes with apple cinnamon topping' },
      { name: 'Waffles', rating: 4.5, price: 2, description: 'Belgian waffles with toppings' },
      { name: 'Biscuits & Gravy', rating: 4.6, price: 2, description: 'Homemade biscuits with sausage gravy' },
      { name: 'Breakfast Sandwiches', rating: 4.4, price: 2, description: 'Egg, cheese, and meat on choice of bread' },
      { name: 'Eggs Any Style', rating: 4.4, price: 2, description: 'Prepared your way with toast and sides' },
      
      // Lunch & Homestyle Favorites
      { name: 'Fort Mill Burger', rating: 4.5, price: 2, description: 'Classic diner-style burger with toppings' },
      { name: 'Hamburger Steak', rating: 4.5, price: 3, description: 'Ground beef patty with gravy and onions' },
      { name: 'Chicken Parmigiana', rating: 4.5, price: 3, description: 'Breaded chicken with marinara and cheese' },
      { name: 'Beef Tips with Gravy', rating: 4.5, price: 3, description: 'Tender beef tips in brown gravy' },
      { name: 'Country Style Steak', rating: 4.4, price: 3, description: 'Breaded steak with country gravy' },
      { name: 'Fried Chicken', rating: 4.6, price: 3, description: 'Crispy home-style fried chicken' },
      { name: 'Taco Salad', rating: 4.4, price: 3, description: 'Seasoned beef with lettuce, cheese, and toppings' },
      { name: 'Cold Salad Plate with Tuna', rating: 4.3, price: 2, description: 'Tuna salad with vegetables' },
      { name: 'Meatloaf', rating: 4.5, price: 3, description: 'Homemade meatloaf with gravy' },
      { name: 'Stroganoff', rating: 4.4, price: 3, description: 'Beef stroganoff over noodles' },
      
      // Sides
      { name: 'Home Fries', rating: 4.4, price: 1, description: 'Crispy seasoned potatoes' },
      { name: 'Collard Greens', rating: 4.4, price: 1, description: 'Southern-style collard greens' },
      { name: 'Mashed Potatoes', rating: 4.4, price: 1, description: 'Creamy mashed potatoes' },
      { name: 'Gravy', rating: 4.3, price: 1, description: 'Brown or sausage gravy' },
      
      // Desserts
      { name: 'House Made Desserts', rating: 4.5, price: 2, description: 'Rotating selection of pies and cakes' }
    ]
  }

  , 'Blue Bar & Smokehouse': {
    type: 'BBQ',
    items: [
      { name: 'St. Louis Cut Ribs (Half Rack)', rating: 4.6, price: 4, description: 'Hickory smoked, bourbon BBQ glaze' },
      { name: 'Pulled Pork Platter', rating: 4.5, price: 3, description: '12-hour smoked pork, vinegar slaw, hushpuppies' },
      { name: 'Burnt Ends', rating: 4.6, price: 4, description: 'Sweet and smoky brisket tips' },
      { name: 'Smoked Turkey Plate', rating: 4.4, price: 3, description: 'White barbecue sauce, pickles, white bread' },
      { name: 'Carolina Gold Wings', rating: 4.5, price: 3, description: 'Mustard BBQ glaze, ranch' },
      { name: 'Brisket Chili', rating: 4.5, price: 2, description: 'Smoked brisket, beans, cheddar, green onion' },
      { name: 'BBQ Sundae', rating: 4.4, price: 2, description: 'Layers of pulled pork, slaw, baked beans' },
      { name: 'Fried Pickles', rating: 4.4, price: 2, description: 'Comeback sauce' },
      { name: 'Jalapeno Cheddar Cornbread', rating: 4.6, price: 2, description: 'Honey butter on the side' },
      { name: 'Banana Pudding', rating: 4.7, price: 2, description: 'Vanilla wafers, whipped cream' },
      { name: 'Mac and Cheese', rating: 4.5, price: 2, description: 'Smoked cheddar, breadcrumb crust' },
      { name: 'Collard Greens', rating: 4.4, price: 2, description: 'Bacon, apple cider vinegar' }
    ]
  }

  , 'Konnichiwa': {
    type: 'Japanese/Sushi',
    items: [
      // Popular Sushi Rolls
      { name: 'California Roll', rating: 4.5, price: 3, description: 'Crab, avocado, cucumber' },
      { name: 'Spicy Tuna Roll', rating: 4.6, price: 3, description: 'Fresh tuna, spicy mayo, scallions' },
      { name: 'Spicy Salmon Roll', rating: 4.6, price: 3, description: 'Fresh salmon with spicy mayo' },
      { name: 'Shrimp Tempura Roll', rating: 4.6, price: 3, description: 'Crispy shrimp, avocado, eel sauce' },
      { name: 'Chicken Tempura Roll', rating: 4.5, price: 3, description: 'Crispy chicken with tempura coating' },
      { name: 'Rainbow Roll', rating: 4.7, price: 4, description: 'California roll topped with assorted fish' },
      { name: 'Dragon Roll', rating: 4.7, price: 4, description: 'Eel, cucumber, avocado on top' },
      { name: 'Spider Roll', rating: 4.6, price: 4, description: 'Soft shell crab tempura roll' },
      { name: 'Volcano Roll', rating: 4.6, price: 4, description: 'Baked spicy seafood on California roll' },
      { name: 'Philadelphia Roll', rating: 4.5, price: 3, description: 'Salmon, cream cheese, cucumber' },
      
      // Specialty Rolls
      { name: 'Panther Roll', rating: 4.6, price: 4, description: 'Specialty Carolina-inspired roll' },
      { name: 'Gamecocks Roll', rating: 4.6, price: 4, description: 'Signature South Carolina roll' },
      { name: 'Tiger Clemson Roll', rating: 4.7, price: 4, description: 'Premium specialty roll' },
      { name: 'Lobster Tempura Roll', rating: 4.8, price: 5, description: 'Tempura lobster with special sauce' },
      { name: 'Filet Mignon Roll', rating: 4.7, price: 4, description: 'Seared beef with special toppings' },
      { name: 'Atomic Bomb Roll', rating: 4.6, price: 4, description: 'Spicy specialty roll' },
      { name: 'Sleeping Beauty Roll', rating: 4.7, price: 4, description: 'Premium specialty creation' },
      
      // Basic Rolls
      { name: 'Tuna Roll', rating: 4.5, price: 3, description: 'Fresh tuna maki' },
      { name: 'Salmon Roll', rating: 4.5, price: 3, description: 'Fresh salmon maki' },
      { name: 'Yellowtail Roll', rating: 4.6, price: 3, description: 'Fresh yellowtail maki' },
      { name: 'Veggie Roll', rating: 4.3, price: 2, description: 'Assorted vegetable roll' },
      
      // Ramen & Bowls
      { name: 'Pork Tonkotsu Ramen', rating: 4.7, price: 3, description: 'Creamy broth, chashu pork, soft egg, nori' },
      { name: 'Spicy Miso Ramen', rating: 4.6, price: 3, description: 'Ground pork, chili paste, corn, scallions' },
      { name: 'Sesame Chicken Bowl', rating: 4.5, price: 3, description: 'Glazed chicken over rice with vegetables' },
      { name: 'Hibachi Rice Bowl', rating: 4.5, price: 3, description: 'Choice of protein with hibachi vegetables and rice' },
      
      // Appetizers
      { name: 'Miso Soup', rating: 4.4, price: 1, description: 'Traditional soybean soup' },
      { name: 'Edamame', rating: 4.5, price: 2, description: 'Steamed soybeans with sea salt' },
      { name: 'Gyoza', rating: 4.5, price: 2, description: 'Pan-fried pork dumplings with citrus soy' },
      { name: 'Crab Rangoon', rating: 4.4, price: 2, description: 'Crispy wonton with cream cheese and crab' },
      { name: 'Spring Rolls', rating: 4.4, price: 2, description: 'Crispy vegetable spring rolls' },
      { name: 'Seaweed Salad', rating: 4.4, price: 2, description: 'Sesame dressing, mixed seaweed' },
      
      // Bento Boxes
      { name: 'Teriyaki Chicken Bento', rating: 4.6, price: 3, description: 'Teriyaki chicken with rice and sides' },
      { name: 'Filet Mignon Bento', rating: 4.7, price: 4, description: 'Grilled filet with rice and sides' },
      { name: 'Sushi Bento', rating: 4.6, price: 4, description: 'Assorted rolls with rice and sides' },
      
      // Sides & Extras
      { name: 'Steamed Rice', rating: 4.3, price: 1, description: 'White or brown rice' },
      { name: 'Fried Rice', rating: 4.4, price: 2, description: 'Vegetable fried rice' },
      { name: 'Tempura Vegetables', rating: 4.4, price: 2, description: 'Lightly battered vegetables' },
      
      // Desserts
      { name: 'Mochi Ice Cream', rating: 4.6, price: 2, description: 'Japanese rice cake with ice cream' }
    ]
  }

  , 'Spice Asian Kitchen': {
    type: 'Asian',
    items: [
      // Appetizers
      { name: 'Edamame', rating: 4.5, price: 2, description: 'Steamed soybeans with sea salt' },
      { name: 'Pork & Chive Dumplings', rating: 4.6, price: 2, description: 'Pan-fried pork dumplings' },
      { name: 'Chicken Potstickers', rating: 4.5, price: 2, description: 'Chicken-filled potstickers' },
      { name: 'Crab Rangoon', rating: 4.5, price: 2, description: 'Cream cheese and crab in crispy wonton' },
      { name: 'Spring Rolls', rating: 4.4, price: 2, description: 'Crispy spring rolls' },
      { name: 'Vegetable Spring Rolls', rating: 4.4, price: 2, description: 'Vegetable-filled spring rolls' },
      { name: 'Salt & Pepper Calamari', rating: 4.6, price: 3, description: 'Crispy calamari with spiced salt' },
      { name: 'Korean BBQ Wings', rating: 4.6, price: 3, description: 'Wings with Korean BBQ glaze' },
      { name: 'Fried Tofu', rating: 4.4, price: 2, description: 'Crispy fried tofu' },
      { name: 'Chicken Satay', rating: 4.5, price: 3, description: 'Grilled chicken skewers with peanut sauce' },
      
      // Ramen & Noodles
      { name: 'Classic Ramen', rating: 4.6, price: 3, description: 'Choice of pork, chicken, or tofu' },
      { name: 'Spicy Miso Ramen', rating: 4.6, price: 3, description: 'Miso broth with spicy kick' },
      { name: 'Shrimp Ramen', rating: 4.6, price: 3, description: 'Ramen with shrimp' },
      { name: 'Beef & Veggie Udon', rating: 4.5, price: 3, description: 'Thick udon noodles with beef and vegetables' },
      { name: 'Dan Dan Noodles', rating: 4.6, price: 3, description: 'Spicy Sichuan-style noodles' },
      { name: 'Pad Thai', rating: 4.6, price: 3, description: 'Thai stir-fried noodles with choice of protein' },
      
      // Rice & Entrées
      { name: 'Fried Rice', rating: 4.5, price: 3, description: 'Choice of chicken, shrimp, or veggie' },
      { name: 'General Tso\'s Chicken', rating: 4.6, price: 3, description: 'Crispy chicken in sweet and spicy sauce' },
      { name: 'Sesame Chicken', rating: 4.6, price: 3, description: 'Breaded chicken with sesame sauce' },
      { name: 'Orange Chicken', rating: 4.6, price: 3, description: 'Crispy chicken with orange glaze' },
      { name: 'Sweet & Sour Pork', rating: 4.5, price: 3, description: 'Pork in sweet and sour sauce' },
      { name: 'Beef with Broccoli', rating: 4.5, price: 3, description: 'Tender beef with broccoli in brown sauce' },
      { name: 'Korean Bulgogi Bowl', rating: 4.7, price: 3, description: 'Marinated beef over rice' },
      { name: 'Teriyaki Chicken Bowl', rating: 4.5, price: 3, description: 'Grilled chicken with teriyaki glaze' },
      { name: 'Korean BBQ Beef Bowl', rating: 4.6, price: 3, description: 'BBQ beef over rice with vegetables' },
      { name: 'Tofu Stir-Fry', rating: 4.4, price: 3, description: 'Tofu with mixed vegetables' },
      
      // Salads & Sides
      { name: 'Asian Slaw', rating: 4.4, price: 2, description: 'Crispy cabbage slaw with Asian dressing' },
      { name: 'Cucumber Salad', rating: 4.4, price: 2, description: 'Fresh cucumber with vinegar dressing' },
      { name: 'Seaweed Salad', rating: 4.4, price: 2, description: 'Marinated seaweed salad' },
      { name: 'Kimchi', rating: 4.5, price: 2, description: 'Spicy fermented cabbage' },
      { name: 'Steamed Rice', rating: 4.3, price: 1, description: 'White rice' },
      { name: 'Fried Wonton Chips', rating: 4.4, price: 2, description: 'Crispy wonton chips' },
      
      // Combo Boxes
      { name: 'Teriyaki Box', rating: 4.5, price: 3, description: 'Teriyaki entrée with sides' },
      { name: 'Bulgogi Box', rating: 4.6, price: 3, description: 'Korean bulgogi with sides' },
      { name: 'Orange Chicken Box', rating: 4.6, price: 3, description: 'Orange chicken with sides' },
      { name: 'General Tso\'s Box', rating: 4.6, price: 3, description: 'General Tso\'s chicken with sides' },
      
      // Desserts
      { name: 'Mochi Ice Cream', rating: 4.5, price: 2, description: 'Japanese rice cake with ice cream' },
      { name: 'Fried Banana with Honey', rating: 4.5, price: 2, description: 'Crispy fried banana drizzled with honey' },
      
      // Drinks
      { name: 'Thai Iced Tea', rating: 4.5, price: 2, description: 'Sweet Thai tea with cream' },
      { name: 'Jasmine Tea', rating: 4.3, price: 1, description: 'Hot jasmine tea' },
      { name: 'Iced Coffee', rating: 4.4, price: 2, description: 'Vietnamese-style iced coffee' }
    ]
  }

  , 'Dilworth Grille at Baxter': {
    type: 'American',
    items: [
      { name: 'Spinach and Artichoke Dip', rating: 4.4, price: 2, description: 'Served with pita and tortilla chips' },
      { name: 'Baxter Burger', rating: 4.6, price: 3, description: '8oz patty, cheddar, tomato jam, brioche bun' },
      { name: 'Grilled Mahi Tacos', rating: 4.5, price: 3, description: 'Cabbage slaw, chipotle crema, lime' },
      { name: 'Chicken Tenders Basket', rating: 4.4, price: 2, description: 'Hand-breaded tenders, choice of sauce, fries' },
      { name: 'Cajun Shrimp Pasta', rating: 4.5, price: 3, description: 'Creamy Cajun sauce, peppers, penne' },
      { name: 'Southwest Chicken Salad', rating: 4.4, price: 3, description: 'Black beans, roasted corn, avocado, tortilla strips, chipotle ranch' },
      { name: 'BBQ Bacon Cheddar Chicken', rating: 4.5, price: 3, description: 'Char-grilled breast, BBQ sauce, applewood bacon, cheddar' },
      { name: 'Loaded Pub Fries', rating: 4.5, price: 2, description: 'Cheese, bacon, scallions, ranch' },
      { name: 'Fish and Chips', rating: 4.5, price: 3, description: 'Beer-battered haddock, fries, tartar' },
      { name: 'House Cobb Salad', rating: 4.4, price: 3, description: 'Turkey, bacon, egg, avocado, blue cheese' },
      { name: 'Honey Buffalo Wings (10)', rating: 4.5, price: 3, description: 'Served with celery and ranch' },
      { name: 'Chocolate Brownie Sundae', rating: 4.6, price: 2, description: 'Warm brownie, vanilla ice cream' }
    ]
  }

  , "Samanta's Cafe": {
    type: 'Cafe',
    items: [
      { name: 'Avocado Egg Croissant', rating: 4.5, price: 2, description: 'Flaky croissant, soft egg, avocado, tomato' },
      { name: 'Chicken Salad Sandwich', rating: 4.4, price: 2, description: 'Grapes, celery, toasted wheat bread' },
      { name: 'Turkey Pesto Panini', rating: 4.5, price: 2, description: 'Mozzarella, roasted tomato, basil pesto' },
      { name: 'Roasted Veggie Quiche', rating: 4.4, price: 2, description: 'Spinach, peppers, goat cheese' },
      { name: 'Greek Yogurt Parfait', rating: 4.4, price: 1, description: 'Berries, house granola, honey' },
      { name: 'Tomato Basil Soup', rating: 4.5, price: 1, description: 'Creamy soup with focaccia croutons' },
      { name: 'Caprese Salad', rating: 4.5, price: 2, description: 'Fresh mozzarella, tomato, basil vinaigrette' },
      { name: 'Iced Vanilla Latte', rating: 4.4, price: 2, description: 'Espresso, vanilla, cold milk' },
      { name: 'Caramel Cold Brew', rating: 4.5, price: 2, description: 'Slow brewed with caramel finish' },
      { name: 'Lemon Poppyseed Muffin', rating: 4.4, price: 1, description: 'Citrus glaze on top' },
      { name: 'Berry Smoothie', rating: 4.4, price: 2, description: 'Strawberry, blueberry, banana, almond milk' },
      { name: 'Chocolate Chip Cookie', rating: 4.5, price: 1, description: 'Baked daily' }
    ]
  }

  , 'Mr Rayo Mexican Grill': {
    type: 'Mexican',
    items: [
      // Starters & Dips
      { name: 'Cheese Dip', rating: 4.6, price: 2, description: 'Creamy queso dip with chips' },
      { name: 'Diablo Cheese Dip', rating: 4.6, price: 2, description: 'Spicy queso with jalapeños' },
      { name: 'Spinach Dip', rating: 4.5, price: 2, description: 'Creamy spinach and cheese dip' },
      { name: 'Chorizo Dip', rating: 4.6, price: 3, description: 'Queso with Mexican sausage' },
      { name: 'Fresh Guacamole', rating: 4.7, price: 3, description: 'Made-to-order guacamole' },
      { name: 'Street Corn (Elote)', rating: 4.6, price: 2, description: 'Mexican street corn with cotija cheese' },
      { name: 'Wings', rating: 4.5, price: 3, description: 'Bone-in or boneless wings' },
      { name: 'Nachos Supremos', rating: 4.6, price: 3, description: 'Loaded nachos with all toppings' },
      { name: 'Nachos Texanos', rating: 4.6, price: 4, description: 'Steak, chicken, and shrimp nachos' },
      
      // Tacos
      { name: 'Street Tacos', rating: 4.6, price: 3, description: 'Authentic tacos with various fillings' },
      { name: 'Birria Tacos', rating: 4.7, price: 4, description: 'Slow-cooked beef tacos with consommé' },
      { name: 'Fish Tacos', rating: 4.5, price: 3, description: 'Grilled or fried tilapia tacos' },
      { name: 'Shrimp Tacos', rating: 4.6, price: 4, description: 'Seasoned shrimp tacos' },
      { name: 'Tacos Gringos', rating: 4.5, price: 3, description: 'American-style tacos (3)' },
      
      // Burritos
      { name: 'Burrito California', rating: 4.6, price: 4, description: 'Large burrito with fries inside' },
      { name: 'Burrito Grande Fajitas', rating: 4.6, price: 4, description: 'Fajita-style burrito' },
      { name: 'Crazy Burrito', rating: 4.5, price: 3, description: 'Loaded with multiple fillings' },
      { name: 'Patron Burrito', rating: 4.6, price: 4, description: 'Premium burrito with top ingredients' },
      { name: 'Mexican Flag Burrito', rating: 4.6, price: 4, description: 'Three-sauce burrito' },
      { name: 'Burrito Verde', rating: 4.5, price: 3, description: 'Burrito with green tomatillo sauce' },
      
      // Quesadillas
      { name: 'Quesadilla Texana', rating: 4.6, price: 4, description: 'Steak, chicken, and shrimp quesadilla' },
      { name: 'Quesadilla Fajita', rating: 4.5, price: 3, description: 'Fajita-style quesadilla' },
      { name: 'Cheese Steak Quesadilla', rating: 4.5, price: 3, description: 'Philly-style quesadilla' },
      { name: 'Quesadilla Birria', rating: 4.7, price: 4, description: 'Birria beef quesadilla' },
      
      // Fajitas
      { name: 'Chicken Fajitas', rating: 4.6, price: 4, description: 'Sizzling chicken fajitas' },
      { name: 'Steak Fajitas', rating: 4.6, price: 4, description: 'Sizzling steak fajitas' },
      { name: 'Mixed Fajitas', rating: 4.6, price: 4, description: 'Chicken and steak combo' },
      { name: 'Fajita Texana', rating: 4.7, price: 5, description: 'Steak, chicken, and shrimp fajitas' },
      { name: 'Parrillada', rating: 4.7, price: 5, description: 'Mixed grill for sharing' },
      { name: 'Fajita Tropical', rating: 4.6, price: 4, description: 'Fajitas with pineapple' },
      
      // Grilled Meats & Entrees
      { name: 'Carne Asada', rating: 4.7, price: 4, description: 'Grilled steak with rice and beans' },
      { name: 'Steak a la Mexicana', rating: 4.6, price: 4, description: 'Steak with peppers, onions, and tomatoes' },
      { name: 'Steak Ranchero', rating: 4.6, price: 4, description: 'Steak with ranchero sauce' },
      { name: 'Chori-Steak', rating: 4.6, price: 4, description: 'Steak topped with chorizo and cheese' },
      { name: 'Carnitas', rating: 4.7, price: 4, description: 'Slow-cooked pork with sides' },
      { name: 'Pollo Asado', rating: 4.6, price: 3, description: 'Grilled chicken with sides' },
      { name: 'Pollo con Camarón', rating: 4.7, price: 4, description: 'Chicken and shrimp combo' },
      { name: 'Pollo Con Chorizo', rating: 4.6, price: 4, description: 'Chicken with chorizo and cheese sauce' },
      { name: 'Chile Verde', rating: 4.5, price: 4, description: 'Pork in green tomatillo sauce' },
      { name: 'Chile Rojo', rating: 4.5, price: 4, description: 'Pork in red chile sauce' },
      { name: 'MR Rayo Burger', rating: 4.6, price: 3, description: 'Angus burger with chorizo and egg' },
      
      // Seafood
      { name: 'Tropical Salmon Mango', rating: 4.7, price: 4, description: 'Grilled salmon with mango salsa' },
      { name: 'Camarones a la Diabla', rating: 4.6, price: 4, description: 'Spicy devil shrimp' },
      { name: 'Camarones al Mojo de Ajo', rating: 4.6, price: 4, description: 'Garlic butter shrimp' },
      { name: 'Arroz con Camarones', rating: 4.5, price: 4, description: 'Shrimp over rice with cheese sauce' },
      { name: 'Ceviche de Camaron', rating: 4.6, price: 4, description: 'Shrimp ceviche' },
      { name: 'Mojarra Frita', rating: 4.5, price: 4, description: 'Whole fried tilapia' },
      
      // House Specials
      { name: 'Taquitos', rating: 4.5, price: 3, description: 'Rolled fried tacos' },
      { name: 'Super Chimichanga', rating: 4.5, price: 3, description: 'Fried burrito with toppings' },
      { name: 'Arroz con Pollo', rating: 4.5, price: 3, description: 'Chicken over rice with cheese sauce' },
      { name: 'Arroz Texano', rating: 4.6, price: 4, description: 'Rice with steak, chicken, and shrimp' },
      { name: 'Chilaquiles', rating: 4.5, price: 3, description: 'Tortilla chips in sauce with toppings' },
      { name: 'Tamales', rating: 4.5, price: 3, description: 'Corn masa tamales' },
      
      // Kids Menu
      { name: 'Kids Cheese Quesadilla', rating: 4.4, price: 1, description: 'Small cheese quesadilla with side' },
      { name: 'Kids Chicken Fingers', rating: 4.4, price: 1, description: 'Crispy chicken fingers with fries' },
      { name: 'Kids Taco', rating: 4.4, price: 1, description: 'One taco with rice and beans' },
      { name: 'Kids Cheeseburger', rating: 4.4, price: 1, description: 'Small burger with fries' },
      
      // Sides
      { name: 'Mexican Rice', rating: 4.4, price: 1, description: 'Seasoned Mexican rice' },
      { name: 'Refried Beans', rating: 4.4, price: 1, description: 'Creamy refried beans' },
      { name: 'Black Beans', rating: 4.4, price: 1, description: 'Whole black beans' },
      { name: 'Pico de Gallo', rating: 4.5, price: 1, description: 'Fresh tomato salsa' },
      { name: 'French Fries', rating: 4.3, price: 2, description: 'Crispy fries' },
      
      // Desserts
      { name: 'Tres Leches', rating: 4.7, price: 3, description: 'Three milk cake' },
      { name: 'Flan', rating: 4.7, price: 2, description: 'Mexican custard' },
      { name: 'Fried Ice Cream', rating: 4.7, price: 3, description: 'Crispy fried ice cream' },
      { name: 'Sopapilla', rating: 4.6, price: 2, description: 'Fried dough with honey and cinnamon' },
      { name: 'Churros', rating: 4.6, price: 2, description: 'Cinnamon sugar churros' },
      { name: 'Xango', rating: 4.6, price: 3, description: 'Fried cheesecake chimichanga' },
      { name: 'Molten Chocolate Cake', rating: 4.7, price: 3, description: 'Warm chocolate cake with molten center' }
    ]
  }

  , 'Hoof & Barrel': {
    type: 'American/Burgers',
    items: [
      // Starters
      { name: 'Bread Board', rating: 4.5, price: 3, description: 'Bavarian pretzel and sliced bread with queso and pimento cheese' },
      { name: 'Chili Cheese Fries', rating: 4.6, price: 3, description: 'House chili, queso, jalapeños, and sour cream' },
      { name: 'Constrictors', rating: 4.6, price: 3, description: 'Bacon-wrapped jumbo shrimp with cocktail and spicy ranch' },
      { name: 'Cowboy Chips', rating: 4.5, price: 2, description: 'Fried pickles, banana peppers, jalapeños with ranch' },
      { name: 'Mozzarella Sticks', rating: 4.4, price: 2, description: '6 mozzarella sticks with marinara or ranch' },
      { name: 'Nacho Hungry', rating: 4.5, price: 3, description: 'Chili nachos with queso and toppings' },
      { name: 'Toadstools', rating: 4.4, price: 2, description: 'Beer-battered mushrooms' },
      { name: 'Wings', rating: 4.5, price: 3, description: '8 jumbo buffalo wings with celery and ranch or bleu cheese' },
      { name: 'Deep Fried Brussels Sprouts', rating: 4.4, price: 2, description: 'Crispy brussels with sauce' },
      
      // Burgers (served with choice of side)
      { name: 'Cougar Classic', rating: 4.5, price: 3, description: 'American cheese, lettuce, tomato, onion, and pickle' },
      { name: 'Da Phat Patty', rating: 4.7, price: 4, description: 'Double meat, American cheese, bacon, lettuce, tomato, and onion' },
      { name: 'Jalapeno Business', rating: 4.6, price: 3, description: 'Pepper jack, jalapeños, banana peppers, and spicy ranch' },
      { name: 'Makin\' Bacon', rating: 4.6, price: 3, description: 'Pimento cheese, bacon jam, and house sauce' },
      { name: 'Screaming Goat', rating: 4.6, price: 3, description: 'Goat cheese, caramelized onions, greens, onion-cran aioli' },
      { name: 'South Cackalacki', rating: 4.5, price: 3, description: 'Cheddar, chili, onion, mustard, and slaw' },
      { name: 'Sunny Pasture', rating: 4.6, price: 3, description: 'American cheese, over-easy egg, and bacon' },
      { name: 'Taylor Swiss', rating: 4.5, price: 3, description: 'Swiss cheese, bacon, and sautéed mushrooms' },
      
      // Knot Burgers & More
      { name: 'A Couple of Dogs', rating: 4.4, price: 3, description: 'Two all-beef hot dogs' },
      { name: 'A Couple Of Dogs ATW', rating: 4.5, price: 3, description: 'Two dogs all-the-way with chili, onions, and slaw' },
      { name: 'Big Boys BLT', rating: 4.4, price: 2, description: 'Bacon, lettuce, and tomato on Texas toast' },
      { name: 'Chicken Fingers', rating: 4.5, price: 3, description: '5 fried or grilled chicken fingers' },
      { name: 'Hot Chic', rating: 4.5, price: 3, description: 'Fried or grilled chicken with lettuce, tomato, and bleu cheese' },
      { name: 'Johnny\'s Pork N Bun', rating: 4.5, price: 3, description: 'BBQ pork and coleslaw on potato bun' },
      { name: 'Not-Yo Philly Chicken', rating: 4.5, price: 3, description: 'Chicken Philly with peppers, onions, and queso' },
      { name: 'Not-Yo Philly Ribeye', rating: 4.6, price: 3, description: 'Ribeye Philly with peppers, onions, and queso' },
      { name: 'Turkey Day Melt', rating: 4.5, price: 3, description: 'Turkey, Swiss, and onion-cran aioli on toast' },
      { name: 'Club Sub', rating: 4.5, price: 3, description: 'Turkey, ham, bacon, and cheese' },
      
      // Grilled Entrées (choose two sides)
      { name: 'Baseball Sirloin', rating: 4.6, price: 4, description: '8 oz grilled Angus steak' },
      { name: 'Chops O Pork', rating: 4.5, price: 4, description: '11 oz marinated pork chop' },
      { name: 'Eye O Rib', rating: 4.8, price: 5, description: '14 oz ribeye steak' },
      { name: 'Hawaiian Thunder Thighs', rating: 4.5, price: 4, description: 'Glazed chicken with pineapple' },
      { name: 'Hog Heaven', rating: 4.6, price: 3, description: '½ lb smoked BBQ pork' },
      { name: 'Johnny\'s Flank', rating: 4.6, price: 4, description: 'Marinated flank steak' },
      { name: 'Shrimp On A Stick', rating: 4.6, price: 4, description: '12 jumbo grilled shrimp' },
      { name: 'The Wicked Cod', rating: 4.5, price: 3, description: 'Beer-battered cod (2 or 3 pieces)' },
      { name: 'Shrimp Happens', rating: 4.6, price: 4, description: 'Jumbo shrimp on cheesy grits' },
      { name: 'Unfortunate Turkey', rating: 4.5, price: 4, description: '½ lb smoked turkey ends' },
      { name: 'Miss Alicia\'s Fajita', rating: 4.5, price: 4, description: 'Grilled chicken or beef with peppers, rice, avocado, and tortillas' },
      
      // Salads (add protein for extra)
      { name: 'Big Barn Salad', rating: 4.4, price: 3, description: 'Mixed greens with vegetables' },
      { name: 'Hoof Cobbler', rating: 4.5, price: 4, description: 'Chicken, avocado, egg, bacon, goat cheese' },
      { name: 'Congress Cob', rating: 4.5, price: 4, description: 'Ham, turkey, bacon, cheddar, and veggies' },
      { name: 'Hot Girl Summer', rating: 4.5, price: 4, description: 'Chicken, greens, and veggies' },
      { name: 'Philly Goat Salad', rating: 4.5, price: 4, description: 'Shaved ribeye, greens, bleu cheese' },
      { name: 'Nut Job', rating: 4.4, price: 4, description: 'Greens with craisins, walnuts, and seeds' },
      
      // Desserts
      { name: 'Brownie', rating: 4.5, price: 2, description: 'Chocolate brownie' },
      { name: 'Cookie', rating: 4.5, price: 2, description: 'Freshly baked cookie' },
      { name: 'Cup O Cream', rating: 4.4, price: 1, description: 'Vanilla ice cream' },
      { name: 'Steve\'s Fritter À la Mode', rating: 4.6, price: 2, description: 'Apple fritter with ice cream' }
    ]
  }

  , "Bossy Beulah's Ft. Mill": {
    type: 'Chicken',
    items: [
      { name: 'The Beaut Sandwich', rating: 4.7, price: 2, description: 'Buttermilk fried chicken, Duke mayo, pickles' },
      { name: 'Cheesy Beaut', rating: 4.6, price: 3, description: 'Fried chicken, American cheese, pickles' },
      { name: 'Spicy Beaut', rating: 4.6, price: 3, description: 'Hot oil drizzle, jalapeno ranch' },
      { name: 'Chicken Tenders (4)', rating: 4.5, price: 2, description: 'Hand-breaded tenders with dipping sauce' },
      { name: 'Bossy Fries', rating: 4.5, price: 2, description: 'Seasoned fries with Bossy comeback sauce' },
      { name: 'Sweet Potato Waffle Fries', rating: 4.5, price: 2, description: 'Served with cinnamon honey butter' },
      { name: 'Kale Caesar Salad', rating: 4.4, price: 2, description: 'Parmesan, croutons, lemony Caesar dressing' },
      { name: 'Black Cherry Soda', rating: 4.3, price: 1, description: 'Craft fountain soda' },
      { name: 'Banana Pudding Cup', rating: 4.6, price: 2, description: 'Vanilla wafers, whipped cream' },
      { name: 'Classic Slaw', rating: 4.4, price: 1, description: 'Creamy slaw with celery seed' },
      { name: 'Hot Honey Dippers', rating: 4.5, price: 2, description: 'Fried tenders tossed in hot honey' },
      { name: 'Iced Sweet Tea', rating: 4.5, price: 1, description: 'Southern style sweet tea' }
    ]
  }

  , 'Juniper Grill - Ballantyne': {
    type: 'Southwestern',
    items: [
      { name: 'Fire-Roasted Salsa and Chips', rating: 4.4, price: 1, description: 'Charred tomato salsa, warm tortilla chips' },
      { name: 'Crab and Avocado Tower', rating: 4.6, price: 4, description: 'Lump crab, avocado, mango, cilantro crema' },
      { name: 'Rotisserie Chicken Enchiladas', rating: 4.6, price: 3, description: 'Poblano cream sauce, jack cheese, pico' },
      { name: 'Ribeye Tacos', rating: 4.6, price: 4, description: 'Wood-fired ribeye, avocado, lime aioli' },
      { name: 'Cedar Plank Salmon', rating: 4.7, price: 4, description: 'Honey chipotle glaze, poblano mashed' },
      { name: 'Slow Smoked Baby Back Ribs', rating: 4.6, price: 4, description: 'House BBQ sauce, slaw, fries' },
      { name: 'Wood Grilled Steak Salad', rating: 4.5, price: 3, description: 'Mixed greens, bleu cheese, corn relish, tortilla strips' },
      { name: 'Queso Blanco', rating: 4.4, price: 2, description: 'White queso, roasted poblanos, chips' },
      { name: 'Southwest Veggie Burger', rating: 4.4, price: 3, description: 'Black bean patty, guacamole, poblano relish' },
      { name: 'Key Lime Pie', rating: 4.7, price: 2, description: 'Toasted coconut whipped cream' },
      { name: 'Roasted Corn and Poblano Soup', rating: 4.5, price: 2, description: 'Smoky corn, poblano peppers, crema' },
      { name: 'Charred Street Corn', rating: 4.5, price: 2, description: 'Cotija, lime, chile dust' }
    ]
  }

  , 'Carolina Butcher & Beer Garden': {
    type: 'Smokehouse',
    items: [
      { name: 'Prime Brisket Plate', rating: 4.7, price: 4, description: 'Texas-style brisket, pickles, onions, white bread' },
      { name: 'House Sausage Trio', rating: 4.6, price: 3, description: 'Jalapeno cheddar, bratwurst, kielbasa' },
      { name: 'Carolina Pulled Pork', rating: 4.5, price: 3, description: 'Eastern vinegar sauce, slaw, hushpuppies' },
      { name: 'Smoked Chicken Half', rating: 4.4, price: 3, description: 'Dry rub, Alabama white sauce' },
      { name: 'Beer Cheese Pretzel', rating: 4.5, price: 2, description: 'Soft pretzel with IPA beer cheese' },
      { name: 'Chopped Brisket Sandwich', rating: 4.5, price: 3, description: 'Pickles, onions, brioche bun' },
      { name: 'Burnt End Baked Beans', rating: 4.6, price: 2, description: 'Molasses, smoked brisket' },
      { name: 'Elote Potato Salad', rating: 4.4, price: 2, description: 'Roasted corn, cotija, lime' },
      { name: 'BBQ Tater Tots', rating: 4.5, price: 2, description: 'Cheddar, scallions, smoked jalapeno ranch' },
      { name: 'House Pickled Veggies', rating: 4.3, price: 1, description: 'Seasonal assortment' },
      { name: 'Peach Cobbler', rating: 4.7, price: 2, description: 'Brown sugar streusel, vanilla ice cream' },
      { name: 'Smoked Turkey BLT', rating: 4.5, price: 3, description: 'Thick-cut bacon, tomato jam, greens, sourdough' }
    ]
  }

  , 'Super Chix': {
    type: 'Chicken/Fast Casual',
    items: [
      { name: 'Crispy Chicken Sandwich', rating: 4.6, price: 2, description: 'Hand-breaded chicken, pickles, mayo' },
      { name: 'Nashville Hot Sandwich', rating: 4.6, price: 3, description: 'Hot spice blend, pickles, ranch' },
      { name: 'Grilled Chicken Sandwich', rating: 4.4, price: 2, description: 'Marinated grilled chicken, lettuce, tomato' },
      { name: 'Chicken Tenders (5)', rating: 4.6, price: 2, description: 'Served with signature dipping sauces' },
      { name: 'Garlic Parmesan Fries', rating: 4.5, price: 2, description: 'Shoestring fries tossed with parmesan' },
      { name: 'Loaded Cheese Fries', rating: 4.5, price: 2, description: 'Cheddar sauce, bacon, scallions' },
      { name: 'Crispy Avocado Salad', rating: 4.4, price: 2, description: 'Mixed greens, crispy avocado, corn, lime vinaigrette' },
      { name: 'Frozen Custard Concrete', rating: 4.7, price: 2, description: 'Vanilla custard blended with mix-ins' },
      { name: 'Peanut Butter Shake', rating: 4.6, price: 2, description: 'Rich peanut butter, whipped cream' },
      { name: 'Crispy Brussels Sprouts', rating: 4.4, price: 2, description: 'Honey drizzle, chili flakes' },
      { name: 'Sweet Heat Sandwich', rating: 4.5, price: 3, description: 'Sweet hot glaze, jalapeno slaw' },
      { name: 'Lemon Pepper Tenders', rating: 4.5, price: 2, description: 'Tossed in lemon pepper butter' }
    ]
  }

  , 'Ilios Crafted Greek - Fort Mill, SC': {
    type: 'Greek',
    items: [
      // Starters
      { name: 'Hummus', rating: 4.5, price: 2, description: 'Creamy chickpea dip with tahini and olive oil' },
      { name: 'Tzatziki', rating: 4.6, price: 2, description: 'Greek yogurt cucumber dip with garlic and dill' },
      { name: 'Spicy Feta', rating: 4.5, price: 2, description: 'Whipped feta with chili flakes and olive oil' },
      { name: 'Trio Dip', rating: 4.7, price: 3, description: 'Hummus, tzatziki, and spicy feta with warm pita' },
      { name: 'Spanakopita', rating: 4.6, price: 3, description: 'Spinach and feta in flaky phyllo pastry' },
      { name: 'Dolmades', rating: 4.5, price: 3, description: 'Grape leaves stuffed with rice and herbs' },
      { name: 'Greek Fries', rating: 4.6, price: 3, description: 'Hand-cut fries with feta and oregano' },
      { name: 'Saganaki', rating: 4.7, price: 3, description: 'Pan-fried Greek cheese with lemon' },
      { name: 'Falafel', rating: 4.5, price: 3, description: 'Crispy chickpea fritters with tahini sauce' },
      { name: 'Feta Board', rating: 4.6, price: 3, description: 'Assorted Greek cheeses, olives, and peppers' },
      
      // Handhelds
      { name: 'Traditional Gyro', rating: 4.7, price: 3, description: 'Beef and lamb gyro with tomato, onion, and tzatziki in warm pita' },
      { name: 'Chicken Gyro', rating: 4.6, price: 3, description: 'Marinated chicken with fresh vegetables and tzatziki in pita' },
      { name: 'Falafel Gyro', rating: 4.5, price: 3, description: 'Crispy falafel with hummus, vegetables, and tahini in pita' },
      { name: 'Pork Souvlaki Pita', rating: 4.6, price: 3, description: 'Grilled pork skewers with onions and tzatziki in pita' },
      { name: 'Chicken Souvlaki Pita', rating: 4.6, price: 3, description: 'Grilled chicken skewers with tomatoes and tzatziki in pita' },
      
      // Bowls
      { name: 'Traditional Gyro Bowl', rating: 4.7, price: 4, description: 'Gyro meat over rice with salad, feta, and tzatziki' },
      { name: 'Chicken Gyro Bowl', rating: 4.6, price: 4, description: 'Chicken gyro over rice with fresh vegetables and tzatziki' },
      { name: 'Falafel Bowl', rating: 4.5, price: 3, description: 'Falafel over rice with hummus, salad, and tahini' },
      { name: 'Pork Souvlaki Bowl', rating: 4.6, price: 4, description: 'Grilled pork over rice with Greek salad and tzatziki' },
      { name: 'Chicken Souvlaki Bowl', rating: 4.6, price: 4, description: 'Grilled chicken over rice with vegetables and tzatziki' },
      
      // Plates
      { name: 'Pork Souvlaki Plate', rating: 4.7, price: 4, description: 'Grilled pork skewers with lemon potatoes, pita, and tzatziki' },
      { name: 'Chicken Souvlaki Plate', rating: 4.7, price: 4, description: 'Grilled chicken skewers with rice, vegetables, and tzatziki' },
      { name: 'Falafel Plate', rating: 4.5, price: 3, description: 'Crispy falafel with hummus, salad, pita, and tahini' },
      
      // Salads
      { name: 'Greek Village Salad', rating: 4.6, price: 3, description: 'Tomatoes, cucumber, onion, olives, feta, and olive oil' },
      { name: 'Traditional Greek Salad', rating: 4.6, price: 3, description: 'Mixed greens with feta, olives, and Greek vinaigrette' },
      { name: 'Chicken Greek Salad', rating: 4.6, price: 4, description: 'Greek salad topped with grilled marinated chicken' },
      { name: 'Falafel Greek Salad', rating: 4.5, price: 4, description: 'Greek salad topped with crispy falafel and tahini' },
      
      // Sides
      { name: 'French Fries', rating: 4.4, price: 2, description: 'Crispy hand-cut fries' },
      { name: 'Rice', rating: 4.3, price: 2, description: 'Fluffy seasoned rice pilaf' },
      { name: 'Lemon Potatoes', rating: 4.6, price: 2, description: 'Greek-style roasted potatoes with lemon and herbs' },
      { name: 'Broccolini', rating: 4.4, price: 2, description: 'Grilled broccolini with garlic and lemon' },
      { name: 'Greek Pasta Salad', rating: 4.5, price: 2, description: 'Pasta with olives, feta, tomatoes, and Greek dressing' },
      
      // Desserts
      { name: 'Baklava', rating: 4.8, price: 3, description: 'Layers of phyllo with honey, walnuts, and pistachio' },
      { name: 'Loukoumades', rating: 4.7, price: 3, description: 'Greek honey puffs drizzled with honey and cinnamon' },
      
      // Kids
      { name: 'Kids Gyro', rating: 4.5, price: 2, description: 'Small gyro with fries or rice' },
      { name: 'Kids Chicken Souvlaki', rating: 4.5, price: 2, description: 'Grilled chicken skewer with fries or rice' },
      { name: 'Kids Rice Bowl', rating: 4.4, price: 2, description: 'Rice bowl with choice of protein' },
      { name: 'Kids Fries', rating: 4.4, price: 1, description: 'Crispy hand-cut fries' }
    ]
  }

  , "Hobo's": {
    type: 'Burgers/Grill',
    items: [
      { name: 'Hobo Burger', rating: 4.6, price: 2, description: 'Double patty, American cheese, shaved lettuce, sauce' },
      { name: 'Smash Patty Melt', rating: 4.5, price: 3, description: 'Caramelized onions, Swiss, rye toast' },
      { name: 'Carolina Dog', rating: 4.5, price: 2, description: 'Chili, slaw, mustard, onions' },
      { name: 'Fried Pickle Chips', rating: 4.5, price: 2, description: 'Buttermilk ranch' },
      { name: 'Buffalo Chicken Sandwich', rating: 4.5, price: 3, description: 'Spicy buffalo sauce, blue cheese' },
      { name: 'Chili Cheese Fries', rating: 4.5, price: 2, description: 'House chili, cheddar, scallions' },
      { name: 'Black Bean Burger', rating: 4.4, price: 2, description: 'Avocado, chipotle mayo' },
      { name: 'Grilled Chicken Caesar Wrap', rating: 4.4, price: 2, description: 'Romaine, parmesan, Caesar dressing' },
      { name: 'Root Beer Float', rating: 4.6, price: 2, description: 'Draft root beer, vanilla ice cream' },
      { name: 'Funnel Cake Fries', rating: 4.5, price: 2, description: 'Powdered sugar, chocolate dip' },
      { name: 'Crispy Brussels', rating: 4.4, price: 2, description: 'Bacon, balsamic drizzle' },
      { name: 'Hand-Spun Shake', rating: 4.6, price: 2, description: 'Chocolate, vanilla, or strawberry' }
    ]
  }

  , 'The Flipside Cafe': {
    type: 'Brunch',
    items: [
      { name: 'Carolina Benedict', rating: 4.7, price: 3, description: 'Pulled pork, poached eggs, chipotle hollandaise, biscuit' },
      { name: 'Shrimp and Grits', rating: 4.7, price: 4, description: 'Tasso gravy, peppers, onions, scallions' },
      { name: 'Sweet Potato Pancakes', rating: 4.6, price: 2, description: 'Whipped butter, maple syrup' },
      { name: 'House Made Granola Bowl', rating: 4.5, price: 2, description: 'Greek yogurt, berries, honey' },
      { name: 'Fried Chicken Biscuit', rating: 4.6, price: 2, description: 'Pepper jelly, pickles' },
      { name: 'Avocado Toast', rating: 4.5, price: 2, description: 'Poached egg, pickled onion, arugula' },
      { name: 'Breakfast Burrito', rating: 4.5, price: 2, description: 'Scrambled eggs, sausage, cheddar, salsa verde' },
      { name: 'Pimento Cheeseburger', rating: 4.6, price: 3, description: '8oz patty, pimento cheese, brioche' },
      { name: 'Crispy Home Fries', rating: 4.4, price: 1, description: 'Herbed potatoes, caramelized onions' },
      { name: 'Seasonal Frittata', rating: 4.5, price: 2, description: 'Local vegetables, goat cheese' },
      { name: 'Cinnamon Roll French Toast', rating: 4.7, price: 3, description: 'Cream cheese icing, maple syrup' },
      { name: 'Bourbon Pecan Pie', rating: 4.7, price: 2, description: 'Whipped cream, caramel' }
    ]
  }

  , 'Twin Peaks': {
    type: 'Sports Bar',
    items: [
      { name: 'Smoky Sweet Wings', rating: 4.5, price: 3, description: 'Jumbo wings tossed in smoky-sweet sauce' },
      { name: 'Beer-Battered Tenders', rating: 4.5, price: 2, description: 'Served with fries and choice of dip' },
      { name: 'Green Chile Cheeseburger', rating: 4.5, price: 3, description: 'Pepper jack, fire-roasted chiles, pico' },
      { name: 'Nashville Hot Chicken Sandwich', rating: 4.5, price: 3, description: 'Pickles, mayo, brioche bun' },
      { name: 'Smoked Brisket Tacos', rating: 4.5, price: 3, description: 'Cotija, pico, avocado lime crema' },
      { name: 'Loaded Fries', rating: 4.4, price: 2, description: 'Cheddar, bacon, jalapenos, ranch' },
      { name: 'Chicken and Waffles', rating: 4.6, price: 3, description: 'Crispy tenders, Belgian waffle, maple syrup' },
      { name: 'Street Corn', rating: 4.4, price: 2, description: 'Cotija, lime, chile-lime crema' },
      { name: 'Venison Chili', rating: 4.5, price: 3, description: 'Hearty chili with cheddar and onions' },
      { name: 'Mini Apple Turnovers', rating: 4.5, price: 2, description: 'Cinnamon sugar, caramel sauce' },
      { name: 'Billionaire Bacon', rating: 4.6, price: 2, description: 'Thick-cut sweet and spicy bacon' },
      { name: '44 Farms Sirloin', rating: 4.6, price: 4, description: 'Char-grilled 10oz sirloin, mashed potatoes' }
    ]
  }

  , 'Tap and Vine - Quail Hollow': {
    type: 'Tapas/Wine Bar',
    items: [
      { name: 'Truffle Parmesan Fries', rating: 4.5, price: 2, description: 'House fries, truffle oil, parmesan' },
      { name: 'Braised Short Rib Sliders', rating: 4.6, price: 3, description: 'Caramelized onions, arugula, horseradish crema' },
      { name: 'Seared Ahi Tuna', rating: 4.6, price: 4, description: 'Sesame crust, ponzu, avocado puree' },
      { name: 'Charcuterie Board', rating: 4.6, price: 4, description: 'Cured meats, artisan cheeses, preserves' },
      { name: 'Roasted Brussels with Bacon', rating: 4.5, price: 2, description: 'Maple balsamic glaze' },
      { name: 'Shrimp and Grits Cake', rating: 4.6, price: 3, description: 'Crispy grit cake, creole cream sauce' },
      { name: 'Margherita Flatbread', rating: 4.5, price: 2, description: 'Tomato, basil, mozzarella' },
      { name: 'Smoked Gouda Mac', rating: 4.5, price: 2, description: 'Panko crust, chives' },
      { name: 'House Burrata', rating: 4.6, price: 3, description: 'Tomato relish, basil oil, grilled bread' },
      { name: 'Chocolate Pot de Creme', rating: 4.7, price: 2, description: 'Sea salt, whipped cream' },
      { name: 'Lamb Lollipop Chops', rating: 4.7, price: 4, description: 'Mint chimichurri, roasted potatoes' },
      { name: 'Korean BBQ Cauliflower', rating: 4.5, price: 2, description: 'Sweet-spicy glaze, sesame seeds' }
    ]
  }

  , 'Towne Tavern at Fort Mill': {
    type: 'Pub',
    items: [
      { name: 'Tavern Nachos', rating: 4.5, price: 2, description: 'Chili, cheese, pico, jalapenos, sour cream' },
      { name: 'Buffalo Wings (10)', rating: 4.6, price: 3, description: 'Choice of sauces, celery, ranch' },
      { name: 'Blackened Chicken Alfredo', rating: 4.5, price: 3, description: 'Penne pasta, creamy Alfredo sauce' },
      { name: 'Fish Tacos', rating: 4.5, price: 3, description: 'Fried whitefish, slaw, chipotle aioli' },
      { name: 'Tavern Burger', rating: 4.5, price: 3, description: 'Cheddar, bacon, tavern sauce, brioche' },
      { name: 'Steak and Cheese Egg Rolls', rating: 4.5, price: 2, description: 'Shaved steak, peppers, onions, queso' },
      { name: 'Grilled Chicken Caesar Wrap', rating: 4.4, price: 2, description: 'Romaine, parmesan, Caesar dressing' },
      { name: 'Philly Cheesesteak', rating: 4.5, price: 3, description: 'Shaved ribeye, provolone, onions, peppers' },
      { name: 'Loaded Potato Skins', rating: 4.4, price: 2, description: 'Cheddar, bacon, scallions, sour cream' },
      { name: 'Southern Fried Chicken Salad', rating: 4.4, price: 3, description: 'Mixed greens, tomatoes, cheddar, honey mustard' },
      { name: 'Chocolate Lava Cake', rating: 4.6, price: 2, description: 'Vanilla ice cream, chocolate sauce' },
      { name: 'Pretzel Bites', rating: 4.4, price: 2, description: 'Beer cheese dip' }
    ]
  }

  , "Boss Hog's Bar-B-Que": {
    type: 'BBQ',
    items: [
      { name: 'Pulled Pork Plate', rating: 4.6, price: 3, description: 'Slow-smoked pork, hushpuppies, slaw' },
      { name: 'Half Chicken Plate', rating: 4.4, price: 3, description: 'Smoked chicken, Carolina red sauce' },
      { name: 'Rib Plate', rating: 4.6, price: 4, description: 'Dry-rubbed ribs, choice of two sides' },
      { name: 'Chopped BBQ Sandwich', rating: 4.5, price: 2, description: 'Vinegar slaw, toasted bun' },
      { name: 'Fried Okra', rating: 4.4, price: 1, description: 'Buttermilk breaded, ranch' },
      { name: 'Hushpuppies', rating: 4.5, price: 1, description: 'Sweet cornmeal bites, honey butter' },
      { name: 'Brunswick Stew', rating: 4.5, price: 2, description: 'Tomato-based stew with smoked meats' },
      { name: 'Smoked Sausage Links', rating: 4.4, price: 2, description: 'Onions, peppers, mustard' },
      { name: 'Banana Pudding', rating: 4.6, price: 2, description: 'Classic southern dessert' },
      { name: 'BBQ Baked Beans', rating: 4.5, price: 2, description: 'Molasses, smoked pork' },
      { name: 'Collard Greens', rating: 4.4, price: 1, description: 'Slow cooked with ham hock' },
      { name: 'Sweet Tea', rating: 4.5, price: 1, description: 'Brewed daily' }
    ]
  }

  , 'LongHorn Steakhouse': {
    type: 'Steakhouse/Chain',
    items: [
      { name: 'Renegade Sirloin', rating: 4.5, price: 3, description: 'Seasoned sirloin, seasoned fries' },
      { name: 'Outlaw Ribeye', rating: 4.6, price: 4, description: 'Bone-in ribeye, fire-grilled' },
      { name: 'Flo’s Filet', rating: 4.6, price: 4, description: 'Center-cut filet with house seasoning' },
      { name: 'Parmesan Crusted Chicken', rating: 4.6, price: 3, description: 'Cheddar and parmesan crust, tomato basil sauce' },
      { name: 'Baby Back Ribs', rating: 4.5, price: 4, description: 'Slow cooked, smoky BBQ sauce' },
      { name: 'White Cheddar Stuffed Mushrooms', rating: 4.5, price: 2, description: 'Garlic herb cheese, parmesan crust' },
      { name: 'Texas Tonion', rating: 4.4, price: 2, description: 'Crispy onion petals, zesty dip' },
      { name: 'Shrimp and Lobster Chowder', rating: 4.5, price: 2, description: 'Creamy seafood chowder' },
      { name: 'Loaded Baked Potato', rating: 4.5, price: 2, description: 'Butter, sour cream, bacon, cheese' },
      { name: 'Fresh Steamed Broccoli', rating: 4.3, price: 1, description: 'Seasoned with butter' },
      { name: 'Caramel Apple Goldrush', rating: 4.6, price: 2, description: 'Cinnamon apples, vanilla ice cream' },
      { name: 'Chocolate Stampede', rating: 4.7, price: 3, description: 'Six types of chocolate, vanilla ice cream' }
    ]
  }

  , 'Santa Fe Mexican Grill': {
    type: 'Mexican',
    items: [
      { name: 'Street Tacos (3)', rating: 4.6, price: 3, description: 'Choice of carne asada, al pastor, or chicken, cilantro and onion' },
      { name: 'Fajitas for One', rating: 4.6, price: 4, description: 'Sizzling peppers and onions, choice of protein' },
      { name: 'Carne Asada Fries', rating: 4.5, price: 3, description: 'Steak, queso, pico, guacamole' },
      { name: 'Chimichanga', rating: 4.5, price: 3, description: 'Fried burrito, queso, rice and beans' },
      { name: 'Queso Fundido', rating: 4.5, price: 2, description: 'Melted cheese with chorizo, tortillas' },
      { name: 'Pollo en Mole', rating: 4.5, price: 4, description: 'Chicken in rich mole poblano sauce' },
      { name: 'Shrimp Ceviche', rating: 4.6, price: 3, description: 'Citrus marinated shrimp, avocado, tostadas' },
      { name: 'Pozole Verde', rating: 4.4, price: 3, description: 'Hominy stew with chicken and tomatillo' },
      { name: 'Tres Leches Cake', rating: 4.7, price: 2, description: 'Soaked sponge cake with whipped cream' },
      { name: 'Sopapillas', rating: 4.5, price: 2, description: 'Fried pastry, cinnamon sugar, honey' },
      { name: 'Esquites', rating: 4.5, price: 2, description: 'Cup of street corn with cotija and lime' },
      { name: 'Horchata', rating: 4.4, price: 1, description: 'Cinnamon rice milk' }
    ]
  }

  , 'Rixster Grill': {
    type: 'Pub Grill',
    items: [
      { name: 'Rixster Burger', rating: 4.5, price: 3, description: 'Half-pound burger, cheddar, bacon, house sauce' },
      { name: 'Steak Tips', rating: 4.5, price: 3, description: 'Marinated sirloin tips, peppers, onions' },
      { name: 'Buffalo Cauliflower', rating: 4.4, price: 2, description: 'Fried cauliflower tossed in buffalo sauce' },
      { name: 'Philly Cheesesteak Wrap', rating: 4.4, price: 2, description: 'Shaved steak, onions, peppers, provolone' },
      { name: 'Blackened Mahi Sandwich', rating: 4.5, price: 3, description: 'Cajun mahi, lettuce, tomato, tartar' },
      { name: 'Loaded Tater Tots', rating: 4.4, price: 2, description: 'Cheddar, bacon, jalapeno ranch' },
      { name: 'Crispy Fish and Chips', rating: 4.5, price: 3, description: 'Beer batter, fries, malt vinegar aioli' },
      { name: 'Southwest Chicken Bowl', rating: 4.4, price: 3, description: 'Rice, black beans, corn salsa, avocado' },
      { name: 'Spinach Artichoke Dip', rating: 4.4, price: 2, description: 'Served with warm tortilla chips' },
      { name: 'Chocolate Cheesecake', rating: 4.5, price: 2, description: 'Chocolate ganache, whipped cream' },
      { name: 'Pretzel Sticks', rating: 4.4, price: 2, description: 'Beer cheese and mustard' },
      { name: 'Grilled Chicken Quesadilla', rating: 4.4, price: 2, description: 'Pico, cheddar jack, sour cream' }
    ]
  }

  , 'Fox Pizza & Subs': {
    type: 'Pizza/Subs',
    items: [
      { name: 'Deluxe Pizza', rating: 4.6, price: 3, description: 'Pepperoni, sausage, peppers, onions, mushrooms' },
      { name: 'White Garlic Pizza', rating: 4.5, price: 3, description: 'Garlic cream, mozzarella, spinach, tomato' },
      { name: 'Buffalo Chicken Pizza', rating: 4.6, price: 3, description: 'Buffalo sauce, grilled chicken, ranch drizzle' },
      { name: 'Steak and Cheese Sub', rating: 4.5, price: 3, description: 'Shaved steak, provolone, peppers, onions' },
      { name: 'Italian Hoagie', rating: 4.5, price: 2, description: 'Ham, salami, capicola, provolone, vinaigrette' },
      { name: 'Meatball Parm Sub', rating: 4.6, price: 3, description: 'House meatballs, marinara, mozzarella' },
      { name: 'Veggie Supreme Pizza', rating: 4.4, price: 3, description: 'Onions, peppers, olives, mushrooms, tomatoes' },
      { name: 'Garlic Knots', rating: 4.5, price: 2, description: 'Garlic butter, parmesan' },
      { name: 'Chicken Bacon Ranch Sub', rating: 4.5, price: 3, description: 'Grilled chicken, bacon, ranch, cheddar' },
      { name: 'Cheesesteak Fries', rating: 4.4, price: 2, description: 'Fries topped with steak, cheese sauce' },
      { name: 'Tiramisu', rating: 4.5, price: 2, description: 'Espresso-soaked ladyfingers, mascarpone' },
      { name: 'Greek Salad', rating: 4.4, price: 2, description: 'Feta, olives, tomato, cucumber, red wine vinaigrette' }
    ]
  }

  , 'Wings & Grill': {
    type: 'Wings',
    items: [
      { name: 'Traditional Wings (10)', rating: 4.5, price: 3, description: 'Choice of buffalo, lemon pepper, garlic parm, mango habanero' },
      { name: 'Boneless Wings (10)', rating: 4.4, price: 2, description: 'Hand-breaded, choice of sauce' },
      { name: 'Philly Cheesesteak', rating: 4.4, price: 3, description: 'Steak, onions, peppers, provolone' },
      { name: 'Gyro Wrap', rating: 4.4, price: 3, description: 'Beef and lamb gyro, tzatziki, tomato, onion' },
      { name: 'Loaded Fries', rating: 4.4, price: 2, description: 'Cheese sauce, bacon, jalapenos' },
      { name: 'Buffalo Shrimp', rating: 4.5, price: 3, description: 'Crispy shrimp tossed in buffalo sauce' },
      { name: 'Chicken Tenders Basket', rating: 4.4, price: 2, description: 'Served with fries and honey mustard' },
      { name: 'Grilled Chicken Salad', rating: 4.3, price: 2, description: 'Romaine, tomato, cucumber, ranch' },
      { name: 'Fried Pickles', rating: 4.4, price: 2, description: 'Served with ranch dip' },
      { name: 'Cheeseburger', rating: 4.3, price: 2, description: 'Quarter-pound patty with American cheese' },
      { name: 'Mozzarella Sticks', rating: 4.3, price: 2, description: 'Marinara on the side' },
      { name: 'Chocolate Brownie', rating: 4.4, price: 2, description: 'Served warm with ice cream' }
    ]
  }

  , 'Southern Roots Restaurant': {
    type: 'Southern',
    items: [
      { name: 'Fried Green Tomatoes', rating: 4.6, price: 2, description: 'Pimento cheese, tomato jam' },
      { name: 'Chicken and Dumplings', rating: 4.6, price: 3, description: 'Slow-cooked chicken, house dumplings' },
      { name: 'Country Fried Steak', rating: 4.5, price: 3, description: 'White pepper gravy, mashed potatoes' },
      { name: 'Carolina Shrimp Plate', rating: 4.6, price: 4, description: 'Fried or grilled shrimp, hushpuppies, slaw' },
      { name: 'Meatloaf with Tomato Glaze', rating: 4.5, price: 3, description: 'Buttermilk mashed potatoes, green beans' },
      { name: 'BBQ Plate', rating: 4.5, price: 3, description: 'Pulled pork, collards, mac and cheese' },
      { name: 'Fried Catfish', rating: 4.5, price: 3, description: 'Tartar sauce, hushpuppies' },
      { name: 'Buttermilk Biscuits', rating: 4.6, price: 1, description: 'House-made with whipped honey butter' },
      { name: 'Collard Greens', rating: 4.5, price: 2, description: 'Simmered with smoked turkey' },
      { name: 'Cheddar Grits', rating: 4.5, price: 2, description: 'Stone-ground grits, sharp cheddar' },
      { name: 'Peach Cobbler', rating: 4.7, price: 2, description: 'Cinnamon crumble, vanilla ice cream' },
      { name: 'Banana Pudding', rating: 4.7, price: 2, description: 'Wafers, whipped cream' }
    ]
  }

  , 'Golden Pizza & Subs': {
    type: 'Pizza/Subs',
    items: [
      { name: 'Golden Special Pizza', rating: 4.5, price: 3, description: 'Pepperoni, sausage, onions, peppers, mushrooms' },
      { name: 'Chicken Alfredo Pizza', rating: 4.5, price: 3, description: 'Creamy Alfredo sauce, grilled chicken, spinach' },
      { name: 'Greek Pizza', rating: 4.5, price: 3, description: 'Spinach, feta, olives, tomatoes, red onion' },
      { name: 'Chicken Parmesan Sub', rating: 4.5, price: 3, description: 'Breaded chicken, marinara, mozzarella' },
      { name: 'Hot Italian Sub', rating: 4.4, price: 2, description: 'Ham, salami, pepperoni, provolone, banana peppers' },
      { name: 'Philly Cheesesteak', rating: 4.5, price: 3, description: 'Griddled steak, onions, peppers, cheese' },
      { name: 'Veggie Calzone', rating: 4.4, price: 3, description: 'Ricotta, mozzarella, spinach, mushrooms' },
      { name: 'Garlic Knots', rating: 4.5, price: 2, description: 'Garlic butter, parmesan' },
      { name: 'House Salad', rating: 4.3, price: 2, description: 'Lettuce, tomato, cucumber, olives' },
      { name: 'Tiramisu', rating: 4.5, price: 2, description: 'Espresso, mascarpone, cocoa' },
      { name: 'Zeppole', rating: 4.4, price: 2, description: 'Fried dough, powdered sugar' },
      { name: 'Cheesecake', rating: 4.5, price: 2, description: 'Classic New York style' }
    ]
  }

  , 'IHOP': {
    type: 'Breakfast',
    items: [
      { name: 'Original Buttermilk Pancakes', rating: 4.6, price: 2, description: 'Stack of fluffy pancakes with butter' },
      { name: 'Chocolate Chip Pancakes', rating: 4.5, price: 2, description: 'Chocolate chips, whipped cream' },
      { name: 'Big Steak Omelette', rating: 4.5, price: 3, description: 'Steak, peppers, onions, cheese, hash browns inside' },
      { name: 'Classic French Toast', rating: 4.5, price: 2, description: 'Texas toast, powdered sugar' },
      { name: 'Chicken and Waffles', rating: 4.5, price: 3, description: 'Four chicken tenders, Belgian waffle' },
      { name: 'Breakfast Sampler', rating: 4.5, price: 3, description: 'Eggs, bacon, sausage, ham, hash browns, pancakes' },
      { name: 'Country Fried Steak and Eggs', rating: 4.5, price: 3, description: 'Sausage gravy, two eggs, hash browns' },
      { name: 'Crepes with Berries', rating: 4.5, price: 2, description: 'Sweet cream cheese filling, berries' },
      { name: 'Southwest Scramble', rating: 4.4, price: 2, description: 'Scrambled eggs, jack cheese, salsa, avocado' },
      { name: 'Hash Browns', rating: 4.4, price: 1, description: 'Crispy shredded potatoes' },
      { name: 'Turkey Bacon Club', rating: 4.3, price: 2, description: 'Sandwich with fries or fruit' },
      { name: 'Belgian Waffle', rating: 4.5, price: 2, description: 'Golden waffle with butter' }
    ]
  }

  , 'Ilios Crafted Greek': {
    type: 'Greek',
    items: [
      { name: 'Chicken Gyro', rating: 4.6, price: 3, description: 'Marinated chicken, tzatziki, tomatoes, onions' },
      { name: 'Falafel Wrap', rating: 4.4, price: 2, description: 'Crispy falafel, hummus, pickled cabbage' },
      { name: 'Lamb Souvlaki Platter', rating: 4.6, price: 4, description: 'Skewers, lemon potatoes, pita, tzatziki' },
      { name: 'Greek Fries', rating: 4.5, price: 2, description: 'Feta, oregano, garlic oil' },
      { name: 'Horiatiki Salad', rating: 4.5, price: 2, description: 'Tomato, cucumber, peppers, feta, olives' },
      { name: 'Dolmades', rating: 4.4, price: 2, description: 'Stuffed grape leaves with lemon' },
      { name: 'Moussaka', rating: 4.5, price: 4, description: 'Layered eggplant, ground beef, bechamel' },
      { name: 'Chicken Avgolemono Soup', rating: 4.4, price: 2, description: 'Lemon egg soup with orzo' },
      { name: 'Spanakopita', rating: 4.6, price: 2, description: 'Spinach and feta phyllo pie' },
      { name: 'Baklava Cheesecake', rating: 4.6, price: 2, description: 'Honey, pistachio crumble' },
      { name: 'Grilled Halloumi', rating: 4.5, price: 3, description: 'Halloumi cheese, lemon, oregano' },
      { name: 'Loukoumades', rating: 4.5, price: 2, description: 'Honeyed dough puffs with cinnamon' }
    ]
  }

  , 'Crossroads Sports Bar & Grill': {
    type: 'Sports Bar',
    items: [
      // Starters & Appetizers
      { name: 'Nachos', rating: 4.4, price: 3, description: 'Tomato, black olives, jalapeños, green peppers, onions, cheddar cheese' },
      { name: 'Nachos with Chicken', rating: 4.5, price: 3, description: 'Nachos topped with grilled chicken' },
      { name: 'BBQ Chicken Wings', rating: 4.5, price: 3, description: 'House BBQ style wings' },
      { name: 'Potato Skins', rating: 4.4, price: 2, description: 'Classic bar favorite with toppings' },
      { name: 'Supreme Pizza Appetizer', rating: 4.5, price: 3, description: 'Pepperoni, sausage, green peppers, onions' },
      
      // Pizzas
      { name: 'Supreme Pizza', rating: 4.6, price: 3, description: 'Pepperoni, sausage, meatballs, peppers, onions' },
      { name: 'Cheese Pizza', rating: 4.4, price: 3, description: 'Classic cheese pizza' },
      { name: 'Pepperoni Pizza', rating: 4.5, price: 3, description: 'Pepperoni and cheese' },
      
      // Sandwiches & Wraps
      { name: 'Shrimp Po\' Boy', rating: 4.5, price: 3, description: 'With lettuce, tomato, and sauce' },
      { name: 'Chicken Caesar Wrap', rating: 4.4, price: 3, description: 'Served with tater tots' },
      { name: 'Philly Steak Quesadillas', rating: 4.5, price: 3, description: 'Steak with peppers and cheese' },
      
      // Pasta
      { name: 'Fettuccine Alfredo', rating: 4.5, price: 3, description: 'Creamy white sauce pasta' },
      
      // Salads
      { name: 'Southwest Chicken Salad', rating: 4.4, price: 3, description: 'Grilled chicken with southwest flavors' },
      { name: 'Caprese Salad', rating: 4.4, price: 2, description: 'Tomatoes, mozzarella, basil' },
      
      // Sides
      { name: 'French Fries', rating: 4.3, price: 2, description: 'Crispy fries' },
      { name: 'Tater Tots', rating: 4.4, price: 2, description: 'Golden tater tots' }
    ]
  }

  , 'Carolina Ale House': {
    type: 'Sports Bar',
    items: [
      // Starters
      { name: 'Artisan 5-Cheese Spinach Dip', rating: 4.5, price: 3, description: 'Five cheese blend with spinach' },
      { name: 'Beer Battered Cheese Curds', rating: 4.5, price: 3, description: 'Crispy fried cheese curds' },
      { name: 'Buffalo Blue Pub Chips', rating: 4.5, price: 3, description: 'Buffalo-style pub chips with bleu cheese' },
      { name: 'Buffalo Chicken Dip', rating: 4.6, price: 3, description: 'Spicy buffalo chicken dip with chips' },
      { name: 'Butter-Baked Pretzel Sticks', rating: 4.5, price: 3, description: 'Soft pretzel sticks with cheese' },
      { name: 'Cheese Fries', rating: 4.5, price: 3, description: 'Fries topped with cheese and ranch' },
      { name: 'Chicken Quesadilla', rating: 4.5, price: 3, description: 'Grilled chicken quesadilla' },
      { name: 'Frickles', rating: 4.5, price: 2, description: 'Fried pickles' },
      
      // Wings & Zingers
      { name: '6 Wings', rating: 4.6, price: 3, description: 'Fresh chicken wings, not frozen' },
      { name: '12 Wings', rating: 4.6, price: 4, description: 'Dozen fresh chicken wings' },
      { name: '5 Boneless Zingers', rating: 4.5, price: 3, description: 'Boneless chicken pieces' },
      { name: '10 Boneless Zingers', rating: 4.5, price: 4, description: 'Ten boneless chicken pieces' },
      
      // Burgers & Sandwiches
      { name: 'The Varsity Cheeseburger', rating: 4.5, price: 3, description: 'Classic cheeseburger' },
      { name: 'Pub Burger', rating: 4.6, price: 3, description: 'Burger with bacon and onion strings' },
      { name: 'Sourdough Patty Melt', rating: 4.5, price: 3, description: 'Patty melt on sourdough' },
      { name: 'Double Western Smashburger', rating: 4.6, price: 4, description: 'Double smashburger with western toppings' },
      { name: 'Buffalo Chicken Sandwich', rating: 4.5, price: 3, description: 'Spicy buffalo chicken' },
      { name: 'Grilled Chicken Sandwich', rating: 4.5, price: 3, description: 'Grilled chicken breast sandwich' },
      { name: 'Classic Philly Cheesesteak', rating: 4.6, price: 4, description: 'Traditional Philly cheesesteak' },
      { name: 'Ultimate Club Sandwich', rating: 4.5, price: 4, description: 'Triple-decker club' },
      { name: 'Flounder Po-Boy', rating: 4.5, price: 3, description: 'Fried flounder sandwich' },
      
      // Tacos
      { name: 'Chicken Tacos', rating: 4.5, price: 4, description: 'Two chicken tacos' },
      { name: 'Steak Tacos', rating: 4.6, price: 4, description: 'Two steak tacos' },
      { name: 'Fish Tacos', rating: 4.5, price: 4, description: 'Two fish tacos' },
      
      // Soups & Salads
      { name: 'Soup of the Day', rating: 4.4, price: 1, description: 'Daily soup selection' },
      { name: 'French Onion Soup', rating: 4.5, price: 2, description: 'Classic French onion' },
      { name: 'Carolina Ale House Chili', rating: 4.5, price: 2, description: 'House chili' },
      { name: 'House Garden Salad', rating: 4.3, price: 2, description: 'Fresh garden salad' },
      { name: 'Caesar Salad', rating: 4.4, price: 2, description: 'Classic Caesar' },
      { name: 'Grilled Chicken Cobb Salad', rating: 4.5, price: 4, description: 'Cobb salad with grilled chicken' },
      { name: 'Southwest Steak Cobb Salad', rating: 4.6, price: 5, description: 'Steak cobb with southwest flavors' },
      
      // Entrées
      { name: '12oz Ribeye', rating: 4.7, price: 5, description: 'Grilled ribeye steak' },
      { name: 'Fish & Chips', rating: 4.5, price: 4, description: 'Beer-battered fish with fries' },
      { name: 'Buffalo Zinger Mac n Cheese', rating: 4.6, price: 4, description: 'Mac and cheese with buffalo chicken' },
      { name: 'Cajun Shrimp Pasta', rating: 4.6, price: 4, description: 'Spicy Cajun shrimp pasta' },
      { name: 'Chicken Tenders & Fries', rating: 4.5, price: 3, description: 'Breaded chicken tenders' },
      { name: 'Baja Chicken & Shrimp Bowl', rating: 4.5, price: 4, description: 'Baja-style bowl with chicken and shrimp' },
      { name: 'Crispy Shrimp Platter', rating: 4.5, price: 4, description: 'Fried shrimp platter' },
      { name: 'BBQ Ribs Half Rack', rating: 4.6, price: 4, description: 'Half rack of BBQ ribs' },
      { name: 'BBQ Ribs Full Rack', rating: 4.7, price: 5, description: 'Full rack of BBQ ribs' },
      { name: 'Roasted Salmon', rating: 4.6, price: 4, description: 'Roasted Atlantic salmon' },
      { name: 'Steak Frites', rating: 4.6, price: 4, description: 'Steak with fries' },
      
      // Desserts
      { name: 'Chocolate Layer Cake', rating: 4.6, price: 2, description: 'Multi-layer chocolate cake' },
      { name: 'Macked-Out Doughnuts', rating: 4.5, price: 2, description: 'Specialty doughnuts' },
      { name: 'Brookie of the Year', rating: 4.6, price: 2, description: 'Brownie cookie hybrid' },
      { name: 'Kids Sundae', rating: 4.4, price: 1, description: 'Ice cream sundae' },
      
      // Kids Menu
      { name: 'Kids Chicken Tenders', rating: 4.4, price: 1, description: 'Chicken tenders with side' },
      { name: 'Little Cheeseburger', rating: 4.4, price: 1, description: 'Kids cheeseburger' },
      { name: 'Kids Wings', rating: 4.4, price: 1, description: 'Kids portion wings' },
      { name: 'Kids Pizza', rating: 4.4, price: 1, description: 'Personal pizza' },
      { name: 'Kids Pasta', rating: 4.3, price: 1, description: 'Pasta with choice of sauce' }
    ]
  }

  , 'Epic Chophouse': {
    type: 'Steakhouse',
    items: [
      // Appetizers
      { name: 'Artisan Breads', rating: 4.5, price: 2, description: 'Fresh baked artisan breads' },
      { name: 'Chophouse Cheese Toast', rating: 4.5, price: 2, description: 'Signature cheese toast' },
      { name: 'Colossal Shrimp Cocktail', rating: 4.7, price: 4, description: 'Jumbo shrimp cocktail' },
      { name: 'Maple Bourbon Bacon', rating: 4.6, price: 2, description: 'Candied bacon with maple bourbon glaze' },
      { name: 'Spinach, Chevre & Brie Bake', rating: 4.6, price: 3, description: 'Baked spinach with chevre and brie' },
      { name: 'Wagyu Meatballs', rating: 4.7, price: 4, description: 'Premium wagyu beef meatballs' },
      { name: 'Calamari Bellissimo', rating: 4.5, price: 3, description: 'Crispy calamari' },
      { name: 'Angry Lobster', rating: 4.7, price: 4, description: 'Spicy lobster appetizer' },
      { name: 'Bacon-Wrapped Scallops Rockefeller', rating: 4.7, price: 4, description: 'Bacon-wrapped scallops with spinach' },
      { name: 'Seared Ahi Tuna', rating: 4.7, price: 4, description: 'Rare seared ahi tuna' },
      { name: 'Epic Lump Crab Fritters', rating: 4.6, price: 4, description: 'Crab cake fritters' },
      { name: 'Jumbo Lump Crab Cocktail', rating: 4.7, price: 5, description: 'Premium lump crab' },
      { name: 'Oysters on the Half Shell', rating: 4.6, price: 4, description: 'Fresh oysters' },
      { name: 'Crab Cakes', rating: 4.7, price: 4, description: 'Maryland-style crab cakes' },
      { name: 'Lobster Bisque', rating: 4.7, price: 3, description: 'Creamy lobster soup' },
      
      // Steaks & Entrees
      { name: 'Filet Mignon', rating: 4.8, price: 5, description: 'Premium beef tenderloin' },
      { name: 'Ribeye', rating: 4.8, price: 5, description: 'Well-marbled ribeye steak' },
      { name: 'NY Strip', rating: 4.7, price: 5, description: 'New York strip steak' },
      { name: 'Porterhouse', rating: 4.8, price: 5, description: 'Large porterhouse steak' },
      { name: 'Prime Pork Chop', rating: 4.6, price: 4, description: 'Premium pork chop' },
      { name: 'Hawaiian Marinated Ribeye', rating: 4.7, price: 5, description: 'Ribeye with Hawaiian marinade' },
      { name: 'Lowcountry Pork Chop', rating: 4.6, price: 4, description: 'Southern-style pork chop' },
      { name: 'Smokin\' Hot Couple', rating: 4.8, price: 5, description: 'Filet mignon and shrimp combo' },
      { name: 'Epic Burger', rating: 4.6, price: 3, description: 'Angus beef burger with bacon and cheddar on brioche' },
      { name: 'BBQ Baby Back Ribs', rating: 4.6, price: 4, description: 'Full rack of BBQ ribs' },
      { name: 'Braised Bone-In Short Rib', rating: 4.7, price: 5, description: 'Slow-braised beef short rib' },
      { name: 'Steak Frites', rating: 4.6, price: 4, description: 'Tenderloin tips with truffle fries' },
      { name: 'Tenderloin Kabobs', rating: 4.6, price: 4, description: 'Grilled tenderloin skewers' },
      { name: 'Legendary Wellington', rating: 4.8, price: 5, description: 'Filet in puff pastry' },
      { name: 'Braised Short Ribs', rating: 4.7, price: 5, description: 'Tender braised short ribs' },
      
      // Seafood
      { name: 'Chilean Sea Bass', rating: 4.8, price: 5, description: 'Pan-seared Chilean sea bass' },
      { name: 'Lobster Tail', rating: 4.8, price: 5, description: 'Petite lobster tails' },
      { name: 'Pan Seared Salmon', rating: 4.6, price: 4, description: 'Fresh Atlantic salmon' },
      { name: 'Scallops', rating: 4.7, price: 5, description: 'Pan-seared scallops' },
      { name: 'Sea Bass Sauté', rating: 4.7, price: 5, description: 'Sautéed sea bass' },
      { name: 'Antarctic Salmon Fillet', rating: 4.6, price: 4, description: 'Wild salmon fillet' },
      { name: 'Rare Seared Ahi Tuna', rating: 4.7, price: 5, description: 'Sushi-grade ahi tuna' },
      { name: 'Lowcountry Shrimp & Grits', rating: 4.7, price: 4, description: 'Southern shrimp and grits' },
      
      // Chicken & Pasta
      { name: 'Chicken Marsala', rating: 4.5, price: 4, description: 'Chicken with marsala wine sauce' },
      { name: 'Chicken Parmesan', rating: 4.5, price: 4, description: 'Breaded chicken with marinara and cheese' },
      { name: 'Chicken Pasta Louisianne', rating: 4.6, price: 4, description: 'Cajun-style chicken pasta' },
      { name: 'Scampi-Style Shrimp Pasta', rating: 4.6, price: 4, description: 'Shrimp scampi over pasta' },
      { name: 'Epic Linguine Marinara', rating: 4.4, price: 3, description: 'Pasta with marinara sauce' },
      
      // Sides
      { name: 'Loaded Mashed Potatoes', rating: 4.5, price: 2, description: 'Mashed potatoes with toppings' },
      { name: 'Au Gratin Potatoes', rating: 4.6, price: 2, description: 'Creamy au gratin potatoes' },
      { name: 'Asparagus', rating: 4.5, price: 2, description: 'Grilled asparagus' },
      { name: 'Sautéed Mushrooms', rating: 4.5, price: 2, description: 'Sautéed wild mushrooms' },
      { name: 'Creamed Spinach', rating: 4.5, price: 2, description: 'Classic creamed spinach' },
      
      // Desserts
      { name: 'NY Style Cheesecake', rating: 4.7, price: 3, description: 'Classic New York cheesecake' },
      { name: 'Chocolate Cake', rating: 4.7, price: 3, description: 'Rich chocolate cake' }
    ]
  }

  , 'Napa at Kingsley': {
    type: 'American/Wine Bar',
    items: [
      // Starters
      { name: 'Deviled Eggs', rating: 4.5, price: 2, description: 'Classic deviled eggs' },
      { name: 'BLT Flatbread', rating: 4.5, price: 4, description: 'Bacon, lettuce, tomato flatbread' },
      { name: 'Pretzel & Beer Cheese', rating: 4.5, price: 3, description: 'Soft pretzel with beer cheese dip' },
      { name: 'Ahi Tuna', rating: 4.6, price: 4, description: 'Seared ahi tuna' },
      
      // Salads
      { name: 'Caesar Salad', rating: 4.4, price: 2, description: 'Classic Caesar salad' },
      { name: 'Chopped Salad', rating: 4.4, price: 3, description: 'Fresh chopped salad' },
      
      // Sandwiches & Burgers
      { name: 'Napa Burger', rating: 4.6, price: 3, description: 'House burger with toppings' },
      { name: 'Chicken Sandwich', rating: 4.5, price: 4, description: 'Grilled chicken sandwich' },
      
      // Entrees
      { name: 'NY Strip Steak', rating: 4.7, price: 5, description: 'Grilled New York strip' },
      { name: 'Slow-Roasted Prime Rib', rating: 4.8, price: 5, description: 'Weekend special prime rib' },
      { name: 'Wood-Grilled Salmon', rating: 4.6, price: 5, description: 'Fresh grilled salmon' },
      { name: 'Shrimp Scampi Risotto', rating: 4.6, price: 4, description: 'Shrimp scampi over creamy risotto' },
      
      // Sides
      { name: 'Mashed Potatoes', rating: 4.4, price: 2, description: 'Creamy mashed potatoes' },
      { name: 'Broccolini', rating: 4.3, price: 2, description: 'Grilled broccolini' },
      { name: 'Fries', rating: 4.4, price: 2, description: 'French fries' },
      
      // Desserts
      { name: 'Cheesecake', rating: 4.6, price: 2, description: 'House cheesecake' },
      { name: 'Chocolate Cake', rating: 4.7, price: 2, description: 'Rich chocolate cake' }
    ]
  }

  , 'Paco\'s Tacos & Tequila': {
    type: 'Mexican',
    items: [
      // Starters
      { name: 'Chips & Salsa', rating: 4.5, price: 1, description: 'Fresh chips with house salsa' },
      { name: 'Guacamole', rating: 4.6, price: 3, description: 'Fresh guacamole' },
      { name: 'Queso Dip', rating: 4.5, price: 2, description: 'Creamy cheese dip' },
      { name: 'Street Corn', rating: 4.6, price: 2, description: 'Mexican street corn' },
      
      // Tacos
      { name: 'Birria Tacos', rating: 4.7, price: 4, description: 'Slow-cooked birria beef tacos' },
      { name: 'Carne Asada Tacos', rating: 4.6, price: 4, description: 'Grilled steak tacos' },
      { name: 'Chicken Tinga Tacos', rating: 4.5, price: 3, description: 'Shredded chicken tinga tacos' },
      { name: 'Shrimp Tacos', rating: 4.6, price: 4, description: 'Grilled shrimp tacos' },
      { name: 'Fish Tacos', rating: 4.5, price: 4, description: 'Fried or grilled fish tacos' },
      
      // Burritos & Bowls
      { name: 'Birria Burrito', rating: 4.7, price: 4, description: 'Birria beef burrito' },
      { name: 'Grilled Chicken Bowl', rating: 4.5, price: 3, description: 'Chicken bowl with rice and beans' },
      { name: 'Steak Burrito', rating: 4.6, price: 4, description: 'Carne asada burrito' },
      { name: 'Veggie Burrito', rating: 4.4, price: 3, description: 'Vegetarian burrito' },
      
      // Sides
      { name: 'Cilantro Rice', rating: 4.4, price: 1, description: 'Mexican rice with cilantro' },
      { name: 'Black Beans', rating: 4.4, price: 1, description: 'Seasoned black beans' },
      { name: 'Refried Beans', rating: 4.4, price: 1, description: 'Traditional refried beans' },
      
      // Desserts
      { name: 'Churros', rating: 4.6, price: 2, description: 'Cinnamon sugar churros' },
      { name: 'Tres Leches Cake', rating: 4.7, price: 3, description: 'Three milk cake' }
    ]
  }

  , '131 Main': {
    type: 'American',
    items: [
      // Starters
      { name: 'Grilled Artichokes', rating: 4.5, price: 3, description: 'Grilled artichoke hearts' },
      { name: 'The Double Dip', rating: 4.5, price: 2, description: 'Fire-roasted pepper dip, guacamole, salsa with chips' },
      { name: 'Deviled Eggs', rating: 4.4, price: 1, description: 'Classic deviled eggs' },
      { name: 'Smoked Salmon', rating: 4.6, price: 3, description: 'House-smoked salmon with aioli and toast points' },
      { name: 'Cast Iron Cornbread', rating: 4.5, price: 2, description: 'Green chiles, jack and cheddar cheese' },
      
      // Salads
      { name: 'Monterey Salad', rating: 4.5, price: 4, description: 'Mixed greens, heirloom tomato, oranges, avocado, gorgonzola, pecans, dates' },
      { name: 'Thai Steak Salad', rating: 4.6, price: 4, description: 'Marinated tenderloin, Asian noodles, peanuts, cabbage, mint, mango' },
      { name: 'Crab Cake Salad', rating: 4.6, price: 4, description: 'Jumbo lump Maryland crab cake with mixed greens' },
      { name: 'Ahi Tuna Salad', rating: 4.6, price: 4, description: 'Seared tuna with greens, avocado, mango, ginger vinaigrette' },
      { name: 'Metropolis Salad', rating: 4.5, price: 4, description: 'Pulled chicken, feta, avocado, corn, tomatoes, almonds, dates' },
      { name: 'Main Caesar Wedge Salad', rating: 4.4, price: 2, description: 'Caesar or wedge salad' },
      
      // Sandwiches
      { name: 'Tuscan Turkey Sandwich', rating: 4.5, price: 3, description: 'Shaved turkey, havarti, mayo, lettuce, tomatoes, cherry peppers' },
      { name: 'Sterling Prime Rib Sandwich', rating: 4.7, price: 4, description: 'Slow-roasted prime rib with hot au jus and mayo' },
      { name: 'Fresh Catch Tacos', rating: 4.5, price: 4, description: 'Grilled fish with avocado pico de gallo' },
      { name: 'Veggie Burger', rating: 4.4, price: 3, description: 'Sweet soy glaze, havarti cheese, quinoa salad' },
      { name: 'Grilled Chicken Sandwich', rating: 4.5, price: 3, description: 'Marinated chicken, jack cheese, lettuce, tomato' },
      { name: 'Fresh Catch Sandwich', rating: 4.5, price: 4, description: 'Grilled fish, lettuce, pickles, aioli' },
      { name: 'Classic Cheeseburger', rating: 4.5, price: 3, description: 'House-ground burger' },
      
      // Entrees
      { name: 'Fresh Cut Salmon', rating: 4.6, price: 4, description: 'Grilled fresh salmon' },
      
      // Sides
      { name: 'Hand Cut Fries', rating: 4.4, price: 1, description: 'Fresh-cut fries' },
      { name: 'Loaded Mashed Potatoes', rating: 4.5, price: 1, description: 'Mashed potatoes with toppings' },
      { name: 'White Cheddar Grits', rating: 4.5, price: 1, description: 'Creamy white cheddar grits' },
      { name: 'Sweet Curried Corn', rating: 4.4, price: 1, description: 'Corn with curry spices' },
      { name: 'Braised Red Cabbage', rating: 4.3, price: 1, description: 'Slow-braised cabbage' },
      { name: 'Jumbo Grilled Asparagus', rating: 4.4, price: 1, description: 'Grilled asparagus spears' },
      { name: 'Kale Salad', rating: 4.4, price: 1, description: 'Fresh kale salad' },
      { name: 'Chilled Quinoa Salad', rating: 4.4, price: 1, description: 'Cold quinoa salad' },
      { name: 'Wild Rice Salad', rating: 4.4, price: 1, description: 'Wild rice salad' },
      { name: 'P&G Slaw', rating: 4.3, price: 1, description: 'House coleslaw' },
      { name: 'Chili', rating: 4.5, price: 2, description: 'House chili' },
      { name: 'Soup of the Day', rating: 4.4, price: 2, description: 'Daily soup selection' },
      
      // Desserts
      { name: 'Peanut Butter Pie', rating: 4.7, price: 2, description: 'Creamy peanut butter pie' },
      { name: 'Banana Cream Pie', rating: 4.6, price: 2, description: 'Classic banana cream pie' },
      { name: 'Key Lime Pie', rating: 4.7, price: 2, description: 'Tart key lime pie' },
      { name: 'Brownie à la Mode', rating: 4.6, price: 2, description: 'Brownie with ice cream' }
    ]
  }

  , 'Burtons Grill & Bar': {
    type: 'American',
    items: [
      // Starters
      { name: 'Signature Wings', rating: 4.6, price: 4, description: 'Memphis dry rub or maple sriracha' },
      { name: 'General Tso Cauliflower', rating: 4.5, price: 4, description: 'Crispy cauliflower in General Tso sauce' },
      { name: 'Crispy Calamari', rating: 4.5, price: 4, description: 'Fried calamari with marinara' },
      { name: 'Buffalo Chicken Dip', rating: 4.6, price: 4, description: 'Spicy buffalo chicken dip' },
      { name: 'Firecracker Shrimp', rating: 4.6, price: 4, description: 'Spicy crispy shrimp' },
      { name: 'Spinach & Artichoke Dip', rating: 4.5, price: 4, description: 'Creamy spinach artichoke dip' },
      { name: 'Bread Service', rating: 4.3, price: 1, description: 'Fresh bread with butter' },
      
      // Soups & Salads
      { name: 'She-Crab Soup', rating: 4.6, price: 3, description: 'Creamy she-crab soup' },
      { name: 'House Salad', rating: 4.4, price: 3, description: 'Fresh garden salad' },
      { name: 'Caesar Salad', rating: 4.4, price: 3, description: 'Classic Caesar' },
      { name: 'Superfood Salad', rating: 4.5, price: 4, description: 'Healthy superfood blend' },
      { name: 'Southwest Chicken Salad', rating: 4.5, price: 4, description: 'Chicken with southwest toppings' },
      { name: 'Thai Steak Salad', rating: 4.6, price: 5, description: 'Thai-style steak salad' },
      { name: 'General Tso Bowl', rating: 4.5, price: 4, description: 'General Tso chicken bowl' },
      { name: 'Roasted Vegetable Bowl', rating: 4.4, price: 4, description: 'Healthy vegetable bowl' },
      
      // Burgers & Sandwiches
      { name: 'Classic Burger', rating: 4.5, price: 4, description: 'Classic burger' },
      { name: 'Maxx Burger', rating: 4.6, price: 4, description: 'Loaded burger' },
      { name: 'Veggie Burger', rating: 4.4, price: 4, description: 'Vegetarian burger' },
      { name: 'Crab Cake Sandwich', rating: 4.7, price: 5, description: 'Crab cake on a bun' },
      { name: 'California Chicken Sandwich', rating: 4.5, price: 4, description: 'Chicken with California toppings' },
      { name: 'Crispy Fish Sandwich', rating: 4.5, price: 4, description: 'Fried fish sandwich' },
      { name: 'Short Rib Grilled Cheese', rating: 4.7, price: 5, description: 'Grilled cheese with short rib' },
      
      // Steaks
      { name: 'Filet Mignon', rating: 4.8, price: 5, description: '8oz filet mignon' },
      { name: 'NY Strip', rating: 4.7, price: 5, description: '12oz New York strip' },
      { name: 'Ribeye', rating: 4.8, price: 5, description: '14oz ribeye steak' },
      { name: 'Steak Frites', rating: 4.6, price: 5, description: 'Steak with fries' },
      
      // Burtons Classics
      { name: 'Mediterranean Chicken Risotto', rating: 4.6, price: 4, description: 'Chicken with creamy risotto' },
      { name: 'Chicken Piccata', rating: 4.6, price: 5, description: 'Chicken in lemon caper sauce' },
      { name: 'Chicken & Wild Mushroom Ravioli', rating: 4.6, price: 5, description: 'Ravioli with chicken and mushrooms' },
      { name: 'Braised Short Ribs', rating: 4.7, price: 5, description: 'Tender braised beef ribs' },
      { name: 'Pappardelle Bolognese', rating: 4.6, price: 5, description: 'Pasta with meat sauce' },
      
      // Seafood
      { name: 'Lobster Roll', rating: 4.7, price: 5, description: 'Fresh lobster roll' },
      { name: 'Ahi Tuna Bowl', rating: 4.6, price: 5, description: 'Seared ahi tuna bowl' },
      { name: 'Crab Cakes', rating: 4.8, price: 5, description: 'Jumbo lump crab cakes' },
      { name: 'Salmon Romesco', rating: 4.7, price: 5, description: 'Salmon with romesco sauce' },
      { name: 'Crab-Crusted Haddock', rating: 4.7, price: 5, description: 'Haddock topped with crab' },
      
      // Sides
      { name: 'Mac & Cheese', rating: 4.5, price: 3, description: 'Creamy mac and cheese' },
      { name: 'French Fries', rating: 4.4, price: 2, description: 'Crispy fries' },
      { name: 'Parmesan Truffle Fries', rating: 4.6, price: 3, description: 'Truffle fries with parmesan' },
      { name: 'Broccoli', rating: 4.3, price: 2, description: 'Steamed broccoli' },
      { name: 'Haricots Verts', rating: 4.4, price: 2, description: 'French green beans' },
      { name: 'Seasonal Vegetable', rating: 4.4, price: 3, description: 'Chef\'s vegetable selection' },
      { name: 'Caesar Side Salad', rating: 4.3, price: 2, description: 'Side Caesar salad' },
      { name: 'House Side Salad', rating: 4.3, price: 2, description: 'Side house salad' },
      { name: 'Garlic Mashed Potatoes', rating: 4.5, price: 2, description: 'Mashed potatoes with garlic' },
      
      // Desserts
      { name: 'Cheesecake', rating: 4.7, price: 3, description: 'Classic cheesecake' },
      { name: 'Seven-Layer Chocolate Cake', rating: 4.8, price: 3, description: 'Rich chocolate layer cake' },
      { name: 'Key Lime Pie', rating: 4.6, price: 3, description: 'Tart key lime pie' },
      { name: 'Affogato', rating: 4.6, price: 3, description: 'Ice cream with espresso' }
    ]
  }
}

function resolveMenuName(restaurantName) {
  if (!restaurantName) return null
  const normalized = restaurantName
    .toLowerCase()
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  const aliasMap = {
    "salmeri's italian kitchen": "Salmeri's Italian Kitchen",
    "poppyseed kitchen": "Poppyseed Kitchen",
    "the improper pig": "The Improper Pig",
    "improper pig": "The Improper Pig",
    "firebirds wood fired grill": "Firebirds Wood Fired Grill",
    "fort mill family restaurant": "Fort Mill Family Restaurant",
    "spice asian kitchen": "Spice Asian Kitchen",
    "mr rayo mexican grill": "Mr Rayo Mexican Grill",
    "konnichiwa": "Konnichiwa",
    "hoof & barrel": "Hoof & Barrel",
    "hoof and barrel": "Hoof & Barrel",
    "juniper grill - ballantyne": 'Juniper Grill - Ballantyne',
    "juniper grill – ballantyne": 'Juniper Grill - Ballantyne',
    "tap and vine - quail hollow": 'Tap and Vine - Quail Hollow',
    "tap and vine – quail hollow": 'Tap and Vine - Quail Hollow',
    "ilios crafted greek - fort mill, sc": 'Ilios Crafted Greek - Fort Mill, SC',
    "ilios crafted greek – fort mill, sc": 'Ilios Crafted Greek - Fort Mill, SC',
    "crossroads sports bar & grill": "Crossroads Sports Bar & Grill",
    "crossroads sports bar and grill": "Crossroads Sports Bar & Grill",
    "crossroads": "Crossroads Sports Bar & Grill",
    "carolina ale house": "Carolina Ale House",
    "epic chophouse": "Epic Chophouse",
    "napa at kingsley": "Napa at Kingsley",
    "paco's tacos & tequila": "Paco's Tacos & Tequila",
    "paco's tacos and tequila": "Paco's Tacos & Tequila",
    "pacos tacos": "Paco's Tacos & Tequila",
    "131 main": "131 Main",
    "131 main - blakeney": "131 Main",
    "burtons grill & bar": "Burtons Grill & Bar",
    "burtons grill and bar": "Burtons Grill & Bar",
    "burtons grill": "Burtons Grill & Bar"
  }

  if (aliasMap[normalized]) return aliasMap[normalized]
  return Object.keys(RESTAURANT_MENUS).find(k => k.toLowerCase() === normalized) || null
}

function detectCuisine(restaurantName = '') {
  const n = restaurantName.toLowerCase()
  if (/(pizza|parm|margherita|ricotta|mozzarella|pasta|italian|trattoria|osteria)/.test(n)) return 'italian'
  if (/(steak|filet|ribeye|sirloin|chop house)/.test(n)) return 'steakhouse'
  if (/(bbq|bar-b-que|smokehouse|brisket|ribs)/.test(n)) return 'bbq'
  if (/(taco|taqueria|mexican|burrito|quesadilla|enchilada)/.test(n)) return 'mexican'
  if (/(sushi|ramen|izakaya|hibachi|yakitori|bento)/.test(n)) return 'japanese'
  if (/(bao|noodle|dumpling|dim sum|asian|thai|korean|chinese|viet)/.test(n)) return 'asian'
  if (/(brunch|cafe|coffee|bistro|bakery)/.test(n)) return 'brunch'
  if (/(gyro|souvlaki|mezze|greek|mediterranean|mezze)/.test(n)) return 'greek'
  if (/(wing|burger|grill|pub|tap|bar|american)/.test(n)) return 'american'
  return 'mixed'
}

const MENU_TEMPLATES = {
  italian: {
    apps: [
      { name: 'Burrata and Heirloom Tomatoes', price: 3, rating: 4.7, description: 'Creamy burrata, basil pesto and balsamic around {restaurant}' },
      { name: 'Crispy Calamari Fritti', price: 3, rating: 4.6, description: 'Light semolina breading with lemon aioli at {restaurant}' },
      { name: 'Whipped Ricotta with Hot Honey', price: 2, rating: 4.6, description: 'Grilled bread, olive oil and chili honey at {restaurant}' },
      { name: 'Prosciutto and Melon', price: 2, rating: 4.5, description: 'Shaved prosciutto, ripe melon, mint at {restaurant}' }
    ],
    mains: [
      { name: 'Pappardelle Bolognese', price: 4, rating: 4.8, description: 'Slow-simmered meat ragu tossed with wide ribbons at {restaurant}' },
      { name: 'Cacio e Pepe', price: 3, rating: 4.7, description: 'Pecorino Romano, cracked pepper, bronze-cut pasta at {restaurant}' },
      { name: 'Seafood Linguine', price: 4, rating: 4.7, description: 'Shrimp, mussels and clams in white wine sauce at {restaurant}' },
      { name: 'Chicken Piccata', price: 3, rating: 4.6, description: 'Lemon-caper butter sauce over cutlets at {restaurant}' },
      { name: 'Porcini Mushroom Risotto', price: 4, rating: 4.7, description: 'Creamy carnaroli rice finished with truffle oil at {restaurant}' },
      { name: 'Brick-Oven Margherita Pizza', price: 3, rating: 4.7, description: 'San Marzano tomatoes, fior di latte, basil at {restaurant}' },
      { name: 'Four Cheese White Pizza', price: 3, rating: 4.6, description: 'Mozzarella, fontina, gorgonzola, ricotta at {restaurant}' },
      { name: 'Veal Milanese', price: 4, rating: 4.6, description: 'Crispy cutlet with arugula and lemon at {restaurant}' }
    ],
    sides: [
      { name: 'Rosemary Focaccia', price: 1, rating: 4.5, description: 'Warm house-baked focaccia at {restaurant}' },
      { name: 'Parmesan Truffle Fries', price: 2, rating: 4.6, description: 'Hand-cut fries with truffle salt at {restaurant}' },
      { name: 'Charred Broccolini with Garlic', price: 2, rating: 4.5, description: 'Lemon zest and chili flakes at {restaurant}' }
    ],
    desserts: [
      { name: 'Affogato al Caffè', price: 2, rating: 4.6, description: 'Vanilla gelato drowned in espresso at {restaurant}' },
      { name: 'Pistachio Cannoli', price: 2, rating: 4.6, description: 'Crunchy shells, sweet ricotta filling at {restaurant}' },
      { name: 'Olive Oil Lemon Cake', price: 2, rating: 4.5, description: 'Citrus glaze and whipped cream at {restaurant}' }
    ],
    drinks: [
      { name: 'Negroni', price: 3, rating: 4.5, description: 'Classic bitter-sweet aperitivo at {restaurant}' },
      { name: 'Sparkling San Pellegrino', price: 1, rating: 4.4, description: 'Chilled mineral water at {restaurant}' }
    ]
  },
  american: {
    apps: [
      { name: 'Smoked Pimento Cheese Dip', price: 2, rating: 4.5, description: 'Sharp cheddar, toasted crostini at {restaurant}' },
      { name: 'Buttermilk Fried Pickles', price: 2, rating: 4.4, description: 'Zesty ranch on the side at {restaurant}' },
      { name: 'Loaded Potato Skins', price: 2, rating: 4.5, description: 'Bacon, cheddar, scallions, sour cream at {restaurant}' },
      { name: 'Crispy Brussels with Maple Bacon', price: 2, rating: 4.5, description: 'Sweet-spicy glaze at {restaurant}' }
    ],
    mains: [
      { name: 'House Smashburger', price: 3, rating: 4.7, description: 'Double patties, special sauce, toasted brioche at {restaurant}' },
      { name: 'Buttermilk Fried Chicken Sandwich', price: 3, rating: 4.6, description: 'Pickles, slaw, spicy mayo at {restaurant}' },
      { name: 'Cast Iron Mac and Cheese', price: 2, rating: 4.6, description: 'Three-cheese blend, toasted crumbs at {restaurant}' },
      { name: 'Blackened Salmon BLT', price: 4, rating: 4.6, description: 'Applewood bacon, tomato jam, lemon aioli at {restaurant}' },
      { name: 'Carolina BBQ Platter', price: 3, rating: 4.6, description: 'Pulled pork, hushpuppies, vinegar slaw at {restaurant}' },
      { name: 'Smokehouse Brisket Tacos', price: 3, rating: 4.5, description: 'Pickled onions, salsa verde at {restaurant}' },
      { name: 'Wood-Grilled Chicken Cobb', price: 3, rating: 4.5, description: 'Avocado, blue cheese, charred corn at {restaurant}' },
      { name: 'Shrimp and Grits', price: 4, rating: 4.7, description: 'Stone-ground grits, tasso gravy at {restaurant}' }
    ],
    sides: [
      { name: 'Hand-Cut Fries', price: 1, rating: 4.4, description: 'Sea salt and cracked pepper at {restaurant}' },
      { name: 'Collard Greens', price: 1, rating: 4.4, description: 'Slow cooked with apple cider vinegar at {restaurant}' },
      { name: 'Cast Iron Cornbread', price: 2, rating: 4.5, description: 'Whipped honey butter at {restaurant}' }
    ],
    desserts: [
      { name: 'Brown Butter Pecan Pie', price: 2, rating: 4.6, description: 'Flaky crust, bourbon whipped cream at {restaurant}' },
      { name: 'Banana Pudding Jar', price: 2, rating: 4.7, description: 'Vanilla wafers, brûléed bananas at {restaurant}' }
    ],
    drinks: [
      { name: 'House Lemonade', price: 1, rating: 4.4, description: 'Fresh-squeezed, lightly sweet at {restaurant}' },
      { name: 'Sweet Tea', price: 1, rating: 4.4, description: 'Classic Southern brew at {restaurant}' }
    ]
  },
  mexican: {
    apps: [
      { name: 'Street Corn Elote', price: 2, rating: 4.6, description: 'Cotija, lime, chile dust at {restaurant}' },
      { name: 'Queso Fundido with Chorizo', price: 2, rating: 4.6, description: 'Bubbly cheese dip and tortillas at {restaurant}' },
      { name: 'Fresh Guacamole and Chips', price: 2, rating: 4.5, description: 'Lime, cilantro, serrano peppers at {restaurant}' },
      { name: 'Ceviche Veracruz', price: 3, rating: 4.6, description: 'Citrus-cured shrimp, olives, tomato at {restaurant}' }
    ],
    mains: [
      { name: 'Al Pastor Street Tacos', price: 3, rating: 4.8, description: 'Charred pineapple, onion, cilantro at {restaurant}' },
      { name: 'Carne Asada Burrito', price: 3, rating: 4.6, description: 'Grilled steak, rice, beans, salsa roja at {restaurant}' },
      { name: 'Chicken Tinga Enchiladas', price: 3, rating: 4.6, description: 'Smoky tomato cream sauce, queso fresco at {restaurant}' },
      { name: 'Pescado Baja Tacos', price: 3, rating: 4.6, description: 'Crispy whitefish, cabbage slaw, chipotle crema at {restaurant}' },
      { name: 'Chile Verde Braised Pork', price: 4, rating: 4.6, description: 'Roasted tomatillo gravy over rice at {restaurant}' },
      { name: 'Vegetarian Mole Bowl', price: 3, rating: 4.5, description: 'Roasted vegetables, black beans, sesame mole at {restaurant}' },
      { name: 'Fajitas for Two', price: 4, rating: 4.7, description: 'Sizzling peppers, onions, choice of protein at {restaurant}' },
      { name: 'Birria Quesadilla', price: 3, rating: 4.6, description: 'Slow-braised beef, consomé dip at {restaurant}' }
    ],
    sides: [
      { name: 'Refried Black Beans', price: 1, rating: 4.4, description: 'Cotija and cilantro at {restaurant}' },
      { name: 'Cilantro Lime Rice', price: 1, rating: 4.4, description: 'Fluffy grains with lime zest at {restaurant}' },
      { name: 'Plantain Chips', price: 2, rating: 4.4, description: 'Sea salt and habanero dip at {restaurant}' }
    ],
    desserts: [
      { name: 'Churros with Chocolate', price: 2, rating: 4.6, description: 'Cinnamon sugar and warm dip at {restaurant}' },
      { name: 'Tres Leches Cake', price: 2, rating: 4.7, description: 'Vanilla sponge soaked in three milks at {restaurant}' }
    ],
    drinks: [
      { name: 'Horchata', price: 1, rating: 4.5, description: 'Cinnamon rice milk at {restaurant}' },
      { name: 'Tamarind Agua Fresca', price: 1, rating: 4.4, description: 'Bright and tart refresher at {restaurant}' }
    ]
  },
  asian: {
    apps: [
      { name: 'Pork and Chive Dumplings', price: 2, rating: 4.6, description: 'Pan-seared with soy chili dip at {restaurant}' },
      { name: 'Crispy Spring Rolls', price: 2, rating: 4.5, description: 'Vegetable filling, nuoc cham at {restaurant}' },
      { name: 'Spicy Edamame', price: 1, rating: 4.5, description: 'Garlic chili oil and sesame at {restaurant}' },
      { name: 'Scallion Pancakes', price: 2, rating: 4.5, description: 'Flaky layers with ginger soy dip at {restaurant}' }
    ],
    mains: [
      { name: 'Korean Bulgogi Bowl', price: 3, rating: 4.7, description: 'Marinated ribeye, kimchi, fried egg at {restaurant}' },
      { name: 'Thai Green Curry', price: 3, rating: 4.6, description: 'Coconut broth, vegetables, jasmine rice at {restaurant}' },
      { name: 'Spicy Dan Dan Noodles', price: 2, rating: 4.6, description: 'Chili oil, minced pork, scallions at {restaurant}' },
      { name: 'General Tso’s Crispy Chicken', price: 3, rating: 4.5, description: 'Sweet-spicy glaze, sesame seeds at {restaurant}' },
      { name: 'Vietnamese Lemongrass Shrimp', price: 3, rating: 4.6, description: 'Jasmine rice and pickled veggies at {restaurant}' },
      { name: 'Tofu and Vegetable Stir Fry', price: 2, rating: 4.5, description: 'Garlic ginger sauce, broccoli, peppers at {restaurant}' },
      { name: 'Pho Brisket Noodle Soup', price: 3, rating: 4.6, description: 'Fragrant broth, herbs and rice noodles at {restaurant}' },
      { name: 'Sesame Crusted Salmon', price: 4, rating: 4.6, description: 'Miso glaze, bok choy at {restaurant}' }
    ],
    sides: [
      { name: 'Garlic Fried Rice', price: 1, rating: 4.5, description: 'Scallions and toasted garlic at {restaurant}' },
      { name: 'Chilled Soba Salad', price: 2, rating: 4.4, description: 'Sesame dressing and cucumbers at {restaurant}' },
      { name: 'Pickled Vegetable Trio', price: 1, rating: 4.4, description: 'Crisp house pickles at {restaurant}' }
    ],
    desserts: [
      { name: 'Mango Sticky Rice', price: 2, rating: 4.6, description: 'Coconut milk, ripe mango at {restaurant}' },
      { name: 'Thai Tea Panna Cotta', price: 2, rating: 4.5, description: 'Silky custard with caramel pearls at {restaurant}' }
    ],
    drinks: [
      { name: 'Lychee Lemonade', price: 1, rating: 4.5, description: 'Tart, floral refresher at {restaurant}' },
      { name: 'Jasmine Iced Tea', price: 1, rating: 4.4, description: 'Lightly sweet, fragrant at {restaurant}' }
    ]
  },
  japanese: {
    apps: [
      { name: 'Hamachi Crudo', price: 3, rating: 4.7, description: 'Citrus ponzu, jalapeno, shiso at {restaurant}' },
      { name: 'Chicken Karaage', price: 2, rating: 4.6, description: 'Crispy bites with yuzu mayo at {restaurant}' },
      { name: 'Agedashi Tofu', price: 2, rating: 4.5, description: 'Dashi broth, scallions, bonito at {restaurant}' }
    ],
    mains: [
      { name: 'Spicy Tuna Roll', price: 3, rating: 4.7, description: 'Sushi classic with chili mayo at {restaurant}' },
      { name: 'Dragon Roll', price: 3, rating: 4.6, description: 'Tempura shrimp, avocado, eel sauce at {restaurant}' },
      { name: 'Pork Tonkotsu Ramen', price: 3, rating: 4.7, description: 'Rich broth, chashu, soy egg at {restaurant}' },
      { name: 'Miso Glazed Black Cod', price: 4, rating: 4.7, description: 'Caramelized marinade, bok choy at {restaurant}' },
      { name: 'Chicken Katsu Curry', price: 3, rating: 4.6, description: 'Panko cutlet, Japanese curry at {restaurant}' },
      { name: 'Yaki Udon with Steak', price: 3, rating: 4.6, description: 'Thick noodles, vegetables, savory sauce at {restaurant}' },
      { name: 'Salmon Nigiri Flight', price: 4, rating: 4.7, description: 'Seasonal cuts over sushi rice at {restaurant}' },
      { name: 'Unagi Don', price: 4, rating: 4.6, description: 'Grilled eel over rice, pickles at {restaurant}' }
    ],
    sides: [
      { name: 'Miso Soup', price: 1, rating: 4.4, description: 'Silken tofu and wakame at {restaurant}' },
      { name: 'Seaweed Salad', price: 1, rating: 4.5, description: 'Sesame dressing, mixed seaweed at {restaurant}' },
      { name: 'Steamed Edamame', price: 1, rating: 4.4, description: 'Sea salt finish at {restaurant}' }
    ],
    desserts: [
      { name: 'Matcha Tiramisu', price: 2, rating: 4.6, description: 'Green tea mascarpone layers at {restaurant}' },
      { name: 'Mochi Ice Cream Duo', price: 2, rating: 4.6, description: 'Rotating flavors, chewy shells at {restaurant}' }
    ],
    drinks: [
      { name: 'Yuzu Spritz', price: 2, rating: 4.5, description: 'Citrus soda with mint at {restaurant}' },
      { name: 'Iced Matcha Latte', price: 2, rating: 4.5, description: 'Stone-ground tea, vanilla foam at {restaurant}' }
    ]
  },
  brunch: {
    apps: [
      { name: 'Avocado Toast with Pickled Onions', price: 2, rating: 4.6, description: 'Sourdough, chili crunch, soft herbs at {restaurant}' },
      { name: 'Smoked Salmon Board', price: 3, rating: 4.6, description: 'Capers, dill, whipped cream cheese at {restaurant}' },
      { name: 'Seasonal Fruit Parfait', price: 2, rating: 4.5, description: 'Greek yogurt, house granola, honey at {restaurant}' }
    ],
    mains: [
      { name: 'Brioche French Toast', price: 3, rating: 4.6, description: 'Cinnamon batter, maple syrup, berries at {restaurant}' },
      { name: 'Short Rib Hash', price: 3, rating: 4.6, description: 'Crispy potatoes, poached eggs, hollandaise at {restaurant}' },
      { name: 'Shakshuka with Feta', price: 3, rating: 4.6, description: 'Baked eggs in spiced tomato sauce at {restaurant}' },
      { name: 'Breakfast Burrito', price: 2, rating: 4.5, description: 'Scrambled eggs, sausage, cheddar, salsa verde at {restaurant}' },
      { name: 'Buttermilk Pancake Stack', price: 2, rating: 4.6, description: 'Warm maple syrup and butter at {restaurant}' },
      { name: 'Quinoa Power Bowl', price: 3, rating: 4.5, description: 'Roasted veggies, lemon tahini, soft egg at {restaurant}' },
      { name: 'Chicken and Waffles', price: 3, rating: 4.6, description: 'Crispy tenders, hot honey at {restaurant}' },
      { name: 'Garden Omelette', price: 2, rating: 4.5, description: 'Seasonal vegetables, goat cheese at {restaurant}' }
    ],
    sides: [
      { name: 'Smoked Bacon', price: 2, rating: 4.5, description: 'Thick-cut, maple glazed at {restaurant}' },
      { name: 'Crispy Home Fries', price: 1, rating: 4.4, description: 'Caramelized onions, herbs at {restaurant}' },
      { name: 'Seasonal Greens Salad', price: 2, rating: 4.4, description: 'Citrus vinaigrette at {restaurant}' }
    ],
    desserts: [
      { name: 'Cinnamon Roll with Cream Cheese Frosting', price: 2, rating: 4.6, description: 'Warm and gooey at {restaurant}' }
    ],
    drinks: [
      { name: 'Cold Brew Coffee', price: 2, rating: 4.5, description: 'Slow steeped, chocolatey finish at {restaurant}' },
      { name: 'Fresh Orange Mimosa', price: 2, rating: 4.5, description: 'Sparkling and bright at {restaurant}' }
    ]
  },
  bbq: {
    apps: [
      { name: 'Smoked Wings', price: 3, rating: 4.6, description: 'Alabama white sauce at {restaurant}' },
      { name: 'Burnt Ends', price: 3, rating: 4.6, description: 'Sweet and smoky brisket tips at {restaurant}' },
      { name: 'Fried Okra Basket', price: 2, rating: 4.4, description: 'Buttermilk breaded with ranch at {restaurant}' }
    ],
    mains: [
      { name: 'St. Louis Cut Ribs', price: 4, rating: 4.7, description: 'Slow smoked, bourbon BBQ glaze at {restaurant}' },
      { name: 'Pulled Pork Sandwich', price: 3, rating: 4.6, description: 'Vinegar slaw, brioche bun at {restaurant}' },
      { name: 'Smokehouse Brisket Plate', price: 4, rating: 4.6, description: '12-hour brisket, pickled onions at {restaurant}' },
      { name: 'Half Chicken with White Sauce', price: 3, rating: 4.5, description: 'Charred lemon and pickles at {restaurant}' },
      { name: 'BBQ Sundae', price: 2, rating: 4.5, description: 'Layers of pork, beans, slaw in a jar at {restaurant}' },
      { name: 'Sausage Trio', price: 3, rating: 4.5, description: 'House links, mustard, onions at {restaurant}' },
      { name: 'Brisket Chili', price: 2, rating: 4.5, description: 'Cheddar, scallions, cornbread at {restaurant}' },
      { name: 'Smoked Turkey Plate', price: 3, rating: 4.4, description: 'White bread, dill pickles at {restaurant}' }
    ],
    sides: [
      { name: 'Jalapeno Cheddar Cornbread', price: 2, rating: 4.6, description: 'Honey butter on the side at {restaurant}' },
      { name: 'BBQ Baked Beans', price: 1, rating: 4.5, description: 'Molasses and burnt ends at {restaurant}' },
      { name: 'Creamy Slaw', price: 1, rating: 4.4, description: 'Celery seed dressing at {restaurant}' }
    ],
    desserts: [
      { name: 'Banana Pudding', price: 2, rating: 4.7, description: 'Vanilla wafers, whipped cream at {restaurant}' }
    ],
    drinks: [
      { name: 'Draft Root Beer', price: 1, rating: 4.4, description: 'Cold and frothy at {restaurant}' },
      { name: 'Peach Sweet Tea', price: 1, rating: 4.4, description: 'Stone-fruit syrup and lemon at {restaurant}' }
    ]
  },
  steakhouse: {
    apps: [
      { name: 'Bacon-Wrapped Shrimp', price: 3, rating: 4.6, description: 'Chipotle butter at {restaurant}' },
      { name: 'Crab Cake with Remoulade', price: 4, rating: 4.6, description: 'Lump crab, lemon caper aioli at {restaurant}' },
      { name: 'Steakhouse Wedge Salad', price: 3, rating: 4.6, description: 'Blue cheese, bacon, heirloom tomato at {restaurant}' }
    ],
    mains: [
      { name: 'Center-Cut Filet Mignon', price: 5, rating: 4.8, description: 'Butter-basted, au poivre at {restaurant}' },
      { name: 'Bone-In Ribeye', price: 5, rating: 4.8, description: 'Wood-fired with sea salt crust at {restaurant}' },
      { name: 'Prime Rib Roast', price: 5, rating: 4.7, description: 'Slow roasted, horseradish cream at {restaurant}' },
      { name: 'Grilled Lamb Chops', price: 4, rating: 4.7, description: 'Mint chimichurri, charred lemon at {restaurant}' },
      { name: 'Cedar Plank Salmon', price: 4, rating: 4.6, description: 'Honey chipotle glaze at {restaurant}' },
      { name: 'Smoked Chicken Pasta', price: 3, rating: 4.5, description: 'Asiago cream sauce, penne at {restaurant}' },
      { name: 'Steak Frites', price: 4, rating: 4.6, description: 'Bistro butter, shoestring fries at {restaurant}' },
      { name: 'Roasted Garlic Mashed Potatoes', price: 2, rating: 4.5, description: 'Creamy Yukon mash at {restaurant}' }
    ],
    sides: [
      { name: 'Creamed Spinach', price: 2, rating: 4.5, description: 'Nutmeg and parmesan at {restaurant}' },
      { name: 'Lobster Mac and Cheese', price: 3, rating: 4.6, description: 'Butter-poached lobster pieces at {restaurant}' },
      { name: 'Roasted Brussels with Bacon', price: 2, rating: 4.5, description: 'Maple glaze at {restaurant}' }
    ],
    desserts: [
      { name: 'Classic Crème Brûlée', price: 2, rating: 4.6, description: 'Vanilla bean custard at {restaurant}' },
      { name: 'Flourless Chocolate Torte', price: 3, rating: 4.6, description: 'Espresso whipped cream at {restaurant}' }
    ],
    drinks: [
      { name: 'Cabernet Sauvignon Glass', price: 3, rating: 4.5, description: 'Rich tannins for steaks at {restaurant}' }
    ]
  },
  greek: {
    apps: [
      { name: 'Hummus and Warm Pita', price: 2, rating: 4.5, description: 'Olive oil, smoked paprika at {restaurant}' },
      { name: 'Spanakopita', price: 2, rating: 4.6, description: 'Spinach and feta phyllo triangles at {restaurant}' },
      { name: 'Grilled Halloumi', price: 3, rating: 4.5, description: 'Lemon and oregano at {restaurant}' }
    ],
    mains: [
      { name: 'Classic Lamb Gyro', price: 3, rating: 4.7, description: 'Tomato, onion, tzatziki, warm pita at {restaurant}' },
      { name: 'Chicken Souvlaki Plate', price: 3, rating: 4.6, description: 'Skewers, lemon potatoes, pita at {restaurant}' },
      { name: 'Aegean Shrimp Saganaki', price: 4, rating: 4.6, description: 'Tomato, feta, ouzo at {restaurant}' },
      { name: 'Moussaka', price: 4, rating: 4.6, description: 'Layered eggplant, béchamel at {restaurant}' },
      { name: 'Falafel Bowl', price: 2, rating: 4.5, description: 'Herbed falafel, cucumber salad, tahini at {restaurant}' },
      { name: 'Roasted Lemon Chicken', price: 3, rating: 4.5, description: 'Crispy potatoes and garlic at {restaurant}' },
      { name: 'Dolmades Plate', price: 2, rating: 4.4, description: 'Stuffed grape leaves with avgolemono at {restaurant}' },
      { name: 'Greek Village Salad', price: 2, rating: 4.5, description: 'Tomato, cucumber, feta, olives at {restaurant}' }
    ],
    sides: [
      { name: 'Feta Fries', price: 2, rating: 4.5, description: 'Crispy fries, feta crumble, oregano at {restaurant}' },
      { name: 'Lemon Orzo', price: 2, rating: 4.4, description: 'Herbs and olive oil at {restaurant}' }
    ],
    desserts: [
      { name: 'Baklava', price: 2, rating: 4.7, description: 'Honey and walnut layers at {restaurant}' },
      { name: 'Loukoumades', price: 2, rating: 4.6, description: 'Fried dough puffs with honey syrup at {restaurant}' }
    ],
    drinks: [
      { name: 'Greek Frappe', price: 2, rating: 4.4, description: 'Iced coffee foam at {restaurant}' }
    ]
  },
  mixed: {
    apps: [
      { name: 'Charred Shishito Peppers', price: 2, rating: 4.5, description: 'Citrus salt and aioli at {restaurant}' },
      { name: 'House Charcuterie Board', price: 4, rating: 4.6, description: 'Rotating meats, cheeses, mustards at {restaurant}' },
      { name: 'Roasted Beet Hummus', price: 2, rating: 4.5, description: 'Pita crisps and herbs at {restaurant}' }
    ],
    mains: [
      { name: 'Herb-Roasted Chicken', price: 3, rating: 4.5, description: 'Pan jus, mashed potatoes at {restaurant}' },
      { name: 'Seared Tuna Bowl', price: 4, rating: 4.6, description: 'Soba noodles, sesame vegetables at {restaurant}' },
      { name: 'Coconut Curry Vegetables', price: 3, rating: 4.5, description: 'Chickpeas, sweet potato, jasmine rice at {restaurant}' },
      { name: 'Crispy Chicken Tenders', price: 2, rating: 4.4, description: 'Buttermilk brine, house dips at {restaurant}' },
      { name: 'Mediterranean Grain Bowl', price: 3, rating: 4.5, description: 'Farro, roasted veggies, feta at {restaurant}' },
      { name: 'Wild Mushroom Flatbread', price: 3, rating: 4.5, description: 'Goat cheese, arugula, balsamic at {restaurant}' },
      { name: 'Spicy Shrimp Tacos', price: 3, rating: 4.5, description: 'Avocado crema, lime slaw at {restaurant}' },
      { name: 'House Veggie Burger', price: 2, rating: 4.4, description: 'Black bean patty, chipotle aioli at {restaurant}' }
    ],
    sides: [
      { name: 'Truffle Parmesan Fries', price: 2, rating: 4.6, description: 'Herb aioli dip at {restaurant}' },
      { name: 'Simple Greens Salad', price: 1, rating: 4.4, description: 'Lemon vinaigrette at {restaurant}' },
      { name: 'Roasted Sweet Potatoes', price: 2, rating: 4.4, description: 'Smoked paprika and honey at {restaurant}' }
    ],
    desserts: [
      { name: 'Salted Caramel Brownie', price: 2, rating: 4.6, description: 'Vanilla ice cream at {restaurant}' },
      { name: 'Seasonal Fruit Crisp', price: 2, rating: 4.5, description: 'Oat crumble, whipped cream at {restaurant}' }
    ],
    drinks: [
      { name: 'House Kombucha', price: 2, rating: 4.4, description: 'Rotating tap flavor at {restaurant}' },
      { name: 'Sparkling Hibiscus Cooler', price: 2, rating: 4.4, description: 'Floral and bright at {restaurant}' }
    ]
  }
}

function buildRichMenu(restaurantName, cuisineKey = 'mixed') {
  const template = MENU_TEMPLATES[cuisineKey] || MENU_TEMPLATES.mixed
  const merged = [
    ...(template.apps || []),
    ...(template.mains || []),
    ...(template.sides || []),
    ...(template.desserts || []),
    ...(template.drinks || [])
  ]

  return merged.map((item) => ({
    ...item,
    description: (item.description || '').replace('{restaurant}', restaurantName || 'this restaurant') || undefined
  }))
}

function ensureRichMenu(baseItems = [], restaurantName = '') {
  const target = 24
  const cuisineKey = detectCuisine(restaurantName)
  if ((baseItems?.length || 0) >= target) return baseItems

  const filler = buildRichMenu(restaurantName, cuisineKey)
  const seen = new Set(baseItems.map((i) => (i.name || '').toLowerCase()))
  const merged = [...baseItems]

  for (const item of filler) {
    if (!seen.has((item.name || '').toLowerCase())) {
      merged.push(item)
      seen.add((item.name || '').toLowerCase())
    }
    if (merged.length >= target) break
  }

  return merged
}

async function callYelp(path, params = '') {
  if (isPlaceholder(YELP_KEY, 'your-yelp-api-key-here')) {
    console.warn('YELP_API_KEY missing or placeholder; skipping Yelp call')
    return { businesses: [] }
  }
  const url = `https://api.yelp.com/v3${path}${params ? `?${params}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${YELP_KEY}` } })
  if (!res.ok) {
    const text = await res.text()
    console.warn(`Yelp call failed (${res.status}): ${text}`)
    return { businesses: [] }
  }
  return res.json()
}

async function searchYelpRestaurant(restaurantName, location = 'Charlotte') {
  try {
    const params = new URLSearchParams({
      term: restaurantName,
      location: location,
      limit: '1'
    })
    const data = await callYelp('/businesses/search', params.toString())
    return (data.businesses || [])[0] || null
  } catch (e) {
    console.warn(`Failed to search for ${restaurantName}:`, e.message)
    return null
  }
}

async function getMenuData(restaurantName) {
  const resolved = resolveMenuName(restaurantName)
  // First check our database (with aliases)
  if (resolved && RESTAURANT_MENUS[resolved]) {
    return ensureRichMenu(RESTAURANT_MENUS[resolved].items, resolved)
  }
  
  // If not in database, search Yelp and return mock menu
  try {
    const business = await searchYelpRestaurant(restaurantName)
    if (business) {
      console.log(`Found ${restaurantName} on Yelp: ${business.url}`)
    }
  } catch (e) {
    console.warn('Yelp search failed:', e.message)
  }
  
  // Return curated menu based on restaurant name patterns
  return ensureRichMenu(generateMenuByType(restaurantName), restaurantName)
}

function generateMenuByType(restaurantName) {
  const cuisineKey = detectCuisine(restaurantName || '')
  const generated = buildRichMenu(restaurantName, cuisineKey)
  return ensureRichMenu(generated, restaurantName)
}

async function main() {
  console.log('🍽️ Fetching comprehensive menus for all restaurants...\n')
  
  const restaurants = [
    'Bao & Co',
    'Saffron Spoon',
    'Green Fork',
    'La Pasta Fresca',
    'Burger Bar'
  ]
  
  const result = {}
  
  for (const restaurantName of restaurants) {
    try {
      console.log(`📍 ${restaurantName}...`)
      const menu = await getMenuData(restaurantName)
      result[restaurantName] = {
        itemCount: menu.length,
        items: menu
      }
      console.log(`   ✅ Found ${menu.length} menu items\n`)
    } catch (e) {
      console.warn(`   ❌ Error: ${e.message}\n`)
      result[restaurantName] = { itemCount: 0, items: [] }
    }
  }
  
  // Save to file
  const outputPath = path.resolve('./data/restaurant_menus.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  
  console.log(`\n✅ Complete! Saved to ${outputPath}`)
  console.log(`\nSummary:`)
  Object.entries(result).forEach(([name, data]) => {
    console.log(`  ${name}: ${data.itemCount} items`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
}

export { RESTAURANT_MENUS, getMenuData, generateMenuByType }
