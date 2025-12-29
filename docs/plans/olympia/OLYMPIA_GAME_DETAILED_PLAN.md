# Kế hoạch triển khai Olympia Game (Host/Participant/MC/Guest)

Tài liệu này chuyển **spec runtime** trong [docs/specific/olympia-game.md](../../specific/olympia-game.md) thành **kế hoạch triển khai chi tiết + checklist task + Acceptance Criteria (AC)** để đội dev có thể làm theo.

## 0) Mục tiêu

- Xây dựng trải nghiệm **host-driven realtime** cho 4 luồng: **Host (H)**, **Participant (P)**, **MC**, **Guest/Projector (G)**.
- Server là nguồn chân lý (authoritative): **timestamps, winner buzz, chấm điểm**.
- Có khả năng **Undo**, **audit log**, và **manual score adjust có lý do** (theo spec; có thể theo pha).

## 1) Phạm vi & nguyên tắc

### Trong phạm vi

- Runtime cho 4 vòng: **Khởi động**, **CNV**, **Tăng tốc**, **Về đích**.
- Realtime sync qua Supabase Realtime (Postgres changes) + server actions.
- Tối thiểu phải chạy end-to-end được một trận: Host điều khiển câu hỏi, P buzz/submit, Host confirm, G render.

### Ngoài phạm vi (không chặn MVP)

- Đồ hoạ “show TV” nâng cao cho G (để sau).
- Replay UI hoàn chỉnh (chỉ cần audit đủ để tái hiện).

## 2) Hiện trạng (đã kiểm tra nhanh)

### Tables chính (schema hiện có)

Nguồn: [docs/supabase/migrations/20241202090000_olympia_schema.sql](../../supabase/migrations/20241202090000_olympia_schema.sql)

- `olympia.live_sessions`: trạng thái hiển thị câu hỏi (`question_state`), `current_round_*`, `timer_deadline`, `status`.
- `olympia.match_rounds`, `olympia.round_questions`: cấu hình vòng và thứ tự câu.
- `olympia.buzzer_events`: log buzz theo `round_question_id`, `occurred_at`.
- `olympia.answers`: lưu câu trả lời, `is_correct`, `points_awarded`, `response_time_ms`.
- `olympia.match_scores`: điểm theo (match, player, round_type) với cột `points`.
- CNV: `olympia.obstacles`, `olympia.obstacle_tiles`, `olympia.obstacle_guesses`.

### Password / verification

- Thêm cột password vào session: [docs/supabase/migrations/20241225120000_add_passwords_to_live_sessions.sql](../../supabase/migrations/20241225120000_add_passwords_to_live_sessions.sql)
- Persist verification: [docs/supabase/migrations/20241225130000_add_session_verifications.sql](../../supabase/migrations/20241225130000_add_session_verifications.sql)

### Code realtime hiện tại

- Game state subscribe DB changes: [components/olympia/shared/game/useOlympiaGameState.ts](../../../components/olympia/shared/game/useOlympiaGameState.ts)
- Lưu ý kỹ thuật:
  - `useOlympiaGameState` đang subscribe `live_sessions`, `round_questions`, `match_scores`, `buzzer_events`.
  - `OlympiaRealtimeListener` đang filter theo `live_sessions.is_active` (schema không có cột này) → cần sửa/loại filter.

### Mismatch cần chốt sớm

- Schema `match_scores.points` nhưng type đang dùng `total_score` trong [types/olympia/game.ts](../../../types/olympia/game.ts) → cần chuẩn hoá.
- Schema `participants.role` chỉ allow `'AD'` hoặc null; MC hiện đang là “view mode có password”, không nhất thiết là role DB.

## 3) Chiến lược triển khai (khuyến nghị)

### Khuyến nghị theo pha

- **P0 (MVP nhanh, ít rủi ro):** dùng các bảng hiện có như “event bus” tối thiểu:
  - `live_sessions` là **state machine**
  - `buzzer_events` + `answers` là **append-only log** cho buzz/submit
  - `match_scores` là **materialized score**
