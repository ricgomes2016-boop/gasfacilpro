## Objetivo
Resolver 4 problemas no app do cliente:
1. Cards de produto cortados em telas pequenas (~384px).
2. Pedidos finalizados não aparecem em "Meus Pedidos" nem abrem rastreamento.
3. Pedido entra no ERP como "Cliente não identificado".
4. Quando o endereço informado já existir no sistema, vincular ao cliente existente (e atualizar o telefone) em vez de criar um novo cadastro.

---

## 1) Responsividade mobile (`ClienteHome.tsx` – ProductCard)
No print, a imagem do produto ocupa ~30% da largura, e o botão "Add" estoura para fora.

Ajustes (somente UI, sem mexer na lógica):
- Imagem: `w-28 h-28` → `w-20 h-20 sm:w-28 sm:h-28`.
- Gap entre imagem e info: `gap-3` → `gap-2 sm:gap-3`.
- Botão "Add": mostrar só ícone de carrinho no mobile (label "Add" escondido em `<sm`).
- Stepper de quantidade: encolher para `w-6 h-6` no mobile e `w-7 h-7` em `sm`.
- Padding do `CardContent` continua `p-2`, mas reduzir paddings internos para evitar overflow.
- "Indisponível" overlay: já está OK, só verificar contraste.

Resultado esperado: três blocos (preço · stepper · botão) cabem na linha em 360–384px sem corte.

## 2) Pedido não aparece no app + rastreamento (`ClienteCheckout.tsx`, `ClienteHistorico.tsx`, `ClienteHome.tsx`)
Causa provável: o `cliente_id` gravado no pedido aponta para um registro que o app não consegue reler depois (mismatch de telefone/e-mail com a busca em `ClienteHistorico`/`ClienteHome`).

Correções:
- No `ClienteCheckout`, depois de resolver/criar o cliente, **normalizar o telefone** (apenas dígitos, com DDI) e salvar com o mesmo formato usado nas buscas posteriores.
- Persistir o `cliente_id` recém-criado em um cache local (`localStorage["app_cliente_id"]`) e usá-lo como atalho em `ClienteHistorico` e `ClienteHome` para evitar depender de matching por e-mail/telefone que pode divergir.
- `ClienteHistorico` e `ClienteHome`: ao buscar cliente, tentar **(a)** cache local, **(b)** match por `empresa_id + telefone normalizado`, **(c)** match por `empresa_id + email`. Se nada bater, exibir estado vazio coerente.
- Garantir o redirect para `/cliente/rastreamento/:pedidoId` após sucesso (já existe) e revalidar que a rota está montada no `clienteAppRoutes`.

## 3) "Cliente não identificado" no ERP
O ERP só faz join `pedidos → clientes (id, nome, …)`. Se o cliente recém-criado pelo app não casa pela RLS, o join volta `null` e cai no fallback "Cliente não identificado".

Correções no fluxo de checkout:
- Antes de inserir o pedido, garantir que o registro de cliente tenha **`nome` significativo**: se `user_metadata.nome` vier vazio, usar o nome digitado no cadastro do app (ou o telefone formatado) em vez de "Cliente App".
- Salvar também no próprio pedido campos auxiliares já existentes (ex.: `observacoes`) com `Cliente: {nome} ({telefone})` para o ERP exibir mesmo sem join.
- Confirmar via consulta que o cliente criado tem o mesmo `empresa_id` da unidade do pedido (já é o caso, mas adicionar log defensivo).

## 4) Match por endereço (auto-merge de cliente)
Antes de criar um novo registro em `clientes`, procurar um cliente existente cujo endereço bata com o que o usuário está usando no checkout.

Lógica nova em `ClienteCheckout` (antes do bloco que cria cliente):
1. Montar `enderecoCompleto` a partir do endereço selecionado/digitado.
2. Buscar em `cliente_enderecos` por `empresa_id` + (`rua` + `numero` + `bairro`) com `ilike` case-insensitive.
3. Se encontrar, pegar o `cliente_id` daquele endereço e:
   - Atualizar o `telefone` desse cliente para o telefone do usuário logado (apenas se estiver vazio ou diferente).
   - Vincular o `user_id` atual ao cliente (se houver coluna correspondente; senão, só usar o id).
4. Caso contrário, manter o fluxo atual de criar um novo cliente.

Observação: nada disso muda RLS ou schema — usa as policies existentes (`Staff can update clientes of their empresa`). O update do telefone só ocorre quando o `empresa_id` confere.

---

## Arquivos a editar
- `src/pages/cliente/ClienteHome.tsx` — ProductCard responsivo + lookup do cliente com cache.
- `src/pages/cliente/ClienteHistorico.tsx` — lookup do cliente com cache + telefone normalizado.
- `src/pages/cliente/ClienteCheckout.tsx` — normalização de telefone, match por endereço, atualização do telefone do cliente existente, gravação do cache `app_cliente_id`, nome mais significativo.

Sem migrações de banco e sem mexer em `App.tsx`/rotas.
