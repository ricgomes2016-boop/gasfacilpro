Plano para implementar Declarações personalizadas por matriz/filial

Objetivo
Criar uma opção no sistema para gerar Declarações personalizadas, permitindo selecionar uma ou várias unidades — matriz e/ou filiais — e preencher automaticamente os dados cadastrais de cada unidade selecionada. A solução terá uma tela no sistema, pré-visualização e exportação em PDF.

Onde ficará
- Adicionar no menu Configurações uma nova opção: Declarações.
- Criar rota: `/config/declaracoes`.
- Permissões sugeridas: admin, gestor e financeiro, seguindo o padrão de Documentos da Empresa.

Funcionalidades da tela
1. Seleção de unidades
- Listar matriz e filiais ativas da empresa atual.
- Permitir selecionar várias unidades ao mesmo tempo.
- Exibir identificação visual de Matriz/Filial.
- Buscar automaticamente os dados já existentes da tabela de unidades:
  - nome
  - tipo: matriz/filial
  - CNPJ
  - telefone
  - e-mail
  - endereço
  - bairro
  - cidade/UF
  - CEP

2. Modelo personalizado da declaração
- Campo para título da declaração.
- Campo de texto do corpo da declaração.
- Permitir usar variáveis no texto, por exemplo:
  - `{{nome_unidade}}`
  - `{{tipo_unidade}}`
  - `{{cnpj}}`
  - `{{endereco}}`
  - `{{bairro}}`
  - `{{cidade}}`
  - `{{estado}}`
  - `{{cep}}`
  - `{{telefone}}`
  - `{{email}}`
  - `{{data_atual}}`
- Botões rápidos para inserir variáveis no texto, evitando erro de digitação.

3. Pré-visualização
- Mostrar a declaração renderizada para cada unidade selecionada.
- Quando houver várias unidades, exibir uma prévia por unidade.
- Para dados não preenchidos, usar marcador discreto como “Não informado”, sem quebrar o documento.

4. Exportação
- Botão “Gerar PDF”.
- Se selecionar uma unidade: gerar um PDF com uma declaração.
- Se selecionar várias unidades: gerar um único PDF com uma página por unidade.
- Nome do arquivo sugerido: `declaracoes-unidades-DDMMAAAA.pdf`.
- Incluir cabeçalho com nome da unidade, CNPJ e contato, seguindo o padrão visual dos PDFs já existentes no sistema.

5. Ações auxiliares
- Botão “Selecionar todas”.
- Botão “Limpar seleção”.
- Botão “Restaurar modelo padrão”.
- Validação antes de gerar:
  - precisa selecionar ao menos uma unidade;
  - título não pode estar vazio;
  - texto da declaração não pode estar vazio.

Modelo padrão sugerido
````text
DECLARAÇÃO

Declaramos para os devidos fins que a unidade {{nome_unidade}}, inscrita no CNPJ {{cnpj}}, localizada em {{endereco}}, {{bairro}}, {{cidade}}/{{estado}}, CEP {{cep}}, encontra-se vinculada à nossa operação como {{tipo_unidade}}.

Por ser verdade, firmamos a presente declaração.

{{cidade}}/{{estado}}, {{data_atual}}.
````

Arquivos a criar/alterar
- Criar `src/pages/config/Declaracoes.tsx` com a nova tela.
- Alterar `src/routes/configRoutes.ts` para registrar a rota.
- Alterar `src/components/layout/menuItems.ts` para adicionar a opção no menu Configurações.
- Criar serviço utilitário para PDF, por exemplo `src/services/declaracaoPdfService.ts`, reutilizando `jsPDF`, já usado no projeto.

Decisão técnica
- Não será necessário criar novas tabelas inicialmente, pois a solicitação é gerar declarações a partir dos dados já cadastrados em matriz/filiais.
- A tela poderá usar o contexto `useUnidade()` para obter as unidades disponíveis e respeitar o acesso por empresa/unidade já existente.
- A exportação será feita no frontend com `jsPDF`, mantendo o padrão atual dos relatórios/recibos do sistema.
- Não será alterado `App.tsx`, respeitando a regra de estabilidade do projeto.

Resultado esperado
Ao final, o usuário poderá acessar Configurações > Declarações, selecionar uma ou várias unidades, escrever/ajustar um modelo personalizado usando variáveis, visualizar o resultado e baixar um PDF com as declarações preenchidas automaticamente para cada matriz/filial selecionada.