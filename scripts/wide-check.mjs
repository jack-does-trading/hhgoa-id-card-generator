import { chromium } from "playwright";
const OUT = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/dr";
const SAMPLE = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/sample-photo.png";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ args: ["--no-sandbox","--autoplay-policy=no-user-gesture-required"] });
const SIZES = [[2560,800],[1920,720],[1680,560],[1440,600],[1440,900],[1280,720],[390,844]];
for (const [w,h] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /put the vibes on/i }).first().click();
  await page.waitForTimeout(1200);
  await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
  await page.waitForSelector("text=Drag to reposition", { timeout: 20000 });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const panel = document.querySelector(".panel-scroll");
    const rail = panel.parentElement;
    const gen = document.querySelector('button[aria-label="Generate card"]');
    const r = gen.getBoundingClientRect();
    // scroll the panel to the bottom, then re-measure the CTA
    panel.scrollTop = panel.scrollHeight;
    const after = gen.getBoundingClientRect();
    return {
      railH: Math.round(rail.getBoundingClientRect().height),
      panelH: Math.round(panel.getBoundingClientRect().height),
      scrolls: panel.scrollHeight > panel.clientHeight + 1,
      ctaCutBefore: Math.max(0, Math.round(r.bottom - innerHeight)),
      ctaCutAfterScroll: Math.max(0, Math.round(after.bottom - innerHeight)),
    };
  });
  console.log(`${String(w).padStart(4)}x${String(h).padEnd(4)}`, JSON.stringify(m));
  if ([2560,1920,1440].includes(w)) await page.screenshot({ path: `${OUT}/71-wide-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
