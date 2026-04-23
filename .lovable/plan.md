

## Suporte a funcionários terceirizados (diária / por produto / escala opcional)

### Cenário do Wadson
- Terceirizado: não é CLT, não tem salário fixo.
- Pagamento variável: às vezes **diária** (R$ X por dia trabalhado), às vezes **por produto entregue/vendido** (R$ Y por unidade).
- Pode entrar na **escala de trabalho** quando precisa cobrir turno, mesmo sem ser entregador formal.

### Mudanças no banco

**1. `funcionarios` — novos campos**
- `tipo_vinculo` text — `clt` | `terceirizado` | `freelancer` | `pj` (default `clt`).
- `regime_pagamento` text — `mensal` | `diaria` | `por_produto` | `misto` (default `mensal`).
- `valor_diaria` numeric — usado quando regime envolve diária.
- `valor_por_produto` jsonb — mapa `{ produto_id: valor }` (ex.: `{"<uuid-p13>": 2.50, "<uuid-agua>": 1.00}`) para regime por produto.
- `entra_na_escala` boolean default false — libera o funcionário (mesmo não-entregador) para aparecer na escala.

**2. `escalas_entregador` — generalizar**
- Adicionar coluna `funcionario_id uuid` (nullable) referenciando `funcionarios`.
- Manter `entregador_id` (compatibilidade). Constraint: pelo menos um dos dois preenchido.
- Renomear conceitualmente para "escalas" (sem rename físico para não quebrar nada — só a UI passa a tratar os dois casos).

**3. Nova tabela `funcionario_diarias`**
- `id, funcionario_id, data, valor, observacoes, status (pendente|paga), unidade_id, created_at`.
- Registro automático opcional quando o terceirizado cumpre uma escala no dia (gera diária pendente).

**4. Reutilizar `comissao_config` para "valor por produto"**
- Já existe a estrutura `(funcionario? + produto + canal + valor)`. Adicionar coluna opcional `funcionario_id` (nullable) — quando preenchido, sobrescreve a regra geral só para aquele funcionário (Wadson recebe R$ 3 por P13, demais entregadores recebem R$ 1).
- Fallback continua: `funcionario específico > unidade atual > outras unidades`.

### Mudanças no frontend

**1. `src/pages/cadastros/Funcionarios.tsx` — formulário do funcionário**
- Novo bloco "Vínculo e pagamento":
  - Select `Tipo de vínculo`: CLT / Terceirizado / Freelancer / PJ.
  - Select `Regime de pagamento`: Mensal / Diária / Por produto / Misto (diária + produto).
  - Campos condicionais: `Valor da diária` (se diária/misto), tabela `Valor por produto` (se por produto/misto — lista produtos da empresa com input de R$ por unidade).
  - Toggle `Entra na escala de trabalho` (libera para aparecer em RH/Horários mesmo sem ser entregador).
- `Salário` fica visível só quando regime = `mensal` ou `misto`.

**2. `src/pages/rh/Horarios.tsx` — escala**
- Query passa a buscar `escalas_entregador` + `funcionarios.entra_na_escala = true`.
- Modal de criar/editar escala: select "Pessoa" lista entregadores **e** funcionários elegíveis (com chip "Terceirizado" para diferenciar).
- No heatmap de cobertura: nome do Wadson aparece nas células normalmente, com `*` ou ícone discreto indicando terceirizado.

**3. `src/pages/rh/FolhaPagamento.tsx` — cálculo do líquido**
- Para `regime = mensal`: lógica atual.
- Para `regime = diaria`: somar `funcionario_diarias` do mês com status pendente/paga.
- Para `regime = por_produto`: somar `pedido_itens` × `comissao_config` específica do funcionário no mês.
- Para `misto`: soma das aplicáveis.
- Linha do Wadson na folha mostra: "Terceirizado · 12 diárias (R$ 1.440) + 38 produtos (R$ 95) = R$ 1.535".

**4. Nova aba em RH/Horários ou em RH/Folha: "Diárias de terceirizados"**
- Lista do mês: data | funcionário | valor | status | ações (marcar paga).
- Botão "Gerar diárias do mês" — varre escalas confirmadas dos terceirizados e cria registros em `funcionario_diarias` com `valor_diaria` do cadastro (idempotente: ignora datas já registradas).

**5. RH/Comissão (`ComissaoEntregador.tsx`) — opcional**
- O editor de comissões ganha um filtro "Aplicar a: Todos / Funcionário específico", permitindo cadastrar a tabela do Wadson sem afetar os demais.

### Arquivos
- **Migration**: ALTER `funcionarios` (4 colunas), ALTER `escalas_entregador` (1 coluna + check), CREATE `funcionario_diarias`, ALTER `comissao_config` (1 coluna + ajuste do unique index).
- **Editar**: `src/pages/cadastros/Funcionarios.tsx`, `src/pages/rh/Horarios.tsx`, `src/pages/rh/FolhaPagamento.tsx`, `src/pages/rh/ComissaoEntregador.tsx`, `src/components/rh/ComissaoConfigEditor.tsx`.
- **Novo**: `src/components/rh/DiariasTerceirizadosTab.tsx` (lista + geração em lote).

### Critério de aceite
- Wadson cadastrado como `terceirizado`, regime `misto`, com diária R$ 120 e R$ 3 por P13.
- Aparece na escala (RH/Horários) e cobre turnos junto com os entregadores.
- Botão "Gerar diárias do mês" cria registros pendentes baseados na escala.
- Folha do mês mostra a soma diárias + produtos como "líquido a pagar", sem inventar INSS/IR (terceirizado não tem desconto trabalhista).
- Demais funcionários (CLT) seguem com fluxo atual inalterado.

