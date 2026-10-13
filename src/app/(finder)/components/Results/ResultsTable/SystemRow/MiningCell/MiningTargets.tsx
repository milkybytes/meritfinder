import { BodyImage, HotspotImage, RingedPlanetImage, RingImage } from "@/components/common/Icons";
import { Badge } from "@/components/ui/Badge";
import { materialStyle, TipList, useHoverTip, type TipRowData } from "@/components/ui/Tip";
import { materialsForClass } from "@/data/body-resources";
import { goldMaterials } from "@/data/gold-price";
import { RESERVE_COLORS } from "@/data/state-colors";
import { describeBody, formatNumber, shortBodyName, splitRingName } from "@/lib/format";
import type { BodyRow, RingRow, SellableRow } from "@/lib/search/search";

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
//
// `sellable` is the system's minable commodities (what sells here). When some rings or planets can carry them, only those are listed: a ring
// or planet that cannot yield anything the system pays for is not a place to earn, so it is left out. When none can (only when mining is
// not what was asked for), everything is listed, dimmed.
export function MiningTargets({
  rings,
  bodies,
  systemName,
  sellable = [],
  tree = false,
}: {
  rings: RingRow[];
  bodies: BodyRow[];
  systemName: string;
  sellable?: SellableRow[];
  tree?: boolean;
}) {
  if (rings.length === 0 && bodies.length === 0) return null;

  const meets = new Set(sellable.filter((s) => s.meets).map((s) => s.commodity));
  const earns = (x: { carries: { material: string }[] }) => x.carries.some((c) => meets.has(c.material));
  const split = sellable.length > 0 && (rings.some(earns) || bodies.some(earns));
  const shownRings = split ? rings.filter(earns) : rings;
  const shownBodies = split ? bodies.filter(earns) : bodies;

  const ringGroups = (list: RingRow[]) =>
    groupByPlanet(list, systemName).map((group) => (
      <li key={group.parent ?? group.rings[0].ring.name} data-ring-group className={tree ? TREE_ITEM : undefined}>
        {group.parent !== null && (
          <div className="flex items-center gap-x-2">
            <RingedPlanetImage size={14} />
            <span className="font-medium">{shortBodyName(group.parent, systemName)}</span>
          </div>
        )}
        <ul className={group.parent !== null ? "mt-0.5 space-y-0.5 pl-6" : "space-y-0.5"}>
          {group.rings.map(({ ring, label }) => (
            <RingLine key={ring.name} ring={ring} label={label} sellable={sellable} />
          ))}
        </ul>
      </li>
    ));

  return (
    <ul className={`text-sm ${tree ? "ml-[0.4rem] pl-5" : "space-y-1.5"}`}>
      {ringGroups(shownRings.slice(0, MAX_RINGS_SHOWN))}
      {shownRings.length > MAX_RINGS_SHOWN && <li className={`text-muted ${tree ? TREE_ITEM : ""}`.trim()}>+{shownRings.length - MAX_RINGS_SHOWN} more rings</li>}

      {shownBodies.slice(0, MAX_PLANETS_SHOWN).map((b) => (
        <PlanetLine key={b.bodyId} body={b} systemName={systemName} sellable={sellable} tree={tree} />
      ))}
      {shownBodies.length > MAX_PLANETS_SHOWN && (
        <li className={tree ? TREE_ITEM : undefined}>
          <details className="text-muted">
            <summary className="cursor-pointer select-none">+{shownBodies.length - MAX_PLANETS_SHOWN} more planets</summary>
            <ul className={tree ? "mt-1" : "mt-1.5 space-y-1.5"}>
              {shownBodies.slice(MAX_PLANETS_SHOWN, MAX_PLANETS_LISTED).map((b) => (
                <PlanetLine key={b.bodyId} body={b} systemName={systemName} sellable={sellable} />
              ))}
            </ul>
          </details>
        </li>
      )}
    </ul>
  );
}

const NOTE_SURVEY =
  "Community survey of mining locations. A material that is not listed is very low or unknown.";

// "500,000 CR at Alpha Hub": what a material that sells in this system fetches, and where (nothing for one that does not).
const soldAt = (s: SellableRow | undefined) => (s ? `${formatNumber(s.sellPrice)} CR at ${s.station}` : undefined);

// One material on a line. Green with the hotspot mark is a ring hotspot, light blue is anything else; one that sells in this system is full
// strength (the others a little dimmer), and one that fetches a high price there is gold with a shine. Both lines (rings and planets) use it, so they
// read the same.
function Material({ name, hotspots, percent, sells, gold }: { name: string; hotspots?: number | null; percent?: number; sells: boolean; gold: boolean }) {
  const hot = hotspots != null;
  const text = materialStyle(hot, sells, gold);
  return (
    <span
      className="inline-flex items-baseline gap-x-1"
      data-hotspot={hot || undefined}
      data-sells={sells || undefined}
      data-gold={gold || undefined}
    >
      {hot && <HotspotImage size={12} className="self-center" />}
      <span className={text.className} style={text.style}>
        {name}
        {hot && ` ×${hotspots}`}
      </span>
      {percent != null && <span className="font-mono tabular-nums text-xs text-muted">{percent}%</span>}
    </span>
  );
}

