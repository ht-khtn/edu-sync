# Supabase Operations Optimization Plan

**Date:** December 10, 2025  
**Status:** 🔄 PLANNING  
**Goal:** Optimize remaining slow Supabase operations (sidebar, login, violation entry, accounts)  
**Estimated Total Impact:** 2.8-7.2 seconds improvement across user workflows  

---

## 📋 Executive Summary

After optimizing auth checks in Phase 6 (auth optimization), user-facing operations tied to Supabase are still slow:
- **Sidebar:** 200-500ms (client-side Olympia check)
- **Login:** +800-1200ms (sequential API calls)
- **Violation Entry:** 500-1500ms (sequential RBAC + unbounded student fetch)
- **Account Management:** 500-1200ms (over-fetching + sequential writes)
- **Recent Records:** 400-1000ms (4+ sequential queries)

**Root Causes:**
1. Sequential queries that could run in parallel (600-1200ms waste)
2. Client-side checks that should be server-side (200-500ms waste)
3. Unbounded queries without pagination (200-500ms + bandwidth waste)
4. Over-fetching relational data (200-400ms + 300-500KB waste)

---

## 🎯 Implementation Plan

### Phase 1: Quick Wins - Parallelization (3 hours)

**Goal:** Parallelize sequential queries that are blocking each other

#### Task 1.1: Parallelize Login Flow

**File:** `components/login/LoginForm.tsx`

**Issue:** Login makes 3 sequential API calls after auth
```
1. supabase.auth.signInWithPassword() → wait
2. fetch("/api/auth/set-session") → wait
3. fetch("/api/session") → wait  
4. router.refresh()
```

**Solution:** Parallelize steps 2-3 (both independent)
```typescript
// BEFORE (sequential)
const result = await supabase.auth.signInWithPassword({...})
await fetch("/api/auth/set-session", {...})
const sessionRes = await fetch("/api/session")
const userData = await sessionRes.json()

// AFTER (parallel)
const result = await supabase.auth.signInWithPassword({...})
const [, sessionRes] = await Promise.all([
  fetch("/api/auth/set-session", {...}),
  fetch("/api/session")
])
const userData = await sessionRes.json()
```

**Expected Gain:** 200-400ms  
**Complexity:** Low  
**Priority:** 🔴 CRITICAL

---

#### Task 1.2: Move Olympia Check to Server-Side

**File:** `lib/server-auth.ts` (add new function), `components/admin/layout/AdminSidebar.tsx` (remove hook)

**Issue:** Sidebar checks Olympia access with client-side useEffect
- Runs on every page load
- Adds 200-500ms network delay
- No caching between page transitions

**Solution:** Include Olympia check in session endpoint, cache in context

**Step 1:** Add Olympia access check to `getServerRoles()`
```typescript
// In getServerRoles() return object, add:
hasOlympiaAccess: roles.some(r => r.role_id === 'OLYMPIA_ADMIN' || r.role_id === 'OLYMPIA_USER')
```

**Step 2:** Remove client-side Olympia hook from AdminSidebar
```typescript
// DELETE this entire useEffect from AdminSidebar.tsx (lines 105-120):
useEffect(() => {
  checkOlympiaAccess()
}, [])
```

**Step 3:** Use server-side data in AuthProvider
```typescript
// AuthProvider.tsx: Pass Olympia access from session
const [state, setState] = useState({
  ...existing,
  hasOlympiaAccess: false,
})
// Parse from session response
```

**Expected Gain:** 200-500ms per page load  
**Complexity:** Medium  
**Priority:** 🔴 CRITICAL  
**Files:** 3 changes

---

#### Task 1.3: Parallelize Violation Entry RBAC Queries

**File:** `components/admin/violation-entry/Page.tsx`

**Issue:** Multiple sequential queries to resolve user's allowed classes
```
1. Query user_roles 
2. Query classes
3. If not found, query users table
4. Call getAllowedClassIdsForWrite() (another query)
```

**Solution:** Parallelize steps 1-2, remove fallback logic

