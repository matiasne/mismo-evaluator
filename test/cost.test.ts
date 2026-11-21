import { describe, expect, it } from "vitest";
import { costUsd, formatCost, formatDuration, formatUsdAmount, summaryCostUsd } from "../lib/cost";

describe("cost", () => {
  it("prices Jev at $0.042 per million input tokens", () => {
    const jev = (inputTokens: number) => ({ inputTokens, outputTokens: 0 });
    expect(costUsd("jev", jev(1_000_000))).toBeCloseTo(0.042);
    expect(formatCost("jev", jev(28_300))).toBe("$0.0012 (28,300 input tokens)");
    expect(formatCost("jev", jev(500_000))).toBe("$0.021 (500,000 input tokens)");
    expect(formatCost("jev", jev(100))).toBe("under $0.0001 (100 input tokens)");
    expect(formatCost("jev", jev(0))).toBe("$0.0000 (0 input tokens)");
    expect(formatCost("jev", null)).toBe("cost not reported");
  });

  it("prices Opus at $4 per million input tokens and $20 per million output tokens", () => {
    expect(costUsd("opus", { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(4);
    expect(costUsd("opus", { inputTokens: 0, outputTokens: 1_000_000 })).toBeCloseTo(20);
    expect(formatCost("opus", { inputTokens: 60_000, outputTokens: 5_000 })).toBe("$0.340 (60,000 in · 5,000 out)");
  });

  it("prices the summary at $0.10 per million input tokens and $0.50 per million output tokens", () => {
    expect(summaryCostUsd(1_000_000, 0)).toBeCloseTo(0.1);
    expect(summaryCostUsd(0, 1_000_000)).toBeCloseTo(0.5);
    expect(formatUsdAmount(summaryCostUsd(3_000, 400))).toBe("$0.0005");
  });

  it("formats durations", () => {
    expect(formatDuration(420.4)).toBe("420 ms");
    expect(formatDuration(2440)).toBe("2.4 s");
  });
});
