import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildVersion = new Date().toISOString();
  const env = loadEnv(mode, process.cwd(), "");
  const currentSupabaseUrl = "https://gcrdftnnbgsogoqcmcxo.supabase.co";
  const legacySupabaseProjectId = "scqenurznkatvrqxqjmt";
  const viteSupabaseUrl =
    env.VITE_SUPABASE_URL?.includes(legacySupabaseProjectId) ? undefined : env.VITE_SUPABASE_URL;
  const supabaseUrl = env.SUPABASE_URL || viteSupabaseUrl || currentSupabaseUrl;
  const supabasePublishableKey =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXAiOiJnY3JkZnRubmJnc29nb3FjbWN4byIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwNjUwNDU0LCJleHAiOjIwODYyMjY0NTR9.q4XxAd-BWI5OfPE-LdNuZdT_mnU4PxxMUSOKEGM7Wd8";
  const projectIdFromUrl = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const viteProjectId =
    env.VITE_SUPABASE_PROJECT_ID === legacySupabaseProjectId ? undefined : env.VITE_SUPABASE_PROJECT_ID;
  const supabaseProjectId =
    env.SUPABASE_PROJECT_ID ||
    projectIdFromUrl ||
    viteProjectId ||
    "gcrdftnnbgsogoqcmcxo";

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildVersion),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        strategies: "injectManifest",
        injectManifest: {
          rollupFormat: "iife",
        },
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
