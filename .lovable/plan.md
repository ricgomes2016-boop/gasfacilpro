

## Substituir aba "Jornadas" por um Quadro de Cobertura por Horário

### Problema
A aba "Jornadas" hoje depende da tabela `horarios_funcionario` (cadastro manual paralelo) e está quebrada/desatualizada. Já existe a fonte de verdade: `escalas_entregador` (com turno, almoço e dia da semana). Falta uma visão de **cobertura horária** que mostre, hora a hora, **quem está trabalhando** e **quantos entregadores** estão escalados — para identificar buracos de cobertura.

### Nova aba: "Cobertura Horária" (substitui "Jornadas")

**Layout — Heatmap horário × dia da semana**

```text
                Seg    Ter    Qua    Qui    Sex    Sáb    Dom
06:00           0      0      0      0      0      0      0
07:00           1      1      1      1      1      0      0
08:00     ★    3      3      2      3      3      1      0   ← Samuel, Giovanni, Renato
09:00     ★    3      3      2      3      3      1      0
10:00     ★    5 🔥   5 🔥   4      5 🔥   5 🔥   2      0   ← + Bruno + Marcos
11:00     ★    5 🔥   5 🔥   4      5 🔥   5 🔥   2      0
12:00          3      3      2      3      3      1      0   ← Giovanni e Renato em almoço
13:00          4      4      3      4      4      2      0
14:00     ★    5 🔥   5 🔥   4      5 🔥   5 🔥   2      0
...
20:00          1      1      1      1      1      0      0
```

- **Eixo Y**: horas do dia (06:00 → 23:00, faixa configurável).
- **Eixo X**: 7 dias da semana (Seg–Dom).
- **Célula**: número de entregadores ativos naquele bloco de hora **descontando o intervalo de almoço** de cada escala.
- **Cor da célula** (heatmap):
  - Cinza claro = 0 (vazio, **alerta de cobertura**)
  - Azul claro = 1 entregador
  - Azul médio = 2–3
  - Verde = 4+ (cobertura saudável) — ícone 🔥 quando passa do pico médio
- **Hover na célula**: tooltip lista os nomes dos entregadores naquele horário (`Bruno, Samuel, Giovanni…`) + unidade.
- **Linhas marcadas com ★**: horários de pico de pedidos (consultados de `pedidos` das últimas 4 semanas, agregados por hora).

### Painel lateral / cards superiores

1. **"Horários sem cobertura"** — lista os blocos `dia + hora` com 0 entregadores nos horários de pico → ação rápida "Criar escala".
2. **"Pico de demanda vs cobertura"** — mini gráfico de barras sobrepostas: demanda histórica × entregadores escalados, por hora.
3. **"Total de entregadores únicos na semana"** e **"Horas-homem totais"**.

### Filtros no topo
- **Unidade**: já vem da `useUnidade`. Toggle extra "Incluir unidades da mesma cidade" — quando ligado, soma também escalas de outras unidades cuja `cidade` seja igual à da unidade atual (caso do **Renato / Forte Gás** próximo da matriz).
- **Semana**: seletor de semana (mesma navegação da aba Escalas) — começa na semana corrente.
- **Categoria**: `Todos` / `Entregadores` / `Internos` (futuro).

### Modo lista compacta (mobile / alternativo)
Botão de alternância **"Heatmap | Lista por dia"**:

```text
SEGUNDA-FEIRA
─────────────────────────────────────
Bruno      10:00–14:00 · 16:00–20:00   (8h)
Samuel     08:00–14:00                 (6h)
Giovanni   08:00–12:00 · 14:00–18:00   (8h)
Marcos     10:00–13:00 · 15:00–20:00   (8h)
Renato*    08:00–11:00 · 13:00–18:00   (8h)   ← Forte Gás
─────────────────────────────────────
Cobertura no pico (10–13h): 5 entregadores
```

`*` indica entregador de outra unidade incluída pela proximidade geográfica.

### Lógica de cálculo (resumida)

Para cada escala da semana visível:
- Bloco "manhã" = `[turno_inicio, almoco_inicio || turno_fim)`
- Bloco "tarde" = `[almoco_fim, turno_fim)` (se houver almoço)
- Para cada hora `H` do eixo, contar quantas escalas têm `H` dentro de algum dos blocos no dia da semana correspondente.

### Arquivos
- **Editar**: `src/pages/rh/Horarios.tsx`
  - Renomear aba `"jornadas"` → `"cobertura"` (label "Cobertura Horária", ícone `Activity`).
  - Substituir todo o conteúdo da `TabsContent value="jornadas"` por um novo componente `<CoberturaTab />` definido no mesmo arquivo (mantém o padrão atual, sem refatorar estrutura).
  - Manter aba "Escalas Semanais" intacta.
  - Manter o código/queries de `horarios_funcionario` apenas se ainda usado em outro lugar; caso contrário, comentar a leitura mas **não remover** (estabilidade).
- **Sem migrations** — usa apenas `escalas_entregador`, `entregadores`, `unidades`, `pedidos`.

### Critérios de aceite
- Aba "Jornadas" é substituída por "Cobertura Horária" funcionando.
- Heatmap mostra contagem por hora × dia, descontando o intervalo de almoço de cada escala.
- Hover em qualquer célula mostra nomes dos entregadores ativos naquele horário.
- Toggle "Incluir unidades da mesma cidade" inclui/exclui escalas de outras unidades da mesma cidade (caso Renato / Forte Gás).
- Linhas de pico de pedidos marcadas com ★ e células de pico+sem cobertura aparecem no card "Horários sem cobertura".
- Modo "Lista por dia" mostra exatamente o formato dos exemplos do usuário (Bruno, Samuel, Giovanni, Marcos, Renato com seus turnos divididos por almoço).
- Aba "Escalas Semanais" e demais funcionalidades permanecem intactas.

