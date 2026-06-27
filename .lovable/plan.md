## Diagnóstico

Os logs do `zapi-webhook` mostram a causa real:

```
ERROR Gemini direct API error: { "code": 429, "RESOURCE_EXHAUSTED",
       "Your prepayment credits are depleted..." }
WARNING [order-recovery] confirmação detectada sem tag, acionando fallback
WARNING [order-recovery] LLM não devolveu bloco. reply= Desculpe, não consegui
        processar sua mensagem pelo gateway.
```

A chave direta do Google (`GEMINI_API_KEY`) está sem créditos. Em `bia-core.ts → callAI` o Gemini é a prioridade 1; quando ele falha, o código cai para o Lovable Gateway — mas o gateway também respondeu sem `[PEDIDO_CONFIRMADO]`, então a Bia respondeu texto genérico ("respondeu corretamente" para o cliente) mas o pedido não foi gravado. Mesmo problema ocorre na função auxiliar `recoverOrderBlock`, que também tenta apenas Gemini direto.

Sobre origem: hoje o ERP só usa `pedidos.canal_venda` (`site_ia` no site, `whatsapp` no WhatsApp). A coluna `pedidos.origem_pedido` existe mas não é preenchida pelas Edge Functions da Bia, então a UI cai no default ("ERP").

## Correções

### 1) Robustez do `callAI` e `recoverOrderBlock` (`supabase/functions/_shared/bia-core.ts`)
- Em `callAI`, tratar Gemini direto como melhor-esforço: se a resposta vier não-ok (429/5xx) ou sem `candidates[0].content`, registrar e cair imediatamente no próximo provedor (OpenAI → Lovable Gateway). Já existe o fall-through mas precisa ignorar respostas "vazias" do Gemini também (resposta 200 sem texto).
- Em `recoverOrderBlock` (linha ~1384), reaproveitar `callAI([...])` em vez de chamar Gemini diretamente, garantindo o mesmo fallback.
- Em `callAI`, se chegar uma resposta vazia do Lovable Gateway, lançar erro em vez de devolver string "Desculpe, não consegui processar..." — isso evita que o handler envie texto inútil sem rodar a recuperação de pedido.

### 2) Mensagem de fallback no `zapi-webhook` (`supabase/functions/zapi-webhook/index.ts`)
- No `catch` em torno de `callAI`, distinguir `CREDITS_EXHAUSTED` e `AI_ERROR_*` e responder ao cliente uma mensagem clara ("Estou com instabilidade no atendimento, já chamei um atendente humano"), em vez de seguir o fluxo e tentar gravar pedido sem dados.

### 3) Padronizar origem do pedido
- Adicionar `whatsapp_ia` ao enum em `src/lib/pedidos/origem.ts` (label "WhatsApp IA", ícone 🤖💬) e usar `ORIGEM_PEDIDO_META.whatsapp_ia` no fallback de leitura.
- `supabase/functions/bia-site-chat/index.ts` (insert do pedido):
  - `canal_venda: "site"` e `origem_pedido: "site"`.
- `supabase/functions/_shared/bia-core.ts → createOrder` (WhatsApp):
  - manter `canal_venda: "whatsapp"` e adicionar `origem_pedido: "whatsapp_ia"`.
- Garantir que a UI de pedidos (badge de origem) já lê `origem_pedido` antes de `canal_venda` — se não ler, ajustar o helper `getOrigemMeta` para receber ambos e priorizar `origem_pedido`.

### 4) Aviso ao usuário
- Não conseguimos renovar a `GEMINI_API_KEY` daqui; o usuário precisa repor crédito no Google AI Studio ou remover a variável de ambiente para o sistema usar exclusivamente o Lovable Gateway. Após a correção do fallback, o WhatsApp volta a funcionar mesmo sem Gemini direto.

## Validação

1. Mandar mensagem de teste para a Forte Gás no WhatsApp e confirmar nos logs do `zapi-webhook` que, mesmo com Gemini em 429, o pedido é criado via Lovable Gateway.
2. Conferir na lista `/vendas/pedidos`:
   - pedido criado pelo site da ForteGás aparece com badge **Site**.
   - pedido criado pelo WhatsApp aparece com badge **WhatsApp IA**.
3. Fazer um pedido pela Bia no site e confirmar que só sobe ao banco depois do "sim" final (regra já existente continua valendo).
