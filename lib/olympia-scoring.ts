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
 * - Đúng: +10
 * - Sai/Hết giờ: -5 nhưng không để điểm âm (clamp 0).
 */
export function computeKhoiDongCommonScore(
  decision: KhoiDongDecision,
  currentPoints: number
): { delta: number; nextPoints: number } {
  const rawDelta = decision === "correct" ? 10 : -5;
  const nextPoints = Math.max(0, currentPoints + rawDelta);
  return { delta: rawDelta, nextPoints };
}

export function computeVeDichMainDelta(params: {
  value: number;
  decision: VeDichDecision;
  starEnabled: boolean;
}): number {
  const safeValue = params.value === 30 ? 30 : 20;
  if (params.decision !== "correct") return 0;
  return safeValue * (params.starEnabled ? 2 : 1);
}

export function computeVeDichStealDelta(params: {
  value: number;
  decision: VeDichDecision;
}): number {
  const safeValue = params.value === 30 ? 30 : 20;
  if (params.decision === "correct") return safeValue;
  return -Math.ceil(safeValue / 2);
}

export type TangTocSubmission = {
  id: string;
  submittedAtMs: number;
};

/**
 * Tính điểm Tăng tốc theo thứ tự thời gian (40/30/20/10) và xử lý tie.
 * - Sort tăng dần theo submittedAtMs.
 * - Nếu các submission trong cùng nhóm có chênh lệch <= thresholdMs → tie, cùng nhận điểm của hạng đó.
 * - Nếu tie làm "chiếm" nhiều slot, hạng tiếp theo sẽ bị nhảy (vd: 2 người tie hạng 1 → cả 2 nhận 40; người tiếp theo nhận 20).
 */
export function computeTangTocAwards(params: {
  submissions: TangTocSubmission[];
  thresholdMs?: number;
  pointsByRank?: number[];
}): Map<string, number> {
  const threshold = Number.isFinite(params.thresholdMs)
    ? Math.max(0, Math.floor(params.thresholdMs!))
    : 10;
  const pointsByRank = params.pointsByRank ?? [40, 30, 20, 10];

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
