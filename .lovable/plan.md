
# Cadastro de Vendedor dentro de Funcionários

O cadastro de vendedor ficará **dentro de Cadastros > Funcionários**, sem criar uma tela separada. Ao marcar o checkbox "É vendedor", aparecem os campos extras e o sistema cria login + role + meta automaticamente.

## 1. Banco de dados (migration)

Adicionar em `vendedor_metas` (tabela já existente):
- `tipo_comissao` TEXT — `'percentual'` ou `'valor_fixo'`
- `valor_fixo_comissao` NUMERIC — usado quando `tipo_comissao = 'valor_fixo'`
- `tipo_venda_permitido` TEXT — `'balcao'`, `'entrega'`, `'ambos'` (default `'ambos'`)
- `ativo` BOOLEAN default true

Em `funcionarios`: adicionar `is_vendedor` BOOLEAN default false (flag rápida para listagem/badge).

## 2. UI — Cadastro de Funcionário

Na tela `src/pages/cadastros/Funcionarios.tsx` (modal de criar/editar), adicionar uma seção **"Vendedor"**:

```text
☐ Este funcionário é vendedor
   ├─ Tipo de venda permitido: [Balcão | Entrega | Ambos]
   ├─ Meta mensal (R$): [_______]
   ├─ Tipo de comissão: ( ) % sobre venda  ( ) Valor fixo por venda
   │    └─ % Comissão: [__]   OU   Valor fixo (R$): [_____]
   └─ [Botão] Criar acesso ao app de vendas
        └─ Abre modal com: E-mail + Senha temporária (gerada/editável)
```

Ao salvar com `is_vendedor = true`:
1. Atualiza `funcionarios.is_vendedor`
2. Cria/atualiza registro em `vendedor_metas`
3. Se clicou em "Criar acesso": chama edge function `create-vendedor-user` (admin API → cria user em `auth.users`, insere role `vendedor` em `user_roles`, vincula `user_id` ao funcionário)

## 3. Listagem de Funcionários

- Adicionar **badge verde "Vendedor"** ao lado do nome quando `is_vendedor = true`
- Filtro rápido: "Mostrar apenas vendedores"

## 4. Card "Desempenho" (aba dentro do modal de edição)

Visível apenas quando `is_vendedor = true`. Mostra:
- Vendas do mês (qtd + R$)
- % da meta atingida (barra de progresso)
- Comissão acumulada no mês (calcula conforme `tipo_comissao`)
- Últimas 5 vendas (link para histórico completo)

Consulta: `pedidos` onde `vendedor_id = funcionario.user_id` e mês corrente.

## 5. Edge function `create-vendedor-user`

Nova função em `supabase/functions/create-vendedor-user/index.ts`:
- Recebe: `email`, `senha`, `funcionario_id`, `empresa_id`, `unidade_id`
- Usa `service_role` para `auth.admin.createUser` (email confirmado automaticamente)
- Insere role `vendedor` em `user_roles`
- Insere em `user_unidades`
- Atualiza `funcionarios.user_id`
- Retorna 200 com flags (padrão do projeto)

## Detalhes técnicos

- Cálculo de comissão no card Desempenho:
  - `percentual`: `SUM(pedidos.total) * (percentual/100)`
  - `valor_fixo`: `COUNT(pedidos) * valor_fixo_comissao`
- A tela do app vendedor (`VendedorMetas.tsx`) também precisa ser ajustada para suportar os dois tipos de comissão.
- RLS de `vendedor_metas` já existe (2 policies) — só revisar se `WITH CHECK` aceita os novos campos.
- Senha temporária: gerar 8 caracteres alfanuméricos no front, mostrar uma vez com botão "Copiar".

## Fora do escopo (não fazer agora)

- Comissão por produto
- Comissão escalonada por meta
- Relatório consolidado de comissões (pode vir depois, em Financeiro)
