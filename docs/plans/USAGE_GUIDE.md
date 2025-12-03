# Hướng dẫn sử dụng các tính năng mới

## 1. Sử dụng hooks trong components

### useSession & useUser

```tsx
'use client'

import { useSession } from '@/hooks/useSession'
import { useUser } from '@/hooks/useUser'

export function MyComponent() {
  // Cách 1: Dùng useSession để lấy raw session data
  const { data: session, isLoading, refetch } = useSession()
  
  // Cách 2: Dùng useUser để lấy user info với roles (recommended)
  const { user, isLoading, refetch } = useUser()
  
  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>Please login</div>
  
  return (
    <div>
      <p>User ID: {user.id}</p>
      <p>Has CC: {user.hasCC ? 'Yes' : 'No'}</p>
      <p>Has School Scope: {user.hasSchoolScope ? 'Yes' : 'No'}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  )
}
```

### useMyViolations

```tsx
'use client'

import { useUser } from '@/hooks/useUser'
import { useMyViolations } from '@/hooks/domain/useMyViolations'

export function MyViolationsView() {
  const { user } = useUser()
  const { data: violations, isLoading, error } = useMyViolations(user?.id || null)
  
  if (isLoading) return <div>Loading violations...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <ul>
      {violations.map(v => (
        <li key={v.id}>
          {v.criteria?.name} - Score: {v.score}
        </li>
      ))}
    </ul>
  )
}
```

### useViolationStats

```tsx
'use client'

import { useViolationStats } from '@/hooks/domain/useViolationStats'

export function StatsView() {
  const { data: stats, isLoading } = useViolationStats()
  
  if (isLoading) return <div>Loading stats...</div>
  
  return (
    <table>
      <thead>
        <tr>
          <th>Class</th>
          <th>Total Violations</th>
          <th>Total Points</th>
        </tr>
      </thead>
      <tbody>
        {stats.map(s => (
          <tr key={s.classId}>
            <td>{s.className}</td>
            <td>{s.totalViolations}</td>
            <td>{s.totalPoints}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### useCreateViolation

```tsx
'use client'

import { useCreateViolation } from '@/hooks/domain/useCreateViolation'
import { toast } from 'sonner'

export function CreateViolationForm() {
  const { createViolation, isCreating } = useCreateViolation()
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      await createViolation({
        student_id: formData.get('student_id') as string,
        criteria_id: formData.get('criteria_id') as string,
        class_id: formData.get('class_id') as string,
        score: Number(formData.get('score')),
        note: formData.get('note') as string || undefined,
      })
      toast.success('Violation created!')
    } catch (err) {
      toast.error('Failed to create violation')
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create'}
      </button>
    </form>
  )
}
```

---

## 2. Sử dụng Server Actions

### Trong Server Components

```tsx
import { createViolationAction } from '@/lib/actions/violation-actions'

export default async function ViolationPage() {
  async function handleCreate(formData: FormData) {
    'use server'
    
    const result = await createViolationAction({
      student_id: formData.get('student_id') as string,
      criteria_id: formData.get('criteria_id') as string,
      class_id: formData.get('class_id') as string,
      score: Number(formData.get('score')),
      note: formData.get('note') as string || undefined,
    })
    
    if (result.success) {
      // Success! Cache đã tự động revalidate
    } else {
      console.error(result.error)
    }
  }
  
  return (
    <form action={handleCreate}>
      {/* form fields */}
    </form>
  )
}
```

### Trong Client Components

```tsx
'use client'

import { createViolationAction } from '@/lib/actions/violation-actions'
import { useTransition } from 'react'

export function ViolationForm() {
  const [isPending, startTransition] = useTransition()
  
  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await createViolationAction({
        student_id: formData.get('student_id') as string,
        criteria_id: formData.get('criteria_id') as string,
        class_id: formData.get('class_id') as string,
        score: Number(formData.get('score')),
      })
      
      if (!result.success) {
        alert(result.error)
      }
    })
  }
  
  return (
    <form action={handleSubmit}>
      {/* form fields */}
      <button disabled={isPending}>Submit</button>
    </form>
  )
}
```

---

## 3. Sử dụng Cached Queries trong Server Components

```tsx
import { getMyViolations, getViolationStats, getLeaderboard } from '@/lib/cached-queries'
import { Suspense } from 'react'

