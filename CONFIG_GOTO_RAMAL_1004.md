# Configuração Vapi ⇄ GoTo SIP Trunk (Ramal 1004) — Forte Gás 0800

> **Status (02/05/2026):** Credenciais SIP recebidas da RED Soluções Digitais.
> Próximo passo é cadastrar o BYO SIP Trunk na Vapi.

---

## 1. Credenciais SIP do GoTo (ramal 1004 — "Sip Trunk")

> ⚠️ **Estas credenciais estão salvas como secrets no Lovable Cloud** (ver seção 4).
> Este arquivo lista os valores apenas para referência operacional. Não publicar.

| Campo | Valor |
|---|---|
| Ramal | `1004` |
| **Auth Username** | `53LcZzueOL72RsONRVMAe6ag0XSlFe` |
| **Auth Password** | `ZrBAJEsTuX8Bfaut` |
| **SIP Domain / Registrar** | `reg.jiveip.net` |
| **Outbound Proxy** | `fortegascomercioetransporteslt.jive.rtcfront.net` |
| Transport sugerido | **TLS 5061** (fallback UDP 5060) |
| Número público | `0800 590 0492` |
| Empresa GoTo | `FORTE GAS COMERCIO E TRANSPORTES LTDA` |

Fornecedor: **Ádan — RED Soluções Digitais** (parceiro GoTo).

---

## 2. Pré-requisito no GoTo — desligar forward para celular

A primeira chamada para o 0800 foi sequestrada por uma regra **"Encontre-me/Siga-me"**
no usuário do ramal 1004 que mandava a ligação para `+55 43 99966-1816` (celular humano).

**Antes** de ativar a Vapi, ir em:

```
GoTo Admin → Pessoas → [usuário do ramal 1004] → Encontre-me/Siga-me
```

e:

1. **Remover a Etapa 1** "Ao tocar, enviar para `+55 43 99966 1816`"
2. Manter apenas: tocar no **dispositivo SIP Trunk** → "Caso não atenda → Correio de voz" (ou desligar)
3. Salvar

Sem isso, a Vapi nunca recebe a chamada — o GoTo desvia antes.

---

## 3. Configurar BYO SIP Trunk na Vapi

No `dashboard.vapi.ai`:

### 3.1 Criar credencial SIP (Trunk Credential)

`Phone Numbers → Import → BYO SIP Trunk` (ou `SIP Trunk Credentials → Create`):

| Campo Vapi | Valor |
|---|---|
| Name | `GoTo Forte Gas - Ramal 1004` |
| SIP Trunk Gateway | `fortegascomercioetransporteslt.jive.rtcfront.net` |
| Outbound Authentication Username | `53LcZzueOL72RsONRVMAe6ag0XSlFe` |
| Outbound Authentication Password | `ZrBAJEsTuX8Bfaut` |
| Outbound Domain (SIP Realm) | `reg.jiveip.net` |
| Tech Prefix | *(deixar vazio)* |
| Transport | **TLS** (preferencial) ou **UDP** se TLS falhar |

### 3.2 Importar o número 0800

`Import Phone Number`:

| Campo | Valor |
|---|---|
| Phone Number | `+5508005900492` (E.164) |
| SIP Trunk Credential | (selecionar a criada acima) |
| Assistant | (selecionar o assistente "Bia – Forte Gás") |

### 3.3 Apontar Server URL do assistente

No assistente Vapi → `Server URL`:

```
https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vapi-webhook
```

`Server URL Secret`: deixar vazio (a edge function aceita sem assinatura HMAC por enquanto).

---

## 4. Secrets registrados no Lovable Cloud

Para que edge functions possam, futuramente, consultar status do trunk via API,
as credenciais ficam disponíveis como variáveis de ambiente:

- `GOTO_SIP_USERNAME` → `53LcZzueOL72RsONRVMAe6ag0XSlFe`
- `GOTO_SIP_PASSWORD` → `ZrBAJEsTuX8Bfaut`
- `GOTO_SIP_DOMAIN` → `reg.jiveip.net`
- `GOTO_SIP_OUTBOUND_PROXY` → `fortegascomercioetransporteslt.jive.rtcfront.net`

⚠️ Nenhuma edge function consome essas variáveis hoje — elas existem só para
não perder os valores e para uso futuro (monitoramento, re-provisionamento).

---

## 5. Validar registro

Após salvar na Vapi, voltar ao GoTo:

```
Dispositivos → Sip Trunk → Visão geral
```

e clicar em **"Ressincronizar o dispositivo"**. Em 1–2 minutos:

- Status: 🔴 Indisponível → 🟢 **Disponível**
- **IP público**: deve mostrar IP da Vapi
- **Sincronização**: timestamp recente

Se ficar Indisponível por mais de 5 min, alternar Transport TLS↔UDP na Vapi.

---

## 6. Teste fim-a-fim

Ligar para **0800 590 0492** de outro celular. Fluxo esperado:

```
Celular → 0800 → GoTo PBX → Ramal 1004 (SIP Trunk)
       → SIP TLS → Vapi → Assistente Bia → vapi-webhook ✅
```

Conferir nos 3 painéis:

| Painel | O que esperar |
|---|---|
| GoTo Análise de chamadas | "Atendida pelo dispositivo SIP", duração > 0s, sem `+5543999661816` |
| Vapi Dashboard → Calls | Chamada inbound com transcrição |
| Lovable Cloud → Edge Functions → `vapi-webhook` → logs | Eventos `tool-calls` (`consultar_preco`, `criar_pedido`) |

---

## 7. Plano B — Twilio + ElevenLabs

Se a Vapi não conseguir registrar no GoTo (firewall, codec, etc.), seguir
`CONFIG_TWILIO_SIP_FORTEGAS.md`. As mesmas credenciais funcionam no Twilio
Elastic SIP Trunking. A edge function `twilio-voice-webhook` já está pronta.

---

## 8. Nada muda no código

As edge functions `vapi-webhook` e `twilio-voice-webhook` já estão deployadas
e funcionais. **Toda a configuração restante é externa** (GoTo + Vapi).
