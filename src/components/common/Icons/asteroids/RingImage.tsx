import Image from "next/image";

import { glow } from "../glow";

import icy from "./icy.webp";
import metalRich from "./metal-rich.webp";
import metallic from "./metallic.webp";
import rocky from "./rocky.webp";

// A ring's asteroids, by Spansh's ring type.
const RING_IMAGES = {
  Metallic: metallic,
  "Metal Rich": metalRich,
  Rocky: rocky,
  Icy: icy,
} as const;

// A gold glow, as a scanned ring glows in the game, so the small dark pictures stand out on the page: a hard inner edge and a wider halo.
const GLOW = glow("rgb(250 204 21)", 1, 0.45);

// A picture of a ring type's asteroids, with "<type> ring" as its hover label. Renders nothing for an unknown type.
// Decorative to screen readers by default.
export function RingImage({ type, size = 20, alt = "", className }: { type: string | null | undefined; size?: number; alt?: string; className?: string }) {
  const image = type ? RING_IMAGES[type as keyof typeof RING_IMAGES] : undefined;
  if (!image) return null;
  return <Image src={image} width={size} height={size} alt={alt} title={`${type} ring`} className={className} style={GLOW} unoptimized />;
}
