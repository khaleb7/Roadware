import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  // Serves /assets contents at site root (svg/, manifest.json) for Vite + Electron dist
  publicDir: path.resolve(rootDir, "assets"),
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@data": path.resolve(rootDir, "data"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/release/**", "**/dist/**", "**/dist-electron/**"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
