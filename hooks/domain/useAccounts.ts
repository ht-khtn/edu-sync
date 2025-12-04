import type { SupabaseClient } from '@supabase/supabase-js'

// Types
export type UserProfile = {
    full_name?: string | null
    phone_number?: string | null
}

export type Permission = {
    name?: string | null
    scope?: string | null
}

export type UserRole = {
    role_id: string
    target?: string | null
    permissions?: Permission | Permission[] | null
}

export type UserRow = {
    id: string
    user_name?: string | null
    email?: string | null
    class_id?: string | null
    created_at?: string | null
    user_profiles?: UserProfile | UserProfile[] | null
    user_roles?: UserRole | UserRole[] | null
}

export type ClassOption = {
    id: string
    name: string
}

export type AccountsData = {
    rows: UserRow[]
    classOptions: ClassOption[]
    classMap: Map<string, string>
    error: Error | null
}

export type AccountsStats = {
    totalAccounts: number
    uniqueClassesCount: number
    uniqueRolesCount: number
}

// Fetch accounts data
export async function fetchAccountsData(
    supabase: SupabaseClient
): Promise<AccountsData> {
    try {
        const [{ data: classList }, { data: users, error }] = await Promise.all([
            supabase.from('classes').select('id,name').order('name'),
            supabase
                .from('users')
                .select(
                    'id, user_name, email, class_id, created_at, user_profiles(full_name,phone_number), user_roles(role_id,target,permissions(name,scope))'
                )
                .order('created_at', { ascending: false })
                .limit(300)
        ])

        const classOptions = (classList || []).map((c) => ({
            id: c.id,
            name: c.name || c.id
        }))
        const classMap = new Map(classOptions.map((c) => [c.id, c.name]))

        const rows = Array.isArray(users) ? users : []

        return {
            rows,
            classOptions,
            classMap,
            error: error as Error | null
        }
    } catch (err) {
        return {
            rows: [],
            classOptions: [],
            classMap: new Map(),
            error: err as Error
        }
    }
}

// Calculate statistics
export function calculateAccountsStats(
    rows: UserRow[],
    classMap: Map<string, string>
): AccountsStats {
    const totalAccounts = rows.length

    const uniqueClasses = new Set<string>()
    rows.forEach((row) => {
        if (row.class_id) {
            uniqueClasses.add(classMap.get(row.class_id) || row.class_id)
        }
    })

    const uniqueRolesCount = Array.from(
        new Set(
            rows.flatMap((row) => {
                const roles = Array.isArray(row.user_roles)
                    ? row.user_roles
                    : row.user_roles
                        ? [row.user_roles]
                        : []
                return roles.map((role) => role.role_id)
            })
        )
    ).length

    return {
        totalAccounts,
        uniqueClassesCount: uniqueClasses.size,
        uniqueRolesCount
    }
}

// Helper to get user full name
export function getUserFullName(row: UserRow): string {
    const profile = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles
    return profile?.full_name || row.user_name || '—'
}

// Helper to get user phone
export function getUserPhone(row: UserRow): string | null | undefined {
    const profile = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles
    return profile?.phone_number
}

// Helper to get class name
export function getClassName(row: UserRow, classMap: Map<string, string>): string {
    return row.class_id ? classMap.get(row.class_id) || row.class_id : '—'
}

// Helper to get user roles
export function getUserRoles(row: UserRow): UserRole[] {
    return Array.isArray(row.user_roles)
        ? row.user_roles
        : row.user_roles
            ? [row.user_roles]
            : []
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
