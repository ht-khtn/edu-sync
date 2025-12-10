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

    // Fetch user with retry logic (in case trigger hasn't completed yet)
    let appUser = null
    let attempts = 0
    const maxAttempts = 3

    while (!appUser && attempts < maxAttempts) {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('auth_uid', authUid)
        .maybeSingle()
      
      if (data?.id) {
        appUser = data
        break
      }
      
      if (attempts < maxAttempts - 1) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      attempts++
    }

    if (!appUser?.id) {
      // User not found in system or not activated
      return NextResponse.json({ user: null })
    }

    const appUserId = appUser.id

    // Parallelize: fetch roles using user_id (more efficient than JOIN via auth_uid)
    const [{ data: roles }, { data: classes }] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role_id, target, permissions(scope)')
        .eq('user_id', appUserId),
      supabase
        .from('classes')
        .select('id, name')
        .eq('homeroom_teacher_id', appUserId)
    ])

    const roleList = Array.isArray(roles) ? (roles as RoleRecord[]) : []

    const hasSchoolScope = roleList.some((r) => {
      const scopes = Array.isArray(r.permissions) ? r.permissions : []
      return scopes.some((p) => p.scope === 'school')
    })
    const hasCC = roleList.some((r) => r.role_id === 'CC')
    
    // Extract role IDs for client
    const roleIds = roleList.map((r) => r.role_id).filter(Boolean) as string[]

    // Calculate Olympia access
    const hasOlympiaAccess = roleIds.includes('OLYMPIA_ADMIN') || roleIds.includes('OLYMPIA_USER') || roleIds.includes('MOD')

    // For CC role, get class ID from already-fetched classes or target name lookup
    let ccClassId: string | null = null
    if (hasCC && !hasSchoolScope) {
      const ccRole = roleList.find((r) => r.role_id === 'CC' && r.target)
      if (ccRole?.target) {
        // First check if we already fetched this class in the parallel query
        const classesArray = Array.isArray(classes) ? classes : []
        const foundClass = classesArray.find((c: any) => c.name === ccRole.target)
        if (foundClass) {
          ccClassId = foundClass.id
        }
        // If not found in fetched results, the target may be invalid or user is not homeroom teacher
      }
    }

    return NextResponse.json(
      { user: { id: appUserId }, hasCC, hasSchoolScope, hasOlympiaAccess, ccClassId, roles: roleIds },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ user: null, error: message }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
