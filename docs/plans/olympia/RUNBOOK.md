# Olympia Realtime - Runbook thu log & xác nhận latency

## 1) Bật tracing

### 1.1 Server (Vercel)

- Set env: `OLYMPIA_TRACE=1`
- (tuỳ chọn) `OLYMPIA_PERF_TRACE=1`

### 1.2 Client

- Set env: `NEXT_PUBLIC_OLYMPIA_TRACE=1`

## 2) Kịch bản đo (bắt buộc)

Thực hiện với 2 trình duyệt/máy:

- 1 host (admin/host view)
- 1–2 player

### 2.1 Host đổi câu (10 lần)

- Bấm đổi câu liên tục 10 lần.
- Thu:
  - Browser console log host
  - Browser console log player
  - Vercel logs cùng timeframe

### 2.2 Player submit answer (10 lần)

- Player gửi đáp án 10 lần (ít nhất 2 câu khác nhau nếu được).
- Thu tương tự.

### 2.3 Host chấm điểm (10 lần)

- Host confirm đúng/sai 10 lần.
- Thu tương tự.

## 3) Cách lọc log

Tìm theo chuỗi:

- `[Olympia][Trace]` và `traceId`

Mục tiêu: gom đủ các event cho cùng 1 `traceId`:

- Client `start/end` + `msAwaitServerAction`
- Server `start` + `db.*` + `end(msTotal)`

## 3.1) Phân tích log tự động (ra bảng p50/p95/p99)

Sau khi copy/export log ra file text (ví dụ `logs.txt`), chạy:

- `node scripts/olympia-trace-analyze.cjs logs.txt > docs/plans/olympia/LATENCY_REPORT.md`

Expected output:

- File `docs/plans/olympia/LATENCY_REPORT.md` có 3 bảng:
  - Client `msAwaitServerAction`
  - Server `msTotal`
  - Realtime `receiveLagMs` theo table

## 4) Supabase checks

Chạy trên Supabase SQL editor:

- `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public';`
- Khuyến nghị thêm: `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'olympia';`

## 5) Region

Ghi lại:

- Supabase project region
- Vercel region
- RTT client→Supabase (ước lượng)

## 6) Tiêu chí pass/fail

- End-to-end latency (host action → player UI update):
  - p50 < 100ms (mục tiêu)
  - p95 < 250ms (khuyến nghị)

Nếu không đạt, chuyển sang pha Dual-path (Fast + Safe) theo IMPLEMENTATION_PLAN.
