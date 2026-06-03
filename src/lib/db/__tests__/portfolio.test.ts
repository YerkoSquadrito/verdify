import { describe, it, expect } from "vitest";
import { buildView } from "../portfolio";
import type { Building, ComplianceEvent, ComplianceEventType } from "../types";
import { FINE_AT_DAY_30 } from "@/lib/compliance";

// Fixed reference moment so the fine stage is deterministic. The violation
// below is dated 2026-01-01, ~104 days before asOf → interest stage.
const AS_OF = new Date("2026-04-15T12:00:00.000Z");
const V = "2026-01-01";

const building: Building = {
  id: "b1",
  org_id: "o1",
  bin: "1234567", // last digit 7 → A/RCx base year 2024
  name: "Test Building",
  address: "123 Test St",
  sqft: 25_000,
  ownership: "private",
  data_source: "manual",
  source_raw: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

let seq = 0;
function ev(event_type: ComplianceEventType, event_date: string): ComplianceEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    org_id: "o1",
    building_id: "b1",
    event_type,
    event_date,
    metadata: null,
    created_at: `${event_date}T00:00:00.000Z`,
  };
}

describe("buildView — two independent resolution axes", () => {
  it("open, unpaid violation: status violation + accruing fine", () => {
    const view = buildView(building, [ev("violation_issued", V)], AS_OF);

    expect(view.status).toBe("violation");
    expect(view.violationDate).not.toBeNull();
    expect(view.fine.settled).toBeFalsy();
    // ~104 days → past the $707 late charge, interest accruing.
    expect(view.fine.balance).toBeGreaterThan(FINE_AT_DAY_30);
  });

  it("fine paid (money axis): settled + zero exposure, but STILL in violation", () => {
    const view = buildView(
      building,
      [ev("violation_issued", V), ev("fine_paid", "2026-03-01")],
      AS_OF,
    );

    expect(view.fine.settled).toBe(true);
    // Paid fine is no longer money at risk.
    expect(view.fine.balance).toBe(0);
    // Frozen at the day-59 late-charge balance ($707), not the live amount.
    expect(view.fine.settledAmount).toBe(FINE_AT_DAY_30);
    // Paying does NOT cure non-compliance.
    expect(view.status).toBe("violation");
  });

  it("documentation submitted (compliance axis): cured, but unpaid fine keeps accruing", () => {
    const view = buildView(
      building,
      [ev("violation_issued", V), ev("benchmark_submitted", "2026-01-05")],
      AS_OF,
    );

    // Cured → no longer in violation.
    expect(view.status).not.toBe("violation");
    // Fine still owed on the money axis until settled.
    expect(view.fine.settled).toBeFalsy();
    expect(view.fine.balance).toBeGreaterThan(FINE_AT_DAY_30);
  });

  it("both axes resolved: cured AND settled", () => {
    const view = buildView(
      building,
      [
        ev("violation_issued", V),
        ev("benchmark_submitted", "2026-01-05"),
        ev("fine_paid", "2026-03-01"),
      ],
      AS_OF,
    );

    expect(view.status).not.toBe("violation");
    expect(view.fine.settled).toBe(true);
    expect(view.fine.balance).toBe(0);
  });

  it("a submission BEFORE the violation does not cure it", () => {
    const view = buildView(
      building,
      [ev("benchmark_submitted", "2025-12-01"), ev("violation_issued", V)],
      AS_OF,
    );

    expect(view.status).toBe("violation");
  });

  it("no violation: compliant baseline with zero fine", () => {
    const view = buildView(
      building,
      [ev("benchmark_submitted", "2026-01-05")],
      AS_OF,
    );

    expect(view.status).not.toBe("violation");
    expect(view.fine.balance).toBe(0);
    expect(view.fine.settled).toBeFalsy();
  });
});
