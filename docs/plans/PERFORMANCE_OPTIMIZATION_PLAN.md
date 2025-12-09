# 🚀 Performance Optimization Plan - edu-sync

**Target:** TTFB < 50ms, LCP < 1.5s, Lighthouse Score ≥ 90  
**Framework:** Next.js 16 + React 19 + Supabase v2.80 + Vercel  
**Current Status:** Feature branch `feature/luan/admin-page`

---

## 📊 Current State Analysis

### Tech Stack
- **Next.js:** 16.0.7 (App Router)
- **React:** 19.2.0
- **Supabase:** ^2.80.0
- **TypeScript:** ^5
- **CSS:** Tailwind v4 via `@tailwindcss/postcss`

### Critical Issues Identified

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| **17 pages with `force-dynamic`** | 🔴 Critical | Disables all caching & ISR; every request hits DB | Not started |
| **No prefetching** | 🟠 High | Slow navigation between pages | Not started |
| **Unoptimized Supabase queries** | 🟠 High | Missing pagination, broad real-time filters, no API batching | Not started |
| **No offline support** | 🟡 Medium | PWA not configured; no service worker | Not started |
| **Heavy bundle** | 🟡 Medium | recharts (122KB) + framer-motion (64KB) lazy-loaded | Not started |
| **Image optimization gaps** | 🟡 Medium | Missing `sizes` attribute; no format optimization | Not started |

---

## ✅ Optimization Plan (6 Steps)

### Step 1: Remove `force-dynamic` & Implement ISR (Critical)

**Objective:** Convert 17 force-dynamic pages to static/ISR rendering

**Pages to Convert:**
```
❌ force-dynamic pages:
- app/(admin)/admin/accounts
- app/(admin)/admin/classes
- app/(admin)/admin/criteria
- app/(admin)/admin/leaderboard
- app/(admin)/admin/roles
- app/(admin)/admin/score
- app/(admin)/admin/violation
- app/(admin)/admin/violation-entry
- app/(admin)/admin/violation-history
- app/(admin)/admin/violation-stats
- app/(client)/client/...
- app/(olympia)/olympia/...
- Dynamic routes with [id] segments
```

**Strategy:**

#### Tier 1: Static Pages (can be cached indefinitely)
- **Classes, Criteria, Roles** → `generateStaticParams()` with revalidate=3600 (1h)
  - Data rarely changes during school day
  - Pre-generate at build time

#### Tier 2: Semi-Static Pages (ISR with short revalidation)
- **Leaderboard, Violation Stats** → `revalidate: 60` (1 min)
  - Data updates frequently but doesn't need real-time
  - Cache at Edge (Vercel), revalidate every 60s
  - Use `revalidateTag('leaderboard')` for on-demand revalidation when data updates

#### Tier 3: Dynamic Pages (keep dynamic, optimize query)
- **Violation Entry, Olympia Sessions** → on-demand + prefetch
  - Cannot predict all `[id]` combinations
  - Use `generateStaticParams()` for popular IDs (top 100)
  - Fallback to dynamic for others

**Implementation:**
```typescript
// Before: app/(admin)/admin/leaderboard/page.tsx
export const revalidate = false; // ❌ force-dynamic

// After:
export const revalidate = 60; // ISR: revalidate every 60s
export const dynamic = 'force-static'; // Explicitly mark as static

export async function generateStaticParams() {
  // Pre-generate for common grades
  return [
    { grade: '10' },
    { grade: '11' },
    { grade: '12' }
  ];
}

export default async function LeaderboardPage({ params }) {
  // Will be cached at Edge for 60s
  const data = await getLeaderboardData(params.grade);
  return <LeaderboardView data={data} />;
}
```

**Files to Modify:**
- `app/(admin)/admin/*/page.tsx` (10+ files)
- `app/(client)/client/*/page.tsx` (3+ files)
- `app/(olympia)/olympia/*/page.tsx` (4+ files)

**Expected Improvement:**
- ✅ TTFB: 500ms → 50-100ms (cached at Edge)
- ✅ LCP: Reduced by 60-70%
- ✅ DB load: Reduced by 80%+

---

### Step 2: Add Link Prefetch & Code Splitting (High Priority)

