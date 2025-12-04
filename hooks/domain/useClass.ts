import type { SupabaseClient } from '@supabase/supabase-js'

// Types
export type GradeRef = {
    name?: string | null
}

export type UserProfile = {
    full_name?: string | null
}

export type TeacherRef = {
    id: string
    user_name?: string | null
    user_profiles?: UserProfile | UserProfile[] | null
}

export type ClassRow = {
    id: string
    name?: string | null
    grade_id?: string | null
    grades?: GradeRef | GradeRef[] | null
    homeroom_teacher_id?: string | null
    created_at?: string | null
}

export type GradeOption = {
    id: string
    name: string
}

export type TeacherOption = {
    id: string
    label: string
}

export type ClassOption = {
    id: string
    name: string
}

export type TeacherInfo = {
    name: string
    short: string
}

export type ClassesData = {
    classRows: ClassRow[]
    error: Error | null
}

export type ClassesStats = {
    totalClasses: number
    totalGrades: number
    assignedTeachers: number
}

// Fetch classes data
export async function fetchClassesData(
    supabase: SupabaseClient
): Promise<ClassesData> {
    const { data: classes, error } = await supabase
        .from('classes')
        .select('id, name, grade_id, grades(name), homeroom_teacher_id, created_at')
        .order('name', { ascending: true })

    const classRows = Array.isArray(classes) ? (classes as ClassRow[]) : []

    return {
        classRows,
        error: error as Error | null
    }
}

// Fetch teachers by homeroom IDs
export async function fetchTeachersByIds(
    supabase: SupabaseClient,
    homeroomIds: string[]
): Promise<Map<string, TeacherInfo>> {
    const teacherMap = new Map<string, TeacherInfo>()

    if (homeroomIds.length === 0) {
        return teacherMap
    }

    const { data: teachers } = await supabase
        .from('users')
        .select('id, user_name, user_profiles(full_name)')
        .in('id', homeroomIds)

    for (const teacher of (teachers || []) as TeacherRef[]) {
        if (!teacher?.id) continue
        const profile = Array.isArray(teacher.user_profiles)
            ? teacher.user_profiles[0]
            : teacher.user_profiles
        const fullName = profile?.full_name || teacher.user_name || '—'
        teacherMap.set(teacher.id, {
            name: fullName,
            short: fullName.split(' ').slice(-1).join('') || fullName,
        })
    }

    return teacherMap
}

// Get homeroom teacher IDs from class rows
export function getHomeroomIds(classRows: ClassRow[]): string[] {
    return Array.from(
        new Set(
            classRows
                .map((row) => row.homeroom_teacher_id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
        )
    )
}

// Get unique grades from class rows
export function getUniqueGrades(classRows: ClassRow[]): Set<string> {
    const gradeSet = new Set<string>()
    classRows.forEach((row) => {
        const grade = Array.isArray(row.grades) ? row.grades[0] : row.grades
        if (grade?.name) gradeSet.add(grade.name)
    })
    return gradeSet
}

// Fetch grade list
export async function fetchGradeList(
    supabase: SupabaseClient
): Promise<GradeOption[]> {
    const { data: gradeList } = await supabase
        .from('grades')
        .select('id,name')
        .order('name')

    return (gradeList || []).map((g: { id: string; name?: string | null }) => ({
        id: g.id,
        name: g.name || g.id
    }))
}

// Fetch teacher options
export async function fetchTeacherOptions(
    supabase: SupabaseClient
): Promise<TeacherOption[]> {
    const { data: teacherOptions } = await supabase
        .from('users')
        .select('id, user_name, email')
        .order('user_name', { ascending: true })
        .limit(500)

    return (teacherOptions || []).map((t: { id: string; user_name?: string | null; email?: string | null }) => ({
        id: t.id,
        label: t.user_name || t.email || t.id
    }))
}

// Prepare classes for dialog
export function prepareClassesForDialog(classRows: ClassRow[]): ClassOption[] {
    return classRows.map((cls) => ({
        id: cls.id,
        name: cls.name || cls.id
    }))
}

// Calculate classes statistics
export function calculateClassesStats(
    classRows: ClassRow[],
    gradeSet: Set<string>,
    teacherMap: Map<string, TeacherInfo>
): ClassesStats {
    return {
        totalClasses: classRows.length,
        totalGrades: gradeSet.size,
        assignedTeachers: teacherMap.size
    }
}

// Helper to get grade name from class row
export function getGradeName(row: ClassRow): string {
    const grade = Array.isArray(row.grades) ? row.grades[0] : row.grades
    return grade?.name || '—'
}

// Helper to get teacher info
export function getTeacherDisplay(
    row: ClassRow,
    teacherMap: Map<string, TeacherInfo>
): { name?: string; isAssigned: boolean } {
    if (!row.homeroom_teacher_id) {
        return { isAssigned: false }
    }
    const teacher = teacherMap.get(row.homeroom_teacher_id)
    return {
        name: teacher?.name,
        isAssigned: true
    }
}

// Helper to format created date
export function formatCreatedDate(createdAt: string | null | undefined): string {
    return createdAt
        ? new Date(createdAt).toLocaleDateString('vi-VN')
        : '—'
}

// Helper to get search param
export function getParam(
    searchParams: Record<string, string | string[] | undefined> | undefined,
    key: string
): string | undefined {
    const raw = searchParams?.[key]
    if (Array.isArray(raw)) return raw[0]
    return raw
}
