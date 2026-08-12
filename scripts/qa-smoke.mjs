import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SCRATCH =
  "/private/tmp/claude-501/-Users-bhavyadeephada-Desktop-hh-goa-task-1/35fa38e5-1edb-426d-8f3b-9178e94a833e/scratchpad";
const SAMPLE_PHOTO = path.join(SCRATCH, "sample-photo.png");

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

// 1. Build a sample "photo" (off-center portrait-ish gradient with a face-like
// circle) purely in-browser so we don't need ImageMagick/PIL installed.
await page.goto("about:blank");
const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 1400; // tall portrait, off-center subject — exercises the cropper
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, "#274b8f");
  grad.addColorStop(1, "#7fb6ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  // "face" off to one side, near the top — a real off-center photo
  ctx.fillStyle = "#f2c48d";
  ctx.beginPath();
  ctx.ellipse(620, 380, 180, 220, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a2a1a";
  ctx.beginPath();
  ctx.ellipse(560, 320, 20, 14, 0, 0, Math.PI * 2);
  ctx.ellipse(680, 320, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  return c.toDataURL("image/png");
});
const base64 = dataUrl.split(",")[1];
fs.writeFileSync(SAMPLE_PHOTO, Buffer.from(base64, "base64"));

// Dismisses the pre-site video splash by clicking its CTA and waiting out
// the curtain-split animation — needed before any interaction with the
// real app underneath, since the splash starts on top of it every load.
async function dismissSplash(p) {
  const cta = p.getByRole("button", { name: /put the vibes on/i });
  await cta.waitFor({ state: "visible", timeout: 10000 });
  await cta.click();
  await p.waitForTimeout(1100); // past the 900ms split transition
}

// 2. Real app flow
const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3000";
// `networkidle` never fires here — the looping hype video keeps issuing
// range requests — so wait for `load` instead.
await page.goto(BASE_URL, { waitUntil: "load" });
await dismissSplash(page);
await page.waitForSelector("text=Tap to upload your photo");
await page.screenshot({ path: path.join(SCRATCH, "01-upload.png") });

const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(SAMPLE_PHOTO);

await page.waitForSelector("text=Drag to reposition", { timeout: 15000 });
// Nudge the crop a bit so it's not sitting at default 1x/centered.
const canvasBox = await page.locator("canvas").first().boundingBox();
if (canvasBox) {
  const cx = canvasBox.x + canvasBox.width / 2;
  const cy = canvasBox.y + canvasBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy - 30, { steps: 8 });
  await page.mouse.up();
}

await page.fill('input[placeholder="e.g. Priya Shenoy"]', "Test Builder");
await page.fill(
  'input[placeholder="e.g. Full-stack, ex-Rust, no-sleep"]',
  "Full-Stack, Half-Awake"
);
await page.screenshot({ path: path.join(SCRATCH, "02-edit.png") });

// The button's visible label is a randomized quirky string (see
// GENERATE_LABELS in BuilderIdCardApp.tsx) — target it by its stable
// aria-label instead of visible text.
await page.click('button[aria-label="Generate card"]');
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(SCRATCH, "02b-processing.png") });

await page.waitForSelector('img[alt="Your HH Goa 2026 Builder ID Card"]', {
  timeout: 15000,
});
await page.waitForTimeout(1200); // let the reveal transition settle
await page.screenshot({ path: path.join(SCRATCH, "03-result.png") });

// Also grab just the generated card image at higher fidelity.
await page
  .locator('img[alt="Your HH Goa 2026 Builder ID Card"]')
  .screenshot({ path: path.join(SCRATCH, "03b-card-only.png") });

// Share button: with no BLOB_READ_WRITE_TOKEN configured locally, the
// upload should fail gracefully and still open a text-only X intent —
// confirms the fallback degrades instead of throwing.
const popupPromise = context.waitForEvent("page", { timeout: 5000 }).catch(() => null);
await page.click('button:has-text("Share to")');
const popup = await popupPromise;
console.log("SHARE_POPUP_URL:", popup ? popup.url() : "(none opened)");

// Wider viewport pass, purely to review how much of the beach backdrop
// shows around the floating panel on a bigger screen.
await context.close();
const wideContext = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const widePage = await wideContext.newPage();
await widePage.goto(BASE_URL, { waitUntil: "load" });
await dismissSplash(widePage);
await widePage.waitForSelector("text=Tap to upload your photo");
await widePage.screenshot({ path: path.join(SCRATCH, "04-wide-upload.png") });
await wideContext.close();

console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors, null, 2));

await browser.close();
