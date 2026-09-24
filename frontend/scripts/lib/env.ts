// Build-time env loader: prefers process.env (Netlify), falls back to
// frontend/.env.local / .env so `npm run prerender` works locally.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const parseEnvFile = (path: string): Record<string, string> => {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}

export const buildEnv = (frontendRoot: string): Record<string, string> => {
  const fromFiles = {
    ...parseEnvFile(resolve(frontendRoot, '.env')),
    ...parseEnvFile(resolve(frontendRoot, '.env.local')),
    ...parseEnvFile(resolve(frontendRoot, '.env.production')),
    ...parseEnvFile(resolve(frontendRoot, '.env.production.local')),
  }
  return { ...fromFiles, ...process.env } as Record<string, string>
}
