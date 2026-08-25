import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { garantirSemPlaintext, lerSegredoProtegido } from "./dpapi.js";

function obrigatorio(nome: string): string {
  const v = process.env[nome];
  if (!v || !v.trim()) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return v.trim();
}

export type ModoBridge = "servidor" | "local";

export interface ConfigLocal {
  /** Caminho do arquivo .pfx na pasta privada do usuário (nunca em pasta pública/repo). */
  pfxPath: string;
  /** Arquivo com a senha do PFX protegida por DPAPI (CurrentUser). */
  senhaProtegidaPath: string;
  /** Arquivo com o token de pareamento protegido por DPAPI (CurrentUser). */
  tokenProtegidoPath: string;
  /** CNPJ da unidade (14 dígitos) — usado no XML enviado à SEFAZ. */
  cnpj: string;
  /** UF da unidade (ex.: PR) — define o cUF. */
  uf: string;
  /** Origens autorizadas a chamar o agente (domínios do ERP). */
  origens: string[];
  /** Lê a senha do PFX sob demanda; o texto claro só existe durante a chamada. */
  lerSenha(): string;
  /** Lê o token de pareamento sob demanda (memoizado em memória). */
  lerToken(): string;
}

export interface Config {
  modo: ModoBridge;
  porta: number;
  segredoHmac: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  bucketCertificados: string;
  tpAmb: "1" | "2";
  timeoutMs: number;
  local: ConfigLocal | null;
}

const ORIGENS_PADRAO = [
  "https://gasfacilpro.lovable.app",
  "https://gasfacilpro.com.br",
  "https://www.gasfacilpro.com.br",
  "https://app.gasfacilpro.com.br",
  "https://painel.gasfacilpro.com.br",
  "http://localhost:8080",
];

let cache: Config | null = null;

/** Pasta privada do agente no perfil do usuário (ACL aplicada pelo instalador). */
export function pastaAgente(): string {
  const base = process.env.AGENTE_HOME?.trim()
    || path.join(process.env.LOCALAPPDATA?.trim() || path.join(os.homedir(), ".local", "share"), "GasFacil", "AgenteFiscal");
  return base;
}

export function caminhoConfigPadrao(): string {
  return process.env.AGENTE_CONFIG?.trim() || path.join(pastaAgente(), "agente.json");
}

/**
 * Modo local: o agente roda no PC do escritório, lê o .pfx da pasta privada do
 * usuário e obtém senha/token exclusivamente de blobs DPAPI. Não fala com o banco.
 */
function carregarLocal(): ConfigLocal {
  const arquivo = caminhoConfigPadrao();
  if (!fs.existsSync(arquivo)) {
    throw new Error(
      `Configuração do agente não encontrada: ${arquivo}. ` +
        "Rode scripts/instalar-agente.bat (ou scripts/instalar.ps1) para configurar o agente com segurança.",
    );
  }
  let bruto: Record<string, unknown>;
  try {
    // PowerShell (Set-Content/Out-File) grava UTF-8 com BOM; JSON.parse falha com o BOM.
    bruto = JSON.parse(fs.readFileSync(arquivo, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`agente.json inválido (JSON malformado): ${arquivo}`);
  }

  // Nada de senha/token em texto aberto — nem por compatibilidade.
  garantirSemPlaintext(bruto);

  const baseDir = path.dirname(arquivo);
  const resolver = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    return path.isAbsolute(s) ? s : path.resolve(baseDir, s);
  };

  const pfxPath = resolver(bruto.pfxPath);
  const senhaProtegidaPath = resolver(bruto.senhaProtegidaPath);
  const tokenProtegidoPath = resolver(bruto.tokenProtegidoPath);
  const cnpj = String(bruto.cnpj ?? "").replace(/\D/g, "");
  const uf = String(bruto.uf ?? "").trim().toUpperCase();

  if (!pfxPath) throw new Error("agente.json: informe pfxPath (certificado A1 na pasta privada do usuário).");
  if (!fs.existsSync(pfxPath)) throw new Error(`agente.json: certificado não encontrado em ${pfxPath}`);
  if (!senhaProtegidaPath) throw new Error("agente.json: informe senhaProtegidaPath (blob DPAPI da senha).");
  if (!fs.existsSync(senhaProtegidaPath)) throw new Error("agente.json: arquivo da senha protegida não encontrado. Rode o instalador.");
  if (!tokenProtegidoPath) throw new Error("agente.json: informe tokenProtegidoPath (blob DPAPI do token).");
  if (!fs.existsSync(tokenProtegidoPath)) throw new Error("agente.json: arquivo do token protegido não encontrado. Rode o instalador.");
  if (cnpj.length !== 14) throw new Error("agente.json: cnpj deve ter 14 dígitos.");
  if (uf.length !== 2) throw new Error("agente.json: informe a uf com 2 letras (ex.: PR).");

  const origens = Array.isArray(bruto.origens) && bruto.origens.length
    ? (bruto.origens as unknown[]).map((o) => String(o).replace(/\/+$/, ""))
    : ORIGENS_PADRAO;

  let tokenCache: string | null = null;

  return {
    pfxPath,
    senhaProtegidaPath,
    tokenProtegidoPath,
    cnpj,
    uf,
    origens,
    lerSenha: () => lerSegredoProtegido(senhaProtegidaPath),
    lerToken: () => {
      if (tokenCache === null) tokenCache = lerSegredoProtegido(tokenProtegidoPath);
      return tokenCache;
    },
  };
}

