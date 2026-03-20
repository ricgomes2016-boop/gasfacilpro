

# Corrigir: Bia nao respeita horario de atendimento

## Problema

Quando `isOffHours = true`, o sistema **nao bloqueia** o atendimento. Ele apenas adiciona uma linha no prompt da IA dizendo "FORA DO HORÁRIO: Informe fechamento e ofereça agendamento." — mas a IA continua processando normalmente e muitas vezes ignora essa instrucao, atendendo o cliente como se estivesse aberto.

A linha responsavel (bia-core.ts, ~598):
```
${isOffHours ? `FORA DO HORÁRIO (${horarioInfo}): Informe fechamento e ofereça agendamento.` : ""}
```

Isso e apenas uma sugestao no prompt — nao ha bloqueio real.

## Solucao

Adicionar um **bloqueio hard-coded** em todos os webhooks: quando `isOffHours = true`, enviar uma mensagem fixa diretamente ao cliente **sem chamar a IA**. A mensagem informa o horario e oferece agendamento.

### Alteracoes

**1. `bia-core.ts` — Nova funcao `getOffHoursMessage`**
Criar funcao que retorna a mensagem padrao de fora do horario, usando o nome do cliente e o horario de funcionamento:
```
"Oi [nome]! No momento estamos fechados. 
Nosso horário de funcionamento é [horarioInfo]. 
Se quiser, posso agendar seu pedido para quando abrirmos! 
Basta me dizer o que precisa. 😊"
```

**2. Todos os webhooks (evolution, gateway, meta, zapi, uazapi)**
Apos o `checkBusinessHours`, antes de chamar a IA:
```
if (bh.isOffHours) {
  const reply = getOffHoursMessage(cliente.nome, bh.horarioInfo);
  await saveMessage(supabase, conversationId, "assistant", reply, { source: "...", off_hours: true });
  await sendMessage(config, phone, reply);
  return OK({ ok: true, skipped: "off_hours" });
}
```

Isso garante que **nenhuma chamada a IA** acontece fora do horario — a resposta e instantanea e deterministica.

**3. Excecao para agendamento**
Se o cliente ja estava em conversa de agendamento (ultima mensagem da Bia menciona "agendar"), permitir que a IA processe — mas com prompt restrito apenas a agendamento, sem permitir venda imediata.

### Arquivos modificados
- `supabase/functions/_shared/bia-core.ts` — adicionar `getOffHoursMessage()`
- `supabase/functions/evolution-webhook/index.ts` — bloqueio hard
- `supabase/functions/gateway-webhook/index.ts` — bloqueio hard
- `supabase/functions/meta-webhook/index.ts` — bloqueio hard
- `supabase/functions/zapi-webhook/index.ts` — bloqueio hard
- `supabase/functions/uazapi-webhook/index.ts` — bloqueio hard

