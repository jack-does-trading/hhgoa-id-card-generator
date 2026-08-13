"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Curtain-split timing — kept as one constant since AppShell needs to know
// exactly when the transition finishes to unmount this component.
const OPEN_MS = 900;
const OPEN_MS_REDUCED = 200;

// The source video has a letterboxed frame — solid black bars baked into
// the actual pixels along the top/bottom ~12.5% (measured by sampling
// frame luminance, not eyeballed). CSS `object-fit: cover` alone can't
// remove content that's actually part of the image, so this zooms in
// enough (576 / (576 - 2*72) ≈ 1.33) to crop the bars out of frame and
// have real footage fill the full height edge-to-edge.
const VIDEO_ZOOM = 1.34;

// Skips the slow intro — playback starts (and loops back to) 15s in rather
// than 0. Native `loop` jumps straight to 0 on end, so it's turned off in
// favor of a manual `ended` restart that re-seeks to 15s each time.
const SKIP_INTRO_SECONDS = 16;

/**
 * ONE video decoder painting BOTH curtain halves.
 *
 * The halves used to be two independent `<video>` elements pointed at the
 * same file. On a local disk they stay close enough to look identical; over
 * a network they cannot. Each element runs its own fetch, its own buffering,
 * its own seek to `SKIP_INTRO_SECONDS` and its own decode clock, so the top
 * and bottom halves end up showing frames from different moments — and
 * because the two halves are supposed to read as one continuous picture, any
 * divergence at all is visible as a hard mismatch across the seam. Nothing
 * short of a shared clock fixes that: syncing `currentTime` between two
 * elements only narrows the gap, and re-seeking to chase it causes stutter.
 *
 * So there is now a single hidden `<video>`, and one rAF loop draws that
 * element's *current frame* into two canvases in the same tick. Both halves
 * are the same frame by construction — there is one decoder and one clock,
 * so they physically cannot drift, on any connection.
 *
 * Each canvas is only half-viewport tall but is painted as though it were a
 * full-viewport box offset by its own position (the same "virtual 100vh"
 * trick the logo lockup uses), which keeps the seam continuous and costs
 * exactly one viewport of fill per frame — the same as the old two videos.
 */
function useVideoCurtain(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  topRef: React.RefObject<HTMLCanvasElement | null>,
  bottomRef: React.RefObject<HTMLCanvasElement | null>
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Not done via a React `onLoadedMetadata` prop: this is a server-rendered
    // `<video autoPlay>`, so the browser can fire the native event straight
    // from the parsed HTML, before React has hydrated and attached any
    // listener. Checking `readyState` covers "already loaded before we got
    // here"; the listener covers the usual slow-connection case.
    const seekPastIntro = () => {
      if (video.duration && SKIP_INTRO_SECONDS >= video.duration) return;
      video.currentTime = SKIP_INTRO_SECONDS;
    };
    if (video.readyState >= 1 /* HAVE_METADATA */) seekPastIntro();
    else video.addEventListener("loadedmetadata", seekPastIntro, { once: true });

    // Native `loop` would jump to 0 and replay the intro we just skipped.
    const onEnded = () => {
      seekPastIntro();
      video.play().catch(() => {});
    };
    video.addEventListener("ended", onEnded);
    video.play().catch(() => {});

    // The source is only ~576px tall, so a full devicePixelRatio backing
    // store buys no detail — it just multiplies fill cost on retina phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      const fullW = window.innerWidth;
      const fullH = window.innerHeight;
      const halfH = fullH / 2;

      // `cover` against the FULL viewport box (not the half), then zoomed to
      // crop the letterbox bars — identical maths for both halves.
      const scale = Math.max(fullW / vw, fullH / vh) * VIDEO_ZOOM;
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (fullW - dw) / 2;
      const dyBase = (fullH - dh) / 2;

      for (const [ref, offsetY] of [
        [topRef, 0],
        [bottomRef, halfH],
      ] as const) {
        const canvas = ref.current;
        if (!canvas) continue;
        const bw = Math.round(fullW * dpr);
        const bh = Math.round(halfH * dpr);
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw;
          canvas.height = bh;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // No clear needed: cover-plus-zoom always covers the whole canvas.
        ctx.drawImage(video, dx, dyBase - offsetY, dw, dh);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("loadedmetadata", seekPastIntro);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef, topRef, bottomRef]);
}

/** Wordmark + neon "गोवा" sign composited on top of it, sized big and dead
 *  center — rendered twice (once per curtain half, see below) so it splits
 *  down the middle along with the video. */
