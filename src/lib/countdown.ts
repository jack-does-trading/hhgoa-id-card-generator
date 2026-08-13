// Live "N days to go" ticker toward the event start — HH Goa 2026 runs from
// 28 Oct 2026, IST. Recomputed from the real clock (not baked at build
// time), so it stays correct no matter when the page is loaded.
const EVENT_START_IST = new Date("2026-10-28T00:00:00+05:30");

export function daysToGo(now: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((EVENT_START_IST.getTime() - now.getTime()) / msPerDay);
}

/** A handful of differently-worded takes on the same day count, for the
 *  typewriter loop in EventCountdown to cycle through. Terminal states
 *  (event day / already live) only get one phrasing each — cycling
 *  "It's today" against reworded variants of itself isn't worth it. */
export function daysToGoLabels(days: number): string[] {
  // All three sit in the same register — a countdown, phrased three ways —
  // rather than mixing a fact, a joke and a studio credit, which read as
  // three different voices talking over each other.
  if (days > 1) {
    return [
      `${days} days to go`,
      `${days} days until sunscreen needed`,
      `${days} days until Goa`,
    ];
  }
  if (days === 1) {
    return ["1 day to go", "1 last sunset", "See you tomorrow"];
  }
  if (days === 0) return ["It's today 🎉"];
  return ["HH Goa is live 🌴"];
}
