const logger = require('../services/logger');
const supabase = require('../services/supabaseClient');
const metrics = require('../services/metrics');

async function classifyMenu(restaurant, menu) {
  try {
    // If no API key, skip classification gracefully
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('classificationAgent: OPENAI_API_KEY not set, skipping classification');
      return { cuisine: [], dietary_tags: [], embedding: null };
    }

    // Lazy-load OpenAI client so missing key does not crash at import time
    let openaiClient;
    let DEFAULTS = {};
    try {
      const mod = require('../services/openaiClient');
      openaiClient = mod.openai;
      DEFAULTS = mod.DEFAULTS || {};
    } catch (e) {
      console.error("🔥 OpenAI Classification Error:");
      console.error("Message:", e?.message);
      console.error("Stack:", e?.stack);
      if (e?.response?.data) {
        console.error("Response:", e.response.data);
      }
      return { cuisine: [], dietary_tags: [], embedding: null };
    }

    const text = `${restaurant.name}\n${(menu.menu_sections||[]).map(s=>s.section+': '+(s.items||[]).map(i=>i.name).join(', ')).join('\n')}`;

    // simple classification prompt
    const prompt = `Given this restaurant menu, respond JSON with {"cuisine":[], "dietary_tags":[] } based on menu items: ${text}`;

    // Chat completion with safe token limit and error handling
    let completion = null;
    try {
      try { metrics.openaiCalls.inc(1); } catch (e) {}
      completion = await openaiClient.chat.completions.create({
        model: DEFAULTS.MODEL_CHAT || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.min(DEFAULTS.MAX_TOKENS || 400, 400),
      });
      const tokenUsage = completion.usage?.total_tokens ?? completion.usage?.prompt_tokens ?? null;
      logger.info('classificationAgent: chat tokens used=%s', tokenUsage);
    } catch (e) {
      console.error("🔥 OpenAI Classification Error:");
      console.error("Message:", e?.message);
      console.error("Stack:", e?.stack);
      if (e?.response?.data) {
        console.error("Response:", e.response.data);
      }
    }

    let parsed = { cuisine: [], dietary_tags: [] };
    try {
      const raw = completion?.choices?.[0]?.message?.content || '';
      if (raw) parsed = JSON.parse(raw);
    } catch (e) {
      console.error("🔥 OpenAI Classification Error:");
      console.error("Message:", e?.message);
      console.error("Stack:", e?.stack);
      if (e?.response?.data) {
        console.error("Response:", e.response.data);
      }
    }

    // embeddings for menu summary
    const items = (menu.menu_sections || []).flatMap(s => s.items || []);
    const maxItems = DEFAULTS.MAX_EMBEDDING_ITEMS || 50;
    if (items.length > maxItems) {
      logger.warn('classificationAgent: truncating embeddings request from %d to %d items', items.length, maxItems);
    }
    const itemsToUse = items.slice(0, maxItems);
    const summary = `${restaurant.name}\n${itemsToUse.map(i => i.name).join('\n')}`.slice(0, 2000);

    let embedding = null;
    try {
      try { metrics.openaiCalls.inc(1); } catch (e) {}
      const emb = await openaiClient.embeddings.create({ model: DEFAULTS.MODEL_EMBEDDING || 'text-embedding-3-small', input: summary });
      embedding = emb.data?.[0]?.embedding || null;
      const embTokens = emb.usage?.total_tokens ?? emb.usage?.prompt_tokens ?? null;
      logger.info('classificationAgent: embedding tokens used=%s', embTokens);
    } catch (e) {
      console.error("🔥 OpenAI Classification Error:");
      console.error("Message:", e?.message);
      console.error("Stack:", e?.stack);
      if (e?.response?.data) {
        console.error("Response:", e.response.data);
      }
    }

    return { cuisine: parsed.cuisine || [], dietary_tags: parsed.dietary_tags || [], embedding };
  } catch (err) {
    console.error("🔥 OpenAI Classification Error:");
    console.error("Message:", err?.message);
    console.error("Stack:", err?.stack);
    if (err?.response?.data) {
      console.error("Response:", err.response.data);
    }
    return {
      cuisine: [],
      dietary_tags: [],
      embedding: null
    };
  }
}

async function persistClassification(restaurantId, classification) {
  try {
    await supabase.from('restaurants').update({ cuisine: classification.cuisine, dietary_tags: classification.dietary_tags, embedding: classification.embedding }).eq('id', restaurantId);
  } catch (err) {
    logger.error('persistClassification error: %s', err.message);
  }
}

module.exports = { classifyMenu, persistClassification };
