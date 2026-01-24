import { describe, it, expect } from "vitest";
import {
  computeKhoiDongCommonScore,
  computeTangTocAwards,
  computeVcnvFinalScore,
  computeVeDichMainDelta,
  computeVeDichStealDelta,
} from "@/lib/olympia-scoring";

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

describe("computeTangTocAwards", () => {
  it("xếp hạng theo thời gian: 40/30/20/10", () => {
    const awards = computeTangTocAwards({
      submissions: [
        { id: "a", submittedAtMs: 1000 },
        { id: "b", submittedAtMs: 1100 },
        { id: "c", submittedAtMs: 1200 },
        { id: "d", submittedAtMs: 1300 },
      ],
      thresholdMs: 0,
    });
    expect(awards.get("a")).toBe(40);
    expect(awards.get("b")).toBe(30);
    expect(awards.get("c")).toBe(20);
    expect(awards.get("d")).toBe(10);
  });

  it("tie trong ngưỡng: cùng nhận điểm hạng đó và nhảy slot", () => {
    const awards = computeTangTocAwards({
      submissions: [
        { id: "a", submittedAtMs: 1000 },
        { id: "b", submittedAtMs: 1005 }, // tie với a nếu threshold=10
        { id: "c", submittedAtMs: 1200 },
        { id: "d", submittedAtMs: 1300 },
      ],
      thresholdMs: 10,
    });
    expect(awards.get("a")).toBe(40);
    expect(awards.get("b")).toBe(40);
    // 2 người chiếm 2 slot đầu → người tiếp theo nhận 20
    expect(awards.get("c")).toBe(20);
    expect(awards.get("d")).toBe(10);
  });
});

describe("Về đích scoring", () => {
  it("main: đúng thì +value (x2 nếu star)", () => {
    expect(computeVeDichMainDelta({ value: 20, decision: "correct", starEnabled: false })).toBe(20);
    expect(computeVeDichMainDelta({ value: 20, decision: "correct", starEnabled: true })).toBe(40);
    expect(computeVeDichMainDelta({ value: 30, decision: "correct", starEnabled: false })).toBe(30);
    expect(computeVeDichMainDelta({ value: 30, decision: "correct", starEnabled: true })).toBe(60);
  });

  it("main: sai/hết giờ phụ thuộc star", () => {
    // Sai + sao → trừ toàn bộ điểm
    expect(computeVeDichMainDelta({ value: 20, decision: "wrong", starEnabled: true })).toBe(-20);
    expect(computeVeDichMainDelta({ value: 30, decision: "wrong", starEnabled: true })).toBe(-30);

    // Hết giờ + sao → trừ toàn bộ điểm
    expect(computeVeDichMainDelta({ value: 20, decision: "timeout", starEnabled: true })).toBe(-20);
    expect(computeVeDichMainDelta({ value: 30, decision: "timeout", starEnabled: true })).toBe(-30);

    // Sai/hết giờ không sao → không trừ
    expect(computeVeDichMainDelta({ value: 20, decision: "wrong", starEnabled: false })).toBe(0);
    expect(computeVeDichMainDelta({ value: 30, decision: "wrong", starEnabled: false })).toBe(0);
    expect(computeVeDichMainDelta({ value: 20, decision: "timeout", starEnabled: false })).toBe(0);
    expect(computeVeDichMainDelta({ value: 30, decision: "timeout", starEnabled: false })).toBe(0);
  });

  it("steal: đúng +value; sai/hết giờ phạt 50% làm tròn lên", () => {
    expect(computeVeDichStealDelta({ value: 20, decision: "correct" })).toBe(20);
    expect(computeVeDichStealDelta({ value: 20, decision: "wrong" })).toBe(-10);
    expect(computeVeDichStealDelta({ value: 30, decision: "wrong" })).toBe(-15);
    expect(computeVeDichStealDelta({ value: 30, decision: "timeout" })).toBe(-15);
  });
});