// Component này sẽ được cache 5 phút
async function ViolationList({ userId }: { userId: string }) {
  const violations = await getMyViolations(userId)
  
  return (
    <ul>
      {violations.map(v => (
        <li key={v.id}>{v.criteria?.name}</li>
      ))}
    </ul>
  )
}

// Component này sẽ được cache 5 phút
async function StatsTable() {
  const stats = await getViolationStats()
  
  return (
    <table>
      {/* render stats */}
    </table>
  )
}

// Main page với partial rendering
export default async function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Static content renders instantly */}
      <div>Welcome to the dashboard!</div>
      
      {/* Dynamic content với loading states */}
      <Suspense fallback={<div>Loading violations...</div>}>
        <ViolationList userId="user-id" />
      </Suspense>
      
      <Suspense fallback={<div>Loading stats...</div>}>
        <StatsTable />
      </Suspense>
    </div>
  )
}
```

---

## 4. Proxy Configuration

Proxy tự động xử lý:

- ✅ Redirect chưa login khỏi `/admin`, `/client`, `/olympia`
- ✅ Redirect đã login khỏi `/login`
- ✅ Role-based routing

**Không cần config gì thêm!** Proxy hoạt động tự động.

Nếu muốn custom logic, edit `proxy.ts` và `lib/proxy-auth.ts`.

---

## 5. Loading States

Loading.tsx tự động hiển thị khi:
- Navigate giữa các routes
- Page đang fetch data

**Các file loading đã tạo:**
- `app/(admin)/admin/loading.tsx`
- `app/(client)/client/loading.tsx`
- `app/(olympia)/olympia/(admin)/admin/loading.tsx`
- `app/(olympia)/olympia/(client)/client/loading.tsx`

Customize skeleton UI trong các file này theo design của bạn.

---

## 6. Cache Strategy

### Cache duration:
- **Violations, Stats, Leaderboard**: 5 phút

### Revalidation:
- Tự động revalidate khi:
  - Create violation → All related paths
  - Update violation → All related paths
  - Delete violation → All related paths

### Manual revalidation (nếu cần):

```tsx
import { revalidatePath } from 'next/cache'

// Trong server action
revalidatePath('/admin/violation-history')
```

---

## 7. Best Practices

### ✅ DO:
- Dùng hooks cho client components
- Dùng cached queries cho server components
- Dùng server actions cho mutations
- Dùng Suspense để wrap slow components
- Revalidate sau mỗi mutation

### ❌ DON'T:
- Fetch trực tiếp Supabase trong UI components
- Dùng useEffect cho data fetching (dùng hooks thay vì)
- Quên revalidate sau mutations
- Cache quá lâu cho data nhạy cảm

---

## 8. Troubleshooting

### Hook returns null/undefined
→ Kiểm tra user đã login chưa (`useUser`)

### Cache không update sau mutation
→ Kiểm tra đã gọi revalidatePath trong server action chưa

### Loading state không hiện
→ Kiểm tra có file loading.tsx trong đúng folder chưa

### Proxy redirect loop
→ Kiểm tra logic trong `lib/proxy-auth.ts`, đảm bảo không có circular redirects

---

## 9. Migration Guide

### Migrate component từ old pattern sang hooks:

**Before:**
```tsx
'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export function OldComponent() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchData() {
      const supabase = await getSupabase()
      const { data } = await supabase.from('records').select('*')
      setData(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])
  
  if (loading) return <div>Loading...</div>
  return <div>{/* render */}</div>
}
```

**After:**
```tsx
'use client'
import { useMyViolations } from '@/hooks/domain/useMyViolations'
import { useUser } from '@/hooks/useUser'

export function NewComponent() {
  const { user } = useUser()
  const { data, isLoading } = useMyViolations(user?.id || null)
  
  if (isLoading) return <div>Loading...</div>
  return <div>{/* render */}</div>
}
```

**Benefits:**
- 50% ít code hơn
- Automatic error handling
- Consistent loading states
- Type-safe
- Reusable
