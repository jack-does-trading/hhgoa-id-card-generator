# HH Goa 2026 — Builder ID Card Generator

Upload a photo → crop/reposition it → fill in name, role, and a generated
"builder title" → get a real on-brand HH Goa 2026 badge PNG, downloadable and
shareable to X with `#FrameInGoa`. Built for the HH Goa 2026 shortlisting task.

Everything (HEIC conversion, cropping, "Painted Mode" filter, card
compositing) runs client-side on `<canvas>` — no upload round-trip, no
loading screen. The only server calls are optional: storing a copy of the
finished card so a shared **link**'s preview shows the actual graphic.

## Brand fidelity

Colors and fonts are not approximated — they were extracted directly from
`hhgoa.com`'s own shipped CSS (`#0b6839` green / `#fee101` yellow / `#ff0080`
pink / `#fffbe8` cream, `Imbue` + `Victor Mono`). The beach-scene backdrop and
card artwork are original SVG/canvas work in that same palette, not traced or
hotlinked from their assets.

## Run locally

```bash
npm install
npm run dev
```

## Scripts

- `scripts/qa-smoke.mjs` — headless end-to-end visual check (upload → crop →
  generate → share). See `.claude/skills/run-app/SKILL.md`.
- `scripts/gen-og.mjs` — regenerates `public/og-default.png`.
- `scripts/gen-icon.mjs` — regenerates `src/app/icon.png`.

## Deploying (Vercel)

1. `npx vercel login`, then from this directory: `npx vercel link` (or `vercel
   --prod` directly, which links on first run).
2. **Enable the share-link OG preview**: in the Vercel dashboard, add a Blob
   store to the project (Storage → Create → Blob) — this sets
   `BLOB_READ_WRITE_TOKEN` automatically. Without it, `/api/upload-card`
   fails closed and "Share to X" still works, just as a text-only tweet
   (no rich link preview) instead of a linked card.
3. Set `NEXT_PUBLIC_SITE_URL` to the production URL (needed so share links
   and Open Graph tags point at the deployed domain, not `localhost`).
4. `npx vercel --prod`.

## Known gaps before final submission

- HEIC upload is implemented (`heic2any`, dynamically imported) but hasn't
  been exercised with a real iPhone photo — verify on an actual device.
- Real-device mobile QA (touch pinch-to-zoom in the cropper) has only been
  simulated in headless Chromium so far.
