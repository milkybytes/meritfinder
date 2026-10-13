import SVGIcon, { type SVGIconProps } from "../SVGIcon";

// The picture's own proportions (236 x 112 units): wider than tall.
const ASPECT = 236.37347 / 112.15543;

// A soft glow in the text colour, so the thin ring reads on a dark page (class names are written out in full for Tailwind).
const GLOW = "drop-shadow-[0_0_3px_color-mix(in_srgb,currentColor_60%,transparent)]";

// A planet with a ring, in the text colour (one shape colour, like the station icons). The planet is cut where the ring passes in front
// of it, so it reads in a single colour. Heads a planet's rings in a list, so a ring is never mistaken for the planet or a moon.
export function RingedPlanetImage({ size = 16, alt, className, ...props }: Omit<SVGIconProps, "viewBox" | "children"> & { size?: number; alt?: string }) {
  return (
    <SVGIcon
      viewBox="0 0 236.37347 112.15543"
      style={{ width: `${(size * ASPECT).toFixed(1)}px`, height: `${size}px` }}
      className={`${GLOW} ${className ?? ""}`.trim()}
      aria-label={alt || undefined}
      {...props}
    >
      <title>Ringed planet</title>
      <g transform="translate(13.186714,-62.197754)">
        <path d="m 111.53118,62.197754 a 56.077793,56.077793 0 0 0 -56.077717,56.077716 56.077793,56.077793 0 0 0 9.607165,31.38826 c 14.190365,-1.89979 30.07104,-4.80798 46.679842,-8.68732 20.83313,-4.86604 39.90984,-10.58221 55.51082,-16.37678 a 56.077793,56.077793 0 0 0 0.3576,-6.32416 56.077793,56.077793 0 0 0 -56.07771,-56.077716 z m 53.9967,71.212706 c -16.02489,5.48538 -34.47962,10.77742 -54.31296,15.40991 -14.052,3.28214 -27.650541,5.96619 -40.383068,8.03362 a 56.077793,56.077793 0 0 0 40.699328,17.49919 56.077793,56.077793 0 0 0 53.9967,-40.94272 z" />
        <path d="m 167.02621,130.92431 a 121.2236,23.204197 0 0 0 -31.45755,-5.49504 57.920809,59.172762 45.000007 0 1 0.64116,2.9288 105.45789,20.186382 0 0 1 20.67925,3.90161 105.45789,20.186382 0 0 1 21.79231,12.2886 105.45789,20.186382 0 0 1 -105.457509,20.18601 105.45789,20.186382 0 0 1 -105.457989,-20.1863 105.45789,20.186382 0 0 1 54.310351,-17.65313 57.920809,59.172762 45.000007 0 1 0.922317,-3.1645 121.2236,23.204197 0 0 0 -73.369079,21.31984 121.2236,23.204197 0 0 0 121.223473,23.2041 121.2236,23.204197 0 0 0 121.223656,-23.20415 121.2236,23.204197 0 0 0 -25.05039,-14.12584 z" transform="matrix(0.97378996,-0.22744914,0.24821809,0.96870418,0,0)" />
      </g>
    </SVGIcon>
  );
}
