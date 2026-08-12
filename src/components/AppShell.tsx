"use client";

import { useCallback, useRef, useState } from "react";
import EventCountdown from "./EventCountdown";
import MusicPlayer, { MusicPlayerHandle } from "./MusicPlayer";
import SplashScreen from "./SplashScreen";

/**
 * Top-level client wrapper mounted once in layout.tsx, above the actual
 * page content (`children`). Owns the splash → main-site handoff:
 *
 * - EventCountdown and MusicPlayer are mounted here, *outside* SplashScreen,
 *   so neither unmounts (and the audio doesn't restart) when the splash
 *   closes — only their position/label changes.
 * - `children` (the real site) is always mounted underneath the splash,
 *   so the instant the video curtain splits apart there's no loading gap —
 *   it's already there.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const playerRef = useRef<MusicPlayerHandle>(null);

  const handleEnter = useCallback(() => {
    playerRef.current?.start();
  }, []);

  const handleOpened = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <>
      <EventCountdown />
      <MusicPlayer ref={playerRef} docked={!showSplash} />
      {showSplash && (
        <SplashScreen onEnter={handleEnter} onOpened={handleOpened} />
      )}
      {children}
    </>
  );
}
