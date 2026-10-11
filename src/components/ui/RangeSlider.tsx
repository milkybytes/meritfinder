"use client";

import { useState } from "react";

import { FIELD_LABEL, NO_SPINNER } from "./styles";

// A slider whose readout is also a box to type the number into. Typing moves the slider; a value outside min..max is
// held to the nearest end when you leave the box. Only the slider is submitted.
export function RangeSlider({
  name,
  label,
  min,
  max,
  initial,
  unit,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  initial: number;
  unit: string;
}) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState<string | null>(null); // what is being typed, while it is
  const clamp = (n: number) => Math.min(Math.max(Math.round(n), min), max);

  const type = (text: string) => {
    setDraft(text);
    if (text.trim() !== "" && Number.isFinite(Number(text))) setValue(clamp(Number(text)));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${FIELD_LABEL} flex items-center justify-between gap-2`}>
        <span>{label}</span>
        <span className="-my-1.5 flex items-center gap-1.5 normal-case tracking-normal">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            aria-label={`${label} (${unit})`}
            value={draft ?? value}
            onChange={(e) => type(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setDraft(null); // Enter submits the form with the number shown
            }}
            className={`h-7 w-[4.5rem] rounded-sm border border-line bg-surface-2 px-1.5 text-right font-mono text-sm tabular-nums text-accent ${NO_SPINNER}`}
          />
          <span className="text-sm text-muted">{unit}</span>
        </span>
      </div>
      <input
        name={name}
        type="range"
        className="h-10 w-full accent-accent"
        min={min}
        max={max}
        step={1}
        aria-label={label}
        value={value}
        onChange={(e) => {
          setDraft(null);
          setValue(Number(e.target.value));
        }}
      />
    </div>
  );
}
