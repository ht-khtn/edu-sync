-- Lưu command điều khiển phát media chỉ dành cho trang guest.
-- Trạng thái dạng JSONB để dễ mở rộng (audio/video).

alter table if exists olympia.live_sessions
add column if not exists guest_media_control jsonb not null default '{}'::jsonb;
