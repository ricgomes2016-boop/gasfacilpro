
## Plan: Associar Funcionário a Outras Filiais

### Contexto
Na rota `/cadastros/funcionarios` precisamos permitir que um funcionário seja associado a múltiplas unidades (filiais), igual ao padrão já existente para clientes (`ClienteUnidadesDialog`) que usa a tabela `cliente_unidades`.

### Investigação necessária
1. Confirmar estrutura da página `Funcionarios.tsx` e se existe tabela `user_unidades` ou similar para funcionários.
2. Verificar se funcionários têm `user_id` (vinculados a `auth.users`) — pela `UnidadeContext` já existe `user_unidades` (user_id + unidade_id), que é exatamente o mecanismo que controla quais unidades um usuário regular vê.

### Abordagem
Reutilizar o padrão do `ClienteUnidadesDialog`, criando um `FuncionarioUnidadesDialog` que opera sobre a tabela `user_unidades`:

1. **Novo componente** `src/components/cadastros/FuncionarioUnidadesDialog.tsx`
   - Props: `open`, `onOpenChange`, `userId` (do funcionário), `funcionarioNome`, `onSaved`
   - Lista todas as unidades da empresa (`useUnidade().unidades`)
   - Carrega seleções atuais de `user_unidades` filtrando por `user_id`
   - Checkboxes para marcar/desmarcar
   - Salvar: `delete` das antigas + `insert` das novas (mesmo padrão do cliente)
   - Validação: pelo menos 1 unidade obrigatória

2. **Atualizar** `src/pages/cadastros/Funcionarios.tsx`
   - Adicionar botão/ação (ícone `Building2`) na lista/tabela de funcionários ao lado de Editar/Excluir
   - Botão só aparece se o funcionário tiver `user_id` vinculado (caso contrário, mostrar tooltip "Funcionário sem login")
   - Estado local para abrir o dialog com o funcionário selecionado

### Considerações de segurança
- Operações em `user_unidades` já têm RLS. Apenas admin/gestor da empresa devem conseguir alterar (assumindo que a página já está restrita por roles `admin`/`gestor` conforme `cadastrosRoutes.ts`).
- Não modificar schema — a tabela `user_unidades` já existe e é o mecanismo correto.

### Arquivos
- **Criar**: `src/components/cadastros/FuncionarioUnidadesDialog.tsx`
- **Editar**: `src/pages/cadastros/Funcionarios.tsx` (adicionar botão + integrar dialog)

### Fluxo do usuário
1. Acessa `/cadastros/funcionarios`
2. Na linha do funcionário, clica no ícone de prédio (Building2)
3. Modal abre com lista de unidades + checkboxes mostrando as atuais
4. Marca/desmarca e salva → `user_unidades` é atualizado
5. Funcionário passará a ver/operar nas unidades marcadas (já controlado pelo `UnidadeContext`)
