type SupabasePublicEnv = {
  url: string
  anonKey: string
}

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const

function readEnv<K extends keyof typeof publicEnv>(key: K): string {
  const value = publicEnv[key]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

export function getOptionalSupabaseUrl(): string | null {
  const value = publicEnv.NEXT_PUBLIC_SUPABASE_URL
  return value && value.trim().length > 0 ? value : null
}
