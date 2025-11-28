## Giới thiệu

**Edu Sync** là hệ thống web hỗ trợ quản lý và đồng bộ dữ liệu cho các hoạt động học tập – thi đua (ví dụ: điểm số, vi phạm, leaderboard, thống kê, v.v.).

Ứng dụng được xây dựng trên **Next.js App Router**, dùng **Supabase** làm backend/database, tích hợp RBAC cho phân quyền **admin** / **client**, và có sẵn hệ thống tài liệu nội bộ trong thư mục `docs/`.

## Công nghệ chính

- **Next.js (App Router)** – frontend + server actions.
- **TypeScript** – static typing.
- **Supabase** – database, auth, storage.
- **Shadcn UI** + Tailwind CSS – UI components.
- **Vitest** – unit test (`tests/`).

## Chạy dự án (development)

Yêu cầu:

- Node.js (phiên bản LTS khuyến nghị).
- Đã cài `pnpm` (hoặc thay bằng `npm`/`yarn` nếu muốn).

### 1. Cài dependency

```bash
pnpm install
```

### 2. Cấu hình biến môi trường

Tạo file `.env.local` (hoặc `.env`) ở thư mục gốc, tham khảo cấu trúc từ `configs/env.ts` và Supabase project của bạn. Ví dụ (minh hoạ):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXTAUTH_SECRET=...
```

### 3. Chạy server

```bash
pnpm dev
```

Mặc định app chạy ở `http://localhost:3000`.

## Cấu trúc chính

- `app/`: Next.js App Router, tách layout và route cho `admin` / `client`, trang login, API route (`app/api/*`).
- `components/`: các component UI + domain (leaderboard, score, violation, v.v.).
- `lib/`: helper cho CSV, RBAC, điểm số, Supabase client, utils.
- `hooks/`: custom hooks (ví dụ `use-mobile`).
- `supabase/`: schema SQL, seed, trigger, edge functions.
- `tests/`: test cho parser CSV, violation filter, mock data.
- `docs/`: tài liệu nghiệp vụ, kế hoạch, runbook.

## Tài liệu nội bộ (`docs/`)

Tài liệu phụ trợ được gom về `docs/` để dễ tra cứu:

- `docs/plans/`: kế hoạch cấu trúc, tài liệu tái cấu trúc (`FOLDER_STRUCTURE_PLAN`, `RESTRUCTURING_PLAN`, `IMPLEMENTATION_SUMMARY`, v.v.).
- `docs/domain/`: đặc tả nghiệp vụ, sơ đồ CSDL, quy tắc RBAC, quy định olympia.
- `docs/runbooks/`: hướng dẫn thao tác (ví dụ: seed học sinh) có thể chạy lại khi cần.
- `docs/data/`: dữ liệu nguồn phục vụ tài liệu/runbook (ví dụ `dshs.csv`).

Các thư mục này thay thế cho các thư mục ẩn `.AI/` và `.specific/` trước đây; mọi tham chiếu cũ nên được cập nhật lại.

## Testing

Chạy toàn bộ test:

```bash
pnpm test
```

## Tài liệu Next.js (tham khảo thêm)

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## Triển khai

Hiện tại bản projection đang được deploy trên Vercel tại:

- https://edu-sync-delta.vercel.app

Bạn có thể dùng URL này để review giao diện và luồng chức năng.

Khi triển khai môi trường mới, có thể tiếp tục dùng **Vercel** hoặc bất kỳ nền tảng hỗ trợ Next.js App Router. Với Supabase, cần cấu hình lại đầy đủ biến môi trường tương ứng trên môi trường production.
