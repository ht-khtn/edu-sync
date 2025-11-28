# Kế hoạch kiến trúc & database cho mode thi Olympia (EduSync)

## 1. Mục tiêu sản phẩm

- Xây dựng một mode thi kiểu "Đường lên đỉnh Olympia" trong EduSync, dùng để **thi thật/mô phỏng trận đấu**, không có chế độ luyện tập rời rạc.
- Hỗ trợ tổ chức trận thi với 4 thí sinh, 4 vòng chính (Khởi động, Vượt chướng ngại vật, Tăng tốc, Về đích).
- Có thể gom nhiều trận vào một giải/tournament (tuần, tháng, năm…) nhưng vẫn hoạt động tốt nếu chỉ dùng từng trận lẻ.
- Có scoreboard/bảng điểm rõ ràng, dễ theo dõi trong suốt trận.

## 2. Phạm vi bản MVP

**MVP tập trung vào:**

- Ngân hàng câu hỏi dùng cho thi, phân loại theo vòng, môn, độ khó.
- Tổ chức một trận thi (`match`) với tối đa 4 thí sinh:
  - Cấu hình 4 vòng.
  - Gán câu hỏi cụ thể cho từng vòng.
  - Lưu lại tất cả câu trả lời và điểm.
- Bảng điểm tổng cho mỗi thí sinh theo vòng.

**Lưu ý bổ sung theo luật chính thức (đã đọc `olympia-rule.md`):**
- Khởi động: gồm lượt cá nhân (6 câu, 5s/câu, +10 đúng) và lượt chung (12 câu, buzzer, +10 đúng, -5 sai/no-answer-after-buzz; không âm tổng).
- Vượt chướng ngại vật: grid với 4 từ hàng ngang + ô trung tâm + final keyword; mỗi ô hàng ngang trả lời đúng +10 và mở ảnh; final CNV có điểm giảm dần theo số ô đã lộ (quy tắc: 60 trừ 10 cho mỗi hàng ngang đã qua, tối đa ~70 trong một số trường hợp theo luật truyền thống); đoán sai → dừng phần này.
- Tăng tốc: 4 câu, thời gian 20/20/30/30s; điểm phân theo thứ tự trả lời đúng (40/30/20/10). Cần `response_time_ms` để xếp hạng.
- Về đích: mỗi thí sinh chọn 3 câu (20/30 điểm); có thể có câu thực hành (thêm thời gian thực hành); có quyền "cướp" (steal) với thời hạn 5s để bấm chuông và 3s để trả lời; "Ngôi sao hy vọng" có thể đặt trước và nhân đôi điểm nếu đúng.
- Câu hỏi phụ (tie-break): bấm chuông trong 15s, đúng thắng, sai chuyển câu; sau 3 câu chưa phân thắng bại → bốc thăm.

Những lưu ý nghiệp vụ quan trọng cho triển khai: lưu `response_time_ms` cho mọi đáp án, lưu event buzzer (ai bấm, timestamp), track star usage, track VCNV tile status (open/locked), track disqualification for obstacle when đoán sai.

- Luồng luyện tập cá nhân.
- Realtime phức tạp (buzzer thời gian thực). Ở MVP, host bấm/chuyển bước bằng button, client chỉ cần fetch trạng thái hiện tại.
- Hệ thống tournament nhiều tầng phức tạp (quarter/semi/final). Chỉ dừng ở việc có thể group nhiều match vào 1 tournament đơn.

## 2.1. Chế độ chơi live kiểu Kahoot/Quizizz (host-controlled)

Để game giống cơ chế của Quizizz/Kahoot/Blooket, MVP sẽ hỗ trợ **live session do host điều khiển**, với 3 vai:

- **Admin/Host (trong `(admin)`):**
  - Tạo game từ một `olympia_match` đã cấu hình trước (đã có players, rounds, câu hỏi).
  - Khởi tạo `live session` với `join_code` cho thí sinh và khán giả.
  - Điều khiển tiến trình: Start match, Start question, Reveal answer, Next question, Switch round, End match.
  - Theo dõi real-time: số người đã trả lời, kết quả từng câu, scoreboard tổng.
- **Client/Player (trong `(client)`):**
  - Join bằng `join_code` trên thiết bị riêng (PC/điện thoại), map tới một `olympia_match_player` (nếu là thí sinh).
  - Ở mỗi câu: chỉ thấy UI trả lời (text/option, buzzer, input), không điều khiển được flow.
  - Câu hỏi và timer được sync từ host (host-controlled mode).
