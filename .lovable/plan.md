# Fluxo Twilio direto → Bia (ElevenLabs)

## Novo fluxo

```text
Cliente disca 0800 OU 4337-7717-463
        │
        └─► Operadora encaminha para o nº Twilio +55 43 2398-0020
                    │
                    └─► Twilio dispara Voice Webhook (este projeto)
                              │
                              ├─ Resolve empresa pelo DID original (To/Diversion)
                              ├─ Registra em `chamadas_recebidas`
                              └─ Retorna TwiML do ElevenLabs → Bia atende
```

GoTo SIP, Vonage e Vapi **não são mais usados** no atendimento. O único caminho ativo é Twilio → ElevenLabs.

## Mudanças

### 1. `supabase/functions/twilio-voice-webhook/index.ts`
- Atualizar cabeçalho/comentários descrevendo o fluxo direto Twilio → ElevenLabs.
- Atualizar `OPERATOR_LAST10` para refletir só os números atuais:
  - `4323980020` (DID Twilio Central — quando aparece como caller depois do forward)
  - `8005900492` / `5900492` (0800 Forte Gás)
  - Remover `1152835921` (Vonage — não é mais usado).
- Manter a leitura de `SipHeader_Diversion` / `X-Original-To` (a operadora pode mandar o DID original).
- Manter fallback para DID `+554337717463` quando `did_empresa_routing` não casar.

### 2. `src/pages/admin/AdminWhatsappCentral.tsx` / configurações de telefonia (se existirem labels mencionando Vapi/GoTo/Vonage)
- Apenas atualizar textos/descrições para "Twilio + ElevenLabs". Sem mexer em rotas, providers, nem código de outros canais.

### 3. Memória do projeto
- Atualizar `mem://integrations/goto-sip-trunk-vapi`, `mem://integrations/vonage-vapi-sip` e `mem://integrations/caller-id-encaminhamento-0800` marcando como **descontinuado**.
- Criar `mem://integrations/twilio-elevenlabs-direct` com:
  - DID Twilio: **+55 43 2398-0020**
  - Voice Webhook: `https://<project>.supabase.co/functions/v1/twilio-voice-webhook`
  - Agente Bia: secret `ELEVENLABS_AGENT_ID`
  - Empresa Forte Gás identificada pelos DIDs `+554337717463` e `+554323980020` (já em `did_empresa_routing`).

## O que NÃO vai mudar

- Edge functions `vapi-*`, `vonage-voice-webhook`, `goto-webhook` ficam no repo (sem uso, mas sem deletar para não quebrar histórico). Apenas paramos de apontar webhooks externos para elas.
- `elevenlabs-bia-tools` (tools `identificar_cliente` / `criar_pedido`) continua igual — já é agnóstica de operadora.
- `chamadas_recebidas`, aba "Chamadas" da Central, Regras da Bia, Voz da Bia: nenhuma alteração.

## Configuração no painel Twilio (passo manual do usuário)

Após o deploy, no console Twilio → Phone Numbers → +55 43 2398-0020:
- **A CALL COMES IN**: Webhook → `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/twilio-voice-webhook` (HTTP POST).
- Garantir que o número está em E.164 e habilitado para receber chamadas.

## Validação

1. Ligar no 0800 → escutar a Bia atender com a voz/saudação atuais.
2. Ligar direto no 4337-7717-463 → idem.
3. Conferir que aparece linha em **Atendimento → Chamadas** com `did = +554323980020` (ou DID original se a operadora mandar Diversion) e `tipo = 'voip'`.
4. Logs de `twilio-voice-webhook` devem mostrar `Empresa resolvida pelo DID` e `register-call` 200 OK do ElevenLabs.
