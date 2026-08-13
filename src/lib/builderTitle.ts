// "Builder title" generator — no backend, no AI call.
//
// Deliberately DETERMINISTIC: the same (name, role) pair always produces the
// same title. A random title reads as a slot machine — you pull it, you don't
// own it. A derived one reads as a personality test: "this is what the card
// says *I* am," which is the thing people actually screenshot and compare.
// `generateBuilderTitle()` (no seed) stays random for the pre-typing state
// and for the explicit Reroll button, which is the escape hatch.

const PREFIXES = [
  "Chief",
  "Head",
  "Lead",
  "Resident",
  "Certified",
  "Self-Appointed",
  "Official",
  "Undisputed",
];

const GOA_FLAVOR = [
  "Sunset",
  "Coconut",
  "Late-Night",
  "Beach-Deploy",
  "Monsoon",
  "Feni-Fueled",
  "Hammock",
  "Tide-Powered",
  "Palm-Shade",
  "Sundowner",
];

const ROLE_NOUNS = [
  "Hacker",
  "Shipper",
  "Debugger",
  "Builder",
  "Prompt Whisperer",
  "Pixel Pusher",
  "Uptime Guardian",
  "Merge Conflict Resolver",
  "Demo Day Survivor",
  "Bug Whisperer",
];

/** FNV-1a — small, fast, and spreads single-character changes across the
 *  whole word, so "Priya" and "Priyaa" land on unrelated titles rather than
 *  neighbouring ones. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateBuilderTitle(): string {
  return `${pick(PREFIXES)} ${pick(GOA_FLAVOR)} ${pick(ROLE_NOUNS)}`;
}

/**
 * The same identity always gets the same title. Each of the three word slots
 * is driven by a different bit-slice of one hash, so they vary independently
 * instead of moving in lockstep.
 */
export function titleForIdentity(name: string, role: string): string {
  const key = `${name.trim().toLowerCase()}|${role.trim().toLowerCase()}`;
  const h = hash(key);
  return [
    PREFIXES[h % PREFIXES.length],
    GOA_FLAVOR[(h >>> 8) % GOA_FLAVOR.length],
    ROLE_NOUNS[(h >>> 16) % ROLE_NOUNS.length],
  ].join(" ");
}
