import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

interface CertStatus {
  carregando: boolean;
  cadastrado: boolean;
  vencido: boolean;
  titular: string | null;
  validade: string | null;
}

const PREF_KEY = (uid: string) => `assinar_pdf_default__${uid}`;

export function useAssinaturaDigital() {
  const { unidadeAtual } = useUnidade();
  const [status, setStatus] = useState<CertStatus>({
    carregando: true,
    cadastrado: false,
    vencido: false,
    titular: null,
    validade: null,
  });
  const [ativo, setAtivoState] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!unidadeAtual?.id) {
      setStatus({ carregando: false, cadastrado: false, vencido: false, titular: null, validade: null });
      return;
    }

    setStatus((s) => ({ ...s, carregando: true }));
    (supabase as any)
      .rpc("get_unidade_certificado_status", { _unidade_id: unidadeAtual.id })
      .then(({ data }: { data: any }) => {
        if (cancelado) return;
        const row = Array.isArray(data) ? data[0] : data;
        const cadastrado = Boolean(row?.certificado_a1_configurado);
        const vencido = Boolean(
          row?.certificado_a1_validade && new Date(row.certificado_a1_validade) < new Date(),
        );
        setStatus({
          carregando: false,
          cadastrado,
          vencido,
          titular: row?.certificado_a1_titular || null,
          validade: row?.certificado_a1_validade || null,
        });
      })
      .catch(() => {
        if (cancelado) return;
        setStatus({ carregando: false, cadastrado: false, vencido: false, titular: null, validade: null });
      });

    return () => {
      cancelado = true;
    };
  }, [unidadeAtual?.id]);

  useEffect(() => {
    if (!unidadeAtual?.id) return;
    try {
      const v = localStorage.getItem(PREF_KEY(unidadeAtual.id));
      setAtivoState(v === "1");
    } catch {
      setAtivoState(false);
    }
  }, [unidadeAtual?.id]);

  const setAtivo = useCallback(
    (v: boolean) => {
      setAtivoState(v);
      if (unidadeAtual?.id) {
        try {
          localStorage.setItem(PREF_KEY(unidadeAtual.id), v ? "1" : "0");
        } catch {}
      }
    },
    [unidadeAtual?.id],
  );

  const disponivel = status.cadastrado && !status.vencido;

  return {
    ...status,
    disponivel,
    ativo: ativo && disponivel,
    setAtivo,
    unidadeId: unidadeAtual?.id || null,
  };
}
