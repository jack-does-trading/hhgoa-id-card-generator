import { chromium, webkit, devices } from "playwright";
const OUT = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/dr";

async function run(bt, ctxOpts, tag) {
  const b = await bt.launch({ args: bt === chromium ? ["--no-sandbox","--autoplay-policy=no-user-gesture-required"] : [] });
  const ctx = await b.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const w = () => page.evaluate(() => Math.round(document.querySelector(".music-dock").getBoundingClientRect().width));
  console.log(tag, "on splash:", await w());
  await page.getByRole("button", { name: /put the vibes on/i }).first().click();
  await page.waitForTimeout(1200);
  console.log(tag, "just after enter (expect ~360, maximized):", await w());
  await page.waitForTimeout(2500);
  console.log(tag, "at ~3.7s (still open):", await w());
  await page.waitForTimeout(2600);
  console.log(tag, "at ~6.3s (expect 68, auto-collapsed):", await w());
  await page.screenshot({ path: `${OUT}/51-player-${tag}-collapsed.png` });
  await page.evaluate(() => document.querySelector(".music-dock button").click());
  await page.waitForTimeout(900);
  console.log(tag, "after user expands:", await w());
  await page.waitForTimeout(6000);
  console.log(tag, "6s later (must STAY open):", await w());
  await page.screenshot({ path: `${OUT}/51-player-${tag}-expanded.png` });
  await b.close();
}
await run(webkit, { ...devices["iPhone 13"] }, "ios");
await run(chromium, { viewport: { width: 1440, height: 900 } }, "desktop");
