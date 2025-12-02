# Kế hoạch triển khai module Olympia

## 1. Phạm vi & mục tiêu
- Tạo trải nghiệm thi Olympia riêng trên subdomain `olympia.<ten-mien>` cho cả ban tổ chức (admin) và thí sinh (client).
- Duy trì kiến trúc Next.js hiện tại nhưng tách route group dành cho subdomain mới, dùng chung Supabase auth.
- Thiết lập schema `olympia` trong Supabase để chứa toàn bộ bảng chuyên dụng (không dùng chung với `public` trừ quan hệ `users`).
- Xây dựng 3 phân hệ chính: quản lý giải/trận, quản lý bộ đề, và cổng học sinh tham gia trận live.

## 2. Hạ tầng subdomain & routing
1. **Cấu hình subdomain**
   - Thêm domain `olympia.<ten-mien>` trên Vercel (hoặc platform deploy hiện tại) và liên kết với cùng project.
   - Cập nhật DNS CNAME về Vercel.
2. **Middleware nhận biết host**
   - Tạo `middleware.ts` hoặc cập nhật middleware hiện tại để đọc `request.headers.get('host')`.
   - Nếu host bắt đầu bằng `olympia.`, chuyển request vào route group `app/(olympia)`.
3. **Route group**
   - `app/(olympia-admin)` cho đường dẫn `/admin/*` (ban tổ chức).
   - `app/(olympia-client)` cho `/client/*` (thí sinh & khán giả).
   - Re-export layout riêng (header, sidebar) từ `components/layout/olympia/*`.
4. **RBAC & session**
   - Tái sử dụng `getServerAuthContext` để lấy `appUserId` từ `public.users`.
   - Viết helper `hasOlympiaAdminAccess` kiểm tra user có trong `olympia.admins`.

## 3. Schema Supabase `olympia`
> Lưu ý: chưa tạo bảng nào; toàn bộ DDL cần đưa vào file migration mới trong `supabase/`.

### 3.1. Bảng core (liên kết người dùng)
- `olympia.users` (PK = uuid, FK → `public.users.id`, metadata: display_name, avatar).
- `olympia.admins` (PK = uuid, FK → `public.users.id`, role: `host|editor|viewer`).

### 3.2. Ngân hàng câu hỏi
- `olympia.questions`: `id`, `round_type`, `subject`, `difficulty`, `content`, `answer`, `assets`, `time_limit_seconds`, `created_by` (FK → `olympia.admins`).
- `olympia.question_tags`: `question_id`, `tag`.
- `olympia.question_revisions`: lưu lịch sử chỉnh sửa (optional giai đoạn 2).

### 3.3. Giải đấu & trận
- `olympia.tournaments`: mô tả giải (tuần/tháng/năm).
- `olympia.matches`: FK → tournaments, lịch thi, trạng thái `draft|scheduled|live|finished`.
- `olympia.match_players`: map tới `olympia.users`, thứ tự ghế, lớp, trường.
- `olympia.match_rounds`: 4 vòng mặc định; `meta` lưu config.
- `olympia.round_questions`: ánh xạ câu hỏi cụ thể cho từng vòng/trận, optional `target_player_id`.

### 3.4. Ghi nhận thi đấu
- `olympia.answers`: lưu câu trả lời, đúng/sai, điểm, `response_time_ms`.
- `olympia.match_scores`: snapshot điểm theo vòng.
- `olympia.buzzer_events`: ai bấm chuông, timestamp, kết quả.
- `olympia.star_uses`, `olympia.obstacle_tiles`, `olympia.obstacle_guesses` theo mô tả trong `docs/domain/olympia-rule.md`.

### 3.5. Chính sách
- Áp dụng RLS: chỉ Olympia admin thấy toàn bộ; thí sinh chỉ thấy dữ liệu trận mình tham gia.
- Viết view hỗ trợ dashboard (vd. `olympia.v_match_summary`).

