export interface WhatsappPedidoItem {
  nome: string;
  quantidade: number;
  preco_unitario: number;
}

export interface WhatsappPedidoInput {
  numeroCurto: string; // ex.: "ABC123"
  clienteNome?: string | null;
  clienteTelefone?: string | null;
  enderecoEntrega?: string | null;
  itens: WhatsappPedidoItem[];
  total: number;
  formaPagamento?: string | null;
  observacoes?: string | null;
  unidadeNome?: string | null;
}

const moeda = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildPedidoWhatsappMessage(p: WhatsappPedidoInput): string {
  const linhas: string[] = [];
  linhas.push(`🛵 *Novo Pedido #${p.numeroCurto}*`);
  if (p.unidadeNome) linhas.push(`🏪 ${p.unidadeNome}`);
  if (p.clienteNome) {
    const tel = p.clienteTelefone ? ` (${p.clienteTelefone})` : "";
    linhas.push(`👤 ${p.clienteNome}${tel}`);
  }
  if (p.enderecoEntrega) linhas.push(`📍 ${p.enderecoEntrega}`);
  linhas.push("");
  linhas.push("📦 *Itens*");
  for (const it of p.itens) {
    linhas.push(`• ${it.quantidade}x ${it.nome} — ${moeda(it.quantidade * it.preco_unitario)}`);
  }
  linhas.push("");
  linhas.push(`💰 *Total:* ${moeda(p.total)}`);
  if (p.formaPagamento) linhas.push(`💳 Pagamento: ${p.formaPagamento.replace(/_/g, " ")}`);
  if (p.observacoes) linhas.push(`📝 Obs: ${p.observacoes}`);
  return linhas.join("\n");
}

/** Sanitiza telefone BR e devolve dígitos com DDI 55. Retorna null se inválido. */
export function normalizePhoneBr(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function buildWhatsappUrl(telefone: string, mensagem: string): string {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}
