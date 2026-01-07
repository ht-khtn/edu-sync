# Kế hoạch UI VCNV (Game) — CNV Screen

## Phạm vi

- Chỉ áp dụng cho **phần game** (màn hình chiếu), **không có tương tác click/hover**.
- Chỉ áp dụng khi ở **vòng VCNV** và **đang show câu hỏi CNV**.
- Không thêm page/modal/animation ngoài yêu cầu.

## Mục tiêu UX

- Khi host show câu CNV, game hiển thị:
  - **Khung 1**: 1 ảnh nền lớn + overlay 5 ô ghép thành 1 khối.
  - **Khung 2**: bảng chướng ngại vật bên phải, hiển thị 4 hàng ký tự (tự tạo số ô theo đáp án từng hàng).

## Dữ liệu cần dùng (mapping)

- Background image:
  - Đây chính là **hình ảnh của câu CNV** (câu đang được show trong vòng VCNV).
  - Lấy từ nguồn câu hỏi chung mà các vòng khác dùng chung (ưu tiên theo thứ tự):
    - `question_set_items.image_url`
    - `questions.image_url`
- 4 hàng ô chữ (tương ứng 4 câu VCNV):
  - Lấy từ danh sách `round_questions` của vòng VCNV hiện tại.
  - Xác định 4 câu hàng ngang bằng `code`/`meta.code` theo quy ước `VCNV-1`, `VCNV-2`, `VCNV-3`, `VCNV-4` (hoặc mapping tương đương đang có trong hệ thống).
  - Nội dung để tạo ô chữ cho từng hàng lấy từ `answer_text` của câu đó (ưu tiên theo thứ tự):
    - `round_questions.answer_text`
    - fallback `question_set_items.answer_text` hoặc `questions.answer_text` (nếu app đang join sẵn)
  - Tạo số ô tròn bằng cách:
    - `letters = answerText` sau khi **loại bỏ dấu cách** (không render dấu cách)
    - Mỗi ký tự trong `letters` → 1 hình tròn
  - Hiển thị chữ cái in hoa khi hàng “Đã mở”.
- Trạng thái mở/chưa mở (không dùng obstacle_tiles):
  - “Đã mở” khi câu hàng ngang tương ứng đã được host mở/đã có kết quả.
  - Nguồn trạng thái mở đề xuất (ưu tiên theo khả năng dữ liệu hiện có ở game state):
    1. Có ít nhất 1 bản ghi `answers` cho `round_question_id` của hàng đó với `is_correct != null`.
    2. Nếu chưa đủ dữ liệu answers, cần thêm 1 tín hiệu mở hàng ngang (ví dụ từ live session meta) — phần này chỉ ghi nhận trong kế hoạch, **chưa thực hiện**.

## Yêu cầu phía Host (để game hiển thị đúng & realtime)

> Mục tiêu của phần này là đảm bảo **host tạo ra đủ dữ liệu + tín hiệu** để game render UI VCNV mới, và mọi thay đổi quan trọng **cập nhật ngay** (không cần tải lại).

### 1) Chuẩn hoá cách phân loại câu VCNV

- Host cần hiển thị/kiểm soát được code của câu trong vòng VCNV để tránh chọn nhầm:
  - 4 câu hàng ngang: `VCNV-1`, `VCNV-2`, `VCNV-3`, `VCNV-4` (xác định theo `meta.code` ưu tiên; fallback `question_set_items.code`/`questions.code` nếu hệ thống đang dùng).
  - Câu CNV (ảnh nền bị che): code `CNV...` (cụ thể theo quy ước hiện có).
- Khi thao tác “Show câu”, host cần đảm bảo đang show đúng **câu CNV** (có `image_url`) để làm background.

### 2) Tín hiệu “mở hàng” (reveal) cho 4 hàng VCNV

- Vì không dùng `obstacle_tiles`, host cần tạo tín hiệu reveal theo dữ liệu sẵn có.
- Cách đơn giản nhất (khuyến nghị) để game suy ra “đã mở”:
  - Khi host chấm cho câu `VCNV-x`, hệ thống ghi `answers` cho `round_question_id` đó với `is_correct != null`.
  - Game coi hàng `x` là “Đã mở” và render chữ theo `answer_text` (bỏ dấu cách).
- Nếu nghiệp vụ thực tế cần “mở hàng” mà chưa muốn chấm:
  - Cần thêm 1 nguồn state riêng (ví dụ `live_sessions.meta` hoặc 1 bảng trạng thái) để đánh dấu hàng đã mở.
  - Ghi chú: phần override này **ngoài phạm vi implement** của plan UI game hiện tại.

### 3) Yêu cầu realtime/refresh trên host

