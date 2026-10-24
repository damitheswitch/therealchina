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
