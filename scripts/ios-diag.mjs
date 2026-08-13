import { webkit, devices } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3000";
const RM = process.env.RM === "1";
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], ...(RM ? { reducedMotion: "reduce" } : {}) });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
const probe = () => page.evaluate(() => {
  const v = document.querySelector("video");
  const c = [...document.querySelectorAll("canvas")].filter(x => x.width > 100)[0];
  let bright = null;
  if (c) { const d = c.getContext("2d").getImageData(0, Math.floor(c.height/2), 60, 1).data;
    let s=0; for (let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2]; bright = +(s/(d.length/4*3)).toFixed(1); }
  const cd = document.querySelector('[aria-live="off"]');
  return { paused: v?.paused, t: +(v?.currentTime ?? -1).toFixed(2), bright, countdown: cd?.textContent?.trim() };
});
console.log(`--- reducedMotion=${RM} ---`);
for (let i = 0; i < 4; i++) { await page.waitForTimeout(2600); console.log(i, JSON.stringify(await probe())); }
await page.screenshot({ path: `/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/dr/41-ios-${RM?"rm":"normal"}.png` });
await b.close();