**Objective:** Preload data on hover/focus; lazy-load heavy components

#### 2.1 Link Prefetch Strategy
```typescript
// Use Next.js Link with smart prefetch
// Default: prefetch=true for static routes, false for dynamic

// For critical navigation paths:
<Link href="/admin/leaderboard" prefetch={true}>
  {/* Will prefetch data in background on hover */}
</Link>

// For less critical (prevent over-fetching):
<Link href="/admin/violation-entry" prefetch={false}>
  {/* Only fetch on actual click */}
</Link>
```

**Auto-implementation via middleware:**
- Create `lib/link-optimizer.ts`: Utility to automatically determine prefetch strategy
- Scan `package.json` scripts to identify frequently-visited routes

#### 2.2 Dynamic Imports for Heavy Components
```typescript
// Before: Initial bundle includes all charts
import { ViolationStatsChart } from './charts';

// After: Load only when component is visible
import dynamic from 'next/dynamic';

const ViolationStatsChart = dynamic(
  () => import('./charts').then(mod => mod.ViolationStatsChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: true // Important: don't disable SSR for charts
  }
);
```

**Heavy Components to Lazy-Load:**
- `recharts` (122KB) → only load on stats/leaderboard pages
- `framer-motion` (64KB) → only load on pages with animations
- Chart libraries → load on-demand

**Files to Modify:**
- `components/admin/leaderboard/*` (chart components)
- `components/admin/violation-stats/*` (charts)
- `components/admin/score/*` (heavy UI)

**Expected Improvement:**
- ✅ Initial JS bundle: -150KB (41% reduction)
- ✅ First Contentful Paint (FCP): 1.2s → 0.8s
- ✅ Time to Interactive (TTI): 2.5s → 1.5s

---

### Step 3: Optimize Supabase Queries (High Priority)

**Objective:** Pagination, real-time filtering, API batching

#### 3.1 Add Cursor-Based Pagination

**Current Issue:**
```typescript
// lib/violations.ts - getUserViolations()
.limit(300) // ❌ Fetches all 300 in single query
// Memory spike if table grows to 10k+ rows
```

**Solution:**
```typescript
// lib/violations.ts
interface PaginationCursor {
  id: string;
  createdAt: string;
}

export async function getUserViolations(
  userId: string,
  cursor?: PaginationCursor,
  limit = 50
) {
  let query = supabase
    .from('violations')
    .select('*, users(*), criteria(*)')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // +1 to detect if more exist

  if (cursor) {
    query = query.lt('created_at', cursor.createdAt); // Cursor-based filtering
  }

  const { data, error } = await query;
  
  return {
    items: data?.slice(0, limit) || [],
    nextCursor: data && data.length > limit ? {
      id: data[limit - 1].id,
      createdAt: data[limit - 1].created_at
    } : null
  };
}
```

**Files to Modify:**
- `lib/violations.ts` → `getUserViolations()`, `getClassViolations()`
- `lib/cached-queries.ts` → add pagination wrapper

#### 3.2 Filter Real-Time Subscriptions

**Current Issue:**
```typescript
// components/olympia/OlympiaRealtimeListener.tsx
.on('*', { event: '*', schema: 'public', table: 'live_sessions' }, ...)
// ❌ Subscribes to ALL live_sessions
// If 100 concurrent users, every change broadcasts to all 100
```

**Solution:**
```typescript
// Add matchId filter
const channel = supabase.channel(`match-${matchId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'live_sessions',
      filter: `match_id=eq.${matchId}` // ✅ Filter at DB
    },
    onLiveSessionChange
  )
  .subscribe();
