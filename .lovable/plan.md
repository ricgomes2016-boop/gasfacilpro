## Diagnóstico

Investiguei os pedidos da unidade **Morumbi Gás** e o código de `src/pages/caixa/AcertoEntregador.tsx`. Encontrei duas causas raiz independentes que explicam tudo que você descreveu:

### 1. Filtro do canal "🔥 Gás do Povo" não casa com a forma de pagamento real
O canal **Gás do Povo** usa hoje o filtro:
```
forma_pagamento.eq.gas_do_povo  OR  forma_pagamento.ilike.%gas_do_povo%
```
Mas na sua base os pedidos foram salvos com o texto **"Gás do Povo"** (com acento e espaços). `ILIKE` é case-insensitive mas **não ignora acentos nem espaços**, então `%gas_do_povo%` **não casa** com `Gás do Povo`.

Resultado:
- Pedidos #3 a #6 (forma `gas_do_povo` minúsculo) aparecem no canal Gás do Povo ✅
- Pedidos **#9, #10, #11, #12, #485, #486, #487** (forma `Gás do Povo`) **só aparecem no canal Portaria** ❌

Isso é o motivo do "**resumo automático mostrando dados que parecem de outra empresa**": ao abrir o canal Portaria, o resumo soma vendas de programa Gás do Povo junto com vendas comuns de portaria. Não é vazamento entre empresas — é a mistura indevida de canais dentro da mesma unidade.

### 2. Acerto da entrega #9 não finalizou
Pedido #9 está no banco como `status = entregue`, `responsavel_acerto = portaria`, `forma_pagamento = "Gás do Povo"`.

Se você clicou no canal **🔥 Gás do Povo** para fazer o acerto, o #9 **nem apareceu** na lista (pelo mesmo bug do filtro acima), então o `confirmarAcerto` nunca passou por ele. Pela tela ele continuou "entregue".

Você confirmou que usou o canal **🏪 Portaria**. Nesse caso o #9 aparece, então o problema é diferente: o `confirmarAcerto` chama `rotearPagamentosVenda` antes do `update`. Como o roteamento usa `Promise.allSettled` (não joga erro pra cima), se houve falha individual ela ficou apenas no console e o status deveria ter sido atualizado — mas só **se** o `update` realmente atingiu a linha. Como hoje não temos verificação do retorno, qualquer 0-rows passa em silêncio.

## Plano

Apenas mudanças frontend em `src/pages/caixa/AcertoEntregador.tsx`. Sem migração, sem mudanças no roteamento financeiro, sem mexer em RLS.

### A. Corrigir o filtro do canal "Gás do Povo"
Trocar a query do `__gas_do_povo__` por um filtro robusto que cubra todas as variações ortográficas e também o caso onde `responsavel_acerto = 'gas_do_povo'`:
```ts
query = query.or([
  "forma_pagamento.eq.gas_do_povo",
  "forma_pagamento.ilike.%gas%povo%",
  "forma_pagamento.ilike.%gás%povo%",
  "responsavel_acerto.eq.gas_do_povo",
].join(","));
```
`ilike '%gas%povo%'` casa `Gás do Povo`, `gas_do_povo`, `Gas Do Povo`, etc.

### B. Excluir Gás do Povo do canal Portaria
Adicionar `.not("forma_pagamento", "ilike", "%gas%povo%")` quando o canal selecionado for Portaria/PDV. Assim cada pedido aparece em exatamente um canal e o "Resumo Automático" deixa de misturar.

### C. Garantir feedback real ao finalizar
No loop do `confirmarAcerto`, mudar o update para retornar a linha e contabilizar falha quando 0 linhas forem afetadas:
```ts
const { data: updated, error: updErr } = await supabase
  .from("pedidos")
  .update({ status: "finalizado" })
  .eq("id", entrega.id)
  .eq("unidade_id", unidadeAtual.id)
  .select("id")
  .maybeSingle();
if (updErr) throw updErr;
if (!updated) throw new Error("Status não atualizado (RLS ou linha não encontrada)");
```
Isso impede que um pedido fique "fantasma" como #9.

### D. Re-finalizar manualmente os pedidos órfãos
Após o deploy, abrir a tela já corrigida na unidade Morumbi, canal Gás do Povo, período 03/06–10/06, e clicar em "Confirmar Acerto". Isso vai mover #9, #10, #11, #12, #485, #486, #487 para `finalizado` e gerar os recebíveis do programa Gás do Povo automaticamente.

## Não está no escopo
- RLS / migrações no banco
- Lógica de `rotearPagamentosVenda`
- Coluna "Nº", coluna "Data" e relatório PDF (já entregues nas iterações anteriores)
- Cards "Entregadores com acerto pendente" (já filtrados por `unidade_id`)
