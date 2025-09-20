import { createClient, SupabaseClientOptions } from '@supabase/supabase-js'

// 환경변수 키 호환: NEXT_PUBLIC_* 우선, 없으면 서버 키(SUPABASE_*)로 폴백
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 .env.local 에 설정하세요.')
}

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
