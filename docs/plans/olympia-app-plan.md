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
- `olympia.participants` (hoặc tên tương đương):
   - `user_id uuid primary key references public.users(id)`
   - `contestant_code text unique` – mã thí sinh dùng trong trận/bảng điểm.
   - `role text` – `null` nếu là thí sinh, `'AD'` nếu là tài khoản quản trị Olympia (được upload bộ đề + host trận).

> Guest (không đăng nhập) không cần bản ghi participants; chỉ cần quyền đọc public state của trận.

### 3.2. Ngân hàng câu hỏi (question bank)

Không dùng bảng tags; chỉ một bảng câu hỏi chính, cấu trúc bám sát file Excel mẫu.

- `olympia.questions` (tên cột tiếng Anh):
   - `id uuid primary key default gen_random_uuid()`
   - `code text unique` – **CODE**
   - `category text` – **LĨNH VỰC** (domain/subject)
   - `question_text text` – **CÂU HỎI**
   - `answer_text text` – **ĐÁP ÁN**
   - `note text` – **GHI CHÚ**
   - `submitted_by text` – **NGƯỜI GỬI** (display name / mã)
   - `source text` – **NGUỒN** (VD: "Tự soạn", "Sách X"...)
   - `image_url text` – **LINK ẢNH**
   - `audio_url text` – **LINK ÂM THANH**
   - `created_by uuid references public.users(id)` – người tạo trong hệ thống (thường là AD)
   - `created_at timestamptz default now()`
   - `updated_at timestamptz default now()`

> Tính năng upload Excel + chỉnh sửa trực tiếp sẽ map cột Excel vào các field trên. UI xử lý validate/merge; schema không cần thêm bảng phụ.

### 3.3. Giải đấu & trận
- `olympia.tournaments`: mô tả giải (tuần/tháng/năm).
- `olympia.matches`: FK → tournaments, lịch thi, trạng thái `draft|scheduled|live|finished`.
- `olympia.match_players`: map tới `olympia.users`, thứ tự ghế, lớp, trường.
- `olympia.match_rounds`: 4 vòng mặc định; `meta` lưu config.
- `olympia.round_questions`: ánh xạ câu hỏi cụ thể cho từng vòng/trận, optional `target_player_id`.

### 3.4. Ghi nhận thi đấu
### 3.4. Câu trả lời & điểm – `olympia.answers`, `olympia.match_scores`
#### 3.4.1. `olympia.answers`
#### 3.4.2. `olympia.match_scores`
- `olympia.buzzer_events`: ai bấm chuông, timestamp, kết quả.
### 5.5. Khuyến nghị sớm

8. `olympia_tournaments` – nếu muốn group nhiều trận theo giải/kỳ.
9. `olympia_obstacles`
10. `olympia_obstacle_tiles`

### 5.6. Live sessions (khuyến nghị nên tách riêng)

Để quản lý trạng thái realtime (timer, bước hiện tại) mà không ghi đè cấu hình `matches`, nên thêm:

- `olympia.live_sessions`:
   - `id uuid primary key`
   - `match_id uuid references olympia.matches(id)`
   - `join_code text unique` – mã để thí sinh/khách join
   - `status text` – `pending|running|ended`
   - `current_round_id uuid references olympia.match_rounds(id)`
   - `current_round_type text` – cache kiểu vòng hiện tại (`khoi_dong|vcnv|tang_toc|ve_dich`)
   - `current_round_question_id uuid references olympia.round_questions(id)`
   - `question_state text` – `hidden|showing|answer_revealed|completed`
   - `timer_deadline timestamptz` – thời điểm hết giờ để client tự đếm ngược
   - `created_by uuid references public.users(id)` – host khởi tạo
   - `created_at timestamptz default now()`
   - `ended_at timestamptz`

> Guest xem trận chỉ cần subscribe/live query vào `live_sessions` + các bảng log (`answers`, `match_scores`, `buzzer_events`), không cần đăng nhập.
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

