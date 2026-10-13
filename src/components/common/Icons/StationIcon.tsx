import { createElement, type ComponentType } from "react";

import {
  MegashipIcon,
  SettlementSystemMapIcon,
  StationAsteroidIcon,
  StationCoriolisIcon,
  StationOcellusIcon,
  StationOrbisIcon,
  StationOutpostIcon,
  SurfacePortSystemMapIcon,
} from "./stations";
import { glowFilter } from "./glow";
import type { SVGIconProps } from "./SVGIcon";

export type IconComponent = ComponentType<SVGIconProps>;

// Spansh station type -> icon. A type with no entry (construction depots, untyped stations) gets none rather than a wrong one. Dodec starports use
// the Coriolis; surface and settlement types use the system-map icons, since rows list stations by system.
const STATION_ICONS: Record<string, IconComponent> = {
  "Coriolis Starport": StationCoriolisIcon,
  "Dodec Starport": StationCoriolisIcon,
  "Orbis Starport": StationOrbisIcon,
  "Ocellus Starport": StationOcellusIcon,
  "Asteroid base": StationAsteroidIcon,
  Outpost: StationOutpostIcon,
  "Mega ship": MegashipIcon,
  "Planetary Port": SurfacePortSystemMapIcon,
  "Planetary Outpost": SurfacePortSystemMapIcon,
  Settlement: SettlementSystemMapIcon,
  "Surface Settlement": SettlementSystemMapIcon,
};

const stationIconFor = (type: string | null | undefined): IconComponent | null => (type ? (STATION_ICONS[type] ?? null) : null);

// White whatever the text colour (the shapes are drawn in the text colour, so they are turned white), then the glow the other pictures use.
const WHITE_GLOW = { filter: `brightness(0) invert(1) ${glowFilter("white", 0.95, 0.6)}` } as const;

// The icon for a station type, in the white-with-a-glow HUD style, labelled with the type for hover and screen
// readers; renders nothing for unmapped types. Size it where you use it: size={16} or className="h-4 w-4".
export function StationIcon({ type, className, size }: { type: string | null | undefined; className?: string; size?: number | string }) {
  const Icon = stationIconFor(type);
  // createElement, not <Icon/>: the component comes from the module-level STATION_ICONS table, so it is
  // stable across renders, which the "component created during render" lint rule can't see.
  return Icon ? createElement(Icon, { className, size, style: WHITE_GLOW, "aria-label": type ?? undefined }) : null;
}