function SplashLockup({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 px-6 sm:gap-8">
      <div className="relative flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/hacker-house-wordmark.png"
          alt="Hacker House"
          className="w-[78vw] max-w-[760px] drop-shadow-[0_6px_26px_rgba(0,0,0,0.6)] sm:w-[52vw]"
        />
        {/* The neon "गोवा" sign. Deliberately NOT dead-center: the wordmark's
           geometric middle lands on the R/H letterforms, so centering it there
           had the sticker colliding with two stems. Slapped low-right over the
           baseline instead, where it sits in actual negative space and reads
           as an applied sticker. Layered glow (yellow core + pink bloom,
           matching the mark) stands in for a real neon-tube halo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/goa-hindi.svg"
          alt="गोवा"
          className="absolute bottom-full right-[7%] -mb-3 w-[9vw] max-w-[104px] -rotate-6 [filter:drop-shadow(0_0_14px_#fee101)_drop-shadow(0_0_26px_#ff0080)] sm:w-[7vw]"
        />
      </div>
      <button
        type="button"
        onClick={onEnter}
        className="pointer-events-auto rounded-full bg-hh-yellow px-8 py-3 text-sm font-bold tracking-wide text-hh-green-dark shadow-xl transition hover:scale-105 active:scale-95"
      >
        Put the vibes on
      </button>
    </div>
  );
}

/**
 * Pre-site splash: muted looping hype video, HH Goa logo lockup centered,
 * "Put the vibes on" CTA below it. On click the video's picture (and the
 * logo lockup sitting on it) visually tears into a top half and bottom
 * half that fly apart (up/down). The real site is mounted directly behind
 * this whole component the entire time (see AppShell), so the gap that
 * opens up between the two halves reveals it immediately, live, mid-
 * animation — not a blank/black beat before it appears.
 *
 * The trick, used for both the video AND the logo/button group: ONE
 * half-height `overflow-hidden` wrapper per half, each holding its own
 * full-viewport-height (100vh) copy of the same content, anchored to that
 * wrapper's outer edge (top wrapper anchors to the top, bottom wrapper to
 * the bottom). Both copies are identical and centered the same way, so
 * each wrapper only ever exposes the slice of that virtual 100vh layout
 * that belongs to it — together they read as one seamless picture (with
 * an invisible seam) right up until they slide apart.
 */
export default function SplashScreen({
  onEnter,
  onOpened,
}: {
  /** Fired synchronously on click, before the animation starts — this is
   *  the hook AppShell uses to start music playback on a real user gesture. */
  onEnter: () => void;
  /** Fired once the split animation has finished, so AppShell can unmount
   *  this component (and free the video decoder) and hand off to the main
   *  site underneath. */
  onOpened: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const bottomCanvasRef = useRef<HTMLCanvasElement>(null);
  useVideoCurtain(videoRef, topCanvasRef, bottomCanvasRef);

  const handleEnter = useCallback(() => {
    if (opening) return;
    onEnter();
    setOpening(true);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onOpened, reduced ? OPEN_MS_REDUCED : OPEN_MS);
  }, [opening, onEnter, onOpened]);

  return (
    // No background of its own — only the two (opaque, canvas-filled) half
    // panels below are opaque. That's what makes the reveal live instead
    // of a flash of black: the instant a panel slides away, there's
    // nothing painted behind it but the real site.
    <div className="fixed inset-0 z-40 overflow-hidden" aria-hidden={opening}>
      {/*
        The single source of truth for both halves. Kept full-size and merely
        transparent rather than `display:none` or 1×1 — browsers throttle or
        stop decoding video they consider invisible or offscreen, and this
        element has to keep producing frames for the canvases to sample.
      */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
        src="/Prehype.mp4"
        autoPlay
        muted
        loop={false}
        playsInline
        preload="auto"
        aria-hidden="true"
        // A browser extension (video downloader / media-control style)
        // commonly stamps its own attribute (e.g. `data-video`) onto <video>
        // elements before React hydrates, which then trips a false-positive
        // hydration mismatch — nothing in our own render actually differs.
        suppressHydrationWarning
      />

      {/* top half */}
      <div
        className={`absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-black transition-transform ease-[cubic-bezier(0.6,0,1,0.4)] ${
          opening ? "-translate-y-full" : "translate-y-0"
        }`}
        style={{ transitionDuration: `${OPEN_MS}ms` }}
      >
        <canvas
          ref={topCanvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        />
        {/* Same virtual-100vh trick as the lockup: one full-page-height grade
           per half, so the gradient reads as continuous across the seam. */}
        <div className="splash-grade pointer-events-none absolute inset-x-0 top-0 h-[100vh]" />
        <div className="absolute inset-x-0 top-0 flex h-[100vh] items-center justify-center">
          <SplashLockup onEnter={handleEnter} />
        </div>
      </div>

      {/* bottom half */}
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-black transition-transform ease-[cubic-bezier(0.6,0,1,0.4)] ${
          opening ? "translate-y-full" : "translate-y-0"
        }`}
        style={{ transitionDuration: `${OPEN_MS}ms` }}
      >
        <canvas
          ref={bottomCanvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        />
        <div className="splash-grade pointer-events-none absolute inset-x-0 bottom-0 h-[100vh]" />
        <div className="absolute inset-x-0 bottom-0 flex h-[100vh] items-center justify-center">
          <SplashLockup onEnter={handleEnter} />
        </div>
      </div>
    </div>
  );
}
