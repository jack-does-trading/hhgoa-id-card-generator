// Client-side canvas compositor for the Builder ID Card. Everything is drawn
// from Canvas 2D primitives using the real HH Goa brand colours/fonts — no
// copied artwork, so there's nothing to license or hotlink. The scene
// elements (stamps, palms, birds) live in cardArt.ts;
// this file is the layout.
//
// The card is two-sided: `renderIdCard` draws the front and
// `renderIdCardBack` the reverse. CardStage flips between them in 3D.

import {
  drawBarcode,
  drawBird,
  drawLeaf,
  drawPalm,
  drawRoundStamp,
  drawSparkle,
  drawSquiggle,
  roundRect,
} from "./cardArt";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export const COLORS = {
  green: "#0b6839",
  greenDark: "#073d21",
  yellow: "#fee101",
  pink: "#ff0080",
  cream: "#fffbe8",
};

export const IMBUE = '"Imbue", Georgia, serif';
export const MONO =
  '"Victor Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export type CardData = {
  name: string;
  role: string;
  builderTitle: string;
  builderId: string; // e.g. "#HH-GOA-7105" — see lib/builderId.ts
  photo: HTMLCanvasElement; // square, already cropped by PhotoCropper
  /** Live countdown at generation time — stamped onto the card so the
   *  downloaded PNG is timestamped ("77 DAYS OUT") rather than evergreen. */
  daysToGo?: number;
  /** Pre-rendered QR canvas (see lib/qr.ts). */
  qr?: HTMLCanvasElement;
  /** The गोवा brand mark (public/brand/goa-hindi.svg) loaded as an image, so
   *  the wordmark can read "HACKER गोवा HOUSE" the way the real brand sets
   *  it. Falls back to a plain "GOA" sticker when absent. */
  goaMark?: HTMLImageElement;
};

