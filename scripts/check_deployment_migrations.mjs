import { readdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Accept agent-mode JSON and the CLI's Local | Remote | Time table.
// Unknown output fails closed.
export function assertMigrationsApplied(output, files) {
  const applied = new Set()
  let rows = 0
  if (output.trim().startsWith('{')) {
    const result = JSON.parse(output)
    if (!Array.isArray(result.migrations)) throw new Error('No migration history found')
    for (const migration of result.migrations) {
      if (typeof migration.remote !== 'string' || !/^\d*$/.test(migration.remote)) {
        throw new Error('Invalid remote migration version')
      }
      rows++
      if (migration.remote) applied.add(migration.remote)
    }
  } else {
    for (const line of output.split('\n')) {
      const match = line.match(/^\s*(\d*)\s*\|\s*(\d*)\s*\|/)
      if (!match || (!match[1] && !match[2])) continue
      rows++
      if (match[2]) applied.add(match[2])
    }
  }
  if (!rows) throw new Error('No migration history found in CLI output')
  const missing = files
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.split('_')[0])
    .filter((version) => !applied.has(version))
  if (missing.length) {
    throw new Error(`Apply migrations before deploying functions: ${missing.join(', ')}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertMigrationsApplied(readFileSync(0, 'utf8'), readdirSync('supabase/migrations'))
}
