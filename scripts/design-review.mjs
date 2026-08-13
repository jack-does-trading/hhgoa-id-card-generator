import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SCRATCH =
  "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad";
const OUT = path.join(SCRATCH, "dr");
fs.mkdirSync(OUT, { recursive: true });
const SAMPLE_PHOTO = path.join(SCRATCH, "sample-photo.png");
const BASE_URL = "http://localhost:3000";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];

// --- desktop pass ---
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

if (!fs.existsSync(SAMPLE_PHOTO)) {
  await page.goto("about:blank");
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900; c.height = 1400;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#274b8f"); g.addColorStop(1, "#7fb6ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#f2c48d";
    ctx.beginPath(); ctx.ellipse(620, 380, 180, 220, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.ellipse(560, 320, 20, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(680, 320, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
    return c.toDataURL("image/png");
  });
  fs.writeFileSync(SAMPLE_PHOTO, Buffer.from(dataUrl.split(",")[1], "base64"));
}

await page.goto(BASE_URL, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, "01-splash-desktop.png") });

await page.getByRole("button", { name: /put the vibes on/i }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "02-split-midway.png") });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, "03-upload-desktop.png") });

await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PHOTO);
await page.waitForSelector("text=Drag to reposition", { timeout: 15000 });
await page.fill('input[placeholder="e.g. Priya Shenoy"]', "Priya Shenoy");
await page.fill('input[placeholder="e.g. Full-stack, ex-Rust, no-sleep"]', "Full-stack, ex-Rust");
await page.screenshot({ path: path.join(OUT, "04-edit-desktop.png") });

await page.click('button[aria-label="Generate card"]');
await page.waitForSelector('img[alt="Your HH Goa 2026 Builder ID Card"]', { timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, "05-result-desktop.png") });

// full-res card straight off the data URL
const cardData = await page.locator('img[alt="Your HH Goa 2026 Builder ID Card"]').getAttribute("src");
fs.writeFileSync(path.join(OUT, "06-card-fullres.png"), Buffer.from(cardData.split(",")[1], "base64"));
// flip to the back
await page.locator('[aria-label="Show card back"]').click();
await page.waitForTimeout(1100);
await page.screenshot({ path: path.join(OUT, "05b-result-back.png") });
const backData = await page.locator('img[alt=""]').last().getAttribute("src");
if (backData?.startsWith("data:")) fs.writeFileSync(path.join(OUT, "06b-back-fullres.png"), Buffer.from(backData.split(",")[1], "base64"));

// export formats: click each chip and capture the download canvas via evaluate
for (const fmt of ["story", "x", "pfp"]) {
  await page.getByRole("button", { name: new RegExp(fmt === "x" ? "^X" : fmt === "pfp" ? "Avatar" : "Story", "i") }).click();
  await page.waitForTimeout(200);
}
await ctx.close();

// --- mobile pass ---
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
mp.on("pageerror", (e) => errors.push("mobile pageerror: " + e.message));
await mp.goto(BASE_URL, { waitUntil: "load" });
await mp.waitForTimeout(2500);
await mp.screenshot({ path: path.join(OUT, "07-splash-mobile.png") });
await mp.getByRole("button", { name: /put the vibes on/i }).first().click();
await mp.waitForTimeout(1400);
await mp.screenshot({ path: path.join(OUT, "08-upload-mobile.png") });
await mp.locator('input[type="file"]').first().setInputFiles(SAMPLE_PHOTO);
await mp.waitForSelector("text=Drag to reposition", { timeout: 15000 });
await mp.screenshot({ path: path.join(OUT, "09-edit-mobile.png"), fullPage: true });
await mctx.close();

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
console.log("DONE ->", OUT);
