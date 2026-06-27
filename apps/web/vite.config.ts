import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    // Produce dist/stats.html on every build for ongoing bundle-size monitoring (AC-20).
    // No CI gate — local inspection only (Q3 default).
    visualizer({
      filename: "dist/stats.html",
      template: "list",
      gzipSize: true,
      brotliSize: false,
    }),
    // AC-21: drop tabler-icons .ttf and .woff from the bundle — only .woff2 ships.
    // The trimmed @font-face references woff2 only, but Vite's static analysis of
    // the source CSS still emits the other formats. Prune them at the emit stage.
    {
      name: 'prune-tabler-non-woff2',
      generateBundle(_opts, bundle) {
        for (const fileName of Object.keys(bundle)) {
          if (/tabler-icons.*\.(ttf|woff)$/.test(fileName)) {
            delete bundle[fileName]
          }
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    exclude: ["e2e/**", "node_modules/**"],
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
  build: {
    // Restore the default warning threshold so oversized chunks are surfaced (AC-19).
    // Manual chunking below keeps the main entry under this limit.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
      output: {
        // Split heavy, detail-view-only dependencies out of the main entry (AC-14,15).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          // Markdown rendering pipeline (react-markdown + remark + rehype)
          if (
            /[\\/]node_modules[\\/](react-markdown|remark-|rehype-|unified|micromark|mdast-|hast-|unist-|vfile|character-|decode-named-character-|html-url-|trim-|stringify-|trough|bail|is-plain-obj|comma-separated-tokens|space-separated-tokens|property-information|estree-)[\\/]/.test(
              id,
            )
          ) {
            return 'markdown-react'
          }
          // marked + dompurify (HTML sanitizer path)
          if (/[\\/]node_modules[\\/](marked|dompurify)[\\/]/.test(id)) {
            return 'marked-dompurify'
          }
          // highlight.js (code syntax highlighting)
          if (/[\\/]node_modules[\\/]highlight\.js[\\/]/.test(id)) {
            return 'highlight'
          }
          // KaTeX (math formula rendering)
          if (/[\\/]node_modules[\\/]katex[\\/]/.test(id)) {
            return 'katex'
          }
          // recharts (charting)
          if (/[\\/]node_modules[\\/](recharts|d3-|victory-vendor|internmap|robust-predicates|delaunator)[\\/]/.test(id)) {
            return 'recharts'
          }
          return undefined
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // AC-30: strip console.log/debug in production builds; keep console.warn/error for diagnostics.
  // `pure` marks these calls as side-effect-free so esbuild removes them during minification.
  esbuild: {
    pure: ['console.log', 'console.debug'],
    drop: ['debugger'],
  },
  // 2. Electron host expects a fixed renderer port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore generated workspace skill folders
      ignored: ["**/.claude/**"],
    },
  },
}));
