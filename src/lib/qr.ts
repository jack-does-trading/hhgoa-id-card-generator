import QRCode from "qrcode";

/**
 * Renders a QR code onto a fresh square canvas, styled to match the card's
 * palette. Pure client-side computation — no network involved — so this is
 * always instant regardless of what URL it happens to encode.
 */
export async function renderQrCanvas(
  url: string,
  size: number,
  darkColor: string,
  lightColor: string
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 1,
    color: { dark: darkColor, light: lightColor },
  });
  return canvas;
}
