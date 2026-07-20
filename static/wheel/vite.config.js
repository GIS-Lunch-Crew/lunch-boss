import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Forge serves Custom UI resources from a non-root iframe path, so asset
// URLs must be relative — Vite's default absolute "/assets/..." paths 404.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "build",
  },
});
