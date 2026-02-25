import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  console.log('Checking restaurants table schema...\n');

  // Try a test query to see what columns work
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error querying table:', error.message);
    console.log('Code:', error.code);
  } else if (data && data.length > 0) {
    const cols = Object.keys(data[0]);
    console.log('Columns found in restaurants table:');
    cols.forEach(col => console.log(`  - ${col}`));
  } else {
    console.log('No rows in table. Checking if table exists with count...');
    const { count, error: err2 } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true });
    
    if (err2) {
      console.log('Error:', err2.message);
    } else {
      console.log('Table exists with', count, 'rows (but no data returned by select *)');
      console.log('This might indicate restricted RLS or table is empty.');
      
      // Try querying with specific columns
      console.log('\nTrying to query specific columns...');
      const { data: test1, error: err3 } = await supabase
        .from('restaurants')
        .select('id, name, lat, lng')
        .limit(1);
      
      if (!err3) {
        console.log('Successfully queried: id, name, lat, lng');
      } else {
        console.log('Error with basic columns:', err3.message);
      }
    }
  }
}

checkSchema().catch(console.error);
