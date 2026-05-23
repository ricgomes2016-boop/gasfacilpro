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

  // Carrega status do certificado da unidade ativa
  useEffect(() => {
    let cancelado = false;
    if (!unidadeAtual?.id) {
      setStatus({ carregando: false, cadastrado: false, vencido: false, titular: null, validade: null });
      return;
    }
    setStatus((s) => ({ ...s, carregando: true }));
    supabase
      .from("unidades")
      .select("certificado_a1_path, certificado_a1_validade, certificado_a1_titular")
      .eq("id", unidadeAtual.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        // certificado_a1_senha não é mais legível pelo cliente; basta verificar path/validade.
        const cadastrado = Boolean(data?.certificado_a1_path);
        const vencido = Boolean(
          data?.certificado_a1_validade && new Date(data.certificado_a1_validade) < new Date(),
        );
        setStatus({
          carregando: false,
          cadastrado,
          vencido,
          titular: data?.certificado_a1_titular || null,
          validade: data?.certificado_a1_validade || null,
        });
      });
    return () => {
      cancelado = true;
    };
  }, [unidadeAtual?.id]);

  // Carrega preferência salva por unidade
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
