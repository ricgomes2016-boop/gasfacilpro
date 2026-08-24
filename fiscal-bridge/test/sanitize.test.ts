import { describe, expect, it } from "vitest";
import { classificarErro, mascarar, sanitizar } from "../src/sanitize.js";

describe("sanitização", () => {
  it("remove blocos PEM", () => {
    const texto = "erro -----BEGIN PRIVATE KEY-----AAAA\nBBBB-----END PRIVATE KEY----- fim";
    expect(sanitizar(texto)).toBe("erro [pem] fim");
  });

  it("remove base64 longo e números sensíveis", () => {
    expect(sanitizar("payload " + "A".repeat(80))).toContain("[base64]");
    expect(sanitizar("CNPJ 12345678000199 usado")).toBe("CNPJ [num] usado");
  });

  it("oculta senhas e tokens", () => {
    expect(sanitizar('senha: "abc123"')).toContain("[oculto]");
    expect(sanitizar("token=eyJhbGciO")).toContain("[oculto]");
  });

  it("classifica erros de rede sem vazar segredo", () => {
    const e = Object.assign(new Error("connect ETIMEDOUT -----BEGIN X-----k-----END X-----"), { code: "ETIMEDOUT" });
    const r = classificarErro(e);
    expect(r.categoria).toBe("timeout_sefaz");
    expect(r.detalhe).not.toContain("BEGIN");
  });

  it("mascara identificadores", () => {
    expect(mascarar("abcdef123456")).toBe("********3456");
  });
});
