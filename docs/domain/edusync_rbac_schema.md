# 🧩 EduSync RBAC – Cấu trúc & Logic Quyền Hạn

## 1️⃣ Tổng quan

Hệ thống phân quyền (RBAC – Role-Based Access Control) của **EduSync** được thiết kế theo mô hình **đa tầng (multi-layer)** kết hợp **scope (phạm vi)** và **target (đối tượng cụ thể)** để xác định quyền chính xác và linh hoạt cho từng vai trò trong trường THPT.

---

## 2️⃣ Các bảng liên quan

| Bảng | Mô tả | Vai trò |
|------|-------|----------|
| **`users`** | Danh sách người dùng chính của hệ thống | Liên kết với `auth.users` qua `auth_uid` |
| **`user_profiles`** | Thông tin cá nhân (họ tên, giới tính, ảnh, mã định danh, ...) | Bổ sung thông tin cho bảng `users` |
| **`user_roles`** | Lưu vai trò của mỗi người dùng | Là cầu nối giữa người dùng và quyền |
| **`permissions`** | Mỗi vai trò có một tập quyền cụ thể | Xác định quyền tổng thể của từng vai trò |
| **`classes`** | Danh sách các lớp học | Dùng để xác định phạm vi lớp khi lọc dữ liệu |
| **`grades`** | Danh sách các khối (10, 11, 12) | Dùng để xác định phạm vi khối |
| **`records`** | Bảng điểm thi đua / phong trào | Dữ liệu mà RBAC sẽ kiểm soát quyền truy cập |
| **`criteria`** | Danh mục tiêu chí chấm điểm | Dùng trong tính điểm và duyệt phong trào |
| **`complaints`** | Khiếu nại, phản hồi | Cần quyền đặc biệt để xem hoặc xử lý |

---

## 3️⃣ Cấu trúc phân quyền (RBAC Logic)

### **3.1. Cấp độ vai trò**

| Vai trò | Mã | Phạm vi (scope mặc định) | Quyền chính |
|----------|----|---------------------------|--------------|
| **AD** | Administrator | `global` | Toàn quyền hệ thống |
| **MOD** | Moderator (quản trị cấp trường) | `school` | Toàn quyền trong toàn trường |
| **SEC** | School Executive Committee (BCH Đoàn trường / Ban Chấp hành) | `school` | Xem toàn trường, chỉnh sửa theo `target` |
| **CC** | Class Committee (Ban thi đua lớp / Cán sự lớp) | `class` | Xem và chỉnh sửa trong lớp của mình |
| **CEC** | Class Executive Committee (Liên chi đoàn khối / Ban thi đua khối) | `grade` | Xem toàn khối, chỉnh sửa theo `target` |
| **S** | Student | `personal` | Chỉ xem và chỉnh sửa dữ liệu cá nhân |
| **T** | Teacher | `class` | Xem thông tin học sinh thuộc lớp dạy |
| **YUM** | Youth Union Member | `organization` | Quyền tương tự `S`, thêm thao tác tập thể |

---

## 4️⃣ Cơ chế kết hợp Scope + Target

### **4.1. Scope**
Là **phạm vi truy cập mặc định** do hệ thống định nghĩa trong `permissions`.

Ví dụ:
- `SEC` có scope `school` → có quyền *xem toàn trường*.
- `CC` có scope `class` → chỉ *xem dữ liệu trong lớp của mình*.
- `MOD` có scope `school` có quyền *xem toàn trường*.

### **4.2. Target**
Là **đối tượng cụ thể mà người dùng có thể thao tác (WRITE/APPROVE/DELETE)**.  
Ví dụ:
- Học sinh 1 có target `12A5` → có thể sửa dữ liệu lớp 12A5
- Học sinh 2 có target `ALL` → có thể sửa dữ liệu toàn bộ của scope permissions
- Học sinh 2 có target NULL → không có quyền sửa

### **4.3. Kết hợp logic**
Quyền thực tế = **Scope (permissions)** ✚ **Target (user_roles)**

| Trường hợp | Kết quả |
|-------------|----------|
| `scope = school`, `target = 12` | Có thể XEM toàn trường, nhưng chỉ CÓ TOÀN QUYỀN (sửa, duyệt, xoá) trên khối 12 |
| `scope = class`, `target = 12A5` | Có thể XEM dữ liệu lớp mình, và có TOÀN QUYỀN trong lớp 12A5 |
| `scope = NULL, `target = NULL` | chỉ có quyền XEM dữ liệu của mình |
| `scope = school`, `target = NULL` | Có thể XEM toàn trường, nhưng không có quyền sửa |
| `scope = school`, `target = 12A3` | Có thể XEM toàn trường, có toàn quyền trên lớp 12A3 |
---

---

## 6️⃣ Luồng kiểm tra quyền (Access Logic)

1. Khi người dùng truy cập dữ liệu:
   - Hệ thống lấy `role_code` từ `user_roles`
   - Lấy `scope` từ `permissions` ứng với vai trò
   - Lấy `target` từ `user_roles.target`

2. Nếu `scope` bao trùm phạm vi dữ liệu → cho phép đọc.  
   Nếu `target` khớp với đối tượng dữ liệu → cho phép thao tác.

---

---

## 8️⃣ Tổng kết

| Thành phần | Vai trò | Ghi chú |
|-------------|----------|----------|
| `scope` | Xác định phạm vi XEM dữ liệu | Đặt trong `permissions` |
| `target` | Xác định phạm vi TOÀN QUYỀN (sửa, duyệt) | Lưu trong `user_roles` |
| `scope + target` | Quyền truy cập thực tế | Kết hợp động khi query |
| `permissions` | Quy định cấp quyền mặc định cho từng vai trò | Dễ mở rộng, tái sử dụng |
| `user_roles` | Cụ thể hóa quyền của từng người dùng | Cá nhân hóa theo nhiệm vụ |

---

**Tóm lại:**  
> `permissions.scope` quyết định **phạm vi xem**,  
> `user_roles.target` quyết định **phạm vi thao tác**,  
> kết hợp cả hai → xác định **toàn bộ quyền truy cập của người dùng**.

---

🧠 *EduSync – “Quản lý điểm số. Đơn giản. Thông minh.”*
