## Diagnóstico

Verifiquei a Vapi via API e confirmei:

- **SIP endpoint ativo**: `sip:vonage-fortegas@sip.vapi.ai` → linkado à Bia ✅
- **Webhook configurado**: `vapi-webhook` Edge Function ✅
- **Chamadas inbound recebidas**: **ZERO** ❌

Conclusão: a chamada **não está saindo da Vonage para a Vapi**. O problema está no encaminhamento configurado no painel da Vonage, não na Vapi nem no nosso backend.

## Causas mais prováveis (em ordem)

1. **Encaminhamento SIP não foi salvo / está desativado** no número `+55 11 5283-5921` na Vonage.
2. **Formato do SIP URI incorreto** no campo da Vonage. A Vonage costuma exigir o formato completo:
   - ❌ `sip:vonage-fortegas@sip.vapi.ai` (só o URI)
   - ✅ `vonage-fortegas@sip.vapi.ai` (sem o prefixo `sip:`, dependendo do campo)
   - Algumas interfaces da Vonage pedem URI + porta: `sip:vonage-fortegas@sip.vapi.ai:5060`
3. **Aplicação Voice não vinculada ao número** — Vonage exige que o número esteja associado a uma "Voice Application" antes de aceitar forward.
4. **Saldo zerado** na conta Vonage (forward SIP é cobrado).
5. **NCCO/Webhook interceptando** — se você configurou um Answer URL antes, ele tem prioridade sobre o forward.

## Plano de ação

### Passo 1 — Validar configuração no painel Vonage (você)
Acessar **Numbers → Your numbers → +55 11 5283-5921 → Edit** e me mandar print de:
- Campo "Forward to" (tipo selecionado e URI digitado)
- Aplicação vinculada (se existir)
- Saldo da conta no canto superior

### Passo 2 — Teste alternativo via Vapi (eu)
Se a config visual parecer correta, eu disparo uma chamada **outbound de teste pela Vapi → seu celular** usando a API. Isso valida se o assistente Bia está funcional ponta-a-ponta, isolando o problema na Vonage.

### Passo 3 — Configurar via API Vonage (caso você prefira)
Se você me liberar a `VONAGE_API_KEY` e `VONAGE_API_SECRET` como secrets, eu configuro o forward SIP direto via API e elimino a chance de erro no painel:
```
PUT https://rest.nexmo.com/account/numbers/update
- voiceCallbackType: sip
- voiceCallbackValue: sip:vonage-fortegas@sip.vapi.ai
```

### Passo 4 — Plano B se Vonage continuar travando
Se o forward SIP da Vonage não funcionar de jeito nenhum, podemos:
- **Opção A**: usar o número da Vonage com webhook NCCO (eu crio uma edge function `vonage-voice-webhook` que retorna NCCO `connect` para o SIP da Vapi). Mais controle, debugável via logs.
- **Opção B**: portar a estratégia para Twilio Elastic SIP Trunk (já temos credenciais).

## O que fazer agora

**Me confirme**: você quer (1) primeiro mandar print da config Vonage pra eu auditar, (2) liberar credenciais Vonage pra eu configurar via API, ou (3) já partir pro Plano B com webhook NCCO?
