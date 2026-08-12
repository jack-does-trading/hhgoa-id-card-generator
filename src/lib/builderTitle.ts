// Deterministic-feeling "builder title" generator — no backend, no AI call.
// Combines three small on-brand word lists into something like
// "Chief Sunset Shipper" or "Head Coconut Debugger".

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

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateBuilderTitle(): string {
  return `${pick(PREFIXES)} ${pick(GOA_FLAVOR)} ${pick(ROLE_NOUNS)}`;
}
