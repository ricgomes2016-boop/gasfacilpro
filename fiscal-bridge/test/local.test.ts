import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cabecalhosCorsLocal, mascararCnpj, tokensIguais } from "../src/local.js";
import { conferirComprovante, gerarComprovante, textoCanonico } from "../src/comprovante.js";

const origens = ["https://app.gasfacilpro.com.br", "http://localhost:8080"];

describe("CORS do agente local", () => {
  it("libera apenas origens autorizadas", () => {
    expect(cabecalhosCorsLocal("http://localhost:8080", origens)["Access-Control-Allow-Origin"]).toBe("http://localhost:8080");
    expect(cabecalhosCorsLocal("https://app.gasfacilpro.com.br/", origens)["Access-Control-Allow-Origin"]).toBe("https://app.gasfacilpro.com.br");
  });
  it("bloqueia origem desconhecida e ausência de origem", () => {
    expect(cabecalhosCorsLocal("https://malicioso.tld", origens)).toEqual({});
    expect(cabecalhosCorsLocal(undefined, origens)).toEqual({});
  });
  it("aceita apenas os cabeçalhos previstos", () => {
    const h = cabecalhosCorsLocal("http://localhost:8080", origens);
    expect(h["Access-Control-Allow-Headers"]).toBe("content-type, x-agente-token");
    expect(h.Vary).toBe("Origin");
  });
});

describe("mascaramento do CNPJ no /health", () => {
  it("nunca devolve o CNPJ completo", () => {
    const m = mascararCnpj("12345678000199");
    expect(m).toBe("**.***.***/****-99");
    expect(m).not.toContain("12345678");
    expect(mascararCnpj("123")).toBeNull();
  });
});

describe("token de pareamento", () => {
  it("compara em tempo constante e rejeita divergências", () => {
    expect(tokensIguais("abc123", "abc123")).toBe(true);
    expect(tokensIguais("abc123", "abc124")).toBe(false);
    expect(tokensIguais("", "")).toBe(false);
    expect(tokensIguais("abc", "abcd")).toBe(false);
  });
});

describe("comprovante local da manifestação", () => {
  const dados = { chave: "4".repeat(44), tipo: "ciencia", cStat: "135", protocolo: "141250000000001", dhResposta: "2026-08-25T12:00:00.000Z" };
  it("vincula chave/tipo/cStat/protocolo", () => {
    expect(textoCanonico(dados)).toContain("|ciencia|135|");
    const h = gerarComprovante(dados, "tok");
    expect(conferirComprovante(dados, "tok", h)).toBe(true);
    expect(conferirComprovante({ ...dados, cStat: "999" }, "tok", h)).toBe(false);
    expect(conferirComprovante(dados, "outro-token", h)).toBe(false);
  });
});

describe("scripts de instalação do Windows", () => {
  const dirScripts = path.resolve(__dirname, "..", "scripts");
  const arquivos = ["comum.ps1", "instalar.ps1", "iniciar.ps1", "parar.ps1", "status.ps1", "desinstalar.ps1", "mostrar-token.ps1", "instalar-agente.bat"];

  it("todos os scripts operacionais existem", () => {
    for (const a of arquivos) expect(fs.existsSync(path.join(dirScripts, a)), a).toBe(true);
  });

  it("o instalador é idempotente e não apaga o PFX de origem", () => {
    const txt = fs.readFileSync(path.join(dirScripts, "instalar.ps1"), "utf8");
    expect(txt).toMatch(/-not \(Test-Path \$Script:ArqSenha\)/);
    expect(txt).toMatch(/Register-ScheduledTask[\s\S]*-Force/);
    expect(txt).toMatch(/Read-Host[^\n]*-AsSecureString/);
    const desinst = fs.readFileSync(path.join(dirScripts, "desinstalar.ps1"), "utf8");
    expect(desinst).toMatch(/RemoverCopiaCertificado/);
  });

  it("nenhum script grava senha ou token em texto no disco", () => {
    for (const a of arquivos) {
      const txt = fs.readFileSync(path.join(dirScripts, a), "utf8");
      expect(txt).not.toMatch(/Set-Content[^\n]*\$senhaClara/);
      expect(txt).not.toMatch(/Out-File[^\n]*\$token\b/);
    }
  });
});
