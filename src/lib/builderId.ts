// Per-card unique-ish badge number, e.g. "#HH-GOA-7105". Not a database-
// backed sequence (see conversation: user explicitly chose "random, no new
// infra" over a real incrementing counter) — just a random 4-digit number
// behind the constant "HH-GOA" segment. 10,000 combinations, plenty for an
// event-scale badge and needs zero backend.
export function generateBuilderId(): string {
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `#HH-GOA-${num}`;
}
