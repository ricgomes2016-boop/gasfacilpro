## Ajustes do tema "Operacional Clean"

Reformular o header e propagar o tema para todo o sistema (KPIs, cards, tabelas, formulários, modais).

### 1. Header (`Header.tsx` + `index.css`)

Replicar o layout da imagem de referência (estilo GestãoClick):

```
[≡] [Logo GásFácil]                        [⚡][🔔][👤]
```

- **Esquerda**: botão hambúrguer (toggle do sidebar) + logo GásFácil compacta. Remover título da página, subtítulo, breadcrumbs e seletor de unidades do header.
- **Direita**: manter apenas os botões existentes (busca/CommandPalette, IA assistente com sparkles, notificações, avatar do usuário). Remover do header (apenas no tema Clean): chat, calculadora, telefone — se o usuário quiser ajustar depois, fazemos.
- Fundo preto sólido (`--clean-header-bg`), altura reduzida (~56px), borda inferior sutil.

### 2. Sidebar (`Sidebar.tsx` + `UnidadeSelector.tsx`)

- O `UnidadeSelector` (variant `sidebar`) já está no topo do menu — manter, mas garantir que aparece **no topo do sidebar** ocupando o lugar da logo, com avatar + nome da unidade + CNPJ (igual ao card "MATRIZ" da referência).
- Hambúrguer do header controla abrir/fechar. Quando fechado: sidebar = `null` (full hide), conteúdo expande para largura total.

### 3. Remover banner extra (`CleanPageBanner` / `MainLayout.tsx`)

O `CleanPageBanner` criado antes vai sair — a referência não tem essa faixa abaixo do header. Título da página passa a ser responsabilidade de cada página (já é), sem injeção global.

### 4. Propagar o tema para todo o sistema

Hoje o tema só repinta header/sidebar. Para alcançar KPIs, cards, tabelas e demais componentes, vou estender os tokens do preset `operacional-clean` em `brand-themes.css` cobrindo:

- `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--muted`, `--muted-foreground`
- `--border`, `--input`, `--ring`
- `--primary` / `--secondary` / `--accent` (paleta clean: cinza-escuro + verde de ação como na referência)
- Tokens de sidebar (`--sidebar-*`) e específicos (`--clean-*`)

Como shadcn (Card, Table, Button, Input, Dialog, Badge, Tabs, etc.) já consome esses tokens semânticos, a troca pega automaticamente em todas as telas — sem editar componente por componente.

Ajustes pontuais via CSS escopado em `.theme-operacional-clean`:
- Cards: borda fina + sombra suave + cantos `rounded-lg`.
- Tabelas: header com fundo `--muted`, linhas com hover sutil.
- KPIs: aplicam tokens novos automaticamente (já usam `bg-card`/`text-foreground`).

### 5. Fora do escopo

- Não mexer em outros temas (Premium, gasfacil, gasmais, clássico).
- Não alterar rotas, dados, lógica de negócio, edge functions.
- Não refatorar `App.tsx` nem providers.

### Arquivos afetados

- `src/components/layout/Header.tsx` — novo layout Clean
- `src/components/layout/MainLayout.tsx` — remover `CleanPageBanner`
- `src/components/layout/CleanPageBanner.tsx` — deletar
- `src/components/layout/Sidebar.tsx` — confirmar UnidadeSelector no topo
- `src/styles/brand-themes.css` — expandir tokens do `operacional-clean` cobrindo todo o sistema
- `src/index.css` — refinamentos `.theme-operacional-clean` para cards/tabelas
