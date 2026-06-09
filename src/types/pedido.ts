export type PedidoStatus = "pendente" | "em_rota" | "entregue" | "cancelado" | "finalizado" | "aguardando_pagamento_cartao" | "pagamento_em_processamento" | "pago_cartao" | "pagamento_negado";

export interface PedidoItem {
  id: string;
  produto_id: string | null;
  quantidade: number;
  preco_unitario: number;
  produto?: {
    id: string;
    nome: string;
  };
}

export interface PedidoFormatado {
  id: string;
  numero_sequencial: number | null;
  cliente: string;
  cliente_id: string | null;
  endereco: string;
  produtos: string;
  itens: PedidoItem[];
  valor: number;
  status: PedidoStatus;
  data: string;
  entregador?: string;
  entregador_id?: string | null;
  observacoes?: string;
  forma_pagamento?: string;
  canal_venda?: string;
  agendado?: boolean;
  data_agendamento?: string | null;
  data_entrega?: string | null;
}
