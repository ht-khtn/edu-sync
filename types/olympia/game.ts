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
  points: number | null;
  round_type: string | null;
};

export type RoundQuestionRow = {
  id: string;
  match_round_id: string | null;
  question_id: string | null;
  order_index: number | null;
  target_player_id: string | null;
  meta?: Record<string, unknown> | null;
  // Supabase join có thể trả về object (many-to-one) hoặc mảng (tuỳ select/alias).
  match_rounds?:
    | {
        match_id?: string | null;
        round_type?: string | null;
      }
    | Array<{
        match_id?: string | null;
        round_type?: string | null;
      }>
    | null;
};

export type BuzzerEventRow = {
  id?: string;
  match_id?: string | null;
  round_question_id?: string | null;
  player_id?: string | null;
  event_type?: string | null;
  result?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
};

export type ObstacleRow = {
  id: string;
  match_round_id: string;
  title: string | null;
  final_keyword: string;
  image_url: string | null;
  meta?: Record<string, unknown> | null;
};

export type ObstacleTileRow = {
  id: string;
  obstacle_id: string;
  round_question_id: string | null;
  position_index: number;
  is_open: boolean;
};

export type ObstacleGuessRow = {
  id: string;
  obstacle_id: string;
  player_id: string;
  guess_text: string;
  is_correct: boolean;
  attempt_order: number | null;
  attempted_at: string;
};

export type StarUseRow = {
  id: string;
  match_id: string;
  round_question_id: string;
  player_id: string;
  outcome: string | null;
  declared_at: string;
};

export type GameSessionPayload = {
  session: LiveSessionRow;
  match: MatchRow;
  players: PlayerRow[];
  scores: ScoreRow[];
  roundQuestions: RoundQuestionRow[];
  buzzerEvents: BuzzerEventRow[];
  starUses?: StarUseRow[];
  obstacle?: ObstacleRow | null;
  obstacleTiles?: ObstacleTileRow[];
  obstacleGuesses?: ObstacleGuessRow[];
  serverTimestamp: string;
  viewerUserId: string | null;
};
