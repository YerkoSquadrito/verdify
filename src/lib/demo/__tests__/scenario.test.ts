import { describe, it, expect } from "vitest";
import { lastDigitOfBin } from "@/lib/compliance";
import { generateBuildings, sunsetBuildings } from "@/lib/demo/scenario";

describe("generateBuildings — deterministic consultant/owner portfolios", () => {
  it("produces exactly the requested count", () => {
    expect(generateBuildings(10, 14)).toHaveLength(14);
    expect(generateBuildings(30, 1)).toHaveLength(1);
  });

  it("keeps the RLS isolation counts intact (Pegasus 40 / Hillmann 20)", () => {
    const pegasus =
      generateBuildings(10, 14).length +
      generateBuildings(11, 13).length +
      generateBuildings(12, 13).length;
    const hillmann = generateBuildings(20, 10).length + generateBuildings(21, 10).length;
    expect(pegasus).toBe(40);
    expect(hillmann).toBe(20);
  });

  it("is deterministic — same seed yields identical BINs", () => {
    const a = generateBuildings(10, 14).map((f) => f.building.bin);
    const b = generateBuildings(10, 14).map((f) => f.building.bin);
    expect(a).toEqual(b);
  });

  it("emits BINs with a parseable last digit (drives the A/RCx cycle)", () => {
    for (const f of generateBuildings(10, 14)) {
      expect(() => lastDigitOfBin(f.building.bin)).not.toThrow();
    }
  });
});

describe("sunsetBuildings — curated demo narrative", () => {
  const fixtures = sunsetBuildings();

  it("has 10 buildings with unique BINs", () => {
    expect(fixtures).toHaveLength(10);
    const bins = new Set(fixtures.map((f) => f.building.bin));
    expect(bins.size).toBe(10);
  });

  it("seeds exactly three open violations for the fine-exposure story", () => {
    const violations = fixtures.filter((f) =>
      f.events.some((e) => e.event_type === "violation_issued"),
    );
    expect(violations).toHaveLength(3);
  });

  it("spreads the violation ages across escalation stages", () => {
    const ages = fixtures
      .flatMap((f) => f.events)
      .filter((e) => e.event_type === "violation_issued")
      .map((e) => e.daysAgo)
      .sort((a, b) => a - b);
    // fresh (<30), late-charge (>=30), and long-compounding (>180).
    expect(ages[0]).toBeLessThan(30);
    expect(ages.some((d) => d >= 30 && d <= 60)).toBe(true);
    expect(ages[ages.length - 1]).toBeGreaterThan(180);
  });

  it("every covered fixture has a valid BIN and adequate floor area", () => {
    for (const f of fixtures) {
      expect(() => lastDigitOfBin(f.building.bin)).not.toThrow();
      expect(f.building.sqft).toBeGreaterThanOrEqual(20_000);
    }
  });
});
