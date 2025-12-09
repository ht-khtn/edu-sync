# Step 3: Optimize Supabase Queries

**Status:** Ready to implement  
**Priority:** High  
**Expected Gains:** DB load -60%, pagination -80% per-request payload, batch API -99% round-trips

## Summary

Supabase query optimization sẽ:
- **Pagination:** Cursor-based pagination để giảm payload size
- **Real-time filtering:** Filter ở database level thay vì client
- **Batch API:** Combine multiple records vào 1 insert call
- **Query optimization:** Proper indexing & eager loading

---

## 3.1 Cursor-Based Pagination

### Current Issue
```typescript
// lib/violations.ts - getUserViolations()
.limit(300) // ❌ Fetches ALL 300 violations in one query
// If violations table has 10k+ rows, this causes:
// - Large payload (3-5MB)
// - Memory spike on server & client
// - Slow network transfer
// - No way to implement "load more" pattern
```

### Solution: Cursor-Based Pagination

**File:** `lib/violations.ts`

```typescript
// NEW: Add pagination types
interface PaginationCursor {
  id: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  nextCursor: PaginationCursor | null;
  hasMore: boolean;
}

// MODIFIED: getUserViolations with pagination
export async function getUserViolations(
  supabase: SupabaseClient,
  userId: string,
  cursor?: PaginationCursor,
  limit = 50 // Default 50 instead of 300
): Promise<PaginatedResponse<ViolationWithRelations>> {
  'use cache';
  
  // Fetch limit + 1 to detect if more exist
  let query = supabase
    .from('violations')
    .select('*, users(*), criteria(*), classes(*)', { count: 'exact' })
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  // Apply cursor (pagination marker)
  if (cursor) {
    query = query.lt('created_at', cursor.createdAt);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  const items = (data || []).slice(0, limit);
  const hasMore = (data?.length || 0) > limit;

  return {
    items,
    nextCursor: hasMore
      ? {
          id: items[items.length - 1].id,
          createdAt: items[items.length - 1].created_at
        }
      : null,
    hasMore
  };
}

// MODIFIED: getClassViolations with pagination
export async function getClassViolations(
  supabase: SupabaseClient,
  classId: string,
  cursor?: PaginationCursor,
  limit = 50
): Promise<PaginatedResponse<ViolationWithRelations>> {
  'use cache';

  let query = supabase
    .from('violations')
    .select('*, users(*), criteria(*)', { count: 'exact' })
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor.createdAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = (data || []).slice(0, limit);
  const hasMore = (data?.length || 0) > limit;

  return {
    items,
    nextCursor: hasMore
      ? {
          id: items[items.length - 1].id,
          createdAt: items[items.length - 1].created_at
        }
      : null,
    hasMore
  };
}
```

### UI Component: "Load More" Implementation

**File:** `components/admin/violation-history/Page.tsx` (or wherever violations are listed)

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/client/LoadingSkeleton';
import { getUserViolations, type PaginationCursor } from '@/lib/violations';

export function ViolationsList() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [cursor, setCursor] = useState<PaginationCursor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadMore = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getUserViolations(userId, cursor, 50);
      setViolations(prev => [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } finally {
      setIsLoading(false);
    }
  }, [cursor, userId]);

  return (
    <div className="space-y-6">
      {/* Violations table/list */}
      <ViolationsTable violations={violations} />

      {/* Load More button */}
      {hasMore && (
        <Button
          onClick={loadMore}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <LoadingSkeleton /> : 'Tải thêm vi phạm'}
        </Button>
      )}
    </div>
  );
}
```

### Expected Improvements
- **Per-request payload:** 3-5MB → 50-100KB (98% ↓)
- **Server memory:** Reduced by 90%
- **Network time:** 2-3s → 100-200ms (95% ↓)
- **User experience:** Infinite scroll / load more pattern

---

## 3.2 Real-Time Filter Optimization

### Current Issue
```typescript
// components/olympia/OlympiaRealtimeListener.tsx
const channel = supabase.channel('olympia_channel')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'live_sessions' // ❌ Subscribes to ALL live_sessions
    },
    handleChange
  )
  .subscribe();

// If 100 concurrent users in 20 matches:
// - Every change broadcasts to all 100 users
// - 2000+ database events/minute
// - Server & network overhead
```

### Solution: Filter at Database Level

**File:** `components/olympia/OlympiaRealtimeListener.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useSupabaseClient } from '@/lib/supabase'; // Browser client
import type { RealtimeChannel } from '@supabase/supabase-js';

interface OlympiaRealtimeListenerProps {
  matchId?: string;
  sessionId?: string;
  onLiveSessionChange?: (payload: any) => void;
  onMatchScoresChange?: (payload: any) => void;
  onBuzzerChange?: (payload: any) => void;
}