function RingLine({ ring, label, sellable }: { ring: RingRow; label: string; sellable: SellableRow[] }) {
  const meets = new Set(sellable.filter((s) => s.meets).map((s) => s.commodity));
  const sold = new Set(ring.carries.map((c) => c.material).filter((m) => meets.has(m))); // sells here at the chosen price and demand
  const gold = goldMaterials(sellable); // the materials that fetch a high price in this system
  const inType = ring.carries.filter((c) => !ring.hotspots.some((h) => h.material === c.material)); // yielded by the ring's type, no hotspot recorded
  const dim = sellable.length > 0 && sold.size === 0;

  // What to show: a hotspot recorded here, or a material this ring can yield that some station pays for. One below the chosen minimum price
  // or demand is shown too, dimmed, with its price; the rest of the ring's type has no hotspot and no price, so it is left out.
  const hotspotCount = (material: string) => ring.hotspots.find((h) => h.material === material)?.count;
  const names = [...new Set([...ring.hotspots.filter((h) => h.count != null).map((h) => h.material), ...ring.carries.map((c) => c.material)])];
  const rows: TipRowData[] = names
    .map((material) => {
      const count = hotspotCount(material);
      const sale = sellable.find((s) => s.commodity === material);
      return {
        label: material,
        value: count != null ? `${count} ${count === 1 ? "hotspot" : "hotspots"}` : undefined,
        aside: soldAt(sale),
        mark: sold.has(material),
        gold: gold.has(material),
        demand: sale?.demand,
        hotspot: count != null,
      };
    })
    .sort((a, b) => Number(!!b.mark) - Number(!!a.mark) || Number(!!b.value) - Number(!!a.value) || a.label.localeCompare(b.label));
  const { triggerProps, tip } = useHoverTip(
    rows.length ? (
      <TipList
        title={`${ring.type ?? "Unknown"} ring`}
        subtitle="What is in this ring. Dimmer: below your minimum price or demand here, or nothing pays for it. Gold: sells for a high price."
        rows={rows}
        note="A material with no hotspot recorded here may simply not have been scanned yet."
      />
    ) : null,
  );
  // On the line: every hotspot (dimmed when it does not earn), and what the ring's type yields that does.
  const shown = [
    ...ring.hotspots.map((h) => ({ material: h.material, count: h.count })),
    ...inType.filter((c) => sold.has(c.material)).map((c) => ({ material: c.material, count: null })),
  ];

  return (
    <li className={`rounded-sm hover:bg-accent/10 focus-visible:bg-accent/10 focus-visible:outline-none ${dim ? "opacity-55" : ""}`.trim()} data-ring data-dim={dim || undefined} {...triggerProps}>
      <div className="flex items-center gap-x-2">
        <RingImage type={ring.type} size={16} className="self-center" />
        <span className="font-medium">{label}</span>
        <span className="text-muted">{ring.type ?? "?"}</span>
        {ring.reserve && (
          <span className="ml-auto" data-reserve>
            <Badge color={RESERVE_COLORS[ring.reserve] ?? "var(--muted)"}>{ring.reserve}</Badge>
          </span>
        )}
      </div>
      {shown.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 pl-6 text-sm">
          {shown.map((m) => (
            <Material key={m.material} name={m.material} hotspots={m.count} sells={sold.has(m.material)} gold={gold.has(m.material)} />
          ))}
        </div>
      )}
      {tip}
    </li>
  );
}

function PlanetLine({ body: b, systemName, sellable, tree = false }: { body: BodyRow; systemName: string; sellable: SellableRow[]; tree?: boolean }) {
  const { type, volcanism } = describeBody(b.subtype, b.volcanism);
  const meets = new Set(sellable.filter((s) => s.meets).map((s) => s.commodity));
  const sold = new Set(b.carries.map((c) => c.material).filter((m) => meets.has(m))); // sells here at the chosen price and demand
  const dim = sellable.length > 0 && sold.size === 0;
  const gold = goldMaterials(sellable); // the materials that fetch a high price in this system

  // What the body can hold that some station here pays for (one below the chosen minimum is shown dimmed, with its price). When nothing is
  // known to sell, everything it can hold.
  const rows: TipRowData[] = b.bodyClass
    ? materialsForClass(b.bodyClass)
        .filter((m) => sellable.length === 0 || sellable.some((s) => s.commodity === m.material))
        .map((m) => ({
          label: m.material,
          value: `${m.percent}%`,
          aside: soldAt(sellable.find((s) => s.commodity === m.material)),
          mark: sold.has(m.material),
          gold: gold.has(m.material),
          demand: sellable.find((s) => s.commodity === m.material)?.demand,
        }))
    : [];
  rows.sort((a, c) => Number(!!c.mark) - Number(!!a.mark)); // what sells here first (the sort is stable, so the rest stay by chance)
  const { triggerProps, tip } = useHoverTip(
    rows.length ? (
      <TipList
        title={volcanism ? `${type} · ${volcanism}` : type}
        subtitle="Chance a mining location shows each material that sells here. Dimmer: below your minimum price or demand. Gold: sells for a high price."
        rows={rows}
        note={NOTE_SURVEY}
      />
    ) : null,
  );

  return (
    <li className={tree ? TREE_ITEM : undefined} data-dim={dim || undefined}>
      <div className={`rounded-sm hover:bg-accent/10 focus-visible:bg-accent/10 focus-visible:outline-none ${dim ? "opacity-55" : ""}`.trim()} {...triggerProps}>
        <div className="flex items-center gap-x-2">
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
        {sold.size > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 pl-[26px] text-sm" data-carries>
            {b.carries
              .filter((c) => sold.has(c.material))
              .map((c) => (
                <Material key={c.material} name={c.material} percent={c.percent} sells gold={gold.has(c.material)} />
              ))}
          </div>
        )}
        {tip}
      </div>
    </li>
  );
}
