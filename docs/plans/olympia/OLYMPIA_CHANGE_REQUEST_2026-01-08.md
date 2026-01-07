# Yêu cầu thay đổi Olympia — 2026-01-08

Tài liệu phân tích và đặc tả chi tiết cho 5 yêu cầu mới. Không triển khai code trong bước này; chỉ chuẩn hoá phạm vi, AC, và tác động hệ thống để đội dev thực hiện ở pha tiếp theo.

Nguồn luật và bối cảnh tham chiếu:

- docs/specific/olympia-game.md (FINAL SPEC tổng)
- docs/plans/olympia/OLYMPIA_GAME_DETAILED_PLAN.md (mapping event/state)
- docs/plans/olympia/VCNV_GAME_UI_PLAN.md (UI CNV)

---

## 1) VCNV — Trả lời đúng CNV → mở toàn bộ ô chữ + lật toàn bộ miếng che

- Yêu cầu nghiệp vụ:
  - Hiện tại đã có cơ chế khoá thí sinh nếu đoán CNV sai (eliminate trong vòng CNV).
  - Bổ sung: Khi thí sinh đoán CNV ĐÚNG (được Host xác nhận), hệ thống:
    - Mở tất cả hàng chữ (reveal full letters cho 4 hàng, bỏ dấu cách).
    - Lật toàn bộ 5 miếng che trên ảnh (bao gồm cả miếng trung tâm nếu chưa lật).

- Tác động state/events (không đổi schema):
  - Khi Host confirm đúng CNV: phát các event theo thứ tự an toàn để mọi client sync:
    1. `DECISION_CONFIRMED {playerId, decision: CORRECT, pointsDelta, ...}`
    2. Lần lượt `ROW_OPENED {rowIndex, revealedText}` cho các hàng chưa mở.
    3. Lần lượt `PIECE_OPENED {pieceIndex}` cho tất cả miếng chưa mở (0..4).
  - Guest/Participant/MC render ngay theo event; Host UI cũng phản chiếu.

- Điểm số (tham chiếu luật):
  - Điểm CNV đúng: `points = 60 - 10*(rows_open_before_answer)` (tham chiếu olympia-game.md). Nếu có cấu hình bonus cuối (+20) thì áp theo config hiện hành.

- Acceptance Criteria (AC):
  - Sau khi Host confirm đúng CNV, tất cả hàng chữ hiển thị full chữ cái; ảnh nền hiển thị không còn che.
  - Không phát sinh thêm thao tác tay để mở hàng/miếng sau confirm.
  - Scoreboard cập nhật điểm CNV theo luật.
  - Trạng thái loại CNV của người chơi khác giữ nguyên (chỉ người đã bị loại không thể thao tác CNV).

- Edge cases:
  - Nếu trước đó đã mở một phần hàng/miếng: hệ thống chỉ mở phần còn lại.
  - Undo bước confirm phải đưa UI về trạng thái trước khi mở hàng/miếng (tham chiếu event/undo ở spec).

---

## 2) Giao diện mới “Đáp án” (chỉ cho VCNV và Tăng tốc)

- Vị trí: Tab bên cạnh “Câu hỏi” / “Màn chờ” / “Bảng điểm”. Thêm tab “Đáp án”.
- Điều kiện hiển thị controls:
  - Chỉ khi `currentRound` ∈ {`vcnv`, `tangtoc`} thì mới hiển thị nhóm radio/controls liên quan.
- Nội dung hiển thị:
  - Bảng 4 thí sinh (giống bố cục “Bảng điểm”) nhưng hiển thị thêm:
    - Nội dung đáp án đã nộp (nếu vòng cho phép hiển thị; MC/Host luôn thấy full, P/G có thể ẩn theo role).
    - `response_time_ms`: thời gian trả lời tính từ thời điểm Host bấm “Show Question” đến thời điểm submit/ghi nhận server.
  - Nhóm radio (per-player) dùng cho thao tác chấm/confirm nhanh trong 2 vòng này (đồng bộ với panel chấm hiện có).

- Dữ liệu và tính toán thời gian:
  - Nguồn `response_time_ms` lấy từ server khi insert `answers` (đã có trường). Nếu thiếu, tính: `now() - question_show_timestamp` (server-side) khi nhận submit để đảm bảo authoritative.

- AC:
  - Khi đang ở VCNV hoặc Tăng tốc, tab “Đáp án” xuất hiện; ngoài 2 vòng này tab vẫn hiển thị nhưng controls radio bị ẩn/disabled theo yêu cầu (“chỉ hiện radio khi…vcnv/tt”).
  - Hiển thị 4 dòng thí sinh với đáp án và thời gian trả lời chuẩn xác (đồng bộ nhiều client).
  - Thao tác chấm qua radio tương thích hoàn toàn với luồng chấm hiện có (không tạo cơ chế chấm mới tách biệt).

- Edge cases:
  - Người chơi chưa nộp đáp án: hiện trạng thái “Chưa nộp”.
  - Nhiều lần submit (nếu cho phép): hiển thị lần hợp lệ theo luật (mặc định lấy lần đầu trong Tăng tốc; VCNV: tuỳ màn). Quy định cụ thể sẽ mirror từ spec hiện hành.