## 4. Trang quản lý giải & trận (`olympia.<domain>/admin`)
1. **Danh sách tournament & trận**
   - Bảng filter theo trạng thái, thời gian, host phụ trách.
   - CTA tạo tournament mới (modal) + tạo trận từ template.
2. **Chi tiết trận**
   - Tabs: Cấu hình vòng, Người chơi, Bộ câu hỏi, Nhật ký.
   - Hỗ trợ gán thí sinh (từ `olympia.users`), export QR join code.
3. **Điều khiển live** (giai đoạn 2)
   - Bảng điều khiển host: start round, next question, reveal answer, pause.
   - Realtime update scoreboard (subscribe `olympia.match_scores`).
4. **Server actions / API**
   - `/app/(olympia-admin)/admin/actions.ts`: createTournament, createMatch, assignPlayer, attachQuestion.
   - Thêm logging sang `olympia.audit_logs` (future optional).

## 5. Trang quản lý bộ đề (`olympia.<domain>/admin/question-bank`)
- Bảng câu hỏi với filter theo vòng, môn, độ khó, người tạo.
- Preview nội dung + assets; badge hiển thị vòng (`Khởi động`, `VCNV`, `Tăng tốc`, `Về đích`).
- Modal tạo/cập nhật: form Markdown, select tags, upload media (tạm dùng Supabase Storage bucket `olympia-assets`).
- Bulk import CSV/JSON (chuyển hoá sang format chuẩn, validate field bắt buộc).
- Audit: hiển thị phiên bản mới nhất + liên kết revision (nếu bật lịch sử).

## 6. Trang học sinh (`olympia.<domain>/client`)
1. **Dashboard học sinh**
   - Ô nhập `join_code`, CTA tham gia trận.
   - Lịch thi sắp tới (dữ liệu từ `olympia.matches` public).
2. **Session view**
   - Khi đã join: hiển thị trạng thái câu hỏi hiện tại, timer, input (text/multiple choice).
   - Realtime sync vs. host: subscribe kênh Supabase Realtime (channel theo `match_id`).
   - Hỗ trợ buzzer: disable input khi chưa giành quyền.
3. **Lịch sử cá nhân**
   - Bảng điểm từng trận đã tham gia, link xem chi tiết.
4. **Khán giả** (giai đoạn 2)
   - Route `/client/watch/[matchId]` để xem scoreboard + luồng câu hỏi read-only.

## 7. Quy trình thực thi
1. **Tuần 1**
   - Finalize plan, tạo migration schema `olympia` (DDL + RLS stub).
   - Implement middleware + route group skeleton, layout chung `OlympiaShell`.
2. **Tuần 2**
   - Hoàn thiện trang quản lý giải/trận (read-only list + create modal).
   - Kết nối Supabase read data, seed sample rows để QA.
3. **Tuần 3**
   - Xây trang question bank + CRUD cơ bản.
   - Tích hợp upload asset, tag filter.
4. **Tuần 4**
   - Phát triển portal học sinh (join code, danh sách trận, realtime stub).
   - Thiết kế component buzzer/input; mô phỏng host control bằng mock API.
5. **Tuần 5+**
   - Bổ sung live host console, realtime event handling, audit log.
   - Viết tests (unit cho lib/olympia, e2e flows cơ bản).

## 8. Hạng mục mở
- Xác định cách map domain `olympia.<ten-mien>` trong môi trường staging vs production.
- Chi tiết RLS cho các bảng event (buzzer, answers) để vừa bảo mật vừa phục vụ realtime.
- Tối ưu hoá latency khi host điều khiển; có cần Edge Runtime cho API host? (chưa quyết).
- Cơ chế phân quyền giữa `olympia.admins` (host vs editor) – cần bảng role riêng hay dùng enum.
- Lưu trữ media (ảnh/video) của câu hỏi: bucket riêng hay tái sử dụng bucket hiện tại.
