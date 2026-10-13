import fs from "node:fs";

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterAll, describe, expect, it } from "vitest";

import { buildFixtureDb } from "@/test/galaxy";

import { FilterPanel } from "./components/FilterPanel/FilterPanel";
import { DatabaseProblem } from "./components/DatabaseNotice/DatabaseProblem";
import Home from "./page";

const { file, dir } = buildFixtureDb();
process.env.MERITFINDER_DB = file;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

// The FilterPanel element somewhere in the tree the page returns.
function findPanel(node: ReactNode): ReactElement | undefined {
  if (!isValidElement(node)) return Array.isArray(node) ? node.map(findPanel).find(Boolean) : undefined;
  if (node.type === FilterPanel) return node;
  return findPanel((node.props as { children?: ReactNode }).children);
}
// Every list of children in the tree, to check that no two siblings share a key (React duplicates elements when they do).
function siblingKeyProblems(node: ReactNode, path = "page"): string[] {
  if (Array.isArray(node)) {
    const keys = node.filter(isValidElement).map((n) => n.key).filter((k) => k !== null);
    const repeated = keys.filter((k, i) => keys.indexOf(k) !== i);
    return [...(repeated.length ? [`${path}: repeated key ${repeated[0]}`] : []), ...node.flatMap((n, i) => siblingKeyProblems(n, `${path}[${i}]`))];
  }
  if (!isValidElement(node)) return [];
  const own = (node.props as { children?: ReactNode }).children;
  const children = Array.isArray(own) ? own : [own];
  const keys = children.filter(isValidElement).map((n) => (n as ReactElement).key).filter((k) => k !== null);
  const repeated = keys.filter((k, i) => keys.indexOf(k) !== i);
  return [...(repeated.length ? [`${path}: repeated key ${repeated[0]}`] : []), ...children.flatMap((n, i) => siblingKeyProblems(n, `${path}>${i}`))];
}

const panelKey = async (query: Record<string, string>) => findPanel(await Home({ searchParams: Promise.resolve(query) }))?.key;

describe("the page", () => {
  it("never gives two siblings the same key, which would make React show a second copy of the form after a search", async () => {
    for (const query of [{}, { ref: "Sol" }, { ref: "Sol", range: "70", goal: "reinforce" }]) {
      expect(siblingKeyProblems(await Home({ searchParams: Promise.resolve(query) })), JSON.stringify(query)).toEqual([]);
    }
  });

  it("rebuilds the filter form whenever the search in the address changes, so its fields show what was searched", async () => {
    const keys = await Promise.all([{}, { reset: "1" }, { ref: "Sol" }, { ref: "Sol", range: "300" }, { ref: "Sirius" }].map((q) => panelKey(q as Record<string, string>)));
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length); // Reset, Back, a restored or shared search: each is a different form
  });

});

describe("the page when the database can't be read", () => {
  it("shows the database notice instead of failing", async () => {
    const previous = process.env.MERITFINDER_DB;
    const broken = file + ".broken";
    fs.writeFileSync(broken, "not a database ".repeat(1000));
    process.env.MERITFINDER_DB = broken;
    try {
      const tree = (await Home({ searchParams: Promise.resolve({}) })) as ReactElement<{ state: string }>;
      expect(tree.type).toBe(DatabaseProblem);
      expect(tree.props.state).toBe("unreadable");
    } finally {
      process.env.MERITFINDER_DB = previous;
      fs.rmSync(broken, { force: true });
    }
  });
});
