import { describe, it, expect } from "vitest";
import { computeKhoiDongCommonScore, computeVcnvFinalScore } from "@/lib/olympia-scoring";

describe("computeKhoiDongCommonScore", () => {
  it("correct: +10", () => {
    expect(computeKhoiDongCommonScore("correct", 0)).toEqual({ delta: 10, nextPoints: 10 });
    expect(computeKhoiDongCommonScore("correct", 25)).toEqual({ delta: 10, nextPoints: 35 });
  });

  it("wrong/timeout: -5 nhưng không âm", () => {
    expect(computeKhoiDongCommonScore("wrong", 0)).toEqual({ delta: -5, nextPoints: 0 });
    expect(computeKhoiDongCommonScore("timeout", 3)).toEqual({ delta: -5, nextPoints: 0 });
    expect(computeKhoiDongCommonScore("wrong", 10)).toEqual({ delta: -5, nextPoints: 5 });
  });
});

describe("computeVcnvFinalScore", () => {
  it("mặc định 60 điểm khi chưa mở ô", () => {
    expect(computeVcnvFinalScore(0)).toBe(60);
  });

  it("mỗi ô đã mở trừ 10", () => {
    expect(computeVcnvFinalScore(1)).toBe(50);
    expect(computeVcnvFinalScore(2)).toBe(40);
    expect(computeVcnvFinalScore(4)).toBe(20);
  });

  it("không âm và làm tròn an toàn", () => {
    expect(computeVcnvFinalScore(10)).toBe(0);
    expect(computeVcnvFinalScore(-3)).toBe(60);
    expect(computeVcnvFinalScore(2.9)).toBe(40);
  });
});
