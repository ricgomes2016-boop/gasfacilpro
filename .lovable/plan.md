

# Conectar SIP Trunk do GoTo (ramal 1004) à Vapi

## Contexto

A primeira chamada para `0800 590 0492` foi sequestrada por um forward "Encontre-me/Siga-me" no usuário do ramal 1004, que enviou para o celular `+5543999661816`. O dispositivo SIP Trunk no GoTo já está **licenciado e registrado no diretório**, mas está **"Indisponível"** porque nenhum cliente SIP externo (Vapi) ainda se conectou a ele.

## Estado atual confirmado pelos prints

```
GoTo SIP Trunk (ramal 1004)
├── Licença ........... Licenciado ✅
├── Registro .......... Registrado ✅
├── Disponibilidade ... INDISPONÍVEL ❌ (ninguém logou ainda)
├── Senha SIP ......... 1017197255 ✅ (capturada)
├── Proxies ........... Padrão do sistema ✅
├── Forward p/ celular  AINDA ATIVO em outra tela ❌
└── SIP URI/Username .. AINDA NÃO LOCALIZADO ❌
```

## Etapa 1 — Capturar as credenciais SIP que faltam

No GoTo Admin, clicar em **"Editar"** no card **Detalhes** (Print 1) ou rolar a aba **Configurações → Avançadas** até o fim. Procurar uma seção tipo:
- "Credenciais SIP" / "SIP credentials"
- "Provisionamento manual" / "Manual provisioning"
- "Linhas SIP" / "SIP Lines"

Anotar:
- **SIP Server / Domain / Registrar** (algo como `sip.goto.com`, `pbx.cloud.goto.com` ou `*.gotoconnect.com`)
- **SIP Username / Auth ID** (NÃO é "1004", costuma ser um ID gerado)
- **Transport** (UDP 5060 ou TLS 5061)

A **senha** já temos: `1017197255`.

> Se essas opções não aparecerem na tela, o caminho alternativo é:
> **Sistema telefônico → Troncos SIP** ou **Configurações → Voz → SIP** no menu lateral.

## Etapa 2 — Desativar o forward para o celular

Ir em **Pessoas → [Usuário dono do ramal 1004] → Encontre-me/Siga-me** (não é na tela do dispositivo) e:
- Remover a Etapa 1 que envia para `+55 43 99966 1816`
- Manter apenas: "Tocar no dispositivo SIP Trunk" → "Caso não atenda → Correio de voz"

## Etapa 3 — Configurar BYO SIP Trunk na Vapi

No `dashboard.vapi.ai → Phone Numbers → Import → BYO SIP Trunk`:

| Campo | Valor |
|---|---|
| Name | `GoTo Forte Gas 0800` |
| SIP URI | `sip:<username-da-etapa-1>@<server-da-etapa-1>` |
| Username | username da Etapa 1 |
| Password | `1017197255` |
| Transport | mesmo da Etapa 1 |

Vincular ao **assistente Vapi** já criado para Forte Gás e apontar `serverUrl` do assistente para:
```
https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vapi-webhook
```

## Etapa 4 — Validar registro

Voltar ao Print 1 (Visão geral do SIP Trunk) e clicar em **"Ressincronizar o dispositivo"**. Após 1–2 minutos:
- Status deve mudar de 🔴 **Indisponível** → 🟢 **Disponível**
- **IP público** deve mostrar o IP da Vapi
- **Sincronização** deve mostrar timestamp recente

## Etapa 5 — Teste fim-a-fim

Ligar para `0800 590 0492` de outro celular. Fluxo esperado:
```
Celular → 0800 → GoTo PBX → Ramal 1004 (SIP Trunk)
       → SIP externo → Vapi → Assistente Bia → vapi-webhook ✅
```

Verificar nos 3 painéis:
- **GoTo Análise**: chamada como "Atendida pelo dispositivo SIP", duração > 0s
- **Vapi Dashboard**: chamada inbound aparecendo
- **Lovable Cloud → Edge Functions → vapi-webhook**: logs com `tool-calls`

## Plano B (se Vapi não registrar no GoTo)

Migrar para **Twilio Elastic SIP Trunking + ElevenLabs (Bia)** seguindo `CONFIG_TWILIO_SIP_FORTEGAS.md`. A edge function `twilio-voice-webhook` já está pronta. Custo: ~US$ 0,007/min de SIP termination + uso ElevenLabs.

## Nada muda no código

Edge functions `vapi-webhook` e `twilio-voice-webhook` já estão prontas e funcionais. **Nenhuma alteração de código é necessária.** O bloqueio é 100% configuração externa (GoTo + Vapi).

## Documentação a atualizar

- `CONFIG_GOTO_RAMAL_1004.md` — anexar as credenciais SIP descobertas na Etapa 1 e o screenshot do status "Disponível" pós-Etapa 4.

