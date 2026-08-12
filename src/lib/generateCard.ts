// Client-side canvas compositor for the Builder ID Card. Everything here is
// drawn with the 2D Canvas API from primitives (arcs, rects, text) using the
// real HH Goa brand colors/fonts — no copied artwork, so there's nothing to
// license or hotlink from hhgoa.com.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export const COLORS = {
  green: "#0b6839",
  greenDark: "#073d21",
  yellow: "#fee101",
  pink: "#ff0080",
  cream: "#fffbe8",
};

export type CardData = {
  name: string;
  role: string;
  builderTitle: string;
  builderId: string; // e.g. "#HH-GOA-7105" — see lib/builderId.ts
  photo: HTMLCanvasElement; // square, already cropped by PhotoCropper
  /** Pre-rendered QR canvas (see lib/qr.ts) — optional; the bottom stub
   *  row's layout stays fixed either way, it just leaves that square blank
   *  if this isn't provided. */
  qr?: HTMLCanvasElement;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHalftone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  spacing = 18,
  maxR = 3.2
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  for (let gy = y; gy < y + h + spacing; gy += spacing) {
    for (let gx = x; gx < x + w + spacing; gx += spacing) {
      // Fade the dot radius toward the far edge for a printed halftone feel.
      const t = (gx - x) / w;
      const r = maxR * (0.35 + 0.65 * t);
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSunburst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  count: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const len = i % 2 === 0 ? outerR : outerR * 0.7;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Shrinks font size until `text` fits within `maxWidth`, single line. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  weight: string,
  maxWidth: number,
  startSize: number,
  minSize: number
) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

/** Cheap deterministic string hash, used only to seed the decorative
 *  barcode below so it looks different per card without needing real
 *  barcode encoding (it's flavor, not a scannable code — the QR code next
 *  to it is the one real machine-readable element). */
function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Decorative barcode — random-looking but seeded off `seedStr` so the same
 *  builder ID always draws the same bars. */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  seedStr: string
) {
  ctx.save();
  ctx.fillStyle = color;
  let seed = hashSeed(seedStr);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const endX = x + w;
  let cx = x;
  while (cx < endX) {
    const barW = 2 + rand() * 5;
    const gap = 2 + rand() * 4;
    if (rand() > 0.3) {
      ctx.fillRect(cx, y, Math.min(barW, endX - cx), h);
    }
    cx += barW + gap;
  }
  ctx.restore();
}

/**
 * Rotated pill badge (the गोवा-sticker style accent). Auto-shrinks its font
 * so long generated titles ("Certified Palm-Shade Bug Whisperer") still fit
 * on the card, and clamps its center so it never draws past the canvas edge.
 */
function drawStickerBadge(
  ctx: CanvasRenderingContext2D,
  desiredCx: number,
  cy: number,
  text: string,
  rotationDeg: number,
  maxWidth: number,
  canvasWidth: number,
  margin: number
) {
  const fontFamily =
    "\"Victor Mono\", ui-monospace, SFMono-Regular, Menlo, monospace";
  const paddingX = 30;
  const paddingY = 18;

  let fontSize = 40;
  const minFontSize = 20;
  let textW = 0;
  while (fontSize > minFontSize) {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    textW = ctx.measureText(text).width;
    if (textW + paddingX * 2 <= maxWidth) break;
    fontSize -= 2;
  }

  const w = Math.min(maxWidth, textW + paddingX * 2);
  const h = fontSize + paddingY * 2;

  // Keep the (unrotated) bounding box fully on the card.
  const cx = Math.min(
    canvasWidth - margin - w / 2,
    Math.max(margin + w / 2, desiredCx)
  );

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.cream;
  ctx.stroke();
  ctx.fillStyle = COLORS.cream;
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 3, maxWidth);
  ctx.restore();
}

