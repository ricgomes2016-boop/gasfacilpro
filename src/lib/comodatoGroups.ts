export interface RegistroComodatoGrupo {
  id: string;
  unidade_id: string;
  cliente_id: string;
  produto_id: string;
  quantidade: number;
  quantidade_devolvida?: number | null;
  prazo_devolucao?: string | null;
  status: string;
  deposito?: number | null;
  clientes?: { nome: string } | null;
  produtos?: { nome: string } | null;
}

export interface SaldoProdutoComodato {
  id: string;
  nome: string;
  emprestados: number;
  devolvidos: number;
}

export function agruparComodatos<T extends RegistroComodatoGrupo>(registros: T[]) {
  const porCliente = new Map<string, { chave: string; cliente_id: string; clientes: T["clientes"]; registros: T[] }>();
  for (const registro of registros) {
    const chave = `${registro.unidade_id}:${registro.cliente_id}`;
    if (!porCliente.has(chave)) porCliente.set(chave, { chave, cliente_id: registro.cliente_id, clientes: registro.clientes, registros: [] });
    porCliente.get(chave)!.registros.push(registro);
  }

  return [...porCliente.values()].map((grupo) => {
    const ativos = grupo.registros.filter((registro) => registro.status === "ativo");
    const quantidade = grupo.registros.reduce((soma, registro) => soma + Number(registro.quantidade || 0), 0);
    const devolvidos = grupo.registros.reduce((soma, registro) => soma + Number(registro.quantidade_devolvida || 0), 0);
    const prazos = ativos.map((registro) => registro.prazo_devolucao).filter((prazo): prazo is string => Boolean(prazo)).sort();
    const saldos = new Map<string, SaldoProdutoComodato>();
    for (const registro of grupo.registros) {
      if (!saldos.has(registro.produto_id)) saldos.set(registro.produto_id, { id: registro.produto_id, nome: registro.produtos?.nome || "Vasilhame", emprestados: 0, devolvidos: 0 });
      const saldo = saldos.get(registro.produto_id)!;
      saldo.emprestados += Number(registro.quantidade || 0);
      saldo.devolvidos += Number(registro.quantidade_devolvida || 0);
    }
    return {
      ...grupo,
      quantidade,
      devolvidos,
      pendente: quantidade - devolvidos,
      prazo_devolucao: prazos[0] || null,
      status: ativos.length ? "ativo" : grupo.registros.some((registro) => registro.status === "perdido") ? "perdido" : "devolvido",
      produtos: [...new Set(grupo.registros.map((registro) => registro.produtos?.nome || "Vasilhame"))],
      saldosPorProduto: [...saldos.values()],
      reposicaoPendente: ativos.reduce((soma, registro) => soma + Math.max(0, Number(registro.quantidade) - Number(registro.quantidade_devolvida || 0)) * Number(registro.deposito || 0), 0),
    };
  });
}
