import { BodyImage, HotspotImage, RingedPlanetImage, RingImage } from "@/components/common/Icons";
import { describeBody, formatNumber, shortBodyName, splitRingName } from "@/lib/format";
import type { BodyRow, RingRow } from "@/lib/search/search";

const MAX_RINGS_SHOWN = 5;
const MAX_PLANETS_SHOWN = 6;
const MAX_PLANETS_LISTED = 40;

// A tree item: a trunk down the left (::before) and a branch to the item (::after), spaced by the item's own padding so the trunk is unbroken.
// Class names are written out in full because Tailwind only finds what it can read.
const TREE_ITEM =
  "relative py-[0.2rem] " +
  "before:absolute before:top-0 before:bottom-0 before:left-[-0.85rem] before:border-l before:border-[color:color-mix(in_srgb,var(--muted)_45%,transparent)] before:content-[''] " +
  "last:before:bottom-auto last:before:h-[calc(0.2rem+0.8rem)] " +
  "after:absolute after:top-[calc(0.2rem+0.8rem)] after:left-[-0.85rem] after:w-[0.7rem] after:border-t after:border-[color:color-mix(in_srgb,var(--muted)_45%,transparent)] after:content-['']";

interface RingGroup {
  parent: string | null; // the planet's full name; null for a ring whose name does not say
  rings: { ring: RingRow; label: string }[];
}

// Rings by the planet they orbit, in the order they came: "B 15 A Ring" and "B 15 B Ring" become planet "B 15" with rings "A" and "B".
function groupByPlanet(rings: RingRow[], systemName: string): RingGroup[] {
  const groups: RingGroup[] = [];
  for (const ring of rings) {
    const split = splitRingName(ring.name);
    const parent = split?.parent ?? null;
    const label = split ? `${split.letter} Ring` : shortBodyName(ring.name, systemName);
    const group = parent === null ? undefined : groups.find((g) => g.parent === parent);
    if (group) group.rings.push({ ring, label });
    else groups.push({ parent, rings: [{ ring, label }] });
  }
  return groups;
}

// What there is to mine in one system: each ringed planet with its rings and their hotspots beneath it, then landable planets with their
// signals. Long lists fold the rest. `tree` hangs the lines off the system name above.
export function MiningTargets({ rings, bodies, systemName, tree = false }: { rings: RingRow[]; bodies: BodyRow[]; systemName: string; tree?: boolean }) {
  if (rings.length === 0 && bodies.length === 0) return null;

  return (
    <ul className={`text-sm ${tree ? "ml-[0.4rem] pl-5" : "space-y-1.5"}`}>
      {groupByPlanet(rings.slice(0, MAX_RINGS_SHOWN), systemName).map((group) => (
        <li key={group.parent ?? group.rings[0].ring.name} data-ring-group className={tree ? TREE_ITEM : undefined}>
          {group.parent !== null && (
            <div className="flex items-center gap-x-2">
              <RingedPlanetImage size={14} />
              <span className="font-medium">{shortBodyName(group.parent, systemName)}</span>
            </div>
          )}
          <ul className={group.parent !== null ? "mt-0.5 space-y-0.5 pl-6" : "space-y-0.5"}>
            {group.rings.map(({ ring, label }) => (
              <RingLine key={ring.name} ring={ring} label={label} />
            ))}
          </ul>
        </li>
      ))}
      {rings.length > MAX_RINGS_SHOWN && <li className={`text-muted ${tree ? TREE_ITEM : ""}`.trim()}>+{rings.length - MAX_RINGS_SHOWN} more rings</li>}

      {bodies.slice(0, MAX_PLANETS_SHOWN).map((b) => (
        <PlanetLine key={b.bodyId} body={b} systemName={systemName} tree={tree} />
      ))}
      {bodies.length > MAX_PLANETS_SHOWN && (
        <li className={tree ? TREE_ITEM : undefined}>
          <details className="text-muted">
            <summary className="cursor-pointer select-none">+{bodies.length - MAX_PLANETS_SHOWN} more planets</summary>
            <ul className={tree ? "mt-1" : "mt-1.5 space-y-1.5"}>
              {bodies.slice(MAX_PLANETS_SHOWN, MAX_PLANETS_LISTED).map((b) => (
                <PlanetLine key={b.bodyId} body={b} systemName={systemName} />
              ))}
            </ul>
          </details>
        </li>
      )}
    </ul>
  );
}

function RingLine({ ring, label }: { ring: RingRow; label: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2" data-ring>
      <RingImage type={ring.type} size={16} className="self-center" />
      <span className="font-medium">{label}</span>
      <span className="text-muted">{ring.type ?? "?"}</span>
      {ring.hotspots.map((h) =>
        h.count == null ? (
          <span key={h.material} className="text-muted" title="No hotspot recorded: this material can be found in any ring of this type">
            {h.material}
          </span>
        ) : (
          <span key={h.material} className="inline-flex items-baseline gap-x-1 font-medium text-good" data-hotspot>
            <HotspotImage size={12} className="self-center" />
            {h.material} ×{h.count}
          </span>
        ),
      )}
      {ring.reserve && <span className="text-xs text-muted">{ring.reserve}</span>}
    </li>
  );
}

function PlanetLine({ body: b, systemName, tree = false }: { body: BodyRow; systemName: string; tree?: boolean }) {
  const { type, volcanism } = describeBody(b.subtype, b.volcanism);
  return (
    <li className={tree ? TREE_ITEM : undefined}>
      <div className="flex items-baseline gap-x-2">
        <BodyImage subtype={b.subtype} size={18} className="self-center" />
        <span className="font-medium">{shortBodyName(b.name, systemName)}</span>
        <span className="text-muted">{type}</span>
        <span className={`ml-auto ${b.miningSignals == null ? "text-muted" : "font-medium text-good"}`}>
          {b.miningSignals == null ? "unknown" : `${b.miningSignals} signals`}
        </span>
      </div>
      <div className="font-mono tabular-nums pl-[26px] text-xs text-muted">
        {volcanism && `${volcanism} · `}
        {b.gravity != null ? `${b.gravity.toFixed(2)}g` : "?g"} · {b.distanceLs != null ? `${formatNumber(Math.round(b.distanceLs))} ls` : "? ls"}
      </div>
    </li>
  );
}
