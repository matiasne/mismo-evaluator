import { describe, expect, it } from "vitest";
import { costUsd, formatCost, formatDuration, formatUsdAmount, summaryCostUsd } from "../lib/cost";

describe("cost", () => {
  it("prices input tokens at $0.042 per million", () => {
    expect(costUsd(1_000_000)).toBeCloseTo(0.042);
    expect(formatCost(28_300)).toBe("$0.0012 (28,300 input tokens)");
    expect(formatCost(500_000)).toBe("$0.021 (500,000 input tokens)");
    expect(formatCost(100)).toBe("under $0.0001 (100 input tokens)");
    expect(formatCost(0)).toBe("$0.0000 (0 input tokens)");
    expect(formatCost(null)).toBe("cost not reported");
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
