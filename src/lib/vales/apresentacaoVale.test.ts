import { describe, expect, it } from "vitest";
import { identificarTipoVale, obterApresentacaoVale } from "./apresentacaoVale";

describe("apresentação do vale por produto", () => {
  it("apresenta vale de Água Mineral 20L somente como VALE ÁGUA", () => {
    expect(obterApresentacaoVale("Água Mineral 20L", "VALE ÁGUA")).toMatchObject({
      tipo: "agua",
      titulo: "VALE ÁGUA",
      subtitulo: "",
      nomeArquivo: "vale-agua",
    });
  });

  it("mantém vale de botijão como VALE GÁS", () => {
    expect(obterApresentacaoVale("Gás de cozinha 13 KG", "VALE GÁS").titulo).toBe("VALE GÁS");
  });

  it("usa a descrição como compatibilidade para vales antigos", () => {
    expect(identificarTipoVale(null, "Vale Água")).toBe("agua");
  });

  it("não exibe como subtítulo um rótulo genérico antigo e conflitante", () => {
    expect(obterApresentacaoVale("Água Mineral 20L", "VALE GÁS").subtitulo).toBe("");
  });

  it("usa um título neutro quando o produto não é água nem gás", () => {
    expect(obterApresentacaoVale("Carvão", "Campanha social")).toMatchObject({
      titulo: "VALE PRODUTO",
      subtitulo: "Campanha social",
    });
  });
});
