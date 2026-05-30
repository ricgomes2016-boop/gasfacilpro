## Objetivo

Hoje `/clientes/:id` (perfil do cliente, aberto pelo botão "Histórico" da notificação de novo pedido) é uma rota solta — não aparece em nenhum menu e fica "órfã" no sistema. Vamos colocá-la **dentro da rota de Cadastro de Clientes**, mantendo a página em tela cheia (não dialog), para que o usuário sinta que continua dentro do módulo de clientes.

## Mudanças

### 1. Rota
Em `src/routes/clientesRoutes.ts`:
- Trocar `{ path: "/clientes/:id", component: ClientePerfilPage, ... }` por `{ path: "/clientes/cadastro/:id", component: ClientePerfilPage, ... }`.
- Manter `/clientes/cadastro` como está (lista de cadastro).

### 2. Página de perfil (`src/pages/clientes/ClientePerfilPage.tsx`)
- Os dois botões "Voltar" (linhas 150 e 173) já apontam para `/clientes/cadastro` — fica igual.
- Subtítulo do `Header` continua sendo o nome do cliente.

### 3. Atualizar todos os links que hoje vão para `/clientes/:id`
Trocar para `/clientes/cadastro/:id` nos pontos que ainda usam o caminho antigo. Locais conhecidos:
- `src/components/clientes/ClienteTable.tsx` (botão olho — `navigate(\`/clientes/${cliente.id}\`)`).
- Componente/notificação que abre "Histórico" do novo pedido (vou localizar com `rg "clientes/\\$\\{"` antes de editar e ajustar todos os call sites).
- Qualquer link em CRM/Ranking/Campanhas que abra o perfil.

### 4. Compatibilidade
Adicionar um redirect leve para não quebrar links/notificações antigas já disparadas:
- Em `clientesRoutes.ts`, manter `/clientes/:id` apontando para um pequeno componente que faz `<Navigate to={`/clientes/cadastro/${id}`} replace />`. Assim toda URL antiga (push notification, WhatsApp, histórico) continua funcionando.

## Fora do escopo
- Não vou mexer em layout, providers, App.tsx, RLS, edge functions ou regras de negócio. Só rota + links + redirect de compatibilidade.
- Não vou transformar o perfil em aba dentro de `CadastroClientes.tsx` (mantemos página dedicada, só aninhada na URL), porque o perfil tem KPIs, tags e observações que não cabem como aba sem refatorar a tela de cadastro — e a memória do projeto proíbe refatorações estruturais.

## Pergunta rápida
Confirma que você quer **a URL aninhada** (`/clientes/cadastro/:id`) mantendo a página dedicada, ou prefere que o perfil vire **uma aba/modal dentro da tela `/clientes/cadastro`** (exigiria mexer mais na tela de cadastro)?