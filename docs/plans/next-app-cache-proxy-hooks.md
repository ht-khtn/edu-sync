# Kế hoạch refactor Next.js: cache, loading, proxy, hooks

## Mục tiêu

- Tận dụng đúng cơ chế cache & partial rendering của App Router.
- Gom toàn bộ logic phân quyền vào một chỗ (proxy).
- Chuẩn hoá data fetching & CRUD qua hooks (không fetch trực tiếp trong components UI).
- Cải thiện UX loading khi chuyển trang / fetch chậm.

---

## 1. Chiến lược caching & revalidation

1. Xác định mức độ tươi dữ liệu cho từng domain:
   - **Gần real-time (dynamic, không cache)**: session hiện tại, thông tin profile người dùng, các màn hình thao tác nhạy cảm nếu cần.
   - **Cho phép stale ngắn (cache vài chục giây / vài phút)**: danh sách violations, records, leaderboard, thống kê, danh sách kỳ thi Olympia, v.v.
2. Cho các query đọc nhiều:
   - Tạo hàm server trong `lib/**` (ví dụ `lib/violations.ts`, `lib/score.ts`, `lib/olympia-access.ts`) sử dụng `cacheLife` + `cacheTag` (hoặc `next.revalidate`) để cache.
   - Đặt tên tag rõ ràng: `"violations"`, `"records"`, `"leaderboard"`, `"olympia-matches"`, …
3. Trong server actions / API routes thực hiện CRUD:
   - Sau khi ghi, gọi `revalidateTag` hoặc `updateTag` cho các tag liên quan để đảm bảo "read your own writes".
4. Với các component phải dùng runtime data (`cookies()`, `headers()`, `searchParams`):
   - Tách thành:
     - Component ngoài **dynamic**: đọc cookies/headers/searchParams.
     - Component con chỉ nhận props primitive (id, filter, classIds) và dùng được `cacheLife`.

---

## 2. Centralized auth / phân quyền bằng `proxy.ts`

1. Thêm file `proxy.ts` ở root (cùng cấp `middleware.ts`, `next.config.ts`).
2. Thiết kế luồng xử lý trong `proxy.ts`:
   - Đọc thông tin session cơ bản từ cookies / Supabase (có thể tái sử dụng helper trong `lib/server-auth.ts`).
   - Xác định loại route từ `request.nextUrl.pathname`:
     - Admin routes: `/admin`, `/(admin)/admin/**`.
     - Client routes: `/(client)/client/**`.
     - Olympia routes: `/(olympia)/olympia/**`.
   - Rules cơ bản:
     - Nếu **chưa đăng nhập** và vào route được bảo vệ → redirect về `/login`.
     - Nếu **đã đăng nhập** và vào `/login` → redirect về dashboard tương ứng role.
     - Nếu **sai role** (vd client vào admin) → redirect về trang đúng (hoặc 403 nếu cần).
3. Trích xuất các helper dùng chung vào `lib/proxy-auth.ts` (hoặc mở rộng `lib/rbac.ts`):
   - `getSessionFromRequest(request)` → trả về `{ userId, roles, isAdmin, isOlympiaHost, ... }`.
   - `isProtectedRoute(pathname)` / `getRouteRole(pathname)`.
4. Dần dần chuyển logic từ `middleware.ts` hiện tại sang `proxy.ts`:
   - Đảm bảo matcher/proxy bao phủ đúng các route cần bảo vệ.
   - Khi đã ổn định, loại bỏ / simplify `middleware.ts` để tránh trùng lặp.

---

## 3. Hooks cho session & user

1. Tạo file `hooks/useSession.ts` hoặc `hooks/useUser.ts`:
   - Client-side gọi `/api/session` (đã có trong `app/api/session`) hoặc dùng Supabase client để lấy thông tin session.
   - Chuẩn hoá kiểu dữ liệu trả về: `{ status, user, roles, appUserId, classIdsAllowed, error }`.
   - Quản lý `isLoading` / `isError` bên trong hook.
2. Refactor các component đang dùng trực tiếp Supabase hoặc logic session:
   - `components/NavClient.tsx`.
   - Các header/layout trong `components/layout/admin/*`, `components/layout/client/*`, `components/domain/login/*`.
   - Thay thế bằng hook `useSession` / `useUser` làm nguồn dữ liệu duy nhất.
3. Về sau có thể tích hợp thêm React Query / SWR, nhưng bước đầu chỉ dùng `useState` + `useEffect`/`use` bên trong hook.

---

## 4. Hooks domain cho data fetching & CRUD

Mục tiêu: **không fetch/CRUD trực tiếp trong UI components**.

1. Cấu trúc đề xuất cho hooks:
   - Chung: `hooks/` (hiện có `use-mobile.ts`).
   - Theo domain: `components/domain/<domain>/hooks/` nếu muốn gắn chặt UI & data theo module.
