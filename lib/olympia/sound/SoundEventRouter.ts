import type { GameEventPayload, RoundType } from './SoundTypes';
import { GameEvent, TIMING_CONFIG } from './SoundTypes';
import { SoundController } from './SoundController';

export class SoundEventRouter {
  private soundController: SoundController;
  private timingMap: Map<RoundType, string> = new Map([
    ['khoi_dong', 'kd_dem_gio_5s'],
    ['vcnv', 'vcnv_dem_gio_15s'],
    ['tang_toc', 'tt_dem_gio_20s'],
    ['ve_dich', 'vd_dem_gio_15s'],
  ]);
  private roundBackgroundMap: Map<RoundType, string> = new Map([
    ['khoi_dong', 'kd_bat_dau_choi'],
    ['vcnv', 'vcnv_mo_cau_hoi'],
    ['tang_toc', 'tt_mo_cau_hoi'],
    ['ve_dich', 'vd_cac_goi'],
  ]);
  private timeoutIds: Map<string, NodeJS.Timeout> = new Map();

  constructor(soundController: SoundController) {
    this.soundController = soundController;
  }

  async routeEvent(event: GameEvent | string, payload?: GameEventPayload): Promise<void> {
    const eventKey = typeof event === 'string' ? event : event;

    switch (eventKey) {
      case GameEvent.ROUND_STARTED:
        await this.handleRoundStarted(payload);
        break;
      case GameEvent.QUESTION_REVEALED:
        await this.handleQuestionRevealed();
        break;
      case GameEvent.TIMER_STARTED:
        await this.handleTimerStarted(payload);
        break;
      case GameEvent.CORRECT_ANSWER:
        await this.handleCorrectAnswer(payload);
        break;
      case GameEvent.WRONG_ANSWER:
        await this.handleWrongAnswer(payload);
        break;
      case GameEvent.TIMER_ENDED:
        await this.handleTimerEnded(payload);
        break;
      case GameEvent.ROUND_ENDED:
        await this.handleRoundEnded(payload);
        break;
      case GameEvent.STAR_REVEALED:
        await this.handleStarRevealed();
        break;
      case GameEvent.SELECT_ROW:
        await this.handleSelectRow();
        break;
      case GameEvent.SELECT_CATEGORY:
        await this.handleSelectCategory();
        break;
      case GameEvent.REVEAL_ANSWER:
        await this.handleRevealAnswer();
        break;
      case GameEvent.SESSION_ENDED:
        await this.handleSessionEnded();
        break;
      default:
        console.warn(`[SoundRouter] Unknown event: ${eventKey}`);
    }
  }

  private async handleRoundStarted(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;
    if (!roundType) {
      console.warn('[SoundRouter] No roundType in ROUND_STARTED');
      return;
    }

    this.soundController.stopAll();

    const startSound = roundType === 'khoi_dong' ? 'kd_bat_dau_choi' : this.roundBackgroundMap.get(roundType);
    if (startSound) {
      await this.soundController.play(startSound);
    }

    if (roundType === 'khoi_dong') {
      const timeoutId = setTimeout(() => {
        this.soundController.play('kd_hien_cau_hoi', {
          onEnd: () => {
            // UI can now show question
          },
        });
      }, TIMING_CONFIG.ROUND_START_DELAY_MS);
      this.timeoutIds.set('kd_question_reveal', timeoutId);
    }
  }

  private async handleQuestionRevealed(): Promise<void> {
    // UI event only, no sound action needed
  }

  private async handleTimerStarted(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;
    const hasVideo = payload?.hasVideo;

    if (!roundType) return;

    if (roundType === 'tang_toc' && hasVideo) {
      // NO timer sound for video
      return;
    }

    const timerSound = this.timingMap.get(roundType);
    if (timerSound) {
      await this.soundController.play(timerSound);
    }
  }

  private async handleCorrectAnswer(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;
    if (!roundType) return;

    // Stop timer
    const timerSound = this.timingMap.get(roundType);
    if (timerSound) {
      this.soundController.stop(timerSound);
    }

    // Play correct answer sound
    const correctSoundMap: Record<RoundType, string> = {
      khoi_dong: 'kd_dung',
      vcnv: 'vcnv_dung',
      tang_toc: 'vcnv_dung',
      ve_dich: 'vd_dung',
    };

    const correctSound = correctSoundMap[roundType];
    if (correctSound) {
      await this.soundController.play(correctSound);
    }
  }

  private async handleWrongAnswer(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;
    if (!roundType) return;

    // Stop timer
    const timerSound = this.timingMap.get(roundType);
    if (timerSound) {
      this.soundController.stop(timerSound);
    }

    // Play wrong answer sound
    const wrongSoundMap: Partial<Record<RoundType, string>> = {
      khoi_dong: 'kd_sai',
      ve_dich: 'vd_sai',
    };

    const wrongSound = wrongSoundMap[roundType];
    if (wrongSound) {
      await this.soundController.play(wrongSound);
    }
  }

  private async handleTimerEnded(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;
    if (!roundType) return;

    const timerSound = this.timingMap.get(roundType);
    if (timerSound) {
      this.soundController.stop(timerSound);
    }
  }

  private async handleRoundEnded(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;

    this.soundController.stopAll();
    this.clearTimeouts();

    if (!roundType) return;

    const endSoundMap: Partial<Record<RoundType, string>> = {
      khoi_dong: 'kd_hoan_thanh',
      ve_dich: 'vd_hoan_thanh',
    };

    const endSound = endSoundMap[roundType];
    if (endSound) {
      await this.soundController.play(endSound);
    }
  }

  private async handleStarRevealed(): Promise<void> {
    this.soundController.stopAll();
    await this.soundController.play('vd_ngoi_sao');
  }

  private async handleSelectRow(): Promise<void> {
    await this.soundController.play('vcnv_chon_hang_ngang', {
      onEnd: () => {
        this.soundController.play('vcnv_mo_cau_hoi');
      },
    });
  }

  private async handleSelectCategory(): Promise<void> {
    await this.soundController.play('vd_lua_chon_goi');
  }

  private async handleRevealAnswer(): Promise<void> {
    // Play tt_mo_dap_an
    await this.soundController.play('tt_mo_dap_an');

    // After delay, play vcnv_xem_dap_an (allow overlap)
    const timeoutId = setTimeout(() => {
      this.soundController.play('vcnv_xem_dap_an');
    }, TIMING_CONFIG.REVEAL_ANSWER_OVERLAP_MS);

    this.timeoutIds.set('reveal_answer_overlap', timeoutId);
  }

  private async handleSessionEnded(): Promise<void> {
    this.soundController.stopAll();
    this.clearTimeouts();
  }

  private clearTimeouts(): void {
    for (const timeoutId of this.timeoutIds.values()) {
      clearTimeout(timeoutId);
    }
    this.timeoutIds.clear();
  }

  cleanup(): void {
    this.soundController.stopAll();
    this.clearTimeouts();
  }
}
