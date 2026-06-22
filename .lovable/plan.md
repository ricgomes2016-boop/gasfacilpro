## Objetivo
Transformar os cards de Contas Bancárias em "portais" do banco: ao clicar no card, abre uma página dedicada da conta com identidade visual do banco escolhido (cores/logo estilo PagBank, Itaú, Bradesco, etc.) e contendo Saldo, Extrato (entrada/saída), Transferência e Importação OFX como abas internas — liberando espaço na listagem principal.

## Mudanças

### 1. Nova rota e página da conta
- Rota: `/financeiro/contas-bancarias/:contaId`
- Arquivo novo: `src/pages/financeiro/ContaBancariaDetalhe.tsx`
- Carrega a conta pelo `id`, valida `unidade_id`/`empresa_id` e renderiza o "tema do banco".

### 2. Tema visual por banco
- Arquivo novo: `src/lib/bancos/bankThemes.ts` com mapa: `{ banco: { nome, cor primária, cor secundária, gradiente header, logo/iniciais, textColor } }`.
- Bancos cobertos inicialmente: PagBank, Itaú, Bradesco, Banco do Brasil, Santander, Caixa, Nubank, Inter, Sicoob, Sicredi, C6, BTG. Fallback genérico para outros.
- Header da página usa o gradiente/cor do banco, mostra logo/iniciais, nome da conta, agência/conta, e o Saldo Atual em destaque (estilo "app do banco").

### 3. Abas dentro da página da conta
Componente `Tabs` com:
- **Extrato**: tabela com colunas Data, Descrição, Categoria, Entrada, Saída, Saldo acumulado. Filtros por período. Lê de `extrato_bancario` + `movimentacoes_bancarias` filtrando por `conta_bancaria_id`. Totais de entradas/saídas no topo.
- **Transferência**: formulário para transferir entre contas (reaproveita lógica atual de `transferencias_bancarias`) + histórico das transferências envolvendo essa conta.
- **OFX**: upload e conciliação OFX restritos a essa conta (reaproveita componente atual da aba OFX, pré-selecionando a conta).

### 4. Tela `ContasBancarias.tsx` (listagem)
- Remover as abas globais "Extrato", "Transferência" e "OFX" da página de listagem (movidas para dentro de cada conta).
- Mantém: cards de saldo por conta + criação/edição de conta + transferências rápidas opcional (atalho).
- Cada card vira clicável (`onClick` → navega para `/financeiro/contas-bancarias/:id`), com `cursor-pointer`, `hover` sutil e badge da cor do banco.
- Botões de ação (editar/excluir) param a propagação para não abrir a página.

### 5. Roteamento
- `src/routes/financeiroRoutes.ts`: adicionar entrada para `/financeiro/contas-bancarias/:contaId` apontando para o novo componente, mesmos `FINANCE_ROLES`.

## Regras preservadas
- Filtro obrigatório por `unidade_id`/`empresa_id` em todas as queries (saldo, extrato, transferências, OFX).
- Sem refatorar `App.tsx`, providers ou estrutura de rotas existente além da nova linha.
- Tokens semânticos (sem cores hardcoded em componentes — paleta dos bancos vai em `bankThemes.ts` como tokens locais aplicados via `style` no header, mantendo o restante do layout com tokens do design system).
- Radix Select continua usando `"nenhum"` quando precisar de valor vazio.

## Entregáveis
- `src/lib/bancos/bankThemes.ts` (novo)
- `src/pages/financeiro/ContaBancariaDetalhe.tsx` (novo)
- `src/pages/financeiro/ContasBancarias.tsx` (editado — remove abas, cards clicáveis)
- `src/routes/financeiroRoutes.ts` (editado — nova rota)
