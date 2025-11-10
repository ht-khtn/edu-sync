// Minimal Supabase client wrapper
// Usage: import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Export a single client instance for use in client components
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
