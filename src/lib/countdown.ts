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
  if (days > 1) {
    return [
      `${days} days to go`,
      `Don't forget your sunscreen`,
      `2:47PM Studio`,
    ];
  }
  if (days === 1) {
    return ["1 day to go", "1 day remaining", "See you tomorrow"];
  }
  if (days === 0) return ["It's today 🎉"];
  return ["HH Goa is live 🌴"];
}
