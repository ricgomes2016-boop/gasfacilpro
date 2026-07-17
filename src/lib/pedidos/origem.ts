export type OrigemPedido =
  | "telefone_ia"
  | "erp"
  | "whatsapp"
  | "whatsapp_entregador"
  | "site"
  | "app_entregador"
  | "app_cliente"
  | "portal_parceiro"
  | "balcao_pdv"
  | "telefone"
  | "portaria"
  | "assistente_bia"
  | "autoatendimento";

export const ORIGEM_PEDIDO_META: Record<
  OrigemPedido,
  { label: string; icon: string; color: string }
> = {
  telefone_ia:     { label: "Telefone IA",     icon: "📞", color: "bg-info text-info border-info" },
  erp:             { label: "ERP",             icon: "🖥️", color: "bg-slate-100 text-slate-700 border-slate-200" },
  whatsapp:        { label: "WhatsApp IA",     icon: "🤖", color: "bg-success text-success border-success" },
  whatsapp_entregador: { label: "Entregador WhatsApp", icon: "🛵", color: "bg-success text-success border-success" },
  site:            { label: "Site",            icon: "🌐", color: "bg-info text-info border-info" },
  app_entregador:  { label: "App Entregador",  icon: "🛵", color: "bg-warning text-warning border-warning" },
  app_cliente:     { label: "App Cliente",     icon: "📱", color: "bg-info text-info border-info" },
  portal_parceiro: { label: "Portal Parceiro", icon: "🤝", color: "bg-primary text-primary border-primary" },
  balcao_pdv:      { label: "Balcão/PDV",      icon: "🏪", color: "bg-warning text-warning border-warning" },
  telefone:        { label: "Telefone",        icon: "☎️", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  portaria:        { label: "Portaria",        icon: "🚪", color: "bg-destructive text-destructive border-destructive" },
  assistente_bia:  { label: "Assistente Bia",  icon: "🤖", color: "bg-primary text-primary border-primary" },
  autoatendimento: { label: "Autoatendimento", icon: "🧾", color: "bg-success text-success border-success" },
};

export const ORIGENS_PEDIDO: OrigemPedido[] = Object.keys(ORIGEM_PEDIDO_META) as OrigemPedido[];

export function getOrigemMeta(origem?: string | null) {
  if (!origem) return ORIGEM_PEDIDO_META.erp;
  return ORIGEM_PEDIDO_META[origem as OrigemPedido] ?? ORIGEM_PEDIDO_META.erp;
}
