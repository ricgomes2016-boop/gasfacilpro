Plano para melhorar a tela de Declarações

Objetivo
Permitir que a tela de Declarações trabalhe com vários modelos, incluindo modelos pré-configurados, e também permita criar modelos personalizados rapidamente para reutilização durante a geração dos PDFs.

O que será adicionado

1. Seletor de modelo
- Adicionar um campo “Modelo de declaração” no topo da área de edição.
- Ao selecionar um modelo, preencher automaticamente:
  - título da declaração;
  - texto/modelo da declaração.
- Manter a pré-visualização e geração de PDF usando o modelo selecionado.

2. Modelos pré-configurados
Adicionar alguns modelos prontos, por exemplo:
- Declaração padrão de vínculo da unidade.
- Declaração de endereço da unidade.
- Declaração de funcionamento/atividade operacional.
- Declaração de dados cadastrais.
- Declaração personalizada em branco.

Cada modelo usará as variáveis já existentes, como:
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

3. Criar outros modelos na própria tela
- Adicionar botão “Salvar como modelo”.
- O usuário poderá editar título/texto e salvar como um novo modelo local da tela.
- O novo modelo aparecerá no seletor junto com os pré-configurados.
- Para esta primeira melhoria, os modelos personalizados serão mantidos no navegador via `localStorage`, sem mexer no banco de dados.

4. Gerenciamento simples dos modelos personalizados
- Modelos pré-configurados não poderão ser apagados.
- Modelos criados pelo usuário poderão ser removidos.
- Ao remover, o sistema volta para um modelo padrão caso o modelo removido esteja selecionado.

5. Ajustes de usabilidade
- Trocar o botão “Restaurar modelo padrão” por uma ação que restaura o modelo atualmente selecionado.
- Manter os botões de variáveis automáticas.
- Manter a seleção da unidade atual como padrão, usando os dados da empresa/unidade selecionada no sistema.
- Preservar a geração de PDF atual, sem alterar a rota e sem mexer no `App.tsx`.

Arquivos previstos
- Alterar `src/services/declaracaoPdfService.ts` para exportar a lista de modelos pré-configurados.
- Alterar `src/pages/config/Declaracoes.tsx` para incluir:
  - seletor de modelos;
  - criação de modelo personalizado;
  - exclusão de modelos personalizados;
  - aplicação automática do título/texto do modelo selecionado.

Decisão técnica
- Não criarei tabela nova agora, pois o pedido pode ser atendido com modelos prontos e modelos locais no navegador.
- Se depois você quiser que os modelos fiquem salvos para todos os usuários da empresa, aí sim podemos criar uma tabela no backend com RLS por empresa/unidade.

Resultado esperado
Na tela Gestão Operacional > Declarações, o usuário poderá escolher um modelo pré-configurado, editar se quiser, salvar variações como novos modelos, selecionar matriz/filial, visualizar o preenchimento automático e gerar o PDF normalmente.