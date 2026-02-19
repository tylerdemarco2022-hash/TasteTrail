const { OpenAI } = require('openai');
const logger = require('./logger');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  const err = new Error('Missing OPENAI_API_KEY environment variable. Set OPENAI_API_KEY in your environment or .env file.');
  err.code = 'MISSING_OPENAI_KEY';
  // Throwing here ensures callers that intentionally require the client without checking will get a clear error.
  throw err;
}

const openai = new OpenAI({ apiKey });

const DEFAULTS = {
  MAX_TOKENS: 400,
  MAX_EMBEDDING_ITEMS: 50,
  MODEL_CHAT: process.env.OPENAI_MODEL || 'gpt-4-0613',
  MODEL_EMBEDDING: 'text-embedding-3-small',
};

module.exports = { openai, DEFAULTS };
