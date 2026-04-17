import { useEffect, useState } from "react";
import { escolherMelhorEntregador, calcularETA, detectarRiscoAtraso } from "@/services/iaOperacionalService";
import { detectarParadas, calcularTempoRota, gerarAlertas } from "@/services/operacionalService";

export const useOperacional = (entregadores:any[], pedidos:any[], pontosCache:any) => {
  const [dados, setDados] = useState<any>({});

  useEffect(() => {
    const resultado:any = {};

    // ENTREGADORES
    entregadores?.forEach((e:any) => {
      const pontos = pontosCache?.[e.id] || [];

      resultado[e.id] = {
        tempo: calcularTempoRota(pontos),
        paradas: detectarParadas(pontos),
        alertas: gerarAlertas(pontos),
      };
    });

    // PEDIDOS (IA)
    pedidos?.forEach((p:any) => {
      const melhor = escolherMelhorEntregador(p, entregadores || []);

      if (melhor) {
        const eta = calcularETA(melhor, p);
        const risco = detectarRiscoAtraso(eta);

        resultado[p.id] = {
          melhorEntregador: melhor,
          eta,
          risco,
        };
      }
    });

    setDados(resultado);
  }, [entregadores, pedidos, pontosCache]);

  return dados;
};
