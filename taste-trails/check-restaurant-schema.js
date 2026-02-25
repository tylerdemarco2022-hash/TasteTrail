import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Try to query information_schema directly
const { data: schemaData, error: schemaError } = await supabase
  .from('information_schema.columns')
  .select('column_name, data_type')
  .eq('table_name', 'restaurants')
  .eq('table_schema', 'public');

if (schemaError) {
  console.log('Direct schema query failed:', schemaError.message);
  console.log('\nTrying alternative approach...');
  
  // Try inserting a minimal record to see what columns are required
  const { error: insertError } = await supabase
    .from('restaurants')
    .insert([{ name: 'test' }]);
  
  if (insertError) {
    console.log('Insert error (this reveals required columns):');
    console.log(insertError.message);
  }
} else if (schemaData && schemaData.length > 0) {
  console.log('Columns in restaurants table:');
  schemaData.forEach(col => console.log(`  ${col.column_name} (${col.data_type})`));
} else {
  console.log('No columns found');
}
