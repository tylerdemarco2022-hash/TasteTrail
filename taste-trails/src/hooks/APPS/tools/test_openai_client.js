const { openai, DEFAULTS } = require('../services/openaiClient')

async function test() {
  try {
    console.log('Using model:', DEFAULTS.MODEL_CHAT)
    const resp = await openai.chat.completions.create({ model: DEFAULTS.MODEL_CHAT, messages: [{ role: 'user', content: 'Say hello' }], temperature: 0 })
    console.log('resp status/shape:', typeof resp, Object.keys(resp || {}).slice(0,10))
    console.log(JSON.stringify(resp?.choices?.[0]?.message || resp, null, 2))
  } catch (e) {
    console.error('OpenAI call failed:', e && e.message ? e.message : e)
    if (e.response) {
      try { const body = await e.response.text(); console.error('Response body:', body) } catch (er) {}
    }
  }
}

test()
