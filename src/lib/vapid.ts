// Chave pública VAPID — pareada com VAPID_PRIVATE_KEY (secret) no servidor.
export const VAPID_PUBLIC_KEY =
  "BJnpqpoCph8LLsYCLBBTFxpJpAbDoFODpr3diJC-14ehvnadLdHVtKer8mSv8aQjKySPGBeSc-H_p8re4zQwQco";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
