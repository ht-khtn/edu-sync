[HOÀN THÀNH]

Good — tớ đã gộp **toàn bộ plan trước đó** (Host / Participant / MC) và **luồng G (Projector/Guest)** thành **một tài liệu tổng hợp, đầy đủ & sẵn để dev**. Tớ giữ nguyên luật cậu cung cấp, host-driven realtime, và toàn bộ chi tiết UI + logic vận hành ở mức **logic-only** như cậu yêu cầu.

Dưới đây là **BẢN FINAL SPEC (Tiếng Việt)** — đọc nhanh, nếu ok tớ sẽ chuyển thành checklist task/AC để chuyển cho team dev.

# Tổng quan chung (nguyên tắc vận hành)

- **4 luồng:** Host (H) — điều phối; Participant (P) — thí sinh; MC — người dẫn/kiểm tra đáp án; Guest (G) — màn chiếu công khai (read-only).
- **Model điều khiển:** Host là nguồn điều khiển duy nhất (host-driven). Mọi chuyển trạng thái (show question, quyết định đúng/sai, chuyển câu, kết thúc vòng) phải qua Host và được broadcast realtime.
- **Realtime & thời gian:** Server authoritative timestamps; client hiển thị timer dự đoán nhưng final phụ thuộc event server. Đồng bộ start/stop timer khi H bấm Start/Pause.
- **Quy tắc điểm:** Bám đúng luật cậu đưa:
  - Khởi động: lượt cá nhân + lượt chung; trả lời đúng +10; sai (lượt chung) -5 (không âm).
  - CNV: hàng ngang +10; CNV correct: điểm = 60 − 10\*(rows opened) (tối đa ~70 theo hoàn cảnh) ; CNV sai → bị loại khỏi vòng.
  - Tăng tốc: 4 câu → điểm theo order: 40 / 30 / 20 / 10; đồng thời có thể chia điểm nếu timestamp bằng.
  - Về đích: câu 20/30; star (đặt trước) nhân đôi; cướp: trả lời đúng lấy điểm từ quỹ, sai → trừ 50% giá trị câu.

- **Audit & Undo:** Mọi sự kiện quan trọng (buzz, answer, host decision, score change, undo) được log. Cho phép Undo 1 bước (default) + manual score adjust (với lý do).
- **UI minimalist on P:** tập trung câu hỏi / buzzer / input / điểm cá nhân.
- **Host shortcuts** quan trọng để thao tác nhanh (xem bên dưới).

---

# Cấu trúc màn hình (tóm tắt)

- **Host (H)**
  Controls panel (left): Start/Stop Round, Show Question, Đúng, Sai, Xác nhận, Next, Undo, Pause;
  Preview (center): question payload (text/img/video), answer key (hidden to P/G), notes;
  Players panel (right): scoreboard, buzz order, eliminated flags;
  Event log (bottom): realtime event stream.

- **Participant (P)**
  Màn chờ → countdown → question screen; hiển thị: question (large), optional input box, `Buzz` button (nếu vòng cho phép), điểm cá nhân top-right, trạng thái (đang trả lời / khoá / eliminated).

- **MC**
  Full-info view: question + đáp án + lĩnh vực + notes + countdown; leaderboard & buzzer indicators; host decision pending hiển thị.

- **Guest / Projector (G)**
  Read-only: hiển thị question, countdown, ai buzz / đang trả lời, kết quả (ĐÚNG/SAI) sau khi H xác nhận, piece reveal (CNV), steal window, scorebars summary. (G UI: implement đồ họa sau; hiện tại basic renderer theo event contract).

---

# Events & hành vi chung (flow ngắn)

