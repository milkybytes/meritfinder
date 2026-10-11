// "Contested" is a Powerplay state in the game, but Spansh and EDDN send Unoccupied plus each power's control points as a fraction of the 120,000 that
// claim a system (the highest in the data is 2.6). The game's rule: two different powers at 35,000 points make it contested. Worked out at search time,
// never stored.
const CONTROL_THRESHOLD = 120_000; // points that claim an acquisition system
const CONFLICT_MIN_POINTS = 35_000; // points each of two powers need for it to be contested
export const CONFLICT_THRESHOLD = CONFLICT_MIN_POINTS / CONTROL_THRESHOLD;

export function isContested(powerState: string | null, conflictJson: string | null): boolean {
  if (powerState !== "Unoccupied" || !conflictJson) return false;
  try {
    const entries = JSON.parse(conflictJson) as { progress?: unknown }[];
    return entries.filter((e) => typeof e.progress === "number" && e.progress >= CONFLICT_THRESHOLD).length >= 2;
  } catch {
    return false;
  }
}
