export type LiveSessionRow = {
  id: string;
  match_id: string;
  status: string;
  join_code: string;
  question_state: string | null;
  current_round_id: string | null;
  current_round_type: string | null;
  current_round_question_id: string | null;
  timer_deadline: string | null;
  requires_player_password?: boolean;
};

export type MatchRow = {
  id: string;
  name: string;
  status: string;
  scheduled_at: string | null;
};

export type PlayerRow = {
  id: string;
  match_id: string;
  participant_id: string;
  display_name: string | null;
  seat_index: number;
  is_disqualified_obstacle: boolean;
};

export type ScoreRow = {
  id?: string;
  match_id?: string;
  player_id: string;
  total_score: number | null;
  round_type: string | null;
};

export type RoundQuestionRow = {
  id: string;
  match_id?: string | null;
  round_id: string | null;
  round_type: string | null;
  sequence: number | null;
  question_id: string | null;
  target_player_id: string | null;
};

export type BuzzerEventRow = {
  id?: string;
  match_id?: string | null;
  player_id?: string | null;
  state?: string | null;
  event_type?: string | null;
  created_at?: string | null;
};

export type GameSessionPayload = {
  session: LiveSessionRow;
  match: MatchRow;
  players: PlayerRow[];
  scores: ScoreRow[];
  roundQuestions: RoundQuestionRow[];
  buzzerEvents: BuzzerEventRow[];
  serverTimestamp: string;
  viewerUserId: string | null;
};
