export type AppScope =
  | "erp"
  | "atendimento"
  | "entregador"
  | "vendedor"
  | "cliente"
  | "parceiro"
  | "transportadora"
  | "contador";

export function getRuntimeAppScope(): AppScope {
  if (typeof window === "undefined") return "erp";

  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();

  if (host.startsWith("entregador.") || path.startsWith("/entregador")) return "entregador";
  if (host.startsWith("vendedor.") || path.startsWith("/vendedor")) return "vendedor";
  if (host.startsWith("cliente.") || path.startsWith("/cliente")) return "cliente";
  if (host.startsWith("parceiro.") || path.startsWith("/parceiro")) return "parceiro";
  if (host.startsWith("transportadora.") || path.startsWith("/transportadora")) return "transportadora";
  if (host.startsWith("contador.") || path.startsWith("/contador")) return "contador";
  if (path.startsWith("/atendimento")) return "atendimento";

  return "erp";
}

export function getRuntimePortalHost() {
  if (typeof window === "undefined") return null;
  return window.location.hostname.toLowerCase();
}

export function isStaffNotificationScope(scope: AppScope = getRuntimeAppScope()) {
  return scope === "erp" || scope === "atendimento";
}
