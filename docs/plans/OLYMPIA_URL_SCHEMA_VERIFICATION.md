# Kiểm tra Cơ chế Fetch URL và Schema Olympia

## 📋 Tóm tắt yêu cầu

Kiểm tra và xác nhận:

1. **Admin Routes**: Sử dụng `match.id` (UUID) để fetch dữ liệu
2. **Client Routes** (Join Phòng): Sử dụng `live_sessions.join_code` để fetch dữ liệu
3. **MC & Guest Pages**: Đã tạo và sử dụng đúng cột schema
4. **Schema Alignment**: Tất cả queries đều sử dụng đúng tên cột từ schema

---

## 🎯 Danh sách kiểm tra

### 1. Admin Routes - Match Management

#### File cần kiểm tra:

- `app/(olympia)/olympia/(admin)/admin/matches/page.tsx` → Admin matches list
- `app/(olympia)/olympia/(admin)/admin/matches/[matchId]/page.tsx` → Match detail
- `app/(olympia)/olympia/(admin)/admin/rooms/page.tsx` → Live sessions admin view

#### Yêu cầu:

- ✅ Admin routes dùng `matches.id` (UUID) không dùng `matches.code`
- ✅ Fetch `live_sessions` bằng `match_id` (FK)
- ✅ Thao tác với `matches` table sử dụng `eq('id', matchId)`

#### Schema Columns Cần Dùng:

```sql
olympia.matches:
  - id (UUID, PK) ✅
  - code (text, UNIQUE) - chỉ dùng khi cần hiển thị cho client
  - name, status, scheduled_at, ...

olympia.live_sessions:
  - id (UUID, PK)
  - match_id (UUID, FK → matches.id)
  - join_code (text, UNIQUE)
  - player_password (hash)
  - mc_view_password (hash)
```

---

### 2. Client Routes - Join Phòng

#### A. Contestant (Thí sinh)

**Route**: `/olympia/client/game/[sessionId]`
**URL Param**: `sessionId` = `live_sessions.id` hoặc `join_code`?

Kiểm tra:

- `app/(olympia)/olympia/(client)/client/game/[sessionId]/page.tsx`
  - Dùng `eq('join_code', sessionId)` hay `eq('id', sessionId)`?
  - **Kỳ vọng**: Dùng `join_code` (public route)

**lookupJoinCodeAction**:

- Input: `joinCode` + `playerPassword`
- Query: `from('live_sessions').select(...).eq('join_code', joinCode)`
- Output: Session `id` để redirect tới `/olympia/client/game/{sessionId}`

#### B. MC (Người dẫn chương trình)

**Route**: `/olympia/client/watch/[matchId]`
**URL Param**: `matchId` = `matches.code` (public identifier)

Kiểm tra:

- `app/(olympia)/olympia/(client)/client/watch/[matchId]/page.tsx`
  - Dùng `eq('code', matchId)` tìm match
  - Sau đó dùng `match.id` để fetch `live_sessions`

**verifyMcPasswordAction**:

- Input: `joinCode` + `mcPassword`
- Query: Tìm `live_sessions` bằng `join_code`
- Xác minh: `mc_view_password` (hash)
- Output: Return `matchCode` hay `matchId`?

#### C. Guest (Khách)

**Route**: `/olympia/client/guest/[matchId]`
**URL Param**: `matchId` = `matches.code`

Kiểm tra:

- `app/(olympia)/olympia/(client)/client/guest/[matchId]/page.tsx`
  - Dùng `eq('code', matchId)` để tìm match
  - Fetch `live_sessions` bằng `match.id`

#### Schema Columns Cần Dùng:

```sql
olympia.matches:
  - id (UUID, PK) → dùng khi query từ admin
  - code (text, UNIQUE) → dùng khi query từ client (join_code route)

olympia.live_sessions:
  - id (UUID, PK) → sessionId trong URL
  - join_code (text, UNIQUE) → dùng bởi contestant & MC
  - match_id (UUID, FK) → lookup match details
```

---

### 3. MC & Guest Pages Status

#### Trang MC (Watch)

- **Route**: `/olympia/client/watch/[matchId]`
- **File**: `app/(olympia)/olympia/(client)/client/watch/[matchId]/page.tsx`
- **Status**: ✅ Tồn tại
- **URL Param Usage**: `matchId` → lookup `matches.code`

#### Trang Guest

- **Route**: `/olympia/client/guest/[matchId]`
- **File**: `app/(olympia)/olympia/(client)/client/guest/[matchId]/page.tsx`
- **Status**: ✅ Tồn tại
- **URL Param Usage**: `matchId` → lookup `matches.code`

---

## 🔍 Chi tiết kiểm tra

### Admin Routes Detail Check

