import 'dotenv/config';
console.time("BOOT_TIME");
import express from 'express';
import { safeJsonParse } from '../utils/safeJsonParse.js';

// Load environment variables from .env file
console.log("BACKEND ENTRY FILE EXECUTING");
console.log("SERVER STARTED");

// ================================================================
// ENVIRONMENT GUARDRAILS: Zero-trust startup validation
// ================================================================
// Fail fast if configuration is missing or invalid
// We do not deploy because "tests passed"
// We deploy because "startup checks passed"

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';

  // CRITICAL: If production, ADMIN_API_KEY must exist
  if (isProduction && !process.env.ADMIN_API_KEY) {
    const error = 'FATAL: NODE_ENV=production but ADMIN_API_KEY is missing!';
    console.error('════════════════════════════════════════════');
    console.error('❌ PRODUCTION STARTUP BLOCKED');
    console.error('════════════════════════════════════════════');
    console.error(error);
    console.error('');
    console.error('This is a safety feature. In production, the debug endpoint');
    console.error('requires ADMIN_API_KEY. Cannot start without it.');
    console.error('');
    console.error('Fix: Set ADMIN_API_KEY environment variable');
    console.error('════════════════════════════════════════════');
    process.exit(1);
  }

  console.log({
    message: 'Environment guardrails validated',
    nodeEnv: process.env.NODE_ENV || 'development',
    adminKeySet: !!process.env.ADMIN_API_KEY
  });
}

// Run environment checks before starting server
validateEnvironment();

// Scrape debounce tracker - prevents concurrent scrapes for same restaurant
const activeScrapers = new Set();

const app = express();
const PORT = process.env.PORT || 8081;
console.log(`Server is attempting to start on port: ${PORT}`);

// ================================================================
// REQUEST ID MIDDLEWARE: Attach unique ID to each request
// ================================================================
// Allows correlation of requests across load test and server logs
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

app.use((req, res, next) => {
  console.log(`[ROUTING] ${req.method} ${req.url} [${req.requestId}]`);
  next();
});

// OpenAI logic removed. AI disabled.
app.get('/__debug_openai', (req, res) => {
  res.status(501).json({ error: 'AI disabled' });
});

// Health check endpoint (root-level for login connectivity)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Health check endpoint (JSON response)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TasteTrails Backend',
    timestamp: new Date().toISOString()
  });
});

// Uncomment blocks one by one to isolate boot freeze
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("STEP 2: supabase client created");
validateEnvironment();
console.log("STEP 3: before listen");
console.log(`Server is attempting to start on port: ${PORT}`);
app.listen(PORT, () => {
  console.log("STEP 5: server listening");
  console.timeEnd("BOOT_TIME");
});
