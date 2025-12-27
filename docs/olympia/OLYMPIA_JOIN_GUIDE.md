# Hướng dẫn Join Phòng & Vai Trò MC - Olympia

## Tổng quan

Olympia hỗ trợ 3 vai trò khi tham gia phòng thi:

1. **Thí sinh (Contestant)** – tham gia thi và trả lời câu hỏi
2. **MC (Người dẫn chương trình)** – xem câu hỏi kèm đáp án + ghi chú, điều khiển trận thi
3. **Khách (Guest)** – xem bảng xếp hạng trực tuyến mà không cần đăng nhập

---

## 1. Vai Trò MC (Người Dẫn Chương Trình)

### Mô tả

MC là một người dùng đã đăng nhập, tham gia phòng thi **phía client** (giống như khách, không phải **hosts**).
MC có quyền:

- Xem câu hỏi trước khi hiển thị cho thí sinh
- Xem đáp án và ghi chú về câu hỏi
- Xem lĩnh vực / danh mục câu hỏi
- Theo dõi bảng xếp hạng thực tế
- Điều khiển trạng thái hiển thị câu hỏi (ẩn → hiển thị → phát hành đáp án) **nếu có quyền quản lý phòng**

### Cách Join (MC View)

1. **Truy cập trang Join**: Vào `/olympia/client/join` hoặc từ trang chủ nhấp **"Xem tất cả các cách tham gia"**
2. **Chọn tab MC**: Tìm tab "MC" trong Tabs bar
3. **Nhập Mã Trận + Mật khẩu MC**:
   - **Mã Trận (Match ID)**: Mã định danh trận thi (được cung cấp bởi admin)
   - **Mật khẩu MC** (`mc_view_password`): Mật khẩu dành riêng cho MC, do admin sinh ra khi **mở phòng live**
4. **Xác nhận** → Chuyển sang trang xem MC

### Dữ Liệu Được Bảo Vệ

- MC **không thể** tham gia nếu không có mật khẩu đúng
- Mật khẩu MC được **lưu hash** trong bảng `live_sessions.mc_view_password`
- Mật khẩu được **lưu lại lịch sử** trong bảng `session_password_history` để admin có thể xem lại

### Chú Ý

- **MC là viewer, không phải host**: MC không có quyền điều khiển phòng từ admin console, chỉ xem thông tin
- **Mật khẩu MC khác mật khẩu Thí sinh**:
  - `player_password` → dành cho Thí sinh
  - `mc_view_password` → dành cho MC
- **Không cần role trong DB**: Vai trò MC được xác định bằng **khóa / mật khẩu**, không lưu trong bảng `participants.role`

---

## 2. Thí Sinh (Contestant)

### Mô tả

Thí sinh là người tham gia thi, trả lời câu hỏi và được tính điểm theo thời gian + độ chính xác.

### Cách Join

1. **Truy cập trang Join**: `/olympia/client/join`
2. **Chọn tab Thí sinh** hoặc dùng **Form "Tham gia nhanh"** ở trang chủ
3. **Nhập Mã Tham Gia + Mật khẩu Thí sinh**:
   - **Mã Tham Gia** (`join_code`): Mã vào phòng thi (ví dụ: `A1B2C3D4`)
   - **Mật khẩu Thí sinh** (`player_password`): Mật khẩu do admin cung cấp khi mở phòng live
4. **Xác nhận** → Chuyển sang trang trò chơi

### Persistent Verification

Sau khi nhập mật khẩu lần đầu, hệ thống lưu xác minh trong bảng `session_verifications` với **hiệu lực 24 giờ** → có thể tham gia từ thiết bị khác mà không cần nhập lại (nếu vẫn trong 24h).

---

## 3. Khách (Guest)

### Mô tả

Khách xem bảng xếp hạng và tiến độ trận thi mà **không cần đăng nhập** hay mật khẩu.

### Cách Join

1. **Truy cập trang Join**: `/olympia/client/join`
2. **Chọn tab Khách**
3. **Tìm trận thi** từ danh sách `/olympia/client/matches` hoặc dùng **Mã Trận**
4. **Nhấp "Xem Chế độ Khách"** → Chuyển sang trang khách (bảng xếp hạng)

### Quyền Hạn

- Chỉ xem bảng xếp hạng
- Không thể tương tác hay trả lời câu hỏi
- Không cần đăng nhập

