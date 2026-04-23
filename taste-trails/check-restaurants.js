import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check current state
const { count } = await supabase.from('restaurants').select('*', { count: 'exact' });
const { count: nullCount } = await supabase.from('restaurants').select('*', { count: 'exact' }).filter('lat', 'is', null);
const { count: validCount } = await supabase.from('restaurants').select('*', { count: 'exact' }).filter('lat', 'not.is', null);

console.log('Restaurant table status:');
console.log('  Total records:', count);
console.log('  With NULL lat:', nullCount);
console.log('  With valid lat:', validCount);
