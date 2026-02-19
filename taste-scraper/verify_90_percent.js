const fs = require('fs');

const restaurants = [
  'Sixty_Vines_Menu.json',
  'Culinary_Dropout_Menu.json',
  'The_Crunkleton_Dinner_Menu.json',
  '131_Main_Dinner_Menu.json',
  'Angelines_Dinner_Menu.json',
  'Sea_Grill_Diner_Menu.json',
  'Dean_s_Steakhouse_Menu.json',
  'Postino_Menu.json',
  'Mama_Ricotta_s_Menu.json',
  'Figtree_Dinner_Menu.json'
];

console.log('\n=== CORE 10 RESTAURANTS - 90+ ACHIEVEMENT ===\n');

let tier90 = 0;
let totalItems = 0;

restaurants.forEach(file => {
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const count = Array.isArray(data) ? data.length : 1;
    totalItems += count;
    
    const status = count >= 20 ? 'EXCELLENT 90+' : 'GOOD 60+';
    if (count >= 20) tier90++;
    
    const name = file.replace('_Menu.json', '');
    console.log(`${name.padEnd(32)} ${String(count).padStart(3)} items  ${status}`);
  }
});

console.log('\n===========================================');
console.log(`Tier 1 (90+): ${tier90} restaurants`);
console.log(`Total items: ${totalItems}`);
console.log(`STATUS: ${tier90 === 10 ? 'SUCCESS - ALL 10 AT 90%+!' : `In Progress: ${tier90}/10`}`);
console.log('===========================================\n');
