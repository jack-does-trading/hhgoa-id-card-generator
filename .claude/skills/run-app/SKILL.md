---
name: run-app
description: Launch the HH Goa Builder ID Card Next.js app locally and drive it end-to-end (upload -> crop -> fields -> generate -> download/share) with a headless browser, for visual QA and screenshots.
---

# Running & driving this app

`chromium-cli` is not installed in this environment. This project instead
vendors Playwright as a devDependency (`npm i -D playwright`, already done)
with a cached Chromium build, and drives it with plain Node scripts.

## 1. Start the dev server

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill   # free the port from a previous run
cd hh-goa-id-card
(nohup npm run dev > /tmp/nextdev.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3000 >/dev/null && echo READY && break; sleep 1; done
```

(macOS's default shell here has no `timeout` binary — poll with the loop
above instead of `timeout curl ...`.)

## 2. Drive it

`scripts/qa-smoke.mjs` is the working driver: it synthesizes a sample photo
entirely in-browser (no ImageMagick/PIL needed — draws a gradient + face
circle on a `<canvas>`, exports `toDataURL`, writes it to disk), then runs
the real upload → crop-drag → fill fields → generate flow against
`localhost:3000` and screenshots each stage plus the final card alone.

```bash
cd hh-goa-id-card
node scripts/qa-smoke.mjs
```

Screenshots land next to the script's `SCRATCH` constant (currently the
session scratchpad — update that constant if scratchpad path changes between
sessions). Check `CONSOLE_ERRORS` in stdout before declaring something
working — a page can render its shell while a data step fails silently.

## 3. Regenerating the static default OG image

`scripts/gen-og.mjs` renders `public/og-default.png` (the link-preview image
used before any card exists) the same way — draw on an in-browser canvas,
`toDataURL`, write to disk. Re-run it after changing the fallback OG design:

```bash
node scripts/gen-og.mjs
```

## Gotchas hit while building this

- React controlled inputs need Playwright's `fill()`, not
  `el.value = '…'` via `evaluate` — the latter skips React's onChange.
- The crop `<canvas>` uses Pointer Events, not mouse events, in the app —
  but Playwright's `page.mouse.down/move/up` still work for a simulated
  drag since pointer events are dispatched from real mouse input in
  Chromium.
- `npm run dev &`'s `$!` is just the npm wrapper PID; kill by port
  (`lsof -ti:3000 ... | xargs kill`), not by that PID, or the server
  survives and the next run hits `EADDRINUSE`.
