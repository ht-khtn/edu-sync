# Kế hoạch chỉnh UI VCNV — Hàng disabled đỏ + không tràn khung

## Bối cảnh

UI bảng VCNV (4 hàng ô tròn) hiện có các vấn đề:

- Hàng/cell chủ yếu là viền, nền chưa đủ rõ nên bị chìm trên background xanh.
- Các hàng bị disable (mở nhưng không có thí sinh đúng) cần nổi bật bằng màu đỏ.
- Số ô đang bị “đệm” lên tối thiểu 14 (`max(14, letters.length)`), dẫn tới thừa ô so với số chữ và dễ tràn khung.
- Khi số ô lớn, layout bị tràn ngang và phần số thứ tự 1–4 nhìn xấu/khó canh khi hàng bị wrap.

## Mục tiêu

1. Disabled (mở nhưng không ai đúng) phải **đỏ** ở cả nền hàng và nền từng ô.
2. **Số ô đúng bằng số chữ** (đã loại bỏ khoảng trắng) — không thừa ô.
3. Không bao giờ tràn ngang: hết chỗ thì **tự xuống dòng** (wrap) và hàng tự cao lên.
4. Cột số 1–4 trở thành badge gọn đẹp và **canh TOP** khi hàng bị xuống dòng.
5. Các khung che ảnh (bên trái) với trạng thái `lockedWrong` **không được lộ ảnh**; phải che kín và đổi sang màu đỏ.

## Phạm vi

- Chỉ chỉnh UI bảng VCNV trong game view (khung phải), không thêm page/modal/animation.
- Không đổi nghiệp vụ mở hàng / reveal chữ (vẫn theo state hiện có: `vcnvRevealByRoundQuestionId` và `vcnvLockedWrongByRoundQuestionId`).

## Quy ước trạng thái (mapping)

- `opened`: hàng đã được mở và được phép hiện chữ.
- `lockedWrong`: hàng đã mở nhưng bị disable (không có thí sinh đúng) → hiển thị placeholder `•` và đổi tone đỏ.
- `isActive`: hàng đang là câu hiện tại (đang show) → tone nổi bật.

## Thiết kế class (Tailwind tokens)

### Row container

- Active: `bg-primary/10 ring-1 ring-primary/25`
- Disabled (lockedWrong): `bg-destructive/15 ring-1 ring-destructive/30 cursor-not-allowed opacity-90`
- Opened (bình thường): `bg-muted/15 ring-1 ring-muted-foreground/10`
- Unopened: `bg-background/5 ring-1 ring-primary/10`

### Cell (ô tròn)

- Reveal chữ (opened): `bg-primary text-primary-foreground border-primary/40`
- Placeholder trong active/open: `bg-primary/15 text-primary border-primary/30`
- Disabled: `bg-destructive/20 text-destructive-foreground border-destructive/40`
- Unopened: `bg-background/10 text-primary/60 border-primary/15`

> Ghi chú: trong code hiện tại đang dùng tone `sky/rose/slate`. Khi implement sẽ map tương đương nhưng ưu tiên token hệ thống `destructive` cho disabled.

## Layout không tràn

- Container cells dùng `flex flex-wrap gap-*`.
- Outer row dùng `items-start` để badge số bám top khi wrap.
- Không dùng `flex-nowrap` cho cells.

## Tiêu chí nghiệm thu

- Hàng 2–3 (lockedWrong) luôn đỏ rõ ràng, cả row + từng cell.
- Mỗi hàng render đúng **N ô** với N = số ký tự đáp án sau khi bỏ khoảng trắng.
- Khi N lớn, cells tự wrap, không có overflow ngang.
- Badge số 1–4 luôn nằm bên phải và canh top, không bị kẹt/đẩy lệch.

## Nơi chỉnh

- Component: `components/olympia/shared/game/OlympiaGameClient.tsx`
- Hàm: `renderRow(...)`
- Logic cover ảnh: `covers.map(...)`
