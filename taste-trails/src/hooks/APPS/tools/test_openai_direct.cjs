const fs = require('fs');
const path = require('path');

function loadEnv() {
  const roots = [path.join(process.cwd(), '.env'), path.join(process.cwd(), 'taste-trails', '.env'), path.join(process.cwd(), 'menu-ingestion', '.env'), path.join(process.cwd(), 'taste-trails', 'server', '.env')];
  for (const p of roots) {
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2];
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (process.env[key] === undefined || process.env[key] === '') process.env[key] = val;
      }
    });
  }
}

loadEnv();
const key = process.env.OPENAI_API_KEY;
if (!key) { console.error('no key'); process.exit(1) }

(async () => {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4-0613', messages: [{ role: 'user', content: 'Say hello' }], max_tokens: 10 })
    });
    console.log('status', res.status);
    const j = await res.json();
    console.log(JSON.stringify(j, null, 2));
  } catch (e) {
    console.error('request failed', e && e.message ? e.message : e);
  }
})();
