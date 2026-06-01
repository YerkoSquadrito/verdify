import { describe, it, expect } from "vitest";
import { isCovered, thresholdCrossed, upcomingDeadlines, deriveComplianceSchedule, civilDate } from "@/lib/compliance";

describe("isCovered — EBEWE thresholds", () => {
  it("private ≥ 20,000 sq ft is covered", () => {
    expect(isCovered(20_000, "private")).toBe(true);
    expect(isCovered(19_999, "private")).toBe(false);
  });
  it("city ≥ 7,500 sq ft is covered", () => {
    expect(isCovered(7_500, "city")).toBe(true);
    expect(isCovered(7_499, "city")).toBe(false);
  });
  it("a 10,000 sq ft building is covered if city-owned, not if private", () => {
    expect(isCovered(10_000, "city")).toBe(true);
    expect(isCovered(10_000, "private")).toBe(false);
  });
});

describe("thresholdCrossed — alert cascade windows", () => {
  it.each([
    [200, null],
    [95, null],
    [90, 90],
    [35, 90],
    [30, 30],
    [8, 30],
    [7, 7],
    [1, 7],
    [0, 7],
  ])("daysUntil %i → %s", (days, expected) => {
    expect(thresholdCrossed(days)).toBe(expected as 90 | 30 | 7 | null);
  });
});

describe("upcomingDeadlines", () => {
  it("sorts by urgency and tags the crossed threshold", () => {
    const schedule = deriveComplianceSchedule("100000", 25000, "private", civilDate(2026, 5, 31));
    const deadlines = upcomingDeadlines(schedule, civilDate(2026, 5, 31));
    expect(deadlines[0].type).toBe("benchmark"); // June 1 is 1 day out
    expect(deadlines[0].daysUntil).toBe(1);
    expect(deadlines[0].thresholdCrossed).toBe(7);
  });
});