- **Guest/Viewer (trong `(guests)` hoặc một route watch-only):**
  - Join bằng `join_code` để xem trận đấu dưới dạng spectator.
  - Thấy câu hỏi, video, grid VCNV, scoreboard, nhưng không có input.

**Vòng đời 1 câu hỏi (host-controlled):**

1. Host bấm "Start question" → server set trạng thái session: `current_round_question_id`, `question_state = 'showing'`, start timer.
2. Clients (thí sinh + khán giả) subscribe state này (qua Supabase Realtime hoặc polling) để hiển thị nội dung câu hỏi/timer.
3. Thí sinh gửi đáp án trong khoảng thời gian cho phép (theo `time_limit_seconds` và luật từng vòng). Nếu là vòng buzzer, trước đó client gửi event "bấm chuông" để giành quyền.
4. Hết giờ hoặc host bấm "Reveal answer": server khóa nhận thêm đáp án, chấm điểm, lưu `olympia_answers` (+ các bảng sự kiện như `buzzer_events`, `star_uses`...), cập nhật `olympia_match_scores`.
5. Host bấm "Next" → server chuyển sang câu tiếp theo trong round (tăng `order_index`) hoặc chuyển sang round kế tiếp.

**So sánh với Kahoot/Quizizz:**
- Giống chế độ host: host quyết định khi nào qua câu mới, và client sync state qua server.
- Khác ở luật tính điểm: dùng rule Olympia (40/30/20/10, -5, steal, star, v.v.) thay vì điểm công thức tốc độ/streak mặc định.

**Linh hoạt số lượng thí sinh:**
- `olympia_match_players` không bắt buộc đủ 4, có thể 1–4 người.
- Tính điểm Tăng tốc: nếu ít hơn 4 người trả lời đúng, chỉ phát điểm tương ứng cho số người đó; logic mapping 40/30/20/10 áp dụng theo thứ tự `response_time_ms`.

## 3. Các bảng Supabase đề xuất (MVP)

Mục tiêu: đủ để chạy một trận thi 4 vòng, 4 thí sinh, lưu được toàn bộ lịch sử câu hỏi/đáp án/điểm.

### 3.1. Ngân hàng câu hỏi – `olympia_questions`

**Mục đích:**

- Lưu toàn bộ câu hỏi dùng cho thi, không chứa dữ liệu bản quyền sao chép từ chương trình thật.
- Phân loại theo vòng (`round_type`), môn, độ khó… để host có thể chọn/bộ đề có thể được dựng trước.

**Cột gợi ý:**

- `id` (uuid, PK)
- `created_by` (uuid, FK → users)
- `subject` (text)
- `grade` (int hoặc text)
- `round_type` (text: `khoi_dong|vcnv|tang_toc|ve_dich`)
- `difficulty` (text: `easy|medium|hard` hoặc numeric)
- `question_type` (text: `short_answer|mcq|true_false|...`)
- `content` (text) – nội dung, có thể là Markdown
- `answer` (text hoặc jsonb) – đáp án chuẩn
- `time_limit_seconds` (int, optional)
- `base_points` (int, optional)
- `tags` (text[] hoặc jsonb)
- `created_at` (timestamp, default now)

*Gợi ý: để hỗ trợ luật, đặt mặc định `time_limit_seconds` theo `round_type` nếu không khai báo (e.g. khởi động cá nhân 5s, khởi động chung buzz window 5s, VCNV tile 15s, tăng tốc 20/20/30/30, về đích 15/20s cho 20/30 điểm).* 

### 3.2. Giải & trận – `olympia_tournaments`, `olympia_matches`, `olympia_match_players`

Có thể dùng match lẻ mà không cần tournament, nhưng thêm `tournaments` từ đầu giúp dễ mở rộng.

#### 3.2.1. `olympia_tournaments` (optional nhưng recommend)

- `id` (uuid, PK)
- `name` (text)
- `description` (text)
- `created_by` (uuid, FK → users)
- `starts_at` (timestamp, optional)
- `ends_at` (timestamp, optional)

#### 3.2.2. `olympia_matches`

- `id` (uuid, PK)
- `tournament_id` (uuid, FK → olympia_tournaments.id, nullable)
- `name` (text) – ví dụ: "Tuần 1 – Trận 3"
- `scheduled_at` (timestamp)
- `status` (text: `scheduled|running|finished|cancelled`)
- `meta` (jsonb) – cấu hình chung trận: luật điểm, thời lượng từng vòng, etc.

