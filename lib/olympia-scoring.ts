export type KhoiDongDecision = "correct" | "wrong" | "timeout";

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
