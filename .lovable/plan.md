## Objetivo
Adicionar o campo de **Inscrição Estadual / RG** no formulário de cadastro de cliente e aplicar melhorias práticas na tela de Cadastro de Clientes.

## Contexto
- Arquivo: `src/pages/clientes/CadastroClientes.tsx` (modal de Novo/Editar Cliente).
- A tabela `clientes` já possui as colunas `inscricao_estadual`, `razao_social`, `nome_fantasia`, `cnpj` e `estado` — porém **nenhuma delas está exposta no formulário**. Não é necessária migration.
- Hoje, ao buscar CNPJ na Receita, os campos retornados (razão social, nome fantasia, IE) são descartados.

## Mudanças no formulário (modal Novo/Editar Cliente)

1. **Novo campo: Inscrição Estadual / RG**
   - Label dinâmica: quando CPF → "RG"; quando CNPJ → "Inscrição Estadual" (com opção "ISENTO").
   - Persistido em `clientes.inscricao_estadual`.
   - Posicionado logo abaixo da linha CPF/CNPJ + Telefone.

2. **Campos PJ exibidos quando CPF/CNPJ for CNPJ** (já existem no banco):
   - Razão Social (`razao_social`)
   - Nome Fantasia (`nome_fantasia`)
   - Preenchidos automaticamente pelo botão "Buscar Receita" (já existente).

3. **Campo Estado (UF)** ao lado de Cidade — usa coluna `estado` e é preenchido pelo ViaCEP/Receita.

## Outras melhorias propostas para a tela

4. **Validação clara antes de salvar**
   - Mostrar mensagem inline quando Nome ou Telefone faltarem (hoje só dá toast genérico).
   - Validar IE quando tipo = revendedor/comercial/industrial (avisar, não bloquear).

5. **Botão "Buscar Receita" mais visível**
   - Trocar o ícone discreto por botão "Buscar na Receita" com texto, exibido só quando o CPF/CNPJ digitado tiver 14 dígitos.
   - Auto-disparar a busca ao colar/digitar CNPJ completo (opcional, com debounce).

6. **Auto-foco e ordem de tabulação**
   - Foco automático no campo Nome ao abrir o modal.
   - Enter no último campo dispara "Salvar".

7. **Limpeza de UX**
   - Remover a dica permanente "Clique em 🔍 para buscar dados na Receita" (passa a ser tooltip do botão).
   - Agrupar visualmente blocos: **Identificação**, **Contato**, **Endereço**, **Classificação**.
   - Em mobile, manter campos full-width e inputs com `text-base` (já está ok).

8. **Listagem**
   - Mostrar IE/RG no perfil do cliente (drawer/dialog de detalhes), não na tabela.
   - Filtro adicional: "Somente PJ" / "Somente PF" baseado no comprimento do CPF/CNPJ.

## Detalhes técnicos
- Estender `FormData` e `initialFormData` com: `inscricao_estadual`, `razao_social`, `nome_fantasia`, `estado`.
- Estender `Cliente` interface com os mesmos campos.
- Atualizar `handleSave` para incluir os novos campos no `insert`/`update` em `clientes`.
- Atualizar `buscarCpfCnpj` para preencher `razao_social`, `nome_fantasia`, `inscricao_estadual` quando retornados.
- Atualizar `buscarCEP` para preencher `estado` (campo `uf` do ViaCEP).
- Sem alterações no `useClientes.ts` (este componente acessa `supabase` diretamente).

## Fora de escopo
- Mudanças em `ClienteFormDialog.tsx` (modal alternativo usado em outras telas) — pode ser feito em seguida se desejar.
- Mudanças no schema do banco (não necessárias).
