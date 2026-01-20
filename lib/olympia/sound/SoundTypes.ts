// Sound system type definitions and interfaces

export type PlaybackState = 'playing' | 'paused' | 'stopped';
export type RoundType = 'khoi_dong' | 'vcnv' | 'tang_toc' | 've_dich';
export type SoundGroup = 'BACKGROUND' | 'COUNTDOWN' | 'SCORING' | 'QUESTION_REVEAL' | 'INTERACTION' | 'ROUND_END';

export interface SoundDef {
  file: string;
  autoStopWhenOtherPlays?: boolean;
  loop?: boolean;
  volume?: number;
}

export interface OlympiaSoundConfig {
  meta: {
    version: string;
    default: {
      autoStopWhenOtherPlays: boolean;
      loop: boolean;
      volume: number;
    };
  };
  sounds: Record<string, SoundDef>;
}

export interface PlayOptions {
  delay?: number;
  onEnd?: () => void;
  forceOverride?: boolean;
}

export interface PlayResult {
  success: boolean;
  error?: string;
}

export interface CacheStatus {
  loaded: string[];
  failed: string[];
  pending: string[];
}

export interface SoundState {
  state: PlaybackState;
  sourceNode?: AudioBufferSourceNode;
  gainNode?: GainNode;
  startTime?: number;
}

export interface PreloadBatchResult {
  loaded: string[];
  failed: string[];
}

export enum GameEvent {
  ROUND_STARTED = 'ROUND_STARTED',
  QUESTION_REVEALED = 'QUESTION_REVEALED',
  TIMER_STARTED = 'TIMER_STARTED',
  CORRECT_ANSWER = 'CORRECT_ANSWER',
  WRONG_ANSWER = 'WRONG_ANSWER',
  TIMER_ENDED = 'TIMER_ENDED',
  ROUND_ENDED = 'ROUND_ENDED',
  STAR_REVEALED = 'STAR_REVEALED',
  SELECT_ROW = 'SELECT_ROW',
  SELECT_CATEGORY = 'SELECT_CATEGORY',
  REVEAL_ANSWER = 'REVEAL_ANSWER',
  OPEN_IMAGE = 'OPEN_IMAGE',
  OPEN_TILE = 'OPEN_TILE',
  SESSION_ENDED = 'SESSION_ENDED',
}

export interface GameEventPayload {
  roundType?: RoundType;
  playerId?: string;
  hasVideo?: boolean;
  durationMs?: number;
  [key: string]: unknown;
}

export const PRIORITY = {
  NORMAL: 0,
  TIMER_BLOCKING: 50,
  CRITICAL: 100,
  STAR_MAXIMUM: 999,
} as const;

export const SOUND_GROUPS: Record<SoundGroup, string[]> = {
  BACKGROUND: ['kd_bat_dau_choi'],
  COUNTDOWN: ['kd_dem_gio_5s', 'vcnv_dem_gio_15s', 'tt_dem_gio_20s', 'tt_dem_gio_30s', 'vd_dem_gio_15s', 'vd_dem_gio_20s'],
  SCORING: ['kd_dung', 'kd_sai', 'vcnv_dung', 'vd_dung', 'vd_sai', 'vd_ngoi_sao'],
  QUESTION_REVEAL: ['kd_hien_cau_hoi', 'vcnv_mo_cau_hoi', 'tt_mo_cau_hoi', 'vd_lua_chon_goi'],
  INTERACTION: ['vcnv_mo_o_chu', 'vcnv_chon_hang_ngang', 'vcnv_mo_hinh_anh', 'tt_mo_dap_an', 'vd_cac_goi'],
  ROUND_END: ['kd_hoan_thanh', 'vd_hoan_thanh', 'tong_ket_ket_qua'],
};

export const TIMING_CONFIG = {
  ROUND_START_DELAY_MS: 3000,
  CORRECT_ANSWER_WAIT_MS: 2000,
  WRONG_ANSWER_WAIT_MS: 2000,
  REVEAL_ANSWER_OVERLAP_MS: 1000,
} as const;
