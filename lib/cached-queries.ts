import { cache } from 'react'
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache'
import getSupabaseServer from '@/lib/supabase-server'

/**
 * Cached function to fetch violation records for a specific user
 * Uses React cache() for request-level deduplication
 */
export const getMyViolations = cache(async (userId: string) => {
  'use cache'
  cacheLife('minutes')
  cacheTag('violations', `violations-user-${userId}`)

  const supabase = await getSupabaseServer()
  const { data: rows, error } = await supabase
    .from('records')
    .select('id, created_at, score, note, criteria(id,name), classes(id,name)')
    .eq('student_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw error

  return (rows || []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    score: r.score,
    note: r.note,
    criteria: Array.isArray(r.criteria) ? r.criteria[0] : r.criteria,
    classes: Array.isArray(r.classes) ? r.classes[0] : r.classes,
  }))
})

/**
 * Cached function to fetch violation statistics across all classes
 */
export const getViolationStats = cache(async () => {
  'use cache'
  cacheLife('minutes')
  cacheTag('violations', 'violation-stats')

  const supabase = await getSupabaseServer()
  const { data: records, error } = await supabase
    .from('records')
    .select('class_id, score, classes(name)')
    .is('deleted_at', null)

  if (error) throw error

  const statsByClass = new Map<string, { name: string; count: number; total: number }>()

  for (const record of records || []) {
    const classId = record.class_id
    if (!classId) continue

    const classEntry = Array.isArray(record.classes) ? record.classes[0] : record.classes
    const className = classEntry?.name

    if (!statsByClass.has(classId)) {
      statsByClass.set(classId, { name: className || 'Unknown', count: 0, total: 0 })
    }

    const stat = statsByClass.get(classId)!
    stat.count += 1
    stat.total += record.score || 0
  }

  return Array.from(statsByClass.entries()).map(([classId, stat]) => ({
    classId,
    className: stat.name,
    totalViolations: stat.count,
    totalPoints: stat.total,
  }))
})

/**
 * Cached function to fetch leaderboard data
 */
export const getLeaderboard = cache(async (grade?: string) => {
  'use cache'
  cacheLife('minutes')
  cacheTag('leaderboard', grade ? `leaderboard-${grade}` : 'leaderboard-all')

  const supabase = await getSupabaseServer()

  let query = supabase
    .from('records')
    .select('class_id, score, classes(name, grade)')
    .is('deleted_at', null)

  if (grade) {
    query = query.eq('classes.grade', grade)
  }

  const { data: records, error } = await query

  if (error) throw error

  // Aggregate scores by class
  const scoresByClass = new Map<string, { name: string; grade: string; total: number }>()

  for (const record of records || []) {
    const classId = record.class_id
    if (!classId) continue

    const classInfo = Array.isArray(record.classes) ? record.classes[0] : record.classes
    const className = classInfo?.name || 'Unknown'
    const classGrade = classInfo?.grade || ''

    if (!scoresByClass.has(classId)) {
      scoresByClass.set(classId, { name: className, grade: classGrade, total: 0 })
    }

    scoresByClass.get(classId)!.total += record.score || 0
  }

  // Sort by total score (descending)
  const leaderboard = Array.from(scoresByClass.entries())
    .map(([classId, data]) => ({
      classId,
      className: data.name,
      grade: data.grade,
      totalScore: data.total,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)

  return leaderboard
})
