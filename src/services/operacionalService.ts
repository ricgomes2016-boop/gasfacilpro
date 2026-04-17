export const detectarParadas = (pontos:any[]) => {
  if (!pontos || pontos.length < 2) return [];

  const paradas:any[] = [];

  for (let i=1;i<pontos.length;i++){
    const atual = pontos[i];
    const anterior = pontos[i-1];

    const tempo = new Date(atual.created_at).getTime() - new Date(anterior.created_at).getTime();

    const distancia = Math.abs(atual.latitude - anterior.latitude) + Math.abs(atual.longitude - anterior.longitude);

    if (tempo > 120000 && distancia < 0.0001){
      paradas.push({
        latitude: atual.latitude,
        longitude: atual.longitude,
        tempoParado: tempo/1000
      });
    }
  }

  return paradas;
};

export const calcularTempoRota = (pontos:any[]) => {
  if (!pontos.length) return 0;

  const inicio = new Date(pontos[0].created_at).getTime();
  const fim = new Date(pontos[pontos.length-1].created_at).getTime();

  return (fim-inicio)/1000;
};

export const gerarAlertas = (pontos:any[]) => {
  const alertas:string[] = [];

  const paradas = detectarParadas(pontos);

  if (paradas.length > 0) alertas.push("Paradas longas");

  const tempo = calcularTempoRota(pontos);

  if (tempo > 3600) alertas.push("Entrega demorada");

  return alertas;
};
