"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Dot } from "./Dot";
import { FIELD_LABEL, FIELD_MULTI } from "./styles";

// A selected value, and the muted "Any" shown when nothing is selected.
const CHIP = "inline-flex shrink-0 items-center gap-[0.35rem] rounded-[3px] border text-[0.875rem]";
const CHIP_SELECTED = "border-accent/45 bg-accent/14 py-[0.1rem] pr-[0.2rem] pl-[0.55rem] text-foreground";
const CHIP_ANY = "border-line bg-muted/14 py-[0.1rem] pr-[0.6rem] pl-[0.55rem] text-muted";

// Multi-value picker: selected values are removable chips, submitted as repeated hidden inputs (name=a&name=b); nothing selected shows a muted "Any".
// The field is one line in the form; while focused it grows over what is below and its option list hangs from it.
export function ChipSelect({
  name,
  label,
  options,
  initial = [],
  anyLabel = "Any",
  dots = {},
}: {
  name: string;
  label: string;
  options: string[];
  initial?: string[];
  anyLabel?: string;
  dots?: Record<string, string>; // optional colour dot per option
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !selected.includes(o) && (!q || o.toLowerCase().includes(q))).slice(0, 50);
  }, [options, selected, query]);

  const add = (v: string) => {
    setSelected((s) => (s.includes(v) ? s : [...s, v]));
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };
  const remove = (v: string) => setSelected((s) => s.filter((x) => x !== v));
  const clear = () => {
    setSelected([]);
    setQuery("");
    inputRef.current?.focus();
  };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && matches[active]) {
        e.preventDefault(); // pick the option, don't submit the form
        add(matches[active]);
      }
    } else if (e.key === "Backspace" && !query && selected.length) {
      remove(selected[selected.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="relative h-10">
        <div className="group absolute inset-x-0 top-0 z-10 focus-within:z-20">
          <div data-field className={FIELD_MULTI} onClick={() => inputRef.current?.focus()}>
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden [mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)] group-focus-within:flex-wrap group-focus-within:overflow-visible group-focus-within:[mask-image:none]">
              {selected.length === 0 && <span className={`${CHIP} ${CHIP_ANY}`}>{anyLabel}</span>}
              {selected.map((v) => (
                <span key={v} className={`${CHIP} ${CHIP_SELECTED}`}>
                  {dots[v] && <Dot color={dots[v]} />}
                  {v}
                  <button
                    type="button"
                    aria-label={`Remove ${v}`}
                    className="inline-flex size-[1.15rem] items-center justify-center leading-none text-muted hover:bg-foreground/18 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(v);
                    }}
                  >
                    ×
                  </button>
                  <input type="hidden" name={name} value={v} />
                </span>
              ))}
              <input
                ref={inputRef}
                value={query}
                placeholder={selected.length ? "" : "Add…"}
                className="min-w-[4rem] flex-1 bg-transparent px-1 text-sm text-foreground outline-none"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
              />
            </div>
            {selected.length > 0 && (
              <button
                type="button"
                aria-label={`Clear ${label}`}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the box, so the field stays open for the click
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
                className="hidden shrink-0 self-center px-1 font-display text-[0.75rem] uppercase tracking-[0.1em] text-muted hover:text-foreground group-focus-within:block"
              >
                Clear
              </button>
            )}
          </div>
          {open && matches.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto border border-line bg-surface py-1 text-sm text-foreground shadow-lg">
              {matches.map((o, i) => (
                <li
                  key={o}
                  className={`cursor-pointer px-3 py-1 ${i === active ? "bg-accent/15" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus so blur doesn't close before the click lands
                    add(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  {dots[o] && <Dot color={dots[o]} className="mr-2" />}
                  {o}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