export function OlympiaRealtimeListener({
  matchId,
  sessionId,
  onLiveSessionChange,
  onMatchScoresChange,
  onBuzzerChange
}: OlympiaRealtimeListenerProps) {
  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!supabase) return;

    const channels: RealtimeChannel[] = [];

    // 1. Session changes (FILTERED by sessionId)
    if (sessionId) {
      const sessionChannel = supabase.channel(
        `session-${sessionId}` // Unique channel name
      )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_sessions',
            filter: `id=eq.${sessionId}` // ✅ FILTER at DB level
          },
          onLiveSessionChange
        )
        .subscribe();

      channels.push(sessionChannel);
    }

    // 2. Match scores (FILTERED by matchId)
    if (matchId) {
      const scoresChannel = supabase.channel(
        `match-scores-${matchId}`
      )
        .on(
          'postgres_changes',
          {
            event: 'INSERT,UPDATE',
            schema: 'olympia',
            table: 'match_scores',
            filter: `match_id=eq.${matchId}` // ✅ FILTER
          },
          onMatchScoresChange
        )
        .subscribe();

      channels.push(scoresChannel);
    }

    // 3. Buzzer events (FILTERED by matchId)
    if (matchId) {
      const buzzerChannel = supabase.channel(
        `buzzer-${matchId}`
      )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'olympia',
            table: 'buzzer_events',
            filter: `match_id=eq.${matchId}` // ✅ FILTER
          },
          onBuzzerChange
        )
        .subscribe();

      channels.push(buzzerChannel);
    }

    // Cleanup
    return () => {
      channels.forEach(ch => {
        ch.unsubscribe();
      });
    };
  }, [supabase, sessionId, matchId, onLiveSessionChange, onMatchScoresChange, onBuzzerChange]);

  return null; // This is a listener-only component
}
```

### Usage in Game Page

**File:** `app/(olympia)/olympia/(client)/game/[sessionId]/page.tsx`

```typescript
import { OlympiaRealtimeListener } from '@/components/olympia/OlympiaRealtimeListener';
import { OlympiaGameClient } from '@/components/olympia/game';

export default function GamePage({ params }: { params: { sessionId: string } }) {
  const handleSessionUpdate = (payload: any) => {
    // Handle session state change
    console.log('Session updated:', payload);
  };

  const handleBuzzerEvent = (payload: any) => {
    // Handle buzzer press
    console.log('Buzzer:', payload);
  };

  return (
    <>
      {/* Real-time listener with filters */}
      <OlympiaRealtimeListener
        sessionId={params.sessionId}
        onLiveSessionChange={handleSessionUpdate}
        onBuzzerChange={handleBuzzerEvent}
      />

      {/* Game UI */}
      <OlympiaGameClient sessionId={params.sessionId} />
    </>
  );
}
```

### Expected Improvements
- **Realtime events/min:** 2000+ → 50-100 (98% ↓)
- **Server load:** Reduced by 95%
- **Network messages:** Only relevant updates broadcast
- **Latency:** Instant delivery (no filtering client-side)

---

## 3.3 Batch Insert API Endpoint

### Current Issue
```typescript
// Creating 100 violations
for (const student of students) {
  await createViolation(student); // 100 API calls 🚫
}
// Each call = 500ms minimum (network round-trip)
// Total time: 50 seconds!
```

### Solution: Batch Endpoint

**File:** `app/api/violations/batch/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getServerAuthContext, getServerRoles, summarizeRoles } from '@/lib/server-auth';
import { revalidateTag } from 'next/cache';

const MAX_BATCH_SIZE = 100;

