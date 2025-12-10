// Minimal Supabase client helper (singleton)
// Avoid creating many Supabase clients (each would register auth listeners & refresh timers → request explosion)
// Usage: import { getSupabase } from '@/lib/supabase'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv } from '@/configs/env'


let browserClient: SupabaseClient | null = null
let browserClientPromise: Promise<SupabaseClient> | null = null

export async function getSupabase(): Promise<SupabaseClient> {
	if (browserClient) return browserClient
	if (browserClientPromise) return browserClientPromise
	if (typeof window === 'undefined') {
		throw new Error('getSupabase() should only be called client-side. Use getSupabaseServer() on the server.')
	}

	// Create client once and reuse; guard concurrent calls with a promise
	browserClientPromise = (async () => {
		const { url, anonKey } = getSupabasePublicEnv()
		const client = createClient(url, anonKey, {
			auth: {
				// persistSession keeps session in localStorage/cookies
				persistSession: true,
				autoRefreshToken: true,
			},
		})
		browserClient = client
		browserClientPromise = null
		return client
	})()

	return browserClientPromise
}

export default getSupabase
