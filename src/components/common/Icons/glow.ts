import type { CSSProperties } from "react";

// The glow behind a small picture, so it stands out on the dark page: a hard inner edge and a wider halo, both in the picture's own colour.
// An inline style, not a utility class: the pictures are 12 to 18 px, and the glow must not depend on a generated class being present.
export const glowFilter = (colour: string, inner = 0.95, outer = 0.7): string =>
  `drop-shadow(0 0 1.5px color-mix(in srgb, ${colour} ${inner * 100}%, transparent)) drop-shadow(0 0 2px color-mix(in srgb, ${colour} ${outer * 100}%, transparent))`;

export const glow = (colour: string, inner = 0.95, outer = 0.7): CSSProperties => ({ filter: glowFilter(colour, inner, outer) });
