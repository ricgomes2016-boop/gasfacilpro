import { APP_BUILD_ID } from "@/lib/app-build";

const WAITING_WORKER_TIMEOUT_MS = 1800;

async function activateWaitingWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }

  const installingWorker = registration.installing;
  if (!installingWorker) return;

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, WAITING_WORKER_TIMEOUT_MS);

    installingWorker.addEventListener("statechange", () => {
      if (
        registration.waiting ||
        installingWorker.state === "activated" ||
        installingWorker.state === "redundant"
      ) {
        window.clearTimeout(timeout);
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        resolve();
      }
    });
  });
}

export async function forceAppUpdate() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
      await registration.update();
      await activateWaitingWorker(registration);
    }
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("build", APP_BUILD_ID);
  window.location.replace(nextUrl.toString());
}