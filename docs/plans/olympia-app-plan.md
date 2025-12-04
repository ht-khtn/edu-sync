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
2. **Proxy nhận biết host**
   - Tạo `proxy.ts` hoặc cập nhật proxy hiện tại để đọc `request.headers.get('host')`.
   - Nếu host bắt đầu bằng `olympia.`, chuyển request vào route group `app/(olympia)`.
3. **Route group**
   - `app/(olympia-admin)` cho đường dẫn `/admin/*` (ban tổ chức).
   - `app/(olympia-client)` cho `/client/*` (thí sinh & khán giả).
   - Re-export layout riêng (header, sidebar) từ `components/layout/olympia/*`.
4. **RBAC & session**
   - Tái sử dụng `getServerAuthContext` để lấy `appUserId` từ `public.users`.
   - Viết helper `hasOlympiaAdminAccess` kiểm tra user có trong `olympia.participants` với `role = 'AD'`.

## 2.1. Cơ chế chia luồng Olympia theo role
- Nguồn dữ liệu:
   - Bảng `users` (mapping auth_uid → appUserId) dùng trong `getServerAuthContext`.
   - Bảng `olympia.participants` để xác định vai trò trong hệ thống Olympia:
      - `role = 'AD'` → Olympia admin.
      - `role = null` nhưng có `contestant_code` → thí sinh.
   - Các user không có bản ghi participants → guest.
- Helper dự kiến:
   - `getOlympiaParticipant()` (đã có) đọc từ `olympia.participants` theo `appUserId`.
   - `summarizeOlympiaRole()` trả về enum đơn giản: `olympia-admin | olympia-player | olympia-guest` (không dùng role MC; chế độ xem MC sẽ dựa vào mật khẩu phòng, xem chi tiết §2.2).
- Áp dụng routing:
   - Ở route root `olympia.<domain>/`:
      - Nếu `olympia-admin` → redirect `302` sang `/olympia/admin`.
      - Nếu `olympia-player` hoặc `guest` → redirect sang `/olympia/client`.
      - Người xem MC sử dụng cùng route `/olympia/client/watch/[sessionId]` nhưng phải nhập mật khẩu MC riêng (không có layout riêng).
   - Ở layout admin `app/(olympia)/olympia/(admin)/layout.tsx`:
      - Nếu không phải `olympia-admin` → trả 403 hoặc redirect về `/olympia/client`.
   - Ở layout client `app/(olympia)/olympia/(client)/layout.tsx`:
      - Nếu là admin → hiển thị banner/link nhanh về `/olympia/admin`.
      - Nếu chưa đăng nhập → coi như guest, chỉ cho phép xem lịch và join phòng public.

> Lưu ý: không tạo role MC trong `olympia.participants`; chế độ xem MC sử dụng mật khẩu riêng theo §2.2 và sẽ được hoàn thiện UI ở các sprint sau.

## 2.2. Mật khẩu phòng thi & chế độ xem
- Mỗi `live_session` sinh hai chuỗi mật khẩu khác nhau:
   - `player_password`: bắt buộc thí sinh nhập cùng join code trước khi vào phòng game.
   - `mc_view_password`: dành cho chế độ xem kiểu MC (observer có quyền xem toàn bộ state nhưng không tương tác), mật khẩu này khác hoàn toàn player password.
- Guest xem public (không nhập mật khẩu) chỉ được phép xem lịch, scoreboard tóm tắt và các feed read-only ở chế độ guest.
- UI yêu cầu:
   - Form join code ở `/olympia/client` thêm input mật khẩu thí sinh.
   - Trang `/client/watch/[sessionId]` hiển thị dialog nhập mật khẩu MC trước khi render dữ liệu realtime; nếu bỏ qua sẽ fallback sang chế độ guest read-only.
- Server actions cần xác thực mật khẩu từng loại trước khi cấp quyền tương ứng (ghi nhận trong `app/(olympia)/olympia/actions.ts`).

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
   - `player_password text` – mật khẩu dành cho thí sinh (hash hoặc chuỗi ngẫu nhiên, không hiển thị công khai)
   - `mc_view_password text` – mật khẩu riêng cho chế độ xem MC (khác player password)
   - `requires_player_password boolean default true` – hỗ trợ trường hợp phòng practice không cần mật khẩu
   - `current_round_id uuid references olympia.match_rounds(id)`
   - `current_round_type text` – cache kiểu vòng hiện tại (`khoi_dong|vcnv|tang_toc|ve_dich`)
   - `current_round_question_id uuid references olympia.round_questions(id)`
   - `question_state text` – `hidden|showing|answer_revealed|completed`
   - `timer_deadline timestamptz` – thời điểm hết giờ để client tự đếm ngược
   - `created_by uuid references public.users(id)` – host khởi tạo
   - `created_at timestamptz default now()`
   - `ended_at timestamptz`

