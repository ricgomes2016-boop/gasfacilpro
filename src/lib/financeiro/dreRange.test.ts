import { describe, expect, it } from "vitest";
import { STATUS_RECEITA_DRE, filtroPeriodoPedidos, mesRangeDre } from "./dreRange";

describe("mesRangeDre", () => {
  it("cobre o mês inteiro com fim exclusivo no próximo mês", () => {
    const r = mesRangeDre(new Date(2026, 7, 15));
    expect(r.inicioDate).toBe("2026-08-01");
    expect(r.fimDate).toBe("2026-08-31");
    expect(r.proximoInicioDate).toBe("2026-09-01");
  });

  it("trata virada de ano", () => {
    const r = mesRangeDre(new Date(2026, 11, 3));
    expect(r.inicioDate).toBe("2026-12-01");
    expect(r.proximoInicioDate).toBe("2027-01-01");
  });

  it("trata fevereiro bissexto", () => {
    expect(mesRangeDre(new Date(2028, 1, 10)).fimDate).toBe("2028-02-29");
    expect(mesRangeDre(new Date(2026, 1, 10)).fimDate).toBe("2026-02-28");
  });

  it("usa limite superior exclusivo, sem perder o último dia", () => {
    const r = mesRangeDre(new Date(2026, 7, 1));
    expect(new Date(r.proximoInicioISO).getTime()).toBeGreaterThan(new Date(`${r.fimDate}T23:59:59`).getTime());
  });
});

describe("filtroPeriodoPedidos", () => {
  it("filtra por data_entrega e cai para created_at quando nula", () => {
    const f = filtroPeriodoPedidos(mesRangeDre(new Date(2026, 7, 22)));
    expect(f).toContain("data_entrega.gte.2026-08-01");
    expect(f).toContain("data_entrega.lt.2026-09-01");
    expect(f).toContain("data_entrega.is.null");
    expect(f).toContain("created_at.gte.");
    expect(f).toContain("created_at.lt.");
    expect(f).not.toContain("lte.");
  });
});

describe("STATUS_RECEITA_DRE", () => {
  it("inclui os status reais de receita e nenhum cancelado/pendente", () => {
    expect(STATUS_RECEITA_DRE).toContain("finalizado");
    expect(STATUS_RECEITA_DRE).toContain("entregue");
    expect(STATUS_RECEITA_DRE).toContain("pago");
    expect(STATUS_RECEITA_DRE).toContain("pago_cartao");
    ["cancelado", "pendente", "em_rota", "agendado"].forEach((s) =>
      expect(STATUS_RECEITA_DRE as readonly string[]).not.toContain(s),
    );
  });
});
