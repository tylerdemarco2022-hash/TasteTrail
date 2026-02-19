const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// DEBUG: verify env loading
console.log('SUPABASE_URL:', supabaseUrl);
console.log('SUPABASE_KEY exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase not configured — running without DB');
  module.exports = null;
} else {
  const supabase = createClient(supabaseUrl, supabaseKey);
  module.exports = supabase;
}