2. Domain Violation:
   - Hooks đọc: `useViolations`, `useViolationStats`, `useMyViolations`, `useViolationHistory`.
   - Hooks ghi: `useCreateViolation`, `useUpdateViolation`, `useDeleteViolation`, `useResolveViolation`, v.v.
   - Bên trong gọi server actions / API (`app/api/records`, `app/api/record-ops`, `lib/violations.ts`).
3. Domain Records / Score:
   - `useRecords`, `useRecordOps`, `useLeaderboard`, `useScoreEntry`.
   - Dùng các hàm trong `lib/score.ts`, `lib/csv.ts` nếu có.
4. Domain Olympia:
   - `useOlympiaMatches`, `useOlympiaQuestions`, `useOlympiaParticipants`, `useOlympiaLeaderboard`.
   - Tận dụng helper trong `lib/olympia-access.ts`.
5. Quy tắc chung cho hooks:
   - Input rõ ràng (id, filter, pagination, classIds).
   - Trả về `{ data, isLoading, isError, mutate? }`.
   - Không để UI components biết chi tiết Supabase schema; mọi mapping field → UI nằm trong hook hoặc layer lib.
6. Refactor các component trong `components/domain/**` và các page trong `app/(admin)`, `app/(client)`, `app/(olympia)`:
   - Tìm chỗ đang dùng trực tiếp `createClient`, `supabase.from(...)` hoặc `fetch('/api/...')` bên trong component.
   - Di chuyển toàn bộ khối đó sang hook tương ứng.

---

## 5. `loading.tsx` & partial rendering

1. Thêm `loading.tsx` cho các segment chính:
   - `app/(admin)/admin/loading.tsx`.
   - `app/(client)/client/loading.tsx`.
   - `app/(olympia)/olympia/(admin)/admin/loading.tsx`.
   - `app/(olympia)/olympia/(client)/client/loading.tsx`.
2. Nội dung `loading.tsx`:
   - Giữ layout khung (header, sidebar) giống `layout.tsx`.
   - Dùng skeleton components từ `components/ui/*` (vd `Skeleton`, `Card`, `Table`) để mô phỏng bảng/danh sách.
3. Trong các page server:
   - Xác định các block data chậm (bảng lớn, thống kê, leaderboard).
   - Bọc từng block bằng `Suspense` với fallback nhỏ (skeleton section), thay vì chặn toàn trang.
   - Đảm bảo phần static (title, breadcrumb, button tạo mới) render ngay.

---

## 6. Chuẩn hoá sử dụng `next/image`

1. Quét các file trong `components/**`, `app/**` để tìm `<img>`:
   - Logo, avatar, banner, hình minh hoạ.
2. Thay dần bằng `next/image` ở những nơi:
   - Ảnh là static trong `public/` hoặc import từ file.
   - Ảnh remote từ domain ổn định (Supabase Storage, CDN, avatar provider).
3. Cập nhật `next.config.ts`:
   - Thêm `images.remotePatterns` cho domain ảnh remote cần thiết.
4. Đảm bảo mỗi `Image` có `width`/`height` hoặc `fill` + style container → tránh layout shift.

---

## 7. Lộ trình triển khai

1. **Bước 1 – Proxy & auth**
   - Tạo `proxy.ts`, trích xuất helper vào `lib/proxy-auth.ts`.
   - Áp dụng redirect cơ bản login / role.
2. **Bước 2 – Hooks session/user**
   - Implement `useSession` / `useUser`.
   - Refactor `NavClient` + layout header sử dụng hook.
3. **Bước 3 – Hooks domain cho 1–2 module ưu tiên**
   - Chọn 1 domain quan trọng (vd violations) để làm mẫu.
   - Tạo hooks đọc/ghi + refactor components tương ứng.
4. **Bước 4 – `loading.tsx` + partial rendering cho 1 segment**
   - Bắt đầu với `app/(admin)/admin`.
   - Sau khi ổn, nhân rộng sang client & olympia.
5. **Bước 5 – Mở rộng hooks & caching cho các domain còn lại**
   - Lặp lại pattern hooks + cache + revalidate cho records, score, olympia.
6. **Bước 6 – Audit hình ảnh và tối ưu `next/image`**
   - Thay thế `<img>` quan trọng, cấu hình `images` trong `next.config.ts`.

---

## 8. Ghi chú thực thi

- Triển khai từng phần nhỏ, push branch riêng (`feature/...`) để mentor review.
- Mỗi khi tạo hooks mới hoặc đổi data flow:
  - Cập nhật test (nếu có) và thử manual flow liên quan.
- Ưu tiên giữ API hiện tại của components để tránh refactor dây chuyền quá lớn trong một lần.
