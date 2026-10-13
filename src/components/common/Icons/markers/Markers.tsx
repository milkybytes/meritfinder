import Image from "next/image";

import hotspot from "./hotspot.svg";

// A warm glow, as a hotspot shows in the game's scanner.
const GLOW = "drop-shadow-[0_0_3px_rgb(251_146_60/0.75)]";

// A hotspot: marks a mineral that has one in the ring, as opposed to one that is only somewhere in a ring of that type.
export function HotspotImage({ size = 12, alt = "", className }: { size?: number; alt?: string; className?: string }) {
  return <Image src={hotspot} width={size} height={size} alt={alt} title="Hotspot" className={`${GLOW} ${className ?? ""}`.trim()} unoptimized />;
}
