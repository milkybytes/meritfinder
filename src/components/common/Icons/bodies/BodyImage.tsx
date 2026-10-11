import Image from "next/image";

import { describeBody } from "@/lib/format";

import highMetalContent from "./high-metal-content-world.webp";
import icyBody from "./icy-body.webp";
import metalRich from "./metal-rich-body.webp";
import rockyBody from "./rocky-body.webp";
import rockyIce from "./rocky-ice-world.webp";

// The five landable body types, by the name Spansh gives them. The survey's volcanic groups are not types of
// their own: a rocky body with magma is still a rocky body, so it gets the rocky picture.
const BODY_IMAGES = {
  "Rocky body": rockyBody,
  "Rocky Ice world": rockyIce,
  "Icy body": icyBody,
  "High metal content world": highMetalContent,
  "Metal-rich body": metalRich,
} as const;

// A soft light-blue glow, like an atmosphere, so the small pictures stand out on the page.
const GLOW = "drop-shadow-[0_0_4px_rgb(125_211_252/0.6)]";

// A picture of a landable body type, labelled with the type. Renders nothing for a type with no picture; decorative unless given `alt`.
export function BodyImage({ subtype, size = 20, alt = "", className }: { subtype: string | null | undefined; size?: number; alt?: string; className?: string }) {
  const image = subtype ? BODY_IMAGES[subtype as keyof typeof BODY_IMAGES] : undefined;
  if (!image) return null;
  return <Image src={image} width={size} height={size} alt={alt} title={describeBody(subtype, null).type} className={`${GLOW} ${className ?? ""}`.trim()} unoptimized />;
}