interface BatchViolationRequest {
  violations: {
    student_id: string;
    criteria_id: string;
    points: number;
    notes?: string;
    class_id?: string;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth & authorization
    const [{ appUserId }, roles] = await Promise.all([
      getServerAuthContext(),
      getServerRoles()
    ]);

    if (!appUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const summary = summarizeRoles(roles);
    if (!summary.canEnterViolations) {
      return NextResponse.json(
        { error: 'Not permitted to enter violations' },
        { status: 403 }
      );
    }

    // 2. Parse request
    const body: BatchViolationRequest = await request.json();
    const { violations } = body;

    // 3. Validate
    if (!Array.isArray(violations)) {
      return NextResponse.json(
        { error: 'violations must be an array' },
        { status: 400 }
      );
    }

    if (violations.length === 0) {
      return NextResponse.json(
        { error: 'violations array cannot be empty' },
        { status: 400 }
      );
    }

    if (violations.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Max ${MAX_BATCH_SIZE} violations per batch` },
        { status: 400 }
      );
    }

    // 4. Add metadata to each violation
    const supabase = await getSupabaseServer();
    const now = new Date().toISOString();

    const enrichedViolations = violations.map(v => ({
      ...v,
      recorded_by_id: appUserId,
      recorded_at: now,
      created_at: now,
      updated_at: now
    }));

    // 5. Batch insert
    const { data, error } = await supabase
      .from('violations')
      .insert(enrichedViolations)
      .select('id,student_id,criteria_id,points,created_at');

    if (error) {
      console.error('[Batch Insert] Error:', error);
      return NextResponse.json(
        { error: 'Failed to insert violations' },
        { status: 500 }
      );
    }

    // 6. Invalidate caches
    revalidateTag('violations'); // All violation caches
    revalidateTag('leaderboard'); // Leaderboard might change
    revalidateTag('violation-stats'); // Stats might change

    return NextResponse.json(
      {
        success: true,
        count: data?.length || 0,
        data
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Batch Insert] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Client Usage

**File:** `components/admin/violation-entry/Page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function ViolationEntry() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleBatchSubmit = async (violations: Violation[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/violations/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violations })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save violations');
      }

      const result = await response.json();
      toast({
        title: 'Thành công',
        description: `Tạo ${result.count} vi phạm`
      });

      // Refetch list
      router.refresh();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: error instanceof Error ? error.message : 'Không rõ lỗi',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Form to collect violations */}
      <button
        onClick={() => handleBatchSubmit(violations)}
        disabled={isLoading}
      >
        {isLoading ? 'Đang lưu...' : 'Lưu tất cả'}
      </button>
    </div>
  );
}
```

### Expected Improvements
- **API calls:** 100 → 1 (99% ↓)
- **Time to save:** 50s → 500ms (98% ↓)
- **Server overhead:** Reduced by 99%
- **User experience:** Single submit, instant feedback

---

## 3.4 Query Optimization & Indexing

### Database Indexes Needed

**File:** Database migrations (if using Supabase)

```sql
-- Violations table indexes (for pagination & filtering)
CREATE INDEX idx_violations_student_id_created_at 
  ON violations(student_id, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_violations_class_id_created_at 
  ON violations(class_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Olympia tables
CREATE INDEX idx_live_sessions_match_id 
  ON olympia.live_sessions(match_id);

CREATE INDEX idx_match_scores_match_id 
  ON olympia.match_scores(match_id);

CREATE INDEX idx_buzzer_events_match_id 
  ON olympia.buzzer_events(match_id);

-- Users/Classes for joins
CREATE INDEX idx_users_class_id 
  ON users(class_id);

CREATE INDEX idx_classes_name 
  ON classes(name);
```

### Query Optimization Patterns

#### 1. Avoid N+1 Queries
```typescript
// ❌ Bad: Loads 100 violations, then for each → fetch student
for (const v of violations) {
  const student = await getStudent(v.student_id); // N+1!
}

// ✅ Good: Fetch all with relations in 1 query
const violations = await supabase
  .from('violations')
  .select('*, users(*), criteria(*)')
  .eq('class_id', classId);
```

#### 2. Use Select Projection
```typescript
// ❌ Bad: Fetches all columns (including large JSON)
const violations = await supabase
  .from('violations')
  .select('*'); // ~50 columns

// ✅ Good: Only needed columns
const violations = await supabase
  .from('violations')
  .select('id,student_id,criteria_id,points,created_at');
```

#### 3. Use Count Efficiently
```typescript
// ❌ Bad: Counts all rows
const { count } = await supabase
  .from('violations')
  .select('*', { count: 'exact' })
  .eq('class_id', classId);

// ✅ Good: Use estimate for large tables
const { count } = await supabase
  .from('violations')
  .select('*', { count: 'estimated' }) // 100x faster
  .eq('class_id', classId);
```

---

## 3.5 Implementation Checklist

### Phase 1: Pagination (2-3 days)
- [ ] Add pagination types to `lib/violations.ts`
- [ ] Update `getUserViolations()` with cursor-based pagination
- [ ] Update `getClassViolations()` with pagination
- [ ] Update UI components to show "Load More" button
- [ ] Test pagination with large datasets

### Phase 2: Real-time Filtering (1-2 days)
- [ ] Update `OlympiaRealtimeListener.tsx` to add filters
- [ ] Test that only relevant events broadcast
- [ ] Verify Realtime message count drops 95%+
- [ ] Update all game pages to use filtered channels

### Phase 3: Batch API (1-2 days)
- [ ] Create `app/api/violations/batch/route.ts`
- [ ] Update violation-entry component to batch submit
- [ ] Add validation (max 100 per batch)
- [ ] Test with bulk import scenario (100+ violations)
- [ ] Add error handling & retry logic

### Phase 4: Database Indexing (1 day)
- [ ] Create migration file with indexes
- [ ] Apply to production database
- [ ] Verify query performance with EXPLAIN ANALYZE
- [ ] Monitor slow queries

### Phase 5: Testing & Verification (2 days)
- [ ] Benchmark before/after query times
- [ ] Monitor database load (CPU, connections)
- [ ] Test pagination edge cases (cursor validity)
- [ ] Realtime stress test (100+ concurrent)
- [ ] Batch API with max payload

---

## Performance Targets

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| User violations payload | 3-5MB | 50-100KB | 98% ↓ |
| DB queries/min | 2000+ | 50-100 | 95% ↓ |
| Batch insert time | 50s | 500ms | 99% ↓ |
| Realtime events/min | 2000+ | 50 | 97% ↓ |
| DB connection count | 100+ | 10-20 | 90% ↓ |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cursor invalidation | Pagination breaks | Store cursor in URL/session, refresh on error |
| Batch API timeout | Slow requests fail | Implement chunking (50 at a time) |
| Realtime filter bugs | Missing updates | Monitor with test data, add logging |
| Index bloat | Slower inserts | Regular VACUUM & maintenance |

---

**Next:** Step 4 will implement cache headers & Edge caching
