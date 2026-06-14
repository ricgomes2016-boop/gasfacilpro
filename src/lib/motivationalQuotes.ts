export type AuthPortalKey =
  | "erp"
  | "cliente"
  | "entregador"
  | "vendedor"
  | "painel"
  | "parceiro"
  | "transportadora"
  | "api"
  | "contador";


const QUOTES: Record<AuthPortalKey, string[]> = {
  erp: [
    "Gestão eficiente é o combustível do crescimento.",
    "Decisões claras nascem de dados organizados.",
    "Pequenos detalhes constroem grandes resultados.",
    "Quem mede, melhora. Quem melhora, lidera.",
    "Cada dia é uma nova chance de fazer melhor.",
  ],
  cliente: [
    "Praticidade na palma da sua mão.",
    "Seu gás chega rápido, seu dia continua.",
    "Conforto começa com o pedido certo.",
    "Cuidamos do essencial para você viver mais.",
  ],
  entregador: [
    "Cada entrega é uma promessa cumprida.",
    "Sua jornada move o mundo.",
    "Seguro, rápido e sempre no horário.",
    "Hoje é dia de bater meta!",
    "Foco, fé e foco no próximo cliente.",
  ],
  vendedor: [
    "Vender é resolver o problema do cliente.",
    "Cada NÃO te aproxima do próximo SIM.",
    "Meta é destino, atitude é o caminho.",
    "Cliente bem atendido volta sempre.",
  ],

  painel: [
    "Liderar é simplificar o complexo.",
    "Visão sistêmica, ação precisa.",
    "Grandes plataformas se constroem todo dia.",
  ],
  parceiro: [
    "Parceria forte, resultado certo.",
    "Vender é servir bem.",
    "Cada vale entregue é confiança conquistada.",
  ],
  transportadora: [
    "Logística inteligente, custo enxuto.",
    "Cada quilômetro conta — otimize com dados.",
    "Frota organizada é margem garantida.",
  ],
  api: [
    "Integrações boas são invisíveis — só funcionam.",
    "Conecte tudo. Automatize o resto.",
    "APIs bem feitas economizam horas todo dia.",
  ],
  contador: [
    "Números organizados, decisões certeiras.",
    "Conformidade hoje é tranquilidade amanhã.",
    "Cada lançamento conta uma história.",
  ],
};

export function getRandomQuote(portal: AuthPortalKey): string {
  const list = QUOTES[portal] ?? QUOTES.erp;
  return list[Math.floor(Math.random() * list.length)];
}
