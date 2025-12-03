# 🧱 EduSync Database Schema Summary

## 1. users
Lưu thông tin người dùng hệ thống (học sinh, giáo viên, quản trị...).

| Cột | Mô tả |
|------|-------|
| id | UUID nội bộ (PK) |
| auth_uid | Liên kết đến `auth.users` |
| class_id | Liên kết lớp học (`classes`) |
| created_at / updated_at | Mốc thời gian |

**Quan hệ:**  
- 1–1 → `user_profiles`  
- 1–n → `user_roles`, `records`, `complaints`  

---

## 2. user_profiles
Chứa thông tin cá nhân của người dùng.

| Cột | Mô tả |
|------|-------|
| user_id | Liên kết `users.id` (PK) |
| full_name, email, phone_number, address, date_of_birth, gender | Thông tin cá nhân |
| created_at / updated_at | Mốc thời gian |

**Quan hệ:**  
- 1–1 với `users`

---

## 3. permissions
Định nghĩa quyền hạn (role) trong hệ thống.

| Cột | Mô tả |
|------|-------|
| id | Mã quyền (VD: `student`, `sec`) |
| name | Tên hiển thị |
| description | Mô tả |
| scope | JSON định nghĩa phạm vi quyền |
| created_at | Mốc thời gian |

**Quan hệ:**  
- 1–n với `user_roles`

---

## 4. user_roles
Gắn người dùng với quyền cụ thể trong phạm vi nhất định.

| Cột | Mô tả |
|------|-------|
| id | UUID (PK) |
| user_id | Liên kết `users.id` |
| role_id | Liên kết `permissions.id` |
| target | Phạm vi quyền (VD: `class_10A1`, `school`) |
| created_at | Thời gian tạo |

**Quan hệ:**  
- n–1 đến `users`, `permissions`

---

## 5. grades
Lưu danh sách các khối học (VD: Khối 10, 11, 12).

| Cột | Mô tả |
|------|-------|
| id | UUID (PK) |
| name | Tên khối |
| created_at | Thời gian tạo |

**Quan hệ:**  
- 1–n → `classes`

---

## 6. classes
Lưu danh sách lớp học.

| Cột | Mô tả |
|------|-------|
| id | UUID (PK) |
| grade_id | Liên kết `grades.id` |
| name | Tên lớp |
| homeroom_teacher_id | GVCN (`users.id`) |
| created_at | Thời gian tạo |

**Quan hệ:**  
- n–1 đến `grades`  
- 1–n → `users`, `records`

---

## 7. criteria
Các tiêu chí thi đua.

| Cột | Mô tả |
|------|-------|
| id | UUID (PK) |
| name / description | Tên và mô tả |
| type | `normal` / `serious` / `critical` |
| score | Điểm cộng/trừ |
| category | Phân loại tiêu chí |
| created_at / updated_at | Thời gian |

**Quan hệ:**  
- 1–n → `records`

---

## 8. records
Bảng ghi điểm thi đua (trung tâm hệ thống).

| Cột | Mô tả |
|------|-------|
| id | UUID (PK) |
| class_id | Lớp học (`classes.id`) |
| student_id | Học sinh (`users.id`) |
| criteria_id | Tiêu chí (`criteria.id`) |
| score | Điểm cộng/trừ |
| note | Ghi chú |
| recorded_by | Người ghi (`users.id`) |
| created_at / updated_at / deleted_at | Thời gian |

**Quan hệ:**  
- n–1 đến `classes`, `users`, `criteria`  
- 1–n → `complaints`

---

## 9. complaints
Khiếu nại của học sinh về bản ghi thi đua.

| Cột | Mô tả |
|------|-------|
| id | UUID (PK) |
| record_id | Bản ghi bị khiếu nại (`records.id`) |
| submitted_by | Người gửi (`users.id`) |
| handled_by | Người xử lý (`users.id`) |
| status | `pending` / `resolved` / `rejected` |
| content / response | Nội dung & phản hồi |
| created_at / updated_at | Thời gian |

**Quan hệ:**  
- n–1 đến `records`, `users`

---

## 10. audit_logs
Theo dõi toàn bộ hành động thay đổi (Audit Trail).

| Cột | Mô tả |
|------|-------|
| id | UUID (PK) |
| table_name | Bảng bị thay đổi |
| record_id | ID bản ghi |
| action | Loại hành động (`INSERT`, `UPDATE`, `DELETE`) |
| actor_id | Người thực hiện |
| diff | JSON mô tả thay đổi |
| meta | Thông tin phụ (IP, thiết bị, v.v.) |
| created_at | Thời điểm ghi log |

**Quan hệ:**  
- Độc lập, ghi log cho mọi bảng

---

## 🔗 Entity Relationships Overview

