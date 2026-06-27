export const calcularDistancia = (a:any, b:any) => {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  return Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
};

export const escolherMelhorEntregador = (pedido:any, entregadores:any[]) => {
  let melhor:any = null;
  let menorScore = Infinity;

  if (!pedido?.localizacao) return null;

  entregadores.forEach((e:any) => {
    if (!e?.localizacao) return;

    const distancia = calcularDistancia(e.localizacao, pedido.localizacao);
    const carga = e.pedidosAtivos || 0;
    const tempoMedio = e.tempoMedioEntrega || 20;

    const score = distancia * 0.6 + carga * 0.3 + tempoMedio * 0.1;

    if (score < menorScore) {
      menorScore = score;
      melhor = e;
    }
  });

  return melhor;
};

export const calcularETA = (entregador:any, pedido:any) => {
  if (!entregador.localizacao) return null;

  const distancia = calcularDistancia(entregador.localizacao, pedido);
  const velocidadeMedia = 0.02;

  return Math.round((distancia / velocidadeMedia) / 60);
};

export const detectarRiscoAtraso = (eta:number, limite=30) => {
  if (!eta) return "desconhecido";
  if (eta > limite) return "alto";
  if (eta > limite * 0.7) return "medio";
  return "baixo";
};

export const otimizarOrdem = (entregas:any[], origem:any) => {
  const ordenado:any[] = [];
  let atual = origem;
  const copia = [...entregas];

  while (copia.length) {
    copia.sort((a,b)=> calcularDistancia(atual,a)-calcularDistancia(atual,b));
    const prox = copia.shift();
    ordenado.push(prox);
    atual = prox;
  }

  return ordenado;
};
