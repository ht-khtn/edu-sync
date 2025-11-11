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
  class_id: string
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
export async function fetchStudentsFromDB(supabase: any, classId?: string): Promise<Student[]> {
  try {
    // Join users with user_profiles via RPC or multiple calls
    // Here we do two queries and merge client-side to avoid requiring a view.
    const usersQ = classId ? supabase.from('users').select('id,class_id').eq('class_id', classId) : supabase.from('users').select('id,class_id')
    const profilesQ = supabase.from('user_profiles').select('user_id,full_name,email')

    const [{ data: users, error: uErr }, { data: profiles, error: pErr }] = await Promise.all([usersQ, profilesQ])
    if (uErr) {
      console.warn('fetchStudentsFromDB users error:', uErr.message)
      return []
    }
    if (pErr) {
      console.warn('fetchStudentsFromDB profiles error:', pErr.message)
      return []
    }
    const profileMap = new Map<string, { full_name: string | null; email: string | null }>()
    for (const p of profiles || []) profileMap.set(p.user_id, { full_name: p.full_name, email: p.email })

    return (users || []).map((u: any) => {
      const p = profileMap.get(u.id)
      const fullname = p?.full_name ?? 'Chưa cập nhật'
      const code = p?.email ?? String(u.id).slice(0, 8)
      return {
        id: u.id,
        student_code: code,
        full_name: fullname,
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
    // @ts-ignore
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
