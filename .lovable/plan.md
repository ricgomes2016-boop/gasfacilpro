## Objetivo

Permitir mesclar apenas os clientes que o usuário selecionar manualmente, evitando o scan automático em todo o sistema.

## Mudanças

### 1. `src/pages/clientes/CadastroClientes.tsx` — checkboxes de seleção
- Adicionar estado `selectedMergeIds: Set<string>` (ids reais de clientes; separado do `selectedClients` que é da importação em massa).
- Nova coluna `<TableHead className="w-10">` no início da tabela com `<Checkbox>` por linha (e equivalente no card mobile, no canto superior direito).
- `Checkbox` "selecionar todos visíveis" no header da coluna, agindo sobre `filteredClientes`.
- Botão **Mesclar** muda de comportamento:
  - Se `selectedMergeIds.size >= 2` → abre o dialog em modo **manual** passando os ids.
  - Se `< 2` → mantém comportamento atual (auto-detecção). Texto do botão vira `Mesclar (N)` quando há seleção.
- Após mesclagem concluída (`onMerged`): limpar `selectedMergeIds` e recarregar lista.

### 2. `src/components/clientes/MesclarClientesDialog.tsx` — modo manual
- Nova prop opcional `preSelectedIds?: string[]`.
- No `useEffect` de abertura: se `preSelectedIds` veio com 2+ ids, **pular** a etapa "detect":
  - Buscar `clientes` apenas por `.in("id", preSelectedIds)`.
  - Montar um único `DuplicateGroup` (label "Seleção manual"), pré-selecionar todos os ids, escolher o mais antigo como `masterId` por padrão.
  - Setar `step = "merge"` direto.
- Se `preSelectedIds` vazio/ausente: fluxo atual de auto-detecção continua intacto.
- Header do dialog mostra badge "Seleção manual" quando aplicável; remove tabs Nome/Endereço nesse modo.

## Fora de escopo
- Mudar a lógica do merge em si (master/secundários, transferência de referências).
- Auto-detecção continua disponível para quem não selecionar nada.
- Persistência da seleção entre páginas/refresh (seleção é por sessão de tela).