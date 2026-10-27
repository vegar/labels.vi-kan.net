import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works on GitHub Pages and on a custom domain.
  base: "./",
  build: { chunkSizeWarningLimit: 1000 },
});