**Current Code (Lines 37-40):**
```typescript
const [{ data: roles }, { data: classes }] = await Promise.all([
  supabaseServer
    .from("user_roles")
    .select("role_id,target")
    .eq("user_id", appUserId),
  supabaseServer.from("classes").select("id,name"),
])
```

**Good part:** Already parallel ✅  
**Bad part:** Fallback query afterward (lines 50-56) runs sequentially

**Fix:** Remove fallback logic, normalize class targets upfront
```typescript
// DELETE lines 50-56 (the fallback user lookup)
// REASON: If class not found by name, it doesn't exist - no need to query users

// Instead, show error: "Class '{name}' not configured in system"
```

**Step 1:** Remove lines 50-56 entirely
```typescript
// BEFORE:
if (managedClassIds.size === 0 && classTargets.length > 0) {
  try {
    const { data: usersByName } = await supabaseServer
      .from("users")
      .select("id,class_id,user_name")
      .in("user_name", classTargets)
    for (const u of usersByName || []) {
      if (u.class_id) managedClassIds.add(u.class_id)
    }
  } catch {}
}

// AFTER: (DELETE - no fallback)
```

**Step 2:** Verify remaining RBAC queries are parallel
- Lines 37-40: ✅ already parallel (roles + classes)
- Line 72: `getAllowedClassIdsForWrite()` should be called once and reused

**Expected Gain:** 300-500ms  
**Complexity:** Low  
**Priority:** 🟡 HIGH

---

#### Task 1.4: Lazy Load RecentRecordsList

**File:** `components/admin/violation-entry/Page.tsx`

**Issue:** RecentRecordsList renders immediately, does 4+ sequential queries before showing data

**Solution:** Wrap in `<Suspense>` with skeleton, load after main form

**Step 1:** Add Suspense wrapper (around line 185)
```typescript
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export default async function ViolationEntryPageContent() {
  // ... form code ...
  
  return (
    <section>
      <ViolationForm .../>
      
      <Suspense fallback={<RecentRecordsSkeleton />}>
        <RecentRecordsList />
      </Suspense>
    </section>
  )
}

function RecentRecordsSkeleton() {
  return <div className="space-y-2">{...skeleton items...}</div>
}
```

**Expected Gain:** 200-400ms (perceived - form appears sooner)  
**Complexity:** Low  
**Priority:** 🟡 HIGH

---

### Phase 2: Payload Optimization (2.5 hours)

**Goal:** Reduce data transferred and fetched

#### Task 2.1: Add Pagination to Student Fetch

**File:** `lib/violations.ts` (function `fetchStudentsFromDB`)

**Issue:** Fetches all students, no limit
- Large schools: 500+ students = 50-100KB per load
- For 20 classes = 10,000 rows transferred
- Memory spike on both server and client

**Current Code (lines 113-155):**
```typescript
export async function fetchStudentsFromDB(
  supabase: SupabaseClient,
  classId?: string,
  classIds?: Set<string>
) {
  let query = supabase
    .from("users")
    .select("id, user_name, class_id, user_profiles(full_name)")
    // ❌ NO LIMIT

  if (classId) query = query.eq("class_id", classId)
  if (classIds?.size) query = query.in("class_id", Array.from(classIds))

  const { data } = await query.order("user_name")
  return data ?? []
}
```

**Solution:** Add limit + cursor-based pagination

```typescript
export async function fetchStudentsFromDB(
  supabase: SupabaseClient,
  classId?: string,
  classIds?: Set<string>,
  limit: number = 50,
  offset: number = 0
) {
  let query = supabase
    .from("users")
    .select("id, user_name, class_id, user_profiles(full_name)", { count: "exact" })
    .limit(limit)
    .offset(offset)

  if (classId) query = query.eq("class_id", classId)
  if (classIds?.size) query = query.in("class_id", Array.from(classIds))

  const { data, count } = await query.order("user_name")
  return { students: data ?? [], total: count ?? 0 }
}
```

**Step 1:** Add `limit` and `offset` parameters  
**Step 2:** Return object with `{students, total}` instead of just array  
**Step 3:** Update callers in violation-entry to handle new return format  
**Step 4:** Add "Load more students" button to form

