"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfxFlip } from "@/lib/sfx";

/**
 * The card, hung from a lanyard, in 3D.
 *
 * Two effects share one rAF loop and write straight to the DOM — no React
 * state is touched per frame, since re-rendering a component 60 times a
 * second to move a transform is how this kind of thing ends up janky:
 *
 * 1. **Sway.** The lanyard + card pivot about the strap's top edge, driven by
 *    a critically-under-damped spring chasing a target angle. The target
 *    comes from the pointer's horizontal position (or device tilt on a
 *    phone), so the card lags and overshoots the way a real pass on a strap
 *    does instead of tracking rigidly.
 * 2. **Foil.** A conic-gradient sheen under `color-dodge`, with its center
 *    and rotation bound to the pointer, so light appears to rake across the
 *    laminate as you move over it.
 *
 * Both are disabled under `prefers-reduced-motion`, which leaves a perfectly
 * usable static card that still flips on click.
 */
export default function CardStage({
  front,
  back,
  alt,
}: {
  front: string;
  back: string;
  alt: string;
}) {
  const pivotRef = useRef<HTMLDivElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const foilRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [flipped, setFlipped] = useState(false);

  // Physics + pointer live in refs: mutated every frame, never rendered.
  const sway = useRef({ angle: 0, vel: 0, target: 0 });
  const pointer = useRef({ x: 0.5, y: 0.5, glow: 0.14 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    // Stiffness low + damping high enough to settle in ~1s: enough overshoot
    // to read as weight on a strap, not enough to look like a metronome.
    const STIFFNESS = 0.055;
    const DAMPING = 0.88;

    const loop = () => {
      const s = sway.current;
      s.vel = (s.vel + (s.target - s.angle) * STIFFNESS) * DAMPING;
      s.angle += s.vel;
      if (pivotRef.current) {
        pivotRef.current.style.transform = `rotate(${s.angle.toFixed(3)}deg)`;
      }

      const p = pointer.current;
      for (const el of foilRefs.current) {
        if (!el) continue;
        el.style.setProperty("--fx", `${(p.x * 100).toFixed(1)}%`);
        el.style.setProperty("--fy", `${(p.y * 100).toFixed(1)}%`);
        el.style.setProperty("--fa", `${(p.x * 300 - 60).toFixed(0)}deg`);
        el.style.opacity = p.glow.toFixed(3);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointerMove = (e: PointerEvent) => {
      const el = flipperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;

      pointer.current.x = Math.min(
        1,
        Math.max(0, (e.clientX - r.left) / r.width)
      );
      pointer.current.y = Math.min(
        1,
        Math.max(0, (e.clientY - r.top) / r.height)
      );
      // Kept low: `color-dodge` blows out fast, and the back face is dense
      // with small type that a strong sheen makes unreadable. This should
      // read as light grazing a laminate, not as a colour wash.
      pointer.current.glow = inside ? 0.3 : 0.1;

      // Sway follows the pointer across the whole viewport, not just the
      // card — the card should react to you approaching it, not only to a
      // direct hover.
      sway.current.target = (0.5 - e.clientX / window.innerWidth) * 16;
    };

    // Phones have no pointer to track: use tilt instead. `gamma` is the
    // left/right tilt in degrees, which maps naturally onto a hanging card.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return;
      sway.current.target = Math.max(-16, Math.min(16, -e.gamma * 0.5));
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("deviceorientation", onTilt);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);

  const flip = useCallback(() => {
    setFlipped((f) => !f);
    sfxFlip();
    // Kick the spring so flipping also nudges the card on its strap.
    sway.current.vel += 1.6;
  }, []);

  const face = (src: string, isBack: boolean) => (
    <div
      className={`absolute inset-0 overflow-hidden rounded-[18px] shadow-2xl [backface-visibility:hidden] ${
        isBack ? "[transform:rotateY(180deg)]" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={isBack ? "" : alt} className="block w-full" />
      <div
        ref={(el) => {
          foilRefs.current[isBack ? 1 : 0] = el;
        }}
        aria-hidden="true"
        className="card-foil pointer-events-none absolute inset-0"
      />
    </div>
  );

  return (
    <div className="w-full [perspective:1400px]">
      <div
        ref={pivotRef}
        className="origin-top will-change-transform"
      >
        {/* Lanyard: two woven straps converging into a metal clip that
           overlaps the card's top edge. Pure SVG — no asset, scales cleanly. */}
        <svg
          viewBox="0 0 320 132"
          aria-hidden="true"
          className="mx-auto block w-[62%] max-w-[210px]"
        >
          <g fill="none" strokeLinecap="round">
            <path d="M96 0 L150 100" stroke="var(--hh-green)" strokeWidth="15" />
            <path d="M224 0 L170 100" stroke="var(--hh-green)" strokeWidth="15" />
            <path
              d="M96 0 L150 100"
              stroke="var(--hh-yellow)"
              strokeWidth="3"
              strokeDasharray="5 9"
              opacity="0.8"
            />
            <path
              d="M224 0 L170 100"
              stroke="var(--hh-yellow)"
              strokeWidth="3"
              strokeDasharray="5 9"
              opacity="0.8"
            />
          </g>
          {/* clip */}
          <rect x="140" y="92" width="40" height="34" rx="9" fill="#c9ccc7" />
          <rect x="140" y="92" width="40" height="12" rx="6" fill="#e8ebe6" />
          <rect x="151" y="107" width="18" height="8" rx="4" fill="#8f938c" />
        </svg>

        <div
          ref={flipperRef}
          onClick={flip}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              flip();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "Show card front" : "Show card back"}
          className="relative -mt-[6px] cursor-pointer transition-transform duration-[700ms] ease-[cubic-bezier(0.34,1.4,0.5,1)] [transform-style:preserve-3d]"
          style={{ transform: `rotateY(${flipped ? 180 : 0}deg)` }}
        >
          {/* Sizer: an invisible copy of the front sets the box height so the
             two absolutely-positioned faces have something to fill. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={front} alt="" aria-hidden="true" className="block w-full invisible" />
          {face(front, false)}
          {face(back, true)}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] tracking-[0.18em] text-bland-muted">
        {flipped ? "TAP TO FLIP BACK" : "TAP THE CARD TO FLIP"}
      </p>
    </div>
  );
}
