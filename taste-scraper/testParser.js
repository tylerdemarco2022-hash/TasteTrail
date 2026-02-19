require("dotenv").config();
const parseMenu = require("./aiParser");

const testMenuText = `
APPETIZERS
Fried Calamari $12.95
Lightly breaded and served with marinara sauce

Bruschetta $8.95
Fresh tomatoes, basil, garlic, olive oil on toasted bread

Spinach Artichoke Dip $10.95
Creamy blend of spinach and artichokes, served with tortilla chips

MAIN COURSES
Grilled Salmon $24.95
Atlantic salmon with lemon butter, served with seasonal vegetables

Chicken Parmesan $18.95
Breaded chicken breast with marinara and melted mozzarella, served with pasta

NY Strip Steak $32.95
12oz Prime cut, served with mashed potatoes and asparagus

Vegetable Pasta $15.95
Fresh seasonal vegetables in garlic olive oil with penne

DESSERTS
Tiramisu $8.95
Classic Italian dessert with espresso-soaked ladyfingers

Chocolate Lava Cake $9.95
Warm chocolate cake with molten center, served with vanilla ice cream
`;

async function test() {
  console.log("Testing AI parser with sample menu text...");
  try {
    const result = await parseMenu(testMenuText);
    console.log("Parsed menu:");
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
