function obrigatorio(nome: string): string {
  const v = process.env[nome];
  if (!v || !v.trim()) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return v.trim();
}

export interface Config {
  porta: number;
  segredoHmac: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  bucketCertificados: string;
  tpAmb: "1" | "2";
  timeoutMs: number;
}

let cache: Config | null = null;

export function carregarConfig(): Config {
  if (cache) return cache;
  cache = {
    porta: Number(process.env.PORT ?? 8443),
    segredoHmac: obrigatorio("FISCAL_BRIDGE_SECRET"),
    supabaseUrl: obrigatorio("SUPABASE_URL"),
    supabaseServiceRoleKey: obrigatorio("SUPABASE_SERVICE_ROLE_KEY"),
    bucketCertificados: process.env.CERT_BUCKET?.trim() || "certificados-fiscais",
    tpAmb: (process.env.SEFAZ_TP_AMB?.trim() as "1" | "2") || "1",
    timeoutMs: Number(process.env.SEFAZ_TIMEOUT_MS ?? 30000),
  };
  if (cache.segredoHmac.length < 32) {
    throw new Error("FISCAL_BRIDGE_SECRET deve ter ao menos 32 caracteres.");
  }
  return cache;
}
