

# Simplificar Conexão WhatsApp (Evolution API) — Multi-Loja

## Contexto

Atualmente, o formulario de conexao WhatsApp exige que o usuario preencha URL do servidor, Token, Instance ID, provedor, etc. O objetivo e simplificar drasticamente: o usuario digita apenas o **nome da instancia** e clica em **Gerar Token / Conectar**. A URL e API Key global da Evolution ficam configuradas centralmente (no `integracoes_config` ou como secret), nao por conexao.

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────┐
│  Central de WhatsApp (Dialog Redesenhado)    │
├─────────────────────────────────────────────┤
│  CONEXOES ATIVAS                            │
│  ┌─────────────────────────────────────┐    │
│  │ 📱 centralgas_matriz               │    │
│  │    Loja: Central Gas - Matriz       │    │
│  │    Numero: +55 11 99999-9999        │    │
│  │    Status: 🟢 Conectado             │    │
│  │    [Excluir]                        │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  NOVA CONEXAO                               │
│  ┌─────────────────────────────────────┐    │
│  │ Loja:     [Selecione...]           │    │
│  │ Filial:   [Selecione...]           │    │
│  │ Instancia: [auto-gerado]           │    │
│  │                                     │    │
│  │ [Criar Conexao e Gerar QR Code]     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Mudancas

### 1. Configuracao Global da Evolution (unica vez)
Armazenar `EVOLUTION_BASE_URL` e `EVOLUTION_GLOBAL_APIKEY` como secrets no backend. O `evolution-proxy` ja le do DB; vamos adicionar fallback para secrets do edge function.

### 2. Redesenhar Dialog WhatsApp (`Integracoes.tsx`)

**Remover do formulario de nova conexao:**
- Campo de URL do servidor
- Campo de Token/API Key
- Seletor de Provedor (fixar em "evolution")
- Campos de Security Token

**Simplificar para:**
- Select de **Loja** (empresa) — ja resolvido pelo contexto multi-tenant
- Select de **Filial/Unidade**
- Campo **Nome da Instancia** (auto-gerado a partir de slug+unidade, editavel)
- Botao **"Criar Conexao"** que:
  1. Chama `evolution-proxy` action `create` (gera token automatico)
  2. Salva no DB (`integracoes_whatsapp` + `whatsapp_gateway_instances`)
  3. Exibe QR Code para pareamento

**Lista de conexoes ativas — cada card mostra:**
- Nome da instancia
- Unidade vinculada
- Numero conectado (do campo `phone`)
- Status (conectado/desconectado) com badge colorido
- Botao Excluir (com confirmacao)
- Botao Reconectar (gera novo QR)

### 3. Atualizar `evolution-proxy` Edge Function
- Adicionar fallback: se `base_url` e `api_key` nao vierem no body nem no DB, ler de secrets (`EVOLUTION_BASE_URL`, `EVOLUTION_GLOBAL_APIKEY`)
- Na action `create`: retornar o token gerado pela Evolution API (campo `hash.apikey` da resposta) para salvar no DB

### 4. Fluxo Simplificado

1. Usuario abre Central WhatsApp
2. Seleciona Unidade → nome auto-gerado (ex: `maniadagas_matriz`)
3. Clica "Criar Conexao"
4. Backend: `POST /instance/create` com `instanceName` e `qrcode: true`
5. Resposta contem `hash.apikey` (token da instancia) — salvo no DB automaticamente
6. QR Code exibido para escaneio
7. Polling verifica status ate conectar
8. Conexao aparece na lista com status verde e numero

### 5. Secrets Necessarios
- `EVOLUTION_BASE_URL` — URL do servidor Evolution (ex: `http://187.77.52.241:8000`)
- `EVOLUTION_GLOBAL_APIKEY` — API Key global do servidor Evolution

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/pages/Integracoes.tsx` — redesenhar dialog WhatsApp, remover campos desnecessarios, adicionar lista de conexoes com status/excluir
- `supabase/functions/evolution-proxy/index.ts` — adicionar fallback para secrets globais, retornar token gerado

**Tabela `whatsapp_gateway_instances`:**
- `engine_url` tem `NOT NULL` — precisa migration para tornar nullable (usara o valor global)
- Ou: preencher com o valor global ao criar

**Tabela `integracoes_whatsapp`:**
- `token` sera preenchido automaticamente com o `hash.apikey` retornado pela Evolution
- `base_url` sera preenchido com o valor global

