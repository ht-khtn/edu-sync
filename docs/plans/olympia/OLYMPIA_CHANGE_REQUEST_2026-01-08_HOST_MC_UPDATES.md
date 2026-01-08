# Yêu cầu thay đổi Olympia — 2026-01-08 (Host/MC updates)

Tài liệu này phân tích 10 yêu cầu thay đổi (theo mô tả của bạn) và lập kế hoạch implement trực tiếp trong codebase hiện tại.

Nguồn luật tham chiếu: `docs/specific/olympia-rule.md`.
Schema tham chiếu: `docs/supabase/schemas/olympia-schema.sql`.

---

## 0) Hiện trạng liên quan (đã đối chiếu nhanh)

- Overlay Bảng điểm/Đáp án trên client đang render dạng fullscreen (`fixed inset-0`) trong `components/olympia/shared/game/OlympiaGameClient.tsx` và `components/olympia/shared/game/AnswersOverlay.tsx`.
- Host controls (radio “Câu hỏi/Màn chờ/Bảng điểm/Đáp án”) nằm ở `components/olympia/admin/matches/HostRoundControls.tsx`.
  - Hiện có hiện tượng “radio nhảy ngược lại” do state sync từ props trong lúc server action pending.
- Card “Câu trả lời” (host chấm nhanh từng thí sinh) là `components/olympia/admin/matches/HostLiveAnswersCard.tsx`.
  - Hiện mỗi click gửi action ngay.
- Chấm Tăng tốc hiện có action auto-score theo `submitted_at` của đáp án đúng: `autoScoreTangTocAction` trong `app/(olympia)/olympia/actions.ts`.
- Về đích: đã có UI chọn giá trị 20/30 cho từng câu (3 câu) ở host page, nhưng chưa có cơ chế “trộn đề theo gói” theo yêu cầu mới.

---

## 1) MC: Overlay chỉ hiển thị trong khung game

**Yêu cầu**: Khi host bật Bảng điểm/Đáp án, trên giao diện MC chỉ hiển thị trong khung game (không phủ toàn trang).

**Chỗ sửa dự kiến**:

- `components/olympia/shared/game/OlympiaGameClient.tsx`
- `components/olympia/shared/game/AnswersOverlay.tsx`

**Cách làm**:

- Với `viewerMode="mc"`: render overlay dạng `absolute inset-0` trong container của game (thay vì `fixed`).
- Giữ fullscreen cho player/guest để không đổi UX nơi khác.

**AC**:

- MC không bị overlay che sidebar/ngoài khung game.

---

## 2) Host: Toggle “Chấm cùng lúc” + nút “Chấm điểm” (batch)

**Yêu cầu**:

- Thêm toggle “Chấm cùng lúc” trên card chấm.
- Khi bật: click Đúng/Sai/Hết giờ chỉ “ghi nhớ” theo thứ tự click, không gửi action.
- Chỉ khi bấm “Chấm điểm” mới gửi batch.
- Bắt buộc bảo toàn thứ tự chấm trước/sau.

**Chỗ sửa dự kiến**:

- UI: `components/olympia/admin/matches/HostLiveAnswersCard.tsx`
- Props wrapper: `components/olympia/admin/matches/HostAnswersTabs.tsx`
- Server action batch: `app/(olympia)/olympia/actions.ts`

**Cách làm**:

- Trên client: lưu `pendingDecisionsByPlayerId` + `orderedPlayerIds` (order click). Mỗi lần click sẽ move id về cuối để phản ánh “chấm sau”.
- Nút “Chấm điểm” gọi server action mới, gửi danh sách theo thứ tự.

**AC**:

- Toggle OFF: hành vi cũ không đổi.
- Toggle ON: click không network; chỉ “Chấm điểm” mới network.
- Thứ tự click được giữ nguyên khi tính điểm Tăng tốc.

---

## 3) Tăng tốc: Chấm điểm theo thứ tự chấm (không tính sai)

**Yêu cầu**:

- Điểm 40/30/20/10 dựa trên thứ tự host chấm đúng.
- Bỏ qua câu sai (không trừ, không chiếm slot điểm).

