// Illustration primitives for the ID card, drawn entirely from Canvas 2D
// paths — no bitmaps, no SVG sprites, nothing to license. Every helper here
// is a small self-contained scene element (a palm, a surfboard, a postage
// stamp) that `generateCard.ts` composes into the finished card.
//
// Everything takes an explicit centre/base point and a scale so the same
// element can be reused at different sizes across the front, the back and
// the share formats.

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Four-point twinkle. The pinched quadratics are what make it read as a
 *  sparkle rather than a plus sign. */
export function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
) {
  const k = r * 0.17;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** Distant gull — the classic two-arc "m". */
export function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
  lw = 3
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.75, x, y);
  ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.75, x + s, y);
  ctx.stroke();
  ctx.restore();
}

export function drawSquiggle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  amp: number,
  waves: number,
  color: string,
  lw = 4
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  const step = w / (waves * 2);
  for (let i = 0; i < waves * 2; i++) {
    ctx.quadraticCurveTo(
      x + step * i + step / 2,
      y + (i % 2 === 0 ? -amp : amp),
      x + step * (i + 1),
      y
    );
  }
  ctx.stroke();
  ctx.restore();
}

/** Tapered frond / leaf, drawn from its stem outward along +x before rotation. */
export function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  rotDeg: number,
  color: string,
  fatness = 0.3
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -len * fatness, len, 0);
  ctx.quadraticCurveTo(len * 0.45, len * fatness, 0, 0);
  ctx.fill();
  // Centre vein, slightly darker via a translucent dark overlay.
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(1.5, len * 0.02);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.04, len, 0);
  ctx.stroke();
  ctx.restore();
}

/**
 * Palm tree standing on (x, y) — y is the base of the trunk.
 *
 * Each frond is a two-quadratic shape that arcs *up* out of the crown and
 * then tips *down* at the end, with the droop scaling by how far off-centre
 * the frond points (`dx²`). Straight tapered leaves radiating from a point
 * — the obvious first approach — read as a pineapple top, not a palm; the
 * arc-then-fall silhouette is the whole thing that makes it legible.
 */