export function renderIdCard(data: CardData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  const imbue = "\"Imbue\", Georgia, serif";
  const mono = "\"Victor Mono\", ui-monospace, SFMono-Regular, Menlo, monospace";

  // --- base ---
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // --- header band ---
  const headerH = 330;
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, 0, CARD_WIDTH, headerH);
  drawHalftone(ctx, 0, 0, CARD_WIDTH, headerH, "rgba(254,225,1,0.16)", 22, 3);
  drawSunburst(ctx, CARD_WIDTH / 2, headerH + 40, 60, 150, 24, COLORS.yellow);

  ctx.fillStyle = COLORS.yellow;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 78px ${imbue}`;
  ctx.fillText("HACKER HOUSE", CARD_WIDTH / 2, 130);

  ctx.font = `600 30px ${mono}`;
  ctx.fillStyle = COLORS.cream;
  ctx.fillText("GOA, INDIA · 28–31 OCT 2026", CARD_WIDTH / 2, 175);

  // --- builder id chip ---
  // Previously sat as plain centered text at the sunburst's own height, so
  // its rays visually cut straight through it (illegible). Moved to a
  // solid-backed pill tucked in the header's top-right corner instead —
  // clear of both the sunburst (which radiates from center) and the
  // wordmark (centered, well left of this corner) — so it's the one thing
  // guaranteed to read cleanly at a glance.
  {
    ctx.font = `800 30px ${mono}`;
    const label = data.builderId;
    const padX = 22;
    const textW = ctx.measureText(label).width;
    const chipW = textW + padX * 2;
    const chipH = 52;
    const chipX = CARD_WIDTH - 36 - chipW;
    const chipY = 26;
    roundRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fillStyle = COLORS.cream;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.yellow;
    ctx.stroke();
    ctx.fillStyle = COLORS.greenDark;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, chipX + chipW / 2, chipY + chipH / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }

  // --- photo slot: circular, postage-stamp scalloped frame ---
  const photoR = 280;
  const photoCx = CARD_WIDTH / 2;
  const photoCy = headerH + photoR - 20;
  const ringGap = 16; // solid ring thickness between photo edge and scallop
  const bumpR = 9;
  const bumpCount = 30;
  const scallopRingR = photoR + ringGap + bumpR; // bump centers sit here

  // Scalloped "stamp perforation" bumps around the circumference.
  ctx.save();
  ctx.fillStyle = COLORS.yellow;
  for (let i = 0; i < bumpCount; i++) {
    const angle = (i / bumpCount) * Math.PI * 2;
    const bx = photoCx + Math.cos(angle) * scallopRingR;
    const by = photoCy + Math.sin(angle) * scallopRingR;
    ctx.beginPath();
    ctx.arc(bx, by, bumpR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Solid ring backing fills the gaps between bumps for a clean edge.
  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR + ringGap, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.yellow;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    data.photo,
    photoCx - photoR,
    photoCy - photoR,
    photoR * 2,
    photoR * 2
  );
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = COLORS.greenDark;
  ctx.stroke();
  ctx.restore();

  const circleBottom = photoCy + scallopRingR + bumpR;

  // --- builder title sticker, overlapping the circle's lower-right edge ---
  drawStickerBadge(
    ctx,
    photoCx + photoR * 0.55,
    circleBottom - 20,
    data.builderTitle.toUpperCase(),
    -4,
    CARD_WIDTH - 80,
    CARD_WIDTH,
    40
  );

  // --- name ---
  const nameY = circleBottom + 110;
  const nameSize = fitText(
    ctx,
    data.name || "YOUR NAME HERE",
    imbue,
    "800",
    CARD_WIDTH - 120,
    72,
    38
  );
  ctx.font = `800 ${nameSize}px ${imbue}`;
  ctx.fillStyle = COLORS.greenDark;
  ctx.textAlign = "center";
  ctx.fillText((data.name || "YOUR NAME HERE").toUpperCase(), CARD_WIDTH / 2, nameY);

  // --- role / stack ---
  const roleY = nameY + 60;
  const roleSize = fitText(
    ctx,
    data.role || "Full-Stack Builder",
    mono,
    "600",
    CARD_WIDTH - 160,
    34,
    20
  );
  ctx.font = `600 ${roleSize}px ${mono}`;
  ctx.fillStyle = COLORS.green;
  ctx.fillText(data.role || "Full-Stack Builder", CARD_WIDTH / 2, roleY);

  // --- QR + barcode stub row ("ticket stub" tear line above it) ---
  const stubTearY = roleY + 34;
  ctx.save();
  ctx.strokeStyle = COLORS.greenDark;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(40, stubTearY);
  ctx.lineTo(CARD_WIDTH - 40, stubTearY);
  ctx.stroke();
  ctx.restore();

  const qrSize = 78;
  const qrX = 70;
  const qrY = stubTearY + 24;
  if (data.qr) {
    ctx.drawImage(data.qr, qrX, qrY, qrSize, qrSize);
  }

  const barX = qrX + qrSize + 28;
  const barW = CARD_WIDTH - 40 - barX;
  const barH = qrSize * 0.55;
  drawBarcode(ctx, barX, qrY, barW, barH, COLORS.greenDark, data.builderId);

  ctx.font = `700 26px ${mono}`;
  ctx.fillStyle = COLORS.greenDark;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(data.builderId, barX, qrY + barH + 30);

  // --- footer band ---
  const footerH = 130;
  const footerY = CARD_HEIGHT - footerH;
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, footerY, CARD_WIDTH, footerH);
  drawHalftone(
    ctx,
    0,
    footerY,
    CARD_WIDTH,
    footerH,
    "rgba(255,0,128,0.35)",
    20,
    3
  );

  ctx.font = `700 34px ${mono}`;
  ctx.fillStyle = COLORS.yellow;
  ctx.textAlign = "center";
  ctx.fillText("#FrameInGoa", CARD_WIDTH / 2, footerY + 55);
  ctx.font = `500 22px ${mono}`;
  ctx.fillStyle = COLORS.cream;
  ctx.fillText("HHGOA.COM", CARD_WIDTH / 2, footerY + 90);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
      0.95
    );
  });
}
