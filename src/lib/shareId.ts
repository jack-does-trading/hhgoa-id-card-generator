// Share links don't need a database: Vercel Blob already gives every upload
// a stable, public, unguessable-enough HTTPS URL, so a share "id" is just
// that URL, base64url-encoded into the path segment. /r/[id] decodes it and
// uses it directly as the og:image — no KV store, no expiry job to write.

const ALLOWED_HOSTS = [".public.blob.vercel-storage.com"];

export function encodeShareId(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

/** Returns the decoded URL, or null if it's missing/malformed/untrusted. */
export function decodeShareId(id: string): string | null {
  try {
    const url = Buffer.from(id, "base64url").toString("utf8");
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const isAllowedHost = ALLOWED_HOSTS.some((suffix) =>
      parsed.hostname.endsWith(suffix)
    );
    if (!isAllowedHost) return null;
    return url;
  } catch {
    return null;
  }
}
