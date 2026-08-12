"use client";

/**
 * Full-viewport photo backdrop — the actual HH Goa beach co-working
 * illustration (palms, the red beach shack, the blank sandwich-board sign,
 * builders on laptops at the counter), served straight from
 * `/public/beach-backdrop.jpg`.
 *
 * Sits behind the app's floating glass form panel. Pre-reveal the whole
 * scene is drained to greyscale via the shared `.bland-scope` filter; once a
 * card is generated, `revealed` flips and it transitions to full colour —
 * same "bland until you generate" concept as before, just applied to a real
 * photo instead of an animated SVG (per-layer fly-in animation doesn't make
 * sense for a flat raster image, so that machinery is gone).
 */
export default function BeachBackdrop({ revealed }: { revealed: boolean }) {
  return (
    <div
      className={`bland-scope${
        revealed ? " is-revealed" : ""
      } pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bland-bg`}
    >
      {/* On narrow/tall (portrait) viewports a "cover" crop hides most of
         the image width, so the default 0% keeps the shack + board fully
         in frame; from `sm:` up there's room to pan over toward the center
         of the scene instead. */}
      <div
        className="absolute inset-0 bg-cover bg-no-repeat bg-[position:0%_55%] sm:bg-[position:22%_55%]"
        style={{ backgroundImage: "url(/beach-backdrop.jpg)" }}
      />
    </div>
  );
}
