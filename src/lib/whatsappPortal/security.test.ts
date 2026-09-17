import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  MUTACOES,
  assinar,
  corsHeadersFor,
  igualdadeSegura,
  isUuid,
  mascararTelefone,
  normalizarTelefone,
  podeCriarPedido,
  stringCanonica,
  verificarAssinatura,
} from "../../../supabase/functions/whatsapp-portal-api/security";

const segredo = "s".repeat(40);
const corpo = JSON.stringify({ action: "products", unidade_id: "u1" });
const base = { segredo, timestamp: "1000000000000", nonce: "nonce-1234", corpo };

describe("assinatura HMAC do portal WhatsApp", () => {
  it("assina a string canônica timestamp.nonce.corpo", async () => {
    expect(stringCanonica("1", "n", "{}")).toBe("1.n.{}");
    const a = await assinar(segredo, "1", "n", "{}");
    expect(a).toBe(await assinar(segredo, "1", "n", "{}"));
    expect(a).not.toBe(await assinar(segredo, "1", "n", '{"x":1}'));
  });

  it("aceita requisição válida dentro da janela de 5 minutos", async () => {
    const assinatura = await assinar(segredo, base.timestamp, base.nonce, corpo);
    expect(await verificarAssinatura({ ...base, assinatura }, 1_000_000_000_000)).toEqual({ ok: true });
  });

  it("rejeita corpo adulterado", async () => {
    const assinatura = await assinar(segredo, base.timestamp, base.nonce, corpo);
    const r = await verificarAssinatura(
      { ...base, corpo: '{"action":"create-order"}', assinatura },
      1_000_000_000_000,
    );
    expect(r).toEqual({ ok: false, motivo: "assinatura_invalida" });
  });

  it("rejeita timestamp expirado (> 5 min)", async () => {
    const assinatura = await assinar(segredo, base.timestamp, base.nonce, corpo);
    const r = await verificarAssinatura({ ...base, assinatura }, 1_000_000_000_000 + 6 * 60 * 1000);
    expect(r).toEqual({ ok: false, motivo: "timestamp_expirado" });
  });

  it("rejeita headers ausentes", async () => {
    const r = await verificarAssinatura({ ...base, nonce: null, assinatura: null }, 1_000_000_000_000);
    expect(r).toEqual({ ok: false, motivo: "assinatura_ausente" });
  });

  it("rejeita payload acima do limite", async () => {
    const grande = "x".repeat(40_000);
    const assinatura = await assinar(segredo, base.timestamp, base.nonce, grande);
    const r = await verificarAssinatura({ ...base, corpo: grande, assinatura }, 1_000_000_000_000);
    expect(r).toEqual({ ok: false, motivo: "payload_excedido" });
  });

  it("compara em tempo constante sem falsos positivos", () => {
    expect(igualdadeSegura("abc", "abc")).toBe(true);
    expect(igualdadeSegura("abc", "abd")).toBe(false);
    expect(igualdadeSegura("abc", "abcd")).toBe(false);
  });
});

describe("regras de negócio do portal", () => {
  it("bloqueia create-order sem confirmed=true", () => {
    expect(podeCriarPedido({ confirmed: true })).toBe(true);
    expect(podeCriarPedido({ confirmed: "true" } as never)).toBe(false);
    expect(podeCriarPedido({})).toBe(false);
  });

  it("exige idempotency-key apenas nas mutações", () => {
    expect(MUTACOES).toEqual(["create-order", "cancel-order"]);
    expect(ACTIONS).toContain("health");
  });

  it("normaliza e mascara telefone", () => {
    expect(normalizarTelefone("(43) 98870-9696")).toBe("43988709696");
    expect(normalizarTelefone("123")).toBeNull();
    expect(mascararTelefone("43988709696")).toBe("****9696");
  });

  it("valida uuid de unidade", () => {
    expect(isUuid("3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05")).toBe(true);
    expect(isUuid("unidade-1")).toBe(false);
  });

  it("restringe CORS às origens permitidas, sem wildcard", () => {
    expect(corsHeadersFor("https://fortegas-connect.lovable.app")["Access-Control-Allow-Origin"]).toBe(
      "https://fortegas-connect.lovable.app",
    );
    expect(corsHeadersFor("https://evil.com")["Access-Control-Allow-Origin"]).toBe(
      "https://atendimento.gasfacilpro.com.br",
    );
  });
});
