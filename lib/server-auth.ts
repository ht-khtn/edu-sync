import { cache } from 'react'
import getSupabaseServer from '@/lib/supabase-server'

export type ServerAuthContext = {
  supabase: any
  authUid: string | null
  appUserId: string | null
}

export const getServerSupabase = cache(async () => {
  const supabase = await getSupabaseServer()
  return supabase
})

export const getServerAuthContext = cache(async (): Promise<ServerAuthContext> => {
  const supabase = await getServerSupabase()
  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id ?? null

  let appUserId: string | null = null
  if (authUid) {
    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUid)
      .maybeSingle()
    appUserId = (appUser?.id as string | undefined) ?? null
  }

  return { supabase, authUid, appUserId }
})

export type RoleRow = { role_id: string | null; permissions?: { scope?: string | null } | null; target?: string | null }

const STUDENT_ROLES = new Set(['S', 'YUM'])

export const normalizeRoleId = (roleId: string | null | undefined) =>
  (roleId ?? '').trim().toUpperCase()

export const getServerRoles = cache(async (): Promise<RoleRow[]> => {
  const { supabase, appUserId } = await getServerAuthContext()
  if (!appUserId) return []
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role_id, target, permissions(scope)')
    .eq('user_id', appUserId)
  return Array.isArray(roles) ? (roles as RoleRow[]) : []
})

export function summarizeRoles(roleRows: RoleRow[]) {
  const roleIds = roleRows
    .map((r) => normalizeRoleId(r.role_id))
    .filter((id) => id.length > 0)

  const hasElevatedRole = roleIds.some((id) => !STUDENT_ROLES.has(id))
  const isStudentOnly = roleIds.length === 0 || !hasElevatedRole

  return { roleIds, hasElevatedRole, isStudentOnly }
}

export default getServerAuthContext
