import { createBrowserClient } from '@supabase/ssr'

// Placeholder URL that won't crash but also won't connect
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-key'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clientInstance: ReturnType<typeof createBrowserClient> | null = null

/**
 * Check if Supabase is properly configured with real credentials
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return (
    url !== '' &&
    url !== PLACEHOLDER_URL &&
    !url.includes('placeholder') &&
    !url.includes('your-project')
  )
}

export function createClient() {
  if (clientInstance) return clientInstance
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY
  
  // Warn in development if using placeholders
  if (typeof window !== 'undefined' && !isSupabaseConfigured()) {
    console.warn('[Supabase] Using placeholder credentials - database features will use mock data')
  }
  
  clientInstance = createBrowserClient(supabaseUrl, supabaseKey)
  return clientInstance
}
