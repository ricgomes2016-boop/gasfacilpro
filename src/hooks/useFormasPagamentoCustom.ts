import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export interface FormaPagamentoCustom {
  id: string;
  nome: string;
  slug: string;
  icone: string;
  grupo: "a_vista" | "a_prazo";
  conta_bancaria_id: string | null;
  ativo: boolean;
  unidade_id: string | null;
}

/** Slug prefixes encode financial group so runtime helpers work sync. */
export function buildCustomSlug(nome: string, grupo: "a_vista" | "a_prazo"): string {
  const base = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "forma";
  const prefix = grupo === "a_vista" ? "custom_avista_" : "custom_aprazo_";
  return `${prefix}${base}`;
}

export function isCustomSlug(slug: string | null | undefined): boolean {
  return !!slug && (slug.startsWith("custom_avista_") || slug.startsWith("custom_aprazo_"));
}

export function customSlugGrupo(slug: string | null | undefined): "a_vista" | "a_prazo" | null {
  if (!slug) return null;
  if (slug.startsWith("custom_avista_")) return "a_vista";
  if (slug.startsWith("custom_aprazo_")) return "a_prazo";
  return null;
}

export function useFormasPagamentoCustom(opts?: { onlyActive?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const onlyActive = opts?.onlyActive ?? true;

  return useQuery({
    queryKey: ["formas-pagamento-custom", unidadeAtual?.id, onlyActive],
    queryFn: async (): Promise<FormaPagamentoCustom[]> => {
      let q = (supabase as any).from("formas_pagamento_custom").select("*").order("nome");
      if (unidadeAtual?.id) q = q.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      if (onlyActive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FormaPagamentoCustom[];
    },
  });
}
