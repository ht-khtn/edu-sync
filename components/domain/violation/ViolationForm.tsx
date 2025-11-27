import type { Criteria, Student } from '@/lib/violations'
import { filterStudentsByClass } from '@/lib/violations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SelectFields from '@/components/domain/violation/SelectFields'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getUserRolesWithScope, canWriteForClass } from '@/lib/rbac'
import { redirect } from 'next/navigation'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses: { id: string; name: string }[]
  currentClass?: { id: string; name: string } | null
}

// Server action to handle form submission: insert into records
async function submitViolation(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServer()

  const student_id = String(formData.get('student_id') || '')
  const criteria_id = String(formData.get('criteria_id') || '')
  const class_id = String(formData.get('class_id') || '')
  const reason = (formData.get('reason') || '').toString().trim()
  const evidence_url = (formData.get('evidence_url') || '').toString().trim()

  if (!criteria_id) {
    redirect('/admin/violation-entry?error=missing')
  }

  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id
  if (!authUid) {
    redirect('/login')
  }
  const { data: appUser, error: appUserErr } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', authUid)
    .maybeSingle()
  if (appUserErr || !appUser) {
    redirect('/admin/violation-entry?error=nouser')
  }

  let targetClassId: string | null = null
  if (student_id) {
    const { data: studentRow, error: sErr } = await supabase
      .from('users')
      .select('id,class_id')
      .eq('id', student_id)
      .maybeSingle()
    if (sErr || !studentRow) {
      redirect('/admin/violation-entry?error=nostudent')
    }
    targetClassId = studentRow.class_id ?? null
  } else {
    if (!class_id) redirect('/admin/violation-entry?error=missing')
    targetClassId = class_id
  }

  let className: string | null = null
  if (targetClassId) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', targetClassId).maybeSingle()
    className = cls?.name ?? null
  }

  const roles = await getUserRolesWithScope(supabase, appUser.id)
  if (!canWriteForClass(roles, className)) {
    redirect('/admin/violation-entry?error=forbidden')
  }

  const { data: criteriaRow, error: cErr } = await supabase
    .from('criteria')
    .select('id,score,category')
    .eq('id', criteria_id)
    .maybeSingle()
  if (cErr || !criteriaRow) {
    redirect('/admin/violation-entry?error=nocriteria')
  }

  if (!student_id) {
    if ((criteriaRow.category ?? '') !== 'class') {
      redirect('/admin/violation-entry?error=forbidden')
    }
  }

  const score = -Math.abs(criteriaRow.score ?? 0)
  const note = [reason, evidence_url].filter(Boolean).join(' | ')

  const { data: inserted, error: insErr } = await supabase.from('records').insert({
    class_id: targetClassId,
    student_id: student_id || null,
    criteria_id,
    score,
    note,
    recorded_by: appUser.id,
  }).select('id').maybeSingle()
  if (insErr) {
    redirect('/admin/violation-entry?error=insert')
  }

  try {
    await supabase.from('audit_logs').insert({
      table_name: 'records',
      record_id: inserted?.id,
      action: 'insert',
      actor_id: appUser.id,
      diff: { student_id, criteria_id, score, note },
      meta: { source: 'violation-form' },
    })
  } catch {}

  redirect('/admin/violation-entry?ok=1')
}

import ViolationFormClient from './ViolationFormClient'

export function ViolationForm({ students, criteria, allowedClasses, currentClass }: Props) {
  // For now, we don't have server-side auth context; limit-by-class not applied here
  const effectiveStudents = filterStudentsByClass(students, [])

  return (
    <section className="flex flex-col gap-6">
      <ViolationFormClient
        students={effectiveStudents}
        criteria={criteria}
        allowedClasses={allowedClasses}
        currentClass={currentClass}
      />
    </section>
  )
}

export default ViolationForm
