
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function test() {
  const res = await fetch('http://localhost:8081/api/scrape-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://www.131-main.com/menus/dinner-fall/',
      restaurant_id: 'test-uuid-131',
      restaurant_name: '131 Main'
    })
  });
  const data = await res.json();
  console.log(data);
}

test();
