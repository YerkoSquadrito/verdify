import { describe, it, expect } from "vitest";
import {
  computeFineExposure,
  expectedFineSchedule,
  civilDate,
  addDays,
} from "@/lib/compliance";

const VIOLATION = civilDate(2025, 1, 1);
const at = (day: number) => computeFineExposure(VIOLATION, addDays(VIOLATION, day));

describe("computeFineExposure — LAMC §91.9712 / §98.0411(c), Appendix Table A3", () => {
  it("Day 0: base violation notice = $202", () => {
    expect(at(0).balance).toBe(202);
    expect(at(0).stage).toBe("base");
  });

  it("Day 29: still flat at base $202", () => {
    expect(at(29).balance).toBe(202);
    expect(at(29).stage).toBe("base");
  });

  it("Day 30: 250% combined late charge → $707", () => {
    expect(at(30).balance).toBe(707);
    expect(at(30).stage).toBe("late");
  });

  it("Day 59: flat $707 (interest not yet started)", () => {
    expect(at(59).balance).toBe(707);
    expect(at(59).stage).toBe("late");
  });

  it("Day 60: interest begins, balance still $707 (0 months)", () => {
    expect(at(60).balance).toBe(707);
    expect(at(60).stage).toBe("interest");
  });

  // Table A3 milestone balances (rounded to whole dollars).
  it.each([
    [90, 714],
    [120, 721],
    [180, 736],
    [270, 758],
  ])("Day %i → ~$%i", (day, expected) => {
    expect(Math.round(at(day).balance)).toBe(expected);
    expect(at(day).stage).toBe("interest");
  });

  it("Day 365: ≈ $780 after ~10 months compounding", () => {
    // 707 × 1.01^10 = 781.0; Table A3 rounds to ~$780.
    expect(Math.abs(at(365).balance - 780)).toBeLessThanOrEqual(1.5);
  });

  it("before the violation date: no exposure", () => {
    expect(at(-5).balance).toBe(0);
    expect(at(-5).stage).toBe("none");
  });

  it("monotonically non-decreasing across a year", () => {
    let prev = -1;
    for (let d = 0; d <= 400; d++) {
      const b = at(d).balance;
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it("reports the next escalation while in the base stage", () => {
    const e = at(10).nextEscalation;
    expect(e).not.toBeNull();
    expect(e!.inDays).toBe(20); // day 30 - day 10
    expect(e!.toBalance).toBe(707);
  });

  it("reports the next monthly escalation while accruing interest", () => {
    const e = at(60).nextEscalation; // next jump at day 90
    expect(e!.inDays).toBe(30);
    expect(Math.round(e!.toBalance)).toBe(714);
  });
});

describe("expectedFineSchedule — canonical Table A3 for the simulator", () => {
  it("matches the published milestones", () => {
    const rows = expectedFineSchedule();
    const byDay = Object.fromEntries(rows.map((r) => [r.day, Math.round(r.balance)]));
    expect(byDay[0]).toBe(202);
    expect(byDay[30]).toBe(707);
    expect(byDay[60]).toBe(707);
    expect(byDay[90]).toBe(714);
    expect(byDay[120]).toBe(721);
    expect(byDay[180]).toBe(736);
    expect(byDay[270]).toBe(758);
    expect(Math.abs(byDay[365] - 780)).toBeLessThanOrEqual(1.5);
  });

  it("cites §91.9712 for the base fee and §98.0411(c) for escalation", () => {
    const rows = expectedFineSchedule();
    expect(rows.find((r) => r.day === 0)!.citation).toContain("91.9712");
    expect(rows.find((r) => r.day === 30)!.citation).toContain("98.0411");
  });
});