**Expected Gain:** 200-400ms (especially large schools)  
**Complexity:** Medium  
**Priority:** 🟡 HIGH  
**Files:** 2+ changes

---

#### Task 2.2: Simplify Accounts Page Query Projection

**File:** `hooks/domain/useAccounts.ts` (function `fetchAccountsData`)

**Issue:** Fetches all nested relations for all users
```typescript
.select(
  'id, user_name, email, class_id, created_at, 
   user_profiles(full_name,phone_number), 
   user_roles(role_id,target,permissions(name,scope))'  // ❌ All nested
)
.limit(300)  // ❌ Hard limit, no pagination
```

**Impact:** 300 users × 3-5 roles × 1-3 permissions = 500-1000 rows transferred

**Solution:** Fetch only needed columns, lazy load relations

```typescript
// BEFORE:
const { data: rows } = await supabase
  .from('users')
  .select(
    'id, user_name, email, class_id, created_at, user_profiles(full_name,phone_number), user_roles(role_id,target,permissions(name,scope))'
  )
  .limit(300)

// AFTER:
const { data: rows, count } = await supabase
  .from('users')
  .select(
    'id, user_name, email, class_id, created_at, user_profiles(full_name)',
    { count: 'exact' }
  )
  .order('created_at', { ascending: false })
  .limit(100)
  .offset(0)

// If need roles/permissions:
// - Fetch separately on demand (when user clicks to edit)
// - Or add to AccountsTable as separate lazy-load fetch
```

**Step 1:** Remove nested `user_roles` and `permissions` from select  
**Step 2:** Add `count` option to track total  
**Step 3:** Reduce limit from 300 to 100 or 50  
**Step 4:** Add "Load more" button or implement pagination

**Expected Gain:** 200-400ms (50-70% less data)  
**Complexity:** Medium  
**Priority:** 🟡 HIGH  
**Files:** 2 changes

---

#### Task 2.3: Add Limit to RecentRecordsList Query

**File:** `components/admin/violation/RecentRecordsList.tsx`

**Issue:** Query fetches all records from start of day (unbounded)
- Average 200-500 records per day
- Complex nested join returns lots of data

**Current Code (lines 58-66):**
```typescript
const { data: records } = await supabase
  .from("records")
  .select(
    'id, created_at, student_id, class_id, score, note, 
     classes(id,name), 
     criteria(name,id), 
     users:student_id(user_profiles(full_name), user_name)'  // ❌ Complex join
  )
  .gte("created_at", startIso)
  .order("created_at", { ascending: false })
  // ❌ NO LIMIT
```

**Solution:** Add limit + "load more" button

```typescript
// BEFORE:
const { data: records } = await supabase
  .from("records")
  .select(...full join...)
  .gte("created_at", startIso)
  .order("created_at", { ascending: false })

// AFTER:
const { data: records } = await supabase
  .from("records")
  .select(...full join...)
  .gte("created_at", startIso)
  .order("created_at", { ascending: false })
  .limit(50)  // ← ADD THIS

// If user wants more: 
// .range(0, 49) then .range(50, 99) etc with offset
```

**Step 1:** Add `.limit(50)` to query  
**Step 2:** Add pagination state + "Load more" button  
**Step 3:** Implement range-based pagination

**Expected Gain:** 100-300ms  
**Complexity:** Medium  
**Priority:** 🟡 HIGH

---

#### Task 2.4: Simplify Session Endpoint Query

**File:** `app/api/session/route.ts`

**Issue:** Fetches full role + permissions nested relations

**Current Code (lines 32-35):**
```typescript
const { data: roles } = await supabase
  .from("user_roles")
  .select(
    "role_id, target, permissions(scope), users!inner(id, auth_uid)"
  )
  .eq("users.auth_uid", authUid)
```

**Problem:** Fetches entire `permissions` object, but only uses `scope`

**Solution:** Use column projection

```typescript
// BEFORE:
.select("role_id, target, permissions(scope), users!inner(id, auth_uid)")

// AFTER:
.select("role_id, target, permissions(scope)")
.eq("user_id", appUserId)  // ← Simplify: use appUserId directly, not join
```

