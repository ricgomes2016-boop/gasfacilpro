# Revisão rápida da base (28/03/2026)

## 1) Tarefa de correção de erro de digitação
**Problema encontrado**
- O termo de domínio financeiro aparece como `Recebiveis` em nomes públicos de componente e tipos, o que mistura português sem acento em um contexto de UX/documentação predominantemente em PT-BR.

**Evidência**
- `RecebiveisRow` e `RecebiveisPipeline` em `src/components/financeiro/RecebiveisPipeline.tsx`.

**Tarefa sugerida**
- Padronizar nomenclatura para `Recebíveis` em textos visíveis ao usuário e documentação técnica (mantendo identificadores de código ASCII se desejado, mas com alias/descrições corretas).
- Revisar títulos de tela, labels e documentação para evitar variações (`recebiveis`, `recebíveis`, `recebíveis pipeline`).

**Critério de aceite**
- Todos os textos de interface e docs usam a mesma grafia.
- Não há regressão de import/export por renome de arquivos/símbolos.

---

## 2) Tarefa de correção de bug
**Problema encontrado**
- A função `getBrasiliaDate()` calcula o horário de Brasília com um offset manual potencialmente incorreto em ambientes que já estão em UTC-3.
- O cálculo atual usa `brasiliaOffset = -180` e `diff = brasiliaOffset - localOffset`, o que pode deslocar o horário em 6 horas quando `localOffset = 180`.

**Evidência**
- Implementação em `src/lib/utils.ts`.

**Tarefa sugerida**
- Corrigir `getBrasiliaDate()` para usar conversão de timezone robusta (ex.: `Intl.DateTimeFormat`/`Temporal`/biblioteca de timezone) ou fórmula consistente com o sinal do `getTimezoneOffset()`.
- Adicionar testes de unidade para cenários com timezone local UTC e UTC-3.

**Critério de aceite**
- `getBrasiliaDateString()` retorna a data esperada para os cenários de fronteira (21:00–00:30 UTC e BRT).
- Testes cobrindo pelo menos dois fusos locais passam de forma determinística.

---

## 3) Tarefa de ajuste de comentário/discrepância de documentação
**Problema encontrado**
- O `README.md` está com conteúdo de template (`REPLACE_WITH_PROJECT_ID`, `<YOUR_GIT_URL>`, `<YOUR_PROJECT_NAME>`) e não descreve o projeto real.

**Evidência**
- Placeholders em `README.md`.

**Tarefa sugerida**
- Atualizar README com:
  - nome e objetivo do GasFacilPro;
  - passos reais de setup;
  - variáveis de ambiente necessárias;
  - fluxo de teste e build do projeto.

**Critério de aceite**
- Não existem placeholders de template no README.
- Um novo colaborador consegue subir o ambiente seguindo o documento, sem conhecimento prévio.

---

## 4) Tarefa de melhoria de teste
**Problema encontrado**
- A suíte atual de exemplo (`example.test.ts`) valida apenas `true === true`, sem cobrir regras de negócio.

**Evidência**
- Teste trivial em `src/test/example.test.ts`.

**Tarefa sugerida**
- Substituir/expandir o teste exemplo com casos de negócio para utilitários de data (`getBrasiliaDateString`, `parseLocalDate`) e regras de domingo (`getSundayRules`).
- Incluir casos de borda (virada de dia e domingo 13:59/14:00).

**Critério de aceite**
- Cobertura inclui ao menos um cenário feliz e dois cenários de borda por função crítica.
- Testes falham quando houver regressão de timezone/regra de domingo.
