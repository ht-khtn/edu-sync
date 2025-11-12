// Minimal Supabase client helper (singleton)
// Avoid creating many Supabase clients (each would register auth listeners & refresh timers → request explosion)
// Usage: import { getSupabase } from '@/lib/supabase'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export async function getSupabase(): Promise<SupabaseClient> {
	if (browserClient) return browserClient
	if (typeof window === 'undefined') {
		throw new Error('getSupabase() should only be called client-side. Use getSupabaseServer() on the server.')
	}
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY.')
	}
	browserClient = createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			// We manage session via cookies + client; keep defaults
			persistSession: true,
			autoRefreshToken: true,
		},
	})
	return browserClient
}

export default getSupabase
