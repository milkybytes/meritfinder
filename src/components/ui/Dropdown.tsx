"use client";

import { useId, useRef, useState } from "react";

import { Dot } from "./Dot";
import { FIELD, FIELD_LABEL } from "./styles";

export interface DropdownOption {
  value: string | number;
  label?: string; // defaults to the value
  dot?: string; // a colour, shown as the same marker the chip fields use
}

interface Choice {
  value: string;
  label: string;
  dot?: string;
}

// One choice from a list, in the chip fields' look instead of the browser's menu, submitted under `name` (a hidden field carries the value).
// Options are strings, numbers or { value, label }; `dots` marks some with a colour. A combobox: arrows move, Enter/Space picks, Escape closes,
// typing a letter jumps to an option.
export function Dropdown({
  name,
  label,
  options: given,
  dots = {},
  defaultValue,
  value: controlled,
  onChange,
  compact = false,
  hideLabel = false,
  className = "",
}: {
  name?: string;
  label: string;
  options: readonly (string | number | DropdownOption)[];
  dots?: Record<string, string>;
  defaultValue?: string | number; // the starting choice, when the dropdown looks after its own state
  value?: string; // or the choice, when the page does
  onChange?: (value: string) => void;
  compact?: boolean; // a smaller box that is only as wide as its text, for use in a toolbar
  hideLabel?: boolean; // the label is still the control's accessible name, just not drawn
  className?: string;
}) {
  const options: Choice[] = given.map((o) => {
    const { value, label: text = String(value), dot } = typeof o === "object" ? o : { value: o, label: undefined, dot: undefined };
    return { value: String(value), label: text, dot: dot ?? dots[String(value)] };
  });
  const [own, setValue] = useState(defaultValue === undefined ? (options[0]?.value ?? "") : String(defaultValue));
  const value = controlled ?? own;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const typed = useRef({ text: "", at: 0 });
  const selected = options.find((o) => o.value === value) ?? options[0];

  const choose = (o: Choice) => {
    setValue(o.value);
    setOpen(false);
    onChange?.(o.value);
  };
  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      setActive((a) => (e.key === "ArrowDown" ? Math.min(a + 1, options.length - 1) : Math.max(a - 1, 0)));
    } else if (e.key === "Home" || e.key === "End") {
      if (!open) return;
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // Enter must not submit the form, and Space must not scroll
      if (open) choose(options[active]);
      else show();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // type-ahead: letters typed together narrow the match, a pause starts over
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const from = open ? active : options.findIndex((o) => o.value === value);
      const order = [...options.keys()].map((i) => (i + from + (typed.current.text.length === 1 ? 1 : 0)) % options.length);
      const hit = order.find((i) => options[i].label.toLowerCase().startsWith(typed.current.text));
      if (hit !== undefined) {
        if (open) setActive(hit);
        else choose(options[hit]);
      }
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : FIELD_LABEL}>
        {label}
      </label>
      <div className="relative">
        <button
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open ? `${id}-${active}` : undefined}
          className={`${FIELD} justify-between gap-2 text-left ${compact ? "h-8! w-auto!" : ""}`.trim()}
          onClick={() => (open ? setOpen(false) : show())}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected?.dot && <Dot color={selected.dot} />}
            {selected?.label}
          </span>
          <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        {name !== undefined && <input type="hidden" name={name} value={value} />}
        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="absolute left-0 top-full z-20 mt-1 max-h-64 w-max min-w-full overflow-auto border border-line bg-surface py-1 text-sm text-foreground shadow-lg"
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1 ${i === active ? "bg-accent/15" : ""} ${o.value === value ? "text-accent" : ""}`.trim()}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus so the blur does not close the list before the pick lands
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {o.dot && <Dot color={o.dot} />}
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
