import { chromium } from "playwright";
const OUT = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/dr";
const SAMPLE = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/sample-photo.png";
const b = await chromium.launch({ args: ["--no-sandbox","--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /put the vibes on/i }).first().click();
await page.waitForTimeout(1300);
await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
await page.waitForSelector("text=Drag to reposition", { timeout: 20000 });

const state = async (tag) => {
  const r = await page.evaluate(() => ({
    alert: document.querySelector('[role="alert"]')?.textContent ?? null,
    stage: document.querySelector('img[alt="Your HH Goa 2026 Builder ID Card"]') ? "RESULT" : "EDIT",
    focused: document.activeElement?.getAttribute("placeholder") ?? null,
  }));
  console.log(tag, JSON.stringify(r));
};

await page.click('button[aria-label="Generate card"]');
await page.waitForTimeout(600); await state("both empty ->");
await page.screenshot({ path: `${OUT}/60-required.png` });

await page.fill('input[placeholder="e.g. Priya Shenoy"]', "Priya Shenoy");
await page.click('button[aria-label="Generate card"]');
await page.waitForTimeout(600); await state("role empty ->");

await page.fill('input[placeholder="e.g. Full-stack, ex-Rust, no-sleep"]', "Full-stack");
await page.click('button[aria-label="Generate card"]');
await page.waitForSelector('img[alt="Your HH Goa 2026 Builder ID Card"]', { timeout: 25000 });
await page.waitForTimeout(400); await state("both filled ->");
await b.close();