- Các thay đổi sau phải cập nhật ngay cho host/game (không reload thủ công):
  - `live_sessions.current_round_question_id` + `question_state` khi Show/ẩn.
  - `answers` insert/update khi thí sinh trả lời và khi host chấm.
  - `buzzer_events` khi có reset/winner (nếu có dùng ở VCNV).
- Nếu có thao tác đổi vòng/đổi thí sinh/đổi câu:
  - Host cần đảm bảo UI của host tự sync lại (router refresh hoặc realtime event bus) để không rơi vào trạng thái “nhấn lần 2 mới đổi”.

## Layout tổng

- Grid 2 cột:
  - Trái (Khung 1): chiếm ~2/3.
  - Phải (Khung 2): chiếm ~1/3.
- Không hard-code màu mới: dùng token/tailwind hiện có trong project (đi theo theme Olympia).

## KHUNG 1 — 5 ô ghép thành 1 khối

### Yêu cầu hình học

- Có 5 ô overlay:
  - 1 ô trung tâm (hình chữ nhật bình thường).
  - 4 ô xung quanh (1–4): hình chữ nhật bị khoét 1 góc quay vào trung tâm.
    - Ô 1 (trên trái): khoét góc **dưới phải**.
    - Ô 2 (trên phải): khoét góc **dưới trái**.
    - Ô 3 (dưới phải): khoét góc **trên trái**.
    - Ô 4 (dưới trái): khoét góc **trên phải**.
- 5 ô phải ghép khít, không hở nền, không chồng lấn.

### Cách implement đề xuất (CSS)

- Container `relative` bọc background.
- 5 overlay là các `div` tuyệt đối, dùng:
  - `clip-path: polygon(...)` cho 4 ô khoét góc.
  - ô trung tâm là hình chữ nhật bo góc.
- Nội dung trong ô: chỉ hiển thị nhãn số (1–4) và ô trung tâm (có thể là “TT” hoặc trống theo design), **không tương tác**.

### Style

- Phong cách: game show, sci-fi, gradient xanh đậm → xanh sáng, bo góc mềm, ánh sáng nhẹ.
- Không tạo token màu mới; dùng class Tailwind sẵn có (ví dụ các lớp slate/blue hiện đang dùng trong UI Olympia).

## KHUNG 2 — Bảng chướng ngại vật

### Header

- Text: `CHƯỚNG NGẠI VẬT CÓ {N} CHỮ`
  - `{N}` là số ký tự trong đáp án CNV (loại bỏ dấu cách).

### 4 hàng ký tự

- Mỗi hàng:
  - Bên trái: dãy hình tròn.
  - Bên phải: số thứ tự 1–4.
- Mỗi hình tròn chứa 1 chữ cái (không có dấu cách).

### Trạng thái

- Chưa mở:
  - hình tròn xanh đậm, **không hiển thị chữ**.
- Đã mở:
  - hình tròn xanh sáng hơn, hiển thị chữ, glow nhẹ.

## Trạng thái/điều kiện hiển thị

- Chỉ bật UI này khi:
  - `roundType === 'vcnv'` và câu hiện tại là CNV (theo code), và có `image_url` cho câu CNV.
- Nếu thiếu dữ liệu (không xác định được 4 câu VCNV-1..4 hoặc thiếu đáp án):
  - TẠO log lỗi kèm các thông tin cần thiết để debug, kèm notification trên UI

## Tiêu chí nghiệm thu

1. Khi host show câu CNV: game hiển thị 2 khung đúng bố cục.
2. Background hiển thị được (ảnh câu CNV từ nguồn câu hỏi chung).
3. 5 ô overlay ghép khít, đúng khoét góc theo vị trí 1–4, không hở nền.
4. Bảng phải có tiêu đề `CHƯỚNG NGẠI VẬT CÓ {N} CHỮ`.
5. 4 hàng (ứng với 4 câu VCNV):
   - Chưa mở: không hiện chữ.

- Đã mở: hiện đúng chữ cái theo đáp án (bỏ dấu cách) và có glow nhẹ.

6. Không có hover/click/interaction.

## Rủi ro & lưu ý

- `clip-path` phụ thuộc trình duyệt; cần test trên Chromium-based (VS Code/Chrome) và tối thiểu 1 trình duyệt khác nếu có.
- Cần thống nhất cách xác định 4 câu hàng ngang (VCNV-1..4) trong dữ liệu hiện tại: theo `meta.code` hay theo `question_set_items.code/questions.code`.
- Nếu game state chưa có đủ dữ liệu để biết hàng nào đã “mở”, cần bổ sung 1 tín hiệu mở hàng ngang (không nằm trong phạm vi implement ở bước “kế hoạch”).
