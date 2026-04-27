import { createRoot } from "react-dom/client";
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
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
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

createRoot(document.getElementById("root")!).render(<App />);
