## Plano: Migração da Bia para SIP Trunk nativo da ElevenLabs

Hoje a chamada percorre 4 saltos: **GoTo 0800 → Vonage → Twilio → ElevenLabs**. Isso gera latência, custo duplicado (Vonage + Twilio), e perda de caller-id no encaminhamento PSTN.

A ElevenLabs aceita SIP Trunk nativo (autenticação por credencial) — exatamente o formato que a GoTo já entregou no ramal 1004. Vamos eliminar Vonage e Twilio do caminho de voz.

### Arquitetura nova

```text
Cliente → 0800 590 0492 (GoTo)
        → SIP Trunk ramal 1004 (TLS)
        → ElevenLabs (Bia)
            ↳ webhook initiation  → identifica empresa + cliente
            ↳ tools (já existem)  → identificar_cliente / criar_pedido
            ↳ webhook post-call   → grava chamadas_recebidas
```

### Etapas

**1. Configuração externa (você faz no painel)**
- **GoTo**: confirmar que "Encontre-me/Siga-me" do ramal 1004 está desligado (já documentado em `CONFIG_GOTO_RAMAL_1004.md`).
- **ElevenLabs → Agent → Phone Numbers → Import SIP Trunk**:
  - Termination URI: `sip:reg.jiveip.net`
  - Auth User: `53LcZzueOL72RsONRVMAe6ag0XSlFe`
  - Auth Password: `ZrBAJEsTuX8Bfaut`
  - Phone Number: `+5508005900492`
  - Transport: TLS (fallback UDP)
  - Atribuir ao agente "Bia – Forte Gás"

**2. Novos webhooks (eu crio)**
A ElevenLabs nativa usa dois webhooks dedicados em vez do `twilio-voice-webhook` atual:

- `supabase/functions/elevenlabs-call-initiation/index.ts`
  - Recebe `caller_id`, `agent_id`, `called_number` da ElevenLabs antes de iniciar a conversa.
  - Resolve empresa via `resolver_empresa_por_did` (mesma RPC usada hoje).
  - Resolve cliente pelo telefone (se confiável — mesma lógica de `OPERATOR_LAST10`).
  - Insere registro em `chamadas_recebidas` (popup Bina).
  - Retorna JSON com `dynamic_variables`: `caller_phone`, `caller_confiavel`, `empresa_id`, `empresa_nome`, `unidade_id`.

- `supabase/functions/elevenlabs-call-postcall/index.ts`
  - Recebe transcript + duração no fim da chamada.
  - Atualiza `chamadas_recebidas` com `duracao`, `transcript`, `status=finalizada`.

Ambas em `supabase/config.toml` com `verify_jwt = false` (webhooks externos).

**3. Configuração na ElevenLabs (você faz no painel)**
- Agent → Webhooks:
  - Conversation Initiation: `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/elevenlabs-call-initiation`
  - Post-call: `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/elevenlabs-call-postcall`
- Marcar "Fetch initiation client data from webhook" no agente.

**4. Manter como fallback (não remover ainda)**
- `twilio-voice-webhook` e `vonage-voice-webhook` ficam deployados por ~7 dias.
- Vonage/Twilio numbers continuam ativos, mas **sem encaminhamento ativo** do GoTo.
- Se algo quebrar no SIP direto, basta reativar o forward GoTo→Vonage no painel.

**5. Após validação (~7 dias estáveis)**
- Cancelar número Vonage (+55 11 5283-5921) — economia mensal.
- Cancelar número Twilio (+1 478-429-7119) — economia em USD.
- Deletar `vonage-voice-webhook` e `twilio-voice-webhook`.
- Atualizar `CONFIG_GOTO_0800_FORWARD.md` para refletir nova arquitetura.

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/elevenlabs-call-initiation/index.ts` | criar |
| `supabase/functions/elevenlabs-call-postcall/index.ts` | criar |
| `supabase/config.toml` | adicionar blocos `[functions.elevenlabs-call-initiation]` e `[functions.elevenlabs-call-postcall]` com `verify_jwt = false` |
| `CONFIG_ELEVENLABS_SIP_DIRECT.md` | criar (guia passo a passo painel ElevenLabs) |
| `twilio-voice-webhook`, `vonage-voice-webhook` | **NÃO TOCAR** nesta fase (fallback) |

### Variáveis dinâmicas enviadas para a Bia

Idênticas às atuais — o prompt do agente não muda:
- `caller_phone`, `caller_confiavel`, `called_number`, `call_sid`
- `empresa_id`, `empresa_nome`, `unidade_id`

Lógica de "caller-id operadora" replicada no `elevenlabs-call-initiation`, então a Bia continua perguntando o telefone quando a GoTo não enviar caller-id real via SIP header (`Diversion`/`P-Asserted-Identity`).

### Ganhos esperados

- **Latência**: ~300-600ms a menos (eliminação de 2 saltos PSTN).
- **Custo**: cancela mensalidade Vonage SP + Twilio US.
- **Caller-id**: SIP TLS direto preserva headers nativos da GoTo (maior chance de receber número real).
- **Manutenção**: 1 webhook em vez de 2 (vonage + twilio).

### Risco e mitigação

- Risco: ElevenLabs pode não aceitar registro no `reg.jiveip.net` por incompatibilidade de codec/transport. 
- Mitigação: fallback Vonage+Twilio fica deployado e rapidamente reativável (5 min no painel GoTo).

Quero que eu implemente?
