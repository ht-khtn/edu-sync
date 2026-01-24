/**
 * Olympia Configuration Helpers
 * Import values từ olympia-scoring-config.json và olympia-countdown-config.json
 */

import scoringConfig from "./olympia-scoring-config.json";
import countdownConfig from "./olympia-countdown-config.json";

// Type definitions for config objects
interface ScoringRound {
  maxPoints: number;
  [key: string]: unknown;
}

interface Question {
  points: number;
}

interface TangTocCountdownQuestion {
  order: number;
  type: string;
  durationSeconds: number;
}

interface Package {
  value: number;
  points: number;
}

interface CountdownRound {
  [key: string]: unknown;
}

interface VeDichPackage {
  value: number;
  thinkingTimeSeconds: number;
}

// ============ SCORING CONFIG HELPERS ============

export const getMaxTotalPoints = (): number => {
  return scoringConfig.totalMaxPoints;
};

export const getMaxPointsByRound = (roundType: string): number => {
  const round = (scoringConfig.rounds as Record<string, ScoringRound>)[roundType];
  return round?.maxPoints ?? 0;
};

export const getKhoiDongPoints = () => {
  return {
    personalPointsPerQuestion: scoringConfig.rounds.khoi_dong.personalRound.pointsPerQuestion,
    commonPointsCorrect: scoringConfig.rounds.khoi_dong.commonRound.pointsCorrect,
    commonPointsIncorrect: scoringConfig.rounds.khoi_dong.commonRound.pointsIncorrect,
    minPoints: scoringConfig.rounds.khoi_dong.commonRound.minPoints,
    maxPoints: scoringConfig.rounds.khoi_dong.maxPoints,
  };
};

export const getVcnvPoints = () => {
  return {
    pointsPerHorizontal: scoringConfig.rounds.vcnv.horizontalAnswers.pointsPerCorrect,
    decayPerLine: scoringConfig.rounds.vcnv.horizontalAnswers.decayPerLine,
    basePoints: scoringConfig.rounds.vcnv.horizontalAnswers.basePoints,
    centralQuestionPoints: scoringConfig.rounds.vcnv.centralQuestion.pointsCorrect,
    finalAttemptPoints: scoringConfig.rounds.vcnv.finalAttempt.pointsCorrect,
    maxPoints: scoringConfig.rounds.vcnv.maxPoints,
  };
};

export const getTangTocPoints = () => {
  const questions = scoringConfig.rounds.tang_toc.questions as Question[];
  return {
    pointsByOrder: questions.map((q: Question) => q.points),
    maxPoints: scoringConfig.rounds.tang_toc.maxPoints,
  };
};

export const getVeDichPoints = () => {
  const packages = scoringConfig.rounds.ve_dich.packages as Package[];
  return {
    packages: packages.map((pkg: Package) => ({
      value: pkg.value,
      points: pkg.points,
    })),
    starMultiplier: scoringConfig.rounds.ve_dich.ngôiSaoHyVọng.multiplier,
    stealPenaltyPercentage: scoringConfig.rounds.ve_dich.stealPenalty.percentage,
    maxPoints: scoringConfig.rounds.ve_dich.maxPoints,
  };
};

// ============ COUNTDOWN CONFIG HELPERS ============

export const getCountdownMs = (roundType: string, questionIndex?: number): number => {
  const round = (countdownConfig.rounds as Record<string, CountdownRound>)[roundType];
  if (!round) return 5000;

  switch (roundType) {
    case "khoi_dong": {
      // Mặc định 5s cho cả cá nhân và chung
      const roundData = round as Record<string, unknown>;
      return (roundData.personalRound as Record<string, number>)?.answerTimeSeconds
        ? (roundData.personalRound as Record<string, number>).answerTimeSeconds * 1000
        : 5000;
    }

    case "vcnv": {
      const roundData = round as Record<string, number>;
      return roundData.horizontalAnswerTimeSeconds
        ? roundData.horizontalAnswerTimeSeconds * 1000
        : 15000;
    }

    case "tang_toc": {
      const roundData = round as unknown as { questions?: TangTocCountdownQuestion[] };
      const questions = Array.isArray(roundData.questions) ? roundData.questions : [];
      if (
        typeof questionIndex === "number" &&
        Number.isFinite(questionIndex) &&
        questions[questionIndex]
      ) {
        const durationSeconds = questions[questionIndex]?.durationSeconds;
        if (
          typeof durationSeconds === "number" &&
          Number.isFinite(durationSeconds) &&
          durationSeconds > 0
        ) {
          return durationSeconds * 1000;
        }
      }
      // Mặc định câu 1 (20s)
      return 20000;
    }

    case "ve_dich": {
      // Mặc định 20s (câu 20 điểm = 15s, câu 30 điểm = 20s)
      // Sẽ được gọi với ve_dich_value để tính chính xác
      return 20000;
    }

    default:
      return 5000;
  }
};

/**
 * Tính thời gian countdown cho câu Về đích dựa trên giá trị (20 hoặc 30 điểm)
 */
export const getVeDichCountdownMs = (veDichValue: number): number => {
  const packages = (countdownConfig.rounds.ve_dich.packages as VeDichPackage[]) || [];
  const pkg = packages.find((p: VeDichPackage) => p.value === veDichValue);
  if (!pkg) {
    return veDichValue === 30 ? 20000 : 15000;
  }
  return pkg.thinkingTimeSeconds * 1000;
};
/**
 * Tính thời gian cướp điểm (Về đích)
 */
export const getVeDichStealTimingMs = () => {
  const veRound = countdownConfig.rounds.ve_dich as Record<string, unknown>;
  return {
    buzzTimeMs: ((veRound as Record<string, number>).stealBuzzTimeSeconds || 5) * 1000,
    answerTimeMs: ((veRound as Record<string, number>).stealAnswerTimeSeconds || 3) * 1000,
  };
};
/**
 * Tính ràng buộc của input thời gian countdown
 */
export const getDurationInputConstraints = () => {
  return {
    minSeconds: 1,
    maxSeconds: 120,
    defaultSeconds: 5,
  };
};

/**
 * Tính thời gian câu hỏi phụ
 */
export const getTieBreakerCountdownMs = (): number => {
  return (
    ((countdownConfig.tieBreaker as Record<string, unknown> as Record<string, number>)
      .buzzTimeSeconds || 15) * 1000
  );
};
