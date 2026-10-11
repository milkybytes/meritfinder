"use client";

import { useId, useRef, useState } from "react";

import { PowerName } from "@/components/common/PowerName";
import { FIELD, FIELD_LABEL } from "@/components/ui/styles";
import { MIN_CHARS, useSystemSuggestions, type Suggestion } from "@/hooks/useSystemSuggestions";

// The reference-system box. As you type it offers matching systems (from /api/systems) to pick from; you can also just
// type the whole name and search. A combobox: arrow keys move through the list, Enter picks, Escape closes.
export function SystemInput({ name, label, defaultValue, placeholder }: { name: string; label: string; defaultValue: string; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const listId = `${id}-list`;
  const focused = useRef(false);
  const { lookup, cancel } = useSystemSuggestions(show);

  function show(list: Suggestion[], typed: string) {
    setItems(list);
    setActive(-1);
    // a single suggestion that is exactly what is typed has nothing to add
    setOpen(focused.current && list.length > 0 && !(list.length === 1 && list[0].name.toLowerCase() === typed.toLowerCase()));
  }

  function pick(s: Suggestion) {
    cancel();
    setValue(s.name);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          value={value}
          required
          autoComplete="off"
          placeholder={placeholder}
          className={FIELD}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            lookup(e.target.value);
          }}
          onFocus={() => {
            focused.current = true;
            if (items.length > 0 && value.trim().length >= MIN_CHARS) setOpen(true);
          }}
          onBlur={() => {
            focused.current = false;
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              if (items.length === 0) return;
              e.preventDefault();
              setOpen(true);
              setActive((i) => (e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length : i) - 1));
            } else if (e.key === "Enter" && open && active >= 0) {
              e.preventDefault(); // choose the highlighted system; do not submit the form yet
              pick(items[active]);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              setOpen(false);
            }
          }}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto border border-line bg-surface py-1 text-sm text-foreground shadow-lg"
          >
            {items.map((s, i) => (
              <li
                key={s.name}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1 ${i === active ? "bg-accent/15" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus in the box
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{s.name}</span>
                {s.power && <PowerName name={s.power} small />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