1. H bấm **Start Round** → server broadcast `ROUND_START` → sync timer.
2. H bấm **Show Question** → broadcast `QUESTION_SHOW`. P/MC/G hiển thị.
3. P tương tác (`BUZZ`, `ANSWER_SUBMIT`) → server ghi timestamp -> broadcast buzz/submit events.
4. H quyết định `Đúng`/`Sai` → bấm `Xác nhận` → server apply score rule → broadcast `DECISION_CONFIRMED` + update scoreboard.
5. H bấm `Next` → `QUESTION_SHOW` tiếp theo; lặp.
6. H có thể `Undo` last confirmed score change → create `UNDO` event (log giữ).
7. Tất cả event quan trọng ghi vào audit trail (match, round, question, event type, by, timestamps, payloads, điểm thay đổi).

---

# Detailed flow theo vòng (UI + logic cho H / P / MC / G)

> Lưu ý: mỗi phần gồm **Giao diện (các nút chính)** + **Logic thực thi**.

---

## Vòng 1 — Khởi động

### Lượt cá nhân (6 câu/người)

- **H**
  - Nút: `Bắt đầu lượt cá nhân`, `Show Question`, `Đúng`, `Sai`, `Xác nhận`, `Next`.
  - Preview đáp án & notes (không hiển thị cho P/G).

- **Logic H:** lần lượt P1→P4, mỗi câu: show → 5s timer → P trả lời (input) → H mark Đúng/Sai → Xác nhận → +10 nếu đúng; sai: no-change.
- **P**
  - Thấy câu + input; timer 5s; submit trước 5s ok.

- **MC**
  - Hiển thị full info + countdown.

- **G**
  - Show question + countdown; sau H confirm show ĐÚNG/SAI + animation; update scoreboard.

### Lượt chung (12 câu)

- **H**
  - Loop 12 câu. Broadcast each question.

- **Logic**
  - Khi show câu: P có `Buzz` button; server picks earliest buzz (timestamp authoritative). Winner gets 5s để trả lời. H xem đáp án trên preview và bấm Đúng/Sai.
  - Đúng: +10. Sai hoặc không trả lời trong 5s sau buzz: -5 (clamp >=0).
  - Nếu no buzz within allowed time after read: auto reveal (MC/H) — default: không show đáp án cho G (configurable).

- **P**
  - Buzz => lock others. If win, show input for 5s.

- **MC**
  - See answer, notes, countdown.

- **G**
  - Show who buzzed (overlay), then ĐÚNG/SAI after host confirm, adjust scoreboard.

---

## Vòng 2 — Vượt chướng ngại vật (CNV)

### UI

- **H**: Board of 4 rows + center box + image with 5 pieces; controls: `Chọn hàng ngang cho P`, `Open piece`, `Confirm row correct`, `Lock row`, `Confirm CNV correct`, `Confirm CNV wrong`.
- **P**: When their turn, see chosen row question + 15s input; global `Buzz CNV` always enabled (unless eliminated).
- **MC**: Full answers for all rows & CNV; pieces status.
- **G**: Board visual (rows hidden until opened), image pieces hidden until opened.

### Logic

1. **Row phase:** for i in 1..4: chosen player gets 15s → correct +10 & open associated image piece; wrong → lock row (no open).
2. **Center question:** after 4 rows show center question (15s) → correct +10 open center piece.
3. **Final CNV window (15s):** all players can `Buzz CNV` any time (even earlier) — earliest buzz timestamp wins; if correct:
   - Compute points: `points = 60 - 10*(rows_open_before_answer)` (this gives higher reward if answered early). Additionally, per rules there's mention of +20 in final stage — tớ giữ: if answered during final after opening center, may get +20 bonus if rules intended; implement as config `final_bonus` (default +20 only if center opened before and final answer).
   - If wrong: player **eliminated from CNV** (disable CNV actions).

4. If no valid CNV winner or all eliminated: audience/G may answer (skip).
5. All decisions confirmed by Host.

**G behavior:** reveal rows / open pieces when H triggers; show buzz CNV events; display eliminated players.

---

## Vòng 3 — Tăng tốc

### UI

