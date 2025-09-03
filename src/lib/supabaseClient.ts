import { createClient, SupabaseClientOptions } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Custom storage adapter to ensure localStorage is used reliably in the browser.
const customStorageAdapter = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') {
      return null
    }
    return window.localStorage.getItem(key)
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value)
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
  },
}

const supabaseOptions: SupabaseClientOptions<"public"> = {
  auth: {
    storage: customStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions)
