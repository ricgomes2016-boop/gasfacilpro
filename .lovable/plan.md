## Diagnóstico

A tabela oficial em `configuracoes_empresa.regras_bia.tabela_precos` (Central Gás) está correta:

- **Gás P13: R$ 125,00**
- **Gás P20: R$ 210,00**
- **Gás P45: R$ 410,00**
- **Água Mineral 20L: R$ 20,00**

O tool `consultar_precos` (`elevenlabs-bia-tools`) também retorna esses valores corretamente — testado agora e respondeu R$ 125 / R$ 20.

O prompt do agente Bia (ElevenLabs) já tem a instrução "SEMPRE chame `consultar_precos`. NUNCA invente preços." Mesmo assim, na ligação a Bia falou **R$ 75 (gás)** e **R$ 19 (água)** — valores que **não vêm do banco nem do tool**.

**Causa raiz:** o LLM configurado é `gemini-2.5-flash-lite` (tier mais barato e mais propenso a alucinar). Ele está ignorando a instrução do prompt e respondendo do "conhecimento" interno em vez de chamar o tool. Resultado: preços fictícios.

## Solução (em duas camadas)

### 1) Injetar os preços direto no contexto do agente via `dynamic_variables`

Hoje `elevenlabs-call-initiation` envia variáveis dinâmicas (caller, cliente, empresa) mas **não envia os preços**. Vamos:

- Em `supabase/functions/elevenlabs-call-initiation/index.ts`, depois de resolver a empresa, ler `configuracoes_empresa.regras_bia.tabela_precos` da empresa atendida e adicionar ao response:
  ```
  dynamic_variables: {
    ...,
    preco_gas_p13: "125,00",
    preco_gas_p13_desconto: "120,00",
    preco_gas_p20: "210,00",
    preco_gas_p20_desconto: "200,00",
    preco_gas_p45: "410,00",
    preco_gas_p45_desconto: "400,00",
    preco_agua_20l: "20,00",
  }
  ```
- Tratamento defensivo: se `tabela_precos` faltar ou preço = 0, manda string vazia e a Bia segue caindo no tool.

### 2) Reforçar o prompt para citar essas variáveis

Atualizar o prompt do agente (via `elevenlabs-update-bia-voice` POST) acrescentando, dentro da seção "REGRA DE PREÇO":

```
PREÇOS DESTA LIGAÇÃO (use literalmente, NUNCA invente):
- Gás P13: R$ {{preco_gas_p13}} (desconto: R$ {{preco_gas_p13_desconto}})
- Gás P20: R$ {{preco_gas_p20}} (desconto: R$ {{preco_gas_p20_desconto}})
- Gás P45: R$ {{preco_gas_p45}} (desconto: R$ {{preco_gas_p45_desconto}})
- Água Mineral 20L: R$ {{preco_agua_20l}}
Se a variável vier vazia, então chame `consultar_precos`.
```

Com os valores literalmente no system prompt da chamada, o LLM não precisa "decidir" chamar o tool — ele lê o número e fala. Isso resolve a alucinação mesmo no `gemini-2.5-flash-lite`.

### 3) (Opcional, recomendado) Trocar o LLM

Subir de `gemini-2.5-flash-lite` para `gemini-2.5-flash` na configuração do agente. O custo sobe pouco e a aderência a instruções melhora bastante. Faço isso via mesma rota `elevenlabs-update-bia-voice` (POST `{"llm":"gemini-2.5-flash"}`). Confirme se quer trocar agora ou prefere manter o lite.

## Arquivos afetados

- `supabase/functions/elevenlabs-call-initiation/index.ts` — buscar tabela de preços e devolver em `dynamic_variables`.
- Prompt do agente Bia (via API ElevenLabs, sem mudar código no repo) — acrescentar bloco de preços literais.
- Nenhum schema novo; nenhuma migração; nenhuma alteração em RLS.

## Observações

- A tabela de preços continua sendo editada em **Admin → Bia Voz / Regras da Bia** (já está em `configuracoes_empresa.regras_bia.tabela_precos`).
- Cada ligação puxa o snapshot do momento — atualização no banco vale na próxima chamada, sem deploy.
- `consultar_precos` permanece registrado como fallback, caso a variável venha vazia.