**1. Matches List** (`/olympia/admin/matches`)

```typescript
// ✅ CORRECT
const { data: matches } = await olympia
  .from("matches")
  .select("id, name, status, ...")
  .order("created_at", { ascending: false });

// Link to detail:
// <Link href={`/olympia/admin/matches/${match.id}`}>
```

**2. Match Detail** (`/olympia/admin/matches/[matchId]`)

```typescript
// ✅ CORRECT - dùng params.matchId (UUID)
const { data: match } = await olympia.from("matches").select("...").eq("id", matchId); // ✅ Dùng match.id

// Fetch live session:
const { data: session } = await olympia.from("live_sessions").select("...").eq("match_id", matchId); // ✅ Dùng match_id FK
```

**3. Rooms/Sessions** (`/olympia/admin/rooms`)

```typescript
// ✅ CORRECT
const { data: sessions } = await olympia
  .from("live_sessions")
  .select("id, match_id, join_code, status, ...");

// Lookup match:
const { data: matches } = await olympia.from("matches").select("id, name, code, status");
```

---

### Client Routes Detail Check

**1. Game Page** (`/olympia/client/game/[sessionId]`)

```typescript
// Current implementation: params.sessionId
// ❓ VERIFY: Is sessionId the join_code or session id?

// Expected (if join_code):
const { data: session } = await olympia
  .from("live_sessions")
  .select("...")
  .eq("join_code", sessionId); // ✅ join_code is public

// Expected (if session id):
const { data: session } = await olympia.from("live_sessions").select("...").eq("id", sessionId); // ❌ Not public, shouldn't be in URL
```

**2. Watch Page (MC)** (`/olympia/client/watch/[matchId]`)

```typescript
// ✅ CORRECT - matchId is matches.code (public)
const { data: match } = await olympia
  .from("matches")
  .select("id, code, name, status")
  .eq("code", matchId); // ✅ Dùng matches.code

// Fetch session:
const { data: session } = await olympia
  .from("live_sessions")
  .select("join_code, status, ...")
  .eq("match_id", match.id); // ✅ Dùng match.id từ lookup
```

**3. Guest Page** (`/olympia/client/guest/[matchId]`)

```typescript
// ✅ CORRECT - matchId is matches.code (public)
const { data: match } = await olympia
  .from("matches")
  .select("id, code, name, status")
  .eq("code", matchId); // ✅ Dùng matches.code

// Fetch session:
const { data: session } = await olympia
  .from("live_sessions")
  .select("join_code, status, ...")
  .eq("match_id", match.id); // ✅ Dùng match.id từ lookup
```

---

## 🛠️ Action Functions Check

### 1. lookupJoinCodeAction

**Purpose**: Contestant join phòng
**Input**: `joinCode` + `playerPassword`
**Current Implementation**:

```typescript
const { data, error } = await olympia
  .from("live_sessions")
  .select("id, status, match_id, question_state, ...")
  .eq("join_code", parsed.data.joinCode) // ✅ CORRECT
  .maybeSingle();
```

**Return**: `sessionId` → redirect tới `/olympia/client/game/{sessionId}`
**Status**: ✅ OK

### 2. verifyMcPasswordAction

**Purpose**: MC xác minh mật khẩu và vào watch page
**Input**: `joinCode` + `mcPassword`
**Expected Query**:

```typescript
// Find session by join_code
const { data: session } = await olympia
  .from("live_sessions")
  .select("id, match_id, mc_view_password, status")
  .eq("join_code", joinCode); // ✅ Dùng join_code

// Find match by match_id
const { data: match } = await olympia
  .from("matches")
  .select("id, code, name")
  .eq("id", session.match_id); // ✅ Dùng match_id

// Return: matchCode để redirect `/olympia/client/watch/{matchCode}`
```

**Status**: ❓ Cần verify

---

## ✅ Checklist

- [ ] Admin routes đều dùng `matches.id` (UUID)
- [ ] Admin `live_sessions` lookup dùng `match_id` FK
- [ ] Client `game` page dùng `join_code` (public)
- [ ] Client `watch` page dùng `matches.code` (public)
- [ ] Client `guest` page dùng `matches.code` (public)
- [ ] `verifyMcPasswordAction` trả về `matchCode` (không phải `matchId`)
- [ ] Tất cả schema columns align với olympia-schema.sql
- [ ] Không có TypeScript/ESLint errors
- [ ] No hardcoded IDs trong URLs (chỉ dùng public columns)

---

## 📝 Ghi chú

- **Public columns**: `matches.code`, `live_sessions.join_code`
- **Internal columns**: `matches.id`, `live_sessions.id`, `match_id` (FK)
- Admin có quyền truy cập cả public và internal columns
- Client chỉ nên truy cập public columns qua URL
