import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertMigrationsApplied } from './check_deployment_migrations.mjs'

const files = ['049_security.sql', '053_resolver.sql', '054_quotas.sql']

test('allows applied migrations and remote-only preview migrations', () => {
  assertMigrationsApplied('049 | 049 |\n053 | 053 |\n054 | 054 |\n | 055 |', files)
})

test('blocks pending migrations', () => {
  assert.throws(
    () => assertMigrationsApplied('049 | 049 |\n053 | 053 |\n054 | |', files),
    /054/
  )
})

test('accepts real agent-mode JSON and blocks missing remote versions', () => {
  const migrations = files.map((file) => ({ remote: file.split('_')[0] }))
  assertMigrationsApplied(JSON.stringify({ migrations }), files)
  migrations[2].remote = ''
  assert.throws(() => assertMigrationsApplied(JSON.stringify({ migrations }), files), /054/)
})

test('fails closed on empty, failed, or changed CLI output', () => {
  for (const output of ['', 'connection failed', '{"migrations": []}']) {
    assert.throws(() => assertMigrationsApplied(output, files), /No migration history/)
  }
})

test('ignores letter-suffixed files the Supabase CLI never applies', () => {
  // Real repo names: the CLI skips both, so remote history has 010 then 012.
  const withSuffixed = [
    '010_base.sql',
    '011a_profile_security_fixes.sql',
    '011b_storage_policies_reference.sql',
    '012_next.sql',
  ]
  assertMigrationsApplied('010 | 010 |\n012 | 012 |', withSuffixed)
  assert.throws(() => assertMigrationsApplied('010 | 010 |\n012 | |', withSuffixed), /012/)
})
