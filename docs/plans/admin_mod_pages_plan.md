# Kế hoạch mở rộng trang AD/MOD

## Mục tiêu
Xây dựng bộ trang quản trị dành riêng cho vai trò AD và MOD để quản lý tài khoản lớp, phân quyền và các đối tượng dữ liệu cốt lõi.

## Phạm vi chức năng
- Trang quản lý tài khoản người dùng (tạo, khóa, reset, gán lớp).
- Trang quản lý vai trò/quyền (gán role, thiết lập target, xem audit).
- Trang quản lý lớp/khối (CRUD lớp, ánh xạ giáo viên, chỉ định MOD phụ trách).
- Điều hướng và hiển thị chỉ dành cho AD/MOD trong khu vực `/admin`.

## Công việc chính
1. **Routing & Layout**
   - Thêm các route mới dưới `app/(admin)/admin`: `accounts`, `roles`, `classes`.
   - Tái sử dụng layout admin hiện tại, bổ sung breadcrumb và tab điều hướng.

2. **Kiểm tra quyền & tải dữ liệu**
   - Dùng `getSupabaseServer`, `getServerAuthContext`, helper trong `lib/rbac.ts` để xác nhận vai trò AD/MOD.
   - Viết loader server-side cho từng trang để nạp `users`, `user_roles`, `classes`, `permissions`.

3. **Giao diện & tương tác**
   - Sử dụng `components/ui/table`, `dialog`, `form`, `QueryToasts` cho CRUD và phản hồi trạng thái.
   - Tách logic UI vào `components/domain/admin/*` (ví dụ: `UserAccountsManager`, `RoleAssignmentPanel`, `ClassDirectory`).

4. **API / Server Actions**
   - Tạo endpoint dưới `app/api/admin/*` hoặc server actions cho thao tác ghi (`users`, `user_roles`, `classes`).
   - Áp dụng mô hình logging từ `app/api/records` để ghi audit khi thay đổi quyền.

5. **Điều hướng & hiển thị**
   - Cập nhật menu/sidebar trong `components/layout/admin` để hiện các link mới khi user là AD/MOD.
   - Thêm trạng thái loading/error phù hợp và ẩn hoàn toàn với vai trò khác.

## Câu hỏi mở
1. Có cần mở rộng sang quản lý `permissions`, `complaints`, `audit_logs` ngay trong đợt này?
   - Ưu tiên hoàn thiện users/user_roles/classes trước; giữ kiến trúc API linh hoạt để bổ sung ba phân hệ trên trong giai đoạn tiếp theo.
2. Chọn cơ chế mutate nào: Next.js server actions với cookie session hay Supabase Edge Functions dùng service key?
   - Dùng server actions cho tác vụ thường ngày (dựa trên session hiện có); chỉ dùng Edge Functions + service key cho thao tác đặc biệt cần siêu quyền hoặc chạy ngoài request cycle.
3. Yêu cầu ghi log chi tiết đến mức nào (ước lượng: trước/sau, user id thực thi, hash thay đổi)?
   - Tối thiểu lưu action, entity, entity_id, payload trước/sau (hoặc diff), executor_user_id, executor_role, timestamp, IP/kênh thực thi và hash để kiểm tra toàn vẹn.
