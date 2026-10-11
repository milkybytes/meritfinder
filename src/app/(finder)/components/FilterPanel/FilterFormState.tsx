"use client";

import { createContext, Fragment, useContext, useState, type ReactNode } from "react";

import type { MiningMethod } from "@/data/mining-methods";
import { useRememberFilters } from "@/hooks/useRememberFilters";

// The filter form's client state, shared by fields in separate branches: the mining method (set by the tabs, read by Market and Mining), and
// rebuild (Reset: fields keep what was typed, so putting them back means new ones). Also remembers the last search.
interface FormState {
  method: MiningMethod;
  setMethod: (m: MiningMethod) => void;
  rebuild: () => void;
}

const Ctx = createContext<FormState>({ method: "any", setMethod: () => {}, rebuild: () => {} });

export function FilterFormState({ method: initialMethod, children }: { method: MiningMethod; children: ReactNode }) {
  useRememberFilters();
  const [method, setMethod] = useState(initialMethod);
  const [generation, setGeneration] = useState(0);
  const rebuild = () => {
    setMethod(initialMethod);
    setGeneration((g) => g + 1);
  };

  return (
    <Ctx.Provider value={{ method, setMethod, rebuild }}>
      <Fragment key={generation}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export const useMethod = (): [MiningMethod, (m: MiningMethod) => void] => {
  const { method, setMethod } = useContext(Ctx);
  return [method, setMethod];
};
export const useRebuildForm = () => useContext(Ctx).rebuild;
