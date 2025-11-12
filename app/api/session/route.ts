import { NextResponse } from 'next/server'

import getSupabaseServer from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    const { data: userRes } = await supabase.auth.getUser()
    const authUid = userRes?.user?.id
    if (!authUid) return NextResponse.json({ user: null })

    const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
    const appUserId = appUser?.id as string | undefined
    if (!appUserId) return NextResponse.json({ user: null })

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id,target,permissions(scope)')
      .eq('user_id', appUserId)

    const roleList = Array.isArray(roles) ? roles : []
    const hasSchoolScope = roleList.some((r: any) => r?.permissions?.scope === 'school')
    const hasCC = roleList.some((r: any) => r.role_id === 'CC')

    let ccClassId: string | null = null
    if (hasCC && !hasSchoolScope) {
      const ccRole = roleList.find((r: any) => r.role_id === 'CC' && r.target)
      if (ccRole?.target) {
        const { data: cls } = await supabase.from('classes').select('id').eq('name', ccRole.target).maybeSingle()
        ccClassId = cls?.id ?? null
      }
    }

    return NextResponse.json({ user: { id: appUserId }, hasCC, hasSchoolScope, ccClassId })
  } catch (err) {
    return NextResponse.json({ user: null })
  }
}
