# Entregador também pode ser Vendedor

## Contexto
- `funcionarios` já tem `is_vendedor` e `is_transporte` (entregador).
- `entregadores` referencia `funcionarios` via `funcionario_id`.
- Hoje o seletor de Vendedor em Nova Venda lista só vendedores, e o de Entregador lista só entregadores — a mesma pessoa que faz as duas coisas precisa estar duplicada.

## Objetivo
Um único cadastro de pessoa pode ter ambos os papéis. Em Nova Venda, ao escolher um entregador que também é vendedor, o vendedor é preenchido automaticamente (editável).

## Mudanças

### 1. Cadastro de Entregador (`Funcionarios.tsx` / form de entregador)
- Adicionar toggle **"Habilitado também como vendedor"**.
- Quando marcado: setar `funcionarios.is_vendedor = true` no funcionário vinculado e abrir os campos de comissão (`comissao_config`: percentual ou valor fixo por produto).
- Quando desmarcado: setar `is_vendedor = false` (mantém histórico de vendas já feitas).
- Mostrar badge "Vendedor" na lista de entregadores quando habilitado.

### 2. Cadastro de Vendedor (`Funcionarios.tsx`)
- Já existe `is_vendedor`. Adicionar paralelo: toggle **"Também é entregador"** que cria/ativa registro em `entregadores` ligado ao mesmo `funcionario_id` (sem duplicar pessoa).

### 3. Seletor em Nova Venda (`DeliveryPersonSelect.tsx` + seletor de Vendedor)
- Buscar entregadores trazendo junto `funcionarios.is_vendedor`.
- No card do entregador, mostrar selo discreto "VEND" quando também for vendedor.
- Ao selecionar um entregador com `is_vendedor=true`: chamar callback `onVendedorAuto(funcionarioId, nome)` que pré-preenche o seletor de Vendedor (continua editável pelo operador).
- O seletor de Vendedor continua mostrando todos os vendedores (incluindo os entregadores-vendedores) — não vira read-only.

### 4. Comissão
- Usa a config existente em `comissao_config` (percentual ou valor fixo) — mesma lógica do Vendedores Dashboard. Entregador-vendedor recebe comissão de venda igual a qualquer outro vendedor.

### 5. Dashboard `/operacional/vendedores`
- Adicionar coluna/badge "Entregador" para vendedores que também atuam em rota.
- Filtro: "Todos / Só vendedores puros / Entregadores-vendedores".

## Detalhes técnicos
- Nenhuma migration de schema necessária — `is_vendedor` já existe. Apenas escrever esse campo nos formulários e ler junto na query de entregadores (`select id, nome, funcionario_id, funcionarios(is_vendedor)`).
- Sem mudanças em `App.tsx`, providers ou rotas.
- Manter regra Radix `value="nenhum"` nos selects.

## Fora de escopo
- Não unifica historicamente registros duplicados existentes (entregador e vendedor cadastrados como pessoas separadas) — isso fica para uma ferramenta de merge depois, se necessário.
