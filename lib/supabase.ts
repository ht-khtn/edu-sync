// Minimal Supabase client helper
// Usage (client-side): import { getSupabase } from '@/lib/supabase' and call inside event handlers or effects
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function getSupabase(): SupabaseClient {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error(
			'Supabase client not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local'
		)
	}

	return createClient(supabaseUrl, supabaseAnonKey)
}

export default getSupabase