**Step 1:** Remove unnecessary `users!inner()` join  
**Step 2:** Select only `scope` from permissions  

**Expected Gain:** 50-100ms  
**Complexity:** Low  
**Priority:** 🟡 HIGH

---

### Phase 3: Advanced Caching (2 hours)

**Goal:** Cache expensive results to avoid repeated queries

#### Task 3.1: Cache Class/Role Lookups at Request Level

**File:** `lib/rbac.ts` + `lib/server-auth.ts`

**Issue:** Multiple components look up the same class names or resolve roles
- No deduplication between them
- Same class → same ID lookup done 3-4 times per request

**Solution:** Use React `cache()` wrapper

**Current Code:**
```typescript
// In lib/rbac.ts:
export async function getAllowedClassIdsForView(
  supabase: SupabaseClient,
  userId: string
) {
  // Looks up user roles + resolves to class IDs
  // But if called by multiple components, does this 2-3 times!
}
```

**Fix:** Wrap with cache()
```typescript
// In lib/rbac.ts:
import { cache } from 'react'

export const getAllowedClassIdsForView = cache(async (
  supabase: SupabaseClient,
  userId: string
) => {
  // ... existing logic ...
  // Now deduped within same request
})

export const getAllowedClassIdsForWrite = cache(async (
  supabase: SupabaseClient,
  userId: string
) => {
  // ... existing logic ...
})
```

**Step 1:** Import `cache` from 'react'  
**Step 2:** Wrap function declaration: `export const fn = cache(async (...) => {...})`  
**Step 3:** Add to all RBAC helper functions

**Expected Gain:** 200-400ms (if multiple calls to same class lookup)  
**Complexity:** Low  
**Priority:** 🟢 MEDIUM  
**Files:** 1 change

---

#### Task 3.2: Cache Criteria + Classes at Component Level

**File:** `components/admin/violation-entry/Page.tsx`

**Issue:** Criteria and classes data rarely changes, but fetched fresh every time
- Criteria: Changes ~1-2 times per week
- Classes: Never changes during a session

**Solution:** Store in React context or pass via Suspense boundary

**Option A - Use Context (simpler)**
```typescript
// Create: lib/context/data-context.ts
import { createContext, useContext } from 'react'

const DataContext = createContext<{
  criteria: Criteria[]
  classes: ClassData[]
} | null>(null)

// In violation-entry root component:
export default async function ViolationEntryPageContent() {
  const criteria = await fetchCriteriaFromDB(supabaseServer)
  const { data: classes } = await supabaseServer.from('classes').select('id,name')
  
  return (
    <DataContext value={{ criteria, classes }}>
      <ViolationForm />
      <RecentRecordsList />
    </DataContext>
  )
}

// In child components:
const { criteria, classes } = useContext(DataContext)
```

**Option B - Cache with React cache() (if used multiple times in request)**
```typescript
import { cache } from 'react'

export const getCachedCriteria = cache(async (supabase) => {
  return fetchCriteriaFromDB(supabase)
})
```

**Expected Gain:** 100-200ms (cached on repeat renders/transitions)  
**Complexity:** Medium  
**Priority:** 🟢 MEDIUM  
**Recommendation:** Use Option A (Context) for clarity

---

#### Task 3.3: Parallelize Account Creation Writes

**File:** `app/(admin)/admin/actions.ts` (function `createAccountAction`)

**Issue:** Account creation does 3 sequential writes
```
1. INSERT user
2. INSERT user_profile
3. INSERT audit_log
4. Wait for each...
```

**Current Code (lines 72-86):**
```typescript
const { data: insertedUser, error } = await supabase
  .from('users')
  .insert({...})
  .select('id')
  .single()

if (fullName) {
  await supabase
    .from('user_profiles')
    .upsert({ user_id: insertedUser.id, full_name: fullName })
}

await supabase.from('audit_logs').insert({...})
```

**Solution:** Parallelize profile + audit (both depend only on user.id)