- **H:** controls Q1→Q4; per-question window; response order table; `Assign points (auto)`; override.
- **P:** see content (image/video/data); input; submit timestamp recorded.
- **MC:** question type + answers + notes.
- **G:** show content large; show submitted order in real-time.

### Logic

- Q1: 20s (Nhìn-Đáp); Q2: 20s; Q3: 30s (IQ); Q4: 30s (Dữ kiện).
- During question window players submit; server records timestamps. After window end (or H Close), system sorts by timestamp and assigns points: fastest 40, next 30, 20, 10.
- If identical timestamps within threshold => tie: both receive same point value (rule-based).
- H can override assigned points (manual adjust).
- G shows the order & assigned points after assignment.

---

## Vòng 4 — Về đích

### UI

- **H:** For each player in descending score order: `Select package` (3 câu, 20 or 30 each), `Toggle Star (pre-set)`, `Show Question`, `Confirm`, `Allow steal`, `Undo`.
- **P (current):** show nothing (because at this time, player will move out off the computer and see on **G**). answers within time limit by mouth(20s for 20-pt, 30s for 30-pt).
- **Other P:** `Buzz to steal` (5s window after main player fails); steal-responder gets 3s to answer (or extended if it's practice question).
- **MC:** sees star status, answer key, notes.
- **G:** show current player name, question, star icon (configurable show/hide), steal overlay, result.

### Logic

1. Pre-question: current player may set `Star` (visible to H/MC; optionally visible on G).
2. Show question → timer per chosen value. If current answers correct → award points (double if Star used).
3. If current wrong/no answer → open steal window 5s for others. Earliest buzz among others wins steal right. Steal answering: if correct → steals points from the pool (i.e., gains question's value); if wrong → **penalty = 50% of question value**, applied per rule (clarify whether it subtracts from this player's score; default: subtract from cướp-er’s score). Host must confirm before heavy penalty applied (safety).
4. Update scoreboard. H can manually adjust after confirm.

---

# G (Guest / Projector) — summary & minimal contract

- **Vai trò:** Read-only public display for audience; show question, countdown, buzz, who answers, ĐÚNG/SAI (after H confirm), piece reveals, steal windows, eliminated flags, per-round score summary.
- **Không hiển thị:** đáp án chưa được H xác nhận (MC can view), internal notes, host controls.
- **Latency handling:** Render server events; show predicted timer but final only when server event arrives.

### Minimal events (server → clients, includes G)

- `ROUND_START {roundType, matchId, timestamp}`
- `QUESTION_SHOW {qId, payload, duration, timestamp}`
- `PLAYER_BUZZ {playerId, type: BUZZ|CNV|STEAL, timestamp}`
- `PLAYER_ANSWER_SUBMIT {playerId, payload, timestamp}` (optional to display submitted text)
- `DECISION_CONFIRMED {playerId, decision: CORRECT|WRONG, pointsDelta, newScore, timestamp}`
- `PLAYER_ELIMINATED {playerId, reason, timestamp}`
- `ROW_OPENED {rowIndex, revealedText, timestamp}`
- `PIECE_OPENED {pieceIndex, timestamp}`
- `ROUND_END {summaryScores, timestamp}`
- `UNDO {eventId, by, timestamp}`

G sẽ render 1:1 theo các event này.

---

# Undo / Override / Audit

- **Undo:** Host có thể Undo **1 bước** (last confirmed score change). Undo creates `UNDO` event (audit remains).
- **Manual adjust:** Host/Admin có modal `Adjust score` (reason required). Change recorded in audit.
- **Audit log:** persist every event: matchId, roundId, questionId, eventType, payload, actorId, serverTimestamp, pointsDelta, resulting scores, reason (if manual). Exportable CSV/JSON for replay.

---

# Keyboard shortcuts (Host) — default (configurable)

- `Space` : Xác nhận (Confirm)
- `D` : Mark Đúng
- `S` : Mark Sai
- `→` : Next question
- `←` : Prev question (view only)
- `U` : Undo last confirm
- `P` : Pause/Resume timer
- `B` : Simulate buzz (dev/test)
  (Shortcuts hiển thị trong Host UI; cho phép chỉnh trong settings.)

---

# Edge cases & defenses

- **Host disconnects:** freeze match; overlay “Host disconnected”. Allow admin takeover.
- **Latency/tie:** server authoritative timestamps; define tie threshold (e.g., ≤10ms) — if tie, both credited per rules (where allowed).
- **Score floor:** clamp displayed score ≥ 0 (internal negative allowed for audit only).
- **CNV elimination handling:** eliminate flag disables CNV/steal for that player for current round.
- **Accidental host action:** require `Confirm` step for destructive actions (apply points, elimination). Undo available.

---

# Tests & Acceptance Criteria

- **Unit tests** for scoring logic per round: Khởi động (individual/common), CNV (scoring + elimination), Tăng tốc (order/tie), Về đích (star, steal, penalty).
- **Integration/E2E tests** simulating a match (4 fake players) to assert event ordering, final scoreboard.
- **UI tests**: Host shortcuts, confirm flows, undo behaviour, disabled buttons on elimination.
- **Load test**: surge of buzz events to validate realtime handling & timestamp correctness.
- **Acceptance:** final scoreboard matches expected given sequence of events; audit log complete and replayable.

---

# Data to persist (DB fields / minimal)

- `match` (id, hostId, status, startedAt, endedAt)
- `round` (id, matchId, type, status, startedAt, endedAt)
- `question` (id, roundId, payloadRef, correctAnswerRef, durationConfig)
- `event` (id, matchId, roundId, questionId, type, actorId, payload, serverTimestamp) — event stream
- `score_change` (eventId, playerId, delta, newScore, reason)
- `player_status` (eliminatedFlags, starUsed, etc.)
  (Keep full event stream to enable replay & audit.)

---

# Next steps (practical, task-breakdown sẵn để assign)

1. **Implement rule engine module** (server-side) that computes points from events (unit-tested).
2. **Event contract & realtime channel** (WebSocket / Supabase Realtime): implement event types above.
3. **Host UI mockup** (priority) + keyboard-shortcuts support.
4. **Participant minimal UI** (buzzer, input, score).
5. **MC UI** (full info).
6. **G basic renderer** (consume events, render question, buzz, correct/wrong, opens) — visuals later.
7. **Audit & Undo**: logging + Undo endpoint + manual adjust modal.
8. **Tests**: unit/integration/E2E + load tests.

---

# Một vài câu hỏi nhanh để tớ finalize checklist dev-ready

1. Undo: tớ để default **1 bước** — có muốn tăng lên 3?
2. Penalty khi **steal sai**: tớ để mặc định **trừ 50% từ điểm hiện có của người cướp** (đây là cách an toàn). Cậu muốn thay bằng **trừ 50% của giá trị câu** (cụ thể số điểm) hay giữ như tớ để?
3. CNV final bonus: tớ làm flexible (config `final_bonus`) — mặc định bật +20 nếu center opened before final. Cậu confirm giữ hay bỏ?
   Trả lời mấy ý đó là tớ hoàn thiện checklist + acceptance criteria cụ thể để cậu chuyển cho dev.

---

Nếu ổn, tớ sẽ **chuyển bản này thành checklist task + AC** (task-level for frontend + backend + tests) để cậu assign — muốn tớ làm luôn không?

# Xử lý rớt mạng / reload

## Nguyên tắc

- Mọi client đều stateless
- Trạng thái nằm ở server

## Khi 1 người rớt (G/MC):

### Nếu reload lại:

1. Nhập lại mã phòng

2. Server gửi state hiện tại

3. Người đó quay lại đúng màn hình

## Nếu P rớt giữa câu:

- Nếu chưa submit → mất lượt

- Nếu đã submit → vẫn giữ kết quả

## Nếu H rớt:

- Game pause

- Khi H quay lại → resume
