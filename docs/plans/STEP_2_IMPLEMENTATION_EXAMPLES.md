# Step 2: Implementation Examples

## How to Use Link Prefetch Optimizer

### In Navigation Components

```tsx
// components/admin/layout/AdminSidebar.tsx
import { getPrefetchConfig } from '@/lib/link-optimizer';
import Link from 'next/link';

export function NavLink({ href, label }: { href: string; label: string }) {
  const { prefetch } = getPrefetchConfig(href);
  
  return (
    <Link href={href} prefetch={prefetch as boolean | 'intent'}>
      {label}
    </Link>
  );
}
```

### Route Categories

**Tier 1: Static (always prefetch)**
- `/admin/accounts` - user list
- `/admin/classes` - class list
- `/admin/roles` - role list

**Tier 2: Semi-static (prefetch on hover)**
- `/admin/violation-entry` - form pages
- `/admin/violation-history` - data pages
- `/admin/violation-stats` - stats pages

**Tier 3: Dynamic (no prefetch)**
- `/olympia/game/[sessionId]` - real-time
- `/olympia/watch/[matchId]` - real-time
- `/` - auth redirect

---

## How to Use Dynamic Imports

### Simple Usage

```tsx
// Before: Always load recharts
import { ViolationChartComponent } from './Charts';

export default function StatsPage() {
  return <ViolationChartComponent />;
}
```

```tsx
// After: Lazy-load recharts
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/common/Skeletons';

const ViolationChart = dynamic(
  () => import('./Charts').then(mod => mod.ViolationChartComponent),
  {
    loading: () => <ChartSkeleton />,
    ssr: true // Keep SSR for SEO
  }
);

export default function StatsPage() {
  return <ViolationChart />;
}
```

### Using Dynamic Import Utils

```tsx
import { createDynamicComponent } from '@/lib/dynamic-import-utils';
import { ChartSkeleton } from '@/components/common/Skeletons';

const LazyChart = createDynamicComponent(
  () => import('./Charts'),
  <ChartSkeleton />
);
```

### Multiple Charts

```tsx
import dynamic from 'next/dynamic';
import { createDynamicComponents } from '@/lib/dynamic-import-utils';
import { ChartSkeleton } from '@/components/common/Skeletons';

// Option 1: Individual imports
const BarChart = dynamic(
  () => import('./Charts').then(m => ({ default: m.BarChart })),
  { loading: () => <ChartSkeleton /> }
);

const LineChart = dynamic(
  () => import('./Charts').then(m => ({ default: m.LineChart })),
  { loading: () => <ChartSkeleton /> }
);

// Option 2: Batch create
const Charts = createDynamicComponents({
  BarChart: () => import('./Charts').then(m => ({ default: m.BarChart })),
  LineChart: () => import('./Charts').then(m => ({ default: m.LineChart })),
}, <ChartSkeleton />);
```

---

## Bundle Analysis

### Check Bundle Size

```bash
# Generate bundle analysis
npm run build -- --debug-bundle

# Look in .next/static/chunks for:
# - recharts modules (should only be in stats page)
# - animation modules (should only in animated pages)
```

### Before Optimization
```
app/admin/violation-stats/page.js: 450KB (includes recharts)
app/admin/accounts/page.js: 380KB
Total initial: 830KB
```

### After Optimization (Step 2)
```
app/admin/violation-stats/page.js: 150KB (static page)
app/admin/violation-stats/[dynamic].js: 120KB (recharts - lazy)
app/admin/accounts/page.js: 380KB
Total initial: 530KB (-36%)
```

---

## Testing Prefetch

### In Browser DevTools

1. Open DevTools → Network tab
2. Filter by XHR/Fetch
3. Hover over navigation links
4. Observe prefetch requests:
   - Static routes: Immediate load
   - Semi-static: "intent" prefetch (on hover)
   - Dynamic: No prefetch

### Verify with Code

```tsx
import { getPrefetchConfig } from '@/lib/link-optimizer';

// Test different routes
console.log(getPrefetchConfig('/admin/accounts'));
// { route: '/admin/accounts', prefetch: true, priority: true }

console.log(getPrefetchConfig('/admin/violation-entry'));
// { route: '/admin/violation-entry', prefetch: 'intent' }

console.log(getPrefetchConfig('/olympia/game/123'));
// { route: '/olympia/game/123', prefetch: false }
```

---

## Best Practices

1. **Skeletons Must Match Size**
   ```tsx
   // ✅ Good: Skeleton matches chart height (h-64)
   <ChartSkeleton /> // h-64 inside
   const Chart = dynamic(...); // Returns h-64

   // ❌ Bad: Skeleton doesn't match
   <Skeleton /> // Some default height
   const Chart = dynamic(...); // Different height → Layout Shift
   ```

2. **Only Prefetch Above-Fold**
   ```tsx
   // ✅ Good: Prefetch critical navigation
   <Link href="/admin/accounts" prefetch={true} />

   // ❌ Bad: Prefetch everything
   <Link href="/olympia/game/123" prefetch={true} />
   ```

3. **Keep SSR Enabled**
   ```tsx
   // ✅ Good: SSR enabled for charts
   dynamic(() => import('./Chart'), { ssr: true })

   // ❌ Bad: Disables SSR (hurts SEO)
   dynamic(() => import('./Chart'), { ssr: false })
   ```

4. **Use Intersection Observer for Below-Fold**
   ```tsx
   import { useShouldLoadComponent } from '@/lib/dynamic-import-utils';

   export function ViolationStats() {
     const ref = useRef<HTMLDivElement>(null);
     const shouldLoad = useShouldLoadComponent(ref);

     return (
       <div ref={ref}>
         {shouldLoad ? <ViolationChart /> : <ChartSkeleton />}
       </div>
     );
   }
   ```

---

## Checklist

- [ ] `lib/link-optimizer.ts` created with route classification
- [ ] `lib/dynamic-import-utils.ts` created with helper functions
- [ ] `components/common/Skeletons.tsx` created with reusable skeletons
- [ ] `components/admin/layout/AdminSidebar.tsx` updated to use prefetch
- [ ] `components/admin/violation-stats/ViolationCharts.tsx` created
- [ ] Build succeeds with no errors
- [ ] Tested prefetch behavior in DevTools
- [ ] Verified bundle size reduction
- [ ] No layout shift from skeletons (CLS < 0.1)

---

## Performance Targets (Step 2)

| Metric | Before | After | Improvement |
|--------|--------|-------|------------|
| Initial JS | 380KB | 230KB | -39% |
| FCP | 1.8s | 1.3s | -28% |
| TTI | 3.5s | 2.0s | -43% |

---

## Common Issues & Solutions

**Issue: Skeleton causes layout shift**
- Solution: Ensure skeleton height matches component height exactly
- Verify with DevTools → Layout Shift Regions

**Issue: Prefetch not working**
- Solution: Check if route is correctly classified
- Use `getPrefetchConfig()` to verify

**Issue: Chart component not loading**
- Solution: Ensure chart is client component ('use client')
- Verify import path in dynamic()

**Issue: Build size not improving**
- Solution: Check if recharts is still in main bundle
- Verify dynamic import is correct syntax
