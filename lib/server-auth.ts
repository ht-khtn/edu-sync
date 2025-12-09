import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import getSupabaseServer from '@/lib/supabase-server'

export type ServerAuthContext = {
  supabase: SupabaseClient
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

export type RoleRow = {
  role_id: string | null
  permissions?: { scope?: string | null } | null
  target?: string | null
}

const STUDENT_ROLES = new Set(['S', 'YUM'])
const normalizeScope = (scope?: string | null) => (scope ?? '').trim().toLowerCase()

export const normalizeRoleId = (roleId: string | null | undefined) =>
  (roleId ?? '').trim().toUpperCase()

export const getServerRoles = cache(async (): Promise<RoleRow[]> => {
  const { supabase, authUid } = await getServerAuthContext()
  if (!authUid) return []
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('role_id, target, permissions(scope), users!inner(auth_uid)')
    .eq('users.auth_uid', authUid)

  if (error) return []
  if (!Array.isArray(roles)) return []
  return roles as RoleRow[]
})

export type RoleSummary = {
  roleIds: string[]
  hasElevatedRole: boolean
  isStudentOnly: boolean
  hasSchoolScope: boolean
  hasClassScope: boolean
  hasCC: boolean
  canEnterViolations: boolean
  canViewViolationStats: boolean
  canManageSystem: boolean
}

export function summarizeRoles(roleRows: RoleRow[]): RoleSummary {
  const roleIds = roleRows
    .map((r) => normalizeRoleId(r.role_id))
    .filter((id) => id.length > 0)

  let hasSchoolScope = false
  let hasClassScope = false
  for (const row of roleRows) {
    const scope = normalizeScope(row.permissions?.scope)
    if (scope === 'school') hasSchoolScope = true
    if (scope === 'class') hasClassScope = true
  }

  const hasCC = roleIds.includes('CC')
  const hasMOD = roleIds.includes('MOD')
  const hasSEC = roleIds.includes('SEC')
  const hasExplicitElevatedRole = roleIds.some((id) => !STUDENT_ROLES.has(id))
  const hasAnyScope = hasSchoolScope || hasClassScope
  const hasElevatedRole = hasExplicitElevatedRole || hasAnyScope
  const isStudentOnly = !hasElevatedRole

  const canEnterViolations = hasCC || hasMOD || hasSEC
  const canViewViolationStats = hasSchoolScope
  const canManageSystem = roleIds.includes('AD') || roleIds.includes('MOD')

  return {
    roleIds,
    hasElevatedRole,
    isStudentOnly,
    hasSchoolScope,
    hasClassScope,
    hasCC,
    canEnterViolations,
    canViewViolationStats,
    canManageSystem,
  }
}

export default getServerAuthContext
