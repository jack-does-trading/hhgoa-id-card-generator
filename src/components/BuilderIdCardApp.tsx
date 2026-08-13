"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import PhotoCropper, { PhotoCropperHandle } from "./PhotoCropper";
import BeachBackdrop from "./BeachBackdrop";
import CardStage from "./CardStage";
import { toDisplayableImage } from "@/lib/heic";
import { generateBuilderTitle, titleForIdentity } from "@/lib/builderTitle";
import { generateBuilderId } from "@/lib/builderId";
import {
  renderIdCard,
  renderIdCardBack,
  canvasToBlob,
  COLORS,
  type CardData,
} from "@/lib/generateCard";
import {
  renderShareFormat,
  FORMAT_META,
  type ShareFormat,
} from "@/lib/shareFormats";
import { renderQrCanvas } from "@/lib/qr";
import { daysToGo } from "@/lib/countdown";
import { sfxShutter, sfxStamp, sfxTick } from "@/lib/sfx";

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
// The गोवा brand mark, fetched once per session and reused for every render.
// Resolves to `undefined` rather than rejecting if it can't be fetched — the
// wordmark has a text fallback, and a missing decorative asset should never
// be the reason card generation fails.
let goaMarkPromise: Promise<HTMLImageElement | undefined> | null = null;
function loadGoaMark(): Promise<HTMLImageElement | undefined> {
  if (!goaMarkPromise) {
    goaMarkPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(undefined);
      img.src = "/brand/goa-hindi.svg";
    });
  }
  return goaMarkPromise;
}

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
  // The title is DERIVED from name + stack, not rolled. Same person always
  // gets the same title, so the card reads as a verdict about you rather than
  // a slot-machine pull — which is also what makes two people comparing cards
  // interesting. `rerolledTitle` is the explicit opt-out.
  const [rerolledTitle, setRerolledTitle] = useState<string | null>(null);
  const builderTitle = rerolledTitle ?? titleForIdentity(name, role);

  const [builderId, setBuilderId] = useState(() => generateBuilderId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingLabel, setProcessingLabel] = useState(PROCESSING_LABELS[0]);

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<ShareFormat>("feed");
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  // Populated in the background right after generation so the share click
  // never has to wait on a network round trip.
  const shareUrlRef = useRef<string | null>(null);
  const [generateLabel] = useState(
    () => GENERATE_LABELS[Math.floor(Math.random() * GENERATE_LABELS.length)]
  );
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardDataRef = useRef<CardData | null>(null);
  const cropperRef = useRef<PhotoCropperHandle>(null);

  /** Re-composes the card into whichever aspect ratio is currently selected.
   *  Cheap enough (one drawImage onto a fresh canvas) to do per export rather
   *  than pre-rendering all four up front. */
  /** Uploads the card in the background so `/r/[id]` (and therefore the
   *  link preview's og:image) exists before anyone asks for it. Failure is
   *  silent and expected — with no Blob store configured the share simply
   *  goes out as text. */
  const uploadForShare = useCallback(async (card: HTMLCanvasElement) => {
    try {
      const res = await fetch("/api/upload-card", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: await canvasToBlob(card),
      });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id: string };
      shareUrlRef.current = `${window.location.origin}/r/${id}`;
    } catch {
      // storage not configured / offline — text-only share is the fallback
    }
  }, []);

  const exportCanvas = useCallback((fmt: ShareFormat) => {
    const card = resultCanvasRef.current;
    const data = cardDataRef.current;
    if (!card || !data) return null;
    return renderShareFormat(fmt, card, data);
  }, []);

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
    sfxShutter();

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
      // Used exactly as cropped — no style pass, no posterise, no warmth
      // push, no grain. Every stylised element on this card is drawn *around*
      // the portrait; the person's own face is the one thing left untouched.
      const photo = cropperRef.current.getCroppedCanvas(760);
      if (!photo) throw new Error("No photo cropped");

      // Points at the site root rather than this specific card's own share
      // page — a genuinely per-card QR would need the finished card
      // uploaded *before* it can be drawn onto that same card (the /r/[id]
      // share link only exists once the rendered PNG has been uploaded),
      // which means either a chicken-and-egg render twice, or making
      // "Generate" itself wait on a network round trip it never needed
      // before. Punting on that trade-off for now — flagged to the user.
      // Rendered at 640 now that the QR is the hero of the card's back rather
      // than a 78px afterthought in the front's corner.
      const [qr, goaMark] = await Promise.all([
        renderQrCanvas(
          window.location.origin,
          640,
          COLORS.greenDark,
          COLORS.cream
        ).catch(() => undefined),
        loadGoaMark(),
      ]);

      const cardData: CardData = {
        name: name.trim(),
        role: role.trim(),
        builderTitle,
        builderId,
        photo,
        daysToGo: daysToGo(),
        qr,
        goaMark,
      };

      const card = renderIdCard(cardData);
      const cardBack = renderIdCardBack(cardData);

      // Small deliberate pause so the reveal reads as a beat, not a jump cut —
      // capped well under the "few seconds, not a loading screen" budget, and
      // skipped entirely for reduced-motion users.
      if (!prefersReducedMotion) {
        await new Promise((r) => setTimeout(r, 900));
      }

      resultCanvasRef.current = card;
      cardDataRef.current = cardData;
      setResultUrl(card.toDataURL("image/png"));
      setBackUrl(cardBack.toDataURL("image/png"));
      setStage("result");
      sfxStamp();

      // Fire-and-forget: gets the share URL ready while the user is still
      // looking at their card, so clicking "Share to X" is instant.
      void uploadForShare(card);
    } catch (err) {
      console.error(err);
      setError("Something went wrong generating the card — try again.");
      setStage("edit");
    } finally {
      if (labelTimer) clearInterval(labelTimer);
    }
  }, [name, role, builderTitle, builderId, uploadForShare]);

  const handleDownload = useCallback(async () => {
    const canvas = exportCanvas(format);
    if (!canvas) return;
    sfxTick();
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hh-goa-2026-${format}-${(name || "builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [name, format, exportCanvas]);

  /**
   * Straight to the X composer, synchronously, with zero awaits in the way.
   *
   * Everything slow was moved off this path: the card is uploaded in the
   * background the moment it's generated (see `uploadForShare`), so by the
   * time anyone clicks this the share URL is usually already sitting in
   * `shareUrlRef` — and if it isn't, the tweet just goes out without the
   * link preview rather than making the user wait for it. Copying the image
   * to the clipboard used to happen here too, but that prompts for
   * permission in some browsers, which stalled the one thing this button is
   * supposed to do. It's its own button now.
   */
  const handleShare = useCallback(() => {
    sfxTick();
    const params = new URLSearchParams({ text: SHARE_TEXT });
    if (shareUrlRef.current) params.set("url", shareUrlRef.current);
    window.open(
      `https://twitter.com/intent/tweet?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  /** Explicit, opt-in clipboard copy — X's web intent has no media
   *  parameter, so pasting is the only way to attach the actual image. */
  const handleCopyImage = useCallback(async () => {
    const canvas = exportCanvas(format);
    if (!canvas) return;
    try {
      // Handed the *promise* rather than an awaited blob: Safari requires
      // the write to be issued in the same task as the gesture and resolves
      // it itself. Chrome accepts both forms.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": canvasToBlob(canvas) }),
      ]);
      setCopied("ok");
      sfxTick();
    } catch {
      setCopied("fail");
    }
    window.setTimeout(() => setCopied(null), 2600);
  }, [format, exportCanvas]);

  const reset = useCallback(() => {
    setStage("upload");
    setPhotoBlob(null);
    setResultUrl(null);
    setBackUrl(null);
    setFormat("feed");
    setCopied(null);
    shareUrlRef.current = null;
    resultCanvasRef.current = null;
    cardDataRef.current = null;
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
                  <span className="text-bland-muted">
                    Builder title{" "}
                    <span className="text-[11px] opacity-70">
                      {rerolledTitle ? "· rerolled" : "· derived from your name + stack"}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 rounded-lg border border-bland-line bg-white px-3 py-2">
                      {builderTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRerolledTitle(generateBuilderTitle());
                        sfxTick();
                      }}
                      className="rounded-lg border border-bland-line px-3 py-2 text-xs font-semibold hover:border-hh-green"
                    >
                      Reroll
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

          {stage === "result" && resultUrl && backUrl && (
            <div className="mt-2 flex flex-col items-center gap-5">
              <div className="w-full max-w-[300px]">
                <CardStage
                  front={resultUrl}
                  back={backUrl}
                  alt="Your HH Goa 2026 Builder ID Card"
                />
              </div>

              {/* Export size picker. The preview above always stays the card
                 itself — these only change what Download/Share hand you, so
                 choosing a size never costs you the hero image. */}
              <div className="w-full">
                <p className="mb-2 text-center text-[11px] tracking-[0.18em] text-bland-muted">
                  EXPORT SIZE
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(FORMAT_META) as ShareFormat[]).map((key) => {
                    const meta = FORMAT_META[key];
                    const active = key === format;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setFormat(key);
                          sfxTick();
                        }}
                        className={`rounded-xl border px-2 py-2 text-center transition ${
                          active
                            ? "border-hh-green bg-hh-green text-hh-yellow"
                            : "border-bland-line bg-white/70 text-bland-fg hover:border-hh-green"
                        }`}
                      >
                        <span className="block text-xs font-bold">
                          {meta.label}
                        </span>
                        <span className="block text-[9px] opacity-70">
                          {meta.hint.split(" · ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                  className="flex-1 rounded-full bg-hh-pink px-4 py-3 text-sm font-bold text-white"
                >
                  Share to 𝕏
                </button>
              </div>

              {/* Separate from Share on purpose: the clipboard API can prompt
                 for permission, and that prompt sitting in front of the
                 composer is exactly what made sharing feel stuck. */}
              <button
                type="button"
                onClick={handleCopyImage}
                className="-mt-2 text-xs font-semibold text-bland-muted underline"
              >
                {copied === "ok"
                  ? "Copied — paste it into the tweet"
                  : copied === "fail"
                    ? "Couldn't copy — use Download instead"
                    : "Copy card image"}
              </button>

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
