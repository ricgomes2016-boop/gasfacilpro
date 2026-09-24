import { describe, expect, it } from "vitest";
import { agruparComodatos, type RegistroComodatoGrupo } from "./comodatoGroups";

const registro = (id: string, dados: Partial<RegistroComodatoGrupo> = {}): RegistroComodatoGrupo => ({
  id,
  unidade_id: "unidade-1",
  cliente_id: "cliente-1",
  produto_id: "p13-vazio",
  quantidade: 1,
  quantidade_devolvida: 0,
  prazo_devolucao: "2026-10-10",
  status: "ativo",
  deposito: 150,
  clientes: { nome: "Cliente exemplo" },
  produtos: { nome: "Vasilhame P13" },
  ...dados,
});

describe("agruparComodatos", () => {
  it("mostra empréstimos adicionais no mesmo cliente e soma o saldo por produto", () => {
    const grupos = agruparComodatos([
      registro("novo", { quantidade: 2, prazo_devolucao: "2026-10-15" }),
      registro("original", { quantidade: 3, quantidade_devolvida: 1 }),
      registro("agua", { produto_id: "agua-vazio", produtos: { nome: "Vasilhame água" }, quantidade: 2, deposito: 30 }),
      registro("outro-cliente", { cliente_id: "cliente-2" }),
      registro("outra-unidade", { unidade_id: "unidade-2" }),
    ]);

    expect(grupos).toHaveLength(3);
    expect(grupos[0].registros.map((item) => item.id)).toEqual(["novo", "original", "agua"]);
    expect(grupos[0]).toMatchObject({ quantidade: 7, devolvidos: 1, pendente: 6, prazo_devolucao: "2026-10-10", reposicaoPendente: 660 });
    expect(grupos[0].saldosPorProduto).toEqual([
      { id: "p13-vazio", nome: "Vasilhame P13", emprestados: 5, devolvidos: 1 },
      { id: "agua-vazio", nome: "Vasilhame água", emprestados: 2, devolvidos: 0 },
    ]);
  });

  it("mantém no histórico a entrega devolvida sem duplicar a pendência", () => {
    const [grupo] = agruparComodatos([
      registro("atual", { quantidade: 2 }),
      registro("antigo", { quantidade: 2, quantidade_devolvida: 2, status: "devolvido" }),
    ]);
    expect(grupo).toMatchObject({ quantidade: 4, devolvidos: 2, pendente: 2, status: "ativo", reposicaoPendente: 300 });
  });
});
