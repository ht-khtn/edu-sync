export type Criteria = {
  id: string
  code: string
  name: string
  points: number // negative points for violations (mapped from criteria.score > 0)
  description?: string
  category?: string
  type?: string
}

export type Student = {
  id: string
  student_code: string
  full_name: string
  user_name?: string
  class_id: string
  class_name?: string
}

export type ViolationDraft = {
  student_id: string
  criteria_id: string
  points: number
  reason?: string
  evidence_url?: string
}

export type ViolationRecord = ViolationDraft & {
  id: string
  created_at: string
}

// Fetch criteria from Supabase `criteria` table and map to internal Criteria type
// We convert positive score to negative points for violation entry context.
export async function fetchCriteriaFromDB(supabase: any): Promise<Criteria[]> {
  try {
    const { data, error } = await supabase.from('criteria').select('id,name,description,type,score,category')
    if (error) {
      console.warn('fetchCriteriaFromDB error:', error.message)
      return []
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      code: row.category ? `${row.category}` : row.id.slice(0, 8),
      name: row.name,
      description: row.description ?? undefined,
      category: row.category ?? undefined,
      type: row.type ?? undefined,
      points: -Math.abs(row.score ?? 0) // ensure negative for violation
    }))
  } catch (err: any) {
    console.warn('fetchCriteriaFromDB exception:', err?.message)
    return []
  }
}

// Fetch students from users + user_profiles. Optionally filter by classId.
// Optimized: single query join users -> user_profiles; optional filter by classId or a set of classIds
export async function fetchStudentsFromDB(
  supabase: any,
  classId?: string,
  classIdsSet?: Set<string> | null
): Promise<Student[]> {
  try {
    let q = supabase.from('users').select('id,class_id,user_name,user_profiles(full_name,email)')
    if (classId) {
      q = q.eq('class_id', classId)
    } else if (classIdsSet && classIdsSet.size > 0) {
      q = q.in('class_id', Array.from(classIdsSet))
    }

    const { data: users, error } = await q
    if (error) {
      console.warn('fetchStudentsFromDB error:', error.message)
      return []
    }

    return (users || []).map((u: any) => {
      const prof = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles
      const fullname = prof?.full_name ?? 'Chưa cập nhật'
      const code = prof?.email ?? String(u.id).slice(0, 8)
      return {
        id: u.id,
        student_code: code,
        full_name: fullname,
        user_name: u.user_name ?? undefined,
        class_id: u.class_id ?? ''
      } as Student
    })
  } catch (err: any) {
    console.warn('fetchStudentsFromDB exception:', err?.message)
    return []
  }
}

export function filterStudentsByClass(students: Student[], classIds: string[] | undefined): Student[] {
  if (!classIds || classIds.length === 0) return students
  const set = new Set(classIds)
  return students.filter((s) => set.has(s.class_id))
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export function submitViolationMock(draft: ViolationDraft): ViolationRecord {
  const rec: ViolationRecord = {
    ...draft,
    id: genId(),
    created_at: new Date().toISOString(),
  }
  return rec
}
