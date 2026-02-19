const fs = require('fs')
const path = require('path')

function loadEnvFile(envPath) {
  try {
    if (!fs.existsSync(envPath)) return
    const raw = fs.readFileSync(envPath, 'utf8')
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m) {
        const key = m[1]
        let val = m[2]
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
        if (process.env[key] === undefined || process.env[key] === '') process.env[key] = val
      }
    })
  } catch (e) {
    // ignore
  }
}

// load root .env and menu-ingestion/.env
try {
  const roots = [path.join(process.cwd(), '.env'), path.join(process.cwd(), 'menu-ingestion', '.env')]
  for (const envPath of roots) {
    if (!fs.existsSync(envPath)) continue
    const raw = fs.readFileSync(envPath, 'utf8')
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m) {
        const key = m[1]
        let val = m[2]
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
        if (process.env[key] === undefined || process.env[key] === '') process.env[key] = val
      }
    })
  }
} catch (e) {
  // ignore
}

(async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing')
    process.exit(1)
  }
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    })
    console.log('status', res.status)
    const j = await res.json()
    console.log(j && j.data && j.data[0] && j.data[0].id ? j.data[0].id : 'OK')
    process.exit(res.ok ? 0 : 1)
  } catch (e) {
    console.error('request failed', e.message)
    process.exit(1)
  }
})()
