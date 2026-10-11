"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { FIELD_LABEL } from "@/components/ui/styles";
import { FILTERS_STORAGE_KEY } from "@/hooks/useRememberFilters";

import { useRebuildForm } from "./FilterFormState";

// Starts over: forgets the remembered search and empties the form. From a page with a search it goes to the plain address; on the plain
// address it rebuilds the form in place.
export function ResetLink() {
  const rebuildForm = useRebuildForm();
  const onPlainAddress = useSearchParams().toString() === "";

  return (
    <Link
      href="/"
      className={`${FIELD_LABEL} underline underline-offset-4 hover:text-foreground`}
      onClick={(e) => {
        try {
          localStorage.removeItem(FILTERS_STORAGE_KEY); // before the page loads, or it would bring the old search straight back
        } catch {
          // storage unavailable: nothing was remembered
        }
        if (onPlainAddress) {
          e.preventDefault();
          rebuildForm();
        }
      }}
    >
      Reset
    </Link>
  );
}
