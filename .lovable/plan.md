## Problemas identificados (analisando o print do chat 4399199779)

### 1. Valor virou R$12.500,00 em vez de R$125,00
**Arquivo:** `supabase/functions/_shared/bia-core.ts` linha 1297

```ts
const valorCotadoRaw = String(orderData.valor ?? "")
  .replace(/[^\d.,-]/g, "")
  .replace(/\./g, "")      // ← BUG: remove TODOS os pontos
  .replace(",", ".");
```

Se a BIA escrever `valor: 125.00` (formato com ponto decimal — comum em IA), o `.replace(/\./g, "")` apaga o ponto e vira `12500` → `parseFloat = 12500`. O prompt instrui a usar `125` puro, mas o modelo frequentemente escreve `125.00` ou `125,00`.

**Correção:** parser inteligente que distingue separador decimal de milhar:
- Se a string contém `,` → ponto é milhar, vírgula é decimal (formato BR)
- Se a string contém só `.` e o último ponto tem 1-2 dígitos depois → ponto é decimal
- Caso contrário → ponto é milhar

### 2. BIA criou pedido duplicado 30min depois do primeiro
No print: pedido confirmado às 10:30 → cliente pergunta "Obg, ja saiu?" às 11:00 → BIA pergunta de novo sobre pix → cliente diz "Sim" → BIA dispara **novo** `[PEDIDO_CONFIRMADO]`.

Causas:
- `isPostOrderFollowUp` só pega frases curtas tipo "obrigado/valeu". "Obg, ja saiu?" não casa.
- Dedup em `createOrder` só checa janela de **2 minutos** (linha ~1340) — 30 min depois passa direto.
- O prompt não bloqueia explicitamente reconfirmação quando já há pedido ativo.

**Correção dupla:**
- **Em `createOrder`** (bia-core.ts ~linha 1338): ampliar a janela de dedup para **2 horas** quando já existe pedido ativo (`status in (pendente, confirmado, em_rota, agendado)`) do mesmo cliente_id no mesmo telefone. Se existir, abortar a criação e logar.
- **No `buildSystemPrompt`**: adicionar bloco quando `orderStatus` está presente (já existe pedido ativo): "🚫 NUNCA gere nova tag `[PEDIDO_CONFIRMADO]` nesta conversa. O cliente já tem pedido em andamento (#${orderStatus.id}). Se ele mandar 'obg', 'ja saiu', 'cadê', 'sim', etc, apenas confirme o status atual do pedido sem reabrir fluxo de venda."

### 3. Chat exibe "Cliente" em vez do nome real
No print: aparece "Cliente 4399199779" na lista. O título da conversa é gravado em `ai_conversas.titulo` por `upsertConversation` usando `cliente.nome || senderName || normalized`.

Causa: nos webhooks (`gateway-webhook`, `evolution-webhook`, `meta-webhook`, `uazapi-webhook`, `zapi-webhook`) o `findCliente(supabase, phone)` é chamado **sem** o `senderName`, então o pushName do WhatsApp nunca atualiza o cadastro nem entra no título. Para clientes antigos com `nome = "Cliente"` (genérico), o título fica eternamente "Cliente".

**Correção:**
- Passar `senderName` para `findCliente` em todos os 5 webhooks (`findCliente(supabase, phone, senderName)`).
- Em `upsertConversation`: se o `title` recebido contém apenas "Cliente"/"WhatsApp: Cliente"/telefone e existe `senderName` melhor, preferir o pushName.
- No prompt da BIA (linha 909): trocar `nome: ${cliente.nome || "Cliente"}` para também aceitar o `senderName` real do WhatsApp.

## Arquivos a editar
- `supabase/functions/_shared/bia-core.ts` — parser de valor, dedup 2h, prompt anti-reconfirmação
- `supabase/functions/gateway-webhook/index.ts` — passar senderName ao findCliente
- `supabase/functions/evolution-webhook/index.ts` — idem
- `supabase/functions/meta-webhook/index.ts` — idem
- `supabase/functions/uazapi-webhook/index.ts` — idem
- `supabase/functions/zapi-webhook/index.ts` — idem

## Deploy
Após edits, redeploy dos 5 webhooks.

## Fora de escopo
- Não mexer em UI/layout do chat
- Não mexer em finance, estoque ou roteirização
- Não unificar `tabela_precos` × `produtos.preco` (já decidido manter cotação BIA como fonte da verdade)
