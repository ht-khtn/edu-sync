import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getUserRolesWithScope, canWriteForClass } from '@/lib/rbac'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { student_id = '', criteria_id = '', class_id = '', reason = '', evidence_url = '' } = body

    const supabase = await getSupabaseServer()

    if (!criteria_id) return NextResponse.json({ error: 'missing_criteria' }, { status: 400 })

    const { data: userRes } = await supabase.auth.getUser()
    const authUid = userRes?.user?.id
    if (!authUid) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { data: appUser, error: appUserErr } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUid)
      .maybeSingle()
    if (appUserErr || !appUser) return NextResponse.json({ error: 'nouser' }, { status: 400 })

    // Determine target class
    let targetClassId: string | null = null
    if (student_id) {
      const { data: studentRow, error: sErr } = await supabase
        .from('users')
        .select('id,class_id')
        .eq('id', student_id)
        .maybeSingle()
      if (sErr || !studentRow) return NextResponse.json({ error: 'nostudent' }, { status: 400 })
      targetClassId = studentRow.class_id ?? null
    } else {
      if (!class_id) return NextResponse.json({ error: 'missing_class' }, { status: 400 })
      targetClassId = class_id
    }

    // Resolve class name
    let className: string | null = null
    if (targetClassId) {
      const { data: cls } = await supabase.from('classes').select('name').eq('id', targetClassId).maybeSingle()
      className = cls?.name ?? null
    }

    // RBAC check
    const roles = await getUserRolesWithScope(supabase, appUser.id)
    if (!canWriteForClass(roles, className)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    // Verify criteria exists and category
    const { data: criteriaRow, error: cErr } = await supabase
      .from('criteria')
      .select('id,score,category')
      .eq('id', criteria_id)
      .maybeSingle()
    if (cErr || !criteriaRow) return NextResponse.json({ error: 'nocriteria' }, { status: 400 })
    if (!student_id) {
      if ((criteriaRow.category ?? '') !== 'class') return NextResponse.json({ error: 'forbidden_category' }, { status: 400 })
    }

    const score = -Math.abs(criteriaRow.score ?? 0)
    const note = [reason || '', evidence_url || ''].filter(Boolean).join(' | ')

    const { data: inserted, error: insErr } = await supabase.from('records').insert({
      class_id: targetClassId,
      student_id: student_id || null,
      criteria_id,
      score,
      note,
      recorded_by: appUser.id,
    }).select('id').maybeSingle()
    if (insErr) return NextResponse.json({ error: 'insert_failed' }, { status: 500 })

    try {
      await supabase.from('audit_logs').insert({
        table_name: 'records',
        record_id: inserted?.id,
        action: 'insert',
        actor_id: appUser.id,
        diff: { student_id, criteria_id, score, note },
        meta: { source: 'api/records' },
      })
    } catch {}

    return NextResponse.json({ ok: true, id: inserted?.id })
  } catch (e) {
    return NextResponse.json({ error: 'unexpected' }, { status: 500 })
  }
}