> Password nên lưu dạng hash (ít nhất là `crypto.subtle.digest('SHA-256')`) và chỉ hiển thị plaintext một lần khi tạo. Bảng audit log sẽ ghi lại lần đổi mật khẩu gần nhất để ban tổ chức kiểm soát việc chia sẻ.

> Guest xem trận chỉ cần subscribe/live query vào `live_sessions` + các bảng log (`answers`, `match_scores`, `buzzer_events`), không cần đăng nhập.
- Áp dụng RLS: chỉ Olympia admin thấy toàn bộ; thí sinh chỉ thấy dữ liệu trận mình tham gia.
- Viết view hỗ trợ dashboard (vd. `olympia.v_match_summary`).

## 4. Trang quản lý giải & trận (`olympia.<domain>/admin`)
1. **Danh sách tournament & trận** (Quản lý cuộc thi)
   - Bảng filter theo trạng thái, thời gian, host phụ trách.
   - CTA tạo tournament mới (modal) + tạo trận từ template.
2. **Chi tiết trận**
   - Tabs: Cấu hình vòng, Người chơi, Bộ câu hỏi, Nhật ký.
   - Hỗ trợ gán thí sinh (từ `olympia.users`), export QR join code.
3. **Điều khiển live / Quản lý phòng** (giai đoạn 2)
   - Bảng điều khiển host: start round, next question, reveal answer, pause.
   - Realtime update scoreboard (subscribe `olympia.match_scores`).
4. **Server actions / API**
   - `/app/(olympia-admin)/admin/actions.ts`: createTournament, createMatch, assignPlayer, attachQuestion.
   - Thêm logging sang `olympia.audit_logs` (future optional).

## 4.1. Trang quản lý admin & tài khoản thi
- Mục tiêu: cho phép quản lý tập trung các tài khoản có quyền Olympia (admin, thí sinh), dựa trên bảng `users` và `olympia.participants`.
- Route đề xuất: `olympia.<domain>/admin/accounts` → file `app/(olympia)/olympia/(admin)/admin/accounts/page.tsx`.
- Dữ liệu hiển thị:
   - Admin Olympia: các bản ghi `olympia.participants` có `role = 'AD'` (kèm thông tin từ `public.users`: tên, username, lớp, trường...).
   - Thí sinh được cấp mã thi: các bản ghi `participants` còn lại (role `null` hoặc các role khác trong tương lai).
- Tính năng giai đoạn 1:
   - Bảng danh sách với filter theo role (Admin / Thí sinh / Khác), ô tìm kiếm theo tên hoặc mã.
   - CTA (stub) "Thêm admin" / "Thêm thí sinh" dùng server actions để:
      - Tạo/cập nhật `olympia.participants` cho một user đã tồn tại.
      - Gán/thu hồi `role = 'AD'` cho tài khoản Olympia.
   - Chưa bắt buộc phải mở full CRUD; có thể chỉ log (TODO) cho các thao tác nhạy cảm.

> Giai đoạn sau có thể mở rộng thêm: import danh sách thí sinh từ CSV, gán ghế mặc định cho từng trận, và UI phân quyền chi tiết hơn (MC, observer...).

### 4.2. Liên kết từ dashboard admin chung
- Trang `app/(admin)/admin/page.tsx` (dashboard quản trị tổng hệ thống) cần có 2 thẻ điều hướng rõ ràng:
   - "Olympia Admin" → `/olympia/admin/accounts?role=admin`.
   - "Olympia Thí sinh" → `/olympia/admin/accounts?role=contestant`.
- Các thẻ này dùng icon khác nhau, mô tả ngắn về phạm vi Olympia và được đặt cạnh các tính năng quản trị hiện hữu để admin dễ phát hiện.

## 5. Trang quản lý bộ đề (`olympia.<domain>/admin/question-bank`)
- Bảng câu hỏi với filter theo vòng, môn, độ khó, người tạo.
- Preview nội dung + assets; badge hiển thị vòng (`Khởi động`, `VCNV`, `Tăng tốc`, `Về đích`).
- Modal tạo/cập nhật: form Markdown, select tags, upload media (tạm dùng Supabase Storage bucket `olympia-assets`).
- Bulk import CSV/JSON (chuyển hoá sang format chuẩn, validate field bắt buộc).
- Audit: hiển thị phiên bản mới nhất + liên kết revision (nếu bật lịch sử).

## 6. Trang học sinh (`olympia.<domain>/client`)
1. **Dashboard học sinh**
   - Ô nhập `join_code`, CTA tham gia trận.
   - Bổ sung input `player_password` (ẩn/required) trước khi gọi server action join; thông báo lỗi nếu sai mật khẩu.
   - Lịch thi sắp tới (dữ liệu từ `olympia.matches` public).
