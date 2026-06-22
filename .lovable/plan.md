## Objetivo

Quando a conta aberta for a **Caixa da Empresa** (`tipo = 'caixa_interno'`), simplificar a tela de detalhe para mostrar somente o essencial de caixa em dinheiro.

## O que muda (somente para conta tipo Caixa Interno)

### 1. Abas principais
- Manter apenas: **Visão Geral** e **Transferência**
- Remover (não renderizar): Extrato Bancário, PIX, OFX, Boletos

### 2. Atalhos rápidos (QuickShortcuts)
- Mostrar apenas 2 cards: **Visão Geral** e **Transferência**
- Esconder os cards de PIX, Boletos, Extrato e OFX

### 3. Últimas Movimentações (na Visão Geral)
- Como toda movimentação registrada nessa conta já é dinheiro (é o próprio caixa físico da empresa), basta manter o filtro atual por `conta_bancaria_id`. Nenhuma movimentação de PIX/boleto/cartão entra nessa conta.
- Ajustar apenas o título do card para deixar claro: **"Últimas movimentações em dinheiro"**.

### 4. Extrato (dentro da Visão Geral, opcional)
- Como o usuário pediu também um extrato apenas de entrada/saída em dinheiro, embutir uma **mini-tabela de extrato** (Data, Descrição, Entrada, Saída, Total) logo abaixo das últimas movimentações na Visão Geral — reutilizando o componente `ExtratoTabela` já existente. Assim não há necessidade da aba separada.

## Comportamento para as demais contas (bancos)
- **Sem alterações.** Itaú, Bradesco, etc. continuam com todas as abas (Visão Geral, Extrato, PIX, OFX) e todos os atalhos.

## Detalhes técnicos

- Arquivo principal: `src/pages/financeiro/ContaBancariaDetalhe.tsx`
  - Criar flag `const isCaixa = conta.tipo === 'caixa_interno'`.
  - Renderizar `TabsList` e `QuickShortcuts` condicionalmente com base em `isCaixa`.
  - Se `isCaixa`, default `aba = 'visao'` e renderizar somente os `TabsContent` de `visao` e `transferencia`.
- `src/components/financeiro/conta-detalhe/QuickShortcuts.tsx`
  - Aceitar nova prop opcional `items?: string[]` (lista de chaves a exibir). Quando passada, filtra os atalhos. Default mantém comportamento atual.
- `src/components/financeiro/conta-detalhe/VisaoGeralPanel.tsx`
  - Aceitar prop opcional `isCaixa?: boolean`.
  - Quando `isCaixa`, mudar título para "Últimas movimentações em dinheiro" e incluir `<ExtratoTabela />` abaixo.

Nenhuma mudança de banco de dados.