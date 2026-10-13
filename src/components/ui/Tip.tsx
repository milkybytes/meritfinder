"use client";

import { useId, useLayoutEffect, useRef, useState, type FocusEvent, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { DemandMeter } from "@/components/common/DemandMeter";

const GAP = 16; // from the pointer
const EDGE = 8; // kept clear of the window's edge

// A card that follows the pointer while it is over the element `triggerProps` is spread on (and sits under the element when it has keyboard
// focus). Render `tip` next to that element: it is drawn in a portal on <body>, so the results table's scroll box cannot clip it.
// No content, no card.
export function useHoverTip(content: ReactNode | null): { triggerProps: HTMLAttributes<HTMLElement>; tip: ReactNode } {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const id = useId();
  if (content == null) return { triggerProps: {}, tip: null };

  const follow = (e: MouseEvent) => setAt({ x: e.clientX, y: e.clientY });
  const triggerProps: HTMLAttributes<HTMLElement> = {
    onMouseEnter: follow,
    onMouseMove: follow,
    onMouseLeave: () => setAt(null),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setAt({ x: r.left + 24, y: r.bottom - GAP + 4 });
    },
    onBlur: () => setAt(null),
    tabIndex: 0,
    "aria-describedby": at ? id : undefined,
  };
  return { triggerProps, tip: at ? <TipCard id={id} at={at}>{content}</TipCard> : null };
}

function TipCard({ id, at, children }: { id: string; at: { x: number; y: number }; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Below and to the right of the pointer; flipped to the other side of it where that would run off the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = at.x + GAP + width > window.innerWidth - EDGE ? at.x - GAP - width : at.x + GAP;
    const top = at.y + GAP + height > window.innerHeight - EDGE ? at.y - GAP - height : at.y + GAP;
    el.style.left = `${Math.max(EDGE, left)}px`;
    el.style.top = `${Math.max(EDGE, top)}px`;
    el.style.visibility = "visible";
  }, [at.x, at.y]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      // As wide as its content, which sets its own width (see TipList); inline because it must not depend on a generated class.
      style={{ left: 0, top: 0, visibility: "hidden", width: "max-content", maxWidth: "calc(100vw - 16px)" }}
      className="pointer-events-none fixed z-50 border border-line bg-surface-2 text-sm text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
    >
      {children}
    </div>,
    document.body,
  );
}

export interface TipRowData {
  label: string;
  value?: string;     // right-aligned figure: a percentage, a price
  aside?: string;     // under the figure, on the right, muted: what it fetches and where, or how many spots to mine it
  mark?: boolean;     // sells in this system: full strength
  gold?: boolean;     // fetches a high price in this system: gold, with a shine
  demand?: number;    // tonnes wanted: the demand bars, under the label, on the left
  hotspot?: boolean;  // a ring hotspot: green
}

// A material that is not a hotspot (a planet's survey chance, or a ring type that yields it): a clear light blue rather than the muted grey,
// so it still reads next to the green hotspots. A hotspot is green (--good).
export const NON_HOTSPOT = "#a9c8ea";

// How a material is drawn, by what it is and whether it sells in this system: a hotspot is green and anything else light blue; one that sells
// is full strength and medium weight, one that does not is a little dimmer; one that fetches a high price (data/gold-price.ts) is gold with a shine (.gold-shine,
// globals.css), which sets its own colour. Inline colour, so it does not depend on a generated class.
export function materialStyle(hotspot: boolean, sells: boolean, gold: boolean): { className: string; style?: { color: string } } {
  if (gold) return { className: "gold-shine font-medium" };
  const tone = sells ? "font-medium" : "opacity-70";
  return hotspot ? { className: `${tone} text-good` } : { className: tone, style: { color: NON_HOTSPOT } };
}

// The usual body of a card: a heading, an optional line under it, rows, and a footnote. A row is the material and its figure (a price), then
// its demand bars under the material and a short aside under the figure. A long list goes in two columns.
export function TipList({ title, subtitle, rows, note }: { title: string; subtitle?: string; rows: TipRowData[]; note?: string }) {
  const wide = rows.length > 8;
  return (
    <div style={{ width: wide ? "min(44rem, calc(100vw - 16px))" : "min(23rem, calc(100vw - 16px))" }}>
      <div className="border-b border-line px-4 py-3">
        <div className="font-display text-base font-semibold leading-tight">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs leading-snug text-muted">{subtitle}</div>}
      </div>
      <ul className={`px-4 ${wide ? "grid grid-cols-2 gap-x-8" : ""}`.trim()}>
        {rows.map((r) => {
          const m = materialStyle(!!r.hotspot, !!r.mark, !!r.gold);
          return (
            <li
              key={r.label}
              data-mark={r.mark || undefined}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-5 gap-y-1 border-b border-line/60 py-2 last:border-b-0"
            >
              <div className={`min-w-0 break-words leading-snug ${m.className}`} style={m.style}>
                {r.label}
              </div>
              <div className={`text-right font-mono tabular-nums whitespace-nowrap ${r.mark ? "text-foreground" : "text-foreground/75"}`}>{r.value}</div>
              {(r.demand != null || r.aside) && (
                <div className="col-span-2 flex items-start justify-between gap-x-4 text-xs leading-snug text-muted">
                  <div className="flex shrink-0">{r.demand != null && <DemandMeter tonnes={r.demand} />}</div>
                  <div className="min-w-0 break-words text-right">{r.aside}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {note && <p className="border-t border-line px-4 py-2.5 text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  );
}