export function drawHalftone(
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
      const t = (gx - x) / w;
      const r = maxR * (0.35 + 0.65 * t);
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
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

/** Greedy word wrap, capped at `maxLines` (the last line is ellipsised). */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/** Seat number derived from the builder ID, so it's stable per card. */
export function seatFor(builderId: string): string {
  const s = hashSeed(builderId);
  return `${(s % 40) + 1}${"ABCDEF"[s % 6]}`;
}

function newCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/**
 * The portrait treatment: a yellow disc, a ring of pink dots, then the photo
 * clipped to a circle with a dark keyline.
 *
 * The photo itself is drawn completely untouched — no posterise, no colour
 * push, no grain. Every stylised element on this card is drawn *around* the
 * person, never applied to them; a filter over someone's face is the one
 * effect they didn't ask for and can't undo.
 */
export function drawFramedPhoto(
  ctx: CanvasRenderingContext2D,
  photo: CanvasImageSource,
  cx: number,
  cy: number,
  r: number
) {
  const outer = r * 1.2;

  ctx.save();
  ctx.fillStyle = COLORS.yellow;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // A ring of evenly spaced dots rather than a zigzag band — quieter, and
  // it holds its shape at avatar size where a denser pattern turns to mush.
  ctx.save();
  ctx.fillStyle = COLORS.pink;
  const dots = 26;
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 1.11, cy + Math.sin(a) * r * 1.11, r * 0.052, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();


  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(photo, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(4, r * 0.03);
  ctx.strokeStyle = COLORS.greenDark;
  ctx.stroke();
  ctx.restore();

  return outer;
}

/** Card border: dark ground, cream field inset, thin keyline inside that. */
function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = COLORS.greenDark;
  ctx.fillRect(0, 0, w, h);
  roundRect(ctx, 22, 22, w - 44, h - 44, 38);
  ctx.fillStyle = COLORS.cream;
  ctx.fill();
  roundRect(ctx, 42, 42, w - 84, h - 84, 24);
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.greenDark;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The pink hanging tab at the top edge, plus the badge slot behind it. */
function drawTopTab(ctx: CanvasRenderingContext2D, w: number) {
  // Slot (the punched hole a lanyard would thread through).
  roundRect(ctx, w / 2 - 200, 150, 400, 46, 23);
  ctx.fillStyle = COLORS.greenDark;
  ctx.fill();

  const tabW = 180;
  const x = w / 2 - tabW / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + tabW, 0);
  ctx.lineTo(x + tabW, 214);
  ctx.arcTo(x + tabW, 236, x + tabW - 22, 236, 22);
  ctx.lineTo(x + 22, 236);
  ctx.arcTo(x, 236, x, 214, 22);
  ctx.closePath();
  ctx.fillStyle = COLORS.pink;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.cream;
  ctx.stroke();
  ctx.restore();

  drawPalm(ctx, w / 2 + 3, 78, 46, COLORS.yellow, COLORS.yellow);

  ctx.save();
  ctx.fillStyle = COLORS.yellow;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 40px ${MONO}`;
  ctx.fillText("HH", w / 2, 131);
  ctx.fillText("GOA", w / 2, 172);
  ctx.font = `800 32px ${MONO}`;
  ctx.fillText("2026", w / 2, 210);
  ctx.restore();
}

/** Chamfered (corner-cut) rectangle path — a ticket-window field, as
 *  opposed to the rounded pill used everywhere else. */
function chamferRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: number
) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/**
 * The masthead: "HACKER HOUSE" reversed out of a notched green ribbon, with
 * the गोवा mark as a badge overlapping its right end.
 *
 * Deliberately not the inline "HACKER गोवा HOUSE" setting — that reads as one
 * flat line of display type, and putting the mark *between* the two words is
 * the single most recognisable thing about the layout this card was sketched
 * from. A banner plus an applied badge says the same thing in a different
 * voice: the type sits on a surface, and the mark is stuck on top of it.
 */
function drawWordmarkBanner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  mark?: HTMLImageElement
) {
  const w = 620;
  const h = 96;
  const notch = 32;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy - h / 2);
  ctx.lineTo(cx + w / 2 - notch, cy);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy + h / 2);
  ctx.lineTo(cx - w / 2 + notch, cy);
  ctx.closePath();
  ctx.fillStyle = COLORS.greenDark;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.yellow;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = COLORS.cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textCx = cx - 46;
  ctx.font = `800 ${fitText(ctx, "HACKER HOUSE", IMBUE, "800", 430, 66, 30)}px ${IMBUE}`;
  ctx.fillText("HACKER HOUSE", textCx, cy + 2);
  ctx.restore();

  // गोवा badge, slapped over the ribbon's right end.
  const bx = cx + w / 2 - 42;
  const br = 58;
  ctx.save();
  ctx.translate(bx, cy);
  ctx.rotate((-9 * Math.PI) / 180);
  ctx.beginPath();
  ctx.arc(0, 0, br, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.yellow;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = COLORS.pink;
  ctx.stroke();
  if (mark) {
    const mw = br * 1.28;
    const mh = mw * (mark.naturalHeight / mark.naturalWidth || 1);
    ctx.drawImage(mark, -mw / 2, -mh / 2, mw, mh);
  } else {
    ctx.fillStyle = COLORS.pink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 34px ${MONO}`;
    ctx.fillText("GOA", 0, 2);
  }
  ctx.restore();
}

/** Rubber-stamp block — rotated, outlined, slightly transparent. */
function drawRubberStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  rotationDeg: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.globalAlpha = 0.7;
  ctx.font = `800 26px ${MONO}`;
  const w = ctx.measureText(text).width + 36;
  const h = 60;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  roundRect(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 9, -h / 2 + 9);
  ctx.lineTo(w / 2 - 9, -h / 2 + 9);
  ctx.moveTo(-w / 2 + 9, h / 2 - 9);
  ctx.lineTo(w / 2 - 9, h / 2 - 9);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

