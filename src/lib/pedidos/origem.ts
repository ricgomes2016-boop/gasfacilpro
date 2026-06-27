export type OrigemPedido =
  | "telefone_ia"
  | "erp"
  | "whatsapp"
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
  telefone_ia:     { label: "Telefone IA",     icon: "📞", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  erp:             { label: "ERP",             icon: "🖥️", color: "bg-slate-100 text-slate-700 border-slate-200" },
  whatsapp:        { label: "WhatsApp IA",     icon: "🤖", color: "bg-green-100 text-green-700 border-green-200" },
  site:            { label: "Site",            icon: "🌐", color: "bg-sky-100 text-sky-700 border-sky-200" },
  app_entregador:  { label: "App Entregador",  icon: "🛵", color: "bg-orange-100 text-orange-700 border-orange-200" },
  app_cliente:     { label: "App Cliente",     icon: "📱", color: "bg-blue-100 text-blue-700 border-blue-200" },
  portal_parceiro: { label: "Portal Parceiro", icon: "🤝", color: "bg-purple-100 text-purple-700 border-purple-200" },
  balcao_pdv:      { label: "Balcão/PDV",      icon: "🏪", color: "bg-amber-100 text-amber-700 border-amber-200" },
  telefone:        { label: "Telefone",        icon: "☎️", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  portaria:        { label: "Portaria",        icon: "🚪", color: "bg-rose-100 text-rose-700 border-rose-200" },
  assistente_bia:  { label: "Assistente Bia",  icon: "🤖", color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" },
  autoatendimento: { label: "Autoatendimento", icon: "🧾", color: "bg-teal-100 text-teal-700 border-teal-200" },
};

export const ORIGENS_PEDIDO: OrigemPedido[] = Object.keys(ORIGEM_PEDIDO_META) as OrigemPedido[];

export function getOrigemMeta(origem?: string | null) {
  if (!origem) return ORIGEM_PEDIDO_META.erp;
  return ORIGEM_PEDIDO_META[origem as OrigemPedido] ?? ORIGEM_PEDIDO_META.erp;
}
