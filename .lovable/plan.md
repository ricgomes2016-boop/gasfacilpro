## Objetivo

Corrigir 3 problemas do Caixa do Dia + tornar a edição de pagamento no Acerto Diário tão completa quanto a de Pedidos/Nova Venda.

---

## 1. Aba "Pagamento" mostra slug cru `custom_avista_vale_ultragaz`

**Arquivo:** `src/pages/caixa/CaixaDia.tsx` (linhas 217–283).

- Hoje o agregador usa `normalizarForma()`, um mapa hard-coded que não conhece formas customizadas → o slug técnico vai direto para o `Map` e aparece na UI.
- Ele também não sabe reconhecer `custom_avista_*` dentro de pagamento composto (`"custom_avista_vale_ultragaz R$50,00, PIX R$20,00"`).

**Correção:**
- Trocar `normalizarForma` pelo helper oficial `useFormaPagamentoLabel()` (já usado em `AcertoEntregador.tsx`), que resolve builtin + custom via `useFormasPagamentoCustom`.
- Agregar internamente pelo `slug` (chave estável) e só exibir `formaLabel(slug)` na UI/PDF/Excel. Assim "Vale Ultragaz" aparece bonito e a soma não duplica quando o mesmo slug vem escrito de duas formas.

---

## 2. Aba "Produtos" com quantidade de P13 divergente

**Causa provável:** a consulta em `fetchData` (linha 198) puxa `pedidos` **sem filtrar status**, então inclui `cancelado`/`rejeitado`. Os itens desses pedidos entram no somatório de P13 na aba Produtos, enquanto os relatórios de venda descartam cancelados → divergência.

Também no somatório por forma de pagamento o mesmo problema infla contagem.

**Correção:**
- Adicionar filtro `.not("status", "in", "(cancelado,rejeitado)")` (mesma convenção usada em `RelatorioVendas`) na query `qPed`.
- Aplicar o filtro uma única vez — as três agregações (formas, produtos, acerto pendente) passam a bater com Relatório de Vendas e com Acerto do Entregador.

Sem mexer em lógica de saldo/tesouraria.

---

## 3. Edição de forma de pagamento em "Entregas Detalhadas" (Acerto Diário)

**Arquivo:** `src/pages/caixa/AcertoEntregador.tsx` — dialog "Editar Entrega" (linhas 1470–1560), linhas de `pagamentos_multiplos`.

Hoje é só um `<Select>` de forma + input de valor. Precisa espelhar o fluxo de **Nova Venda / Pedidos** (`src/components/vendas/PaymentSection.tsx` e `PDVPayment.tsx`), que usam `CardOperatorSelectorModal`.

**Correção — para cada linha de pagamento no dialog:**
1. Detectar tipo pelo slug: `cartao_debito`, `cartao_credito`, `pix_maquininha`.
2. Ao selecionar/confirmar uma dessas formas, abrir automaticamente `CardOperatorSelectorModal` (o mesmo componente já existente) passando `valor`, `tipoCartao`, `unidadeId`.
3. Guardar no state da linha: `operadora_id`, `operadora_nome`, `taxa`, `prazo`, `conta_bancaria_id`, `valor_liquido` — além dos campos já existentes.
4. Exibir badge "Operadora: X · D+Y · Recebe em: Conta Z" abaixo da linha, com botão "Trocar" que reabre o modal.
5. Bloquear salvar enquanto uma linha de cartão/PIX-maquininha estiver sem operadora selecionada (mesma UX do PaymentSection).
6. No `handleSalvarEdicao` (perto da linha 501) enviar os campos de operadora/conta para as tabelas de pagamento (`pagamentos_cartao` quando houver operadora; senão só `pedidos.forma_pagamento` como hoje). Reaproveitar o helper de gravação já usado em Nova Venda para não duplicar regra.

Formas à vista puras (dinheiro, PIX) continuam com o input simples atual — sem modal.

---

## Fora de escopo

- Card "Total em Caixa", DRE, Fluxo de Caixa, Conferência, Contas Bancárias.
- Alterações em RelatorioVendas, PedidosKanban, Nova Venda.
- Qualquer migration — todas as tabelas envolvidas (`operadoras_cartao`, `pagamentos_cartao`, `contas_bancarias`) já existem.

## Validação

- Aba Pagamento: forma custom aparece como "🎫 Vale Ultragaz", não como slug.
- Aba Produtos: total P13 = soma de itens de pedidos **não cancelados** do dia — deve bater com Relatório de Vendas para a mesma unidade/data.
- Entregas Detalhadas → Editar → escolher "Cartão Crédito": modal de operadora abre; após confirmar, a linha mostra operadora + conta; salvar cria registro em `pagamentos_cartao`.
