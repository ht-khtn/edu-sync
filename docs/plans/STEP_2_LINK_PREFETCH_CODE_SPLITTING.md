# Step 2: Link Prefetch & Code Splitting

**Status:** Ready to implement  
**Priority:** High  
**Expected Gains:** -150KB initial JS, FCP -500ms, TTI -1s

## Summary

Link prefetch & code splitting sẽ:
- Preload data khi user hover/focus trên Links
- Lazy-load heavy components (recharts 122KB, framer-motion 64KB) theo route
- Giảm Initial JS bundle từ ~380KB → ~230KB (39%)

## 2.1 Link Prefetch Strategy

### Current State
- Next.js Link có `prefetch={true}` by default cho static routes
- Nhưng không có strategy cho dynamic routes
- Không có selective prefetch (prefetch cả page khi chỉ cần fetch data)

### Changes Needed

#### Create `lib/link-optimizer.ts`
Utility để tự động xác định prefetch strategy dựa vào route type:

```typescript
// lib/link-optimizer.ts
interface PrefetchConfig {
  route: string;
  prefetch: boolean | 'intent';
  priority?: boolean;
}

export function getPrefetchConfig(href: string): PrefetchConfig {
  // Static routes: Always prefetch (cached at Edge 1h)
  const staticRoutes = [
    '/admin/accounts',
    '/admin/classes',
    '/admin/roles',
    '/admin/leaderboard',
    '/admin/violation-stats'
  ];

  if (staticRoutes.some(route => href.startsWith(route))) {
    return { route: href, prefetch: true, priority: true };
  }

  // Semi-static (ISR 30-60s): Prefetch on intent (hover)
  const semiStaticRoutes = [
    '/admin/violation-entry',
    '/admin/violation-history',
    '/olympia'
  ];

  if (semiStaticRoutes.some(route => href.startsWith(route))) {
    return { route: href, prefetch: 'intent' };
  }

  // Dynamic routes: Don't prefetch
  return { route: href, prefetch: false };
}
```

#### Usage in Components
```typescript
import { getPrefetchConfig } from '@/lib/link-optimizer';

export function NavLinks() {
  return (
    <>
      {['accounts', 'classes', 'roles'].map(page => {
        const { prefetch } = getPrefetchConfig(`/admin/${page}`);
        return (
          <Link key={page} href={`/admin/${page}`} prefetch={prefetch}>
            {page}
          </Link>
        );
      })}
    </>
  );
}
```

## 2.2 Dynamic Imports for Heavy Components

### Components to Lazy-Load

#### recharts (122KB) - Used in stats/leaderboard
**Files affected:**
- `components/admin/violation-stats/*` (if using charts)
- `components/admin/leaderboard/*` (if using charts)

**Implementation:**
```typescript
// components/admin/violation-stats/StatsChart.tsx
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/admin/violation-stats/ChartSkeleton';

// Dynamically import recharts-based charts
const StatsBarChart = dynamic(
  () => import('./BarChart').then(mod => mod.BarChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: true // Keep SSR enabled for charts
  }
);

const StatsPieChart = dynamic(
  () => import('./PieChart').then(mod => mod.PieChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: true
  }
);

export function StatsCharts() {
  return (
    <div className="grid gap-6">
      <StatsBarChart />
      <StatsPieChart />
    </div>
  );
}
```

#### framer-motion (64KB) - Used for animations
**Files affected:**
- Any component with `motion.*` elements
- Likely in: `components/client/`, `components/admin/` transitions

**Implementation:**
```typescript
// components/admin/AnimatedTransition.tsx
import dynamic from 'next/dynamic';

const MotionDiv = dynamic(
  () => import('framer-motion').then(mod => {
    return (props: any) => (
      <mod.motion.div {...props} />
    );
  }),
  { ssr: true }
);

// Or use conditional import:
import { useReducedMotion } from 'framer-motion';

export function AnimatedCard({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div>{children}</div>; // No animation, instant render
  }

  return <MotionDiv>{children}</MotionDiv>;
}
```

