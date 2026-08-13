"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PLAYLIST } from "@/lib/playlist";

/**
 * Transport icons as inline SVG rather than the ⏮ ⏸ ▶ ⏭ characters they
 * replace. Those codepoints have no fixed presentation: macOS Chrome renders
 * them as flat monochrome glyphs, while iOS resolves them through Apple Color
 * Emoji and draws full-colour blobs — same markup, completely different
 * control bar depending on the device. Paths render identically everywhere
 * and inherit `currentColor`.
 */
function Icon({ name }: { name: "prev" | "next" | "play" | "pause" }) {
  const paths: Record<string, React.ReactNode> = {
    prev: (
      <>
        <path d="M6 5v14" />
        <path d="M19 6.2v11.6a.6.6 0 0 1-.93.5l-8.7-5.8a.6.6 0 0 1 0-1l8.7-5.8a.6.6 0 0 1 .93.5Z" />
      </>
    ),
    next: (
      <>
        <path d="M18 5v14" />
        <path d="M5 6.2v11.6a.6.6 0 0 0 .93.5l8.7-5.8a.6.6 0 0 0 0-1l-8.7-5.8A.6.6 0 0 0 5 6.2Z" />
      </>
    ),
    play: <path d="M7 4.9v14.2a.6.6 0 0 0 .92.5l11.1-7.1a.6.6 0 0 0 0-1L7.92 4.4a.6.6 0 0 0-.92.5Z" />,
    pause: (
      <>
        <rect x="6.5" y="5" width="3.6" height="14" rx="1.1" />
        <rect x="13.9" y="5" width="3.6" height="14" rx="1.1" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-[18px] w-[18px]"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={name === "prev" || name === "next" ? 2 : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

/**
 * The random starting track, resolved once per page load and then frozen.
 *
 * Read through `useSyncExternalStore` rather than picked in an effect: the
 * server has to render a deterministic track or hydration mismatches (it did,
 * loudly — the server and client each rolled their own dice and React flagged
 * the differing title and album art). `getServerSnapshot` returns 0 so the
 * markup is stable, and React swaps in the client value right after hydration
 * without a mismatch, which is exactly what this hook exists for. Deciding
 * early also matters for playback: `preload="auto"` only buffers whatever is
 * currently in `src`, so picking at click-time meant the chosen track had
 * never been fetched and the cold request ate the user-gesture grant that
 * lets audio start at all.
 */
let pickedStart: number | null = null;
const subscribeNever = () => () => {};
const getStartOnClient = () => {
  if (pickedStart === null) {
    pickedStart =
      PLAYLIST.length > 1 ? Math.floor(Math.random() * PLAYLIST.length) : 0;
  }
  return pickedStart;
};
const getStartOnServer = () => 0;

/** Width of the collapsed puck: the 44px disc plus its 12px side padding. */
const COLLAPSED_W = 68;

/** How long the expanded pill stays up after the splash opens before tucking
 *  itself away. Long enough to register what's playing, short enough to be
 *  gone before anyone reaches the buttons underneath it. */
const AUTO_COLLAPSE_MS = 5000;

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
    const startIndex = useSyncExternalStore(
      subscribeNever,
      getStartOnClient,
      getStartOnServer
    );
    // Only the user's own skips live in state; the starting point comes from
    // the store above. Keeping them separate is what avoids writing state
    // from an effect just to randomise.
    const [skips, setSkips] = useState(0);
    const [playing, setPlaying] = useState(false);

    // Starts expanded — on the splash it *is* the now-playing moment, and it
    // stays open through the transition so you can see what came on. Five
    // seconds after the splash opens it tucks itself into the corner, which
    // is what keeps it off the result panel's Download / Share buttons on a
    // phone without ever having hidden the track from you.
    const [collapsed, setCollapsed] = useState(false);
    // Once the user has worked the toggle themselves, the timer stops having
    // an opinion — nothing is more annoying than a panel that re-closes after
    // you deliberately opened it.
    const autoCollapseSpent = useRef(false);

    useEffect(() => {
      if (!docked || autoCollapseSpent.current) return;
      const id = window.setTimeout(() => {
        if (autoCollapseSpent.current) return;
        autoCollapseSpent.current = true;
        setCollapsed(true);
      }, AUTO_COLLAPSE_MS);
      return () => window.clearTimeout(id);
    }, [docked]);

    const toggleCollapsed = () => {
      autoCollapseSpent.current = true;
      setCollapsed((c) => !c);
    };
    const trackIndex =
      PLAYLIST.length > 0
        ? (((startIndex + skips) % PLAYLIST.length) + PLAYLIST.length) %
          PLAYLIST.length
        : 0;

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
      setSkips((n) => n + dir);
      // Autoplay the newly-selected track only if we were already playing —
      // this is still inside the click handler, so it's a valid gesture.
      requestAnimationFrame(() => {
        if (playing) audioRef.current?.play().catch(() => {});
      });
    };

    return (
      <div
        /*
         * Position, size and shape are all driven from inline style rather
         * than swapped utility classes because they have to *interpolate*:
         * collapsing animates left/width/transform together, and Tailwind
         * class swaps would just snap between two static layouts.
         */
        style={{
          left: collapsed ? "1rem" : "50%",
          transform: collapsed ? "translateX(0)" : "translateX(-50%)",
          width: collapsed ? COLLAPSED_W : "min(360px, 88vw)",
          ...(docked
            ? { bottom: "1.5rem", top: "auto" }
            : { top: "62%", bottom: "auto" }),
        }}
        className="music-dock fixed z-40 flex items-center gap-3 overflow-hidden rounded-full border border-white/15 bg-black/55 px-3 py-2 text-hh-cream shadow-2xl backdrop-blur-md"
      >
        {/*
          The disc is the toggle in both directions: collapsed it's the only
          thing on screen to press, and expanded it's the obvious handle to
          put it away again. It keeps spinning either way, so the collapsed
          state still reads as "music is playing" at a glance.
        */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={
            collapsed
              ? `Expand player — ${track.title} by ${track.artist}`
              : "Collapse player"
          }
          aria-expanded={!collapsed}
          className="disc-spin h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/25 bg-black/40 bg-cover bg-center"
          style={{
            backgroundImage: `url(${track.art})`,
            animationPlayState: playing ? "running" : "paused",
          }}
        />

        {/*
          Everything past the disc is clipped away by the container's
          `overflow-hidden` as it narrows. `shrink-0` on the controls keeps
          them from squashing on the way out, so they slide under the edge at
          full size instead of deforming.
        */}
        <div
          aria-hidden={collapsed}
          className={`min-w-0 flex-1 leading-tight transition-opacity duration-200 ${
            collapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <p className="truncate text-xs font-semibold">{track.title}</p>
          <p className="truncate text-[10px] text-white/60">{track.artist}</p>
        </div>
        <div
          aria-hidden={collapsed}
          className={`flex shrink-0 items-center gap-1 transition-opacity duration-200 ${
            collapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous track"
            tabIndex={collapsed ? -1 : 0}
            className="flex items-center justify-center p-2"
          >
            <Icon name="prev" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            tabIndex={collapsed ? -1 : 0}
            className="flex items-center justify-center rounded-full bg-white/15 p-2.5"
          >
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next track"
            tabIndex={collapsed ? -1 : 0}
            className="flex items-center justify-center p-2"
          >
            <Icon name="next" />
          </button>
        </div>

        <audio
          ref={audioRef}
          src={track.src}
          onEnded={() => step(1)}
          // `auto` (not `none`) — the track is fetched in the background as
          // soon as the page loads, so by the time the splash button is
          // clicked, `.play()` can start immediately instead of waiting on a
          // fresh fetch (see the comment in `start()` above for why that gap
          // matters for autoplay-gesture policies).
          preload="auto"
        />
      </div>
    );
  }
);

export default MusicPlayer;
