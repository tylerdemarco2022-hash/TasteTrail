import dotenv from 'dotenv';
dotenv.config();

console.log('\n📋 ENVIRONMENT VERIFICATION\n');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) + '...');
console.log('SUPABASE_KEY prefix:', process.env.SUPABASE_KEY?.slice(0, 20) + '...');
console.log('\n✅ Compare this URL to your Supabase dashboard URL');
console.log('   Dashboard URL should match: https://supabase.com/dashboard/project/YOUR_PROJECT_ID\n');
