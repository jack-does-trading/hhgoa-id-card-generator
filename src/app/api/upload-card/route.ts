import { put } from "@vercel/blob";
import { encodeShareId } from "@/lib/shareId";

// Accepts the generated card PNG as the raw request body, stores it in
// Vercel Blob (public, short-lived by convention — nothing here needs to
// persist beyond the lifetime of a tweet), and hands back a share id that
// /r/[id] decodes straight back into the blob's URL for the OG image.
//
// This route only matters for the desktop / Web-Share-unavailable fallback:
// mobile shares attach the image directly and never call it. If
// BLOB_READ_WRITE_TOKEN isn't configured (e.g. running locally without
// `vercel link`), it fails fast with a clear error so the client can fall
// back to a text-only share instead of hanging.
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) {
    return Response.json({ error: "Expected an image body" }, { status: 400 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ error: "Empty upload" }, { status: 400 });
  }
  if (body.byteLength > 8 * 1024 * 1024) {
    return Response.json({ error: "Image too large" }, { status: 413 });
  }

  try {
    const pathname = `cards/${crypto.randomUUID()}.png`;
    const blob = await put(pathname, body, {
      access: "public",
      contentType: "image/png",
    });
    const id = encodeShareId(blob.url);
    return Response.json({ id, url: blob.url });
  } catch (err) {
    console.error("upload-card failed:", err);
    return Response.json(
      {
        error:
          "Card storage isn't configured yet (needs a Vercel Blob store linked via BLOB_READ_WRITE_TOKEN).",
      },
      { status: 501 }
    );
  }
}
