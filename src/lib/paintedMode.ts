// "Painted Mode" — a fast, fully client-side, free stand-in for the
// AI style-transfer idea. Pure pixel math (posterize + warm/saturation push
// + grain), runs in milliseconds, never calls a network API, and never
// references any third-party studio's name in code, UI, or share copy.

const GRAIN_SEED = 42;

/** Cheap deterministic pseudo-random so grain looks the same across runs. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function posterizeChannel(value: number, levels: number): number {
  const step = 255 / (levels - 1);
  return Math.round(Math.round(value / step) * step);
}

export function applyPaintedMode(
  source: HTMLCanvasElement,
  opts: { levels?: number; warmth?: number; grain?: number } = {}
): HTMLCanvasElement {
  const { levels = 6, warmth = 14, grain = 10 } = opts;

  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;
  const rand = mulberry32(GRAIN_SEED);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Warm push toward the event palette (more yellow/red, slightly less blue).
    r = Math.min(255, r + warmth);
    g = Math.min(255, g + warmth * 0.4);
    b = Math.max(0, b - warmth * 0.6);

    // Posterize for a flatter, illustrated feel.
    r = posterizeChannel(r, levels);
    g = posterizeChannel(g, levels);
    b = posterizeChannel(b, levels);

    // Grain.
    const n = (rand() - 0.5) * grain;
    r = Math.min(255, Math.max(0, r + n));
    g = Math.min(255, Math.max(0, g + n));
    b = Math.min(255, Math.max(0, b + n));

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}
