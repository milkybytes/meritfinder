"use client";

import { FIELD_LABEL } from "@/components/ui/styles";
import { METHODS } from "@/data/mining-methods";

import { useMethod } from "../FilterFormState";

const TAB =
  "cursor-pointer border px-[0.9rem] py-[0.4rem] font-display text-[0.78rem] uppercase tracking-[0.08em] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent";
const TAB_IDLE = "border-line bg-surface-2 text-muted hover:text-foreground";
const TAB_ACTIVE = "border-accent bg-accent font-bold text-[#0b0908]";

// The mining methods as tabs (a radio group, so the choice is submitted with the form), with a line on the chosen one.
export function MethodTabs() {
  const [method, setMethod] = useMethod();
  const info = METHODS.find((m) => m.id === method)!;

  return (
    <div>
      <div className={`${FIELD_LABEL} mb-1.5`}>Mining method</div>
      <div className="inline-flex flex-wrap gap-1" role="radiogroup">
        {METHODS.map((m) => (
          <label key={m.id} className={`${TAB} ${method === m.id ? TAB_ACTIVE : TAB_IDLE}`} data-active={method === m.id}>
            <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
            {m.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{info.blurb}</p>
    </div>
  );
}
