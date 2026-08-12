"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import PhotoCropper, { PhotoCropperHandle } from "./PhotoCropper";
import BeachBackdrop from "./BeachBackdrop";
import { toDisplayableImage } from "@/lib/heic";
import { generateBuilderTitle } from "@/lib/builderTitle";
import { generateBuilderId } from "@/lib/builderId";
import { renderIdCard, canvasToBlob, CARD_WIDTH, COLORS } from "@/lib/generateCard";
import { applyPaintedMode } from "@/lib/paintedMode";
import { renderQrCanvas } from "@/lib/qr";

type Stage = "upload" | "edit" | "processing" | "result";

const SHARE_TEXT =
  "Bags packed, got the pass !! See you in GOA 😎🌴⚡️ #FrameInGoa";

// Purely cosmetic — a couple of on-brand beats while the (near-instant)
// canvas work runs, so the reveal has a little anticipation instead of
// popping with zero warning. Never a real network wait.
const PROCESSING_LABELS = [
  "Mixing sunset colors…",
  "Waxing the surfboard…",
  "Waking up the palm trees…",
  "Painting your badge…",
];

// The submit CTA, in on-brand "bring the colors" spirit rather than a flat
// "Generate my card" — echoes the greyscale→colour reveal that clicking it
// actually triggers. One is picked per visit (see `generateLabel` below) so
// it stays put while the user is filling in the form, not swapping label
// under their cursor.
const GENERATE_LABELS = [
  "🎨 Bring the colors",
  "🌈 Splash on some color",
  "☀️ Let the sunset in",
  "🥥 Paint the palms",
  "⚡️ Light this beach up",
];

