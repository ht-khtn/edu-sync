# Olympia Refactor Plan (2026-01-14)

## Mục tiêu

- Giảm kích thước và độ phức tạp của các file Olympia rất lớn (page.tsx ~1000+, actions ~7000+) bằng cách module hoá theo concern.
- Bảo toàn 100% hành vi hiện tại:
  - Không thay đổi logic nghiệp vụ, luồng dữ liệu, ranh giới transaction, thứ tự event/side-effects.
  - Realtime: không đổi channel/filter/payload/thứ tự phát.
- Cải thiện khả năng bảo trì/đọc/test và tối ưu hiệu năng theo hướng **an toàn** (không “fix bug ngầm”).

## Ràng buộc tuyệt đối

- Không thêm thư viện mới.
- Không thay đổi contract public của các action/hàm đang được import ở nơi khác (tên export, tham số, kiểu trả về, error semantics).
- Không thay đổi boundaries Client/Server của Next.js theo cách có thể ảnh hưởng hành vi (chỉ chuyển đổi khi chứng minh 100% tương đương).
- Không thay đổi số lần gọi DB, thứ tự gọi DB trong transaction, hay các trigger side-effects (trừ khi chỉ là gom code _không đổi_ thứ tự gọi).

## Phạm vi

1. Actions Olympia (hiện nằm trong app/(olympia)/.../actions.ts hoặc tương đương):

- Tách theo concern:
  - match.actions.ts: tạo/cập nhật/trạng thái trận đấu, điều hướng vòng đời match.
  - scoring.actions.ts: chấm điểm, tính toán điểm, cập nhật scoreboard.
  - realtime.actions.ts: subscribe/broadcast/notify (giữ nguyên channel/filter/payload/thứ tự).
  - permissions.actions.ts: authz/rbac, check quyền.
  - queries.ts (nếu có): các hàm fetch dữ liệu thuần.
  - helpers/\*.ts: helper thuần không side-effect (format, validate, mapping).

2. Page Olympia lớn (app/(olympia)/.../page.tsx):

- Chuyển file page.tsx thành **orchestration-only**:
  - Data fetching server-side (giữ nguyên thứ tự/điều kiện).
  - Ghép props và render layout.
- Tách UI thành components nhỏ, tách state/hook hợp lý.
- Nếu có phần client-only lớn: dùng dynamic import **chỉ khi** không ảnh hưởng realtime/subscription order.

## Chiến lược thực hiện (bắt buộc theo thứ tự)

### Bước 1 — Phân tích (Read-only)

- Xác định chính xác các file cực lớn:
  - file page.tsx nào thuộc Olympia đang ~1000+ dòng.
  - file actions nào thuộc Olympia đang ~7000+ dòng.
- Lập bảng:
  - Public exports (hàm/action) và nơi đang import.
  - Nhóm concern (UI, server action, domain, realtime, permission, data fetching).
  - Các điểm nhạy cảm:
    - Transaction blocks (BEGIN/COMMIT), RPC calls, trigger-dependent updates.
    - Realtime subscriptions/broadcast order.
    - Side-effects: write DB, invalidate cache, revalidatePath/tag, log/audit.

### Bước 2 — Tách module (Mechanical refactor, preserve order)

- Nguyên tắc tách:
  - Mỗi module chỉ di chuyển code (cut/paste) + cập nhật import; không đổi logic.
  - Giữ nguyên thứ tự gọi hàm trong mỗi action.
  - Không gộp/đổi cấu trúc promise/await làm thay đổi timing.
  - Không đổi error messages/codes trừ khi TypeScript bắt buộc; nếu phải đổi, dừng lại.

- Actions:
  - Tạo thư mục đích (ưu tiên cùng layer để không đổi runtime semantics):
    - app/(olympia)/olympia/actions/_ hoặc actions/olympia/_ (sẽ quyết định sau khi kiểm tra Next server action import pattern hiện tại).
  - Mỗi file mới có `"use server"` nếu chứa server actions.
  - Các helper thuần tách riêng (không `"use server"`).
  - Cập nhật các import ở nơi sử dụng sang module mới.
  - Nếu cần giữ path cũ để tương thích, dùng re-export **chỉ khi xác nhận Next.js server actions vẫn hoạt động y nguyên**; nếu không chắc, không dùng.

- Page/UI:
  - Tách components theo khu vực UI (header/panels/dialogs/tables).
  - Tách hooks (state machine, derived state) vào hooks/.
  - Tách types riêng vào types/.
  - Giữ nguyên props/JSX tree order đối với các phần realtime-subscribe để không đổi event order.

### Bước 3 — Tối ưu client (an toàn)

- Chỉ áp dụng khi chứng minh không đổi hành vi:
  - Chuyển phần không cần client sang Server Component.
  - Dynamic import cho các panel ít dùng, nhưng **không** trì hoãn mount của phần realtime-critical.
  - Giảm bundle bằng cách tránh import nặng ở client.

### Bước 4 — Tối ưu server (an toàn)

- Không thay transaction/order. Chỉ tối ưu dạng:
  - Tránh duplicate compute thuần (memoization nội bộ trong cùng request) nếu không ảnh hưởng side-effects.
  - Gom helper và query-builder để giảm overhead, nhưng giữ số lần query và thứ tự.

### Bước 5 — Xác minh

- Kiểm tra TypeScript errors trên các file đã đổi.
- Đối chiếu:
  - Public exports không đổi.
  - Realtime: channel/filter/payload + order không đổi.
  - Không tạo race condition mới (không đổi await order).

### Bước 6 — Báo cáo

- Tạo docs/plans/olympia/refactor-report.md:
  - Map file cũ → file mới.
  - Lý do tách.
  - Checklist xác nhận preserve behavior.

## Output yêu cầu cho từng module

Với mỗi module tạo mới, report sẽ ghi:

- Nguồn gốc: khối code được di chuyển từ file nào.
- Export public gồm những gì.
- Xác nhận preserve logic: chỉ di chuyển/cập nhật import, không đổi control-flow.

## Checklist an toàn realtime

- [ ] Không đổi channel
- [ ] Không đổi filter
- [ ] Không đổi payload shape
- [ ] Không đổi thứ tự broadcast/emit
- [ ] Không buffering/batching
