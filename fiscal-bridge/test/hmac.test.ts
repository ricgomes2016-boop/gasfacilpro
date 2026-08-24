import { describe, expect, it } from "vitest";
import { RegistroNonce, assinar, stringCanonica, verificarAssinatura } from "../src/hmac.js";

const segredo = "x".repeat(40);
const base = { segredo, timestamp: "1000000", nonce: "n1", caminho: "/dfe/distribuicao", corpo: '{"unidadeId":"u1"}' };

describe("assinatura HMAC", () => {
  it("assina exatamente o corpo enviado", () => {
    expect(stringCanonica(base)).toBe('1000000.n1./dfe/distribuicao.{"unidadeId":"u1"}');
    expect(assinar(base)).toBe(assinar(base));
    expect(assinar({ ...base, corpo: '{"unidadeId":"u2"}' })).not.toBe(assinar(base));
  });

  it("aceita requisição válida dentro da janela", () => {
    const r = verificarAssinatura({ ...base, assinatura: assinar(base) }, new RegistroNonce(), 1_000_000);
    expect(r.ok).toBe(true);
  });

  it("rejeita corpo adulterado", () => {
    const r = verificarAssinatura(
      { ...base, corpo: '{"unidadeId":"outro"}', assinatura: assinar(base) },
      new RegistroNonce(),
      1_000_000,
    );
    expect(r).toEqual({ ok: false, motivo: "assinatura_invalida" });
  });

  it("rejeita timestamp fora da janela", () => {
    const r = verificarAssinatura({ ...base, assinatura: assinar(base) }, new RegistroNonce(), 1_000_000 + 300_000);
    expect(r).toEqual({ ok: false, motivo: "timestamp_expirado" });
  });

  it("rejeita replay do mesmo nonce", () => {
    const registro = new RegistroNonce();
    const req = { ...base, assinatura: assinar(base) };
    expect(verificarAssinatura(req, registro, 1_000_000).ok).toBe(true);
    expect(verificarAssinatura(req, registro, 1_000_001)).toEqual({ ok: false, motivo: "replay" });
  });

  it("rejeita headers ausentes", () => {
    const r = verificarAssinatura({ ...base, nonce: null, assinatura: null } as never, new RegistroNonce(), 1_000_000);
    expect(r).toEqual({ ok: false, motivo: "assinatura_ausente" });
  });
});
