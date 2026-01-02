# Định dạng mã CODE - Olympia

## Tóm tắt định dạng

| Mã       | Ý nghĩa                 | Cấu trúc                         | Ví dụ                     |
| -------- | ----------------------- | -------------------------------- | ------------------------- |
| **KD**   | Câu hỏi kiến thức       | `KD<số ghế>-<thứ tự câu hỏi>`    | KD1-1, KD2-2, KD4-1       |
| **DKA**  | Câu hỏi DKA             | `DKA-<thứ tự câu hỏi>`           | DKA-1, DKA-2              |
| **VCNV** | Ô chữ - hàng            | `VCNV-<số hàng>` hoặc `VCNV-OTT` | VCNV-1, VCNV-2, VCNV-OTT  |
| **CNV**  | Chướng ngại vật (ô chữ) | `CNV`                            | CNV                       |
| **TT**   | Câu hỏi TT              | `TT<thứ tự câu hỏi>`             | TT1, TT2, TT5, TT6        |
| **VD**   | Vấn đề                  | `VD-<loại gói>.<thứ tự câu hỏi>` | VD-10.1, VD-20.2, VD-40.1 |
| **CHP**  | Câu hỏi CHP             | `CHP-<thứ tự câu hỏi>`           | CHP-1, CHP-2              |

## Chi tiết từng loại

### KD (Kiến thức)

- **Cấu trúc:** `KD<ghế>-<câu hỏi>`
- **Giải thích:**
  - Số đầu = Số ghế của thí sinh
  - Số sau = Thứ tự câu hỏi
- **Ví dụ:** KD1-1 (ghế 1, câu hỏi 1), KD3-2 (ghế 3, câu hỏi 2)

### DKA

- **Cấu trúc:** `DKA-<thứ tự>`
- **Giải thích:** Số duy nhất là thứ tự câu hỏi
- **Ví dụ:** DKA-1, DKA-2

### VCNV (Ô Chữ)

- **Cấu trúc:** `VCNV-<số hàng>` hoặc `VCNV-OTT`
- **Giải thích:**
  - VCNV-1, VCNV-2, VCNV-3, VCNV-4 = Hàng 1, 2, 3, 4
  - VCNV-OTT = Ô trung tâm
- **Ví dụ:** VCNV-1 (hàng 1), VCNV-OTT (ô trung tâm)

### CNV (Chướng ngại vật)

- **Cấu trúc:** `CNV` (mã đơn)
- **Giải thích:** Chướng ngại vật cần tìm trong ô chữ
- **Liên quan:** Phần này thuộc trò chơi ô chữ, xem Olympia rules

### TT

- **Cấu trúc:** `TT<thứ tự>`
- **Giải thích:** Số duy nhất là thứ tự câu hỏi
- **Ví dụ:** TT1, TT2, TT5, TT6

### VD (Vấn đề)

- **Cấu trúc:** `VD-<loại gói>.<thứ tự>`
- **Giải thích:**
  - Số đầu = Loại gói câu hỏi (10, 20, 30, 40...)
  - Số sau = Thứ tự câu hỏi
- **Ví dụ:** VD-10.1 (gói 10, câu 1), VD-20.2 (gói 20, câu 2)

### CHP

- **Cấu trúc:** `CHP-<thứ tự>`
- **Giải thích:** Số duy nhất là thứ tự câu hỏi
- **Ví dụ:** CHP-1, CHP-2

## Xử lý Merged Cells khi Import từ XLSX

### Vấn đề

Trong file Excel gốc, một số câu hỏi sử dụng **merged cells**. Ví dụ:

- TT5 có 2 hàng dữ liệu merge lại (hàng chứa TT5 + 2 hàng dưới trống)
- TT6 cũng vậy
- Nhiều câu hỏi khác cũng có cấu trúc tương tự

### Cách xử lý

Khi tải đề lên (import XLSX), hệ thống cần:

1. **Phát hiện merged cells:** Xác định các hàng được merge với nhau

2. **Gom nhất dữ liệu:** Tất cả dữ liệu từ các hàng merge được gom vào một record với CODE duy nhất
   - Ví dụ: TT5 có 3 hàng merge → tạo 1 record với code TT5

3. **Format lưu dữ liệu:** Các phần dữ liệu từ merged cells được lưu dưới dạng array hoặc chuỗi với separator

   ```json
   {
     "code": "TT5",
     "field": "CÂU HỎI",
     "parts": ["Phần 1 của câu hỏi", "Phần 2 của câu hỏi", "Phần 3 của câu hỏi"]
   }
   ```

   Hoặc chuỗi với separator:

   ```
   TT5|CÂU HỎI: "Phần 1 của câu hỏi ||| Phần 2 của câu hỏi ||| Phần 3 của câu hỏi"
   ```

4. **Hiển thị trên web:** Frontend có thể:
   - Hiển thị từng phần lần lượt khi vòng TT được diễn hành
   - Hoặc parse array và xử lý theo logic của trò chơi

### Ví dụ thực tế

```
Hàng 20: TT5 | [CÂU HỎI] "Câu hỏi phần 1"
Hàng 21: [merge] | [CÂU HỎI] "Câu hỏi phần 2"
Hàng 22: [merge] | [CÂU HỎI] "Câu hỏi phần 3"

↓ Sau xử lý ↓

TT5 | [CÂU HỎI] ["Câu hỏi phần 1", "Câu hỏi phần 2", "Câu hỏi phần 3"]
```

## Lưu ý

- **Format input:** XLSX (chứa merged cells)
- **CSV:** Chỉ dùng để tham khảo, không phải format chính
- Đây là dữ liệu cho hệ thống quản lý câu hỏi Olympia
- Phần VCNV và CNV là phần của trò chơi ô chữ
- Tham khảo Olympia rules để hiểu chi tiết hơn
