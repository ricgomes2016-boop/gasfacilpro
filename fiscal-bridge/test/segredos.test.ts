import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  definirDpapi, dpapiWindows, garantirSemPlaintext, gravarSegredoProtegido, lerSegredoProtegido,
  type DpapiAdapter,
} from "../src/dpapi.js";
import { validarConfigLocalBruta } from "../src/config.js";

/** Adaptador falso: simula DPAPI sem Windows (só nos testes). */
function dpapiFake(): DpapiAdapter & { chamadas: string[] } {
  const chamadas: string[] = [];
  return {
    chamadas,
    disponivel: () => true,
    proteger(texto) { chamadas.push("proteger"); return Buffer.from(`dpapi:${texto}`, "utf8").toString("base64"); },
    desproteger(blob) {
      chamadas.push("desproteger");
      const t = Buffer.from(blob, "base64").toString("utf8");
      if (!t.startsWith("dpapi:")) throw new Error("blob invalido");
      return t.slice(6);
    },
  };
}

let dir = "";
let fake = dpapiFake();

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "agente-"));
  fake = dpapiFake();
  definirDpapi(fake);
});
afterEach(() => {
  definirDpapi(dpapiWindows);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("segredos protegidos (DPAPI adapter mockável)", () => {
  it("grava somente o blob protegido — nunca o texto claro", () => {
    const arq = path.join(dir, "senha.dpapi");
    gravarSegredoProtegido(arq, "S3nh4-do-A1");
    const conteudo = fs.readFileSync(arq, "utf8");
    expect(conteudo).not.toContain("S3nh4-do-A1");
    expect(lerSegredoProtegido(arq)).toBe("S3nh4-do-A1");
  });

  it("regravar é idempotente (reinstalação/reparo)", () => {
    const arq = path.join(dir, "token.dpapi");
    gravarSegredoProtegido(arq, "tok-1");
    gravarSegredoProtegido(arq, "tok-2");
    expect(lerSegredoProtegido(arq)).toBe("tok-2");
  });

  it("falha com orientação quando o arquivo não existe", () => {
    expect(() => lerSegredoProtegido(path.join(dir, "ausente.dpapi"))).toThrow(/instalar\.ps1/);
  });

  it("não expõe o texto claro em erro de blob corrompido", () => {
    const arq = path.join(dir, "ruim.dpapi");
    fs.writeFileSync(arq, "conteudo-invalido");
    expect(() => lerSegredoProtegido(arq)).toThrow();
  });
});

describe("configuração sem plaintext", () => {
  it("rejeita senha ou token em texto aberto no agente.json", () => {
    expect(() => garantirSemPlaintext({ senha: "abc" })).toThrow(/texto aberto/);
    expect(() => garantirSemPlaintext({ token: "abc" })).toThrow(/texto aberto/);
    expect(() => garantirSemPlaintext({ senha: "", token: "" })).not.toThrow();
  });

  it("valida os campos obrigatórios do novo formato", () => {
    const base = {
      pfxPath: "C:/priv/certificado.pfx",
      senhaProtegidaPath: "C:/priv/senha.dpapi",
      tokenProtegidoPath: "C:/priv/token.dpapi",
      cnpj: "00000000000191",
      uf: "PR",
    };
    expect(validarConfigLocalBruta(base)).toEqual({ ok: true });
    expect(validarConfigLocalBruta({ ...base, cnpj: "123" }).ok).toBe(false);
    expect(validarConfigLocalBruta({ ...base, uf: "Parana" }).ok).toBe(false);
    expect(validarConfigLocalBruta({ ...base, senhaProtegidaPath: "" }).ok).toBe(false);
    expect(validarConfigLocalBruta({ ...base, senha: "1234" }).ok).toBe(false);
  });
});

describe("DPAPI fora do Windows", () => {
  it("não cai para plaintext: lança erro com orientação", () => {
    definirDpapi(dpapiWindows);
    if (process.platform === "win32") return;
    expect(() => dpapiWindows.proteger("x")).toThrow(/Windows/);
  });
});
