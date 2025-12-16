import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RoleWithScope = {
  role_id: string
  target: string | null
  scope: 'school' | 'class' | string | null
}

export const getUserRolesWithScope = cache(async (supabase: SupabaseClient, userId: string): Promise<RoleWithScope[]> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_id,target,permissions(scope)')
    .eq('user_id', userId)
  if (error) return []
  return (data || []).map((r) => ({
    role_id: r.role_id,
    target: r.target,
    scope: (r as { permissions?: { scope?: string | null } }).permissions?.scope ?? null,
  }))
})

export const getClassInfo = cache(async (supabase: SupabaseClient, classId: string): Promise<{ name: string | null } | null> => {
  const { data, error } = await supabase
    .from('classes')
    .select('name')
    .eq('id', classId)
    .maybeSingle()
  if (error) return null
  return { name: data?.name ?? null }
})

export function canWriteForClass(roles: RoleWithScope[], className: string | null): boolean {
  if (!roles?.length || !className) return false
  for (const r of roles) {
    const target = r.target?.toString() || ''
    const scope = r.scope || ''
    if (target === 'ALL') return true
    if (scope === 'class' && target && target === className) return true
    if (scope === 'school' && target && target === className) return true
  }
  return false
}

export const getAllowedClassIdsForView = cache(async (supabase: SupabaseClient, userId: string): Promise<null | Set<string>> => {
  const roles = await getUserRolesWithScope(supabase, userId)
  if (!roles.length) return new Set<string>()
  // If user has any school-scope role, allow viewing all classes (null means all)
  if (roles.some(r => (r.scope === 'school' && (!r.target || r.target === 'ALL')))) return null
  // Otherwise, restrict to classes matching role targets (by class name)
  const classTargets = roles
    .filter(r => (r.scope === 'class' || r.scope === 'school') && r.target && r.target !== 'ALL')
    .map(r => String(r.target))

  const allowed = new Set<string>()
  if (!classTargets.length) return allowed

  // Fetch only matching classes instead of the entire table
  const { data: classes } = await supabase.from('classes').select('id,name').in('name', classTargets)
  for (const c of classes || []) {
    if (c?.id) allowed.add(c.id)
  }
  return allowed
})

export const getAllowedClassIdsForWrite = cache(async (supabase: SupabaseClient, userId: string): Promise<Set<string> | null> => {
  const roles = await getUserRolesWithScope(supabase, userId)
  console.log('[getAllowedClassIdsForWrite] userId:', userId, 'roles:', JSON.stringify(roles))
  const allowed = new Set<string>()
  if (!roles.length) return allowed
  
  // If user has target='ALL' (case-insensitive), return null to indicate "all classes"
  if (roles.some(r => String(r.target ?? '').trim().toUpperCase() === 'ALL')) {
    console.log('[getAllowedClassIdsForWrite] Found target=ALL, returning null (all classes)')
    return null  // null means "all classes allowed"
  }
  
  // If user has school scope (regardless of target), allow all classes
  if (roles.some(r => (r.scope ?? '').toString() === 'school')) {
    console.log('[getAllowedClassIdsForWrite] Found scope=school, returning null (all classes)')
    return null  // null means "all classes allowed"
  }

  // Otherwise, fetch only classes matching role targets (for class-level roles)
  const targets = roles.filter(r => r.target && r.target !== 'ALL').map(r => String(r.target))
  if (!targets.length) return allowed
  const { data: classes } = await supabase.from('classes').select('id,name').in('name', targets)
  for (const c of classes || []) allowed.add(c.id)
  console.log('[getAllowedClassIdsForWrite] Returning Set with', allowed.size, 'classes for targets:', targets)
  return allowed
})
