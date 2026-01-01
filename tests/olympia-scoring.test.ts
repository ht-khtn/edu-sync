import { describe, it, expect } from "vitest";
import { computeKhoiDongCommonScore } from "@/lib/olympia-scoring";

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
