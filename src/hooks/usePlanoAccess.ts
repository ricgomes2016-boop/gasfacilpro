import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanoKey = "basico" | "starter" | "enterprise";

export interface PlanoModulo {
  id: string;
  modulo_key: string;
  modulo_label: string;
  modulo_grupo: string;
  path: string | null;
  planos: string[];
}

/**
 * Hook que expõe o controle de acesso por plano.
 * - Super_admin sempre tem acesso a tudo.
 * - Caso falte profile/empresa/plano, libera por padrão (fail-open) pra não travar a navegação.
 */
export function usePlanoAccess() {
  const { user, hasRole } = useAuth();
  const isSuper = hasRole("super_admin");

  const { data: planoAtual } = useQuery({
    queryKey: ["plano-atual", user?.id],
    enabled: !!user?.id && !isSuper,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlanoKey | null> => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      const empresaId = (prof as any)?.empresa_id;
      if (!empresaId) return null;
      const { data: emp } = await supabase
        .from("empresas")
        .select("plano")
        .eq("id", empresaId)
        .maybeSingle();
      const p = (emp as any)?.plano as string | undefined;
      if (p === "basico" || p === "starter" || p === "enterprise") return p;
      return null;
    },
  });

  const { data: modulos } = useQuery({
    queryKey: ["plano-modulos-runtime"],
    enabled: !!user?.id && !isSuper,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlanoModulo[]> => {
      const { data, error } = await supabase
        .from("plano_modulos" as any)
        .select("id, modulo_key, modulo_label, modulo_grupo, path, planos");
      if (error) return [];
      return (data || []) as unknown as PlanoModulo[];
    },
  });

  const allowedPaths = (() => {
    if (isSuper) return null; // null = tudo liberado
    if (!planoAtual || !modulos || modulos.length === 0) return null;
    const set = new Set<string>();
    for (const m of modulos) {
      if (m.path && m.planos?.includes(planoAtual)) set.add(m.path);
    }
    return set;
  })();

  const canAccessPath = (path?: string) => {
    if (!path) return true;
    if (allowedPaths === null) return true; // fail-open
    if (allowedPaths.has(path)) return true;
    // Se o path não está cadastrado em plano_modulos, libera (fail-open)
    const known = (modulos || []).some((m) => m.path === path);
    return !known;
  };

  return {
    isSuper,
    planoAtual: (isSuper ? "enterprise" : planoAtual) as PlanoKey | null,
    modulos: modulos || [],
    canAccessPath,
    ready: isSuper || (!!planoAtual && !!modulos),
  };
}
