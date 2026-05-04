## Objetivo
1. **Preço**: A Bia deve usar a `tabela_precos` configurada em **Configurações → Regras da Bia** (e não o `preco_telefone`/`preco` da tabela `produtos`).
2. **Latência**: Reduzir o tempo de espera entre o cliente terminar de falar e a Bia responder (configuração de turn-taking no agente ElevenLabs).

---

## Mudanças

### 1. Fonte de preço = Regras da Bia (`configuracoes_empresa.regras_bia.tabela_precos`)

**Arquivo:** `supabase/functions/elevenlabs-bia-tools/index.ts`

**a)** Adicionar helper `getTabelaPrecosBia()` que carrega `regras_bia.tabela_precos` da tabela `configuracoes_empresa` da empresa Central Gás (já fixa via `EMPRESA_BIA_ID`).

**b)** Mapeamento produto → chave da tabela:
- `Gás P13` → `gas_p13`
- `Gás P20` → `gas_p20`
- `Gás P45` → `gas_p45`
- `Água Mineral 20L` → `agua_20l`

**c)** Em `criar_pedido` (linha ~330), trocar a ordem de prioridade do preço para:
1. **`tabela_precos[chave].preco`** das Regras da Bia (fonte primária)
2. Fallback: `preco_telefone` do produto
3. Fallback final: `preco` do produto
4. **Manter** o "último preço cobrado ao cliente" apenas se existir e for maior que zero (para preservar acordos com clientes recorrentes) — ou remover, conforme decisão do usuário (ver nota).

**d)** Adicionar nova action **`consultar_precos`** (opcional, mas útil): retorna a tabela de preços formatada para a Bia ler na hora que o cliente perguntar "quanto é o gás?". Hoje a Bia inventa ou usa preço antigo do cadastro.

**e)** Registrar tool `consultar_precos` no agente ElevenLabs via API (PATCH em `/v1/convai/agents/{id}`) apontando para a mesma edge function (`elevenlabs-bia-tools` com `action=consultar_precos`).

**Nota sobre "último preço do cliente":** hoje, se o cliente já comprou antes, a Bia usa o preço da última compra dele. Isso pode causar divergência com a tabela das Regras. **Recomendo manter** apenas como referência mas priorizar a tabela das Regras (que é a "fonte da verdade" agora). Confirmar na implementação.

---

### 2. Reduzir tempo de espera após o cliente falar

A latência depois que o cliente termina de falar é controlada por dois parâmetros do agente ElevenLabs (`conversation_config.turn`):

- **`turn_timeout`** (segundos de silêncio antes da Bia decidir que o cliente terminou) — atualmente provavelmente em 7-10s (default). Reduzir para **2s**.
- **`silence_end_call_timeout`** — não mexer (é para encerrar ligação).
- **`mode`**: garantir `turn`/`silence` rápido.

Adicional:
- **`asr.user_input_audio_format`**: manter, mas validar.
- **`tts.optimize_streaming_latency`**: subir para `3` ou `4` (mais latência de qualidade vs. mais rápido). Vamos para `3`.

**Como aplicar:** PATCH em `https://api.elevenlabs.io/v1/convai/agents/{ELEVENLABS_AGENT_ID}` com:
```json
{
  "conversation_config": {
    "turn": { "turn_timeout": 2, "mode": "turn" },
    "tts": { "optimize_streaming_latency": 3 }
  }
}
```

Executado via script Python one-off (mesmo padrão das atualizações anteriores de voz/prompt). Não precisa criar UI.

---

## Resumo dos arquivos alterados
- `supabase/functions/elevenlabs-bia-tools/index.ts` — nova action `consultar_precos`, prioridade de preço pela tabela das Regras da Bia.
- **API ElevenLabs** (script one-off, sem código persistente): registra a tool `consultar_precos` e ajusta `turn_timeout=2` + `optimize_streaming_latency=3`.

## Resultado esperado
- Cliente: "Quanto é o P13?" → Bia consulta `consultar_precos` → responde com o preço exato configurado em Regras da Bia.
- Cliente termina de falar → Bia responde em ~2s (vs. ~7s hoje).
- Pedidos criados usam preço da tabela das Regras (não mais do cadastro de produtos).
