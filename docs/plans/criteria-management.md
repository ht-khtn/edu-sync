# Kế hoạch: Trang quản lý tiêu chí vi phạm

## Bối cảnh

- Ứng dụng: Next.js + Supabase.
- Bảng dữ liệu liên quan: `criteria` (tiêu chí vi phạm) và `violations` (bản ghi vi phạm sử dụng criteria).
- Yêu cầu:
  - Thêm trang quản trị để AD/MOD cấu hình tiêu chí vi phạm.
  - Chỉ tài khoản có role AD hoặc MOD được truy cập.
  - Giao diện & kiến trúc tương tự các trang quản lý tài khoản / lớp hiện có.

## 1. Phạm vi & mục tiêu

- Tạo trang `/admin/criteria` cho phép:
  - Xem danh sách tiêu chí.
  - Tạo mới, chỉnh sửa tiêu chí.
  - Vô hiệu hóa (ngưng dùng) tiêu chí, thay vì xóa hẳn nếu đã có dữ liệu liên quan.
  - Lọc / tìm kiếm theo `category`, `type`, text.
- Đảm bảo an toàn dữ liệu:
  - Không hard delete tiêu chí đã được dùng trong bảng `violations`.
  - Chỉ AD/MOD có quyền thao tác.

## 2. Bảng `criteria` hiện tại

Các cột chính (từ seed/schema hiện có):

- `id` (uuid): khóa chính.
- `name` (text): tên tiêu chí.
- `description` (text, nullable): mô tả chi tiết.
- `score` (integer): điểm dương trong DB (frontend map thành điểm trừ).
- `category` (text, nullable): phân loại phạm vi áp dụng (vd: học sinh, lớp...).
- `type` (text, nullable): mức độ, ví dụ normal/serious/critical.
- `group` (text, nullable): nhóm lớn, ví dụ “Nề nếp”, “Học tập”.
- `subgroup` (text, nullable): nhóm con.
- `created_at` (timestamptz).
- `updated_at` (timestamptz).

Ghi chú mở rộng (có thể cần):

- Có thể thêm `is_active boolean default true` để hỗ trợ "ngưng dùng" tiêu chí mà không xóa.

## 3. Chính sách delete / vô hiệu hóa

### 3.1. Nguyên tắc

- **Không được hard delete** tiêu chí đã được dùng trong bảng `violations` để tránh mất lịch sử.
- Cho phép:
  - Hard delete **chỉ** khi tiêu chí chưa có bản ghi `violations` nào tham chiếu.
  - Ngưng dùng (soft-disable) tiêu chí đã được dùng → set `is_active = false`.

### 3.2. Triển khai

- Nếu chưa có cột `is_active` trong `criteria`:
  - Thêm migration Supabase:
    - `ALTER TABLE criteria ADD COLUMN is_active boolean NOT NULL DEFAULT true;`
- Trong server actions:
  - `deleteCriteriaAction`:
    - Kiểm tra số bản ghi `violations` liên quan (theo `criteria_id`):
      - Nếu `count = 0`: cho `DELETE FROM criteria WHERE id = ...`.
      - Nếu `count > 0`: thay vì delete, update: `UPDATE criteria SET is_active = false WHERE id = ...`.
  - Trong UI:
    - Nếu tiêu chí đang active → nút "Ngưng dùng" (và hiển thị cảnh báo nếu đã được dùng).
    - Nếu tiêu chí chưa từng dùng → có thể hiển thị "Xóa".

### 3.3. Ảnh hưởng tới violation-entry

- Khi load danh sách criteria cho màn hình nhập vi phạm (`violation-entry`):
  - Chỉ lấy `is_active = true` để tránh dùng các tiêu chí đã ngưng dùng.

## 4. Chuẩn hóa `category` và `type`

### 4.1. Category

- Mục tiêu: thống nhất với logic lọc hiện tại trong `violation-entry` để tránh tiêu chí “mồ côi”.
- Đề xuất enum nội bộ cho `category`:
  - `"student"` – áp dụng cho từng học sinh.
  - `"class"` – áp dụng cho cả lớp.
  - (Tùy nhu cầu) `"other"` – dùng cho các trường hợp khác.
- Việc map sang text hiển thị làm ở UI (vd: "Học sinh", "Lớp", "Khác").

### 4.2. Type

- Đề xuất enum cố định cho `type`:
  - `"normal"` – vi phạm thường.
  - `"serious"` – vi phạm nặng.
  - `"critical"` – vi phạm rất nặng.
- UI:
  - Hiển thị bằng badge với màu khác nhau.

### 4.3. Validation & form

- Trong form tạo/sửa tiêu chí:
  - `category` là select từ tập enum cố định.
  - `type` là select từ enum cố định.
- Trong server actions (zod schema):
  - `category: z.enum(["student", "class", "other"])` (hoặc union với `null` nếu cho phép trống).
  - `type: z.enum(["normal", "serious", "critical"])` (hoặc union với `null`).
- Reject mọi giá trị không thuộc enum để tránh xuất hiện tiêu chí không lọc được.

