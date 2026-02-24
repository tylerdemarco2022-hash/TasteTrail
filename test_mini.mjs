import menuScraperAgent from './agents/menuScraperAgent.js';

const testRestaurant = {
  name: 'Test Restaurant',
  menuUrl: 'https://www.culinarydropout.com/locations-menus/',
  website: 'https://www.culinarydropout.com/'
};

console.log('Starting minimal test...');
try {
  const result = await menuScraperAgent(testRestaurant);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('ERROR:', error.message);
  console.error('Stack:', error.stack);
}
