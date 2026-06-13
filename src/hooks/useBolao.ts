import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { gerarFixtureCompleta, BolaoFase } from "@/lib/bolao/fixture2026";
import { toast } from "sonner";

export interface BolaoJogo {
  id: string;
  unidade_id: string;
  empresa_id: string;
  fase: BolaoFase;
  grupo: string | null;
  numero_jogo: number;
  data_jogo: string;
  time_casa: string;
  time_fora: string;
  codigo_casa: string | null;
  codigo_fora: string | null;
  gols_casa_real: number | null;
  gols_fora_real: number | null;
  finalizado: boolean;
}

export interface BolaoPalpite {
  id: string;
  jogo_id: string;
  user_id: string;
  unidade_id: string;
  gols_casa_palpite: number;
  gols_fora_palpite: number;
  pontos: number;
}

export function useBolaoJogos(unidadeId?: string) {
  return useQuery({
    queryKey: ["bolao-jogos", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolao_jogos" as any)
        .select("*")
        .eq("unidade_id", unidadeId!)
        .order("numero_jogo");
      if (error) throw error;
      return (data || []) as unknown as BolaoJogo[];
    },
  });
}

export function useMeusPalpites(unidadeId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bolao-palpites", "meus", unidadeId, user?.id],
    enabled: !!unidadeId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolao_palpites" as any)
        .select("*")
        .eq("unidade_id", unidadeId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []) as unknown as BolaoPalpite[];
    },
  });
}

export function useSalvarPalpite(unidadeId?: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { jogo_id: string; gols_casa: number; gols_fora: number }) => {
      if (!user?.id || !unidadeId) throw new Error("Sessão inválida");
      const { error } = await supabase
        .from("bolao_palpites" as any)
        .upsert(
          {
            jogo_id: params.jogo_id,
            user_id: user.id,
            unidade_id: unidadeId,
            gols_casa_palpite: params.gols_casa,
            gols_fora_palpite: params.gols_fora,
          },
          { onConflict: "jogo_id,user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bolao-palpites", "meus", unidadeId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Não foi possível salvar o palpite");
    },
  });
}

export function useRankingBolao(unidadeId?: string) {
  return useQuery({
    queryKey: ["bolao-ranking", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolao_palpites" as any)
        .select("user_id, pontos")
        .eq("unidade_id", unidadeId!);
      if (error) throw error;

      const mapa = new Map<string, { user_id: string; pontos: number; palpites: number; exatos: number; vencedores: number }>();
      const palpites = ((data || []) as unknown) as { user_id: string; pontos: number }[];
      palpites.forEach((p) => {
        const cur = mapa.get(p.user_id) || { user_id: p.user_id, pontos: 0, palpites: 0, exatos: 0, vencedores: 0 };
        cur.pontos += p.pontos || 0;
        cur.palpites += 1;
        if (p.pontos === 10) cur.exatos += 1;
        else if (p.pontos === 5) cur.vencedores += 1;
        mapa.set(p.user_id, cur);
      });

      const userIds = Array.from(mapa.keys());
      if (userIds.length === 0) return [];

      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nomes = new Map((profs || []).map((p: any) => [p.user_id, p.full_name || "Entregador"]));

      return Array.from(mapa.values())
        .map((r) => ({ ...r, nome: nomes.get(r.user_id) || "Entregador" }))
        .sort((a, b) => b.pontos - a.pontos);
    },
  });
}

export function useFinalizarJogo(unidadeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { jogo_id: string; gols_casa: number; gols_fora: number; finalizado: boolean }) => {
      const { error } = await supabase
        .from("bolao_jogos" as any)
        .update({
          gols_casa_real: params.gols_casa,
          gols_fora_real: params.gols_fora,
          finalizado: params.finalizado,
        })
        .eq("id", params.jogo_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bolao-jogos", unidadeId] });
      qc.invalidateQueries({ queryKey: ["bolao-palpites"] });
      qc.invalidateQueries({ queryKey: ["bolao-ranking", unidadeId] });
      toast.success("Jogo atualizado");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar jogo");
    },
  });
}

export function useImportarTabela(unidadeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!unidadeId) throw new Error("Unidade não selecionada");
      const fixture = gerarFixtureCompleta();
      const rows = fixture.map((j) => ({
        unidade_id: unidadeId,
        fase: j.fase,
        grupo: j.grupo ?? null,
        numero_jogo: j.numero_jogo,
        data_jogo: j.data_jogo,
        time_casa: j.time_casa,
        time_fora: j.time_fora,
        codigo_casa: j.codigo_casa ?? null,
        codigo_fora: j.codigo_fora ?? null,
      }));
      // Inserir em lotes de 50 para evitar payload grande
      for (let i = 0; i < rows.length; i += 50) {
        const lote = rows.slice(i, i + 50);
        const { error } = await supabase.from("bolao_jogos" as any).insert(lote);
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (qtd) => {
      qc.invalidateQueries({ queryKey: ["bolao-jogos", unidadeId] });
      toast.success(`${qtd} jogos importados`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao importar tabela");
    },
  });
}