- **P1/P2 (chuẩn spec audit/replay):** thêm `olympia.match_events` (event stream chuẩn) + `olympia.score_changes` để audit/undo/replay sạch.

Lý do: repo hiện đã có realtime listener theo DB row changes; làm P0 sẽ nhanh có bản chạy demo. Sau đó nâng cấp event stream không phá UX.

## 4) Mapping “events spec” → data/state hiện tại

| Spec event                  | Nguồn dữ liệu đề xuất (P0)                                                                         | Ghi chú             |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- | -------------------------- | --- | ------ | ---------------------- |
| `ROUND_START`               | update `live_sessions.current_round_*`, `status`, clear `timer_deadline`                           | do Host trigger     |
| `QUESTION_SHOW`             | update `live_sessions.current_round_question_id`, `question_state='showing'`, set `timer_deadline` | server set deadline |
| `PLAYER_BUZZ`               | insert `buzzer_events` (`event_type`: `buzz                                                        | cnv                 | steal`, `result`: `pending | win | lose`) | winner do server quyết |
| `PLAYER_ANSWER_SUBMIT`      | insert `answers` (hoặc update `answers.answer_text`) + `response_time_ms`                          | timestamp server    |
| `DECISION_CONFIRMED`        | update `answers.is_correct`, `answers.points_awarded` + update `match_scores.points`               | Host confirm        |
| `PLAYER_ELIMINATED`         | update `match_players.is_disqualified_obstacle` (CNV) +/or log event                               | CNV spec            |
| `ROW_OPENED`/`PIECE_OPENED` | update `obstacle_tiles.is_open` + meta                                                             | render board        |
| `UNDO`                      | P0: log `buzzer_events(event_type='undo')` + revert last adjudication                              | P1/P2: event stream |
| `ROUND_END`                 | update `live_sessions` + summary snapshot                                                          | optional            |

## 5) Milestones & checklist (task + AC)

### P0 — MVP (chạy được vòng Khởi động – lượt chung)

Mục tiêu: Host show câu, P buzz, Host confirm đúng/sai/timeout, scoreboard update realtime, G render được.

#### P0.1 DB/Schema alignment

- Task: Chuẩn hoá type `ScoreRow` dùng `points` thay vì `total_score` và đồng bộ code đọc/ghi.
  - Files: [types/olympia/game.ts](../../../types/olympia/game.ts), các nơi query `match_scores`.
- Task: Sửa realtime filter `is_active` trong [components/olympia/shared/OlympiaRealtimeListener.tsx](../../../components/olympia/shared/OlympiaRealtimeListener.tsx) (schema không có cột này).

**AC**

- Không còn runtime lỗi query do sai tên cột/filter.
- `match_scores` hiển thị đúng trong client khi cập nhật.

#### P0.2 Backend: host-driven buzz adjudication + scoring (Khởi động – chung)

- Task: Implement server action `submitBuzzerResponse`:
  - Chỉ nhận buzz khi `live_sessions.question_state='showing'` và đúng `round_question_id`.
  - Xác định winner theo `occurred_at` (server time) hoặc `now()` tại insert (an toàn hơn: insert và chọn MIN timestamp).
  - Ghi `buzzer_events.result='win'` cho winner, `'lose'` cho others.
- Task: Implement `submitAnswer`:
  - Ghi `answers` với `response_time_ms`.
- Task: Implement `confirmDecision` (mới): Host chọn `CORRECT|WRONG|TIMEOUT` và hệ thống áp điểm:
  - Correct: +10
  - Wrong/Timeout: -5 (clamp không âm trên điểm tổng)
  - Update `answers.is_correct`, `points_awarded` và `match_scores.points`.

**AC**

- 4 client bấm buzz gần nhau: chỉ 1 người có trạng thái “win”.
- Host confirm “Sai” thì điểm bị trừ nhưng không xuống âm.
- G và P thấy scoreboard & buzzer feed realtime mà không refresh.

#### P0.3 Frontend Host

