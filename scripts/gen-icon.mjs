import { chromium } from "playwright";
import fs from "node:fs";

// Generates src/app/icon.png — Next.js's file-convention favicon/app-icon.
// A simple on-brand mark (green tile, yellow rising sun) beats the default
// Next.js/Vercel triangle in the browser tab.
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("about:blank");
const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  const GREEN = "#0b6839";
  const YELLOW = "#fee101";

  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 512, 96);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 512, 96);
  ctx.clip();

  const cx = 256;
  const cy = 340;
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 20;
  ctx.lineCap = "round";
  for (let i = 0; i < 16; i++) {
    const angle = Math.PI + (i / 15) * Math.PI;
    const inner = 80;
    const len = i % 2 === 0 ? 190 : 140;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.arc(cx, cy, 80, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return c.toDataURL("image/png");
});
fs.writeFileSync("src/app/icon.png", Buffer.from(dataUrl.split(",")[1], "base64"));
await browser.close();
console.log("wrote src/app/icon.png");
