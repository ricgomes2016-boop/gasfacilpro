import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import "./styles/theme-contador.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  const clearPreviewCache = async () => {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((registrations ?? []).map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      const resetKey = "gasfacil-preview-cache-reset-v2";
      const alreadyReset = sessionStorage.getItem(resetKey) === "1";
      if (!alreadyReset && navigator.serviceWorker?.controller) {
        sessionStorage.setItem(resetKey, "1");
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("previewRefresh", Date.now().toString());
        window.location.replace(nextUrl.toString());
      }
    } catch (error) {
      console.warn("[PWA] Não foi possível limpar o cache do preview", error);
    }
  };

  void clearPreviewCache();
} else {
  registerSW({
    onNeedRefresh() {
      window.location.reload();
    },
    onOfflineReady() {
      console.log("[PWA] App pronta para uso offline");
    },
    immediate: true,
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