---

## 4. Admin: Mở Phòng & Sinh Mật khẩu

### Quy Trình Mở Phòng Live

**Admin Console** (`/olympia/admin/matches/[matchId]`) → Nhấp **"Mở phòng"**

Hệ thống sẽ:

1. **Sinh 2 mật khẩu ngẫu nhiên**:
   - `player_password` (6 ký tự hex, ví dụ: `A1B2C3`)
   - `mc_view_password` (6 ký tự hex, ví dụ: `D4E5F6`)
2. **Tạo Mã Tham Gia** (`join_code`, nếu chưa có)
3. **Lưu vào `live_sessions`**:
   - `player_password` (hash)
   - `mc_view_password` (hash)
   - `requires_player_password` = `true`
4. **Lưu Lịch sử** trong `session_password_history`: mật khẩu plain-text để admin xem lại
5. **Hiển thị trên giao diện admin**:
   ```
   Đã mở phòng. Mã tham gia: A1B2C3D4
   Mật khẩu thí sinh: A1B2C3
   Mật khẩu MC: D4E5F6
   ```

### Sinh Lại Mật khẩu

Nếu cần sinh mật khẩu mới (vì lý do bảo mật hoặc quên):

1. Vào trang chi tiết trận (`/olympia/admin/matches/[matchId]`)
2. Nhấp **"Sinh lại mật khẩu"**
3. Mật khẩu cũ được đánh dấu `is_current = false` trong lịch sử
4. Mật khẩu mới được tạo với `is_current = true`

---

## 5. Câu Hỏi: Định Dạng Code & TT Merge

### Các Định Dạng Code Được Hỗ Trợ

Khi nhập vào file XLSX, **cột Code** hỗ trợ các định dạng sau:

| Code         | Ý Nghĩa                                                         | Ví Dụ               |
| ------------ | --------------------------------------------------------------- | ------------------- |
| `KD{i}-{n}`  | Vòng Khởi Động, dành cho người chơi thứ i, câu hỏi thứ n        | `KD1-1`, `KD2-5`    |
| `DKA-{n}`    | Vẫn Khởi Động, phần Đối Kháng (trả lời chung 4 thí sinh), câu n | `DKA-1`, `DKA-3`    |
| `VCNV-{n}`   | Vòng Vượt Chướng Ngại Vật, {n} ∈ [1,2,3,4] (4 hàng)             | `VCNV-1`, `VCNV-4`  |
| `VCNV-OTT`   | Ô Trung Tâm của vòng VCNV (câu hỏi ở giữa)                      | `VCNV-OTT`          |
| `CNV`        | Chướng Ngại Vật (riêng câu hỏi chặn đường)                      | `CNV`               |
| `TT{n}`      | Vòng Tăng Tốc, câu thứ n (với hỗ trợ merge)                     | `TT1`, `TT2`        |
| `VD-{s}.{n}` | Vòng Về Đích, {s} điểm, câu thứ {n}                             | `VD-5.1`, `VD-10.2` |
| `CHP-{i}`    | Câu Hỏi Phụ cho thí sinh i                                      | `CHP-1`, `CHP-3`    |

### Xử Lý TT{n} Merge

**Đặc biệt với `TT{n}`**: nếu file XLSX có **nhiều hàng liên tiếp với cùng mã `TT{n}`** (hoặc hàng tiếp theo có **Code trống**), hệ thống sẽ:

1. **Gộp dữ kiện** (question_text + answer_text) từ tất cả hàng đó
2. **Dùng xuống dòng (`\n`)** để phân cách giữa các phần dữ kiện
3. **Lưu thành 1 record duy nhất** trong bảng `question_set_items`

#### Ví Dụ:

```
Hàng 1: TT1 | | Câu hỏi phần 1 | Đáp án phần 1 | ...
Hàng 2: TT1 | | Câu hỏi phần 2 | Đáp án phần 2 | ...
Hàng 3: TT1 | | Câu hỏi phần 3 | Đáp án phần 3 | ...
```

**Kết quả lưu:**

- **code**: `TT1`
- **question_text**: `Câu hỏi phần 1\nCâu hỏi phần 2\nCâu hỏi phần 3`
- **answer_text**: `Đáp án phần 1\nĐáp án phần 2\nĐáp án phần 3`
- **order_index**: 1 (lưu 1 lần)

