import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
// Explicit .ts extension to satisfy ts-node ESM resolution when using moduleResolution=bundler
import { adminAccount, type AdminSeedConfig } from './config.ts'

const ENV_PRIORITY = ['.env', '.env.local']

for (const envFile of ENV_PRIORITY) {
  const envPath = path.resolve(process.cwd(), envFile)
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true })
  }
}

const DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || '123'

type NormalizedAdminConfig = {
  email: string
  username: string
  password: string
  roleId: string
  roleTarget?: string | null
  classId?: string | null
}

function ensureEnv(key: string, fallbackKeys: string[] = []): string {
  const candidates = [key, ...fallbackKeys]
  for (const candidate of candidates) {
    const value = process.env[candidate]
    if (value && value.trim().length > 0) {
      return value
    }
  }
  throw new Error(`Missing required environment variable: ${candidates.join(' or ')}`)
}

function fallbackUsername(admin: Pick<AdminSeedConfig, 'email' | 'username'>): string {
  if (admin.username && admin.username.trim().length > 0) {
    return admin.username.trim()
  }
  const localPart = admin.email.split('@')[0]
  return localPart || `admin_${Date.now()}`
}

function normalizeConfig(config: AdminSeedConfig | null | undefined): NormalizedAdminConfig {
  if (!config) {
    throw new Error('Admin config is missing. Hãy cập nhật config.ts trước khi chạy script.')
  }

  const email = config.email?.trim()
  if (!email) {
    throw new Error('Admin config thiếu email.')
  }

  const roleId = config.roleId?.trim()
  if (!roleId) {
    throw new Error('Admin config thiếu roleId (ví dụ: "admin").')
  }

  const username = fallbackUsername(config)
  const password = config.password?.trim() || DEFAULT_PASSWORD

  return {
    email: email.toLowerCase(),
    username,
    password,
    roleId,
    roleTarget: config.roleTarget ?? null,
    classId: config.classId ?? null,
  }
}

async function findAuthUidByEmail(client: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await client
    .from('users')
    .select('auth_uid')
    .eq('email', email)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (data?.auth_uid) {
    return data.auth_uid as string
  }

  const { data: listData, error: listError } = await client.auth.admin.listUsers()
  if (listError) {
    throw listError
  }

  const match = listData.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  return match ? match.id : null
}

async function ensureAuthUser(
  client: SupabaseClient,
  config: NormalizedAdminConfig,
): Promise<{ authUid: string; created: boolean }> {
  const metadata = {
    username: config.username,
    role: config.roleId,
  }

  const { data, error } = await client.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (data?.user) {
    return { authUid: data.user.id, created: true }
  }

  if (error) {
    const conflict = error.message?.toLowerCase().includes('already registered')
    if (conflict) {
      const existing = await findAuthUidByEmail(client, config.email)
      if (existing) {
        return { authUid: existing, created: false }
      }
    }
    throw error
  }

  throw new Error(`Không thể tạo auth user cho ${config.email}`)
}

async function upsertPublicUser(
  client: SupabaseClient,
  config: NormalizedAdminConfig,
  authUid: string,
): Promise<string> {
  const { data, error } = await client
    .from('users')
    .upsert(
      {
        auth_uid: authUid,
        user_name: config.username,
        email: config.email,
        class_id: config.classId ?? null,
      },
      { onConflict: 'auth_uid' },
    )
    .select('id')
    .single()

  if (error) {
    throw error
  }

  return data.id as string
}

async function upsertUserRole(client: SupabaseClient, config: NormalizedAdminConfig, userId: string): Promise<void> {
  const { error } = await client.from('user_roles').upsert(
    {
      user_id: userId,
      role_id: config.roleId,
      target: config.roleTarget ?? null,
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    throw error
  }
}

async function processAdmin(client: SupabaseClient, config: NormalizedAdminConfig): Promise<void> {
  const { authUid, created } = await ensureAuthUser(client, config)
  const userId = await upsertPublicUser(client, config, authUid)
  await upsertUserRole(client, config, userId)

  console.log(
    `${created ? '[NEW]' : '[EXISTING]'} ${config.email} -> user_id=${userId}, role=${config.roleId}, target=${
      config.roleTarget ?? '-'
    }`,
  )
}

async function main() {
  const config = normalizeConfig(adminAccount)
  const supabaseUrl = ensureEnv('SUPABASE_URL', ['NEXT_PUBLIC_SUPABASE_URL'])
  const serviceKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  await processAdmin(supabase, config)

  console.log('Hoàn tất seed admin.')
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Seed admin gặp lỗi:', error)
    process.exitCode = 1
  })
}
