

## Reformular a aba "Escalas Semanais" em /rh/horarios

### Problema atual
Hoje a aba "Escalas Semanais" mostra uma **lista linear** (uma linha por escala, com data/entregador/turno/rota). Difícil enxergar quem trabalha em qual dia, ver folgas e detectar buracos na semana.

### Nova visão: grade semanal (entregador × dia)

```text
┌─────────────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│ Entregador      │ Seg 03 │ Ter 04 │ Qua 05 │ Qui 06 │ Sex 07 │ Sáb 08 │ Dom 09 │
├─────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ João Silva      │ 08-18  │ 08-18  │ 08-18  │ Folga  │ 08-18  │ 12-22  │   —    │
│                 │ Centro │ Centro │ Norte  │        │ Centro │ Sul    │        │
├─────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ Maria Souza     │   —    │ 14-22  │ 14-22  │ 14-22  │ 14-22  │ 14-22  │ Folga  │
└─────────────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
```

### O que será entregue

**1. Substituir tabela linear por grade semanal**
- Linhas = entregadores ativos da unidade (mesmo se ainda não tem escala na semana — fica com 7 células vazias).
- Colunas = 7 dias da semana selecionada (Seg → Dom), com `EEE dd/MM` no cabeçalho.
- Cada célula mostra:
  - Horário (`08:00 - 18:00`) em destaque.
  - Rota como badge pequena abaixo (cor por status: agendado/ativo/concluído).
  - Se for folga (status = `folga` ou observação), mostra chip "Folga".
  - Se vazio, mostra `—` clicável (abre modal com data e entregador pré-preenchidos).
- Coluna "hoje" recebe ring/destaque visual.
- Célula com escala existente: clique abre modal de edição; ícone X pequeno no hover para excluir rápido.

**2. Cabeçalho aprimorado**
- Mantém navegação semanal (← Anterior / Próxima →) e label do período.
- Adiciona botão **"Hoje"** que volta para a semana atual.
- Botão **"Nova Escala"** abre modal padrão.
- Novo botão **"Aplicar Escala da Semana"** (modal simples): replica o turno padrão de um entregador para vários dias selecionados de uma vez.

**3. Resumo no topo (4 cards compactos)**
- Total de escalas na semana
- Entregadores escalados (distintos)
- Horas totais previstas (soma de fim - início)
- Cobertura por dia (indicador colorido se algum dia tem 0 entregadores)

**4. Modal "Nova/Editar Escala" — sem mudanças funcionais**
- Mantém campos atuais (entregador, data, início, fim, rota, observações).
- Apenas pré-preenche `entregador_id` e `data` quando aberto a partir de uma célula da grade.

**5. Modal novo: "Aplicar Escala da Semana"**
- Selecionar entregador, turno (início/fim), rota (opcional).
- Checkboxes Seg–Dom.
- Ao salvar, faz `insert` em lote (`escalas_entregador`) para cada dia marcado da semana visível, ignorando conflitos (toast resumo: "5 criadas, 2 já existiam").

**6. Mostrar imediatamente ao criar**
- Bug atual: `useState(() => { fetchAll(); })` é hack incorreto que não dispara refetch. Trocar por `useEffect([filtroSemana, unidadeAtual])` para garantir que a grade atualiza ao navegar entre semanas e logo após criar/editar/excluir escala.

**7. Responsividade mobile (≤640px)**
- Em mobile, manter a grade com **scroll horizontal** dentro de container `overflow-x-auto`.
- Coluna do entregador fica fixa (`sticky left-0 bg-background`) para não sumir ao rolar.
- Células com largura mínima `w-28` para não quebrar conteúdo.

### Arquivos

- **Editar**: `src/pages/rh/Horarios.tsx` — reescrever apenas o componente `EscalasTab` (não mexer em `JornadasTab` nem no `Horarios` principal).
- Sem migrations: a tabela `escalas_entregador` já tem todos os campos necessários (`entregador_id`, `data`, `turno_inicio`, `turno_fim`, `status`, `rota_definida_id`).

### Critérios de aceite

- Aba "Escalas Semanais" mostra grade com entregadores nas linhas e os 7 dias da semana nas colunas.
- Ao criar uma nova escala, ela aparece imediatamente na célula correspondente sem precisar recarregar a página.
- Clique em célula vazia abre modal já com a data e entregador preenchidos.
- Clique em célula com escala abre modal de edição.
- Botão "Aplicar Escala da Semana" cria várias escalas de uma vez para os dias marcados.
- Cards-resumo no topo refletem corretamente o que está visível.
- Em mobile, grade rola horizontalmente com a coluna do entregador fixa.
- Aba "Jornadas" e o restante da página continuam intactos.

