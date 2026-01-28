import type { GameEventPayload, RoundType } from "./SoundTypes";
import { GameEvent, TIMING_CONFIG } from "./SoundTypes";
import { SoundController } from "./SoundController";
import { SoundRegistry } from "./SoundRegistry";

export class SoundEventRouter {
  private soundController: SoundController;
  private registry: SoundRegistry;
  private timingMap: Map<RoundType, string> = new Map([
    ["khoi_dong", "kd_dem_gio_5s"],
    ["vcnv", "vcnv_dem_gio_15s"],
    ["tang_toc", "tt_dem_gio_20s"],
    ["ve_dich", "vd_dem_gio_15s"],
  ]);
  private timeoutIds: Map<string, NodeJS.Timeout> = new Map();

  constructor(soundController: SoundController) {
    this.soundController = soundController;
    this.registry = new SoundRegistry();
  }

  async routeEvent(event: GameEvent | string, payload?: GameEventPayload): Promise<void> {
    const eventKey = typeof event === "string" ? event : event;

    switch (eventKey) {
      case GameEvent.ROUND_STARTED:
        await this.handleRoundStarted(payload);
        break;
      case GameEvent.QUESTION_REVEALED:
        await this.handleQuestionRevealed(payload);
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
      case GameEvent.TURN_ENDED:
        await this.handleTurnEnded(payload);
        break;
      case GameEvent.STAR_REVEALED:
        await this.handleStarRevealed();
        break;
      case GameEvent.SELECT_ROW:
        await this.handleSelectRow(payload);
        break;
      case GameEvent.SELECT_CATEGORY:
        await this.handleSelectCategory();
        break;
      case GameEvent.REVEAL_ANSWER:
        await this.handleRevealAnswer(payload);
        break;
      case GameEvent.OPEN_IMAGE:
        await this.handleOpenImage();
        break;
      case GameEvent.BUZZER_PRESSED:
        await this.handleBuzzerPressed();
        break;
      case GameEvent.SCOREBOARD_OPENED:
        await this.handleScoreboardOpened();
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
      console.warn("[SoundRouter] No roundType in ROUND_STARTED");
      return;
    }

    this.soundController.stopAll();
    this.clearTimeouts();
    /*
    if (roundType === "vcnv") {
      await this.soundController.play("vcnv_mo_o_chu");
    }

    if (roundType === "ve_dich") {
      await this.soundController.play("vd_bat_dau_choi");
    }
    */
  }

  private async handleQuestionRevealed(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType | undefined;
    if (!roundType) return;

    if (roundType === "khoi_dong") {
      await this.soundController.play("kd_bat_dau_choi");

      const timeoutId = setTimeout(() => {
        this.soundController.play("kd_hien_cau_hoi");
      }, TIMING_CONFIG.ROUND_START_DELAY_MS);
      this.timeoutIds.set("kd_question_reveal", timeoutId);
      return;
    }

    if (roundType === "tang_toc") {
      await this.soundController.play("tt_mo_cau_hoi");
      return;
    }

    if (roundType === "ve_dich") {
      await this.soundController.play("vd_lua_chon_goi");
      return;
    }
  }

  private async handleTimerStarted(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;
    const hasVideo = payload?.hasVideo;

    if (!roundType) return;

    if (roundType === "tang_toc" && hasVideo) {
      // NO timer sound for video
      return;
    }

    const countdownKey = this.resolveCountdownSoundKey(roundType, payload);
    if (countdownKey) {
      await this.soundController.play(countdownKey);
      return;
    }

    if (roundType === "tang_toc") {
      const orderIndexRaw = payload?.questionOrderIndex;
      const orderIndex =
        typeof orderIndexRaw === "number" && Number.isFinite(orderIndexRaw) ? orderIndexRaw : null;
      const isFirstTwo = orderIndex == null ? true : orderIndex <= 2;
      const timerSound = isFirstTwo ? "tt_dem_gio_20s" : "tt_dem_gio_30s";
      await this.soundController.play(timerSound);
      return;
    }

    if (roundType === "ve_dich") {
      const value = payload?.veDichValue;
      const timerSound = value === 30 ? "vd_dem_gio_20s" : "vd_dem_gio_15s";
      await this.soundController.play(timerSound);
      return;
    }

    const timerSound = this.timingMap.get(roundType);
    if (timerSound) {
      await this.soundController.play(timerSound);
    }
  }

  private resolveCountdownSoundKey(
    roundType: RoundType,
    payload?: GameEventPayload
  ): string | null {
    const roundNumber =
      typeof payload?.roundNumber === "number" && Number.isFinite(payload.roundNumber)
        ? payload.roundNumber
        : this.getRoundNumber(roundType);

    const durationSeconds =
      typeof payload?.durationSeconds === "number" && Number.isFinite(payload.durationSeconds)
        ? payload.durationSeconds
        : this.resolveDurationSecondsFromMs(payload?.durationMs);

    if (!durationSeconds) return null;

    const candidates = [roundNumber, 1, 2, 3, 4].filter(
      (n, idx, arr) => typeof n === "number" && Number.isFinite(n) && arr.indexOf(n) === idx
    );

    const tried: string[] = [];
    for (const n of candidates) {
      const fileName = `${n} ${durationSeconds}s`;
      tried.push(fileName);
      const key = this.registry.findKeyByFileName(fileName);
      if (key) return key;
    }

    if (tried.length > 0) {
      console.error(`[SoundRouter] Countdown sound not found. Tried: ${tried.join(", ")}`);
    }
    return null;
  }

