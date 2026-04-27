import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildVersion = new Date().toISOString();

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildVersion),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.js",
        registerType: "autoUpdate",
        devOptions: {
          enabled: false,
        },
        includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192x192.png", "icon-512x512.png", "og-image.png"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "gstatic-fonts-cache",
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: "Gás Fácil - Sistema de Gestão",
          short_name: "Gás Fácil",
          description: "Sistema completo de gestão para revendas de gás",
          start_url: "/",
          display: "standalone",
          background_color: "#0f172a",
          theme_color: "#2fc2b5",
          orientation: "any",
          icons: [
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
          categories: ["business", "productivity"],
          lang: "pt-BR",
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "framer-motion"],
    },
  };
});
