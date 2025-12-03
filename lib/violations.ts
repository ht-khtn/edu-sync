import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Criteria = {
  id: string
  code: string
  name: string
  points: number // negative points for violations (mapped from criteria.score > 0)
  description?: string
  category?: string
  type?: string
  group?: string
  subgroup?: string
  isActive: boolean
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

type GenericSupabaseClient = SupabaseClient<Record<string, unknown>>

type CriteriaRow = {
  id: string
  name: string
  description: string | null
  type: string | null
  score: number | null
  category: string | null
  group: string | null
  subgroup: string | null
  is_active: boolean | null
}

type StudentRow = {
  id: string
  class_id: string | null
  user_name: string | null
  user_profiles: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null
}

// Fetch criteria from Supabase `criteria` table and map to internal Criteria type
// We convert positive score to negative points for violation entry context.
type FetchCriteriaOptions = {
  includeInactive?: boolean
}

export const fetchCriteriaFromDB = cache(async (
  supabase: GenericSupabaseClient,
  options?: FetchCriteriaOptions,
): Promise<Criteria[]> => {
  try {
    const includeInactive = options?.includeInactive ?? false
    let query = supabase
      .from('criteria')
      .select('id,name,description,type,score,category,"group",subgroup,is_active')
      .order('created_at', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) {
      console.warn('fetchCriteriaFromDB error:', error.message)
      return []
    }
    const rows = (data || []) as CriteriaRow[]
    return rows.map((row) => ({
      id: row.id,
      code: row.category ? `${row.category}` : row.id.slice(0, 8),
      name: row.name,
      description: row.description ?? undefined,
      category: row.category ?? undefined,
      type: row.type ?? undefined,
      group: row.group ?? undefined,
      subgroup: row.subgroup ?? undefined,
      isActive: row.is_active !== false,
      points: -Math.abs(row.score ?? 0), // ensure negative for violation
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('fetchCriteriaFromDB exception:', message)
    return []
  }
})

// Fetch students from users + user_profiles. Optionally filter by classId.
// Optimized: single query join users -> user_profiles; optional filter by classId or a set of classIds
export async function fetchStudentsFromDB(
  supabase: GenericSupabaseClient,
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

    const { data, error } = await q
    if (error) {
      console.warn('fetchStudentsFromDB error:', error.message)
      return []
    }

    const users = (data || []) as StudentRow[]
    return users.map((u) => {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('fetchStudentsFromDB exception:', message)
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
