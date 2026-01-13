# Olympia Realtime Audit & Performance Report (Next.js App Router + Supabase + Vercel)

Ngày: 2026-01-13

## 0) Tóm tắt điều đã làm được (theo code thực tế)

- Trace được 3 luồng chính dựa trên code đang chạy: host đổi câu, client gửi đáp án, server chấm điểm.
- Xác định realtime hiện tại chủ yếu là **DB write → Supabase Realtime `postgres_changes` → client setState/router.refresh**.
- Thêm tracing có `traceId` cho client/server actions để **đo latency theo từng segment** (nhưng chưa có log runtime để lập bảng ms).
- Giảm tải và jitter do polling bằng cơ chế **polling thích ứng** (khi realtime OK thì poll thưa; khi realtime lỗi thì poll dày).

## 1) Phạm vi & mục tiêu

Mục tiêu:

- Độ trễ end-to-end (host action → client thấy) < 100ms **nếu có thể**.
- UI không “đứng” theo DB (không chặn render); realtime “tuyệt đối” trong phạm vi có thể.
- Stack: Next.js App Router + Supabase + Vercel.

Nguyên tắc vận hành report:

- Không kết luận ms khi chưa có log runtime.
- Mọi kết luận đều kèm dẫn chứng file/function.

## 2) Kiến trúc hiện tại (ASCII)

```
[Host UI (Client Components)]
   | <form action={...server action...}>
   v
[Next.js Server Actions]
   | supabase.schema('olympia').from(...).update/insert
   v
[Postgres (schema olympia)]
   | commit
   v
[Supabase Realtime: postgres_changes]
   | websocket event
   v
[Clients]
  - Host: HostRealtimeEventsListener dispatch local events + đôi lúc router.refresh
  - Player: useOlympiaGameState setState + fallback polling + đôi lúc router.refresh
```

Dẫn chứng file:

- Server actions: app/(olympia)/olympia/actions.ts
- Host realtime listener: components/olympia/admin/matches/HostRealtimeEventsListener.tsx
- Player realtime hook: components/olympia/shared/game/useOlympiaGameState.ts
- Global schedule listener (router.refresh): components/olympia/shared/OlympiaRealtimeListener.tsx

## 3) Trace 3 luồng chính (bám sát code)

### 3.1 Host chuyển câu hỏi

**Entry point (server actions):**

- `setCurrentQuestionAction` (đặt câu hiện tại)
- `advanceCurrentQuestionAction` (next/prev)

**DB writes chính:**

- Update `olympia.live_sessions` (đổi `current_round_question_id`, `question_state`, `buzzer_enabled`, …)
- Insert `olympia.buzzer_events` với `event_type='reset'` (mốc reset để client lọc buzzer/response_time)

**Realtime receive:**

- Host: `HostRealtimeEventsListener` subscribe `live_sessions`, `star_uses`, `answers`, `buzzer_events`
  - Tránh refresh toàn trang; chỉ `router.refresh()` khi đổi vòng (roundChanged).
- Player: `useOlympiaGameState` subscribe `live_sessions` (drives `question_state/timer`) và update UI ngay.

**ASCII flow:**

```
Host UI
  -> Server Action (setCurrentQuestionAction | advanceCurrentQuestionAction)
     -> DB: live_sessions.update
     -> DB: buzzer_events.insert(reset)
     -> return
  -> Realtime: postgres_changes
     -> Host listener: dispatchHostSessionUpdate(...) (+ refresh khi đổi vòng)
     -> Player hook: setSession(...) => UI đổi câu
     -> Poll fallback (khi WS lỗi/RLS chặn)
```

### 3.2 Client trả lời (submit)

**Entry point (client):**

- components/olympia/shared/game/OlympiaGameClient.tsx: `<form action={answerAction}>`

**Server action:**

- `submitAnswerAction`

**DB writes:**

- Insert `olympia.answers`.
- Riêng vòng `tang_toc` có `autoMarkCorrect` (set `is_correct` boolean theo loose matching), nhưng **chưa ghi điểm**.

**Realtime receive:**

- Player hook có subscribe `answers` (lọc theo câu hiện tại/VCNV) để update list.
- Host listener subscribe `answers` nhưng cố tình không refresh toàn trang (để tránh SSR chậm).

### 3.3 Chấm điểm

**Entry point:**

- Host dùng `confirmDecisionAction` hoặc `confirmDecisionAndAdvanceAction`.

**Grading nằm ở:**

- Server (không phải client).

**DB writes:**

- Upsert `olympia.match_scores` (update/inser tuỳ có row).
- Update `olympia.answers` latest (set `is_correct`, `points_awarded`).
- Insert audit `olympia.score_changes` (không chặn luồng nếu audit fail).

**Transaction:**

- Không thấy transaction explicit (không stored proc / rpc cho một giao dịch atomic). Rủi ro partial write được chấp nhận theo thiết kế hiện tại.

## 4) Logging & Tracing (đã triển khai)

