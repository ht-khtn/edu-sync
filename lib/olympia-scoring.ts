export type KhoiDongDecision = "correct" | "wrong" | "timeout";

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
