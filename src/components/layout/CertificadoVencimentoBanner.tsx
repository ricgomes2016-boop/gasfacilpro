import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

type Status = { certificado_a1_configurado: boolean; certificado_a1_validade: string | null };

export function CertificadoVencimentoBanner() {
  const { unidadeAtual } = useUnidade();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let ativo = true;
    setStatus(null);
    if (!unidadeAtual?.id) return;
    supabase.rpc("get_unidade_certificado_status", { _unidade_id: unidadeAtual.id })
      .then(({ data, error }) => {
        if (ativo && !error) setStatus(data?.[0] ?? null);
      });
    return () => { ativo = false; };
  }, [unidadeAtual?.id]);

  if (!status?.certificado_a1_configurado || !status.certificado_a1_validade) return null;
  const vencimento = new Date(`${status.certificado_a1_validade}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const dias = Math.round((vencimento.getTime() - hoje.getTime()) / 86_400_000);
  if (!Number.isFinite(dias) || dias > 30) return null;

  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        O certificado digital de {unidadeAtual?.nome} {dias < 0 ? "venceu" : dias === 0 ? "vence hoje" : `vence em ${dias} dia${dias === 1 ? "" : "s"}`} ({vencimento.toLocaleDateString("pt-BR")}).
      </span>
      <Link to="/config/unidades" className="font-semibold underline underline-offset-2">Ver certificado</Link>
    </div>
  );
}
