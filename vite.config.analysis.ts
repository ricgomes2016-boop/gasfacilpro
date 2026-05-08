// Configuração alternativa do Vite para análise de bundle
// Execute com: vite build --config vite.config.analysis.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: "dist/stats.html",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar dependências pesadas em chunks
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
          "map-vendor": ["leaflet", "@react-leaflet/core"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
    // Otimizações de build
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
});
