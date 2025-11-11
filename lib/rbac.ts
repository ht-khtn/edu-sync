import type { SupabaseClient } from '@supabase/supabase-js'

export type RoleWithScope = {
  role_id: string
  target: string | null
  scope: 'school' | 'class' | string | null
}

export async function getUserRolesWithScope(supabase: SupabaseClient, userId: string): Promise<RoleWithScope[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_id,target,permissions(scope)')
    .eq('user_id', userId)
  if (error) return []
  return (data || []).map((r: any) => ({ role_id: r.role_id, target: r.target, scope: r.permissions?.scope ?? null }))
}

export async function getClassInfo(supabase: SupabaseClient, classId: string): Promise<{ name: string | null } | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('name')
    .eq('id', classId)
    .maybeSingle()
  if (error) return null
  return { name: data?.name ?? null }
}

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

export async function getAllowedClassIdsForView(supabase: SupabaseClient, userId: string): Promise<null | Set<string>> {
  const roles = await getUserRolesWithScope(supabase, userId)
  if (!roles.length) return new Set<string>()
  // If user has any school-scope role, allow viewing all classes (null means all)
  if (roles.some(r => (r.scope === 'school' && (!r.target || r.target === 'ALL')))) return null

  // Otherwise, restrict to classes matching role targets (by class name)
  const { data: classes } = await supabase.from('classes').select('id,name')
  const allowed = new Set<string>()
  for (const r of roles) {
    if (r.scope === 'class' && r.target) {
      const match = classes?.find(c => c.name === r.target)
      if (match?.id) allowed.add(match.id)
    }
    if (r.scope === 'school' && r.target && r.target !== 'ALL') {
      const match = classes?.find(c => c.name === r.target)
      if (match?.id) allowed.add(match.id)
    }
  }
  return allowed
}

export async function getAllowedClassIdsForWrite(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const roles = await getUserRolesWithScope(supabase, userId)
  const allowed = new Set<string>()
  if (!roles.length) return allowed

  const { data: classes } = await supabase.from('classes').select('id,name')
  for (const r of roles) {
    if (r.target === 'ALL') {
      // All classes writable within scope=school
      if (r.scope === 'school') {
        for (const c of classes || []) allowed.add(c.id)
      }
    } else if (r.target) {
      const match = classes?.find(c => c.name === r.target)
      if (match?.id) allowed.add(match.id)
    }
  }
  return allowed
}
