-- Tối ưu thêm cho chấm điểm nhanh hơn
-- Xử lý N+1 queries và thiếu indexes cho buzzer_events

-- Index cho buzzer_events (query trong confirmDecisionAction)
create index if not exists buzzer_events_round_question_event_result_idx
on olympia.buzzer_events (round_question_id, event_type, result);

-- Index cho round_questions lookup (cần cả match_id để có thể scan ít)
create index if not exists round_questions_match_round_id_idx
on olympia.round_questions (match_round_id);

-- Index bổ sung cho answers: match_id + round_question_id + player_id để tối ưu hơn
create index if not exists answers_match_question_player_idx
on olympia.answers (match_id, round_question_id, player_id);
