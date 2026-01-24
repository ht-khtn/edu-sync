export type PlayerSummary = {
  seat_index: number | null;
  display_name: string | null;
};

export type PerfEntry = { label: string; ms: number };

export type CachedRoundQuestionRow = {
  id: string;
  match_round_id: string;
  order_index: number;
  question_id: string | null;
  question_set_item_id: string | null;
  target_player_id: string | null;
  meta: Record<string, unknown> | null;
  question_text: string | null;
  answer_text: string | null;
  note: string | null;
  questions:
    | { image_url?: string | null; audio_url?: string | null }
    | Array<{ image_url?: string | null; audio_url?: string | null }>
    | null;
  question_set_items:
    | { image_url?: string | null; audio_url?: string | null }
    | Array<{ image_url?: string | null; audio_url?: string | null }>
    | null;
};

export type WinnerBuzzRow = {
  id: string;
  player_id: string | null;
  result: string | null;
  occurred_at: string | null;
  match_players: PlayerSummary | PlayerSummary[] | null;
};

export type RecentBuzzRow = WinnerBuzzRow;

export type RecentAnswerRow = {
  id: string;
  player_id: string;
  answer_text: string | null;
  is_correct: boolean | null;
  points_awarded: number | null;
  submitted_at: string;
  match_players: PlayerSummary | PlayerSummary[] | null;
};

export type ScoreChangeRow = {
  id: string;
  player_id: string;
  round_type: string;
  requested_delta: number;
  applied_delta: number;
  points_before: number;
  points_after: number;
  source: string;
  reason: string | null;
  created_at: string;
  revert_of: string | null;
  reverted_at: string | null;
  match_players: PlayerSummary | PlayerSummary[] | null;
};

export type HostObstacleRow = {
  id: string;
  match_round_id: string;
  title: string | null;
  image_url: string | null;
};

export type HostObstacleTileRow = {
  id: string;
  round_question_id: string | null;
  position_index: number;
  is_open: boolean;
};

export type HostObstacleGuessRow = {
  id: string;
  player_id: string;
  guess_text: string;
  is_correct: boolean;
  attempt_order: number | null;
  attempted_at: string;
  match_players: PlayerSummary | PlayerSummary[] | null;
};

export type VcnvAnswerSummaryRow = {
  id: string;
  round_question_id: string;
  is_correct: boolean | null;
};

export type RoundQuestionRow = {
  id: string;
  match_round_id: string;
  order_index: number;
  question_id: string | null;
  question_set_item_id: string | null;
  target_player_id: string | null;
  meta: Record<string, unknown> | null;
  question_text: string | null;
  answer_text: string | null;
  note: string | null;
  questions?:
    | { image_url?: string | null; audio_url?: string | null }
    | Array<{ image_url?: string | null; audio_url?: string | null }>;
  question_set_items?:
    | { image_url?: string | null; audio_url?: string | null }
    | Array<{ image_url?: string | null; audio_url?: string | null }>;
};

export type HostData = {
  match: { id: string; name: string; status: string };
  liveSession: {
    id: string;
    match_id: string;
    status: string | null;
    join_code: string | null;
    question_state: string | null;
    current_round_type: string | null;
    current_round_id: string | null;
    current_round_question_id: string | null;
    timer_deadline: string | null;
    requires_player_password: boolean | null;
    buzzer_enabled: boolean | null;
    show_scoreboard_overlay: boolean | null;
    show_answers_overlay: boolean | null;
  } | null;
  rounds: Array<{ id: string; round_type: string; order_index: number }>;
  players: Array<{
    id: string;
    seat_index: number | null;
    display_name: string | null;
    participant_id: string | null;
    is_disqualified_obstacle: boolean | null;
  }>;
  scoreRows: Array<{ id: string; player_id: string; points: number | null }>;
  scores: Array<{
    playerId: string;
    displayName: string;
    seatNumber: number | null;
    totalScore: number;
  }>;
  roundQuestions: CachedRoundQuestionRow[];
  currentRoundQuestion: CachedRoundQuestionRow | null;
  isStarEnabled: boolean;
  isStarLocked: boolean;
  winnerBuzz: WinnerBuzzRow | null;
  recentBuzzes: RecentBuzzRow[];
  recentAnswers: RecentAnswerRow[];
  scoreChanges: ScoreChangeRow[];
  scoreChangesError: string | null;
  obstacle: HostObstacleRow | null;
  obstacleTiles: HostObstacleTileRow[];
  obstacleGuesses: HostObstacleGuessRow[];
  vcnvAnswerSummary: VcnvAnswerSummaryRow[];
};
