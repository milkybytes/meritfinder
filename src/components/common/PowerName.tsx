import { powerColor, themeFor } from "@/data/powers";

import { Dot } from "../ui/Dot";

// A power's name in its leader's colour, with a diamond marker.
export function PowerName({ name, small }: { name: string; small?: boolean }) {
  const c = powerColor(name);
  return (
    <span className={`inline-flex items-center gap-1.5 ${small ? "text-sm" : "font-medium"}`} style={c ? { color: themeFor(name).accent } : undefined}>
      <Dot color={c ?? "var(--muted)"} />
      {name}
    </span>
  );
}
