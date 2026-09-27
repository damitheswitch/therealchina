import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const env = import.meta.env as Record<string, string | undefined>
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

// During build-time prerendering (vite-node) there is no browser and no
// request is made through this client — pages get data from the prerender
// payload — so placeholder values are safe. On the client, missing env vars
// remain a hard failure.
const isServer = typeof window === 'undefined'
if (!isServer && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing Supabase environment variables. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'ssr-placeholder-key'
)
