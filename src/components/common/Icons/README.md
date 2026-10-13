# Icons

Icons are small React components that draw shape only: no size, no colour. The place that uses one sizes it, and
`SVGIcon.module.css` colours every icon.

```
Icons/
  SVGIcon.tsx          the base: an <svg> with a viewBox, sized by `size` or `className`
  SVGIcon.module.css   the only place icon colours live
  StationIcon.tsx      Spansh station type -> icon, labelled with the type
  stations/            station, settlement, surface port and megaship shapes
  bodies/              pictures (webp) of the five landable body types, and BodyImage
  asteroids/           pictures (webp) of the four ring types, and RingImage
  markers/             a ringed planet (drawn as an icon, in the text colour) and a hotspot (an svg picture): RingedPlanetImage, HotspotImage
  index.ts             what the rest of the app imports
```

```tsx
import { BodyImage, RingImage, StationIcon } from "@/components/common/Icons";

<StationIcon type="Coriolis Starport" size={16} />   // by Spansh type; labelled; nothing for unmapped types
<BodyImage subtype="Icy body" size={16} />           // by Spansh body type
<RingImage type="Metal Rich" size={16} />            // by Spansh ring type
<RingedPlanetImage size={16} />                      // heads a planet's rings in a list
<HotspotImage size={12} />                           // beside a mineral the ring has a hotspot for
```

- A shape never hard-codes a size: use `size={16}` or `className="h-4 w-4"`.
- `variant`: `"accent"` draws in the theme colour, `"glow"` is white with a soft glow (the stations' style).
- Icons are decorative (`aria-hidden`) unless you pass `aria-label`.
- A shape that needs a second tone carries a marker attribute (`data-stroke`, `data-accent`, `data-accent-stroke`), and
  `SVGIcon.module.css` gives each a colour.
- To show a new station type, add it to `STATION_ICONS` in `StationIcon.tsx`. To add a body or ring picture, name the
  file for the type and add it to `BODY_IMAGES` or `RING_IMAGES`.
