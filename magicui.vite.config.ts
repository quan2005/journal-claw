import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/lib/sandbox/magicui/bootstrap.tsx"),
      name: "MagicUI",
      formats: ["iife"],
      fileName: () => "magicui.bundle.js",
    },
    rollupOptions: {
      // Bundle everything — no external dependencies in the iframe
      external: [],
    },
    outDir: path.resolve(__dirname, "src/lib/sandbox/magicui/dist"),
    // Don't clear the dist dir since the CSS output goes there too
    emptyOutDir: false,
  },
})
