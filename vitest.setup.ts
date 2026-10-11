import { afterEach } from "vitest";

// React Testing Library only needs cleaning up between tests in the DOM environment (jsdom). Importing it is
// avoided elsewhere so tests in the node environment don't load it.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
