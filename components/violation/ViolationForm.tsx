import type { Criteria, Student } from '@/lib/violations'
import { filterStudentsByClass } from '@/lib/violations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SelectFields from '@/components/violation/SelectFields'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getUserRolesWithScope, canWriteForClass } from '@/lib/rbac'
import { redirect } from 'next/navigation'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses: { id: string; name: string }[]
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
    redirect('/violation-entry?error=missing')
  }

  // Map auth user to app user id
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
    redirect('/violation-entry?error=nouser')
  }

  // Determine whether this is a student-level or class-level entry
  let targetClassId: string | null = null
  if (student_id) {
    // Fetch student class
    const { data: studentRow, error: sErr } = await supabase
      .from('users')
      .select('id,class_id')
      .eq('id', student_id)
      .maybeSingle()
    if (sErr || !studentRow) {
      redirect('/violation-entry?error=nostudent')
    }
    targetClassId = studentRow.class_id ?? null
  } else {
    // class-level violation: class_id must be provided
    if (!class_id) redirect('/violation-entry?error=missing')
    targetClassId = class_id
  }

  // Resolve class name for permission check
  let className: string | null = null
  if (targetClassId) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', targetClassId).maybeSingle()
    className = cls?.name ?? null
  }

  // RBAC: verify user can write for this class
  const roles = await getUserRolesWithScope(supabase, appUser.id)
  if (!canWriteForClass(roles, className)) {
    redirect('/violation-entry?error=forbidden')
  }

  // Fetch criteria score and category
  const { data: criteriaRow, error: cErr } = await supabase
    .from('criteria')
    .select('id,score,category')
    .eq('id', criteria_id)
    .maybeSingle()
  if (cErr || !criteriaRow) {
    redirect('/violation-entry?error=nocriteria')
  }

  // If this is a class-level entry, only criteria with category === 'class' are allowed
  if (!student_id) {
    if ((criteriaRow.category ?? '') !== 'class') {
      redirect('/violation-entry?error=forbidden')
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
    redirect('/violation-entry?error=insert')
  }

  // Audit log (best-effort)
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

  redirect('/violation-entry?ok=1')
}

import ViolationFormClient from './ViolationFormClient'

export function ViolationForm({ students, criteria, allowedClasses }: Props) {
  // For now, we don't have server-side auth context; limit-by-class not applied here
  const effectiveStudents = filterStudentsByClass(students, [])

  return (
    <section className="flex flex-col gap-6">
      <ViolationFormClient
        students={effectiveStudents}
        criteria={criteria}
        allowedClasses={allowedClasses}
        action={submitViolation}
      />
    </section>
  )
}

export default ViolationForm
