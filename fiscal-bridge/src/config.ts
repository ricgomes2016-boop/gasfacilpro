import fs from "node:fs";
import path from "node:path";

function obrigatorio(nome: string): string {
  const v = process.env[nome];
  if (!v || !v.trim()) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return v.trim();
}

export type ModoBridge = "servidor" | "local";

export interface ConfigLocal {
  /** Caminho do arquivo .pfx no disco do PC do escritório. */
  pfxPath: string;
  senha: string;
  /** CNPJ da unidade (14 dígitos) — usado no XML enviado à SEFAZ. */
  cnpj: string;
  /** UF da unidade (ex.: PR) — define o cUF. */
  uf: string;
  /** Token de pareamento exigido no cabeçalho X-Agente-Token. */
  token: string;
  /** Origens autorizadas a chamar o agente (domínios do ERP). */
  origens: string[];
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

function gerarToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * No modo local o agente roda no PC do escritório: lê o .pfx do disco e não
 * fala com o banco. A configuração vive em agente.json ao lado do executável.
 */
function carregarLocal(): ConfigLocal {
  const arquivo = process.env.AGENTE_CONFIG?.trim() || path.resolve(process.cwd(), "agente.json");
  if (!fs.existsSync(arquivo)) {
    throw new Error(
      `Arquivo de configuração do agente não encontrado: ${arquivo}. ` +
        "Copie agente.exemplo.json para agente.json e preencha os dados da unidade.",
    );
  }
  let bruto: Record<string, unknown>;
  try {
    bruto = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    throw new Error(`agente.json inválido (JSON malformado): ${arquivo}`);
  }

  const pfxPath = String(bruto.pfxPath ?? "").trim();
  const senha = String(bruto.senha ?? "");
  const cnpj = String(bruto.cnpj ?? "").replace(/\D/g, "");
  const uf = String(bruto.uf ?? "").trim().toUpperCase();
  if (!pfxPath) throw new Error("agente.json: informe pfxPath (caminho do certificado A1 .pfx).");
  if (!fs.existsSync(pfxPath)) throw new Error(`agente.json: certificado não encontrado em ${pfxPath}`);
  if (!senha) throw new Error("agente.json: informe a senha do certificado.");
  if (cnpj.length !== 14) throw new Error("agente.json: cnpj deve ter 14 dígitos.");
  if (uf.length !== 2) throw new Error("agente.json: informe a uf com 2 letras (ex.: PR).");

  let token = String(bruto.token ?? "").trim();
  if (!token) {
    token = gerarToken();
    fs.writeFileSync(arquivo, JSON.stringify({ ...bruto, token }, null, 2), "utf8");
  }

  const origens = Array.isArray(bruto.origens) && bruto.origens.length
    ? (bruto.origens as unknown[]).map((o) => String(o).replace(/\/+$/, ""))
    : ORIGENS_PADRAO;

  return { pfxPath, senha, cnpj, uf, token, origens };
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
