# Hướng dẫn sửa lỗi development

## Lỗi: searchParams trong Next.js 15+

Từ Next.js 15, `searchParams` là Promise và cần await.

### 1. File: `app/(olympia)/olympia/(admin)/admin/accounts/page.tsx`

**Thay đổi type:**
```tsx
// Cũ:
type AccountsPageProps = {
  searchParams?: {
    role?: string
  }
}

// Mới:
type AccountsPageProps = {
  searchParams: Promise<{
    role?: string
  }>
}
```

**Thay đổi function:**
```tsx
// Cũ:
export default async function OlympiaAdminAccountsPage({ searchParams }: AccountsPageProps) {
  const authContext = await getServerAuthContext()
  if (!authContext.appUserId) {
    notFound()
  }
  await ensureOlympiaAdminAccess()

// Mới:
export default async function OlympiaAdminAccountsPage({ searchParams }: AccountsPageProps) {
  const [authContext, params] = await Promise.all([
    getServerAuthContext(),
    searchParams
  ])
  if (!authContext.appUserId) {
    notFound()
  }
  await ensureOlympiaAdminAccess()
```

**Thay đổi filterValue:**
```tsx
// Cũ:
const filterValue = filterOptions.some((option) => option.id === searchParams?.role)
  ? (searchParams?.role as FilterOption)
  : 'all'

// Mới:
const filterValue = filterOptions.some((option) => option.id === params?.role)
  ? (params?.role as FilterOption)
  : 'all'
```

## Lỗi khác

**Source map warnings:** Bỏ qua - không ảnh hưởng chức năng.
**Hydration mismatch:** Do Radix UI tạo ID random - bỏ qua trong dev mode.