export default function BuilderIdCardApp() {
  const [stage, setStage] = useState<Stage>("upload");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [builderTitle, setBuilderTitle] = useState(() => generateBuilderTitle());
  const [builderId, setBuilderId] = useState(() => generateBuilderId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingLabel, setProcessingLabel] = useState(PROCESSING_LABELS[0]);

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [generateLabel] = useState(
    () => GENERATE_LABELS[Math.floor(Math.random() * GENERATE_LABELS.length)]
  );
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropperRef = useRef<PhotoCropperHandle>(null);

  // Trimmed from 320 — every pixel of the edit stage's height budget counts
  // now that the panel is meant to fit one screen with no scrolling.
  const cropSize = 260;
  const revealed = stage === "result";

  const onFileChosen = useCallback(async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const displayable = await toDisplayableImage(file);
      setPhotoBlob(displayable);
      setStage("edit");
    } catch (err) {
      console.error(err);
      setError(
        "Couldn't read that photo. Try a JPG/PNG, or a different HEIC file."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!cropperRef.current) return;
    setError(null);
    setStage("processing");

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let labelTimer: ReturnType<typeof setInterval> | undefined;
    if (!prefersReducedMotion) {
      let i = 0;
      setProcessingLabel(PROCESSING_LABELS[0]);
      labelTimer = setInterval(() => {
        i = (i + 1) % PROCESSING_LABELS.length;
        setProcessingLabel(PROCESSING_LABELS[i]);
      }, 260);
    }

    try {
      const rawPhoto = cropperRef.current.getCroppedCanvas(760);
      if (!rawPhoto) throw new Error("No photo cropped");

      // "Painted Mode": fake, instant, client-side art-style pass — see
      // lib/paintedMode.ts for why this replaces a real AI style-transfer call.
      const paintedPhoto = applyPaintedMode(rawPhoto);

      // Points at the site root rather than this specific card's own share
      // page — a genuinely per-card QR would need the finished card
      // uploaded *before* it can be drawn onto that same card (the /r/[id]
      // share link only exists once the rendered PNG has been uploaded),
      // which means either a chicken-and-egg render twice, or making
      // "Generate" itself wait on a network round trip it never needed
      // before. Punting on that trade-off for now — flagged to the user.
      const qr = await renderQrCanvas(
        window.location.origin,
        240,
        COLORS.greenDark,
        COLORS.cream
      ).catch(() => undefined);

      const card = renderIdCard({
        name: name.trim(),
        role: role.trim(),
        builderTitle,
        builderId,
        photo: paintedPhoto,
        qr,
      });

      // Small deliberate pause so the reveal reads as a beat, not a jump cut —
      // capped well under the "few seconds, not a loading screen" budget, and
      // skipped entirely for reduced-motion users.
      if (!prefersReducedMotion) {
        await new Promise((r) => setTimeout(r, 900));
      }

      resultCanvasRef.current = card;
      setResultUrl(card.toDataURL("image/png"));
      setStage("result");
    } catch (err) {
      console.error(err);
      setError("Something went wrong generating the card — try again.");
      setStage("edit");
    } finally {
      if (labelTimer) clearInterval(labelTimer);
    }
  }, [name, role, builderTitle, builderId]);

  const handleDownload = useCallback(async () => {
    if (!resultCanvasRef.current) return;
    const blob = await canvasToBlob(resultCanvasRef.current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hh-goa-2026-builder-id-${(name || "builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [name]);

  const handleShare = useCallback(async () => {
    if (!resultCanvasRef.current) return;

    // Open the tab *synchronously*, right here in the click handler — this
    // is the fix for "Share feels slow": browsers only let window.open()
    // through without popup-blocking (or queuing) it while the call stack
    // still traces back to a real user gesture, and that's gone the moment
    // we `await` anything below. Opening a blank tab now and navigating it
    // once the upload resolves means the tab appears instantly instead of
    // however long the upload takes.
    const shareWindow = window.open("about:blank", "_blank");
    setSharing(true);

    try {
      const blob = await canvasToBlob(resultCanvasRef.current);

      // Always go straight to the X web-intent compose window — no
      // `navigator.share()` here, since on macOS/iOS that opens the native
      // OS share sheet (AirDrop/Mail/Messages/…) instead of X specifically,
      // which isn't what "Share to 𝕏" should do.
      //
      // Upload the card so we have a public URL, then point the intent's
      // `url` at our /r/[id] page — its og:image resolves to that upload,
      // so the link preview shows the actual card instead of a blank/
      // default thumbnail. Capped at 4s so a slow/hung upload can't stall
      // the tab that's already open and waiting — worst case the tweet
      // just goes out without the image-preview link.
      let shareUrl: string | null = null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch("/api/upload-card", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const { id } = (await res.json()) as { id: string };
          shareUrl = `${window.location.origin}/r/${id}`;
        }
      } catch {
        // storage not configured / offline / timed out — fall back to
        // text-only below
      }

      const params = new URLSearchParams({ text: SHARE_TEXT });
      if (shareUrl) params.set("url", shareUrl);
      const intentUrl = `https://twitter.com/intent/tweet?${params.toString()}`;

      if (shareWindow) {
        // Sever the opener link while we're still same-origin (about:blank)
        // — keeps the reverse-tabnabbing risk of holding onto the reference
        // off the table before navigating it to a cross-origin URL.
        try {
          shareWindow.opener = null;
        } catch {
          // ignore — best-effort hardening, not load-bearing
        }
        shareWindow.location.href = intentUrl;
      } else {
        // Popup blocked despite the synchronous open (rare) — last resort.
        window.open(intentUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setSharing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStage("upload");
    setPhotoBlob(null);
    setResultUrl(null);
    resultCanvasRef.current = null;
    setBuilderId(generateBuilderId());
  }, []);

  const cropperEl = useMemo(() => {
    if (!photoBlob) return null;
    return <PhotoCropper ref={cropperRef} file={photoBlob} size={cropSize} />;
  }, [photoBlob]);

  return (
    <>
      <BeachBackdrop revealed={revealed} />
      {/*
        This rail is the right 40% of the viewport from `sm:` up (full width
        below that, mobile has no room to spare) — `self-end` pins it to the
        right edge of the full-width flex row instead of the left, so the
        generator lives in that strip while the "हैकर हाउस" board on the
        left of the backdrop stays uncovered as the hero.
      */}
      <div className="relative z-10 flex flex-1 items-start justify-center px-4 py-10 sm:w-2/5 sm:items-center sm:justify-center sm:self-end sm:px-8 sm:py-6">
        {/*
          Glass tile: translucent, blurred, floating over the photo backdrop
          rather than a solid card. Deliberately carries no `.bland-scope`
          filter — the greyscale→colour reveal now lives purely on the
          backdrop photo; the form and the generated ID card image are never
          filtered (nothing to "un-paint" once the card renders).
        */}
        {/*
          `max-w-md` only holds on mobile — from `sm:` up the cap comes off
          so the panel fills its rail's own width instead. That's the
          "overflow sideways, not vertically" fix: given more horizontal
          room the edit-stage fields below go two-up, so the whole panel is
          short enough to fit a single (locked, non-scrolling) screen.
        */}
        <div
          className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-white/40 bg-white/30 p-5 shadow-2xl backdrop-blur-md sm:max-w-none sm:p-6"
        >
          <header className="text-center">
            <p className="text-xs tracking-[0.3em] text-bland-muted">
              HH GOA 2026
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-bland-fg">
              Builder ID Card Generator
            </h1>
            {/* Only shown pre-upload — on later stages this line is just
               height spent on something the user already knows, and every
               bit of vertical room matters for fitting one screen. */}
            {stage === "upload" && (
              <p className="mt-2 text-sm text-bland-muted">
                Upload a photo, fill in a couple of fields, get a shareable,
                on-brand HH Goa badge. #FrameInGoa
              </p>
            )}
          </header>

          {error && (
            <p className="mt-4 rounded-lg border border-hh-pink/40 bg-hh-pink/10 px-3 py-2 text-sm text-hh-pink">
              {error}
            </p>
          )}

          {stage === "upload" && (
            <label className="mt-6 flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-bland-line bg-white/60 px-6 text-center transition hover:border-hh-green">
              <span className="text-4xl">📸</span>
              <span className="font-semibold text-bland-fg">
                Tap to upload your photo
              </span>
              <span className="text-xs text-bland-muted">
                JPG, PNG, or iPhone HEIC — any crop, any orientation
              </span>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          {stage === "edit" && cropperEl && (
            <div className="mt-4 flex flex-col items-center gap-4">
              {cropperEl}

              {/*
                Name/role go two-up from `sm:` (the panel has the width for
                it now that it's not capped at max-w-md) — that's what
                actually shortens this stage enough to fit one screen,
                rather than relying on a scrollbar. Staying stacked under
                the cropper (instead of beside it) keeps each column wide
                enough to actually be usable — putting the cropper and
                fields side by side left the fields column so narrow the
                Generate button got pushed off the right edge of the
                viewport entirely.
              */}
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-bland-muted">Name</span>
                  <input
                    className="rounded-lg border border-bland-line bg-white px-3 py-2 outline-none focus:border-hh-green"
                    value={name}
                    maxLength={40}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Shenoy"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-bland-muted">Stack / role</span>
                  <input
                    className="rounded-lg border border-bland-line bg-white px-3 py-2 outline-none focus:border-hh-green"
                    value={role}
                    maxLength={40}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Full-stack, ex-Rust, no-sleep"
                  />
                </label>
                <div className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-bland-muted">Builder title</span>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 rounded-lg border border-bland-line bg-white px-3 py-2">
                      {builderTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBuilderTitle(generateBuilderTitle())}
                      className="rounded-lg border border-bland-line px-3 py-2 text-xs font-semibold hover:border-hh-green"
                    >
                      🎲 Reroll
                    </button>
                  </div>
                </div>

                <div className="flex w-full gap-3 sm:col-span-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-full border border-bland-line px-4 py-3 text-sm font-semibold text-bland-muted"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGenerate}
                    aria-label="Generate card"
                    className="flex-1 rounded-full bg-hh-green px-4 py-3 text-sm font-bold text-hh-yellow disabled:opacity-60"
                  >
                    {busy ? "…" : generateLabel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {stage === "processing" && (
            <div className="mt-6 flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
              <span className="animate-spin text-4xl">🌞</span>
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-bland-fg">
                {processingLabel}
              </p>
            </div>
          )}

          {stage === "result" && resultUrl && (
            <div className="mt-6 flex flex-col items-center gap-5">
              <div className="w-full max-w-[320px] overflow-hidden rounded-2xl shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="Your HH Goa 2026 Builder ID Card"
                  width={CARD_WIDTH}
                  className="w-full"
                />
              </div>
              <p className="-mt-3 font-[family-name:var(--font-label)] text-xs tracking-[0.2em] text-bland-muted">
                BUILDER ID · {builderId}
              </p>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 rounded-full border-2 border-hh-green px-4 py-3 text-sm font-bold text-hh-green"
                >
                  ⬇ Download
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  className="flex-1 rounded-full bg-hh-pink px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {sharing ? "Preparing…" : "Share to 𝕏"}
                </button>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-xs font-semibold text-bland-muted underline"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