#### UI Component Tree Splitting
**For pages with many UI components:**

```typescript
// pages/admin/leaderboard/page.tsx
import dynamic from 'next/dynamic';
import { LoadingSkeleton } from '@/components/client/LoadingSkeleton';

// Critical (above fold): Render immediately
import LeaderboardHeader from '@/components/admin/leaderboard/Header';
import LeaderboardTable from '@/components/admin/leaderboard/Table';

// Below fold: Lazy load
const LeaderboardStats = dynamic(
  () => import('@/components/admin/leaderboard/Stats'),
  { loading: () => <LoadingSkeleton /> }
);

const LeaderboardFilters = dynamic(
  () => import('@/components/admin/leaderboard/Filters'),
  { loading: () => <LoadingSkeleton /> }
);

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <LeaderboardHeader />
      <LeaderboardTable /> {/* Critical */}
      <LeaderboardFilters /> {/* Below fold */}
      <LeaderboardStats /> {/* Below fold */}
    </div>
  );
}
```

## 2.3 Route-Based Code Splitting

### Concept
By default, Next.js builds one JS file per route. We need to ensure heavy dependencies only load on routes that use them.

### Verification Steps
1. **Build analysis:**
```bash
# See bundle composition
npm run build -- --debug-bundle

# Or use bundle analyzer:
pnpm add --save-dev @next/bundle-analyzer
```

2. **Check which routes include recharts:**
```bash
# After build, check .next/static/chunks/
ls -lh .next/static/chunks/ | grep -E "recharts|framer"
```

3. **Verify lazy loading:**
- recharts should only load on `/admin/leaderboard` or `/admin/violation-stats` routes
- framer-motion should be in shared chunks but not in initial pages

## 2.4 Implementation Checklist

### Phase 1: Setup Utilities
- [ ] Create `lib/link-optimizer.ts` for prefetch strategy
- [ ] Create `lib/dynamic-import-utils.ts` for skeleton/fallback patterns
- [ ] Update `components/ui/LoadingSkeleton.tsx` if not exists

### Phase 2: Implement Dynamic Imports
- [ ] Audit components for heavy dependencies (recharts, framer-motion)
- [ ] Wrap chart components with `dynamic()`
- [ ] Wrap animation components with `dynamic()`
- [ ] Test skeletons/loading states look good

### Phase 3: Update Navigation
- [ ] Update main navigation components to use `getPrefetchConfig()`
- [ ] Add hover prefetch for critical navigation paths
- [ ] Test prefetch behavior in devtools

### Phase 4: Verify & Test
- [ ] Build & check bundle size reduction
- [ ] Lighthouse test: FCP, LCP, TTI
- [ ] Test on slow 4G (DevTools throttling)
- [ ] Verify skeletons don't cause layout shift (CLS)

## Performance Targets

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Initial JS | ~380KB | ~230KB | -39% |
| FCP | ~1.8s | ~1.3s | -28% |
| TTI | ~3.5s | ~2.0s | -43% |
| LCP | ~2.5s | ~1.8s | -28% |

## Files to Create/Modify

### Create
- `lib/link-optimizer.ts` (utility for prefetch logic)
- `lib/dynamic-import-utils.ts` (fallback utilities)
- `components/admin/*/Skeleton.tsx` (loading states)

### Modify
- All navigation components (use `getPrefetchConfig()`)
- Chart components (wrap with `dynamic()`)
- Animation components (conditional import)
- Pages with many UI components (split critical vs below-fold)

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Skeleton CLS (cumulative layout shift) | Poor Core Web Vitals | Ensure skeleton height matches component |
| Prefetch too aggressive | Wasted bandwidth | Only prefetch critical routes |
| Load time for lazy components | User perceives slow | Show clear loading state |

---

**Next:** Step 3 will optimize Supabase queries (pagination, real-time filtering, batch API)