export function drawPalm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  trunk: string,
  leaf: string
) {
  const topX = x - s * 0.09;
  const topY = y - s * 0.88;

  // Trunk as a filled shape rather than a stroke, so it can taper from a
  // wide base to a narrow crown and lean at the same time.
  const baseW = s * 0.072;
  const topW = s * 0.03;
  const bendX = x - s * 0.17;
  const bendY = y - s * 0.5;
  ctx.save();
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(x - baseW, y);
  ctx.quadraticCurveTo(bendX - topW, bendY, topX - topW, topY);
  ctx.lineTo(topX + topW, topY);
  ctx.quadraticCurveTo(bendX + baseW, bendY, x + baseW, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Nine fronds, each a lens built around its own crown→tip axis: the two
  // control points are offset perpendicular to that axis, so every frond has
  // an even thickness regardless of which way it points. Each also gets a
  // hairline keyline — without it neighbouring fronds fuse into two solid
  // wings and the crown reads as a moustache rather than a tree.
  const len = s * 0.56;
  const wdt = len * 0.15;
  ctx.save();
  ctx.fillStyle = leaf;
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(1.5, len * 0.022);
  ctx.lineJoin = "round";
  for (const dx of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
    const endX = topX + dx * len * 1.05;
    const endY = topY - len * 0.34 + dx * dx * len * 0.95;
    const ex = endX - topX;
    const ey = endY - topY;
    const el = Math.hypot(ex, ey) || 1;
    const px = -ey / el;
    const py = ex / el;
    const midX = topX + ex * 0.5;
    const midY = topY + ey * 0.5 - len * 0.26;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX + px * wdt, midY + py * wdt, endX, endY);
    ctx.quadraticCurveTo(midX - px * wdt, midY - py * wdt, topX, topY);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Coconuts clustered under the crown.
  ctx.save();
  ctx.fillStyle = trunk;
  for (const [ox, oy] of [
    [-0.055, 0.05],
    [0.05, 0.04],
    [-0.005, 0.095],
  ]) {
    ctx.beginPath();
    ctx.arc(topX + ox * s, topY + oy * s, s * 0.033, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawSurfboard(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotDeg: number,
  body: string,
  stripe: string,
  outline: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.quadraticCurveTo(w / 2, 0, 0, h / 2);
  ctx.quadraticCurveTo(-w / 2, 0, 0, -h / 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(3, w * 0.09);
  ctx.strokeStyle = outline;
  ctx.stroke();
  // Centre stringer.
  ctx.beginPath();
  ctx.moveTo(0, -h / 2 + h * 0.14);
  ctx.lineTo(0, h / 2 - h * 0.14);
  ctx.strokeStyle = stripe;
  ctx.lineWidth = Math.max(2, w * 0.07);
  ctx.stroke();
  ctx.restore();
}

/** Signpost with stacked directional arrows — BUILD / SHIP / REPEAT. */
export function drawSignpost(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  s: number,
  signs: { text: string; fill: string; ink: string; dir: 1 | -1 }[],
  postColor: string,
  outline: string
) {
  const signH = s * 0.3;
  const gap = s * 0.12;
  const totalH = signs.length * (signH + gap) + s * 0.5;

  ctx.save();
  ctx.strokeStyle = postColor;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x, yTop + totalH);
  ctx.stroke();
  ctx.restore();

  signs.forEach((sign, i) => {
    const y = yTop + s * 0.12 + i * (signH + gap);
    const w = s * 0.98;
    const tip = s * 0.16;
    // Arrow body points `dir`; the tail sits on the far side of the post.
    const left = sign.dir === 1 ? x - w * 0.28 : x - w * 0.72;
    ctx.save();
    ctx.beginPath();
    if (sign.dir === 1) {
      ctx.moveTo(left, y);
      ctx.lineTo(left + w - tip, y);
      ctx.lineTo(left + w, y + signH / 2);
      ctx.lineTo(left + w - tip, y + signH);
      ctx.lineTo(left, y + signH);
    } else {
      ctx.moveTo(left + w, y);
      ctx.lineTo(left + tip, y);
      ctx.lineTo(left, y + signH / 2);
      ctx.lineTo(left + tip, y + signH);
      ctx.lineTo(left + w, y + signH);
    }
    ctx.closePath();
    ctx.fillStyle = sign.fill;
    ctx.fill();
    ctx.lineWidth = Math.max(2.5, s * 0.022);
    ctx.strokeStyle = outline;
    ctx.stroke();

    ctx.fillStyle = sign.ink;
    ctx.font = `800 ${Math.round(signH * 0.52)}px "Victor Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sign.text, left + w / 2, y + signH / 2 + 1);
    ctx.restore();
  });
}

/** Little Goan two-storey house: body, pitched roof, balcony, windows. */
export function drawHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBase: number,
  s: number,
  body: string,
  roof: string,
  trim: string,
  outline: string
) {
  const w = s;
  const h = s * 1.15;
  const left = x - w / 2;
  const top = yBase - h;

  ctx.save();
  ctx.lineWidth = Math.max(3, s * 0.028);
  ctx.strokeStyle = outline;

  // body
  ctx.fillStyle = body;
  ctx.fillRect(left, top + h * 0.28, w, h * 0.72);
  ctx.strokeRect(left, top + h * 0.28, w, h * 0.72);

  // roof
  ctx.beginPath();
  ctx.moveTo(left - w * 0.12, top + h * 0.3);
  ctx.lineTo(x, top);
  ctx.lineTo(left + w + w * 0.12, top + h * 0.3);
  ctx.closePath();
  ctx.fillStyle = roof;
  ctx.fill();
  ctx.stroke();

  // door
  const dw = w * 0.24;
  ctx.fillStyle = roof;
  ctx.fillRect(x - dw / 2, yBase - h * 0.34, dw, h * 0.34);
  ctx.strokeRect(x - dw / 2, yBase - h * 0.34, dw, h * 0.34);

  // windows
  ctx.fillStyle = trim;
  for (const wx of [left + w * 0.14, left + w * 0.66]) {
    ctx.fillRect(wx, top + h * 0.42, w * 0.2, h * 0.2);
    ctx.strokeRect(wx, top + h * 0.42, w * 0.2, h * 0.2);
    ctx.fillRect(wx, yBase - h * 0.3, w * 0.2, h * 0.18);
    ctx.strokeRect(wx, yBase - h * 0.3, w * 0.2, h * 0.18);
  }

  // balcony rail
  ctx.beginPath();
  ctx.moveTo(left, top + h * 0.68);
  ctx.lineTo(left + w, top + h * 0.68);
  ctx.stroke();
  ctx.restore();
}

/** Scooter in profile, wheels resting on `yBase`. */
export function drawScooter(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBase: number,
  s: number,
  body: string,
  outline: string
) {
  const r = s * 0.17;
  ctx.save();
  ctx.lineWidth = Math.max(3, s * 0.028);
  ctx.strokeStyle = outline;

  // wheels
  for (const wx of [x - s * 0.32, x + s * 0.34]) {
    ctx.beginPath();
    ctx.arc(wx, yBase - r, r, 0, Math.PI * 2);
    ctx.fillStyle = outline;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wx, yBase - r, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "#e9e6dc";
    ctx.fill();
  }

  // deck + rear body
  ctx.beginPath();
  ctx.moveTo(x - s * 0.32, yBase - r * 1.2);
  ctx.lineTo(x + s * 0.1, yBase - r * 1.2);
  ctx.quadraticCurveTo(x + s * 0.5, yBase - r * 1.3, x + s * 0.5, yBase - s * 0.5);
  ctx.quadraticCurveTo(x + s * 0.5, yBase - s * 0.68, x + s * 0.24, yBase - s * 0.62);
  ctx.quadraticCurveTo(x - s * 0.05, yBase - s * 0.58, x - s * 0.16, yBase - r * 1.9);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.stroke();

  // front column + handlebar
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(4, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.32, yBase - r * 1.4);
  ctx.lineTo(x - s * 0.44, yBase - s * 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.56, yBase - s * 0.74);
  ctx.lineTo(x - s * 0.34, yBase - s * 0.7);
  ctx.stroke();
  ctx.restore();
}

/** Spiky "burst" sticker with 1–2 lines of text — the LET'S BUILD! flash. */
export function drawStarburstSticker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lines: string[],
  fill: string,
  ink: string,
  outline: string,
  rotDeg = 0,
  points = 14
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    // Slightly wider than tall: a flash, not a circle.
    const rad = (i % 2 === 0 ? r : r * 0.82) * (i % 2 === 0 ? 1 : 1);
    const px = Math.cos(a) * rad * 1.22;
    const py = Math.sin(a) * rad * 0.86;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(3, r * 0.05);
  ctx.strokeStyle = outline;
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(r * 0.34);
  ctx.font = `800 ${size}px "Victor Mono", ui-monospace, monospace`;
  const lh = size * 1.12;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lh);
  });
  ctx.restore();
}

/** Perforated-edge postage stamp containing a mini sunset scene. */
export function drawPostageStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  paper: string,
  ink: string,
  accent: string,
  sun: string,
  rotDeg = 0
) {
  // Composed on its own transparent canvas, NOT straight onto the card:
  // the perforations are cut with `destination-out`, which erases whatever
  // is already beneath it — done in place that punches actual holes through
  // the card's background and border.
  const pad = 2;
  const off = document.createElement("canvas");
  off.width = Math.ceil(w + pad * 2);
  off.height = Math.ceil(h + pad * 2);
  const octx = off.getContext("2d")!;
  octx.translate(pad, pad);

  drawStampFace(octx, w, h, paper, ink, accent, sun);

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.drawImage(off, -w / 2 - pad, -h / 2 - pad);
  ctx.restore();
}

function drawStampFace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  paper: string,
  ink: string,
  accent: string,
  sun: string
) {
  // Perforations: the paper rect with notches bitten out of every edge.
  const notch = Math.min(w, h) * 0.055;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const stepsX = Math.round(w / (notch * 2.2));
  const stepsY = Math.round(h / (notch * 2.2));
  for (let i = 0; i <= stepsX; i++) {
    const px = (w / stepsX) * i;
    for (const py of [0, h]) {
      ctx.beginPath();
      ctx.arc(px, py, notch, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i <= stepsY; i++) {
    const py = (h / stepsY) * i;
    for (const px of [0, w]) {
      ctx.beginPath();
      ctx.arc(px, py, notch, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Inner keyline
  const pad = w * 0.09;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(2, w * 0.018);
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

  // Scene: sun over water, palm on the left.
  const iy = h * 0.68;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, pad, w - pad * 2, h - pad * 2);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.58, iy - h * 0.06, w * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillRect(pad, iy, w - pad * 2, h - pad - iy);
  ctx.strokeStyle = paper;
  ctx.lineWidth = Math.max(1.5, w * 0.014);
  for (let i = 0; i < 3; i++) {
    const wy = iy + h * 0.07 + i * h * 0.075;
    ctx.beginPath();
    for (let sx = pad; sx < w - pad; sx += w * 0.12) {
      ctx.moveTo(sx, wy);
      ctx.quadraticCurveTo(sx + w * 0.03, wy - h * 0.02, sx + w * 0.06, wy);
      ctx.quadraticCurveTo(sx + w * 0.09, wy + h * 0.02, sx + w * 0.12, wy);
    }
    ctx.stroke();
  }
  drawPalm(ctx, w * 0.74, iy + h * 0.02, h * 0.42, ink, ink);
  ctx.restore();

  // Denomination text
  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${Math.round(h * 0.15)}px "Victor Mono", ui-monospace, monospace`;
  ctx.fillText("GOA", pad + w * 0.06, pad + h * 0.19);
  ctx.font = `800 ${Math.round(h * 0.1)}px "Victor Mono", ui-monospace, monospace`;
  ctx.fillText("INDIA", pad + w * 0.06, pad + h * 0.32);
}

/** Text laid along a circular arc, centred on `centreAngle` (radians). */
export function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  r: number,
  centreAngle: number,
  font: string,
  color: string,
  flip = false
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const arc = total / r; // radians the whole string subtends
  let angle = centreAngle + ((flip ? 1 : -1) * arc) / 2;

  for (let i = 0; i < text.length; i++) {
    const step = widths[i] / r;
    const a = angle + (flip ? -step / 2 : step / 2);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(flip ? a - Math.PI / 2 : a + Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    angle += flip ? -step : step;
  }
  ctx.restore();
}

/** Circular rubber stamp: double ring, curved text top and bottom, palm in
 *  the middle, small crosses at the sides. */
export function drawRoundStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  topText: string,
  bottomText: string,
  ink: string
) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(3, r * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, r * 0.022);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  // Top arc sweeps left→right with the glyphs rotated outward (`flip: false`);
  // the bottom arc has to sweep the other way, or the text ends up mirrored
  // and upside down at 6 o'clock.
  const font = `800 ${Math.round(r * 0.16)}px "Victor Mono", ui-monospace, monospace`;
  drawCurvedText(ctx, topText, cx, cy, r * 0.91, -Math.PI / 2, font, ink, false);
  drawCurvedText(ctx, bottomText, cx, cy, r * 0.91, Math.PI / 2, font, ink, true);

  drawPalm(ctx, cx + r * 0.06, cy + r * 0.34, r * 0.66, ink, ink);

  ctx.fillStyle = ink;
  ctx.font = `800 ${Math.round(r * 0.2)}px "Victor Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+", cx - r * 0.86, cy);
  ctx.fillText("+", cx + r * 0.86, cy);
  ctx.restore();
}

/** Ring of alternating diamonds — the decorative photo surround. */
export function drawDiamondRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  count: number,
  size: number,
  a: string,
  b: string
) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.rotate(ang + Math.PI / 4);
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.restore();
}

export function drawWaves(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  rows: number,
  color: string,
  lw = 3
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  for (let row = 0; row < rows; row++) {
    const ry = y + row * lw * 4;
    ctx.beginPath();
    for (let sx = x; sx < x + w; sx += 26) {
      ctx.moveTo(sx, ry);
      ctx.quadraticCurveTo(sx + 6.5, ry - 5, sx + 13, ry);
      ctx.quadraticCurveTo(sx + 19.5, ry + 5, sx + 26, ry);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSailboat(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBase: number,
  s: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.lineJoin = "round";
  // hull
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, yBase);
  ctx.lineTo(x + s * 0.5, yBase);
  ctx.lineTo(x + s * 0.3, yBase + s * 0.18);
  ctx.lineTo(x - s * 0.3, yBase + s * 0.18);
  ctx.closePath();
  ctx.fill();
  // sails
  ctx.beginPath();
  ctx.moveTo(x, yBase - s * 0.85);
  ctx.lineTo(x, yBase - s * 0.04);
  ctx.lineTo(x - s * 0.42, yBase - s * 0.04);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.06, yBase - s * 0.7);
  ctx.lineTo(x + s * 0.06, yBase - s * 0.04);
  ctx.lineTo(x + s * 0.42, yBase - s * 0.04);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// --- tiny "beach bag" inventory icons ------------------------------------

export function drawCoconutIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  shell: string,
  accent: string,
  outline: string
) {
  ctx.save();
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.arc(x, y + s * 0.1, s * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.stroke();
  // straw
  ctx.beginPath();
  ctx.moveTo(x + s * 0.1, y - s * 0.05);
  ctx.lineTo(x + s * 0.42, y - s * 0.62);
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.lineCap = "round";
  ctx.stroke();
  // little leaf
  drawLeaf(ctx, x - s * 0.12, y - s * 0.3, s * 0.4, -140, outline, 0.34);
  ctx.restore();
}

export function drawLaptopIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  screen: string,
  ink: string,
  outline: string
) {
  ctx.save();
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeStyle = outline;
  const w = s * 0.88;
  const h = s * 0.6;
  roundRect(ctx, x - w / 2, y - h * 0.75, w, h, s * 0.07);
  ctx.fillStyle = screen;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.66, y + h * 0.32);
  ctx.lineTo(x + w * 0.66, y + h * 0.32);
  ctx.lineTo(x + w * 0.5, y + h * 0.05);
  ctx.lineTo(x - w * 0.5, y + h * 0.05);
  ctx.closePath();
  ctx.fillStyle = outline;
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = `800 ${Math.round(s * 0.3)}px "Victor Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("</>", x, y - h * 0.44);
  ctx.restore();
}

export function drawHeadphonesIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  cups: string,
  outline: string
) {
  ctx.save();
  ctx.lineWidth = Math.max(3, s * 0.11);
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.arc(x, y + s * 0.02, s * 0.42, Math.PI, 0);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, s * 0.07);
  for (const cx of [x - s * 0.42, x + s * 0.42]) {
    roundRect(ctx, cx - s * 0.14, y, s * 0.28, s * 0.42, s * 0.1);
    ctx.fillStyle = cups;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Decorative barcode — seeded so a given ID always draws the same bars. */
export function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  seedStr: string
) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
  }
  seed = Math.abs(seed) || 1;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  ctx.save();
  ctx.fillStyle = color;
  let cx = x;
  while (cx < x + w) {
    const barW = 2 + rand() * 5;
    const gap = 2 + rand() * 4;
    if (rand() > 0.28) ctx.fillRect(cx, y, Math.min(barW, x + w - cx), h);
    cx += barW + gap;
  }
  ctx.restore();
}
