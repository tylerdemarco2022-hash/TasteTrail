const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

let supabase = null;
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);
} else {
  console.warn('[api/src/db/supabase] SUPABASE_URL or key not set — exporting mock client');
  const mockResponse = { data: null, error: { message: 'Supabase disabled: missing env vars' } };
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => builder,
    then: (resolve) => Promise.resolve(mockResponse).then(resolve),
    catch: (reject) => Promise.resolve(mockResponse).catch(reject),
    finally: (fn) => Promise.resolve(mockResponse).finally(fn)
  };
  supabase = { from: () => builder, auth: { getUser: async () => ({ data: { user: null }, error: { message: 'Supabase disabled' } }) } };
}

module.exports = supabase;
