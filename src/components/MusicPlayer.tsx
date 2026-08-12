"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { PLAYLIST } from "@/lib/playlist";

export type MusicPlayerHandle = {
  /** Starts playback. Call this synchronously from within a real click
   *  handler (see SplashScreen's "Put the vibes on" button) — browsers only
   *  allow audio-with-sound to start from an actual user gesture. */
  start: () => void;
};

/**
 * Floating now-playing pill with a spinning "disc" for album art. Mounted
 * once at the AppShell level (never inside SplashScreen) so the same
 * <audio> element survives the splash → main-site transition without
 * interrupting playback — only its on-screen position changes, via the
 * `docked` prop.
 */
const MusicPlayer = forwardRef<MusicPlayerHandle, { docked: boolean }>(
  function MusicPlayer({ docked }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    // Starts at a fixed index (0), NOT a random one — this initializer runs
    // during SSR as well as on the client, and `Math.random()` here would
    // have the server and the client each pick their own different track,
    // which React then flags as a hydration mismatch (title/artist/art
    // text disagreeing between the server-rendered HTML and the client's
    // first render). The random pick itself still happens, just moved into
    // the effect below, which only ever runs client-side, after hydration.
    const [trackIndex, setTrackIndex] = useState(0);
    const [playing, setPlaying] = useState(false);

    // Random pick happens once, right here right after mount — NOT inside
    // start() at click-time. `preload="auto"` below only ever buffers
    // whichever track is currently assigned to the <audio> element's `src`;
    // picking randomly at click-time meant 2 of the 3 tracks had never been
    // fetched at all, so switching to one of them forced a cold fetch in
    // the same breath as `.play()` — the same gesture-losing gap fixed
    // last round for the single-track case, just still present whenever
    // the pick actually differed from whatever loaded by default. Picking
    // at (effectively) mount instead means whichever track wins has almost
    // the entire page-load-to-click window to finish buffering.
    useEffect(() => {
      if (PLAYLIST.length > 1) {
        setTrackIndex(Math.floor(Math.random() * PLAYLIST.length));
      }
    }, []);

    useImperativeHandle(ref, () => ({
      start() {
        const el = audioRef.current;
        if (!el) return;
        el.play()
          .then(() => setPlaying(true))
          .catch(() => {
            // Blocked/interrupted — leave the pill visible but paused
            // rather than throwing; the play button still works.
          });
      },
    }));

    // No tracks configured yet (see lib/playlist.ts) — render nothing.
    if (PLAYLIST.length === 0) return null;

    const track = PLAYLIST[trackIndex];

    const toggle = () => {
      const el = audioRef.current;
      if (!el) return;
      if (el.paused) {
        el.play().then(() => setPlaying(true)).catch(() => {});
      } else {
        el.pause();
        setPlaying(false);
      }
    };

    const step = (dir: 1 | -1) => {
      setTrackIndex((i) => (i + dir + PLAYLIST.length) % PLAYLIST.length);
      // Autoplay the newly-selected track only if we were already playing —
      // this is still inside the click handler, so it's a valid gesture.
      requestAnimationFrame(() => {
        if (playing) audioRef.current?.play().catch(() => {});
      });
    };

    return (
      <div
        className={`fixed left-1/2 z-40 flex w-[min(360px,88vw)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-hh-cream shadow-2xl backdrop-blur-md transition-[top,bottom] duration-[900ms] ease-out ${
          docked ? "bottom-6 top-auto" : "top-[62%]"
        }`}
      >
        <div
          className="disc-spin h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/25 bg-black/40 bg-cover bg-center"
          style={{
            backgroundImage: `url(${track.art})`,
            animationPlayState: playing ? "running" : "paused",
          }}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold">{track.title}</p>
          <p className="truncate text-[10px] text-white/60">{track.artist}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous track"
            className="p-1"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="rounded-full bg-white/15 p-2"
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next track"
            className="p-1"
          >
            ⏭
          </button>
        </div>
        <audio
          ref={audioRef}
          src={track.src}
          onEnded={() => step(1)}
          // `auto` (not `none`) — the track is fetched in the background as
          // soon as the page loads, so by the time the splash button is
          // clicked, `.play()` can start immediately instead of waiting on
          // a fresh fetch (see the comment in `start()` above for why that
          // gap matters for autoplay-gesture policies).
          preload="auto"
        />
      </div>
    );
  }
);

export default MusicPlayer;
