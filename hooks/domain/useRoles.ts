import type { SupabaseClient } from '@supabase/supabase-js'

// Types
export type UserProfile = {
    full_name?: string | null
}

export type Permission = {
    name?: string | null
    scope?: string | null
}

export type UserRef = {
    id?: string | null
    user_name?: string | null
    email?: string | null
    user_profiles?: UserProfile | UserProfile[] | null
}

export type RoleRow = {
    id: string
    role_id: string
    target?: string | null
    created_at?: string | null
    users?: UserRef | UserRef[] | null
    permissions?: Permission | Permission[] | null
}

export type UserOption = {
    id: string
    user_name?: string | null
    email?: string | null
    class_id?: string | null
    user_profiles?: UserProfile | UserProfile[] | null
}

export type ClassData = {
    id: string
    name?: string | null
}

export type PermissionData = {
    id: string
    name?: string | null
}

export type RolesData = {
    rows: RoleRow[]
    error: Error | null
}

export type UserForDialog = {
    id: string
    label: string
    description?: string
    className: string
    hasClass: boolean
}

export type RoleForDialog = {
    id: string
    name: string
}

// Fetch roles data
export async function fetchRolesData(
    supabase: SupabaseClient
): Promise<RolesData> {
    const { data: roles, error } = await supabase
        .from('user_roles')
        .select(
            'id, role_id, target, created_at, users(id, user_name, email, user_profiles(full_name)), permissions(name, scope)'
        )
        .order('created_at', { ascending: false })
        .limit(300)

    const rows = Array.isArray(roles) ? (roles as RoleRow[]) : []

    return {
        rows,
        error: error as Error | null
    }
}

// Fetch user options for dialog
export async function fetchUserOptions(
    supabase: SupabaseClient
): Promise<UserOption[]> {
    const { data: userOptions } = await supabase
        .from('users')
        .select('id, user_name, email, class_id, user_profiles(full_name)')
        .order('user_name', { ascending: true })
        .limit(500)

    return (userOptions || []) as UserOption[]
}

// Fetch classes
export async function fetchClasses(
    supabase: SupabaseClient
): Promise<Map<string, string>> {
    const { data: classList } = await supabase
        .from('classes')
        .select('id, name')
        .order('name', { ascending: true })

    const classMap = new Map<string, string>()
    for (const cls of (classList || []) as ClassData[]) {
        if (cls?.id) classMap.set(cls.id, cls.name || cls.id)
    }

    return classMap
}

// Fetch permissions
export async function fetchPermissions(
    supabase: SupabaseClient
): Promise<PermissionData[]> {
    const { data: permissionList } = await supabase
        .from('permissions')
        .select('id, name')
        .order('id', { ascending: true })

    return (permissionList || []) as PermissionData[]
}

// Calculate role distribution
export function calculateRoleDistribution(rows: RoleRow[]): Record<string, number> {
    return rows.reduce<Record<string, number>>((acc, row) => {
        const key = row.role_id || 'UNKNOWN'
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {})
}

// Prepare users for dialog
export function prepareUsersForDialog(
    userOptions: UserOption[],
    classMap: Map<string, string>
): UserForDialog[] {
    return userOptions
        .map((u) => {
            const profile = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles
            const className = (u.class_id && classMap.get(u.class_id)) || ''
            const displayName = profile?.full_name?.trim() || u.user_name || u.email || u.id
            return {
                id: u.id,
                label: className ? `${className} - ${displayName}` : displayName,
                description: u.email || u.user_name || undefined,
                className: className || '',
                hasClass: !!u.class_id,
            }
        })
        .sort((a, b) => {
            // Users without class first
            if (a.hasClass !== b.hasClass) {
                return a.hasClass ? 1 : -1
            }
            // Then sort by class name alphabetically
            return a.className.localeCompare(b.className, 'vi')
        })
}

// Prepare roles for dialog
export function prepareRolesForDialog(
    permissionList: PermissionData[]
): RoleForDialog[] {
    return permissionList.map((p) => ({ id: p.id, name: p.name || p.id }))
}

// Helper to get user full name from role row
export function getUserFullName(row: RoleRow): string {
    const userRef = Array.isArray(row.users) ? row.users[0] : row.users
    const profile = Array.isArray(userRef?.user_profiles)
        ? userRef?.user_profiles[0]
        : userRef?.user_profiles
    return profile?.full_name || userRef?.user_name || '—'
}

// Helper to get user email from role row
export function getUserEmail(row: RoleRow): string | null | undefined {
    const userRef = Array.isArray(row.users) ? row.users[0] : row.users
    return userRef?.email
}

// Helper to get permission from role row
export function getPermission(row: RoleRow): Permission | null | undefined {
    return Array.isArray(row.permissions) ? row.permissions[0] : row.permissions
}

// Helper to format created date
export function formatCreatedDate(createdAt: string | null | undefined): string {
    return createdAt
        ? new Date(createdAt).toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
        })
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
