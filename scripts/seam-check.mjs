import { chromium } from "playwright";
import path from "node:path";
const OUT = "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad/dr";
const BASE = process.env.BASE ?? "http://localhost:3000";

const b = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Simulate a real, slow-ish internet connection: this is the condition that
// made two independent <video> elements diverge.
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 150, downloadThroughput: 1_500_000 / 8, uploadThroughput: 500_000 / 8,
});

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });

for (const wait of [3000, 3000, 4000]) {
  await page.waitForTimeout(wait);
  const r = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(c => c.width > 200);
    if (cs.length < 2) return { err: `canvases=${cs.length}` };
    const [top, bot] = cs;
    const N = 400;
    const a = top.getContext("2d").getImageData(0, top.height - 1, Math.min(N, top.width), 1).data;
    const z = bot.getContext("2d").getImageData(0, 0, Math.min(N, bot.width), 1).data;
    let diff = 0, lum = 0;
    for (let i = 0; i < a.length; i += 4) {
      diff += Math.abs(a[i]-z[i]) + Math.abs(a[i+1]-z[i+1]) + Math.abs(a[i+2]-z[i+2]);
      lum += a[i] + a[i+1] + a[i+2];
    }
    const n = a.length / 4;
    const v = document.querySelector("video");
    return { seamDiff: +(diff / (n*3)).toFixed(2), brightness: +(lum/(n*3)).toFixed(1),
             t: +v.currentTime.toFixed(2), paused: v.paused, videos: document.querySelectorAll("video").length };
  });
  console.log(JSON.stringify(r));
}
await page.screenshot({ path: path.join(OUT, "30-splash-seam.png") });
await b.close();
