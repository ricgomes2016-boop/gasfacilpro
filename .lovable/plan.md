## Reestruturar página de detalhe da Conta Bancária

Reorganizar a página `ContaBancariaDetalhe.tsx` para ter, após o card colorido do banco, **abas principais + atalhos rápidos**, e adicionar suporte a **PIX** e **Boletos**.

### Nova estrutura da página

```text
[Card colorido do banco — mantém igual]

[Tabs principais]  Visão Geral | Extrato | PIX | OFX

[Linha de cards-atalho rápidos]
 [PIX]  [Boletos]  [Extrato]  [Transferência]  [OFX]
  ↑ cada card seta a aba ativa correspondente

[Conteúdo da aba ativa]
```

Os 5 cards-atalho ficam **sempre visíveis** abaixo das tabs e funcionam como botões para trocar de aba (controlado via `useState`, não mais `defaultValue`).

### Abas e conteúdo

1. **Visão Geral** — resumo: saldo, últimas 5 movimentações, últimas 3 transferências, atalho rápido.
2. **Extrato Bancário** — tabela com colunas exatas: **Data | Descrição | Entrada | Saída | Total (saldo acumulado)**. Filtro de período no topo. Usa `movimentacoes_bancarias` filtradas por `conta_bancaria_id`.
3. **PIX** (nova aba, com sub-tabs internas)
   - **Chaves cadastradas**: lista chaves PIX da conta.
   - **Cadastrar chave**: form (tipo: CPF/CNPJ/Email/Telefone/Aleatória + valor).
   - **Pagar com PIX**: abre modal que lista contas a pagar (`contas_pagar` com status pendente). Ao selecionar, debita do saldo da conta atual, cria movimentação de saída e marca o título como pago.
4. **Boletos** (nova aba)
   - **Pagar boleto**: lista `contas_pagar` cujo tipo/forma é boleto. Selecionar → baixa saldo + marca pago + cria movimentação.
5. **Transferência** — mantém o formulário e histórico atual.
6. **OFX** — mantém componente `Conciliacao` embedded.

### Tabelas de banco necessárias

- **Nova**: `contas_pix_chaves` (id, conta_bancaria_id, tipo, chave, unidade_id, empresa_id, created_at) com RLS por unidade + GRANTs.
- **Reutilizadas**: `contas_pagar`, `movimentacoes_bancarias`, `contas_bancarias`, `transferencias_bancarias`.

Migração será criada via tool de migração (com GRANTs + RLS).

### Componentes a criar

- `src/components/financeiro/conta-detalhe/PixPanel.tsx` — sub-tabs chaves/cadastrar/pagar.
- `src/components/financeiro/conta-detalhe/BoletosPanel.tsx` — listar e pagar boletos.
- `src/components/financeiro/conta-detalhe/VisaoGeralPanel.tsx` — resumo.
- `src/components/financeiro/conta-detalhe/ExtratoTabela.tsx` — tabela Data/Descrição/Entrada/Saída/Total.
- `src/components/financeiro/conta-detalhe/QuickShortcuts.tsx` — linha dos 5 cards-atalho clicáveis.

### Pontos técnicos

- Estado da aba via `useState` para permitir que os cards-atalho mudem a aba.
- Tabs principais com estilo já existente (cores do `bankTheme`).
- Pagamento PIX/Boleto: atualização atômica do saldo + insert em `movimentacoes_bancarias` + update em `contas_pagar` (status `pago`, `data_pagamento`, `conta_bancaria_id`).
- Validação de saldo insuficiente.
- Toast de sucesso/erro e invalidação de queries.
- Manter `TabsList` interno do `ExtratoBancario` removido (substituído pela TabsList principal acima).

### Confirmações antes de implementar

1. Confirma criar a nova tabela `contas_pix_chaves`? (necessária para "ver/cadastrar chaves")
2. Para pagamento via PIX/Boleto: deve **realmente baixar o título em `contas_pagar`** + criar movimentação na conta, certo? (sem integração real com banco — apenas registro interno)