/** Column heading: ✦ LABEL ✦ */
function drawColumnLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  text: string
) {
  ctx.save();
  ctx.font = `800 21px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.greenDark;
  ctx.fillText(text, cx, y);
  const half = ctx.measureText(text).width / 2;
  drawSparkle(ctx, cx - half - 18, y, 7, COLORS.pink);
  drawSparkle(ctx, cx + half + 18, y, 7, COLORS.pink);
  ctx.restore();
}

/**
 * The scenery layer. Two palms, one per side, framing the portrait — and
 * that's the whole cast. An earlier pass had a signpost, a house, a scooter,
 * a surfboard and a burst sticker all fighting for the margins; at 1080px
 * wide none of them were legible and together they read as clip-art. Two
 * well-drawn elements hold the composition better than six small ones.
 */
function drawFrontScenery(ctx: CanvasRenderingContext2D) {
  const { greenDark, green, pink, yellow } = COLORS;

  drawPalm(ctx, 184, 902, 232, "#b98a3c", green);
  drawPalm(ctx, 898, 902, 232, "#b98a3c", green);

  // Ambient marks — texture, not objects.
  drawBird(ctx, 322, 262, 19, greenDark);
  drawBird(ctx, 372, 244, 14, greenDark);
  drawBird(ctx, 292, 232, 12, greenDark);
  for (const [x, y, r, c] of [
    [700, 236, 12, pink],
    [292, 468, 10, yellow],
    [806, 466, 11, yellow],
    [72, 452, 9, pink],
    [1012, 450, 9, pink],
  ] as [number, number, number, string][]) {
    drawSparkle(ctx, x, y, r, c);
  }
}

// ---------------------------------------------------------------- front ---

export function renderIdCard(data: CardData): HTMLCanvasElement {
  const { canvas, ctx } = newCanvas(CARD_WIDTH, CARD_HEIGHT);
  const cx = CARD_WIDTH / 2;

  drawFrame(ctx, CARD_WIDTH, CARD_HEIGHT);
  drawFrontScenery(ctx);

  // --- top furniture ---
  drawRoundStamp(ctx, 944, 166, 76, "BUILD IN GOA", "SHIP FROM PARADISE", COLORS.greenDark);
  if (typeof data.daysToGo === "number" && data.daysToGo > 0) {
    drawRubberStamp(ctx, 186, 152, `${data.daysToGo} DAYS OUT`, -12, COLORS.pink);
  }
  drawTopTab(ctx, CARD_WIDTH);

  // --- masthead ---
  drawWordmarkBanner(ctx, cx, 346, data.goaMark);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.green;
  ctx.font = `600 27px ${MONO}`;
  ctx.fillText("GOA, INDIA · 28–31 OCT 2026", cx, 428);
  ctx.restore();

  // --- portrait ---
  drawFramedPhoto(ctx, data.photo, cx, 660, 164);

  // --- name: chamfered ticket field with a double keyline ---
  const nameText = (data.name || "YOUR NAME HERE").toUpperCase();
  {
    const plateW = 592;
    const plateH = 78;
    const plateY = 880;
    chamferRect(ctx, cx - plateW / 2, plateY, plateW, plateH, 20);
    ctx.fillStyle = COLORS.greenDark;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.yellow;
    ctx.stroke();
    chamferRect(ctx, cx - plateW / 2 + 9, plateY + 9, plateW - 18, plateH - 18, 13);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.cream;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${fitText(ctx, nameText, IMBUE, "800", plateW - 80, 56, 26)}px ${IMBUE}`;
    ctx.fillText(nameText, cx, plateY + plateH / 2 + 2);
  }

  // --- role: ruled line, no box — keeps two stacked plates from reading as
  //     a pair of stickers ---
  const roleText = (data.role || "FULL-STACK BUILDER").toUpperCase();
  {
    const y = 1004;
    ctx.save();
    ctx.fillStyle = COLORS.pink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${fitText(ctx, roleText, MONO, "700", 460, 30, 16)}px ${MONO}`;
    ctx.fillText(roleText, cx, y);
    const half = ctx.measureText(roleText).width / 2;

    ctx.strokeStyle = COLORS.pink;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.75;
    for (const dir of [-1, 1]) {
      const from = cx + dir * (half + 26);
      const to = cx + dir * 300;
      ctx.beginPath();
      ctx.moveTo(from, y);
      ctx.lineTo(to, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawSparkle(ctx, to + dir * 14, y, 9, COLORS.pink);
      ctx.globalAlpha = 0.75;
    }
    ctx.restore();
  }

  // --- three-column footer ---
  const colTop = 1064;
  const divX = [352, 700];
  ctx.save();
  ctx.strokeStyle = COLORS.pink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  for (const x of divX) {
    ctx.beginPath();
    ctx.moveTo(x, colTop - 22);
    ctx.lineTo(x, 1252);
    ctx.stroke();
  }
  ctx.restore();

  // col 1 — builder class + QR
  {
    const c = 210;
    drawColumnLabel(ctx, c, colTop, "BUILDER CLASS");
    // Three lines at 24px, not two at 30 — titles run to three words
    // ("Official Beach-Deploy Builder") and clipping the last one turns the
    // card's most personal field into a typo.
    ctx.save();
    ctx.font = `800 24px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.pink;
    const lines = wrapLines(ctx, data.builderTitle.toUpperCase(), 258, 3);
    lines.forEach((line, i) => ctx.fillText(line, c, colTop + 38 + i * 27));
    ctx.restore();

    const qrSize = 68;
    if (data.qr) {
      ctx.drawImage(data.qr, c - qrSize / 2, 1178, qrSize, qrSize);
    }
  }

  // col 2 — packing reminders
  {
    const c = 526;
    drawColumnLabel(ctx, c, colTop, "DON'T FORGET THESE");
    ctx.save();
    ctx.font = `700 25px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const [i, label] of ["TOWEL", "SUNSCREEN", "VS CODE"].entries()) {
      const y = colTop + 54 + i * 48;
      chamferRect(ctx, 396, y - 15, 30, 30, 7);
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.green;
      ctx.stroke();
      ctx.fillStyle = COLORS.greenDark;
      ctx.fillText(label, 442, y);
    }
    ctx.restore();
  }

  // col 3 — currently shipping + id + barcode
  {
    const c = 866;
    drawColumnLabel(ctx, c, colTop, "CURRENTLY SHIPPING");
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.pink;
    ctx.font = `800 26px ${MONO}`;
    const lines = wrapLines(ctx, "BUILDING THE FUTURE", 280, 2);
    lines.forEach((line, i) => ctx.fillText(line, c, colTop + 40 + i * 30));
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.greenDark;
    ctx.font = `700 21px ${MONO}`;
    ctx.fillText("BUILDER ID", c, 1166);
    ctx.font = `800 28px ${MONO}`;
    ctx.fillText(data.builderId, c, 1198);
    ctx.restore();

    drawBarcode(ctx, c - 130, 1218, 260, 30, COLORS.greenDark, data.builderId);
  }

  // --- bottom ribbon ---
  {
    const y = 1290;
    const w = 470;
    const h = 62;
    ctx.save();
    // Tails
    ctx.fillStyle = COLORS.pink;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * (w / 2 - 6), y - h / 2);
      ctx.lineTo(cx + dir * (w / 2 + 56), y - h / 2);
      ctx.lineTo(cx + dir * (w / 2 + 34), y);
      ctx.lineTo(cx + dir * (w / 2 + 56), y + h / 2);
      ctx.lineTo(cx + dir * (w / 2 - 6), y + h / 2);
      ctx.closePath();
      ctx.fill();
    }
    roundRect(ctx, cx - w / 2, y - h / 2, w, h, 10);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.cream;
    ctx.stroke();
    ctx.fillStyle = COLORS.cream;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 34px ${MONO}`;
    ctx.fillText("#FRAMEINGOA", cx, y + 1);
    drawSparkle(ctx, cx - w / 2 + 40, y, 11, COLORS.yellow);
    drawSparkle(ctx, cx + w / 2 - 40, y, 11, COLORS.yellow);
    ctx.restore();
  }

  return canvas;
}

