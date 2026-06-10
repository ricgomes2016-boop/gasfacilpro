## Problema
No canto inferior direito do ERP, dois botões flutuantes ocupam a mesma posição e se sobrepõem:
- **Assistente IA** (roxo) — `AiFloatingButton.tsx` em `bottom-6 right-6`, visível em `md+`
- **WhatsApp Chat** (verde) — `WhatsAppFloatingChat.tsx` em `bottom-4 right-4`, visível em `xl+`

Em telas `xl+` os dois aparecem no mesmo ponto.

## Solução
Empilhar verticalmente, mantendo o WhatsApp como botão inferior (mais usado) e subindo o Assistente IA acima dele.

### Alterações
1. **`src/components/atendimento/WhatsAppFloatingChat.tsx`**
   - Manter posição atual: `bottom-4 right-4` (xl+).

2. **`src/components/ai/AiFloatingButton.tsx`**
   - Alterar botão de `bottom-6 right-6` para:
     - `bottom-6 right-6` em `md` até `lg` (sem WhatsApp visível → sem conflito)
     - `xl:bottom-24` (sobe ~72px acima do WhatsApp) quando o WhatsApp aparece
   - Resultado: `className="hidden md:flex fixed bottom-6 right-6 xl:bottom-24 z-40 h-14 w-14 ..."`
   - Ajustar também o painel aberto (`md:bottom-16`) para `xl:bottom-[136px]` para não cobrir o botão do WhatsApp quando o chat IA está aberto.

### Resultado
- `md`–`lg`: apenas botão IA no canto (sem mudança visível).
- `xl+`: WhatsApp embaixo, Assistente IA empilhado acima, sem sobreposição.

Sem mudanças em lógica, rotas ou backend — apenas posicionamento CSS.