**Chỗ sửa dự kiến**:

- Server action batch mới (ưu tiên) trong `app/(olympia)/olympia/actions.ts`.
- Cập nhật hint/UI liên quan ở `HostLiveAnswersCard.tsx`.

**Cách làm**:

- Với vòng `tang_toc`, batch action:
  - Update `answers.is_correct` theo quyết định.
  - Với các quyết định `correct`, gán lần lượt điểm 40→30→20→10 theo thứ tự xuất hiện trong batch (bỏ qua wrong/timeout).
  - Update `answers.points_awarded` và ghi `score_changes` + cập nhật `match_scores` qua `applyRoundDelta`.

**AC**:

- Ví dụ bạn đưa ra phải đúng: A đúng trước → 40; C sai → 0; B đúng sau → 30.

---

## 4) Overlay Đáp án: sắp xếp theo thời gian trả lời

**Yêu cầu**:

- Trong giao diện hiển thị Đáp án: sort theo thời gian trả lời (nhanh ở trên).
- Chưa xác định (null) ở dưới cùng.

**Chỗ sửa dự kiến**:

- `components/olympia/shared/game/AnswersOverlay.tsx`

**Cách làm**:

- Tạo danh sách player+answer, sort theo `response_time_ms` (null last), tie-break theo `submitted_at`/ghế.

---

## 5) Về đích: UI chọn gói 3 câu (20/30 mỗi câu) + trộn đề

### 5.0 UI

**Yêu cầu**: Mỗi thí sinh có 3 câu, mỗi câu chọn 20/30 độc lập; cần UI xác nhận gói để trộn đề.

**Chỗ sửa dự kiến**:

- Host page: `app/(olympia)/olympia/(admin)/admin/matches/[matchId]/host/page.tsx`

**Cách làm**:

- Giữ 3 dropdown (đang có) nhưng bổ sung một nút “Xác nhận gói & trộn đề” cho thí sinh đến lượt chọn.

### 5.1 Trộn đề theo luật

**Yêu cầu**:

- Câu đã chọn cho thí sinh này không xuất hiện cho thí sinh khác.
- Gói theo thứ tự: vd 20/30/30 → pick ngẫu nhiên 1 câu 20 + 2 câu 30.
- Chọn ngẫu nhiên (không cần theo thứ tự n).
- Khi xong, phần câu hỏi chỉ hiện 3 câu đã chọn (riêng thí sinh đó ở Về đích).

**Chỗ sửa dự kiến**:

- Server action mới trong `app/(olympia)/olympia/actions.ts`.
- Host filtering hiển thị danh sách câu Về đích theo `vdSeat` trong `host/page.tsx`.

**Cách làm (không đổi schema)**:

- Xem 3 “slot” của ghế = các `round_questions` có `meta.code` dạng `VD-{seat}.1..3`.
- Lấy pool câu từ `question_set_items` theo `code` prefix `VD-20.` và `VD-30.` (từ các question_set gắn với match qua `match_question_sets`).
- Tránh trùng lặp bằng cách loại các `question_set_item_id` đã được gán ở slots của các ghế khác.
- Update từng slot: set `question_set_item_id` = item được chọn; giữ nguyên `order_index` để đảm bảo thứ tự theo gói.

---

## 6) Fix: Về đích đã chọn thí sinh nhưng chấm vẫn báo “cần chọn thí sinh chính”

**Nguyên nhân dự kiến**:

- Host chọn thí sinh Về đích hiện chỉ set query param `vdSeat`, không set `round_questions.target_player_id` cho câu live/slots, nên `HostQuickScoreSection` không tìm được `enabledScoringPlayerId`.

**Chỗ sửa dự kiến**:

- `app/(olympia)/olympia/actions.ts` (`setRoundQuestionTargetPlayerAction`)
- `components/olympia/admin/matches/HostRoundControls.tsx`

**Cách làm**:

- Khi đang ở vòng `ve_dich` và host chọn thí sinh, action sẽ:
  - resolve `seat_index` của player,
  - gán `target_player_id` cho 3 slot `VD-{seat}.1..3` của round Về đích hiện tại.