- Task: Bổ sung UI cho Host:
  - `Show Question` (set `question_state='showing'`, `timer_deadline`), `Đúng`, `Sai`, `Xác nhận`, `Next`, `Pause`.
  - Hiển thị “buzzer winner” và pending decision.

**AC**

- Host thực hiện được flow 1 câu từ show → buzz → confirm → next.

#### P0.4 Frontend Guest (G)

- Task: Render read-only:
  - question_state, timerLabel, winner buzz, kết quả đúng/sai sau confirm, scoreboard.

**AC**

- Mở link guest và thấy realtime đúng theo thao tác Host.

---

### P1 — Hoàn thiện đủ 4 vòng + MC view

#### P1.1 Khởi động – lượt cá nhân

- Task: `round_questions.target_player_id` điều khiển lượt; disable buzz; chỉ target được submit.
- AC: Chỉ người được gọi mới có input active; người khác chỉ xem.

#### P1.2 CNV (Vượt chướng ngại vật)

- Task: Dùng `obstacles` + `obstacle_tiles` + `obstacle_guesses`:
  - Row correct: +10 và mở tile + mở piece (gắn với tile)
  - CNV guess: tính điểm `60 - 10*(rows_opened_before_answer)`; sai → set `match_players.is_disqualified_obstacle=true`.
- AC: Mở tile/piece realtime; player bị loại không thể guess CNV.

#### P1.3 Tăng tốc

- Task: Thu thập submissions trong window; sắp xếp theo timestamp; assign 40/30/20/10; tie theo threshold.
- AC: 2 người submit trong ngưỡng tie → chia điểm theo luật (cần decision threshold).

#### P1.4 Về đích

- Task: Star uses (`star_uses`), steal buzz, penalty 50% value (cần decision trừ vào ai).
- AC: Star nhân đôi đúng 1 câu; steal window chỉ cho người khác; penalty áp đúng.

#### P1.5 MC view

- Task: Fix luồng password MC và render full-info (question + answer + notes).
- AC: MC vào được bằng password; P/G không thấy đáp án.

---

### P2 — Audit/Undo/Override đúng spec

- Task: Thêm bảng `olympia.match_events` (append-only) + `olympia.score_changes`.
- Task: Undo 1 bước (hoặc N bước) dựa trên `score_changes`.
- Task: Manual adjust có “reason required”.

**AC**

- Undo trả scoreboard về trạng thái trước confirm; audit giữ đủ lịch sử.
- Export audit ra CSV/JSON có thể replay.

---

### P3 — Test & chất lượng

- Unit tests rule engine (tách module tính điểm):
  - Khởi động (đúng +10, sai -5 clamp)
  - CNV (điểm theo rows opened, elimination)
  - Tăng tốc (order + tie)
  - Về đích (star/steal/penalty)
- Integration test: mô phỏng match 4 người, assert scoreboard cuối.

**AC**

- Có test cover các case quan trọng; regression dễ phát hiện.

## 6) Decision log (cần chốt trước khi build P1/P2)

1. Undo: mặc định 1 bước hay 3 bước?
2. Steal sai: trừ 50% “giá trị câu” trừ vào **người cướp** hay cơ chế khác?
3. CNV final bonus +20: bật/tắt, áp trong trường hợp nào?
4. Tie threshold Tăng tốc: ≤ bao nhiêu ms coi là tie?
5. No-buzz trong Khởi động chung: G có reveal đáp án không (config)?

## 7) Rủi ro & giảm thiểu

- Rủi ro: logic game phân tán giữa FE/BE → Giảm: đưa rule engine vào server/module, FE chỉ render state.
- Rủi ro: realtime filter sai schema (ví dụ `is_active`) → Giảm: audit tất cả `filter` dựa trên migration.
- Rủi ro: tranh chấp buzz (race) → Giảm: server-authoritative timestamp + unique adjudication per question.

## 8) Định nghĩa “Done” (tổng)

- Host điều khiển được 4 vòng theo luật.
- P/MC/G sync realtime ổn định.
- Score đúng, có audit, undo, manual adjust.
- Có test rule engine + integration.
