import { FACTION_STATE_COLORS } from "@/data/state-colors";

import { Badge } from "../ui/Badge";

// The state of a system's controlling faction (Boom, Bust, War...), in that state's colour (src/data/state-colors.ts).
export function FactionState({ state, className = "" }: { state: string; className?: string }) {
  return (
    <Badge
      className={className}
      color={FACTION_STATE_COLORS[state]}
      title="State of the system's controlling faction. States like Boom or Bust shift commodity demand and prices."
    >
      {state}
    </Badge>
  );
}