*Gợi ý meta:* lưu cấu hình cụ thể cho vòng (vd. `meta.rounds = [{"round_type":"khoi_dong","personal_questions":6,"public_questions":12}]`).

#### 3.2.3. `olympia_match_players`

- `id` (uuid, PK)
- `match_id` (uuid, FK → olympia_matches.id)
- `user_id` (uuid, FK → users)
- `seat_index` (int) – 1..4
- `display_name` (text, optional)
- `meta` (jsonb, optional)

### 3.3. Cấu trúc vòng & câu hỏi trong trận – `olympia_match_rounds`, `olympia_round_questions`

#### 3.3.1. `olympia_match_rounds`

**Mục đích:**

- Mỗi trận có 4 vòng: Khởi động, VCNV, Tăng tốc, Về đích.
- Cấu hình riêng cho từng vòng: số câu, luật điểm, rule đặc biệt.

**Cột:**

- `id` (uuid, PK)
- `match_id` (uuid, FK → olympia_matches.id)
- `round_type` (text: `khoi_dong|vcnv|tang_toc|ve_dich`)
- `order_index` (int) – 1, 2, 3, 4
- `meta` (jsonb) – cấu hình chi tiết (ví dụ: số câu, điểm mỗi câu, bonus...)

#### 3.3.2. `olympia_round_questions`

**Mục đích:**

- Gán các câu hỏi cụ thể cho từng vòng trong 1 trận.
- Quy định thứ tự câu, và nếu câu đó dành riêng cho 1 thí sinh hay chung cho tất cả.

**Cột:**

- `id` (uuid, PK)
- `match_round_id` (uuid, FK → olympia_match_rounds.id)
- `question_id` (uuid, FK → olympia_questions.id)
- `order_index` (int)
- `target_player_id` (uuid, FK → olympia_match_players.id, nullable)
  - Khởi động / Về đích: câu dành cho 1 thí sinh cụ thể.
  - Tăng tốc: `target_player_id` = null → câu chung cho tất cả.
- `meta` (jsonb) – rule riêng cho câu (điểm, bonus, v.v.)

*Gợi ý cho `meta` của round:*
- Khởi động: { personal_time:5, personal_count:6, public_time:5, public_count:12, personal_points:10, public_points:10, public_penalty:-5 }
- VCNV: { tile_time:15, tile_points:10, final_base:60, final_decrement:10, final_max_bonus:70 }
- Tăng tốc: { times:[20,20,30,30], speed_points:[40,30,20,10] }
- Về đích: { choices:[20,30], practice_extra_seconds:{20:30,30:60} }

### 3.4. Câu trả lời & điểm – `olympia_answers`, `olympia_match_scores`

#### 3.4.1. `olympia_answers`

**Mục đích:**

- Lưu toàn bộ câu trả lời đã được gửi trong một trận (ai trả lời, câu nào, đúng/sai, thời gian, điểm).
- Dùng cho cả 4 vòng, bao gồm VCNV và Tăng tốc.

**Cột:**

- `id` (uuid, PK)
- `match_id` (uuid, FK → olympia_matches.id)
- `match_round_id` (uuid, FK → olympia_match_rounds.id)
- `round_question_id` (uuid, FK → olympia_round_questions.id)
- `player_id` (uuid, FK → olympia_match_players.id)
- `given_answer` (text/jsonb)
- `is_correct` (bool)
- `points_awarded` (int)
- `response_time_ms` (int, optional – quan trọng cho Tăng tốc)
- `created_at` (timestamp)

*Bổ sung cần thiết theo luật:*
- `olympia_answers` phải luôn lưu `response_time_ms` để phục vụ xếp hạng Tăng tốc và tranh chấp buzzer.
- Cần bảng hoặc event log riêng cho buzzer (ai bấm, timestamp) để xác định ai giành quyền trong các vòng dùng buzzer (khởi động chung, Tăng tốc, CNV, Về đích steal).
- Theo luật, có các penalty khác nhau (-5, trừ 50% của câu khi steal trả lời sai) → `points_awarded` phải ghi âm trực tiếp và `olympia_match_scores` cập nhật ngay.

#### 3.4.2. `olympia_match_scores`

**Mục đích:**

- Snapshot điểm tổng theo từng vòng cho mỗi thí sinh, để render bảng điểm nhanh.
- Có thể được cập nhật sau khi kết thúc mỗi câu/vòng dựa trên `olympia_answers`.

**Cột:**