```typescript
// BEFORE (sequential):
const { data: insertedUser } = await supabase.from('users').insert({...}).select('id').single()
if (fullName) {
  await supabase.from('user_profiles').upsert({...})
}
await supabase.from('audit_logs').insert({...})

// AFTER (parallel):
const { data: insertedUser } = await supabase.from('users').insert({...}).select('id').single()

// Profile + Audit can run in parallel (both depend on insertedUser.id)
await Promise.all([
  fullName ? supabase.from('user_profiles').upsert({
    user_id: insertedUser.id,
    full_name: fullName
  }) : Promise.resolve(),
  supabase.from('audit_logs').insert({
    user_id: insertedUser.id,
    action: 'created',
    ...
  })
])
```

**Step 1:** Keep user INSERT sequential (no deps)  
**Step 2:** Wrap profile UPSERT + audit INSERT in `Promise.all()`  

**Expected Gain:** 200-400ms (saves 1-2 round-trips)  
**Complexity:** Low  
**Priority:** 🟡 HIGH  
**Files:** 1 change

---

### Phase 4: Server-Side Rendering & Advanced Optimization (1.5 hours)

**Goal:** Move heavy logic to server-side, eliminate sequential client-server round-trips

#### Task 4.1: Optimize Session Endpoint RBAC Resolution

**File:** `app/api/session/route.ts`

**Issue:** Session endpoint does 2-3 sequential queries:
```
1. auth.getUser()
2. users.select().eq('auth_uid')
3. user_roles.select().eq('user_id')
4. (Conditionally) resolve CC role class names
```

**Current Code (lines 15-60):**
```typescript
export async function GET() {
  const supabase = await getSupabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  
  // Then lookup app user (query 1)
  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', authUid)
    .maybeSingle()

  // Then fetch roles (query 2)
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role_id, target, permissions(scope)')
    .eq('user_id', appUser.id)
}
```

**Problem:** Queries are sequential; could parallelize user lookup + role fetch

**Solution:** Parallelize independent operations

```typescript
export async function GET() {
  const supabase = await getSupabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id

  if (!authUid) return NextResponse.json({ user: null })

  // Parallelize: user lookup + role fetch (both depend on authUid)
  const [{ data: appUser }, { data: roles }] = await Promise.all([
    supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUid)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role_id, target, permissions(scope)')
      .eq('users.auth_uid', authUid)  // Use join instead of lookup
  ])

  // ... rest of logic ...
}
```

**Step 1:** Move user + role fetch into `Promise.all()`  
**Step 2:** Use direct filter on user_roles instead of looking up user first  

**Expected Gain:** 100-200ms  
**Complexity:** Low  
**Priority:** 🟡 HIGH

---

#### Task 4.2: Server-Side Recent Records Loading

**File:** `components/admin/violation/RecentRecordsList.tsx`

**Issue:** Component does 4+ sequential queries before showing data:
```
1. Get auth session
2. Look up app user
3. Fetch user roles for RBAC
4. Check allowed classes
5. Finally: fetch records
```

**Current Code (lines 47-66):**
```typescript
export default async function RecentRecordsList() {
  let supabase: Awaited<...> | null = null
  try {
    supabase = await getSupabaseServer()
  } catch {}
  
  const { data: userRes } = await supabase.auth.getUser()
  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', authUid)
    .maybeSingle()
  
  const allowedWriteClassIds = await getAllowedClassIdsForWrite(supabase, appUser.id)
  
  // ... finally fetch records ...
}
```

**Solution:** Parallelize RBAC checks using Promise.all()

```typescript
export default async function RecentRecordsList() {
  const supabase = await getServerSupabase()
  const authUid = (await supabase.auth.getUser()).data?.user?.id
  
  if (!authUid) return null

  // Get app user ID + RBAC data in parallel
  const [{ data: appUser }, _] = await Promise.all([
    supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle(),
    // Could also parallelize RBAC here if needed
  ])

  if (!appUser?.id) return null

  // Then fetch records
  const { data: records } = await supabase
    .from('records')
    .select(...)
    .limit(50)
  
  return <RecentRecordsTable records={records} />
}
```

