"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { daysToGo, daysToGoLabels } from "@/lib/countdown";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Subscribes to the reduced-motion preference as an external store rather
 *  than reading it inside an effect and calling setState — that pattern
 *  cascades an extra render on mount, and misses the user changing the
 *  setting while the tab is open. */
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const TYPE_MS_PER_CHAR = 45;
const DELETE_MS_PER_CHAR = 28;
const HOLD_MS = 1400; // how long a fully-typed phrase sits before deleting

/**
 * Minimal countdown ticker, pinned to the top-left corner. Mounted once at
 * the app-shell level (see AppShell.tsx) so it never unmounts/remounts
 * across the splash → main-site transition — same element, same position,
 * in both "windows" as requested.
 *
 * Cycles through 2-3 different phrasings of the same day count (see
 * lib/countdown.ts), typing each one out, holding it, backspacing it, then
 * moving to the next — on a loop, forever.
 */
export default function EventCountdown() {
  const [days, setDays] = useState(() => daysToGo());
  const [typed, setTyped] = useState("");

  useEffect(() => {
    // Recomputed periodically (not just once) so a tab left open overnight
    // still rolls over to the next day without a refresh.
    const id = setInterval(() => setDays(daysToGo()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Derived from the `days` number rather than depending on daysToGoLabels'
  // own return value directly — that returns a fresh array reference every
  // call, which would restart the type/delete loop below on every 60s tick
  // even when the phrasing hasn't actually changed. Memoizing on the
  // primitive `days` keeps the loop stable across ticks that don't matter.
  const labels = useMemo(() => daysToGoLabels(days), [days]);

  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false // server: assume motion is fine, the effect never runs there
  );

  useEffect(() => {
    if (reduced || labels.length <= 1) return;

    let cancelled = false;
    let phraseIndex = 0;
    let charCount = 0;
    let timer: ReturnType<typeof setTimeout>;

    const typeStep = () => {
      if (cancelled) return;
      const phrase = labels[phraseIndex];
      charCount++;
      setTyped(phrase.slice(0, charCount));
      if (charCount >= phrase.length) {
        timer = setTimeout(deleteStep, HOLD_MS);
      } else {
        timer = setTimeout(typeStep, TYPE_MS_PER_CHAR);
      }
    };

    const deleteStep = () => {
      if (cancelled) return;
      charCount--;
      setTyped(labels[phraseIndex].slice(0, charCount));
      if (charCount <= 0) {
        phraseIndex = (phraseIndex + 1) % labels.length;
        timer = setTimeout(typeStep, TYPE_MS_PER_CHAR);
      } else {
        timer = setTimeout(deleteStep, DELETE_MS_PER_CHAR);
      }
    };

    timer = setTimeout(typeStep, TYPE_MS_PER_CHAR);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [labels, reduced]);

  return (
    <div
      className="pointer-events-none fixed left-4 top-4 z-50 flex items-center font-sans text-2xl font-black tracking-tighter text-hh-cream [text-shadow:0_2px_14px_rgba(0,0,0,0.65)] sm:left-6 sm:top-6 sm:text-4xl"
      aria-live="off"
    >
      {/* Reduced motion gets the full phrase outright — no typing pass, so
         `typed` is never populated in that mode and would render empty. */}
      <span>{reduced ? labels[0] ?? "" : typed}</span>
      {/* A slim CSS bar rather than a Unicode block glyph — much finer and
         width-controllable at this font size than "▎" reads as. */}
      <span
        aria-hidden="true"
        className="caret-blink ml-[2px] inline-block w-[2px] shrink-0 self-stretch bg-hh-cream"
      />
    </div>
  );
}
