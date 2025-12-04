import type { Criteria } from '@/lib/violations'

export function summarizeCriteria(criteria: Criteria[]) {
  const total = criteria.length
  const active = criteria.filter((c) => c.isActive).length
  const byCategory = criteria.reduce(
    (acc, item) => {
      const key = item.category || 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const byType = criteria.reduce(
    (acc, item) => {
      const key = item.type || 'normal'
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  return { total, active, byCategory, byType }
}
