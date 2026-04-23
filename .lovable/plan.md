

## Adicionar horário de almoço nas escalas

### O que será entregue

Incluir intervalo de almoço (saída e retorno) na escala semanal, permitindo registrar jornadas como **08:00–12:00 / 14:00–18:00**.

### Mudanças

**1. Banco de dados (migration)**
- Adicionar duas colunas na tabela `escalas_entregador`:
  - `almoco_inicio` (time, nullable)
  - `almoco_fim` (time, nullable)

**2. Modal "Nova/Editar Escala" (`EscalasTab` em `src/pages/rh/Horarios.tsx`)**
- Adicionar dois campos de horário lado a lado: **"Saída Almoço"** e **"Retorno Almoço"** (ambos opcionais).
- Layout: grid 2 colunas abaixo do par "Início / Fim do turno".
- Validação leve: se um for preenchido, o outro também deve ser; `almoco_inicio` deve estar entre `turno_inicio` e `turno_fim`.

**3. Modal "Aplicar Escala da Semana"**
- Mesmos dois campos opcionais de almoço; replicados em todos os dias marcados.

**4. Célula da grade semanal**
- Quando há almoço definido, exibir em duas linhas compactas:
  ```
  08:00 – 12:00
  14:00 – 18:00
  ```
- Quando não há almoço, manter exibição atual (`08:00 – 18:00`).
- Badge da rota continua abaixo.

**5. Cálculo de horas previstas (cards-resumo)**
- Subtrair o intervalo de almoço (`almoco_fim - almoco_inicio`) do total `turno_fim - turno_inicio` quando preenchido.
- Reflete corretamente na soma de "Horas totais previstas".

**6. Tooltip / detalhe**
- Hover na célula mostra resumo: `Turno: 08:00–18:00 • Almoço: 12:00–14:00 • Líquido: 8h`.

### Arquivos
- **Migration**: adicionar colunas `almoco_inicio` e `almoco_fim` em `escalas_entregador`.
- **Editar**: `src/pages/rh/Horarios.tsx` — apenas `EscalasTab` (modais, célula da grade e cálculo do resumo).

### Critérios de aceite
- Modal de criar/editar escala mostra campos opcionais "Saída Almoço" e "Retorno Almoço".
- Modal "Aplicar Escala da Semana" também aceita o intervalo de almoço e replica em todos os dias selecionados.
- Célula da grade exibe duas faixas (manhã/tarde) quando há almoço, ou faixa única quando não há.
- Card "Horas totais previstas" desconta o tempo de almoço.
- Aba "Jornadas" e demais funcionalidades permanecem intactas.

