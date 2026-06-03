// Focused verification of the demo controls (slider + reset). Requires `pnpm dev`.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let failures = 0;
const ok = (n: string, pass: boolean, d = "") => {
  console.log(`${pass ? "✓" : "✗"} ${n}${d ? ` — ${d}` : ""}`);
  if (!pass) failures++;
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } } as never);

  // Read the "Deadline approaching" summary card's number.
  async function approachingCount(): Promise<number> {
    const card = page.locator('button[aria-pressed]', {
      hasText: "Deadline approaching",
    });
    const txt = await card.innerText();
    const m = txt.match(/(\d+)/);
    return m ? Number(m[1]) : -1;
  }

  // login
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "manager@sunsetpm.test");
  await page.fill("#password", "verdify-demo");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });

  // Demo controls present
  await page.waitForSelector("text=Demo mode", { timeout: 10000 });
  ok("Demo mode panel renders", true);
  const slider = page.locator('input[type="range"]');
  ok("Time-travel slider present", (await slider.count()) === 1);

  // At rest (today), nothing should be "approaching" (June 1 just passed).
  await page.waitForSelector("text=Live fine exposure");
  const atRest = await approachingCount();
  ok("At rest: approaching count read", atRest >= 0, `approaching=${atRest}`);

  // Advance the clock toward the next June 1 via the preset.
  await page.click("text=Jun 1");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const advanced = await approachingCount();
  ok(
    "Advancing clock to ~Jun 1 surfaces approaching deadlines",
    advanced > atRest,
    `approaching ${atRest} → ${advanced}`,
  );

  // The slider should now reflect a non-zero offset.
  const val = Number(await slider.inputValue());
  ok("Slider reflects advanced offset", val > 0, `offset=${val}d`);

  // Reset demo — accept the confirm dialog.
  page.once("dialog", (d) => d.accept());
  await page.click("text=Reset demo");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  const afterReset = Number(await page.locator('input[type="range"]').inputValue());
  ok("Reset returns clock to today (offset 0)", afterReset === 0, `offset=${afterReset}d`);
  await page.waitForSelector("text=Live fine exposure");
  const resetApproaching = await approachingCount();
  ok("Reset restores at-rest portfolio", resetApproaching === atRest, `approaching=${resetApproaching}`);

  await browser.close();
  console.log(failures === 0 ? "\nDEMO CONTROLS VERIFIED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
