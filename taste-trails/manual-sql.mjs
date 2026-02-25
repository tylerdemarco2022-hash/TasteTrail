import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT DEFAULT NULL;
`;

console.log('Attempting to add cover_photo_url column via Supabase REST API...\n');
console.log('SQL to execute:');
console.log(sql);
console.log('\n');

// Try using Supabase's SQL execution endpoint (if available)
// Otherwise, provide manual instructions
const instructions = `
MANUAL SETUP REQUIRED:
=====================

Since the programmatic API is not available, execute this SQL directly in Supabase:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Create new query
5. Paste this SQL:

${sql}

6. Click "RUN"

This will add the cover_photo_url column if it doesn't already exist.
`;

console.log(instructions);
