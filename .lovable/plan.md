

## Refinos na grade de escalas + ideia inovadora

### 1. Mostrar só entregadores com horário configurado

Hoje a grade lista **todos os entregadores ativos** da unidade, mesmo os que estão com a semana inteira vazia — gera ruído visual. Vou alterar para listar **apenas quem tem ao menos 1 escala na semana visível**, ordenados alfabeticamente, um abaixo do outro.

- Para continuar conseguindo criar escala para um entregador "novo" na semana, adiciono um botão discreto no rodapé da tabela: **"+ Adicionar entregador à semana"** → abre um pequeno seletor com os entregadores ativos que ainda não estão na grade. Ao escolher, ele aparece como linha vazia (7 células `—` clicáveis) e some de novo se nada for criado.
- Estado vazio (0 escalas na semana): card central com botão "Criar primeira escala".

### 2. Cálculo de horas previstas com almoço

Revisar a regra `calcHoras` para deixar transparente e correta em **3 cenários**:

| Cenário | Comportamento |
|---|---|
| Almoço preenchido (`12:00`–`14:00`) | `(turno_fim − turno_inicio) − (almoco_fim − almoco_inicio)` |
| Sem almoço **e turno ≤ 6h** | Usa o turno cheio (CLT não exige intervalo) |
| Sem almoço **e turno > 6h** | Desconta **1h automática** de almoço previsto (CLT mínimo) e marca a célula com um pequeno ícone ⓘ no tooltip: *"Almoço estimado: 1h (não cadastrado). Cadastre para precisão."* |

- O número exibido nos cards-resumo e no tooltip da célula passa a ser sempre **horas líquidas** com essa regra.
- Adiciono um 5º indicador discreto no card "Horas previstas": legenda `(N escalas com almoço estimado)` quando aplicável, em texto pequeno.

### 3. Ideia inovadora — "Sugestão Inteligente de Escala" (1 botão)

Botão novo no header da aba: **"✨ Sugerir Escala da Semana (IA)"**.

**Como funciona:**
- Ao clicar, abre um modal compacto.
- A IA (via `lovable-ai-gateway`, modelo `google/gemini-2.5-flash`, sem custo extra) recebe como contexto:
  - Histórico das últimas **4 semanas** de escalas da unidade (entregadores, turnos, almoços, rotas).
  - Lista de entregadores ativos.
  - Rotas definidas e demanda histórica de pedidos por dia da semana / faixa horária (consulta agregada em `pedidos`).
- Retorna uma proposta de **escala completa para a semana visível** (entregador × dia × turno × almoço × rota) buscando:
  - Cobrir os horários de pico de pedidos.
  - Respeitar 1 folga semanal por entregador.
  - Distribuir rotas de forma equilibrada.
  - Manter o padrão de turno mais comum de cada entregador.
- Modal mostra a proposta em **preview** (mesma grade, em modo somente-leitura, com fundo levemente azul) com 2 botões: **"Aplicar tudo"** (insert em lote, ignora conflitos) ou **"Descartar"**.
- Toast final: "Escala sugerida aplicada — 18 turnos criados".

**Por que é inovador no contexto:**
- Tira do gestor a tarefa repetitiva de "montar a semana toda na mão".
- Aprende com o próprio histórico (não é genérico).
- Combina dados operacionais (pedidos por horário) com RH (jornada, folgas), que hoje vivem em abas separadas.
- Pode evoluir para detecção de risco trabalhista (mais de 6 dias seguidos sem folga, jornada > 8h sem almoço, etc.) com badges proativos na grade.

### Arquivos
- **Editar**: `src/pages/rh/Horarios.tsx` — `EscalasTab` (filtro de linhas, botão "adicionar à semana", ajuste em `calcHoras`, indicadores nos cards, novo botão e modal "Sugerir Escala IA").
- **Criar**: `supabase/functions/sugerir-escala-ia/index.ts` — edge function que monta o contexto histórico e chama Lovable AI Gateway, retornando JSON estruturado com a proposta.
- Sem migrations.

### Critérios de aceite
- Grade mostra somente entregadores com pelo menos 1 escala na semana, em ordem alfabética.
- Botão "+ Adicionar entregador à semana" permite incluir manualmente quem não aparece.
- Cards "Horas previstas" descontam corretamente: almoço cadastrado, sem almoço e turno ≤6h, sem almoço e turno >6h (com flag de "estimado").
- Tooltip da célula mostra a regra aplicada quando o almoço é estimado.
- Botão "Sugerir Escala da Semana (IA)" abre modal com preview e aplica em lote ao confirmar.
- Aba "Jornadas" e demais funcionalidades permanecem intactas.

