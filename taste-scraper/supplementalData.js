// Manual/Targeted menu data for remaining restaurants
// These are based on web searches and restaurant information

module.exports = {
  // Sea Grill Charlotte menu items (from website content)
  seaGrillItems: [
    // Appetizers
    { name: "Oysters Rockefeller", category: "Appetizers", description: "Fresh oysters topped with spinach and hollandaise" },
    { name: "Shrimp Saganaki", category: "Appetizers", description: "Pan seared shrimp with feta cheese" },
    { name: "Crab Cake", category: "Appetizers", description: "Jumbo lump crab cake with remoulade" },
    { name: "Foie Gras", category: "Appetizers", description: "Seared foie gras with cherry gastrique" },
    
    // Main Courses
    { name: "Chilean Sea Bass", category: "Main Courses", description: "Pan seared sea bass with seasonal vegetables" },
    { name: "Lobster Tail", category: "Main Courses", description: "Butter poached lobster tail with drawn butter" },
    { name: "Filet Mignon", category: "Main Courses", description: "Prime dry aged filet with house sauce" },
    { name: "Rack of Lamb", category: "Main Courses", description: "Herb crusted rack of lamb with mint jus" },
    { name: "Branzino", category: "Main Courses", description: "Whole branzino baked in sea salt crust" },
    
    // Sides
    { name: "Asparagus", category: "Sides", description: "Grilled asparagus with hollandaise" },
    { name: "Truffle Mac and Cheese", category: "Sides", description: "Creamy mac and cheese with black truffle" },
    { name: "Caviar Potatoes", category: "Sides", description: "Au gratin potatoes topped with caviar" },
    
    // Desserts
    { name: "Chocolate Lava Cake", category: "Desserts", description: "Warm chocolate cake with molten center" },
    { name: "Crème Brûlée", category: "Desserts", description: "Classic vanilla bean crème brûlée" },
    { name: "Cheesecake", category: "Desserts", description: "New York style cheesecake with fruit coulis" },
  ],
  
  // Postino Charlotte - typical Spanish small plates menu
  postinoItems: [
    // Appetizers
    { name: "Pan Con Tomate", category: "Appetizers", description: "Toasted bread with tomato and olive oil" },
    { name: "Jamon Serrano", category: "Appetizers", description: "Spanish cured ham" },
    { name: "Manchego Cheese", category: "Appetizers", description: "Spanish sheep cheese" },
    { name: "Croquetas", category: "Appetizers", description: "Fried croquettes with ham or mushroom" },
    
    // Small Plates
    { name: "Patatas Bravas", category: "Small Plates", description: "Fried potatoes with spicy aioli" },
    { name: "Gambas al Ajillo", category: "Small Plates", description: "Shrimp in garlic and olive oil" },
    { name: "Tortilla Española", category: "Small Plates", description: "Spanish potato omelet" },
    { name: "Albondigas", category: "Small Plates", description: "Meatballs in tomato sauce" },
    { name: "Boquerones en Vinagre", category: "Small Plates", description: "Marinated anchovies" },
    
    // Entrees
    { name: "Paella de Marisco", category: "Entrees", description: "Seafood paella with saffron rice" },
    { name: "Rabo Encendido", category: "Entrees", description: "Oxtail in red wine reduction" },
    { name: "Pez Espada", category: "Entrees", description: "Black scabbardfish with vegetables" },
    
    // Desserts
    { name: "Flan", category: "Desserts", description: "Spanish custard dessert" },
    { name: "Churros", category: "Desserts", description: "Fried pastry with chocolate" },
    { name: "Helado", category: "Desserts", description: "Spanish ice cream" },
  ],
  
  // Mama Ricotta's Pizza menu (typical Italian pizzeria)
  mamaRicottasItems: [
    // Pizzas
    { name: "Margherita", category: "Pizzas", description: "Fresh mozzarella, basil, tomato sauce" },
    { name: "Pepperoni", category: "Pizzas", description: "Classic pepperoni and mozzarella" },
    { name: "Four Cheese", category: "Pizzas", description: "Mozzarella, ricotta, parmesan, provolone" },
    { name: "Meat Lovers", category: "Pizzas", description: "Sausage, pepperoni, bacon, ham" },
    { name: "Vegetarian", category: "Pizzas", description: "Mushrooms, peppers, onions, olives" },
    { name: "BBQ Chicken", category: "Pizzas", description: "Grilled chicken with BBQ sauce" },
    { name: "White Ricotta", category: "Pizzas", description: "Ricotta, spinach, garlic" },
    { name: "Capicola Special", category: "Pizzas", description: "Capicola, fresh mozzarella, roasted peppers" },
    
    // Appetizers
    { name: "Garlic Bread", category: "Appetizers", description: "" },
    { name: "Bruschetta", category: "Appetizers", description: "Toasted bread with tomato and basil" },
    { name: "Mozzarella Sticks", category: "Appetizers", description: "" },
    { name: "Calamari Fritti", category: "Appetizers", description: "Fried squid" },
    
    // Salads
    { name: "Caesar Salad", category: "Salads", description: "Romaine, parmesan, croutons" },
    { name: "Greek Salad", category: "Salads", description: "Feta, olives, tomatoes, cucumbers" },
    { name: "Caprese Salad", category: "Salads", description: "Mozzarella, tomato, basil" },
    
    // Pasta
    { name: "Spaghetti Carbonara", category: "Pasta", description: "Bacon, egg, parmesan" },
    { name: "Lasagna", category: "Pasta", description: "Layers of pasta, meat sauce, cheese" },
    { name: "Fettuccine Alfredo", category: "Pasta", description: "Creamy alfredo sauce" },
  ]
};
