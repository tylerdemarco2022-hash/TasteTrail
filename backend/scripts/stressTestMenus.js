// Temporary bulk test script for menu URL extraction
const { spawn } = require('child_process');

const restaurants = [
  { name: 'STIR', city: 'Charlotte', state: 'NC' },
  { name: 'The Fig Tree', city: 'Charlotte', state: 'NC' },
  { name: 'Culinary Dropout', city: 'Charlotte', state: 'NC' },
  { name: 'Midnight Diner', city: 'Charlotte', state: 'NC' },
  { name: '131 Main', city: 'Charlotte', state: 'NC' }
];

async function runTest(restaurant) {
  return new Promise((resolve) => {
    const args = [
      'backend/scripts/findMenuUrlFromName.js',
      restaurant.name,
      restaurant.city,
      restaurant.state,
      '--headless'
    ];
    const proc = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { out += d.toString(); });
    proc.on('close', () => {
      let result = null;
      try {
        // Try to find the last JSON object in output
        const matches = out.match(/\{[\s\S]*\}/g);
        if (matches && matches.length) {
          result = JSON.parse(matches[matches.length - 1]);
        }
      } catch (e) {}
      resolve({ out, result });
    });
  });
}

(async () => {
  for (const r of restaurants) {
    console.log('==============================');
    console.log('Restaurant:', r.name);
    const { out, result } = await runTest(r);
    if (result) {
      console.log('Domain:', result.domain || 'N/A');
      console.log('Menu URL:', result.url || (result.menuResult && result.menuResult.url) || 'N/A');
      console.log('Confidence:', result.confidence || (result.menuResult && result.menuResult.confidence) || 'N/A');
      console.log('Method:', result.method || (result.menuResult && result.menuResult.method) || 'N/A');
    } else {
      console.log('No result parsed. Raw output:');
      console.log(out);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('==============================');
  console.log('Bulk menu URL test complete.');
})();