- Như vòng Khởi động: chọn ghế xong là hệ thống “lock” target ngay.

---

## 7) Timer: tách khỏi chấm nhanh + timeout rules theo vòng

**Yêu cầu**: Bấm giờ/hết giờ là thao tác thủ công, nhưng logic hết giờ khác nhau theo vòng.

**Chỗ sửa dự kiến**:

- Host timer UI/logic: `components/olympia/admin/matches/HostQuickScoreSection.tsx` + `HostQuickScorePanel.tsx`
- Server actions: `startSessionTimerAction` (đã có) + bổ sung action “force timeout/lock input/advance” tuỳ vòng nếu cần.

**Cách làm**:

- Tính `durationMs` theo `olympia-rule.md`:
  - Khởi động: 5s.
  - VCNV hàng ngang/ô trung tâm: 15s.
  - Tăng tốc: 20s/20s/30s/30s theo thứ tự câu.
  - Về đích: 15s (20đ) / 20s (30đ) cho câu thường.
- Bổ sung hành vi “Hết giờ”:
  - KD thi riêng: timeout = sai (0) và chuyển câu (đã có via confirmDecisionAndAdvance).
  - KD thi chung: nếu chưa có winner → chỉ chuyển câu; nếu có winner → timeout = sai (-5, không âm) và chuyển.
  - VCNV/Tăng tốc: timeout = khoá input (đưa deadline về quá khứ).
  - Về đích: timeout = sai.

---

## 8) Rà soát điểm cộng/trừ theo `olympia-rule.md`

**Chỗ rà soát**:

- `lib/olympia-scoring.ts`
- Các nhánh xử lý trong `app/(olympia)/olympia/actions.ts` (confirmDecisionAction, confirmVcnvRowDecision, ve_dich steal/main, khoi_dong common).

**Mục tiêu**:

- Đồng bộ các rule: KD chung sai/timeout -5 không âm; các vòng khác không trừ trừ khi luật nêu.

---

## 9) Fix radio bị nhảy về “Đáp án” + auto về “Câu hỏi” khi Show

**Nguyên nhân dự kiến**:

- `HostRoundControls` đang sync `answersChecked` từ props trong lúc action toggle pending → state bị revert.

**Chỗ sửa dự kiến**:

- `components/olympia/admin/matches/HostRoundControls.tsx`
- `app/(olympia)/olympia/actions.ts` (`setCurrentQuestionAction`)

**Cách làm**:

- Khi pending toggle, tạm không sync state từ props.
- Khi `setCurrentQuestionAction` chạy: luôn set `show_scoreboard_overlay=false` và `show_answers_overlay=false` để auto về “Câu hỏi”.

---

## 10) Tối ưu realtime chậm (không đổi logic vòng)

**Chỗ sửa dự kiến**:

- `components/olympia/shared/game/AnswersOverlay.tsx`
- `components/olympia/admin/matches/HostLiveAnswersCard.tsx`
- `components/olympia/admin/matches/HostQuickScoreSection.tsx`
- `components/olympia/admin/matches/HostRoundControls.tsx`

**Cách làm (an toàn, không đổi flow)**:

- Giảm/loại `router.refresh()` ở các toggle overlay nếu không cần.
- Giảm polling khi có realtime; debounce refresh.
- Chỉ poll khi tab visible.

---

## Checklist triển khai

- [ ] Implement (1) overlay embedded cho MC.
- [ ] Implement (2)(3) batch chấm + scoring Tăng tốc theo thứ tự chấm.
- [ ] Implement (4) sort overlay đáp án theo response time.
- [ ] Implement (5)(5.1) UI chọn gói + trộn đề Về đích.
- [ ] Implement (6) fix chọn thí sinh Về đích để enable chấm.
- [ ] Implement (7) timer per vòng + timeout behavior.
- [ ] Implement (8) rà soát điểm cộng/trừ.
- [ ] Implement (9) fix radio + auto về Câu hỏi khi show.
- [ ] Implement (10) tối ưu realtime (không đổi logic vòng).
