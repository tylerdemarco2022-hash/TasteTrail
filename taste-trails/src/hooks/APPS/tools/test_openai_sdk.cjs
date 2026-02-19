const fs = require('fs');
const path = require('path');
function loadEnv() {
  const roots = [path.join(process.cwd(), '.env'), path.join(process.cwd(), 'taste-trails', '.env'), path.join(process.cwd(), 'menu-ingestion', '.env')];
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
(async () => {
  try {
    const { OpenAI } = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('created client');
    const resp = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say hi' }], temperature: 0 });
    console.log('sdk resp ok:', resp?.choices?.[0]?.message?.content || JSON.stringify(resp).slice(0,200));
  } catch (e) {
    console.error('sdk error', e && e.message);
    if (e.response) {
      try { const body = await e.response.text(); console.error('body:', body) } catch(e){}
    }
  }
})();
