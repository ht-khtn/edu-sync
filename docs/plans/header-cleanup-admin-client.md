# Kế hoạch dọn header/nav – phân tách admin/client

## Mục tiêu

- Loại bỏ header/nav dư thừa, không được dùng.
- Rõ ràng file nào là "chuẩn" cho admin, client, shared.
- Gom luồng truy cập trang quản trị (admin) về một chỗ để user không rối.

## Kiến trúc hiện tại (tóm tắt)

- **Root (shared)**
  - `app/layout.tsx` dùng `components/NavClient.tsx` làm global header.
  - `NavClient` hiển thị menu theo role (student / CC / trường) và xử lý đăng xuất.

- **Admin app**
  - `app/(admin)/admin/layout.tsx` là shell chính cho admin.
  - Dùng:
    - `components/layout/admin/AdminHeader.tsx` – top bar admin.
    - `components/layout/admin/AdminSidebar.tsx` – sidebar điều hướng.

- **Client app**
  - `app/(client)/client/layout.tsx` là shell chính cho client.
  - Dùng:
    - `components/layout/client/ClientHeader.tsx` – top bar client.

- **Olympia**
  - Có layout riêng cho `(client)` và `(admin)` ở dưới `app/(olympia)/olympia/...` với header inline (chưa tách thành component dùng chung).

## Quyết định chính

1. **Header client chuẩn: chọn Option A**
   - Giữ `components/layout/client/ClientHeader.tsx` làm header client chính.
   - Xoá `components/domain/client/ClientHeader.tsx` (không có import nào, coi là code cũ).

2. **Xoá `AuthNav.tsx`**
   - File: `components/auth/AuthNav.tsx`.
   - Không còn được import trong codebase.
   - Được xem là navigation/auth cũ, đã thay bằng `NavClient` + header mới.

3. **Luồng "vào admin" chỉ đi qua root header**
   - Dùng `NavClient` (root header) làm **cổng duy nhất** vào `/admin` dựa trên role.
   - `ClientHeader` không còn hiển thị link `/admin` (bỏ logic hoặc prop `canAccessAdmin`).
   - Client header tập trung cho student flows (leaderboard, "Vi phạm của tôi", profile...).

4. **Giữ nguyên shell admin hiện tại**
   - `AdminHeader` + `AdminSidebar` vẫn là layout chính bên trong admin.
   - Không thêm lối vào client từ admin ngoài những chỗ thực sự cần thiết.

5. **Olympia**
   - Tạm thời giữ header inline riêng cho Olympia (không reuse header chính) để tránh đụng nhiều chỗ.
   - Sau khi hệ thống ổn định có thể làm plan riêng: hoặc reuse header chung, hoặc xác nhận Olympia là microsite có design khác.

## Checklist thực thi

### A. Dọn header client trùng lặp

1. Xoá file không dùng:
   - [ ] Xoá `components/domain/client/ClientHeader.tsx`.
2. Đảm bảo `app/(client)/client/layout.tsx` chỉ import:
   - [ ] `components/layout/client/ClientHeader.tsx`.

### B. Xoá `AuthNav.tsx`

1. Kiểm tra lại lần cuối bằng search:
   - [ ] Không còn string `AuthNav` ở bất kỳ file `.tsx`, `.ts`, `.mdx` nào.
2. Xoá file:
   - [ ] Xoá `components/auth/AuthNav.tsx`.

### C. Chuẩn hoá luồng vào admin

1. Trong `components/layout/client/ClientHeader.tsx`:
   - [ ] Bỏ prop/logic hiển thị link `/admin` (nếu còn).
   - [ ] Đảm bảo menu chỉ chứa link dành cho student (client).

2. Trong `components/NavClient.tsx`:
   - [ ] Giữ (hoặc thêm) link vào `/admin` theo role (CC / trường...).
   - [ ] Đảm bảo không tạo hai đường vào admin mâu thuẫn nhau.

### D. Kiểm tra thủ công

1. Flow client (student):
   - [ ] Truy cập `/client` khi chưa đăng nhập → thấy header client + nút đăng nhập (không có link admin).
   - [ ] Đăng nhập student → thấy header client với các link phù hợp, vẫn không có link admin.

2. Flow admin (CC/trường):
   - [ ] Đăng nhập với role admin/CC → root header hiển thị menu vào admin ("Quản lý vi phạm"...).
   - [ ] Vào `/admin` → thấy `AdminHeader` + `AdminSidebar` hoạt động bình thường.

3. Olympia (nếu đang dùng):
   - [ ] Đảm bảo layout Olympia vẫn render bình thường sau khi xoá các header cũ (vì không phụ thuộc vào chúng).

## Ghi chú

- Bất kỳ khi nào muốn đổi UI header client sang thiết kế khác, hãy sửa trực tiếp ở `components/layout/client/ClientHeader.tsx` thay vì tạo thêm file header mới.
- Nếu sau này cần lối tắt từ client sang admin, hãy cân nhắc lại thiết kế tổng thể để không phá quyết định "cổng admin duy nhất" ở root header.
