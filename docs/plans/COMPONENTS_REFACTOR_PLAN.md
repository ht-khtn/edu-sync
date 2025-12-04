# EduSync Components Refactor Plan

## Mục tiêu
- Đồng bộ cách tổ chức `components/` theo hướng rõ ràng: `admin`, `client`, `olympia`, `layout`.
- Xoá bớt component trùng lặp, wrapper không cần thiết, và file orphan.
- Đảm bảo các route `(admin)` chỉ dùng component admin, `(client)` chỉ dùng component client, phần dùng chung được gom vào shared.

---

## 1. Nguyên tắc cấu trúc mới

- `components/admin/`
  - Tất cả UI + domain logic phục vụ route nhóm `(admin)` trong `app/(admin)`.
- `components/client/`
  - Tất cả UI + domain logic phục vụ route nhóm `(client)` trong `app/(client)`.
- `components/olympia/`
  - Tất cả UI + domain logic phục vụ route nhóm `(olympia)`.
- `components/layout/`
  - Nếu cần, chỉ chứa **layout wrappers** (header, sidebar, main content, footer) dùng chung cho nhiều route group.
  - Không chứa business logic đặc thù.
- `components/auth/`, `components/common/`, `components/ui/`, `components/ui-extended/`
  - Giữ vai trò shared hiện tại, không chứa business logic đặc thù.

---

## 2. Các bước refactor

### Bước 1: Dọn duplicated & orphan components

1. Xoá `components/domain/client/leaderboard/` (duplicate, không được import).
2. Xoá `components/NavClient.tsx` (orphan, không được import).
3. Xoá `components/domain/home/Page.tsx` nếu thực sự không còn route nào dùng.
4. Xoá `components/md/Button.tsx` (deprecated, nếu không còn import).
5. Sau khi consolidate score, xoá `components/domain/score-entry/` (chỉ là wrapper).

### Bước 2: Consolidate score entry cho admin

1. Tạo thư mục mới `components/domain/admin/score/`.
2. Di chuyển/copy nội dung:
   - Từ `components/domain/score/CSVUploader.tsx` → `components/domain/admin/score/CSVUploader.tsx`.
   - Từ `components/domain/score/ScoreEntryClient.tsx` → `components/domain/admin/score/ScoreEntryClient.tsx`.
   - Từ `components/domain/score/ScorePreviewTable.tsx` → `components/domain/admin/score/ScorePreviewTable.tsx`.
3. Gộp wrapper trong `components/domain/score-entry/` vào cùng thư mục:
   - `Page.tsx` → `components/domain/admin/score/Page.tsx`.
   - `ScoreEntryComponents.ts` → `components/domain/admin/score/ScoreEntryComponents.ts` (export lại từ cùng folder).
4. Cập nhật các import trong `app/(admin)/admin/score-entry/page.tsx` (hoặc file tương đương) để dùng path mới:
   - Từ `@/components/domain/score-entry/...` → `@/components/domain/admin/score/...`.
5. Sau khi confirm không còn import cũ, xoá thư mục `components/domain/score-entry/` và `components/domain/score/` (nếu tất cả logic đã được move).

### Bước 3: Gom domain client, flatten structure

1. Di chuyển các component content client lên một cấp:
   - `components/domain/client/content/AnnouncementCard.tsx` → `components/domain/client/AnnouncementCard.tsx`.
   - `components/domain/client/content/CategoryTabs.tsx` → `components/domain/client/CategoryTabs.tsx`.
   - `components/domain/client/content/EmptyState.tsx` → `components/domain/client/EmptyState.tsx`.
   - `components/domain/client/content/EventCard.tsx` → `components/domain/client/EventCard.tsx`.
   - `components/domain/client/content/LoadingSkeleton.tsx` → `components/domain/client/LoadingSkeleton.tsx`.
2. Di chuyển hero + header client:
   - `components/domain/client/hero/ClientHero.tsx` → `components/domain/client/ClientHero.tsx`.
   - `components/domain/client/header/UserMenu.tsx` → `components/domain/client/UserMenu.tsx`.
3. Cập nhật tất cả import trong `app/(client)/**`:
   - Từ `@/components/domain/client/content/...` → `@/components/domain/client/...`.
   - Từ `@/components/domain/client/hero/ClientHero` → `@/components/domain/client/ClientHero`.
4. Sau khi cập nhật import xong, xoá các thư mục rỗng:
   - `components/domain/client/content/`.
   - `components/domain/client/header/`.
   - `components/domain/client/hero/`.

### Bước 4: Đồng bộ layout cho client & admin

1. Di chuyển `ClientHeader` vào layout để thống nhất với admin:
   - Từ `components/domain/client/header/ClientHeader.tsx` → `components/layout/client/ClientHeader.tsx`.
   - Đảm bảo vẫn export `ClientHeader` như cũ (React.memo).
