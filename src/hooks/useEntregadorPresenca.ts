import { useMemo } from "react";
import type { EntregadorOp } from "./useMapaOperacionalData";

export type Presenca = "em_rota" | "online" | "instavel" | "offline";

export interface EntregadorPresenca {
  id: string;
  presenca: Presenca;
  ultimoPingMs: number; // ms desde último ping (Infinity se nunca)
  temRotaAtiva: boolean;
  pedidosAtivos: number;
  label: string; // texto humano: "Online há 12s", "Em rota · 3 entregas"
}

const ONLINE_MS = 5 * 60 * 1000;      // <5min = online
const INSTAVEL_MS = 30 * 60 * 1000;   // 5-30min = instável
// >30min ou nunca = offline

function humanizeAgo(ms: number): string {
  if (!isFinite(ms)) return "nunca";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function useEntregadorPresenca(
  entregadores: EntregadorOp[],
  rotasAtivasPorEntregador: Record<string, string>,
  pontosCache: Record<string, any[]>
): Record<string, EntregadorPresenca> {
  return useMemo(() => {
    const now = Date.now();
    const out: Record<string, EntregadorPresenca> = {};

    entregadores.forEach((e) => {
      // último ping = max(updated_at do entregador, último ponto no cache)
      const pingsEnt = e.updated_at ? new Date(e.updated_at).getTime() : 0;
      const pontos = pontosCache[e.id] || [];
      const ultPonto = pontos.length
        ? new Date(pontos[pontos.length - 1].created_at).getTime()
        : 0;
      const ultimo = Math.max(pingsEnt, ultPonto);
      const ultimoPingMs = ultimo ? now - ultimo : Infinity;

      const temRotaAtiva = !!rotasAtivasPorEntregador[e.id];
      const temGps = !!(e.latitude && e.longitude);

      let presenca: Presenca;
      if (!temGps && ultimoPingMs > INSTAVEL_MS) {
        presenca = "offline";
      } else if (ultimoPingMs < ONLINE_MS) {
        presenca = temRotaAtiva ? "em_rota" : "online";
      } else if (ultimoPingMs < INSTAVEL_MS) {
        presenca = "instavel";
      } else {
        presenca = "offline";
      }

      const ago = humanizeAgo(ultimoPingMs);
      let label: string;
      switch (presenca) {
        case "em_rota":
          label = `Em rota · ${e.pedidosAtivos || 0} entrega(s)`;
          break;
        case "online":
          label = `Online há ${ago}`;
          break;
        case "instavel":
          label = `GPS instável há ${ago}`;
          break;
        default:
          label = isFinite(ultimoPingMs) ? `Offline há ${ago}` : "Nunca logou";
      }

      out[e.id] = {
        id: e.id,
        presenca,
        ultimoPingMs,
        temRotaAtiva,
        pedidosAtivos: e.pedidosAtivos || 0,
        label,
      };
    });

    return out;
  }, [entregadores, rotasAtivasPorEntregador, pontosCache]);
}
