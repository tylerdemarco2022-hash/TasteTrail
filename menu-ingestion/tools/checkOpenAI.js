require('dotenv').config()
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
    console.log(j?.data?.[0]?.id || 'OK')
    process.exit(res.ok ? 0 : 1)
  } catch (e) {
    console.error('request failed', e.message)
    process.exit(1)
  }
})()