2. Cập nhật import:
   - Trong `app/(client)/layout.tsx` đổi từ `@/components/domain/client/header/ClientHeader` → `@/components/layout/client/ClientHeader`.
3. Giữ nguyên `components/layout/admin/*` như hiện tại (AdminHeader, AdminSidebar, AdminMainContent).
4. Đảm bảo `components/layout/client/ClientMainContent.tsx` vẫn là main wrapper cho tất cả page client.

> Ghi chú: Một số bước (move ClientHeader/ClientHero) đã được thực hiện một phần; khi chạy plan này cần kiểm tra trạng thái hiện tại rồi điều chỉnh cho khớp.

### Bước 5: Map components 1-1 với các route group trong `app/`

Thay vì tạo `components/domain/shared/`, ưu tiên cấu trúc song song với `app/`:

1. Leaderboard
   - Nếu bảng xếp hạng chỉ dành cho admin:
     - `components/domain/leaderboard/*` → `components/admin/leaderboard/*`.
   - Nếu cả admin và client đều dùng:
     - Tách rõ phần UI/logic cho từng phía:
       - Admin: `components/admin/leaderboard/*`.
       - Client: `components/client/leaderboard/*`.
2. Login
   - Di chuyển sang nơi thể hiện rõ là entrypoint dùng chung:
     - Ví dụ: `components/login/*` hoặc `components/auth/login/*`.
   - Cập nhật `app/login/page.tsx` import theo path mới.
3. Olympia
   - Di chuyển `components/domain/olympia/*` → `components/olympia/*`.
   - Cập nhật import trong `app/(olympia)/**` tương ứng.
4. Violation core
   - Nếu logic nào chỉ dùng trong `(admin)` thì move sang `components/admin/violation/*`.
   - Nếu logic nào dùng cho cả admin + client thì xem xét tách 2 component riêng biệt (admin view vs client view), mỗi cái nằm trong đúng thư mục `admin/` hoặc `client/`.

### Bước 6: Đảm bảo route → domain đúng

1. Với mỗi route trong `app/(admin)/admin/**`:
   - Kiểm tra tất cả import phải bắt đầu bằng `@/components/layout/admin/`, `@/components/admin/` hoặc các thư mục shared (`@/components/common/`, `@/components/ui`, `@/components/auth`, v.v.).
   - Nếu còn import từ `@/components/client` hoặc `@/components/olympia` thì xem lại: hoặc tách phần dùng chung ra shared, hoặc tạo phiên bản riêng cho admin.
2. Với mỗi route trong `app/(client)/client/**`:
   - Import chính phải từ `@/components/layout/client/`, `@/components/client/` hoặc shared (`@/components/common/`, `@/components/ui`, `@/components/auth`, v.v.).
3. Với các route trong nhóm `app/(olympia)/**`:
   - Sử dụng `@/components/olympia/...` cho logic/UI đặc thù Olympia, kết hợp với shared (`@/components/common/`, `@/components/ui`, ...).

### Bước 7: Cleanup & kiểm tra

1. Chạy `pnpm lint` và/hoặc `pnpm test` (nếu có) để phát hiện import lỗi.
2. Fix các lỗi TypeScript/ESLint còn lại (sai path, type mismatch).
3. Review nhanh structure cuối cùng:

```text
components/
   auth/
   common/
   admin/
      layout/
         AdminHeader.tsx
         AdminMainContent.tsx
         AdminSidebar.tsx
      accounts/
      classes/
      criteria/
      roles/
      score/
      violation-entry/
      violation-history/
      violation-stats/
   client/
      layout/
         ClientHeader.tsx
         ClientMainContent.tsx
      AnnouncementCard.tsx
      CategoryTabs.tsx
      ClientHero.tsx
      EmptyState.tsx
      EventCard.tsx
      LoadingSkeleton.tsx
      UserMenu.tsx
      my-violations/
   olympia/
      (các component dùng trong app/(olympia))
   ui/
   ui-extended/
```

---

## 3. Thứ tự ưu tiên thực thi

1. Dọn duplicate/orphan nhỏ: xoá `domain/client/leaderboard`, `NavClient`, `md/Button`, `domain/home/Page` (nếu chắc chắn không dùng).
2. Move & consolidate score vào `domain/admin/score` và update imports.
3. Flatten `domain/client/*` và move `ClientHeader` vào `layout/client` (nếu chưa khớp).
4. Tách `domain/shared/*` và update toàn bộ imports.
5. Chạy lint/test để xác nhận.

Plan này có thể thực hiện theo từng PR nhỏ để dễ review và rollback nếu cần.