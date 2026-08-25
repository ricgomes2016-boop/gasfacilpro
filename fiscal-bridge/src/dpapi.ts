/**
 * Adaptador DPAPI (Windows Data Protection API, escopo CurrentUser).
 *
 * Regras de segurança respeitadas aqui:
 *  - a senha/token NUNCA aparece na linha de comando (passa por stdin do PowerShell);
 *  - o texto claro nunca é gravado em disco nem impresso em log;
 *  - fora do Windows não existe fallback para plaintext: falha com orientação.
 *
 * O adaptador é injetável para permitir teste sem Windows.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface DpapiAdapter {
  disponivel(): boolean;
  /** Recebe texto claro e devolve o blob protegido em base64. */
  proteger(texto: string): string;
  /** Recebe o blob base64 e devolve o texto claro (somente em memória). */
  desproteger(blobBase64: string): string;
}

export class DpapiIndisponivelError extends Error {
  readonly motivo = "dpapi_indisponivel";
  constructor(detalhe?: string) {
    super(
      "A proteção de segredos do agente fiscal exige Windows com DPAPI (CurrentUser). " +
        "Neste sistema operacional o agente não roda em modo local com senha protegida — " +
        "use o modo servidor (BRIDGE_MODE=servidor) com o cofre do backend." +
        (detalhe ? ` Detalhe: ${detalhe}` : ""),
    );
    this.name = "DpapiIndisponivelError";
  }
}

const PS = process.env.AGENTE_POWERSHELL?.trim() || "powershell.exe";

const SCRIPT_PROTEGER = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security | Out-Null
$texto = [Console]::In.ReadToEnd()
$bytes = [Text.Encoding]::UTF8.GetBytes($texto)
$prot = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
[Array]::Clear($bytes, 0, $bytes.Length)
[Console]::Out.Write([Convert]::ToBase64String($prot))
`;

const SCRIPT_DESPROTEGER = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security | Out-Null
$b64 = [Console]::In.ReadToEnd().Trim()
$prot = [Convert]::FromBase64String($b64)
$bytes = [Security.Cryptography.ProtectedData]::Unprotect($prot, $null, 'CurrentUser')
[Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))
[Array]::Clear($bytes, 0, $bytes.Length)
`;

/**
 * O script (não sensível) vai como argumento de -Command e o stdin carrega APENAS
 * o segredo. Assim nada sensível aparece em argv e o PowerShell não precisa
 * interpretar script e segredo misturados no mesmo fluxo de entrada.
 */
function executarComSegredo(script: string, segredo: string): string {
  const r = spawnSync(PS, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    input: `${segredo}\n`,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.error) throw new DpapiIndisponivelError(r.error.name);
  if (r.status !== 0) throw new DpapiIndisponivelError(`powershell_status_${r.status}`);
  return String(r.stdout ?? "").trim();
}

export const dpapiWindows: DpapiAdapter = {
  disponivel: () => process.platform === "win32",
  proteger(texto: string) {
    if (!this.disponivel()) throw new DpapiIndisponivelError("plataforma_nao_windows");
    const saida = executarComSegredo(SCRIPT_PROTEGER, texto);
    if (!saida) throw new DpapiIndisponivelError("saida_vazia");
    return saida;
  },
  desproteger(blobBase64: string) {
    if (!this.disponivel()) throw new DpapiIndisponivelError("plataforma_nao_windows");
    const saida = executarComSegredo(SCRIPT_DESPROTEGER, blobBase64);
    if (!saida) throw new DpapiIndisponivelError("saida_vazia");
    return saida;
  },
};

let adaptador: DpapiAdapter = dpapiWindows;

/** Usado nos testes (e apenas neles) para injetar um adaptador falso. */
export function definirDpapi(novo: DpapiAdapter) {
  adaptador = novo;
}
export function dpapi(): DpapiAdapter {
  return adaptador;
}

/** Lê um arquivo de segredo protegido e devolve o texto claro só em memória. */
export function lerSegredoProtegido(caminho: string): string {
  const abs = path.resolve(caminho);
  if (!fs.existsSync(abs)) {
    throw new Error(`Arquivo de segredo protegido não encontrado: ${abs}. Rode scripts/instalar.ps1 novamente.`);
  }
  const blob = fs.readFileSync(abs, "utf8").trim();
  if (!blob) throw new Error("Arquivo de segredo protegido está vazio.");
  return dpapi().desproteger(blob);
}

/** Grava um segredo protegido por DPAPI. O plaintext nunca toca o disco. */
export function gravarSegredoProtegido(caminho: string, textoClaro: string) {
  const abs = path.resolve(caminho);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, dpapi().proteger(textoClaro), { encoding: "utf8", mode: 0o600 });
}

/** Rejeita explicitamente qualquer resquício de senha/token em texto aberto. */
export function garantirSemPlaintext(config: Record<string, unknown>) {
  const proibidos = ["senha", "password", "token", "senhaPfx"];
  const achados = proibidos.filter((k) => typeof config[k] === "string" && String(config[k]).trim() !== "");
  if (achados.length) {
    throw new Error(
      `agente.json contém segredo em texto aberto (${achados.join(", ")}). ` +
        "Remova esses campos e rode scripts/instalar.ps1 para regravar os segredos protegidos por DPAPI.",
    );
  }
}
