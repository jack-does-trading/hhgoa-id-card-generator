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
 * Seeks a video element past the intro once its metadata is available, and
 * re-seeks on every loop. Deliberately NOT done via a React
 * `onLoadedMetadata` prop: this is a server-rendered `<video autoPlay>` tag,
 * so the browser can start fetching/decoding it — and fire the native
 * `loadedmetadata` event — straight from the parsed HTML, before React's JS
 * bundle has even hydrated and attached that listener. Miss that one-shot
 * event and the seek never happens. Checking `readyState` directly on mount
 * covers the "already loaded before we got here" case; the listener covers
 * the (usually true on a slow connection) case where it hasn't yet.
 */
function useSkipIntro(ref: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const seekPastIntro = () => {
      video.currentTime = SKIP_INTRO_SECONDS;
    };
    if (video.readyState >= 1 /* HAVE_METADATA */) {
      seekPastIntro();
    } else {
      video.addEventListener("loadedmetadata", seekPastIntro, { once: true });
    }
    const onEnded = () => {
      seekPastIntro();
      video.play().catch(() => {});
    };
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", seekPastIntro);
      video.removeEventListener("ended", onEnded);
    };
  }, [ref]);
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
        {/* The neon "गोवा" sign, inset dead-center over the wordmark —
           layered glow (pink stroke + yellow fill, matching the mark's own
           colors) stands in for an actual neon-tube bloom. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/goa-hindi.svg"
          alt="गोवा"
          className="absolute w-[7vw] max-w-[85px] [filter:drop-shadow(0_0_14px_#fee101)_drop-shadow(0_0_26px_#ff0080)] sm:w-[6vw]"
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
   *  this component (and free the two video decoders) and hand off to the
   *  main site underneath. */
  onOpened: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const topVideoRef = useRef<HTMLVideoElement>(null);
  const bottomVideoRef = useRef<HTMLVideoElement>(null);
  useSkipIntro(topVideoRef);
  useSkipIntro(bottomVideoRef);

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
    // No background of its own — only the two (opaque, video-filled) half
    // panels below are opaque. That's what makes the reveal live instead
    // of a flash of black: the instant a panel slides away, there's
    // nothing painted behind it but the real site.
    <div className="fixed inset-0 z-40 overflow-hidden" aria-hidden={opening}>
      {/* top half */}
      <div
        className={`absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-black transition-transform ease-[cubic-bezier(0.6,0,1,0.4)] ${
          opening ? "-translate-y-full" : "translate-y-0"
        }`}
        style={{ transitionDuration: `${OPEN_MS}ms` }}
      >
        <video
          ref={topVideoRef}
          className="absolute inset-x-0 top-0 h-[100vh] w-full object-cover"
          style={{ transform: `scale(${VIDEO_ZOOM})` }}
          src="/Prehype.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          // A browser extension (video downloader / media-control style)
          // commonly stamps its own attribute (e.g. `data-video`) onto
          // <video> elements before React hydrates, which then trips a
          // false-positive hydration mismatch — nothing in our own
          // server/client render actually differs.
          suppressHydrationWarning
        />
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
        <video
          ref={bottomVideoRef}
          className="absolute inset-x-0 bottom-0 h-[100vh] w-full object-cover"
          style={{ transform: `scale(${VIDEO_ZOOM})` }}
          src="/Prehype.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          suppressHydrationWarning
        />
        <div className="absolute inset-x-0 bottom-0 flex h-[100vh] items-center justify-center">
          <SplashLockup onEnter={handleEnter} />
        </div>
      </div>
    </div>
  );
}
