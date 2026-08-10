import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export interface CategoriaDespesaCadastro {
  id: string;
  nome: string;
  grupo: string | null;
  tipo: string | null;
  codigo_contabil: string | null;
  ativo: boolean | null;
  ordem: number | null;
  unidade_id: string | null;
}

export const normalizeCategoriaDespesa = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const resolveCategoriaDespesaNome = (
  sugestao: string | null | undefined,
  categorias: Array<Pick<CategoriaDespesaCadastro, "nome">>,
) => {
  const alvo = normalizeCategoriaDespesa(sugestao);
  if (!alvo) return "";

  const exata = categorias.find((categoria) => normalizeCategoriaDespesa(categoria.nome) === alvo);
  if (exata) return exata.nome;

  const parcial = categorias.find((categoria) => {
    const nome = normalizeCategoriaDespesa(categoria.nome);
    return nome.length > 2 && (nome.includes(alvo) || alvo.includes(nome));
  });
  return parcial?.nome || "";
};

export function useCategoriasDespesa() {
  const { unidadeAtual } = useUnidade();
  const [categorias, setCategorias] = useState<CategoriaDespesaCadastro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchCategorias = async () => {
      setLoading(true);
      let query = supabase
        .from("categorias_despesa")
        .select("id,nome,grupo,tipo,codigo_contabil,ativo,ordem,unidade_id")
        .eq("ativo", true)
        .order("grupo", { ascending: true })
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      if (unidadeAtual?.id) query = query.or(`unidade_id.is.null,unidade_id.eq.${unidadeAtual.id}`);

      const { data, error } = await query;
      if (!mounted) return;

      if (error) {
        console.error("[useCategoriasDespesa] erro ao carregar categorias:", error);
        setCategorias([]);
        setLoading(false);
        return;
      }

      const seen = new Set<string>();
      const unique = ((data || []) as CategoriaDespesaCadastro[]).filter((categoria) => {
        const key = normalizeCategoriaDespesa(categoria.nome);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setCategorias(unique);
      setLoading(false);
    };

    fetchCategorias();

    return () => {
      mounted = false;
    };
  }, [unidadeAtual?.id]);

  const nomes = useMemo(() => categorias.map((categoria) => categoria.nome), [categorias]);

  return { categorias, nomes, loading };
}
