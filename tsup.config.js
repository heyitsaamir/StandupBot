import { defineConfig } from "tsup";

export default defineConfig({
  // Define explicit entry points for each application
  entry: ["src/index.ts", "src/multi-agent/personal-agent/index.ts"],
  format: ["cjs"], // CommonJS format suitable for Node.js
  splitting: false, // Keep entry points as separate files
  sourcemap: true, // Generate source maps for debugging
  clean: true, // Clean the output directory before build
  dts: true, // Generate declaration files (.d.ts)
  outDir: "dist",
  noExternal: [/.*/], // This bundles all dependencies
});