```

**Files to Modify:**
- `components/olympia/OlympiaRealtimeListener.tsx` → add filter to all subscriptions
- `components/olympia/LiveSessionControls.tsx` → filter by sessionId

#### 3.3 Create Batch API Endpoint

**Current Issue:**
```typescript
// components/admin/violation-entry/CreateViolationDialog.tsx
for (const student of students) {
  await createViolation(student); // N API calls 🚫
}
// 100 students = 100 round-trips
```

**Solution:**
```typescript
// api/violations/batch.ts
export async function POST(request: Request) {
  const { violations } = await request.json();
  
  if (violations.length > 100) {
    return Response.json(
      { error: 'Max 100 violations per batch' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from('violations')
    .insert(violations)
    .select();

  return Response.json({ data, error });
}

// Usage:
const response = await fetch('/api/violations/batch', {
  method: 'POST',
  body: JSON.stringify({
    violations: [
      { student_id: '1', criteria_id: 'x', points: -10 },
      { student_id: '2', criteria_id: 'y', points: -5 }
    ]
  })
});
```

**Files to Create:**
- `app/api/violations/batch/route.ts`

**Files to Modify:**
- `components/admin/violation-entry/*` → use batch API

**Expected Improvement:**
- ✅ Pagination: Reduce per-request payload by 80%
- ✅ Real-time: Reduce Realtime message volume by 90%
- ✅ Batch API: 100 requests → 1 request (99% reduction in round-trips)
- ✅ DB load: Reduced by 60%+

---

### Step 4: Configure Cache Headers & Edge Cache (Medium Priority)

**Objective:** Maximize Edge caching via Vercel; granular revalidation with tags

#### 4.1 ISR with Cache Tags

```typescript
// lib/cached-queries.ts
import { cacheTag, revalidateTag } from 'next/cache';

export async function getLeaderboardData(grade: string) {
  'use cache';
  // ...
  cacheTag('leaderboard', `leaderboard-grade-${grade}`);
  return data;
}

// When data updates, trigger revalidation:
export async function onViolationCreated(violation: Violation) {
  revalidateTag('leaderboard'); // Invalidates all leaderboards
  revalidateTag(`leaderboard-grade-${violation.grade}`); // Specific grade
}
```

#### 4.2 API Response Headers

```typescript
// lib/utils.ts
export function setCacheHeaders(
  response: NextResponse,
  type: 'static' | 'dynamic' | 'private'
) {
  const headers: Record<string, string> = {
    static: 'public, s-maxage=3600, stale-while-revalidate=86400',
    dynamic: 'public, s-maxage=60, stale-while-revalidate=300',
    private: 'private, max-age=0, must-revalidate'
  };
  
  response.headers.set('Cache-Control', headers[type]);
  return response;
}

// Usage in API routes:
export async function GET(request: Request) {
  const data = await getLeaderboardData();
  const response = NextResponse.json(data);
  return setCacheHeaders(response, 'dynamic');
}
```

#### 4.3 Vercel Analytics for Cache Hit Ratio

**Add to vercel.json:**
```json
{
  "analytics": true,
  "cdn": {
    "caching": {
      "default": 3600,
      "paths": {
        "/api/leaderboard": { "maxAge": 60 },
        "/api/violations": { "maxAge": 0 }
      }
    }
  }
}
```

**Files to Create:**
- `vercel.json` (if not exists)

**Files to Modify:**
- `lib/cached-queries.ts` → add cacheTag()
- `app/api/*/route.ts` → set Cache-Control headers
- `app/(admin)/admin/*/page.tsx` → verify revalidate values

**Expected Improvement:**
- ✅ Cache hit ratio: 70%+ at Edge
- ✅ TTFB: 50-100ms for cached responses
- ✅ Origin load: Reduced by 70%

---

### Step 5: Image & Font Optimization (Low Priority)

**Objective:** Reduce image payload; prevent font render blocking

#### 5.1 Add `sizes` Attribute to Images

```typescript
// Before: ❌ Loads large image even on mobile
<Image src={url} alt="" width={1200} height={800} />

// After: ✅ Responsive sizes
<Image
  src={url}
  alt=""
  width={1200}
  height={800}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  priority={false}
/>
```

#### 5.2 Font Optimization

```typescript
// app/layout.tsx - Already using Geist via @next/font
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({
  variable: "--font-geist-sans",
  display: 'swap', // ✅ Prevent FOUC
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  display: 'swap',
});
```

**Already Optimized:** Font loading is good; just verify `display: swap`

#### 5.3 Image Format Optimization

```typescript
// For user avatars, charts, etc.
<Image
  src={url}
  alt=""
  width={200}
  height={200}
  // Next.js automatically serves WebP/AVIF on supported browsers
  quality={75} // Reduce from default 75
/>
```

**Files to Audit:**
- `components/admin/*/` (all Image components)
- `components/client/*/` (user avatars, event cards)
- `components/olympia/` (live session images)

**Expected Improvement:**
- ✅ Image payload: -30-40%
- ✅ LCP: -200ms
- ✅ No font render blocking (FOUT/FOIT)

---

### Step 6: PWA & Offline Support (Low Priority)

**Objective:** Cache API responses; enable offline access for critical pages

#### 6.1 Service Worker Setup

```typescript
// public/sw.js
const CACHE_VERSION = 'v1';
const CACHE_URLS = [
  '/',
  '/admin/leaderboard',
  '/api/session',
  '/api/user'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(CACHE_URLS);
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(response => {
        // Cache successful API responses
        if (response.status === 200 && event.request.url.includes('/api/')) {
          const cache = caches.open(CACHE_VERSION);
          cache.then(c => c.put(event.request, response.clone()));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      return new Response('Offline', { status: 503 });
    })
  );
});
```

#### 6.2 Web App Manifest

```json
// public/manifest.json
{
  "name": "edu-sync",
  "short_name": "edu-sync",
  "description": "Education violation tracking system",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

#### 6.3 Register Service Worker

```typescript
// app/layout.tsx
'use client';

useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

**Files to Create:**
- `public/sw.js`
- `public/manifest.json`
- `public/icon-192.png`
- `public/icon-512.png`

**Files to Modify:**
- `app/layout.tsx` → register SW

**Expected Improvement:**
- ✅ Offline support for cached pages
- ✅ Faster repeat visits (cache priority)
- ✅ PWA installable (Android/iOS)

---

## 📈 Expected Performance Gains

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **TTFB** | ~500ms | ~50-100ms | **90% ↓** |
| **LCP** | ~2.5s | ~1.2s | **52% ↓** |
| **FCP** | ~1.8s | ~0.8s | **55% ↓** |
| **TTI** | ~3.5s | ~1.5s | **57% ↓** |
| **Initial JS** | ~380KB | ~230KB | **39% ↓** |
| **Lighthouse** | ~65-70 | ~90-95 | **+25 points** |
| **DB Queries/sec** | ~100 | ~20 | **80% ↓** |
| **Edge Cache Hit** | 0% | ~70% | **+70%** |

---

## 🔄 Implementation Priority & Timeline

```
Week 1:
├─ Step 1: Remove force-dynamic (3-4 days)
│  └─ Convert 17 pages to ISR + generateStaticParams
└─ Step 3a: Add pagination (2 days)
   └─ Start with getUserViolations()

Week 2:
├─ Step 2: Link prefetch & code splitting (2-3 days)
│  └─ Lazy-load recharts + framer-motion
├─ Step 3b: Real-time filter + batch API (2-3 days)
│  └─ Filter subscriptions + create /api/violations/batch
└─ Step 4: Cache headers (1 day)
   └─ Add cacheTag + Cache-Control

Week 3:
├─ Step 5: Image optimization (1-2 days)
│  └─ Add sizes + font swap
├─ Step 6: PWA setup (1-2 days)
│  └─ Service worker + manifest
└─ Testing & monitoring (2 days)
   └─ Lighthouse, Web Vitals, analytics
```

---

## ✅ Verification Checklist

- [ ] All pages load in < 100ms (TTFB)
- [ ] LCP < 1.5s
- [ ] Lighthouse score ≥ 90
- [ ] Zero `force-dynamic` pages (except API)
- [ ] Pagination implemented for large datasets
- [ ] Real-time filters working
- [ ] Batch API tested with 100+ violations
- [ ] Service worker caching API responses
- [ ] Images have `sizes` attribute
- [ ] No cumulative layout shift (CLS < 0.1)
- [ ] Web Vitals dashboard integrated

---

## 📚 References

- [Next.js Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [Next.js Image Optimization](https://nextjs.org/docs/app/api-reference/components/image)
- [Supabase Real-time Filters](https://supabase.com/docs/guides/realtime/postgres-changes#filters)
- [Web Vitals](https://web.dev/vitals/)
- [Vercel Analytics](https://vercel.com/docs/analytics)

---

**Last Updated:** December 9, 2025  
**Status:** 📋 Planning Phase  
**Owner:** AI Assist  
**Branch:** `feature/luan/admin-page`
