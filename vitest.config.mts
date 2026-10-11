import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vitest/config";

// Next turns an imported image into { src, width, height }; do the same, so components that import pictures run in tests.
const images: Plugin = {
  name: "image-imports",
  enforce: "pre",
  load: (id) => (/\.webp$/.test(id) ? `export default { src: ${JSON.stringify("/" + path.basename(id))}, width: 64, height: 64 };` : null),
};

export default defineConfig({
  plugins: [images],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Tests sit next to the code they test. Component tests that need a DOM say so with `// @vitest-environment jsdom`.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Process CSS modules with readable class names, so a component's class ("SVGIcon") can be asserted.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      exclude: ["**/*.test.*", "src/test/**", "**/*.d.ts"],
      reporter: ["text", "json-summary"],
    },
    css: { include: [/\.module\.css$/], modules: { classNameStrategy: "non-scoped" } },
  },
});
