import type { SupabaseClient } from '@supabase/supabase-js'
import type { Criteria } from '@/lib/violations'
import { fetchCriteriaFromDB } from '@/lib/violations'

// Types
export type CriteriaFilterState = {
    q?: string
    category?: string
    type?: string
    status?: string
}

export type CriteriaStats = {
    total: number
    active: number
    byCategory: Record<string, number>
    byType: Record<string, number>
}

// Fetch criteria data
export async function fetchCriteriaData(
    supabase: SupabaseClient
): Promise<Criteria[]> {
    return await fetchCriteriaFromDB(supabase, { includeInactive: true })
}

// Normalize filter from searchParams
export function normalizeFilter(
    searchParams?: Record<string, string | string[] | undefined>
): CriteriaFilterState {
    const get = (key: string) => {
        const raw = searchParams?.[key]
        if (Array.isArray(raw)) return raw[0]
        return raw ?? ''
    }
    return {
        q: get('q') || undefined,
        category: get('category') || undefined,
        type: get('type') || undefined,
        status: get('status') || undefined,
    }
}

// Apply filters to criteria list
export function applyFilters(
    criteria: Criteria[],
    filters: CriteriaFilterState
): Criteria[] {
    return criteria.filter((item) => {
        if (filters.status === 'active' && !item.isActive) return false
        if (filters.status === 'inactive' && item.isActive) return false
        if (filters.category && item.category !== filters.category) return false
        if (filters.type && item.type !== filters.type) return false
        if (filters.q) {
            const q = filters.q.toLowerCase()
            const text = [item.name, item.description, item.group, item.subgroup]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            if (!text.includes(q)) return false
        }
        return true
    })
}

// Calculate criteria statistics
export function summarizeCriteria(criteria: Criteria[]): CriteriaStats {
    const total = criteria.length
    const active = criteria.filter((c) => c.isActive).length
    const byCategory = criteria.reduce(
        (acc, item) => {
            const key = item.category || 'unknown'
            acc[key] = (acc[key] || 0) + 1
            return acc
        },
        {} as Record<string, number>
    )
    const byType = criteria.reduce(
        (acc, item) => {
            const key = item.type || 'normal'
            acc[key] = (acc[key] || 0) + 1
            return acc
        },
        {} as Record<string, number>
    )
    return { total, active, byCategory, byType }
}

// Format summary for display
export function formatSummary(map: Record<string, number>): string {
    const entries = Object.entries(map)
    if (!entries.length) return '0'
    return entries
        .map(([key, count]) => {
            if (key === 'class') return `${count} tập thể`
            if (key === 'student') return `${count} học sinh`
            if (key === 'normal') return `${count} thường`
            if (key === 'serious') return `${count} nghiêm trọng`
            if (key === 'critical') return `${count} rất nghiêm trọng`
            return `${count} ${key}`
        })
        .join(', ')
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
