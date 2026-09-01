import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const env = import.meta.env as Record<string, string | undefined>
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
