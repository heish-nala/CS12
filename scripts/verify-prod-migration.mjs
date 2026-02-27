import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env vars from .env.local
const envFile = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) env[key.trim()] = valueParts.join('=').trim();
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function verify() {
  console.log('=== Production Verification: 01-02 Migration ===\n');
  let allPassed = true;

  // 1. organizations table - should have 1 row
  const { data: orgs, error: e1 } = await supabase.from('organizations').select('*');
  if (e1) { console.error('FAIL 1. Organizations error:', e1.message); allPassed = false; }
  else {
    const pass = orgs && orgs.length === 1;
    console.log(`${pass ? 'PASS' : 'FAIL'} 1. Organizations: ${orgs?.length} rows`);
    if (orgs?.[0]) console.log('     Name:', orgs[0].name, '| Slug:', orgs[0].slug);
    if (!pass) allPassed = false;
  }

  // 2. All DSOs should have non-null org_id
  const { data: dsos, error: e2 } = await supabase.from('dsos').select('name, org_id').order('name');
  if (e2) { console.error('FAIL 2. DSOs error:', e2.message); allPassed = false; }
  else {
    const nullDsos = dsos?.filter(d => !d.org_id) || [];
    const pass = dsos && dsos.length === 5 && nullDsos.length === 0;
    console.log(`${pass ? 'PASS' : 'FAIL'} 2. DSOs: ${dsos?.length} total, ${nullDsos.length} with null org_id`);
    dsos?.forEach(d => console.log(`     - ${d.name}: org_id=${d.org_id ? d.org_id.substring(0,8)+'...' : 'NULL'}`));
    if (!pass) allPassed = false;
  }

  // 3. org_members - should have 2 rows (Alan=owner, Claudia=admin)
  const { data: members, error: e3 } = await supabase.from('org_members').select('user_id, role');
  if (e3) { console.error('FAIL 3. Org members error:', e3.message); allPassed = false; }
  else {
    const pass = members && members.length === 2;
    console.log(`${pass ? 'PASS' : 'FAIL'} 3. Org members: ${members?.length} rows`);
    members?.forEach(m => console.log(`     - ${m.user_id.substring(0,8)}...: ${m.role}`));
    if (!pass) allPassed = false;
  }

  // 4. user_profiles - should have 2 rows (Alan, Claudia)
  // Note: user_profiles uses 'id' as PK (mirrors auth.users.id), not a separate 'user_id' column
  const { data: profiles, error: e4 } = await supabase.from('user_profiles').select('id, name, email');
  if (e4) { console.error('FAIL 4. User profiles error:', e4.message); allPassed = false; }
  else {
    const pass = profiles && profiles.length === 2;
    console.log(`${pass ? 'PASS' : 'FAIL'} 4. User profiles: ${profiles?.length} rows`);
    profiles?.forEach(p => console.log(`     - ${p.name} (${p.email})`));
    if (!pass) allPassed = false;
  }

  // 5. user_dso_access still exists
  const { data: access, error: e5 } = await supabase.from('user_dso_access').select('*');
  if (e5) { console.error('FAIL 5. user_dso_access error:', e5.message); allPassed = false; }
  else {
    const pass = access && access.length > 0;
    console.log(`${pass ? 'PASS' : 'FAIL'} 5. user_dso_access: ${access?.length} rows (table intact)`);
    if (!pass) allPassed = false;
  }

  // 6. Valentina should have 0 rows
  const { data: val, error: e6 } = await supabase.from('user_dso_access').select('*').eq('user_id', 'd0134916-0f52-4556-9fa0-4c66cff3198e');
  if (e6) { console.error('FAIL 6. Valentina check error:', e6.message); allPassed = false; }
  else {
    const pass = val && val.length === 0;
    console.log(`${pass ? 'PASS' : 'FAIL'} 6. Valentina access: ${val?.length} rows (should be 0)`);
    if (!pass) allPassed = false;
  }

  console.log('\n' + (allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
  process.exit(allPassed ? 0 : 1);
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
