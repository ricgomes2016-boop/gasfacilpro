Plano de implementação

1. Criar o módulo “Avisos” em Gestão de RH
- Adicionar nova página em RH para cadastrar, editar, ativar/desativar e excluir avisos.
- Campos previstos: título, mensagem, prioridade, período de exibição, unidade, status ativo e opção de fixar/destacar.
- Incluir a página no menu “Gestão de RH” como “Avisos”, mantendo “Horários” como a única entrada de horários/escalas.
- Usar o conteúdo do PDF enviado como referência para um modelo de aviso sobre SST/saúde ocupacional, sem publicar automaticamente para todas as unidades sem confirmação na tela.

2. Persistência segura no backend
- Criar tabela de avisos para entregadores com isolamento por empresa/unidade.
- Aplicar regras de acesso:
  - Admin/gestor podem gerenciar avisos da própria empresa.
  - Entregadores só podem visualizar avisos ativos da própria unidade/empresa.
- Incluir índices para busca eficiente por empresa, unidade, status e período de exibição.

3. Exibir avisos no aplicativo do entregador
- Criar um componente de avisos no app do entregador, preferencialmente na tela inicial, acima ou próximo ao “Meu Horário da Semana”.
- Mostrar apenas avisos ativos, dentro do período configurado, relacionados à unidade do entregador.
- Dar destaque visual para avisos importantes, mantendo contraste correto para evitar texto claro em fundo claro.
- Se não houver avisos, não ocupar espaço na tela.

4. Remover duplicidade no menu Operacional
- Remover apenas o item “Escalas de Entregadores” de “Gestão Operacional”.
- Manter a rota/página existente `/rh/horarios` funcionando normalmente em “Gestão de RH > Horários”.
- Não alterar a página de horários/escalas, apenas a navegação duplicada.

Detalhes técnicos
- Arquivos prováveis:
  - `src/components/layout/menuItems.ts`: remover item duplicado do Operacional e adicionar “Avisos” em RH.
  - `src/routes/rhRoutes.ts`: adicionar rota `/rh/avisos`.
  - `src/pages/rh/Avisos.tsx`: nova tela de gestão dos avisos.
  - `src/pages/entregador/EntregadorDashboard.tsx`: inserir o bloco de avisos.
  - Novo componente em `src/components/entregador/` para listar avisos no app.
- Backend:
  - Nova tabela, por exemplo `rh_avisos_entregador`, com `empresa_id`, `unidade_id`, `titulo`, `mensagem`, `prioridade`, `ativo`, `fixado`, `exibir_de`, `exibir_ate`, `created_by`, timestamps e RLS.
- Validação final:
  - Rodar checagem TypeScript.
  - Conferir que o menu Operacional não mostra mais “Escalas de Entregadores”.
  - Conferir que “Gestão de RH > Horários” continua disponível.
  - Conferir que avisos cadastrados aparecem no app do entregador conforme unidade/status/período.