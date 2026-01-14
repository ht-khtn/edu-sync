import type { PerfEntry } from './types'

export const OLYMPIA_HOST_PERF_TRACE = process.env.OLYMPIA_PERF_TRACE === '1'
export const OLYMPIA_HOST_SLOW_LOG_MS = 2000

export function nowMs(): number {
  const p = (globalThis as unknown as { performance?: { now: () => number } }).performance
  return p ? p.now() : Date.now()
}

export async function measure<T>(
  entries: PerfEntry[],
  label: string,
  fn: () => PromiseLike<T>
): Promise<T> {
  const start = nowMs()
  try {
    return await fn()
  } finally {
    entries.push({ label, ms: Math.round((nowMs() - start) * 10) / 10 })
  }
}

export async function perfTime<T>(label: string, fn: () => PromiseLike<T>): Promise<T> {
  if (!OLYMPIA_HOST_PERF_TRACE) return await fn()
  console.time(label)
  try {
    return await fn()
  } finally {
    console.timeEnd(label)
  }
}

export function perfTimeSync<T>(label: string, fn: () => T): T {
  if (!OLYMPIA_HOST_PERF_TRACE) return fn()
  console.time(label)
  try {
    return fn()
  } finally {
    console.timeEnd(label)
  }
}
