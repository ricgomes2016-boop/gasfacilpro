# Configuração do Ramal 1004 (SIP Trunk) no GoTo — Roteamento para Vapi

## Diagnóstico (02/05/2026)

A ligação para **0800 590 0492** chegou no GoTo, mas o ramal **1004** está
encaminhando para o celular **+55 43 99966-1816** ao invés de rotear via SIP
para a Vapi. Por isso nenhum webhook foi acionado.

Evidência: na chamada das 08:27:17 o GoTo discou para `+5543999661816`
durante 11s, conectou e a conversa de 29s foi com humano, não com IA.

---

## Passo 1 — Remover encaminhamento para celular

No **GoTo Admin → Sistema telefônico → Ramais → 1004 (Sip Trunk)**:

1. Aba **"Encaminhamento de chamadas"** / **"Call forwarding"** / **"Find Me / Follow Me"**
2. **Desativar** qualquer regra que envie para `+5543999661816`
3. Desativar também:
   - "Simultaneous ring" (toque simultâneo)
   - "Forward all calls" (encaminhar todas)
   - "Forward when busy/no answer" (se estiver apontando para celular)
4. Salvar

## Passo 2 — Habilitar registro SIP externo

Ainda no ramal 1004, procurar uma das opções:

- ✅ "Allow external SIP registration"
- ✅ "Third-party SIP device"
- ✅ "BYOD" / "Bring Your Own Device"
- ✅ "SIP credentials" / "Credenciais SIP"

Ativar e **anotar**:
- **SIP username** (geralmente algo como `1004@dominio.goto.com`)
- **SIP password** (senha SIP — NÃO é a senha da conta GoTo)
- **SIP domain / proxy** (ex.: `sip.goto.com` ou `pbx.cloud.goto.com`)
- **Porta** (5060 ou 5061)
- **Transport** (UDP / TCP / TLS)

## Passo 3 — Configurar BYO SIP Trunk na Vapi

1. Acessar **dashboard.vapi.ai → Phone Numbers → Import → BYO SIP Trunk**
2. Preencher:
   - **Name**: `GoTo Forte Gas 0800`
   - **SIP URI**: `sip:1004@<dominio-do-goto>`
   - **Username**: SIP username do passo 2
   - **Password**: SIP password do passo 2
3. Vincular ao **assistente Vapi** já criado para Forte Gás
4. Apontar `serverUrl` do assistente para:
   ```
   https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vapi-webhook
   ```

## Passo 4 — Testar

1. Ligar para **0800 590 0492** de outro celular
2. Verificar nos logs:
   - GoTo: chamada deve aparecer como "Out — SIP Trunk" e NÃO como "In — celular"
   - Vapi: deve aparecer chamada inbound no painel
   - Edge function `vapi-webhook` deve receber requisições

## Plano B — Twilio + ElevenLabs

Se a Vapi der problema com o registro SIP do GoTo, seguir o
`CONFIG_TWILIO_SIP_FORTEGAS.md` e usar a Bia (ElevenLabs) via
`twilio-voice-webhook`.

## Observação

**Nenhum código deste projeto precisa mudar.** As edge functions
`vapi-webhook` e `twilio-voice-webhook` estão prontas e funcionais. O bloqueio
é 100% configuração no GoTo.
