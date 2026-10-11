import SVGIcon, { type SVGIconProps } from "@/components/common/Icons/SVGIcon";

import styles from "./EDLoader.module.css";

// The Elite Dangerous loading animation: 24 triangles in a hexagon, pulsing in a wave. From EDLoader1.svg on edassets.org (github.com/SpyTec/EDAssets,
// MIT), with the theme accent for the colour and the animation in a CSS module. Each entry is [ring, step, path]; a step is a position in the wave (0 to 20).
const TRIANGLES: readonly (readonly ["outer" | "inner", number, string])[] = [
  ["outer", 1, "m5,8l5,8l5,-8z"],
  ["outer", 2, "m5,8l5,-8l5,8z"],
  ["outer", 3, "m10,0l5,8l5,-8z"],
  ["outer", 4, "m15,8l5,-8l5,8z"],
  ["outer", 5, "m20,0l5,8l5,-8z"],
  ["outer", 6, "m25,8l5,-8l5,8z"],
  ["outer", 7, "m25,8l5,8l5,-8z"],
  ["outer", 8, "m30,16l5,-8l5,8z"],
  ["outer", 9, "m30,16l5,8l5,-8z"],
  ["outer", 10, "m25,24l5,-8l5,8z"],
  ["outer", 11, "m25,24l5,8l5,-8z"],
  ["outer", 13, "m20,32l5,-8l5,8z"],
  ["outer", 14, "m15,24l5,8l5,-8z"],
  ["outer", 15, "m10,32l5,-8l5,8z"],
  ["outer", 16, "m5,24l5,8l5,-8z"],
  ["outer", 17, "m5,24l5,-8l5,8z"],
  ["outer", 18, "m0,16l5,8l5,-8z"],
  ["outer", 20, "m0,16l5,-8l5,8z"],
  ["inner", 0, "m10,16l5,-8l5,8z"],
  ["inner", 3, "m15,8l5,8l5,-8z"],
  ["inner", 6, "m20,16l5,-8l5,8z"],
  ["inner", 9, "m20,16l5,8l5,-8z"],
  ["inner", 12, "m15,24l5,-8l5,8z"],
  ["inner", 15, "m10,16l5,8l5,-8z"],
];

const triangleDelayMs = (step: number): number => (step === 0 || step === 20 ? 0 : (step * 1000) / 19);

// Before its delay elapses a triangle shows its place in the wave as a static opacity (and keeps it with reduced motion).
const triangleOpacity = (step: number): number => (step >= 1 && step <= 19 ? step / 19 : 1);

export function EDLoader({ size = 96, className, ...props }: SVGIconProps) {
  return (
    <SVGIcon viewBox="0 0 40 40" size={size} variant="accent" className={className} {...props}>
      {TRIANGLES.map(([ring, step, d]) => (
        <path key={d} d={d} className={styles[ring]} style={{ animationDelay: `${triangleDelayMs(step)}ms`, opacity: triangleOpacity(step) }} />
      ))}
    </SVGIcon>
  );
}
