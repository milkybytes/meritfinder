import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY, themeMap } from "@/data/powers";

import RootLayout from "./layout";

vi.mock("next/font/google", () => {
  const font = () => ({ variable: "font-var" });
  return { Barlow: font, Chakra_Petch: font, JetBrains_Mono: font };
});
const requestHeaders = new Map<string, string>();
vi.mock("next/headers", () => ({ headers: async () => ({ get: (name: string) => requestHeaders.get(name) ?? null }) }));

beforeEach(() => requestHeaders.clear());
const render = async () => renderToStaticMarkup(await RootLayout({ children: <p>page body</p> } as never));

describe("RootLayout", () => {
  it("gives its inline theme script the nonce the proxy issued, which is the only way the Content Security Policy lets it run", async () => {
    requestHeaders.set("x-nonce", "n0nce-123");
    expect(await render()).toMatch(/<script nonce="n0nce-123">/);
  });

  it("applies the saved theme before first paint: the script knows the storage key and every power's theme", async () => {
    const html = await render();
    expect(html).toContain(JSON.stringify(THEME_STORAGE_KEY));
    for (const name of Object.keys(themeMap())) expect(html, name).toContain(JSON.stringify(name));
  });

});
