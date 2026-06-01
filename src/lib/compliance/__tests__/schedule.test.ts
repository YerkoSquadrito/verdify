import { describe, it, expect } from "vitest";
import {
  lastDigitOfBin,
  nextArcxDueDate,
  nextBenchmarkDeadline,
  deriveComplianceSchedule,
  upcomingArcxDueDates,
  civilDate,
} from "@/lib/compliance";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("lastDigitOfBin", () => {
  it("reads the trailing digit, tolerating formatting", () => {
    expect(lastDigitOfBin("476102819647")).toBe(7);
    expect(lastDigitOfBin("12-345")).toBe(5);
    expect(lastDigitOfBin("BIN 0009 ")).toBe(9);
  });
  it("throws when there is no digit to anchor the cycle", () => {
    expect(() => lastDigitOfBin("ABC")).toThrow();
    expect(() => lastDigitOfBin("")).toThrow();
  });
});

describe("nextArcxDueDate — LAMC §91.9708 Table 9708.2 (due Dec 1)", () => {
  // As-of late May 2026, the forward cycle per last digit:
  const asOf = civilDate(2026, 5, 31);
  it.each([
    ["0", "2026-12-01"],
    ["1", "2026-12-01"],
    ["2", "2027-12-01"],
    ["3", "2027-12-01"],
    ["4", "2028-12-01"],
    ["5", "2028-12-01"],
    ["6", "2029-12-01"],
    ["7", "2029-12-01"],
    ["8", "2030-12-01"],
    ["9", "2030-12-01"],
  ])("BIN ending in %s → %s", (digit, expected) => {
    expect(iso(nextArcxDueDate(`10000${digit}`, asOf))).toBe(expected);
  });

  it("returns the same year's Dec 1 when asOf is before it", () => {
    // digit 0 → base 2021; on a date in early 2021 the first due date stands.
    expect(iso(nextArcxDueDate("100000", civilDate(2021, 6, 1)))).toBe(
      "2021-12-01",
    );
  });

  it("rolls to the next 5-year cycle once the due date passes", () => {
    // digit 0 → 2021; just after Dec 1 2026 the next is 2031.
    expect(iso(nextArcxDueDate("100000", civilDate(2026, 12, 2)))).toBe(
      "2031-12-01",
    );
  });
});

describe("upcomingArcxDueDates", () => {
  it("returns three due dates five years apart", () => {
    const dates = upcomingArcxDueDates("100000", civilDate(2026, 5, 31));
    expect(dates.map(iso)).toEqual(["2026-12-01", "2031-12-01", "2036-12-01"]);
  });
});

describe("nextBenchmarkDeadline — June 1, uniform (LAMC §91.9708.1)", () => {
  it("returns this year's June 1 when still upcoming", () => {
    expect(iso(nextBenchmarkDeadline(civilDate(2026, 5, 31)))).toBe("2026-06-01");
  });
  it("includes June 1 itself", () => {
    expect(iso(nextBenchmarkDeadline(civilDate(2026, 6, 1)))).toBe("2026-06-01");
  });
  it("rolls to next year once June 1 has passed", () => {
    expect(iso(nextBenchmarkDeadline(civilDate(2026, 6, 2)))).toBe("2027-06-01");
  });
});

describe("deriveComplianceSchedule", () => {
  it("assembles the full schedule and is NOT keyed to digit for benchmarking", () => {
    const a = deriveComplianceSchedule("100002", 25000, "private", civilDate(2026, 5, 31));
    const b = deriveComplianceSchedule("100008", 25000, "private", civilDate(2026, 5, 31));
    expect(iso(a.nextBenchmarkDeadline)).toBe(iso(b.nextBenchmarkDeadline)); // uniform
    expect(iso(a.nextArcxDueDate)).not.toBe(iso(b.nextArcxDueDate)); // digit-keyed
    expect(a.covered).toBe(true);
    expect(a.arcxDigit).toBe(2);
  });
});
