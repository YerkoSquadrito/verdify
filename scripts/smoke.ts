/* eslint-disable no-console */
// Authenticated browser smoke test across all five screens, with a
// console-error gate. Requires `pnpm dev` running on :3000.
import { chromium, type ConsoleMessage } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/tmp/verdify-shots";
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const ok = (n: string, pass: boolean, d = "") => {
  console.log(`${pass ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`);
  if (!pass) failures++;
};

async function main() {
  const browser = await chromium.launch();
  const errors: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  async function login(email: string) {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", "verdify-demo");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
  }

  // ── Property manager: dashboard + live counter ──
  await login("manager@sunsetpm.test");
  await page.waitForSelector("text=Live fine exposure");
  const tiles = await page.locator('a[href^="/buildings/"]').count();
  ok("PM dashboard renders building tiles", tiles >= 10, `${tiles} tiles`);

  // Live counter actually ticks (read the countdown twice).
  const counter = page.locator("text=/Escalates to/").first();
  let ticked = false;
  if (await counter.count()) {
    const t1 = await counter.textContent();
    await page.waitForTimeout(1500);
    const t2 = await counter.textContent();
    ticked = t1 !== t2;
  }
  ok("Live fine counter is ticking", ticked);
  await page.screenshot({ path: `${SHOTS}/01-dashboard-pm.png`, fullPage: true });

  // ── Building detail + vault (click a real tile, not the "Add building" link) ──
  await page.locator('a:has-text("Fine exposure")').first().click();
  await page.waitForSelector("text=Compliance schedule");
  ok("Building detail shows schedule", (await page.locator("text=Compliance schedule").count()) > 0);
  ok("Building detail shows vault", (await page.locator("text=Document vault").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/02-building-detail.png`, fullPage: true });

  // ── Deadlines ──
  await page.goto(`${BASE}/deadlines`);
  await page.waitForSelector("text=Deadline engine");
  ok("Deadline engine lists rows", (await page.locator("tbody tr").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/03-deadlines.png`, fullPage: true });

  // ── Simulator ──
  await page.goto(`${BASE}/simulator`);
  await page.waitForSelector("text=Alert simulator");
  ok("Simulator renders Table A3", (await page.locator("text=Day 365").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/04-simulator.png`, fullPage: true });

  // ── Onboarding lookup (real BIN) ──
  await page.goto(`${BASE}/buildings/new`);
  await page.fill("#bin", "476102819647");
  await page.click("text=Look up");
  await page.waitForSelector("text=Matched in LA Open Data", { timeout: 15000 });
  const sqftVal = await page.inputValue("#sqft");
  ok("Onboarding prefilled sqft from LA Open Data", Number(sqftVal) > 0, `sqft=${sqftVal}`);
  ok("Onboarding shows derived schedule", (await page.locator("text=A/RCx cycle").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/05-onboarding.png`, fullPage: true });

  // ── Consultant: org switcher across client orgs ──
  await context.clearCookies();
  await login("consultant@pegasus.test");
  await page.waitForSelector("text=Live fine exposure");
  const switcher = page.locator('select[aria-label="Switch organization"]');
  ok("Consultant has org switcher", (await switcher.count()) > 0);
  const optionCount = await switcher.locator("option").count();
  ok("Consultant switcher lists 3 client orgs", optionCount === 3, `${optionCount} options`);
  await page.screenshot({ path: `${SHOTS}/06-consultant-dashboard.png`, fullPage: true });

  ok("No console/page errors across the flow", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nScreenshots in ${SHOTS}`);
  console.log(failures === 0 ? "ALL UI SMOKE CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke failed:", e.message);
  process.exit(1);
});
