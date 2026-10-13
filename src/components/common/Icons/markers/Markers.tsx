import Image from "next/image";

import { glow } from "../glow";

import hotspot from "./hotspot.svg";

const GLOW = glow("rgb(251 146 60)", 1, 0.3);

// A hotspot: marks a mineral that has one in the ring, as opposed to one that is only somewhere in a ring of that type.
export function HotspotImage({ size = 12, alt = "", className }: { size?: number; alt?: string; className?: string }) {
  return <Image src={hotspot} width={size} height={size} alt={alt} title="Hotspot" className={className} style={GLOW} unoptimized />;
}
