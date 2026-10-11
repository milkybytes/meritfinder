import type { ReactNode } from "react";

import { POWERPLAY_STATE_COLORS } from "@/data/state-colors";

import { Badge } from "../ui/Badge";

// One symbol per Powerplay state, drawn in the badge's colour: 16 x 16, outlines or fills of currentColor.
const SYMBOLS: Record<string, ReactNode> = {
  // a four-pointed star
  Stronghold: <path d="M8 1L9.8 6.2L15 8L9.8 9.8L8 15L6.2 9.8L1 8L6.2 6.2Z" fill="currentColor" />,
  // a downward triangle, outlined; and filled
  Fortified: <path d="M2.5 3.5H13.5L8 13.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  Exploited: <path d="M2 3H14L8 14Z" fill="currentColor" />,
  // two swords crossed, blades up, hilts at the bottom
  Contested: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2.5 2.5L11 11M9.5 12.5L12.5 9.5M11 11L13.5 13.5" />
      <path d="M13.5 2.5L5 11M6.5 12.5L3.5 9.5M5 11L2.5 13.5" />
    </g>
  ),
  // a double circle, and a single one
  Expansion: (
    <g fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="6.2" />
      <circle cx="8" cy="8" r="3" />
    </g>
  ),
  Unoccupied: <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />,
};

// A system's Powerplay state as a badge, with its symbol before the name. A state with no symbol or colour is shown plain.
export function StateTag({ state }: { state: string }) {
  const symbol = SYMBOLS[state];
  return (
    <Badge color={POWERPLAY_STATE_COLORS[state]}>
      {symbol && (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" data-symbol={state}>
          {symbol}
        </svg>
      )}
      {state}
    </Badge>
  );
}
