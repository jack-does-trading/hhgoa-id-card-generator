import { chromium } from "playwright";
const OUT = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/dr";
const SAMPLE = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/sample-photo.png";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ args: ["--no-sandbox","--autoplay-policy=no-user-gesture-required"] });
for (const [w,h] of [[1600,700],[1920,720],[1536,650],[1440,700],[1280,720],[390,844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /put the vibes on/i }).first().click();
  await page.waitForTimeout(1200);
  await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
  await page.waitForSelector("text=Drag to reposition", { timeout: 20000 });
  await page.fill('input[placeholder="e.g. Priya Shenoy"]', "Priya Shenoy");
  await page.fill('input[placeholder="e.g. Full-stack, ex-Rust, no-sleep"]', "Full-stack");
  await page.click('button[aria-label="Generate card"]');
  await page.waitForSelector('img[alt="Your HH Goa 2026 Builder ID Card"]', { timeout: 25000 });
  await page.waitForTimeout(1600);
  const m = await page.evaluate(() => {
    const panel = document.querySelector(".panel-scroll");
    const btn = [...document.querySelectorAll("button")].find(b => /Share to/.test(b.textContent||""));
    const start = [...document.querySelectorAll("button")].find(b => /Start over/.test(b.textContent||""));
    return { panelH: Math.round(panel.getBoundingClientRect().height),
             scrolls: panel.scrollHeight > panel.clientHeight + 1,
             shareCut: Math.max(0, Math.round(btn.getBoundingClientRect().bottom - innerHeight)),
             startCut: Math.max(0, Math.round(start.getBoundingClientRect().bottom - innerHeight)) };
  });
  console.log(`${String(w).padStart(4)}x${String(h).padEnd(4)}`, JSON.stringify(m));
  if (w===1600) await page.screenshot({ path: `${OUT}/80-result-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
