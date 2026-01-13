# Olympia Realtime - Kế hoạch triển khai tối ưu & đo lường

Ngày: 2026-01-13

Mục tiêu triển khai:

- Đo được end-to-end latency theo `traceId` cho 3 flow (đổi câu / submit / chấm điểm).
- Xác định bottleneck theo ms (p50/p95/p99).
- Chuẩn bị phương án kiến trúc Dual-path (Fast + Safe) nếu mục tiêu <100ms không đạt với `postgres_changes`.

## A) Chuẩn bị môi trường (không thay đổi hành vi người dùng)

### A1) Bật tracing

**Task**

- Bật log tracing trên server + client.

**Cấu hình**

- Vercel env:
  - `OLYMPIA_TRACE=1`
  - (tuỳ chọn) `OLYMPIA_PERF_TRACE=1`
- Client env:
  - `NEXT_PUBLIC_OLYMPIA_TRACE=1`

**Expected output**

- Browser console có `[Olympia][Trace] layer:'client'`.
- Vercel logs có `[Olympia][Trace] layer:'server'`.

### A2) Checklist dữ liệu thu thập

**Task**

- Thu log đủ để ghép theo `traceId`.

**Cần thu**

- 10 trace đổi câu (host thao tác liên tiếp)
- 10 trace submit answer (1–2 player)
- 10 trace chấm điểm (host confirm)
- Vercel logs trong cùng khoảng thời gian

**Expected output**

- File log text/json (copy/paste) có thể lọc theo `traceId`.

## B) Hoàn thiện log chuẩn (timestamp + payload_size)

### B1) Chuẩn hoá format log

Format mục tiêu:
`[trace_id] [layer] [event] [timestamp] [duration_ms] [payload_size]`

**Task**

- Bổ sung `ts` (`new Date().toISOString()`).
- Bổ sung `payloadBytes` cho event có payload (ước lượng theo `JSON.stringify`).

**Files sẽ sửa**

- app/(olympia)/olympia/actions.ts
- components/olympia/shared/game/OlympiaGameClient.tsx
- components/olympia/shared/game/useOlympiaGameState.ts (log receive)

**Expected output**

- Tất cả log trace có đủ trường.

## C) Đo “DB commit → client receive”

### C1) Thêm log tại điểm receive

**Task**

- Log ngay khi callback `postgres_changes` chạy (live_sessions/match_scores/answers).

**Files**

- components/olympia/shared/game/useOlympiaGameState.ts
- components/olympia/admin/matches/HostRealtimeEventsListener.tsx

**Expected output**

- Có thể tính:
  - server `db.live_sessions.update` → client receive live_sessions
  - server `db.match_scores.upsert` → client receive match_scores

## D) Xếp hạng bottleneck theo ms (sau khi có log)

**Task**

- Gom theo `traceId`.
- Tính durations theo segment.
- Xếp hạng theo p95/p99.

**Expected output**

- 1 bảng breakdown (CSV/Markdown) + ranking bottleneck.

## E) Audit Supabase (triggers/realtime/region)

### E1) Triggers

Chạy trên Supabase SQL editor:

- `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public';`
- Khuyến nghị thêm: `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'olympia';`

**Expected output**

- Có/không triggers ảnh hưởng scoring.

### E2) Region

**Task**

- Ghi nhận Supabase region + Vercel region.

**Expected output**

- Đánh giá trần latency vật lý (RTT) để biết <100ms có khả thi.

## F) Rollout kiến trúc tối ưu (nếu cần <100ms)

### F1) Pha 1: giữ `postgres_changes`, tối ưu refresh/poll

**Task**

- Giảm `router.refresh()` ở hot path.
- Polling thích ứng (đã có) + hạn chế poll khi WS OK.

**Expected output**

- Latency median giảm, load DB giảm.

### F2) Pha 2: Dual-path (Fast + Safe)

**Task**

- Thêm fast event channel (broadcast) cho event critical: `question_changed`, `score_updated`.
- Clients apply fast event ngay, reconcile với DB events.

**Expected output**

- UI phản hồi nhanh hơn so với chờ commit DB.

## G) Checklist deploy & monitoring

**Deploy**

- Env tracing bật theo môi trường (preview/prod).
- Không log PII/answer_text nếu không cần.

**Monitoring**

- Theo dõi p95:
  - `msAwaitServerAction` (client)
  - `msTotal` (server)
  - `receiveLag` (server update → client receive)
- Alert khi WS `CHANNEL_ERROR/TIMED_OUT` tăng.
