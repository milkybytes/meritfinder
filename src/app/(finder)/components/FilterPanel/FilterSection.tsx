import type { ReactNode } from "react";

import type { SearchParams, SearchInfo } from "@/lib/search/search";

// What every section of the filter form is given: the current search, and what the database can offer.
export interface SectionProps {
  params: SearchParams;
  info: SearchInfo;
}

// A titled group of related fields: "// POWERPLAY", "// MARKET"...
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 font-display text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-accent before:opacity-60 before:content-['//_']">{title}</legend>
      {children}
    </fieldset>
  );
}
