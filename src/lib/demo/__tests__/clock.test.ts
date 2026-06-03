import { describe, it, expect } from "vitest";
import { clampOffsetDays, DEMO_HORIZON_DAYS } from "@/lib/demo/clock";

describe("clampOffsetDays — forward-only demo clock", () => {
  it("never goes before the baseline (today)", () => {
    expect(clampOffsetDays(-1)).toBe(0);
    expect(clampOffsetDays(-9999)).toBe(0);
  });

  it("caps at the horizon", () => {
    expect(clampOffsetDays(DEMO_HORIZON_DAYS + 1)).toBe(DEMO_HORIZON_DAYS);
    expect(clampOffsetDays(100_000)).toBe(DEMO_HORIZON_DAYS);
  });

  it("passes valid offsets through, rounded to whole days", () => {
    expect(clampOffsetDays(0)).toBe(0);
    expect(clampOffsetDays(90)).toBe(90);
    expect(clampOffsetDays(45.6)).toBe(46);
  });

  it("coerces non-finite input to 0", () => {
    expect(clampOffsetDays(NaN)).toBe(0);
    expect(clampOffsetDays(Infinity)).toBe(0);
  });
});