// ----------------------------------------------------------------- back ---

/**
 * The reverse face. Real passes have a back, and giving this one somewhere to
 * put the QR at full size (plus the flavour fields) is what unloads the
 * front's composition instead of cramming everything above one fold.
 */
export function renderIdCardBack(data: CardData): HTMLCanvasElement {
  const { canvas, ctx } = newCanvas(CARD_WIDTH, CARD_HEIGHT);
  const cx = CARD_WIDTH / 2;

  drawFrame(ctx, CARD_WIDTH, CARD_HEIGHT);

  // Scenery, lighter than the front so the data stays the subject.
  drawLeaf(ctx, 44, 200, 104, -30, COLORS.green, 0.3);
  drawLeaf(ctx, 1036, 188, 104, 210, COLORS.green, 0.3);
  drawPalm(ctx, 118, 1210, 96, COLORS.green, COLORS.green);
  drawPalm(ctx, 962, 1218, 84, COLORS.green, COLORS.green);
  drawBird(ctx, 250, 168, 17, COLORS.greenDark);
  drawBird(ctx, 294, 152, 13, COLORS.greenDark);
  for (const [x, y, r] of [
    [880, 300, 11],
    [190, 320, 9],
    [1000, 660, 10],
    [78, 700, 10],
  ] as [number, number, number][]) {
    drawSparkle(ctx, x, y, r, COLORS.yellow);
  }

  // --- ADMIT ONE ---
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.greenDark;
  ctx.font = `800 96px ${IMBUE}`;
  ctx.fillText("ADMIT ONE", cx, 152);
  ctx.restore();
  drawSquiggle(ctx, cx - 150, 208, 300, 7, 6, COLORS.pink, 4);

  // Perforation across the full width.
  ctx.save();
  ctx.strokeStyle = COLORS.greenDark;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(62, 250);
  ctx.lineTo(CARD_WIDTH - 62, 250);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = COLORS.greenDark;
  for (const x of [22, CARD_WIDTH - 22]) {
    ctx.beginPath();
    ctx.arc(x, 250, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- big QR in a yellow frame with corner brackets ---
  const qrBox = 380;
  const qrX = cx - qrBox / 2;
  const qrY = 302;
  const pad = 26;
  roundRect(ctx, qrX - pad, qrY - pad, qrBox + pad * 2, qrBox + pad * 2, 24);
  ctx.fillStyle = COLORS.yellow;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = COLORS.greenDark;
  ctx.stroke();

  if (data.qr) ctx.drawImage(data.qr, qrX, qrY, qrBox, qrBox);
  else {
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(qrX, qrY, qrBox, qrBox);
  }

  ctx.save();
  ctx.strokeStyle = COLORS.pink;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  const bl = 34;
  for (const [bx, by, sx, sy] of [
    [qrX - pad - 8, qrY - pad - 8, 1, 1],
    [qrX + qrBox + pad + 8, qrY - pad - 8, -1, 1],
    [qrX - pad - 8, qrY + qrBox + pad + 8, 1, -1],
    [qrX + qrBox + pad + 8, qrY + qrBox + pad + 8, -1, -1],
  ] as [number, number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(bx + sx * bl, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by + sy * bl);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.font = `700 26px ${MONO}`;
  ctx.fillStyle = COLORS.green;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SCAN AT THE DOOR · NO REFUNDS", cx, qrY + qrBox + pad + 48);
  ctx.restore();

  // --- spec rows ---
  const rows: [string, string][] = [
    ["Bearer", data.name.trim() || "Unnamed Builder"],
    ["Clearance level", data.builderTitle],
    ["Gate / Seat", `PANJIM · ${seatFor(data.builderId)}`],
    ["Wi-Fi", "hh-goa-2026 / feniandchill"],
    ["Emergency contact", "Your rubber duck"],
    [
      "Issued",
      typeof data.daysToGo === "number" && data.daysToGo > 0
        ? `${data.daysToGo} days before Goa`
        : "On the day",
    ],
  ];

  let rowY = qrY + qrBox + pad + 108;
  const rowGap = 56;
  const leftX = 84;
  const rightX = CARD_WIDTH - 84;

  for (const [label, value] of rows) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 21px ${MONO}`;
    ctx.fillStyle = COLORS.green;
    ctx.globalAlpha = 0.65;
    ctx.fillText(label.toUpperCase(), leftX, rowY);
    ctx.restore();

    const labelW = ctx.measureText(label.toUpperCase()).width;
    const avail = rightX - leftX - labelW - 40;
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${fitText(ctx, value, MONO, "700", avail, 27, 15)}px ${MONO}`;
    ctx.fillStyle = COLORS.greenDark;
    ctx.fillText(value, rightX, rowY);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = COLORS.greenDark;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(leftX, rowY + 20);
    ctx.lineTo(rightX, rowY + 20);
    ctx.stroke();
    ctx.restore();

    rowY += rowGap;
  }

  // --- footer ribbon ---
  {
    const y = 1268;
    const w = 560;
    const h = 66;
    ctx.save();
    roundRect(ctx, cx - w / 2, y - h / 2, w, h, 12);
    ctx.fillStyle = COLORS.greenDark;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.yellow;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.yellow;
    ctx.textBaseline = "alphabetic";
    ctx.font = `800 32px ${MONO}`;
    ctx.fillText(data.builderId, cx, y - 4);
    ctx.font = `500 19px ${MONO}`;
    ctx.fillStyle = COLORS.cream;
    ctx.fillText("NON-TRANSFERABLE · HHGOA.COM", cx, y + 22);
    ctx.restore();
  }

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
