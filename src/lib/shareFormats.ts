// One card, four surfaces. The generated front face is composed onto
// correctly-proportioned canvases for each place people actually post —
// rather than making everyone crop a 4:5 image by hand and lose the edges.
//
// The 1:1 PFP is the odd one out: it isn't the card scaled down (the card is
// unreadable at avatar size), it re-uses the scalloped portrait treatment on
// its own so it still reads as an HH Goa artifact in a 40px circle.

import {
  CARD_HEIGHT,
  CARD_WIDTH,
  COLORS,
  IMBUE,
  MONO,
  type CardData,
  drawHalftone,
  drawFramedPhoto,
} from "./generateCard";

export type ShareFormat = "feed" | "story" | "x" | "pfp";

export const FORMAT_META: Record<
  ShareFormat,
  { label: string; hint: string; w: number; h: number }
> = {
  feed: { label: "Post", hint: "4:5 · feed", w: CARD_WIDTH, h: CARD_HEIGHT },
  story: { label: "Story", hint: "9:16 · stories", w: 1080, h: 1920 },
  x: { label: "X", hint: "16:9 · timeline", w: 1600, h: 900 },
  pfp: { label: "Avatar", hint: "1:1 · profile", w: 1000, h: 1000 },
};

function newCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/** Brand ground shared by every non-feed format. */
function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, 0, w, h);
  drawHalftone(ctx, 0, 0, w, h, "rgba(254,225,1,0.13)", 26, 3.4);
}

function shadowed(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 18;
  draw();
  ctx.restore();
}

export function renderShareFormat(
  format: ShareFormat,
  card: HTMLCanvasElement,
  data: CardData
): HTMLCanvasElement {
  if (format === "feed") return card;
  if (format === "pfp") return renderPfp(data);

  const { w, h } = FORMAT_META[format];
  const { canvas, ctx } = newCanvas(w, h);
  paintBackdrop(ctx, w, h);

  ctx.textBaseline = "alphabetic";

  if (format === "story") {
    // Sized and placed so the card lands in a story's safe zone: clear of the
    // top status bar, and clear of the reply bar that eats the bottom ~15%.
    const cardW = 860;
    const cardH = (cardW / CARD_WIDTH) * CARD_HEIGHT;
    const cardX = (w - cardW) / 2;
    const cardY = 380;

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.yellow;
    ctx.font = `800 88px ${IMBUE}`;
    ctx.fillText("HACKER HOUSE", w / 2, 212);
    ctx.font = `600 30px ${MONO}`;
    ctx.fillStyle = COLORS.cream;
    ctx.fillText("GOA, INDIA · 28–31 OCT 2026", w / 2, 264);

    shadowed(ctx, () => ctx.drawImage(card, cardX, cardY, cardW, cardH));

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.yellow;
    ctx.font = `700 50px ${MONO}`;
    ctx.fillText("#FrameInGoa", w / 2, cardY + cardH + 108);
    ctx.fillStyle = COLORS.cream;
    ctx.font = `500 30px ${MONO}`;
    ctx.fillText("Make yours · hhgoa.com", w / 2, cardY + cardH + 162);
    return canvas;
  }

  // format === "x" — card left, identity block right
  const cardH = 780;
  const cardW = (cardH / CARD_HEIGHT) * CARD_WIDTH;
  const cardX = 96;
  const cardY = (h - cardH) / 2;
  shadowed(ctx, () => ctx.drawImage(card, cardX, cardY, cardW, cardH));

  const textX = cardX + cardW + 88;
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.yellow;
  ctx.font = `800 82px ${IMBUE}`;
  ctx.fillText("HACKER HOUSE", textX, 300);

  ctx.fillStyle = COLORS.cream;
  ctx.font = `600 30px ${MONO}`;
  ctx.fillText("GOA, INDIA · 28–31 OCT 2026", textX, 352);

  ctx.fillStyle = COLORS.cream;
  ctx.font = `800 56px ${IMBUE}`;
  ctx.fillText(
    (data.name.trim() || "Your Name Here").toUpperCase(),
    textX,
    470
  );

  ctx.fillStyle = COLORS.yellow;
  ctx.font = `600 30px ${MONO}`;
  ctx.fillText(data.builderTitle, textX, 522);

  ctx.fillStyle = COLORS.pink;
  ctx.font = `700 44px ${MONO}`;
  ctx.fillText("#FrameInGoa", textX, 630);

  // Not the builder ID — that's already legible in the card's own chip a few
  // hundred pixels to the left. This line is the only place in the whole
  // composition that tells a stranger what to do next.
  ctx.fillStyle = COLORS.cream;
  ctx.globalAlpha = 0.8;
  ctx.font = `500 28px ${MONO}`;
  ctx.fillText("Make yours · hhgoa.com", textX, 682);
  ctx.globalAlpha = 1;

  return canvas;
}

/** 1:1 avatar — the scalloped portrait treatment on brand ground, legible
 *  as a tiny circle, with a ribbon so it still says where it's from. */
function renderPfp(data: CardData): HTMLCanvasElement {
  const size = FORMAT_META.pfp.w;
  const { canvas, ctx } = newCanvas(size, size);
  paintBackdrop(ctx, size, size);

  drawFramedPhoto(ctx, data.photo, size / 2, size / 2 - 48, 318);

  // Pink ribbon across the bottom.
  ctx.save();
  ctx.translate(size / 2, size - 118);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.fillStyle = COLORS.pink;
  ctx.fillRect(-size * 0.62, -46, size * 1.24, 92);
  ctx.fillStyle = COLORS.cream;
  ctx.font = `800 50px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HH GOA '26", 0, 3);
  ctx.restore();

  return canvas;
}