### 4.1 Format log đang có

Đã có log theo `traceId`, `layer`, `event`, duration (ms) dạng:

- Client: `[Olympia][Trace] { layer:'client', traceId, action, event, msAwaitServerAction, ok }`
- Server: `[Olympia][Trace] { layer:'server', traceId, action, event, msSinceStart|msTotal, ... }`

Env flags:

- Server: `OLYMPIA_TRACE=1` (hoặc `OLYMPIA_PERF_TRACE=1`)
- Client: `NEXT_PUBLIC_OLYMPIA_TRACE=1`

File đã gắn log:

- app/(olympia)/olympia/actions.ts
- components/olympia/shared/game/OlympiaGameClient.tsx

Lưu ý: format bạn yêu cầu có `timestamp`/`payload_size`. Hiện timestamp implicit (thời điểm log) và payload_size chưa chuẩn hoá.

### 4.2 Điểm cần thêm log (chưa làm)

Để tính chính xác segment “DB commit → client receive” cần thêm log ở client listener:

- `useOlympiaGameState.ts` trong callback `.on('postgres_changes', ...)` cho `live_sessions`, `match_scores`, `answers`.

## 5) Các điểm gây trễ (chưa thể xếp hạng theo ms do thiếu log runtime)

Những nguồn trễ có khả năng (cần đo):

- HTTP/server action latency (Vercel function cold start, auth, network).
- DB latency (query/update/insert).
- Supabase Realtime propagation (postgres_changes).
- Next.js render/hydration (đặc biệt nếu `router.refresh()` bị kích hoạt).
- Payload size / fan-out event (subscribe nhiều bảng gây nhiều setState).

Trạng thái: **BLOCKED** cho phần “ms + ranking” cho đến khi có sample logs.

## 6) Fast / Safe / Control path (theo thiết kế hiện tại)

```
FAST PATH (mục tiêu <100ms)
- Client apply state ngay khi nhận WS event
- Host local dispatch (optimistic) để né refresh toàn trang

SAFE PATH
- DB writes (live_sessions/match_scores/answers/buzzer_events/score_changes)
- Poll fallback khi realtime lỗi

CONTROL PATH
- Admin gate: requireOlympiaAdminContext (participants.role='AD')
- Player auth/membership checks (match_players)
```

Ghi chú quan trọng: hiện tại FAST PATH vẫn phụ thuộc SAFE PATH vì event là `postgres_changes` (sau commit DB).

## 7) Audit Next.js (client/server/actions)

### 7.1 Client components

Có rất nhiều file `use client` trong components/olympia/** và một số app/(olympia)/** (các route error, mc join).

### 7.2 Server actions

- actions tập trung lớn: app/(olympia)/olympia/actions.ts
- actions question bank: app/(olympia)/olympia/(admin)/admin/question-bank/actions.ts

### 7.3 Nhận diện rủi ro

- `router.refresh()` xuất hiện ở nhiều chỗ; refresh toàn trang có thể phá mục tiêu <100ms nếu bị kích hoạt thường xuyên.
- Player hook subscribe nhiều bảng + poll fallback: nguy cơ rerender dây chuyền.

### 7.4 Refactor plan (đề xuất)

Tách `actions.ts` theo domain để dễ kiểm soát latency và tách luồng realtime-critical:

- actions/session.ts
- actions/question.ts
- actions/answer.ts
- actions/scoring.ts
- actions/admin.ts

## 8) Kiến trúc đề xuất tối ưu (để có cơ hội <100ms)

Mục tiêu: tạo Dual-path:

- FAST: broadcast/optimistic event để UI cập nhật ngay (không chờ DB commit).
- SAFE: DB commit + postgres_changes để reconcile.

```
Host action
  -> Server action
     -> (Fast) broadcast event: question_changed {traceId, ts, rqId}
     -> (Safe) DB update/insert
  -> Clients
     -> apply fast event ngay
     -> reconcile bằng postgres_changes
```

Tradeoff:

- Broadcast có thể đến trước commit DB ⇒ cần cơ chế reconcile/rollback.

## 9) Patch đã có trong code (đã merge vào workspace)

- Thêm tracing `traceId` cho các action chính (submit/buzzer/scoring/set/advance).
- Client game gửi `traceId` theo FormData và log `msAwaitServerAction`.
- Polling thích ứng trong player hook.

## 10) Phần còn thiếu dữ liệu để hoàn tất report (bắt buộc)

1. Sample logs (host + player browser console) cho 10 lần:

- đổi câu
- submit answer
- confirm decision

2. Server logs trên Vercel cùng timeframe.

3. Supabase triggers query:

- `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public';`
- Khuyến nghị thêm: `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'olympia';`

4. Region:

- Supabase project region
- Vercel region

Khi có 4 dữ liệu này, sẽ lập được:

- Bảng latency breakdown theo traceId
- Xếp hạng bottleneck theo ms
- Kết luận có đạt <100ms hay không và cần đổi kiến trúc mức nào.
