type SupabasePublicEnv = {
  url: string
  anonKey: string
}

function readEnv(key: string): string {
  const value = process.env[key]
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
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  return value && value.trim().length > 0 ? value : null
}
