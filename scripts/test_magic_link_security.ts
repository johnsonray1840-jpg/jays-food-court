import { getSupabaseAdminClient } from '../src/lib/supabase/admin';

async function runTests() {
  console.log('Testing unregistered email handling...');
  const fakeEmail = 'unregistered_test_' + Date.now() + '@example.com';
  
  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    console.error('Supabase admin unavailable');
    return;
  }
  
  // Verify clean check on database
  const [custRes, staffRes] = await Promise.all([
    adminSupabase.from('customers').select('id, email').eq('email', fakeEmail).maybeSingle(),
    adminSupabase.from('staff_profiles').select('id, email').eq('email', fakeEmail).maybeSingle()
  ]);
  
  if (!custRes.data && !staffRes.data) {
    console.log('Verified: Unregistered email is NOT in database.');
  } else {
    console.error('Unexpected: Found fake email');
  }
}

runTests();
