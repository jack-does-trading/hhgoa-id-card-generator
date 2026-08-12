import { chromium } from "playwright";
import fs from "node:fs";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("about:blank");
const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext("2d");
  const GREEN = "#0b6839";
  const YELLOW = "#fee101";
  const PINK = "#ff0080";
  const CREAM = "#fffbe8";

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, c.width, c.height);

  // halftone corner texture
  ctx.fillStyle = "rgba(254,225,1,0.14)";
  for (let y = 0; y < c.height; y += 22) {
    for (let x = 0; x < c.width; x += 22) {
      const t = x / c.width;
      const r = 3 * (0.3 + 0.7 * t);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // sunburst
  const cx = c.width / 2;
  const cy = c.height + 60;
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < 28; i++) {
    const angle = Math.PI + (i / 27) * Math.PI;
    const len = i % 2 === 0 ? 260 : 190;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 130, cy + Math.sin(angle) * 130);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.arc(cx, cy, 130, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = YELLOW;
  ctx.font = "800 92px Georgia, serif";
  ctx.fillText("HACKER HOUSE", cx, 180);

  ctx.font = "600 34px Menlo, monospace";
  ctx.fillStyle = CREAM;
  ctx.fillText("GOA, INDIA · 28–31 OCT 2026", cx, 235);

  // pink sticker
  ctx.save();
  ctx.translate(cx, 330);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.font = "700 40px Menlo, monospace";
  const text = "BUILDER ID CARD GENERATOR";
  const w = ctx.measureText(text).width + 64;
  const h = 76;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, h / 2) : ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = PINK;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = CREAM;
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 4);
  ctx.restore();

  ctx.font = "700 30px Menlo, monospace";
  ctx.fillStyle = CREAM;
  ctx.fillText("#FrameInGoa", cx, 420);

  return c.toDataURL("image/png");
});
fs.writeFileSync(
  "public/og-default.png",
  Buffer.from(dataUrl.split(",")[1], "base64")
);
await browser.close();
console.log("wrote public/og-default.png");
