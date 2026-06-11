## Ajustes no Acerto do Entregador e PDV

### 1. Adicionar canal virtual "Gás do Povo"
Em `src/pages/caixa/AcertoEntregador.tsx`, na lista `CANAIS_VIRTUAIS` (hoje com Portaria e PDV), incluir um terceiro item:

```
{ id: "__gas_do_povo__", nome: "🔥 Gás do Povo", canal: "Gas_do_Povo" }
```

A query atual já filtra por `responsavel_acerto = canalVirtual.canal.toLowerCase()`. Para o Gás do Povo, o filtro deve buscar pedidos cuja `forma_pagamento` contenha `gas_do_povo` (inclusive em pagamentos múltiplos tipo `multiplo:gas_do_povo+...`), pois ele é uma forma de pagamento (governo) e não um canal físico. Ajuste na query: quando `canalVirtual.id === "__gas_do_povo__"`, trocar `.eq("responsavel_acerto", ...)` por `.or("forma_pagamento.eq.gas_do_povo,forma_pagamento.ilike.%gas_do_povo%")`.

Mantém todo o resto do fluxo igual (filtros de status pendentes/acertados, confirmação, PDF, etc.).

### 2. PDV não deve gerar pendência de acerto
Em `src/pages/vendas/PDV.tsx` (linha ~255), a venda é criada com `status: "entregue"`, o que faz com que ela apareça como pendente de acerto na tela do entregador (filtro Portaria).

Alterar o insert do PDV para já gravar `status: "finalizado"` (venda confirmada, sem necessidade de acerto). Manter `canal_venda: "portaria"` e `responsavel_acerto: "portaria"` para fins de relatório/histórico — ainda aparece em "Acertados" quando o usuário seleciona Portaria + filtro "Acertados/Todos", mas nunca em "Pendentes".

### Verificação
- Abrir `/caixa/acerto`: o seletor deve listar Portaria, PDV e Gás do Povo.
- Selecionar Gás do Povo deve trazer pedidos com forma de pagamento Gás do Povo no período.
- Fazer uma venda nova no PDV (`/vendas/pdv`) e confirmar que ela NÃO aparece no acerto Portaria como pendente, somente em "Acertados".
