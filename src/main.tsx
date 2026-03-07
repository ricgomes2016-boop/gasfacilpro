import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Auto-update: when a new SW is available, activate it immediately
registerSW({
  onNeedRefresh() {
    // Automatically reload to apply the new version
    window.location.reload();
  },
  onOfflineReady() {
    console.log("[PWA] App pronta para uso offline");
  },
  // Check for updates every 60 seconds
  immediate: true,
});

createRoot(document.getElementById("root")!).render(<App />);