  private getRoundNumber(roundType: RoundType): number {
    const map: Record<RoundType, number> = {
      khoi_dong: 1,
      vcnv: 2,
      tang_toc: 3,
      ve_dich: 4,
    };
    return map[roundType];
  }

  private resolveDurationSecondsFromMs(durationMs?: number): number | null {
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) return null;
    const seconds = Math.round(durationMs / 1000);
    return seconds > 0 ? seconds : null;
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
      khoi_dong: "kd_dung",
      vcnv: "vcnv_dung",
      tang_toc: "vcnv_dung",
      ve_dich: "vd_dung",
    };

    const correctSound = correctSoundMap[roundType];
    if (correctSound) {
      if (roundType === "vcnv") {
        await this.soundController.play(correctSound, {
          onEnd: () => {
            this.soundController.play("vcnv_mo_hinh_anh");
          },
        });
        return;
      }

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
      khoi_dong: "kd_sai",
      vcnv: "kd_sai",
      ve_dich: "vd_sai",
    };

    const wrongSound = wrongSoundMap[roundType];
    if (wrongSound) {
      await this.soundController.play(wrongSound);
    }
  }

  private async handleTimerEnded(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;
    if (!roundType) return;
    /*
    const timerSound = this.timingMap.get(roundType);
    if (timerSound) {
      this.soundController.stop(timerSound);
    }
      */
    // Không dừng timer sound - để nó phát cho đến kết thúc (âm thanh có thể dài hơn timer).
    // Timer sound sẽ tự dừng khi phát xong, hoặc bị interrupt khi có scoring sound phát.
  }

  private async handleRoundEnded(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType;

    this.soundController.stopAll();
    this.clearTimeouts();

    if (!roundType) return;

    const endSoundMap: Partial<Record<RoundType, string>> = {
      khoi_dong: "kd_hoan_thanh",
      ve_dich: "vd_hoan_thanh",
    };

    const endSound = endSoundMap[roundType];
    if (endSound) {
      await this.soundController.play(endSound);
    }
  }

  private async handleTurnEnded(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType | undefined;
    if (!roundType) return;

    const endSoundMap: Partial<Record<RoundType, string>> = {
      khoi_dong: "kd_hoan_thanh",
      ve_dich: "vd_hoan_thanh",
    };

    const endSound = endSoundMap[roundType];
    if (endSound) {
      await this.soundController.play(endSound);
    }
  }

  private async handleStarRevealed(): Promise<void> {
    this.soundController.stopAll();
    await this.soundController.play("vd_ngoi_sao");
  }

  private async handleSelectRow(payload?: GameEventPayload): Promise<void> {
    // Kiểm tra xem câu có code CNV không (không phải VCNV-...)
    const questionCodeRaw = typeof payload?.questionCode === "string" ? payload.questionCode : null;
    const normalizedCode = questionCodeRaw ? questionCodeRaw.trim().toUpperCase() : "";
    const isCnvQuestion = normalizedCode
      ? normalizedCode.startsWith("CNV") && !normalizedCode.startsWith("VCNV")
      : false;

    if (isCnvQuestion) {
      // Câu CNV: phát âm thanh mở ô chữ
      await this.soundController.play("vcnv_mo_o_chu");
    } else {
      // Câu VCNV khác: phát âm thanh chọn hàng + mở câu hỏi
      await this.soundController.play("vcnv_chon_hang_ngang", {
        onEnd: () => {
          this.soundController.play("vcnv_mo_cau_hoi");
        },
      });
    }
  }

  private async handleSelectCategory(): Promise<void> {
    await this.soundController.play("vd_cac_goi");
  }

  private async handleRevealAnswer(payload?: GameEventPayload): Promise<void> {
    const roundType = payload?.roundType as RoundType | undefined;

    if (roundType !== "tang_toc") {
      await this.soundController.play("vcnv_xem_dap_an");
      return;
    }

    await this.soundController.play("tt_mo_dap_an");

    const timeoutId = setTimeout(() => {
      this.soundController.play("vcnv_xem_dap_an");
    }, TIMING_CONFIG.REVEAL_ANSWER_OVERLAP_MS);

    this.timeoutIds.set("reveal_answer_overlap", timeoutId);
  }

  private async handleOpenImage(): Promise<void> {
    await this.soundController.play("vcnv_mo_hinh_anh");
  }

  private async handleBuzzerPressed(): Promise<void> {
    await this.soundController.play("chuong");
  }

  private async handleScoreboardOpened(): Promise<void> {
    await this.soundController.play("tong_ket_diem");
  }

  private async handleSessionEnded(): Promise<void> {
    this.soundController.stopAll();
    this.clearTimeouts();
    await this.soundController.play("tong_ket_ket_qua");
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
