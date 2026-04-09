import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase URL and Anon Key are required. Please check your environment variables.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Replace Navigator LockManager with a no-op lock to avoid
      // "this.lock is not a function" / "Failed to fetch" in v0 preview
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => {
        return await fn()
      },
    },
  })
}
