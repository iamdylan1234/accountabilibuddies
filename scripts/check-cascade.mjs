// Pre-flight CASCADE audit: check FK constraints referencing profiles.id
// and auth.users.id to ensure ON DELETE CASCADE is set everywhere needed.
//
// Usage: node scripts/check-cascade.mjs

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const sql = `
SELECT
  tc.table_schema || '.' || tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_schema || '.' || ccu.table_name AS references_table,
  ccu.column_name AS references_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'profiles' OR (ccu.table_schema = 'auth' AND ccu.table_name = 'users'))
ORDER BY source_table, source_column;
`

console.log('Attempting Supabase rpc / raw SQL approach...')
console.log()

// Try via supabase.rpc if there's a helper function, or via PostgREST
// PostgREST doesn't expose information_schema directly, so we try both:

// Attempt 1: rpc('exec_sql', ...) — common custom function pattern
const { data: rpcData, error: rpcError } = await admin.rpc('exec_sql', { query: sql })
if (!rpcError && rpcData) {
  console.log('✅ Worked via rpc("exec_sql")')
  console.log(JSON.stringify(rpcData, null, 2))
  process.exit(0)
} else {
  console.log('rpc("exec_sql") failed:', rpcError?.message || 'no data')
}

// Attempt 2: rpc('query', ...) — another common pattern
const { data: rpcData2, error: rpcError2 } = await admin.rpc('query', { sql })
if (!rpcError2 && rpcData2) {
  console.log('✅ Worked via rpc("query")')
  console.log(JSON.stringify(rpcData2, null, 2))
  process.exit(0)
} else {
  console.log('rpc("query") failed:', rpcError2?.message || 'no data')
}

// Attempt 3: try direct PostgREST on information_schema (expected to fail)
const { data: restData, error: restError } = await admin
  .from('information_schema.table_constraints')
  .select('*')
  .limit(1)
if (!restError && restData) {
  console.log('✅ PostgREST information_schema accessible (unexpected!)')
  console.log(JSON.stringify(restData, null, 2))
  process.exit(0)
} else {
  console.log('PostgREST information_schema failed:', restError?.message || 'no data')
}

console.log()
console.log('All REST/RPC methods failed (expected for Supabase hosted — information_schema is not exposed).')
console.log('METHOD: c — manual paste required.')
process.exit(1)
