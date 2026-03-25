

# Diagnóstico: WhatsApp Bloqueou o Número da Central Gás

## Situação Atual

A instância `centralgas_matriz` está com `state: "close"` e `statusReason: 403`. O WhatsApp baniu/bloqueou o número `554398070028`. O último envio retornou `"Error: Connection Closed"`.

**Volume registrado:** ~50 conversas únicas, 30-70 mensagens/dia — volume baixo, mas o WhatsApp pode bloquear por outros motivos.

## Possíveis Causas do Bloqueio

1. **Mensagens proativas não solicitadas** — o sistema de auto-followup (setTimeout 5s) envia mensagens que o cliente não pediu, simulando "falar com gerente". Isso pode ser interpretado como spam.
2. **Recompra automática** — lembretes de recompra enviados a clientes que não iniciaram conversa recentemente.
3. **Número novo com volume repentino** — se o número foi conectado recentemente e já recebeu muitas conversas automatizadas.
4. **Denúncias de clientes** — basta 2-3 clientes marcarem como spam.

## Ação Imediata (Manual)

O número precisa ser **desbloqueado diretamente com o WhatsApp**:
1. Acesse https://www.whatsapp.com/contact/noclient/ e envie um recurso
2. Ou entre no WhatsApp Business do celular e siga as instruções de desbloqueio
3. Após desbloqueio, reconecte a instância no WhatsApp Manager (novo QR Code)

## Plano de Proteção no Código (Prevenir Futuros Bloqueios)

### 1. Rate Limiter por Telefone
- Em `sendMessage()` no `bia-core.ts`, adicionar verificação: se a Bia já enviou mais de **10 mensagens** para o mesmo número nas últimas **2 horas**, parar de responder e logar aviso.
- Consulta simples na tabela `ai_mensagens` antes de enviar.

### 2. Desabilitar Auto-Followup para Evolution
- O `setTimeout` de 5s que simula "falar com o gerente" é o maior risco de spam. Remover ou tornar configurável via `regras_bia`.
- Nos 5 webhooks, envolver o auto-followup com uma flag `auto_followup_ativo` (default: `false`).

### 3. Cooldown entre mensagens proativas
- Em `recompra-whatsapp-dispatch`, adicionar verificação: não enviar recompra se já enviou mensagem proativa para o mesmo número nas últimas 24h.

### 4. Detectar Connection Closed e parar
- Em `sendMessage()`, se a resposta for 400/403 com "Connection Closed", marcar a instância como `ativo = false` no banco e logar alerta. Evita tentativas repetidas que pioram a situação.

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/bia-core.ts` | Rate limiter em `sendMessage()`, auto-desativação em erro 400/403 |
| `supabase/functions/evolution-webhook/index.ts` | Flag para auto-followup, respeitar config |
| `supabase/functions/zapi-webhook/index.ts` | Mesma flag de auto-followup |
| `supabase/functions/recompra-whatsapp-dispatch/index.ts` | Cooldown 24h |
| `src/pages/config/RegrasBia.tsx` | Toggle para auto-followup |

