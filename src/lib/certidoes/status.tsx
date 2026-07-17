import { Badge } from "@/components/ui/badge";

export function diasAteVencimento(data: string | null) {
  if (!data) return null;
  const diff = (new Date(data).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}

export function statusBadge(cert: any) {
  if (!cert) return <Badge variant="outline">Pendente</Badge>;
  const dias = diasAteVencimento(cert.data_vencimento);
  if (cert.status === "erro") return <Badge variant="destructive">Erro</Badge>;
  if (dias === null) return <Badge variant="secondary">Sem vencimento</Badge>;
  if (dias < 0) return <Badge variant="destructive">Vencida há {Math.abs(dias)}d</Badge>;
  if (dias <= 15) return <Badge className="bg-warning hover:bg-warning text-white">Vence em {dias}d</Badge>;
  if (dias <= 30) return <Badge className="bg-warning hover:bg-warning text-white">Vence em {dias}d</Badge>;
  return <Badge className="bg-success hover:bg-success text-white">Regular ({dias}d)</Badge>;
}

export const TIPO_CERTIDAO_LABEL: Record<string, string> = {
  anp: "ANP — Revenda GLP",
  cnd_federal: "CND Federal",
  cnd_estadual: "CND Estadual",
  cnd_municipal: "CND Municipal",
  cndt: "CNDT — Trabalhista",
  sintegra: "Sintegra",
};