2. **Session view**
   - Khi đã join: hiển thị trạng thái câu hỏi hiện tại, timer, input (text/multiple choice).
   - Realtime sync vs. host: subscribe kênh Supabase Realtime (channel theo `match_id`).
   - Hỗ trợ buzzer: disable input khi chưa giành quyền.
3. **Lịch sử cá nhân**
   - Bảng điểm từng trận đã tham gia, link xem chi tiết.
4. **Khán giả / MC view**
   - Route `/client/watch/[matchId]` cho phép 2 chế độ:
      - Nhập `mc_view_password` → chế độ xem MC (thấy full state realtime, không được gửi đáp án).
      - Bỏ qua mật khẩu → chế độ guest read-only, chỉ xem scoreboard/timeline public.

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

## 11. Backlog còn lại (ngoài RLS)
1. **Player session UI (game client)**
   - Route đề xuất: `app/(olympia)/olympia/(client)/game/[sessionId]/page.tsx`.
   - Yêu cầu: đọc live session + match state, hiển thị câu hỏi, timer, input trả lời, trạng thái buzzer.
   - Kết nối Supabase Realtime (hoặc channel custom) để nhận sự kiện `current_round_type`, `question_state`, `timer_deadline`, `round_questions`.
   - Logic chấm điểm phía client chỉ hiển thị; việc tính điểm sẽ gọi server actions/edge.
2. **Host advanced controls**
   - Bổ sung bảng phụ trong console host: chọn câu hỏi trong vòng (`round_questions`), reveal đáp án, đặt timer deadline.
   - Server actions mới: `setLiveQuestionAction`, `setTimerAction`, `broadcastEventAction`.
3. **Scoring & gameplay services**
   - Tạo module `lib/olympia/{questions,rounds,scoring,buzzer}.ts` xử lý: gán câu cho vòng, tính điểm theo rule từng vòng, ghi nhận buzzer/answers.
   - Viết unit tests cơ bản (vitest) cho từng service.
4. **Realtime nâng cao**
   - Hook `useOlympiaRealtime` dùng chung: manage multiple channels, retry backoff, expose `useStore` cho client.
   - Dùng realtime để cập nhật dashboard admin (banner, toast) và player session.
5. **Join/registration flow**
   - Trang đăng ký thí sinh (mapping `participants` với user), bao gồm form info + assign seat (pending approval).
   - Hỗ trợ export QR code join code.
6. **Logging & audit**
   - Thêm bảng `olympia.audit_logs` ghi lại action host (open room, change round, reveal answer).
   - Hiển thị log trong tab “Nhật ký” ở trang chi tiết trận.
7. **CI/Test coverage**
   - Viết Vitest cho server actions (mock Supabase), storybook snapshot cho component host/client quan trọng, và tối thiểu 1 e2e flow (Playwright / Cypress) kiểm chứng: admin mở phòng → client thấy join code → host chuyển vòng.

## 12. Trang Game (player session) – yêu cầu khung & TODO
1. **Cấu trúc & routing**
   - Tạo route `app/(olympia)/olympia/(client)/game/[sessionId]/page.tsx` (SSR) + `loading.tsx` + `error.tsx`.
   - Layout: toàn màn hình, chia panel chính (video/image/câu hỏi) và sidebar (điểm/thứ hạng/buzzer).
2. **Logic cần chuẩn bị**
   - Hook client `useOlympiaGameState` (trong `components/olympia/game/`) subscribe realtime vào `live_sessions`, `round_questions`, `match_scores`, `buzzer_events`.
   - State machine cơ bản: `hidden → showing → answer_revealed → completed`, bao gồm countdown timer (`timer_deadline`).
   - Server actions placeholder: ghi đáp án (`submitAnswerAction`), bấm buzzer (`triggerBuzzerAction`), đồng bộ timer.
   - Tất cả điểm/tính toán implemented ở server services nhưng kết quả reflect về client qua realtime.
3. **UI placeholder & TODO markers**
   - Component khung hiển thị media: chừa `// TODO: render question media (image/video)` và `// TODO: render host video feed`.
   - Phần scoreboard và log: chừa `// TODO: custom styling / animation` để chủ động tinh chỉnh.
   - Loading skeleton: reuse palette xám giống client/admin; placeholder sections cho video, câu hỏi, scoreboard.
4. **Tích hợp với plan**
   - Khi host mở phòng và chuyển câu → route game được refresh realtime.
   - Khi người chơi đăng nhập và truy cập `/olympia/game/[join_code]`, flow: join form → redirect sang trang này cùng sessionId.

> Lưu ý: phần media (video, hình ảnh, asset động) sẽ do người phụ trách (user) triển khai sau. Các chỗ cần chèn nội dung thực tế phải có comment `// TODO` rõ ràng để Todo Tree tìm được.