---

## 3) Tăng tốc — Mặc định bật chấm mỗi câu; chấm ai thì disable người đó; reset mỗi câu. Điểm theo thời gian

- Trạng thái hiện tại: chấm đang bị disable dù đã show câu.
- Yêu cầu thay đổi:
  - Khi Host chuyển/hiển thị câu mới trong vòng Tăng tốc → trạng thái chấm (enable) mặc định mở cho tất cả thí sinh.
  - Khi Host chấm (confirm) cho 1 thí sinh xong → disable tiếp nhận/chấm thêm cho thí sinh đó ở câu hiện tại (không ảnh hưởng người khác).
  - Khi chuyển sang câu tiếp theo → reset enable chấm cho tất cả thí sinh.
- Điểm số theo luật Tăng tốc (tham chiếu olympia-game.md):
  - Xếp theo thời gian submit (server timestamp) để gán điểm: 40 / 30 / 20 / 10.
  - Nếu tie trong ngưỡng cho phép → chia điểm theo luật hiện hành (cần đọc ngưỡng tie từ config/spec, mặc định ≤10ms).

- AC:
  - Mỗi câu bắt đầu: tất cả thí sinh đều ở trạng thái có thể được chấm.
  - Sau khi chấm 1 người: người đó bị disable chấm tiếp cho câu hiện tại (trạng thái UI phản ánh rõ ràng).
  - Chuyển câu: toàn bộ trạng thái chấm được reset về enable.
  - Điểm được áp theo thứ tự thời gian; trường hợp tie xử lý đúng.

- Gợi ý kỹ thuật:
  - Khi `QUESTION_SHOW` (Tăng tốc) → init state `adjudicationEnabled[playerId]=true`.
  - Khi `DECISION_CONFIRMED` → set `adjudicationEnabled[playerId]=false` cho câu hiện tại.
  - Khi `QUESTION_SHOW` câu kế → reset map.

---

## 4) Vòng 4 — Chọn thí sinh trước rồi mới chọn câu; chọn gói 3 câu bằng dropdown; cơ chế “Bấm chuông” giành trả lời

- Luồng chọn:
  - Giống vòng 1: Host chọn thí sinh thi trước, sau đó mới chọn câu.
  - Chọn gói gồm 3 câu (20/30). UI thay nút hiện tại bằng 3 dropdown gồm 2 lựa chọn (20/30) tương ứng 3 câu trong gói.
  - Khi Host chọn từng dropdown (1 → 2 → 3): trên Guest lần lượt xuất hiện số tượng trưng cho gói câu hỏi đã được “xếp vào hàng” (1 cái, rồi 2 cái, rồi đủ 3 cái).

- Hỏi/Đáp và chấm nhanh + cướp (steal):
  - Sau khi chọn thí sinh và show câu → bật “Action chấm nhanh” cho thí sinh đó.
  - Nếu Host bật công tắc “Bấm chuông” (steal window) → các thí sinh khác có quyền bấm chuông để giành trả lời; ngay lúc này, thí sinh đang thi bị coi là mất lượt cho câu hiện tại → action chấm nhanh của họ bị disable.
  - Khi có người bấm chuông: áp “chấm nhanh” cho người đó (flow xác nhận Đúng/Sai quen thuộc).
  - Chuyển câu hỏi trong gói: reset toàn bộ trạng thái về ban đầu (bao gồm disable/enable của chấm nhanh và trạng thái chuông). Đồng bộ “chấm bình thường” để khớp với UI khác.

- Điểm & thời gian (tham chiếu luật):
  - Câu 20 điểm: 20s; câu 30 điểm: 30s (Host start mới chạy timer).
  - Cướp sai: penalty 50% giá trị câu trừ vào người cướp (theo spec mặc định; nếu dự án đang cấu hình khác, giữ đúng config hiện hành).

- AC:
  - UI bắt buộc chọn thí sinh trước thì mới cho phép chọn câu.
  - Dropdown cho gói 3 câu, chọn dần hiển thị đúng số chỉ báo trên Guest theo thứ tự chọn.
  - Toggle “Bấm chuông” mở cửa sổ cướp cho người khác; disable chấm nhanh của thí sinh đang thi ngay khi bật.
  - Khi có người cướp: thực hiện chấm nhanh cho người đó; confirm cập nhật điểm/penalty đúng luật.
  - Chuyển sang câu khác trong gói: trạng thái UI/logic reset đầy đủ.

- Gợi ý kỹ thuật:
  - Model hoá `stealWindowActive` trong state câu hiện tại; `currentPlayerId` và `adjudicationEnabled` cập nhật theo toggle.
  - Event `PLAYER_BUZZ {type: 'STEAL'}` dành riêng cho cướp; server chọn earliest among non-current players.

---

## 5) Đồng hồ client KHÔNG tự động chạy — chỉ chạy khi Host bấm hẹn giờ (per-round duration)

