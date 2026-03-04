import fetch from 'node-fetch';

async function testAPI() {
  console.log('📡 Testing API endpoint...\n');
  
  const url = 'http://localhost:8081/api/top-dishes?days=7&limit=3&minRatings=1';
  console.log('URL:', url);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('\n✅ API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.topDishes && data.topDishes.length > 0) {
      console.log(`\n📊 Found ${data.topDishes.length} dishes`);
    } else {
      console.log('\n⚠️ No dishes returned');
      console.log('Period:', data.period);
      console.log('Message:', data.message);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testAPI();