**Expected Gain:** 300-600ms (parallelize independent lookups)  
**Complexity:** Medium  
**Priority:** 🟢 MEDIUM

---

## 📊 Implementation Checklist

### Phase 1: Quick Wins ✅ Priority: 🔴
- [ ] Task 1.1: Parallelize login flow (+200-400ms)
- [ ] Task 1.2: Move Olympia check to server-side (+200-500ms)
- [ ] Task 1.3: Remove RBAC fallback query (+300-500ms)
- [ ] Task 1.4: Lazy load RecentRecordsList (+200-400ms perceived)

**Estimated time:** 3 hours  
**Expected gain:** 1.1-1.8 seconds

---

### Phase 2: Payload Optimization ✅ Priority: 🟡
- [ ] Task 2.1: Add pagination to student fetch (+200-400ms)
- [ ] Task 2.2: Simplify accounts projection (+200-400ms)
- [ ] Task 2.3: Add limit to RecentRecordsList (+100-300ms)
- [ ] Task 2.4: Simplify session endpoint query (+50-100ms)

**Estimated time:** 2.5 hours  
**Expected gain:** 550-1200ms + 300-500KB bandwidth

---

### Phase 3: Advanced Caching ✅ Priority: 🟢
- [ ] Task 3.1: Cache RBAC helper functions (+200-400ms on repeated calls)
- [ ] Task 3.2: Cache criteria + classes (+100-200ms)
- [ ] Task 3.3: Parallelize account creation writes (+200-400ms)

**Estimated time:** 2 hours  
**Expected gain:** 500-1000ms on repeated operations

---

### Phase 4: Server-Side Optimization ✅ Priority: 🟢
- [ ] Task 4.1: Parallelize session endpoint (+100-200ms)
- [ ] Task 4.2: Parallelize RecentRecordsList queries (+300-600ms)

**Estimated time:** 1.5 hours  
**Expected gain:** 400-800ms

---

## 🚀 Rollout Strategy

### Recommended Order:
1. **Phase 1 first** - Highest impact, lowest risk, quick wins
2. **Phase 2 next** - Important for bandwidth and large datasets
3. **Phase 3 after** - Nice-to-have optimization
4. **Phase 4 last** - Requires more refactoring, good ROI but complex

### Testing Checklist Before Each Phase:
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Login flow works end-to-end
- [ ] Violation entry form loads and submits
- [ ] Accounts page loads and CRUD operations work
- [ ] Lighthouse audit before/after
- [ ] Network tab shows expected request count reduction

### Rollout Stages:
1. **Dev environment:** Test all changes locally
2. **Staging:** Deploy and verify with real data volume
3. **Production:** Gradual rollout with monitoring

---

## 📈 Expected Results

### After All Phases:

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Login flow | 800-1200ms | 400-600ms | **50-66%** ⬇️ |
| Violation entry page load | 500-1500ms | 200-500ms | **60-87%** ⬇️ |
| Account creation | 600-1200ms | 300-600ms | **50%** ⬇️ |
| Recent records display | 400-1000ms | 100-300ms | **75%** ⬇️ |
| Sidebar load | 200-500ms | 50-150ms | **75-80%** ⬇️ |

**Total workflow improvement:** 2.8-7.2 seconds → 1-2 seconds ✨

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Parallelize queries break auth flow | High | Test login flow thoroughly before deploy |
| Pagination changes break existing UI | Medium | Implement load-more gradually, test each component |
| Caching causes stale data | Medium | Set appropriate revalidation timers; use cache tags |
| Over-optimization causes regression | Low | Lighthouse audit before/after each phase |

---

## 📚 Related Documentation

- **Phase 6 (Auth Optimization):** `docs/plans/AUTH_OPTIMIZATION_SUMMARY.md`
- **Cache Strategy:** `docs/plans/CACHE_STRATEGY_AUDIT_AND_FIX.md`
- **Supabase Best Practices:** Check Supabase docs for query optimization patterns

---

**Next Steps:**
1. Review this plan with team
2. Confirm priority and timeline
3. Start Phase 1 implementation
4. Track performance improvements with Lighthouse