## 5. Trang `/admin/criteria`

### 5.1. Routing & cấu trúc file

- Route wrapper:
  - `app/(admin)/admin/criteria/page.tsx` → render `AdminCriteriaPage`.
- Domain component:
  - `components/domain/admin/criteria/page.tsx` – server component.
- Client components:
  - `components/domain/admin/criteria/CreateCriteriaDialog.tsx`.
  - `components/domain/admin/criteria/EditCriteriaDialog.tsx`.
  - (Tùy chọn) `components/domain/admin/criteria/CriteriaRowActions.tsx`.

### 5.2. RBAC / quyền truy cập

- Sử dụng pattern giống `admin/accounts` / `admin/classes`:
  - Lấy context qua `getServerAuthContext`.
  - Nếu không có `appUserId` → redirect `/login`.
  - Dùng `hasAdminManagementAccess(summary)` để kiểm tra AD/MOD.
  - Nếu không có quyền → redirect `/admin`.
- Tất cả server actions liên quan tới criteria cũng phải dùng helper tương tự để enforce role.

### 5.3. Data fetching & UI

- Query chính:
  - `SELECT * FROM criteria ORDER BY created_at ASC` (có thể filter thêm theo query params).
- Tính toán thêm trên server:
  - Tổng số tiêu chí.
  - Số tiêu chí theo `category`.
  - Số tiêu chí theo `type`.
  - Số tiêu chí đang active / inactive.
- UI:
  - Header: "Quản lý tiêu chí vi phạm" + mô tả ngắn.
  - Summary cards (dùng `Card`): tổng số, theo loại/mức độ.
  - Khu vực filter + search (xem mục 6).
  - Bảng chi tiết dùng `Table` UI:
    - Cột: Tên, Mô tả, Category, Type, Score, Group, Subgroup, Trạng thái (Active/Inactive), Created/Updated, Actions.

## 6. Filter & Search

### 6.1. Filter options

- `category`: select (All, student, class, other).
- `type`: select (All, normal, serious, critical).
- `status`: select (All, Active, Inactive).
- Text search: input để filter theo `name` và/hoặc `description`.

### 6.2. Cách triển khai

- Dựa trên query string trong URL (vd: `?category=student&type=serious&q=đi%20trễ`).
- Ở server component:
  - Đọc `searchParams` từ route.
  - Build query Supabase tương ứng:
    - `eq("category", category)` nếu có.
    - `eq("type", type)` nếu có.
    - `eq("is_active", true/false)` nếu có.
    - Search text:
      - Tùy support của Supabase/Postgres: `ilike` trên `name` và/hoặc `description`.
- UI filter là client component đơn giản push URL mới (hoặc dùng `<Link>` với query params).

## 7. Server actions cho criteria

- File đề xuất: `components/domain/admin/criteria/actions.ts`.

### 7.1. createCriteriaAction

- Input: name, description, score, category, type, group, subgroup.
- Validation bằng `zod`:
  - `name`: min length.
  - `score`: số > 0.
  - `category`, `type`: enum như mục 4.
- Logic:
  - Kiểm tra quyền AD/MOD (helper chung).
  - Insert vào `criteria` (mặc định `is_active = true`).
  - Ghi log vào bảng `audit_logs`.
  - `revalidatePath('/admin/criteria')`.

### 7.2. updateCriteriaAction

- Input: `id` + các field như create.
- Logic:
  - Kiểm tra quyền.
  - `UPDATE criteria SET ... WHERE id = ...`.
  - Ghi log vào `audit_logs`.
  - `revalidatePath('/admin/criteria')`.

### 7.3. deleteOrDisableCriteriaAction

- Input: `id`.
- Logic:
  - Check quyền.
  - Đếm `violations` liên quan.
  - Nếu `count = 0` → `DELETE`.
  - Nếu `count > 0` → `UPDATE criteria SET is_active = false`.
  - Ghi log.
  - `revalidatePath('/admin/criteria')`.

## 8. Tích hợp với dashboard admin

- Thêm card mới tại `components/domain/admin/home/page.tsx`:
  - Title: "Tiêu chí vi phạm".
  - Mô tả: "Thêm/sửa tiêu chí trừ điểm cho hệ thống".
  - Icon: một icon cảnh báo (vd: `AlertTriangle` hoặc tương tự).
  - Link: `/admin/criteria`.
  - Chỉ hiển thị khi `hasAdminManagementAccess(summary)` true.

## 9. Kiểm thử

- Case chính:
  - AD/MOD truy cập `/admin/criteria` → xem list, tạo mới, sửa, ngưng dùng.
  - User không role AD/MOD → redirect về `/admin`.
  - Tiêu chí đã được dùng trong `violations`:
    - Không thể hard delete, chỉ có nút "Ngưng dùng".
    - Sau khi ngưng dùng: không còn xuất hiện trong màn hình nhập vi phạm.
  - Filter/search hoạt động đúng (category/type/status/text).

- Regression check:
  - Màn hình `violation-entry` vẫn hoạt động, nhưng danh sách tiêu chí chỉ chứa `is_active = true`.