- Thay đổi hành vi:
  - Client (P/G/MC) không tự start timer khi nhận `QUESTION_SHOW` nữa.
  - Timer chỉ chạy khi Host bấm “Hẹn giờ/Start” → server phát event (hoặc set `timer_deadline`) để các client bắt đầu đếm lùi.
  - Pause/Resume chỉ khi Host thao tác.

- Thời lượng tham chiếu (olympia-game.md):
  - Khởi động: lượt cá nhân 5s; lượt chung: 5s sau buzz winner.
  - CNV: hàng ngang 15s; câu trung tâm 15s; final CNV window 15s.
  - Tăng tốc: Q1 20s, Q2 20s, Q3 30s, Q4 30s.
  - Về đích: câu 20đ → 20s, 30đ → 30s; cướp: 5s cửa sổ buzz, 3s trả lời (tuỳ config).

- AC:
  - Không có client nào tự chạy timer khi chỉ mới `QUESTION_SHOW`.
  - Chỉ sau khi Host bấm Start, tất cả client bắt đầu đếm lùi đồng bộ (dựa trên `timer_deadline` server).
  - Pause/Resume phản ánh đúng trên mọi client.

---

## 6) Ảnh hưởng tới DB, API, Realtime

- DB: Không yêu cầu thêm bảng/cột mới cho 5 thay đổi này (dựa trên schema hiện có: `live_sessions`, `answers`, `buzzer_events`, `match_scores`, `round_questions`).
- API/server actions:
  - Có thể cần bổ sung endpoint/handler tiện dụng để phát hàng loạt `ROW_OPENED`/`PIECE_OPENED` sau confirm CNV đúng (đảm bảo atomicity hoặc transactional publish).
  - Đảm bảo `answers.response_time_ms` luôn được set server-side khi nhận submit để giao diện “Đáp án” không lệ thuộc client clock.
- Realtime/state:
  - Bổ sung/kiểm tra flags: `adjudicationEnabled`, `stealWindowActive`, reset per-question (Tăng tốc, Về đích).

---

## 7) Test kế hoạch (tối thiểu)

- Unit (rule engine):
  - CNV: confirm đúng → mở đầy đủ hàng/miếng; điểm = 60 - 10\*k; sai → eliminate.
  - Tăng tốc: sort theo submit ts → 40/30/20/10; tie threshold.
  - Về đích: toggle chuông, cướp đúng/sa i với penalty 50% giá trị câu; reset per-question.
- Integration:
  - Host thao tác confirm đúng CNV → Guest/Participant mở đầy đủ ngay.
  - Tăng tốc: 4 người submit; chấm từng người → disable theo người; next → reset.
  - Về đích: chọn gói qua dropdown (1→2→3) → Guest hiện đủ chỉ báo; bật chuông → người khác buzz; chấm nhanh đúng flow.
- UI:
  - Tab “Đáp án” xuất hiện đúng điều kiện; hiển thị đáp án + thời gian; radio hoạt động và đồng bộ với panel chấm.
- Timer:
  - Không auto-run; chỉ chạy khi Host start; pause/resume đồng bộ.

---

## 8) Open questions (cần xác nhận trước khi implement)

1. Ngưỡng tie ở Tăng tốc (ms) hiện cấu hình bao nhiêu? Nếu chưa có, đề xuất mặc định 10ms.
2. Bonus thêm ở CNV (sau khi mở trung tâm) có đang bật trong hệ thống không? Nếu bật, giá trị bao nhiêu (+20?)
3. Về đích: hiển thị chỉ báo gói trên Guest — số/biểu tượng cụ thể như thế nào (1–3 hay icon tuỳ chỉnh)?
4. Về đích: penalty cướp sai hiện đang áp “50% giá trị câu” trừ vào người cướp — xác nhận giữ nguyên cấu hình?

---

## 9) Checklist triển khai (frontend/backend/test)

- FE Host:
  - Tab “Đáp án” (VCNV/TT), radio chấm synced, hiển thị response time.
  - Tăng tốc: enable chấm mặc định; disable per-player sau confirm; reset next.
  - Về đích: chọn thí sinh → dropdown gói (3 câu) → chỉ báo Guest; toggle “Bấm chuông”.
  - CNV đúng → trigger mở tất cả hàng/miếng.
  - Timer: chỉ chạy khi Host start; pause/resume.
- FE Participant/Guest/MC:
  - Render mở hàng/miếng đồng bộ; render chỉ báo gói trên Guest; Đáp án view (role-based visibility).
- BE/Actions:
  - Confirm CNV đúng → phát `ROW_OPENED`/`PIECE_OPENED` hàng loạt.
  - Ghi `response_time_ms` authoritative khi nhận submit.
  - State flags: `stealWindowActive`, `adjudicationEnabled` per-question.
- Tests: unit + integration như phần 7.

---

## 10) Không làm trong pha này

- Không thay đổi schema DB.
- Không làm đồ hoạ nâng cao cho Guest ngoài các chỉ báo/overlay cần thiết.
- Không thay đổi luật điểm ngoài nội dung đã nêu.
