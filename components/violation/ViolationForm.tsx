import type { Criteria, Student } from '@/lib/violations'
import { filterStudentsByClass } from '@/lib/violations'
import { MdFilledButton, MdOutlinedButton } from '@/components/md/Button'
import { redirect } from 'next/navigation'

type Props = {
  students: Student[]
  criteria: Criteria[]
}

// Server action to handle form submission: insert into records
async function submitViolation(formData: FormData) {
  'use server'
  const { getSupabaseServer } = await import('@/lib/supabase-server')
  const supabase = await getSupabaseServer()

  const student_id = String(formData.get('student_id') || '')
  const criteria_id = String(formData.get('criteria_id') || '')
  const reason = (formData.get('reason') || '').toString().trim()
  const evidence_url = (formData.get('evidence_url') || '').toString().trim()

  if (!student_id || !criteria_id) {
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

  // Fetch student class
  const { data: studentRow, error: sErr } = await supabase
    .from('users')
    .select('id,class_id')
    .eq('id', student_id)
    .maybeSingle()
  if (sErr || !studentRow) {
    redirect('/violation-entry?error=nostudent')
  }

  // Fetch criteria score
  const { data: criteriaRow, error: cErr } = await supabase
    .from('criteria')
    .select('id,score')
    .eq('id', criteria_id)
    .maybeSingle()
  if (cErr || !criteriaRow) {
    redirect('/violation-entry?error=nocriteria')
  }

  const score = -Math.abs(criteriaRow.score ?? 0)
  const note = [reason, evidence_url].filter(Boolean).join(' | ')

  const { error: insErr } = await supabase.from('records').insert({
    class_id: studentRow.class_id,
    student_id,
    criteria_id,
    score,
    note,
    recorded_by: appUser.id,
  })
  if (insErr) {
    redirect('/violation-entry?error=insert')
  }

  redirect('/violation-entry?ok=1')
}

export function ViolationForm({ students, criteria }: Props) {
  // For now, we don't have server-side auth context; limit-by-class not applied here
  const effectiveStudents = filterStudentsByClass(students, [])

  return (
    <section className="flex flex-col gap-6">
      <form action={submitViolation} className="grid gap-6 lg:grid-cols-2">
        <section>
          <label className="block text-sm font-medium mb-2">Học sinh</label>
          <select name="student_id" required className="w-full border rounded-md h-9 px-2">
            <option value="">-- Chọn học sinh --</option>
            {effectiveStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.student_code} - {s.full_name}</option>
            ))}
          </select>
        </section>

        <section>
          <label className="block text-sm font-medium mb-2">Loại lỗi</label>
          <select name="criteria_id" required className="w-full border rounded-md h-9 px-2">
            <option value="">-- Chọn loại lỗi --</option>
            {criteria.map((c) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name} ({c.points})</option>
            ))}
          </select>
        </section>

        <section className="lg:col-span-2">
          <label className="block text-sm font-medium mb-2">Lý do / ghi chú</label>
          <input type="text" name="reason" placeholder="Tuỳ chọn" className="w-full border rounded-md h-9 px-2" />
        </section>

        <section className="lg:col-span-2">
          <label className="block text-sm font-medium mb-2">Link minh chứng (tuỳ chọn)</label>
          <input type="url" name="evidence_url" placeholder="https://..." className="w-full border rounded-md h-9 px-2" />
        </section>

        <section className="lg:col-span-2 flex gap-3 items-center">
          <MdFilledButton type="submit">Ghi nhận</MdFilledButton>
          <MdOutlinedButton type="reset">Làm mới</MdOutlinedButton>
        </section>
      </form>
      <p className="text-xs text-muted-foreground">Mô phỏng frontend — chưa ghi xuống database.</p>
    </section>
  )
}

export default ViolationForm
