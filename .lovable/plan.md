<final-text>Diagnóstico

- O badge vermelho da imagem é o contador do `MobileBottomBar`, alimentado por `ChatOperador`.
- O problema não é só visual: há mensagens em `chat_mensagens` ainda com `lida = false`, então o contador volta após novo carregamento.
- A causa raiz é dupla:
  1. As ações de “marcar como lida” no chat ignoram erro e fazem apenas atualização local.
  2. A regra atual de acesso do backend não garante a atualização correta do campo `lida` para quem está recebendo as mensagens no contexto da base.
- Além disso, o chat mobile da base (`ChatOperador`) está divergente do chat desktop (`BaseChatPanel`) e usa modelagem frágil, o que aumenta a chance de o badge voltar.

Plano de correção definitiva

1. Corrigir o backend de leitura do chat
- Criar uma forma segura de persistir “mensagem lida” para a base e para o entregador.
- Preferência: usar uma função de backend específica para marcar mensagens como lidas, em vez de depender de updates diretos frágeis.
- Garantir que apenas o destinatário correto consiga marcar a mensagem como lida.

2. Unificar a lógica do chat da base
- Ajustar `ChatOperador` para seguir o mesmo padrão de conversa do `BaseChatPanel`.
- Corrigir o escopo das consultas de não lidas para contar apenas mensagens realmente destinadas à base daquela empresa/unidade.
- Remover a divergência que hoje permite o contador voltar mesmo depois do acesso.

3. Endurecer o frontend
- Em `ChatOperador`, `BaseChatPanel` e `ChatBase`, tratar erro ao marcar como lida.
- Ao abrir a conversa, zerar o contador localmente e depois refazer a leitura do backend para confirmar sincronização real.
- Evitar que o badge reapareça por cache local ou refetch com dados antigos.

4. Validar ponta a ponta
- Testar com mensagem nova de entregador para base.
- Abrir a conversa no mobile e confirmar que o badge some e não volta ao atualizar a página.
- Repetir no desktop.
- Validar que mensagens entre entregadores não entrem no contador da base.

Detalhes técnicos

- Arquivos mais prováveis:
  - `src/components/chat/ChatOperador.tsx`
  - `src/components/chat/BaseChatPanel.tsx`
  - `src/components/entregador/ChatBase.tsx`
  - nova migration/função no backend para leitura do chat
- Vou corrigir a causa raiz, não apenas esconder o número do badge.
- Também vou revisar o fluxo para que o chat publicado fique consistente entre mobile e desktop.</final-text>