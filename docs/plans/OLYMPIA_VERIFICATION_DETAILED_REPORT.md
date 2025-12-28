# Báo cáo Chi tiết - Kiểm tra Fetch URL & Schema Olympia

**Ngày tạo**: 2025-12-28
**Trạng thái**: ❌ **CÓ LỖI CẦN SỬA**

---

## 📌 Tóm tắt Phát hiện

| Vấn đề                                                                    | Mức độ      | File                                                              | Dòng  | Trạng thái |
| ------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- | ----- | ---------- |
| Admin match detail dùng `eq('code', matchId)` thay vì `eq('id', matchId)` | 🔴 CRITICAL | `app/(olympia)/olympia/(admin)/admin/matches/[matchId]/page.tsx`  | 75    | ❌ BUG     |
| Client game page sử dụng `join_code` đúng                                 | ✅ PASS     | `app/(olympia)/olympia/(client)/client/game/[sessionId]/page.tsx` | 25    | ✅ OK      |
| Client watch page (MC) sử dụng `matches.code` đúng                        | ✅ PASS     | `app/(olympia)/olympia/(client)/client/watch/[matchId]/page.tsx`  | 24-26 | ✅ OK      |
| Client guest page sử dụng `matches.code` đúng                             | ✅ PASS     | `app/(olympia)/olympia/(client)/client/guest/[matchId]/page.tsx`  | 24-26 | ✅ OK      |
| verifyMcPasswordAction trả về `matchCode` đúng                            | ✅ PASS     | `app/(olympia)/olympia/actions.ts`                                | 569   | ✅ OK      |
| lookupJoinCodeAction sử dụng `join_code` đúng                             | ✅ PASS     | `app/(olympia)/olympia/actions.ts`                                | 490   | ✅ OK      |

---

## 🔴 CRITICAL BUG #1: Admin Match Detail URL Mismatch

### Vị trí