- `id` (uuid, PK)
- `match_id` (uuid, FK → olympia_matches.id)
- `player_id` (uuid, FK → olympia_match_players.id)
- `round_type` (text)
- `points` (int)

## 4. Vượt chướng ngại vật – cấu trúc puzzle (cho thi)

Đây là phần đặc thù của VCNV, tách riêng để dễ quản lý.

### 4.1. `olympia_obstacles`

**Mục đích:**

- Lưu thông tin một chướng ngại vật (keyword cuối cùng, cấu trúc lưới, điểm bonus).
- Gắn với `match_round` cụ thể trong một trận.

**Cột:**

- `id` (uuid, PK)
- `match_round_id` (uuid, FK → olympia_match_rounds.id)
- `title` (text)
- `final_answer` (text)
- `grid_rows` (int)
- `grid_cols` (int)
- `base_bonus_points` (int)
- `meta` (jsonb)

*Bổ sung nghiệp vụ:*
- Khi thí sinh trả lời sai CNV (đã bấm chuông mà trả lời sai) → thí sinh bị dừng phần VCNV (flag `disqualified_obstacle` trên player hoặc trong `olympia_answers` event). 
- Thêm bảng `olympia_obstacle_guesses` hoặc lưu như `olympia_answers` special record để tracking guess attempts cho final keyword.

### 4.2. `olympia_obstacle_tiles`

**Mục đích:**

- Ánh xạ từng ô (tile) trong lưới của VCNV tới một `round_question` cụ thể.

**Cột:**

- `id` (uuid, PK)
- `obstacle_id` (uuid, FK → olympia_obstacles.id)
- `row` (int)
- `col` (int)
- `round_question_id` (uuid, FK → olympia_round_questions.id)

> Ghi chú: Các lần đoán keyword cuối cùng và điểm thưởng có thể được biểu diễn bằng một bản ghi `olympia_answers` đặc biệt (ví dụ: `round_question_id` trỏ tới một "câu" hệ thống dành cho keyword), thay vì tạo thêm bảng mới.

## 5. Mức tối thiểu cho MVP

Để triển khai nhanh và vẫn đầy đủ cho một trận thi, có thể chia thành:

### 5.1. Bắt buộc (nên implement trước)

1. `olympia_questions`
2. `olympia_matches`
3. `olympia_match_players`
4. `olympia_match_rounds`
5. `olympia_round_questions`
6. `olympia_answers`
7. `olympia_match_scores`

**Trường/ bảng bổ sung KHẨN cấp cho đúng luật (nên thêm cùng MVP):**
- `buzzer_events` (match_id, round_id, question_id, player_id, timestamp, event_type)
- `star_uses` (match_id, player_id, used_at, outcome, multiplier)
- `obstacle_guesses` (obstacle_id, player_id, guess_text, is_correct, attempt_order, created_at)

Việc có `buzzer_events` giúp xác định ai press-first trong các tình huống bấm chuông, và giúp áp penalty/steal luật chính xác.

### 5.2. Khuyến nghị sớm

8. `olympia_tournaments` – nếu muốn group nhiều trận theo giải/kỳ.
9. `olympia_obstacles`
10. `olympia_obstacle_tiles`

## 6. Hướng triển khai tiếp theo

1. Chuẩn hoá chi tiết kiểu dữ liệu (enum hay text) cho từng cột, viết SQL `CREATE TABLE` tương ứng đưa vào `supabase/database-schema.sql`.
2. Viết SQL cho các bảng MVP + các bảng bổ sung: `buzzer_events`, `star_uses`, `obstacle_guesses`.
3. Thêm các policy RLS cơ bản cho các bảng mới, tham khảo pattern hiện tại trong Repo.
4. Tạo thư mục `lib/olympia/` để đặt:
  - `questions.ts` – query/CRUD `olympia_questions`.
  - `matches.ts` – tạo/truy vấn trận, gán players.
  - `rounds.ts` – thêm round, gán câu hỏi.
  - `scoring.ts` – tính điểm từ `olympia_answers` và cập nhật `olympia_match_scores`.
  - `buzzer.ts` – xử lý logic ai được quyền trả lời, resolve race conditions (dùng Supabase Realtime or server-side lock/transaction).
5. Thiết kế route group `(olympia)` trong `app/` và basic UI (host view, player view) dựa trên các bảng trên.

Nếu bạn đồng ý, bước tiếp theo mình sẽ sinh block SQL `CREATE TABLE` cho MVP mở rộng (kèm `buzzer_events`, `star_uses`, `obstacle_guesses`) để dán vào `supabase/database-schema.sql`.
