import { describe, expect, it, vi } from "vitest";
import { ErroSincronizacaoAgente, sincronizarDfeComAgente } from "./dfeSync";

describe("sincronização DF-e pelo agente local", () => {
  it("token recusado encerra o fluxo sem ingestão nem resultado de sucesso", async () => {
    const ingerir = vi.fn();
    await expect(sincronizarDfeComAgente({
      ultimoNSU: 0,
      maxNSU: 0,
      distribuir: async () => ({ ok: false, motivo: "token_invalido", mensagem: "Token inválido." }),
      ingerir,
    })).rejects.toMatchObject<Partial<ErroSincronizacaoAgente>>({ motivo: "token_invalido" });
    expect(ingerir).not.toHaveBeenCalled();
  });

  it("cStat 137 registra lote vazio e o estado de NSU", async () => {
    const ingerir = vi.fn(async () => ({ ok: true, novos: 0, atualizados: 0 }));
    const resultado = await sincronizarDfeComAgente({
      ultimoNSU: 0,
      maxNSU: 0,
      distribuir: async () => ({
        ok: true,
        dados: { cStat: "137", xMotivo: "Nenhum documento localizado", ultNSU: 42, maxNSU: 42, documentos: [] },
      }),
      ingerir,
    });
    expect(ingerir).toHaveBeenCalledWith([], 42, 42, "137");
    expect(resultado).toEqual({ novos: 0, atualizados: 0, ultimoNSU: 42, maxNSU: 42 });
  });
});