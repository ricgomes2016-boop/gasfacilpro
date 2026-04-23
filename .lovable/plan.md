

## Heatmap: mostrar todos os nomes + inverter eixos (dia × hora)

### Mudanças no `CoberturaTab` (`src/pages/rh/Horarios.tsx`)

**1. Mostrar TODOS os nomes na célula**
- Remover o limite de 3 nomes + `+N`. Listar todos os entregadores ativos no bloco, um por linha (`text-[10px]`, `truncate`, `text-muted-foreground`).
- Manter `*` para entregadores de outra unidade (toggle "mesma cidade").
- Tooltip continua com lista completa nome + unidade (redundante, mas útil quando truncado).
- Altura da célula passa a ser automática (`h-auto min-h-[60px]`) para acomodar listas longas sem quebrar.

**2. Inverter eixos: linhas = DIAS, colunas = HORAS**

Layout novo:

```text
         06h  07h  08h  09h  10h ★  11h ★  12h  13h  14h ★ ...
Seg       0    1    3    3    5 🔥   5 🔥   3    4    5 🔥
Ter       0    1    3    3    5 🔥   5 🔥   3    4    5 🔥
Qua       0    1    2    2    4      4      2    3    4
Qui       0    1    3    3    5 🔥   5 🔥   3    4    5 🔥
Sex       0    1    3    3    5 🔥   5 🔥   3    4    5 🔥
Sáb       0    0    1    1    2      2      1    2    2
Dom       0    0    0    0    0      0      0    0    0
```

- Eixo X (cabeçalho): horas 06h → 23h, com ★ nos picos de pedidos.
- Eixo Y (primeira coluna): dias da semana (Seg–Dom), sticky à esquerda.
- Cada célula: contagem grande + 🔥 (se acima do pico médio) + lista vertical de **todos** os primeiros nomes.
- Coluna do dia fica `sticky left-0 bg-background z-10` para o usuário rolar horizontalmente entre as horas sem perder a referência do dia.
- Largura de cada coluna de hora: `min-w-[80px]`.
- Container com `overflow-x-auto` (scroll horizontal nas horas, que são muitas; dias = só 7 linhas, cabem na vertical sem scroll).

**3. Ajustes visuais**
- Cabeçalho de hora compacto (`text-[11px]`, `font-medium`), com ★ amarelo acima do número.
- Borda sutil entre células mantida.
- Modo "Lista por dia" continua intacto (toggle Heatmap | Lista).
- Cards de resumo (buracos no pico, totais) intactos.

### Por que inverter ajuda
- Hoje há 18 horas (Y) × 7 dias (X) → matriz alta e estreita, com pouco espaço por célula para nomes.
- Invertendo: 7 dias (Y) × 18 horas (X) → matriz baixa e larga, com scroll horizontal natural; cada célula tem mais espaço vertical para listar nomes empilhados.
- Padrão visual mais comum em ferramentas de escala (When I Work, Deputy, Homebase).

### Arquivo
- **Editar**: `src/pages/rh/Horarios.tsx` (apenas render do heatmap em `CoberturaTab` — estrutura da tabela, header, body e célula).
- Sem migrations, sem mudanças de query, sem mudanças nas demais abas.

### Critério de aceite
- Heatmap renderiza com **dias nas linhas** e **horas nas colunas**.
- Cada célula mostra **todos** os primeiros nomes dos entregadores ativos (sem corte com `+N`).
- Coluna do dia fica fixa ao rolar horizontalmente entre as horas.
- Picos de pedidos marcados com ★ no cabeçalho da hora correspondente.
- Modo "Lista por dia", filtros, toggle de cidade e cards de buracos permanecem funcionando igual.