Lúc chiếu lên màn hình, giao diện sẽ hiển thị với **xuống dòng** để các phần dữ kiện **chiếu lần lượt**.

---

## 6. Sắp Xếp Thí Sinh (STT) & Drag-n-Drop

### Admin: Gán & Sắp Xếp Thí Sinh

Vào trang chi tiết trận (`/olympia/admin/matches/[matchId]`), mục **"Danh sách thí sinh"**:

1. **Drag & Drop**: Kéo các thẻ thí sinh để sắp xếp thứ tự **Ghế 1 → Ghế 4**
2. **Lưu**: Nhấp nút **"Lưu thứ tự"**
3. Hệ thống cập nhật `seat_index` (1-4) cho mỗi `match_players` theo thứ tự mới

### Data Model

- Mỗi thí sinh trong trận có **`match_players.seat_index`** (1-4)
- Khi kéo thả, chỉ cập nhật `seat_index` mà không xóa hay tạo mới record
- Tối đa **4 ghế** (cứng nhắc cho format trò chơi Olympia hiện tại)

---

## 7. Mô Hình Dữ Liệu

### Bảng Chính

```sql
-- Phòng live (session)
olympia.live_sessions
  - id, match_id, join_code
  - player_password (hash), mc_view_password (hash)
  - requires_player_password (boolean)

-- Xác minh thí sinh (cross-device 24h)
olympia.session_verifications
  - id, session_id, user_id
  - expires_at (24 giờ từ verified_at)

-- Lịch sử mật khẩu
olympia.session_password_history
  - id, session_id
  - player_password_hash, mc_view_password_hash
  - player_password_plain, mc_password_plain (để admin xem)
  - is_current (boolean)

-- Thí sinh trong trận
olympia.match_players
  - id, match_id, participant_id
  - seat_index (1-4)
  - display_name

-- Bộ câu hỏi (import từ XLSX)
olympia.question_set_items (Option B: source chính)
  - id, question_set_id, code, question_text, answer_text
  - category, note, image_url, audio_url, order_index
```

---

## 8. Kiểm Tra & Xác Minh

### Checklist Khi Thiết Lập Trận Mới

- [ ] Tạo Match trong admin
- [ ] Gán Thí sinh vào từng Ghế (drag-n-drop)
- [ ] Gán Bộ đề cho trận
- [ ] Tạo vòng thi (Khởi động, Vượt chướng, Tăng tốc, Về đích)
- [ ] Mở phòng live → Nhận Mã tham gia + Mật khẩu Thí sinh + MC
- [ ] Phát **Mã tham gia** + **Mật khẩu Thí sinh** cho thí sinh
- [ ] Phát **Mã trận** + **Mật khẩu MC** cho MC (hoặc người điều khiển)
- [ ] MC xác nhận có thể xem đáp án trước khi chiếu

### Xóa Khóa / Hủy Phòng

- [ ] Nhấp **"Kết thúc phòng"** trên admin → `live_sessions.status = 'ended'`
- [ ] Thí sinh & MC không thể tham gia lại

---

## 9. FAQ

**Q: MC có thể là admin không?**  
A: Không. MC là người dùng **client** (người xem), không phải admin. Role MC được xác định bằng **mật khẩu**, không phải bằng role trong database.

**Q: Nếu quên mật khẩu thí sinh sao?**  
A: Admin vào trang chi tiết trận → **"Lấy mật khẩu"** hoặc **"Sinh lại mật khẩu"** → phát lại cho thí sinh.

**Q: Thí sinh có thể join từ 2 thiết bị cùng lúc không?**  
A: Có, nếu vẫn trong **24 giờ xác minh**. Session verification được lưu trong `session_verifications` và có hiệu lực 24h.

**Q: TT{n} merge có thể bị lỗi không?**  
A: Nếu dữ liệu XLSX không đúng định dạng (code trống, câu hỏi rỗng), hàng đó sẽ **bị bỏ qua** và đánh dấu `skipped`.

**Q: Drag-n-drop STT có giới hạn không?**  
A: Có, tối đa **4 ghế** (seat_index 1-4). Nếu cần nhiều hơn, cần điều chỉnh schema.

---

**Cập nhật:** 27/12/2025  
**Phiên bản Olympia:** v0.4.0
