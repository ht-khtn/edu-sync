-- Tối ưu hiệu năng cho các truy vấn thường dùng trong Olympia.
-- Mục tiêu: giảm độ trễ (latency) khi host thao tác (chuyển câu/chấm điểm).

create index if not exists live_sessions_match_id_idx
on olympia.live_sessions (match_id);

create index if not exists round_questions_match_round_order_idx
on olympia.round_questions (match_round_id, order_index);

create index if not exists match_scores_match_player_round_idx
on olympia.match_scores (match_id, player_id, round_type);

create index if not exists star_uses_match_question_player_idx
on olympia.star_uses (match_id, round_question_id, player_id);

create index if not exists answers_match_player_question_submitted_idx
on olympia.answers (match_id, player_id, round_question_id, submitted_at desc);