📄 [app/(olympia)/olympia/(admin)/admin/matches/[matchId]/page.tsx](<app/(olympia)/olympia/(admin)/admin/matches/%5BmatchId%5D/page.tsx#L75>)

### Vấn đề

```typescript
// ❌ WRONG - Line 75
async function fetchMatchDetail(matchId: string) {
  const { data: match, error: matchError } = await olympia
    .from('matches')
    .select('id, code, name, ...')
    .eq('code', matchId)  // ❌ BUG: Should be .eq('id', matchId)
    .maybeSingle()
```

### Nguyên nhân

- URL parameter `matchId` là UUID (ví dụ: `550e8400-e29b-41d4-a716-446655440000`)
- `matches.code` là UNIQUE text column (ví dụ: `"M1234"`)
- Admin matches list ([line 194](<app/(olympia)/olympia/(admin)/admin/matches/page.tsx#L194>)) đang link theo `match.id`, không phải `match.code`
- Comment ở line 446 nói "Match routes now use match code" nhưng đó là sai (matches list dùng UUID)

### Bằng chứng

```typescript
// app/(olympia)/olympia/(admin)/admin/matches/page.tsx:194
<Link href={`/olympia/admin/matches/${match.id}`}>  // ✅ Uses match.id (UUID)

// app/(olympia)/olympia/(admin)/admin/matches/[matchId]/page.tsx:75
.eq('code', matchId)  // ❌ Tries to find by code, but param is UUID
```

### Hậu quả

- Admin khi click vào match từ list → URL là `/olympia/admin/matches/{UUID}`
- Page cố gắng tìm match với `WHERE code = UUID` → **Không tìm thấy**
- Trang returns `notFound()`

### Cách sửa

```typescript
// ✅ CORRECT
.eq('id', matchId)  // matchId is the UUID from URL params
```

### Liên quan

- Line 446 comment cần cập nhật hoặc sửa logic
- Line 365 link `host` page cũng dùng `match.id` ✅ (đúng)
- Line 118 match_question_sets query dùng `matchId` directly ✅ (đúng)

---

## ✅ CHECK PASS: Client Routes

### 1️⃣ Game Page (Contestant)

**Route**: `/olympia/client/game/[sessionId]`

```typescript
// ✅ CORRECT - Line 25
const { data: session } = await olympia
  .from('live_sessions')
  .select(...)
  .eq('join_code', sessionId)  // ✅ Dùng join_code (public)
  .maybeSingle()
```

**Status**: ✅ OK

- URL param `sessionId` = contestant nhập vào `join_code`
- Query sử dụng `join_code` để lookup ✅
- Fetch match theo `session.match_id` ✅

---

### 2️⃣ Watch Page (MC)

**Route**: `/olympia/client/watch/[matchId]`

```typescript
// ✅ CORRECT - Line 24-26
const [{ data: match }] = await Promise.all([
  olympia
    .from('matches')
    .select('id, code, name, status, scheduled_at')
    .eq('code', params.matchId)  // ✅ Dùng matches.code (public)
```

**Status**: ✅ OK

- URL param `matchId` = MC nhập vào hoặc share qua `matches.code`
- Query sử dụng `code` để lookup ✅
- Fetch session theo `match.id` ✅

---

### 3️⃣ Guest Page

**Route**: `/olympia/client/guest/[matchId]`

```typescript
// ✅ CORRECT - Line 24-26
const [{ data: match }] = await Promise.all([
  olympia
    .from('matches')
    .select('id, code, name, status, scheduled_at')
    .eq('code', params.matchId)  // ✅ Dùng matches.code (public)
```

**Status**: ✅ OK

- URL param `matchId` = guest nhập vào `matches.code`
- Query sử dụng `code` để lookup ✅
- Fetch session theo `match.id` ✅

---

## ✅ CHECK PASS: Action Functions

### 1️⃣ lookupJoinCodeAction (Contestant)

**Location**: `app/(olympia)/olympia/actions.ts:471-530`

```typescript
// ✅ CORRECT - Line 490
const { data, error } = await olympia
  .from('live_sessions')
  .select(...)
  .eq('join_code', parsed.data.joinCode)  // ✅ join_code
```

**Status**: ✅ OK

- Input: `joinCode` + `playerPassword`
- Query: `.eq('join_code', joinCode)` ✅
- Return: `sessionId` (live_sessions.id) ✅

---

### 2️⃣ verifyMcPasswordAction (MC)

**Location**: `app/(olympia)/olympia/actions.ts:533-588`

```typescript
// ✅ CORRECT - Line 550
const { data: session, error } = await olympia
  .from("live_sessions")
  .select("id, match_id, mc_view_password, status")
  .eq("join_code", parsed.data.joinCode); // ✅ Dùng join_code

// ✅ CORRECT - Line 565
const { data: matchRow } = await olympia.from("matches").select("code").eq("id", session.match_id); // ✅ Dùng session.match_id FK

// ✅ CORRECT - Line 569
const matchCode = matchRow?.code ?? session.match_id;
// Returns matchCode để redirect `/olympia/client/watch/{matchCode}` ✅
```

**Status**: ✅ OK

- Input: `joinCode` + `mcPassword`
- Find session: `.eq('join_code', joinCode)` ✅
- Verify password: `mc_view_password` hash ✅
- Return: `matchCode` (matches.code) ✅

---

## 📊 Schema Alignment Check

### Correct Columns Used

| Table           | Column                    | Used By                             | Status                                  |
| --------------- | ------------------------- | ----------------------------------- | --------------------------------------- |
| `matches`       | `id` (UUID, PK)           | Admin routes                        | ✅ OK (nhưng [matchId]/page.tsx bị sai) |
| `matches`       | `code` (UNIQUE text)      | Client routes (watch, guest)        | ✅ OK                                   |
| `live_sessions` | `id` (UUID, PK)           | Client game page                    | ✅ OK (sessionId param)                 |
| `live_sessions` | `join_code` (UNIQUE text) | Contestant, MC join                 | ✅ OK                                   |
| `live_sessions` | `match_id` (FK)           | Lookups after finding session/match | ✅ OK                                   |
| `live_sessions` | `player_password` (hash)  | Contestant verify                   | ✅ OK                                   |
| `live_sessions` | `mc_view_password` (hash) | MC verify                           | ✅ OK                                   |

---

## 🎯 Action Plan

### Bước 1: Sửa Admin Match Detail (🔴 CRITICAL)

**File**: `app/(olympia)/olympia/(admin)/admin/matches/[matchId]/page.tsx`
**Thay đổi**:

- Line 75: `.eq('code', matchId)` → `.eq('id', matchId)`
- Line 446: Comment cần cập nhật (optional)

### Bước 2: Kiểm tra Workspace Errors

- Chạy ESLint/TypeScript check sau sửa
- Xác nhận không có compile errors

### Bước 3: Verify Pages Exist

- ✅ `/olympia/client/watch/[matchId]` - MC page
- ✅ `/olympia/client/guest/[matchId]` - Guest page
- ✅ `/olympia/client/game/[sessionId]` - Contestant page

---

## 🔗 Related Files to Check

```
Admin Routes:
✅ app/(olympia)/olympia/(admin)/admin/matches/page.tsx       (uses match.id) ✅
❌ app/(olympia)/olympia/(admin)/admin/matches/[matchId]/page.tsx     (BUG) 🔴
✅ app/(olympia)/olympia/(admin)/admin/rooms/page.tsx         (mostly OK)

Client Routes:
✅ app/(olympia)/olympia/(client)/client/game/[sessionId]/page.tsx    (uses join_code) ✅
✅ app/(olympia)/olympia/(client)/client/watch/[matchId]/page.tsx     (uses code) ✅
✅ app/(olympia)/olympia/(client)/client/guest/[matchId]/page.tsx     (uses code) ✅

Actions:
✅ app/(olympia)/olympia/actions.ts:lookupJoinCodeAction()    (uses join_code) ✅
✅ app/(olympia)/olympia/actions.ts:verifyMcPasswordAction()  (uses join_code + code) ✅
```

---

## 📝 Schema Reference (Verified)

```sql
olympia.matches:
  - id UUID NOT NULL DEFAULT gen_random_uuid() [PK]
  - code text (UNIQUE) -- dùng cho public routes (client)
  - name, status, scheduled_at, ...

olympia.live_sessions:
  - id UUID NOT NULL DEFAULT gen_random_uuid() [PK]
  - match_id UUID NOT NULL [FK → matches.id]
  - join_code text NOT NULL UNIQUE -- dùng cho contestant/MC
  - player_password text (hash) -- contestant
  - mc_view_password text (hash) -- MC
  - status, question_state, ...
```

---

**Kết luận**: 1 critical bug cần sửa ngay, các routes còn lại đã ok.
