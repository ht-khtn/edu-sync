# Admin Rooms Page - Follow-up Issue

**Issue**: Không nhất quán link tới match detail page
**Severity**: 🟡 MEDIUM (Admin feature, not critical)
**File**: `app/(olympia)/olympia/(admin)/admin/rooms/page.tsx`

---

## 🔍 Vấn đề

Admin rooms page dùng `match?.code` để link tới match detail page:

```typescript
// ❌ WRONG - Multiple locations
href={`/olympia/admin/matches/${match?.code ?? session.match_id}`}
```

Nhưng match detail route chỉ chấp nhận `matches.id` (UUID):

```typescript
// ✅ EXPECTED
href={`/olympia/admin/matches/${match?.id ?? session.match_id}`}
```

---

## 📍 Vị trí Issues

1. **Line 229** - "Mở console host" link
2. **Line 303** - "Mở console host" link
3. **Line 369** - "Xem chi tiết match" link

---

## 🔧 Cách Sửa

```typescript
// ✅ CORRECT
href={`/olympia/admin/matches/${match?.id ?? session.match_id}`}
```

---

## ⏳ Thời gian Sửa

**Recommendation**: Sprint tiếp theo

- Ảnh hưởng: Admin rooms view → click link → 404 error
- Priority: Thấp (admin feature chỉ)
- Effort: 2 phút (3 thay đổi)

---

**Tạo bởi**: Verification Task
**Ngày**: 2025-12-28