export function carregarConfig(): Config {
  if (cache) return cache;
  const modo: ModoBridge = (process.env.BRIDGE_MODE?.trim() as ModoBridge) === "local" ? "local" : "servidor";

  if (modo === "local") {
    const local = carregarLocal();
    cache = {
      modo,
      porta: Number(process.env.PORT ?? 8787),
      segredoHmac: "",
      supabaseUrl: "",
      supabaseServiceRoleKey: "",
      bucketCertificados: "",
      tpAmb: (process.env.SEFAZ_TP_AMB?.trim() as "1" | "2") || "1",
      timeoutMs: Number(process.env.SEFAZ_TIMEOUT_MS ?? 30000),
      local,
    };
    return cache;
  }

  cache = {
    modo,
    porta: Number(process.env.PORT ?? 8443),
    segredoHmac: obrigatorio("FISCAL_BRIDGE_SECRET"),
    supabaseUrl: obrigatorio("SUPABASE_URL"),
    supabaseServiceRoleKey: obrigatorio("SUPABASE_SERVICE_ROLE_KEY"),
    bucketCertificados: process.env.CERT_BUCKET?.trim() || "certificados-fiscais",
    tpAmb: (process.env.SEFAZ_TP_AMB?.trim() as "1" | "2") || "1",
    timeoutMs: Number(process.env.SEFAZ_TIMEOUT_MS ?? 30000),
    local: null,
  };
  if (cache.segredoHmac.length < 32) {
    throw new Error("FISCAL_BRIDGE_SECRET deve ter ao menos 32 caracteres.");
  }
  return cache;
}

/** Apenas para os testes: limpa o cache de configuração. */
export function limparCacheConfig() {
  cache = null;
}

/** Validação pura do agente.json (usada pelo carregamento e pelos testes). */
export function validarConfigLocalBruta(bruto: Record<string, unknown>): { ok: true } | { ok: false; erro: string } {
  try {
    garantirSemPlaintext(bruto);
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
  const obrigatorios = ["pfxPath", "senhaProtegidaPath", "tokenProtegidoPath", "cnpj", "uf"];
  for (const campo of obrigatorios) {
    if (!String(bruto[campo] ?? "").trim()) return { ok: false, erro: `Campo obrigatório ausente: ${campo}` };
  }
  if (String(bruto.cnpj).replace(/\D/g, "").length !== 14) return { ok: false, erro: "cnpj deve ter 14 dígitos." };
  if (String(bruto.uf).trim().length !== 2) return { ok: false, erro: "uf deve ter 2 letras." };
  return { ok: true };
}
