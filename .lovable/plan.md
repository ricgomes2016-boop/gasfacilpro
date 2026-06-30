
## Objetivo
Entregador envia o pedido pelo **mesmo WhatsApp da loja** (o que já roda a Bia). Quando a mensagem vem do telefone de um entregador cadastrado e ativo da unidade, o sistema desvia para o fluxo de "Lançamento por entregador" — a Bia entende o texto livre, confirma com ele e cria os pedidos no ERP.

## Fluxo do entregador

1. Entregador escreve no WhatsApp da loja:
   ```
   1 gas, rua Ceará 331, 100 pix
   3 gas padaria da tia lena, 100,00 dinheiro
   1 gas rua Augusto Sicoli 105, 110 dinheiro
   ```
2. Bia responde, dentro do mesmo chat:
   ```
   👋 Olá, [nome do entregador]. Confirma 3 lançamentos?
   #1 Rua Ceará, 331 · 1× Gás P13 · R$ 100 · PIX
   #2 Padaria da Tia Lena · 3× Gás P13 · R$ 100 · Dinheiro
   #3 Rua Augusto Sicoli, 105 · 1× Gás P13 · R$ 110 · Dinheiro
   Responda OK para lançar tudo, ou ajuste (ex.: "remover 2").
   ```
3. `OK`/`sim`/`confirmo` → cria os pedidos. `Não`/`cancelar` → descarta o rascunho. Edições simples (remover linha, trocar pagamento, alterar valor/quantidade) atualizam o rascunho antes do OK.
4. Após criar, Bia confirma com o número dos pedidos gerados no sistema:
   `✅ Pedidos #1023, #1024, #1025 lançados em rota com você.`

## Identificação de quem está mandando

Hoje todo webhook entra por `_shared/bia-core.ts`. Vai ser adicionado, **logo no início do `resolveConfig`/handler de mensagem**, um passo de classificação:

1. Normaliza o telefone do remetente (DDI 55).
2. Busca em `entregadores` `WHERE telefone_normalizado = $1 AND ativo = true AND unidade_id = $unidade_da_instancia`.
3. Match → marca a mensagem como `modo='entregador'` e segue para o novo handler.
4. Sem match → segue o fluxo atual da Bia de atendimento ao cliente, **sem nenhuma alteração**.

Isso garante: o cliente que mandar mensagem continua sendo atendido normalmente; só números cadastrados como entregador entram no novo modo. Não cria número novo, não muda integração existente.

## Parsing e rascunho

- Uma chamada de IA por mensagem (com fallback Lovable Gateway → OpenAI já existente no `callAI`) devolvendo JSON estruturado:
  ```
  { pedidos: [
    { quantidade, produto, cliente_texto, endereco_texto, valor, forma_pagamento }
  ]}
  ```
- Normalização em código (não na IA):
  - Produto: `gas`/`gás`/`p13` → `Gás P13` (regra `product-naming-convention`).
  - Pagamento: dicionário curto (`pix`, `dinheiro`, `cartão`, `fiado`).
  - Valor: aceita `100`, `100,00`, `R$ 100`.
  - Quantidade default = 1.
- Rascunho fica em `bia_followups` (tabela já existe) chaveado pelo telefone, com expiração de 10 min. Aguarda o `OK` antes de criar qualquer pedido.

## Resolução de cliente/endereço

Para cada linha:
1. Match em `clientes` + `cliente_enderecos` via RPC `autocomplete_clientes_v2`, filtrado pela unidade.
2. Score único forte → usa esse cliente e endereço.
3. Sem match → cria como **cliente avulso** automaticamente (`Cliente Rua Ceará 331`) — a opção que o entregador escolheu para não travar. O entregador pode informar nome depois.
4. Múltiplos matches próximos → Bia lista até 3 e pede `1/2/3`.

## Criação do pedido

Reutiliza exatamente o caminho que a Bia já usa (`criar_pedido` com `confirmado_pelo_cliente=true`), preenchendo:

- `unidade_id` e `empresa_id` da instância de WhatsApp.
- `entregador_id` = do remetente.
- `status` = `em_rota` (entregador já está com o produto na mão).
- `canal_venda` = `whatsapp`.
- `origem_pedido` = novo valor `whatsapp_entregador` (rótulo "Entregador WhatsApp" 🛵, adicionado em `src/lib/pedidos/origem.ts`).
- Item: produto + quantidade + `preco_unitario = valor/qtd`.
- Forma de pagamento e Contas a Receber seguem regras existentes (`isFormaAVista`, `paymentRoutingService`): PIX/Dinheiro liquidam imediato; fiado vira a receber.

## Onde mexer

- `supabase/functions/_shared/bia-core.ts` — adicionar o branch "modo entregador" e o gerador de resumo/confirmação. Sem tocar nas regras atuais da Bia cliente.
- Novo arquivo `supabase/functions/_shared/bia-entregador.ts` — parser, draft em `bia_followups`, montagem do pedido.
- `src/lib/pedidos/origem.ts` — novo valor `whatsapp_entregador`.
- (Opcional) flag em `Configurações → Integrações WhatsApp` para ligar/desligar o modo por unidade. Default ligado.

## Garantias de estabilidade

- Mantém o número da loja e a Bia de cliente intactos — desvio é apenas por telefone do remetente.
- Não altera `App.tsx`, autenticação, rotas, RLS, app do entregador APK, financeiro, estoque, fluxo de vendas.
- Pedido só nasce após `OK` explícito (sem falsos positivos).
- Se IA falhar/parser não entender, Bia responde com o formato esperado e nada é criado.

## Fora do escopo agora

- Comandos avançados ("cancelar pedido #X" via WhatsApp).
- Áudio (entregador mandando voz) — pode entrar depois reaproveitando o STT já usado.
- Mais de um produto por linha (`1 gás + 1 água`). Primeiro lote: 1 produto por linha.
