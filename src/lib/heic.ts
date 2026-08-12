// Client-side HEIC/HEIF -> JPEG conversion for iPhone photo uploads.
// Dynamically imported so heic2any (and its wasm decoder) never ends up in
// the server bundle and only loads when someone actually uploads a HEIC file.

export async function isHeicFile(file: File): Promise<boolean> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif")) return true;
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  // Some iPhones/browsers report an empty or generic type for HEIC files —
  // sniff the file's magic bytes ("ftypheic"/"ftypheix"/"ftypmif1" etc.) as a
  // fallback so those still get routed through the converter.
  if (!file.type) {
    const head = await file.slice(4, 12).text();
    return /ftyp(heic|heix|hevc|hevx|mif1|msf1)/i.test(head);
  }
  return false;
}

export async function toDisplayableImage(file: File): Promise<Blob> {
  if (!(await isHeicFile(file))) return file;

  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  // heic2any can return an array for multi-image HEIC containers — we only
  // want the first frame.
  return Array.isArray(result) ? result[0] : result;
}
