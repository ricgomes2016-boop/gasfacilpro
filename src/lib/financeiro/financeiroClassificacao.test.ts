import { describe, expect, it } from "vitest";
import {
  isContaPagarAberta,
  isRecebivelClienteAberto,
  isRecebivelOperadoraAberto,
  isStatusRecebido,
  valorLiquidoOperadora,
} from "./financeiroClassificacao";

describe("financeiroClassificacao", () => {
  it("classifica fiado e boleto abertos como contas a receber de cliente", () => {
    expect(isRecebivelClienteAberto({ forma_pagamento: "fiado", status: "pendente" })).toBe(true);
    expect(isRecebivelClienteAberto({ forma_pagamento: "boleto", status: "vencida" })).toBe(true);
  });

  it("mantem cartao, pix maquininha e gas do povo fora do a receber de cliente", () => {
    const formas = ["cartao_credito", "cartao_debito", "credito", "debito", "pix_maquininha", "gas_do_povo"];

    formas.forEach((forma_pagamento) => {
      expect(isRecebivelClienteAberto({ forma_pagamento, status: "pendente" })).toBe(false);
      expect(isRecebivelOperadoraAberto({ forma_pagamento, status: "pendente" })).toBe(true);
    });
  });

  it("trata recebiveis quitados como historico, nao pendencia", () => {
    expect(isStatusRecebido("recebida")).toBe(true);
    expect(isRecebivelOperadoraAberto({ forma_pagamento: "cartao_credito", status: "recebida" })).toBe(false);
    expect(isRecebivelClienteAberto({ forma_pagamento: "fiado", status: "recebida" })).toBe(false);
  });

  it("usa valor liquido para recebiveis de operadora", () => {
    expect(valorLiquidoOperadora({ valor: 100, valor_liquido: 95.01 })).toBe(95.01);
    expect(valorLiquidoOperadora({ valor: 100 })).toBe(100);
  });

  it("classifica contas a pagar abertas e pagas", () => {
    expect(isContaPagarAberta({ status: "pendente" })).toBe(true);
    expect(isContaPagarAberta({ status: "vencida" })).toBe(true);
    expect(isContaPagarAberta({ status: "paga" })).toBe(false);
  });
});
