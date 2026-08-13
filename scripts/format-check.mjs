import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/dr";
const SAMPLE = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/sample-photo.png";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));

await page.goto("http://localhost:3000", { waitUntil: "load" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /put the vibes on/i }).first().click();
await page.waitForTimeout(1300);
await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
await page.waitForSelector("text=Drag to reposition", { timeout: 15000 });
await page.fill('input[placeholder="e.g. Priya Shenoy"]', "Priya Shenoy");
await page.fill('input[placeholder="e.g. Full-stack, ex-Rust, no-sleep"]', "Full-stack, ex-Rust");
await page.click('button[aria-label="Generate card"]');
await page.waitForSelector('img[alt="Your HH Goa 2026 Builder ID Card"]', { timeout: 15000 });
await page.waitForTimeout(1400);
await page.screenshot({ path: path.join(OUT, "20-result-stage.png") });

// front face at full res
const frontSrc = await page.locator('img[alt="Your HH Goa 2026 Builder ID Card"]').getAttribute("src");
fs.writeFileSync(path.join(OUT, "21-front.png"), Buffer.from(frontSrc.split(",")[1], "base64"));

for (const [label, file] of [["Story", "22-story.png"], ["^X", "23-x.png"], ["Avatar", "24-pfp.png"]]) {
  await page.getByRole("button", { name: new RegExp(label, "i") }).first().click();
  await page.waitForTimeout(150);
  const dl = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: /download/i }).click();
  const d = await dl;
  await d.saveAs(path.join(OUT, file));
}

// flip for the back
await page.locator('[aria-label="Show card back"]').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, "25-back-stage.png") });

console.log("ERRORS:", JSON.stringify(errs));
await browser.close();
console.log("done");
