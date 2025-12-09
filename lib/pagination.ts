/**
 * Pagination Utilities for Supabase Queries
 * 
 * Implements cursor-based pagination to handle large datasets efficiently
 * Reduces memory usage and improves response times
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PaginationParams = {
  pageSize?: number;
  cursor?: string; // created_at timestamp for cursor-based pagination
  direction?: 'next' | 'prev';
};

export type PaginatedResult<T> = {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  total?: number;
};

export type ViolationRecordRow = {
  id: string;
  created_at: string;
  student_id: string;
  class_id: string;
  score: number;
  note: string | null;
  classes: { id: string; name: string | null } | { id: string; name: string | null }[] | null;
  criteria: { id: string; name: string | null } | { id: string; name: string | null }[] | null;
  users: {
    user_profiles: { full_name: string | null }[] | { full_name: string | null } | null;
    user_name: string | null;
  } | null;
};

/**
 * Default page size for queries
 * Keep small to avoid memory issues and improve TTFB
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/**
 * Build a paginated query for violation records
 * Uses cursor-based pagination with created_at timestamp
 * 
 * @example
 * ```ts
 * const result = await paginateViolationRecords(supabase, {
 *   pageSize: 50,
 *   cursor: '2024-12-09T10:00:00Z',
 *   direction: 'next'
 * });
 * ```
 */
export async function paginateViolationRecords(
  supabase: SupabaseClient,
  params: PaginationParams & {
    classIds?: string[];
    studentId?: string;
    criteriaId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<PaginatedResult<ViolationRecordRow>> {
  const pageSize = Math.min(params.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const direction = params.direction || 'next';

  let query = supabase
    .from('records')
    .select(
      'id, created_at, student_id, class_id, score, note, classes(id,name), criteria(id,name), users:student_id(user_profiles(full_name), user_name)',
      { count: 'exact' }
    )
    .is('deleted_at', null);

  // Apply filters
  if (params.classIds && params.classIds.length > 0) {
    query = query.in('class_id', params.classIds);
  }
  if (params.studentId) {
    query = query.eq('student_id', params.studentId);
  }
  if (params.criteriaId) {
    query = query.eq('criteria_id', params.criteriaId);
  }
  if (params.startDate) {
    query = query.gte('created_at', params.startDate);
  }
  if (params.endDate) {
    query = query.lte('created_at', params.endDate);
  }

  // Apply cursor for pagination
  if (params.cursor) {
    if (direction === 'next') {
      query = query.lt('created_at', params.cursor);
    } else {
      query = query.gt('created_at', params.cursor);
    }
  }

  // Order and limit
  query = query
    .order('created_at', { ascending: direction === 'prev' })
    .limit(pageSize + 1); // Fetch one extra to check if there are more

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Pagination query failed: ${error.message}`);
  }

  const rows = data || [];
  const hasMore = rows.length > pageSize;
  const actualData = hasMore ? rows.slice(0, pageSize) : rows;

  // Reverse data if fetching previous page
  if (direction === 'prev') {
    actualData.reverse();
  }

  return {
    data: actualData,
    hasMore,
    nextCursor: hasMore && actualData.length > 0 
      ? actualData[actualData.length - 1].created_at 
      : null,
    prevCursor: actualData.length > 0 
      ? actualData[0].created_at 
      : null,
    total: count ?? undefined,
  };
}

/**
 * Build a paginated query for user's violations
 * Optimized for client-side my-violations page
 */
export async function paginateMyViolations(
  supabase: SupabaseClient,
  userId: string,
  params: PaginationParams
): Promise<PaginatedResult<ViolationRecordRow>> {
  const pageSize = Math.min(params.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const direction = params.direction || 'next';

  let query = supabase
    .from('records')
    .select(
      'id, created_at, score, note, criteria(id,name), classes(id,name)',
      { count: 'exact' }
    )
    .eq('student_id', userId)
    .is('deleted_at', null);

  // Apply cursor
  if (params.cursor) {
    if (direction === 'next') {
      query = query.lt('created_at', params.cursor);
    } else {
      query = query.gt('created_at', params.cursor);
    }
  }

  // Order and limit
  query = query
    .order('created_at', { ascending: direction === 'prev' })
    .limit(pageSize + 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`My violations pagination failed: ${error.message}`);
  }

  const rows = data || [];
  const hasMore = rows.length > pageSize;
  const actualData = hasMore ? rows.slice(0, pageSize) : rows;

  if (direction === 'prev') {
    actualData.reverse();
  }

  return {
    data: actualData,
    hasMore,
    nextCursor: hasMore && actualData.length > 0 
      ? actualData[actualData.length - 1].created_at 
      : null,
    prevCursor: actualData.length > 0 
      ? actualData[0].created_at 
      : null,
    total: count ?? undefined,
  };
}

/**
 * Paginate recent records for violation entry page
 * Optimized for today's records only
 */
export async function paginateRecentRecords(
  supabase: SupabaseClient,
  classIds: string[],
  params: PaginationParams & { startOfDay: string }
): Promise<PaginatedResult<ViolationRecordRow>> {
  const pageSize = Math.min(params.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  let query = supabase
    .from('records')
    .select(
      'id, created_at, student_id, class_id, score, note, classes(id,name), criteria(name,id), users:student_id(user_profiles(full_name), user_name)',
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .in('class_id', classIds)
    .gte('created_at', params.startOfDay);

  if (params.cursor) {
    query = query.lt('created_at', params.cursor);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Recent records pagination failed: ${error.message}`);
  }

  const rows = data || [];
  const hasMore = rows.length > pageSize;
  const actualData = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    data: actualData,
    hasMore,
    nextCursor: hasMore && actualData.length > 0 
      ? actualData[actualData.length - 1].created_at 
      : null,
    prevCursor: actualData.length > 0 
      ? actualData[0].created_at 
      : null,
    total: count ?? undefined,
  };
}

/**
 * Helper to convert pagination params from URL search params
 * 
 * @example
 * ```ts
 * const params = parsePaginationParams(searchParams);
 * const result = await paginateViolationRecords(supabase, params);
 * ```
 */
export function parsePaginationParams(
  searchParams: Record<string, string | string[] | undefined>
): PaginationParams {
  return {
    pageSize: searchParams.pageSize 
      ? parseInt(String(searchParams.pageSize), 10) 
      : DEFAULT_PAGE_SIZE,
    cursor: typeof searchParams.cursor === 'string' ? searchParams.cursor : undefined,
    direction: searchParams.direction === 'prev' ? 'prev' : 'next',
  };
}
