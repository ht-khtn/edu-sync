import { NextResponse } from 'next/server'

import getSupabaseServer from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type RoleRecord = {
  role_id: string
  target: string | null
  permissions: { scope: string }[] | null
  users: { id: string; auth_uid: string }[] | null
}

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    const { data: userRes } = await supabase.auth.getUser()
    const authUid = userRes?.user?.id
    if (!authUid) return NextResponse.json({ user: null })

    // Single optimized query with JOINs to get user + roles in one go
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id, target, permissions(scope), users!inner(id, auth_uid)')
      .eq('users.auth_uid', authUid)

    const roleList = Array.isArray(roles) ? (roles as RoleRecord[]) : []
    if (roleList.length === 0) return NextResponse.json({ user: null })
    
    // Get appUserId from first role (all roles have same user)
    const firstRole = roleList[0]
    const appUserId = firstRole?.users?.[0]?.id
    if (!appUserId) return NextResponse.json({ user: null })

    const hasSchoolScope = roleList.some((r) => {
      const scopes = Array.isArray(r.permissions) ? r.permissions : []
      return scopes.some((p) => p.scope === 'school')
    })
    const hasCC = roleList.some((r) => r.role_id === 'CC')
    
    // Extract role IDs for client
    const roleIds = roleList.map((r) => r.role_id).filter(Boolean) as string[]

    // For CC role, get class ID if target is set (requires separate query due to no FK)
    let ccClassId: string | null = null
    if (hasCC && !hasSchoolScope) {
      const ccRole = roleList.find((r) => r.role_id === 'CC' && r.target)
      if (ccRole?.target) {
        const { data: cls } = await supabase
          .from('classes')
          .select('id')
          .eq('name', ccRole.target)
          .maybeSingle()
        ccClassId = cls?.id ?? null
      }
    }

    return NextResponse.json(
      { user: { id: appUserId }, hasCC, hasSchoolScope, ccClassId, roles: roleIds },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ user: null, error: message }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