## 6.1. Liên kết từ portal học sinh chung sang Olympia
- Trên trang client chung của hệ thống (`/client`, file `app/(client)/client/page.tsx`), thêm một mục giới thiệu Olympia trong khu vực sự kiện/hoạt động.
- Gợi ý UI: dùng lại `EventCard` với nội dung, ví dụ:
   - Tiêu đề: "Thi Olympia trực tuyến"
   - Mô tả: "Xem lịch thi và tham gia các trận Olympia do trường tổ chức."
   - Nút/Link: dẫn tới `/olympia/client` (hoặc `https://olympia.<ten-mien>/client` khi đã cấu hình subdomain).
- Vị trí đề xuất: bổ sung một phần tử vào mảng `upcomingEvents` trong `ClientHomePage`, hoặc thêm một `SectionContainer` nhỏ "Hoạt động học tập" có card Olympia nổi bật.
- Mục tiêu: từ portal học sinh hiện tại, học sinh có thể phát hiện và truy cập nhanh sang cổng Olympia mà không cần biết trước URL.

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

## 9. Tiến độ hiện tại (12/2025)
- ✅ Hoàn tất middleware host-based routing và tạo route group `(olympia)` với layout riêng cho admin & client.
- ✅ Đưa toàn bộ DDL `olympia` vào migration `supabase/migrations/20241202090000_olympia_schema.sql` và tạo script seed `scripts/seed-olympia.ts` (giải đấu + trận scheduled/live + câu hỏi mẫu + live session demo).
- ✅ Xây trang admin chính, trang quản lý giải/trận (`/admin/matches`) và ngân hàng câu hỏi (`/admin/question-bank`); cả hai đã đọc dữ liệu thật từ Supabase và có dialog tạo mới thông qua server actions.
- ✅ Bổ sung server actions trong `app/(olympia)/olympia/actions.ts` (create match, create question, validate join code) cùng các client dialog/form tương ứng.
- ✅ Trang client `/client` liệt kê trận scheduled/live, hiển thị mã join đối với trận live và cho phép nhập mã tham gia; hiện tại dùng polling 45 giây để refresh.
- ⏳ Chưa có RLS riêng cho schema `olympia` (đợi sau khi hoàn thiện use-case) và chưa có realtime listener; toàn bộ UI đang rely vào SSR + polling.

## 10. Lộ trình tiếp theo & Supabase Realtime
1. **Realtime hạ tầng**
   - Tạo helper Supabase client phía browser (`lib/supabase-browser.ts`) cùng hook `useOlympiaRealtime`.
   - Đăng ký channel lắng nghe `olympia.matches` (status change) và `olympia.live_sessions` (join code, question_state) để đẩy dữ liệu vào state client.
   - Kết hợp với `LiveScheduleAutoRefresh` (polling) như fallback; tránh double fetch bằng cách cập nhật local state trước khi gọi `router.refresh`.
2. **Client schedule & admin dashboard realtime**
   - Bao bọc trang `/client` bằng client component tiêu thụ hook realtime, cho phép cập nhật lập tức khi trận chuyển `scheduled → live` hoặc session đổi code/timer.
   - Với `/admin` và `/admin/matches`, thêm widget realtime (ví dụ banner “Trận vừa chuyển sang live”) và đồng bộ với `revalidatePath` từ server actions.
3. **API điều khiển live**
   - Viết server actions cho host: tạo/đóng `live_sessions`, chuyển round, reveal question, cập nhật `question_state`.
   - Phát sự kiện realtime tương ứng (tối thiểu broadcast row change; có thể bổ sung channel tùy chỉnh nếu cần latency thấp).
4. **RLS (sau realtime MVP)**
   - Xác định rule: admin (`role = 'AD'`) được full access; thí sinh chỉ đọc `matches` + `live_sessions` ở trạng thái public hoặc thuộc trận gán.
   - Thêm policies cho `questions`, `round_questions`, `match_players` trước khi expose endpoints.
5. **Mở rộng UI**
   - Trang chi tiết trận: tabs cho Vòng, Người chơi, Bộ câu hỏi; cho phép attach/detach record.
   - Cổng học sinh khi đã join: hiển thị timer, log câu hỏi realtime, buzzer input (giai đoạn 2).
6. **QA & Monitoring**
   - Viết script seed bổ sung (players, rounds) để test realtime.
   - Thiết lập logging khi server actions thất bại; cân nhắc thêm `olympia.audit_logs`.
