import type {
  ComplianceSchedule,
  FineExposure,
  UpcomingDeadline,
} from "@/lib/compliance";
import type { Building, ComplianceEvent } from "@/lib/db/types";

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(d);
}
function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}
const EVENT_LABEL: Record<string, string> = {
  benchmark_submitted: "Benchmarking submitted",
  arcx_completed: "A/RCx completed",
  violation_issued: "Violation notice issued",
};
const DEADLINE_LABEL: Record<string, string> = {
  benchmark: "Annual benchmarking (LAMC §91.9708.1)",
  arcx: "A/RCx audit & retro-commissioning (LAMC §91.9708)",
};

/**
 * Render a self-contained, printable lender compliance packet (HTML → print to
 * PDF). Built entirely from derived data — it is GENERATED, never reconstructed.
 */
export function renderLenderPacket(input: {
  building: Building;
  schedule: ComplianceSchedule;
  deadlines: UpcomingDeadline[];
  events: ComplianceEvent[];
  fine: FineExposure | null;
  documentCount: number;
  generatedBy: string;
  orgName: string;
  asOf: Date;
}): string {
  const { building, schedule, deadlines, events, fine, asOf } = input;
  const sortedEvents = [...events].sort((a, b) =>
    b.event_date.localeCompare(a.event_date),
  );

  const statusLine = fine
    ? `<span class="bad">Active violation — current exposure ${fmtUsd(fine.balance)}</span>`
    : `<span class="ok">No active violation on record</span>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Lender Compliance Packet — ${esc(building.name ?? building.bin)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; color: #0f1a14; max-width: 760px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 15px; margin: 28px 0 8px; border-bottom: 1px solid #e2e7e3; padding-bottom: 4px; }
  .sub { color: #5c6b62; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eef1ee; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #5c6b62; }
  .ok { color: #16855a; font-weight: 600; }
  .bad { color: #c1362c; font-weight: 600; }
  .mono { font-family: ui-monospace, monospace; font-size: 12px; color: #5c6b62; }
  .badge { display:inline-block; background:#e7f4ee; color:#16855a; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight:600; }
  footer { margin-top: 32px; color: #5c6b62; font-size: 12px; border-top: 1px solid #e2e7e3; padding-top: 12px; }
</style></head>
<body>
  <span class="badge">Verdify · Lender Compliance Packet</span>
  <h1 style="margin-top:12px">${esc(building.name ?? `BIN ${building.bin}`)}</h1>
  <p class="sub">${esc(building.address ?? "Address not on file")}</p>
  <p class="sub">LADBS Building ID <span class="mono">${esc(building.bin)}</span> · ${building.sqft.toLocaleString()} ft² · ${building.ownership === "city" ? "City-owned" : "Privately owned"}</p>

  <h2>Compliance status</h2>
  <p>${statusLine}</p>
  <table>
    <tr><th>EBEWE coverage</th><td>${schedule.covered ? "Covered building" : "Below coverage threshold"}</td></tr>
    <tr><th>Next benchmarking</th><td>${fmtDate(schedule.nextBenchmarkDeadline)}</td></tr>
    <tr><th>A/RCx cycle (BIN digit ${schedule.arcxDigit})</th><td>${fmtDate(schedule.nextArcxDueDate)}</td></tr>
    <tr><th>Forward A/RCx cycles</th><td>${schedule.upcomingArcxDueDates.map((d) => d.getUTCFullYear()).join(" · ")}</td></tr>
  </table>

  <h2>Upcoming deadlines</h2>
  <table>
    <tr><th>Requirement</th><th>Due</th><th>Days out</th></tr>
    ${deadlines
      .map(
        (d) =>
          `<tr><td>${DEADLINE_LABEL[d.type]}</td><td>${fmtDate(d.dueDate)}</td><td>${d.daysUntil}</td></tr>`,
      )
      .join("")}
  </table>

  <h2>Compliance history (${sortedEvents.length})</h2>
  ${
    sortedEvents.length
      ? `<table><tr><th>Date</th><th>Event</th></tr>${sortedEvents
          .map(
            (e) =>
              `<tr><td>${esc(e.event_date)}</td><td>${EVENT_LABEL[e.event_type] ?? e.event_type}</td></tr>`,
          )
          .join("")}</table>`
      : `<p class="sub">No recorded compliance events.</p>`
  }

  <footer>
    Generated ${fmtDate(asOf)} by ${esc(input.generatedBy)} (${esc(input.orgName)}).
    ${input.documentCount} supporting document(s) on file in the Verdify document vault.
    Fine figures computed per LAMC §91.9712 and §98.0411(c). This packet is generated on demand from system-of-record data.
  </footer>
</body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
