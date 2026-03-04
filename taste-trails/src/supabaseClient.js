
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';

console.log("SUPABASE KEY PREFIX:", supabaseKey?.slice(0, 20));
console.log("SUPABASE URL:", supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseKey);
