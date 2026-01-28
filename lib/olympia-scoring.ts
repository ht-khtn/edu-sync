import { getKhoiDongPoints, getVeDichPoints, getTangTocPoints } from "@/lib/olympia/olympia-config";

export type KhoiDongDecision = "correct" | "wrong" | "timeout";
export type VeDichDecision = "correct" | "wrong" | "timeout";

export function computeVcnvFinalScore(openedTilesCount: number): number {
  const safeCount = Number.isFinite(openedTilesCount)
    ? Math.max(0, Math.floor(openedTilesCount))
    : 0;
  return Math.max(0, 60 - 10 * safeCount);
}

/**
 * Tính delta và điểm mới cho vòng Khởi động (lượt chung).
 * - Đúng: +config.commonPointsCorrect
 * - Sai/Hết giờ: +config.commonPointsIncorrect (giá trị âm) và không để điểm âm (clamp 0).
 */
export function computeKhoiDongCommonScore(
  decision: KhoiDongDecision,
  currentPoints: number
): { delta: number; nextPoints: number } {
  const config = getKhoiDongPoints();
  const rawDelta =
    decision === "correct" ? config.commonPointsCorrect : config.commonPointsIncorrect;
  const nextPoints = Math.max(0, currentPoints + rawDelta);
  return { delta: rawDelta, nextPoints };
}

export function computeVeDichMainDelta(params: {
  value: number;
  decision: VeDichDecision;
  starEnabled: boolean;
}): number {
  const safeValue = params.value === 30 ? 30 : 20;
  if (params.decision !== "correct") {
    return params.starEnabled ? -safeValue : 0;
  }
  const config = getVeDichPoints();
  return safeValue * (params.starEnabled ? config.starMultiplier : 1);
}

export function computeVeDichStealDelta(params: {
  value: number;
  decision: VeDichDecision;
}): number {
  const safeValue = params.value === 30 ? 30 : 20;
  if (params.decision === "correct") return safeValue;
  const config = getVeDichPoints();
  // Config hỗ trợ cả 2 dạng:
  // - 0.5 (tức 50%)
  // - 50 (tức 50%)
  const raw = config.stealPenaltyPercentage;
  const fraction = raw <= 1 ? raw : raw / 100;
  const penaltyAmount = Math.ceil(safeValue * fraction);
  return -penaltyAmount;
}

export function computeVeDichStealTransfer(params: {
  value: number;
  decision: VeDichDecision;
  mainStarEnabled: boolean;
}): { stealDelta: number; mainDelta: number } {
  const safeValue = params.value === 30 ? 30 : 20;
  const stealDelta = computeVeDichStealDelta({
    value: safeValue,
    decision: params.decision,
  });
  const mainDelta = params.decision === "correct" && !params.mainStarEnabled ? -safeValue : 0;
  return { stealDelta, mainDelta };
}

export type TangTocSubmission = {
  id: string;
  submittedAtMs: number;
};

/**
 * Tính điểm Tăng tốc theo thứ tự thời gian và xử lý tie.
 * - Sort tăng dần theo submittedAtMs.
 * - Nếu các submission trong cùng nhóm có chênh lệch <= thresholdMs → tie, cùng nhận điểm của hạng đó.
 * - Nếu tie làm "chiếm" nhiều slot, hạng tiếp theo sẽ bị nhảy.
 */
export function computeTangTocAwards(params: {
  submissions: TangTocSubmission[];
  thresholdMs?: number;
  pointsByRank?: number[];
}): Map<string, number> {
  const threshold = Number.isFinite(params.thresholdMs)
    ? Math.max(0, Math.floor(params.thresholdMs!))
    : 10;
  const config = getTangTocPoints();
  const pointsByRank = params.pointsByRank ?? config.pointsByOrder;

  const sorted = [...params.submissions]
    .filter((s) => s && typeof s.id === "string" && Number.isFinite(s.submittedAtMs))
    .sort((a, b) => a.submittedAtMs - b.submittedAtMs);

  const awards = new Map<string, number>();
  let rankIndex = 0;
  let i = 0;

  while (i < sorted.length && rankIndex < pointsByRank.length) {
    const base = sorted[i];
    const group: TangTocSubmission[] = [base];
    let j = i + 1;
    while (j < sorted.length) {
      const cand = sorted[j];
      if (cand.submittedAtMs - base.submittedAtMs <= threshold) {
        group.push(cand);
        j += 1;
        continue;
      }
      break;
    }

    const points = pointsByRank[rankIndex] ?? 0;
    for (const g of group) {
      awards.set(g.id, points);
    }

    rankIndex += group.length;
    i = j;
  }

  return awards;
}
