# Contas a Receber — Filtros Premium + Auto-baixa de Recebimentos à Vista

## Diagnóstico

Hoje a tela tem **três camadas de filtros concorrentes** que confundem o usuário:
1. Campo "Buscar nome" sempre visível
2. Painel "Filtros" expansível (data inicial, data final, status)
3. Abas por forma de pagamento (Cartões, PIX Maquininha, Cheques, Fiado, Boletos, Vale Gás, Outros)

Além disso, contas pagas em **cartão de débito/crédito, PIX e PIX Maquininha** entram como `pendente` — o que está errado: esses meios **liquidam na hora** (cartão D+1/D+30 vira recebível só pro adquirente, mas para o cliente já está pago). Boleto e fiado sim ficam pendentes.

## Solução em duas frentes

### Frente 1 — Barra de filtros unificada (premium)

Substituir os três blocos por **uma barra sticky** no topo (mesmo padrão já adotado no Relatório de Vendas):

```
[Buscar cliente/descrição...]  [Período ▾]  [Status ▾]  [Forma ▾]  [Mais ▾]   [Limpar]
└─ chips de filtros ativos ────────────────────────────────────────────────────┘
```

- **Período (popover)**: presets "Hoje · 7 dias · Este mês · Mês passado · Últimos 30/90 dias · Este ano · Personalizado" + dois inputs de data. Default = "Este mês".
- **Status (multi-select)**: `A Receber` (pendente futura), `Vencida`, `Recebida`, `Parcial`. Default = `A Receber + Vencida`.
- **Forma (multi-select)**: substitui as abas. Opções agrupadas:
  - **À vista (liquidam automático)**: Dinheiro, PIX, PIX Maquininha, Cartão Débito, Cartão Crédito
  - **A prazo**: Boleto, Fiado, Cheque, Vale Gás, Transferência
- **Mais filtros**: Canal de venda, faixa de valor (slider min/max), apenas com boleto pendente de emissão, apenas Asaas.
- **Chips ativos** logo abaixo da barra: cada filtro vira um chip removível (ex.: `Período: Mai/2026 ×`, `Forma: PIX ×`).
- **Botão "Limpar"** só aparece quando há filtro fora do default.

KPIs do topo (Pendente / Vencido / Recebido / Total) passam a **respeitar a barra de filtros** — hoje eles ignoram tudo e mostram sempre o total geral, o que engana a leitura.

### Frente 2 — Auto-baixa de recebimentos à vista

Definir uma regra única `isFormaAVista(forma)` que retorna `true` para:
`dinheiro, pix, pix_maquininha, cartao_debito, cartao_credito, cartão` (qualquer variação case-insensitive).

Aplicar em **três pontos**:

1. **No insert (frontend, `salvar()` desta tela)**: se `forma_pagamento` é à vista, gravar `status='recebida'`, `data_recebimento = vencimento || hoje` automaticamente — sem precisar abrir o dialog "Liquidar".

2. **Backfill** (one-shot via migration `UPDATE`): marcar como `recebida` todas as contas existentes que estão `pendente` com forma de pagamento à vista, usando `vencimento` como `data_recebimento`. Vou listar o impacto antes (`SELECT COUNT`) para o usuário aprovar.

3. **Origem das vendas (`NovaVenda` / pedido → conta_receber)**: hoje cria sempre `status='pendente'`. Passar a respeitar a mesma regra na criação — vou ajustar o ponto onde a venda gera o `contas_receber` (preciso localizar o arquivo durante implementação, provavelmente `usePedidos` ou trigger no banco).

**Indicador visual na linha**: badge azul "Auto-baixada" quando `recebida` veio da regra automática, para o gestor distinguir das baixas manuais.

### Frente 3 — Melhorias premium de leitura

- **Resumo por forma de pagamento** em mini-cards colapsáveis acima da tabela (ex.: "PIX: 142 contas · R$ 18.420 recebido este mês · 100% liquidação").
- **Exportar** respeita os filtros ativos (hoje exporta tudo).
- **Linha vencida** ganha barra vermelha lateral + tooltip "Vencida há X dias".
- **Ordenação por coluna** (cliente, vencimento, valor) com indicador visual.

## Fora de escopo
- Não mexer em `App.tsx`, rotas, providers.
- Não alterar tabela `contas_receber` (só `UPDATE` de dados existentes).
- Não tocar em RLS.
- Cartão de crédito continua não gerando recebível do adquirente (essa é outra esteira, `PagamentosCartao.tsx`); aqui só estamos baixando a venda do cliente.

## Arquivos afetados
- `src/pages/financeiro/ContasReceber.tsx` — barra unificada, regra à vista, KPIs filtrados
- `src/lib/financeiro/formaPagamento.ts` — **novo**, helper `isFormaAVista` + `getFormaCategoria` reutilizável
- Migration de backfill (UPDATE em `contas_receber`)
- Ponto de criação de conta a receber a partir de venda (a confirmar no momento da implementação)

## Pergunta antes de partir pra build
Quero confirmar duas coisas:
1. **Boleto** liquida só quando o Asaas confirma — mantenho como `pendente` até webhook, certo? (não entra no auto-baixa)
2. **Cartão de crédito parcelado**: a venda para o cliente fica `recebida` na hora (ok auto-baixar), e os recebíveis do adquirente seguem em `PagamentosCartao`. Confirma?
