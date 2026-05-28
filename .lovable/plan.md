## Mudanças em Gestão de Frota

### 1. Remover rota "Documentos" do menu Frota
- **`src/routes/frotaRoutes.ts`**: remover a entrada `{ path: "/frota/documentos", component: DocumentosFrota, ... }` (a página `DocumentosFrota.tsx` continua no projeto por enquanto, apenas sai do menu/rotas — as informações de CNH já vivem em RH/Funcionários e as de veículo já foram consolidadas em Cadastros/Veículos).
- Remover o item de menu correspondente em `src/components/layout/AppSidebar.tsx` (ou onde estiver listado o link "Documentos" sob Frota).

### 2. Galeria de fotos do veículo (Cadastros / Veículos)

**Banco** — migration adicionando 5 colunas opcionais em `public.veiculos`:
- `foto_painel text`
- `foto_frente text`
- `foto_lado_direito text`
- `foto_lado_esquerdo text`
- `foto_traseira text`

(`foto_url` continua sendo a foto principal/capa.)

**`src/pages/cadastros/Veiculos.tsx`**:
- Estender `interface Veiculo`, `emptyForm`, `handleSave` e `handleEdit` com os 5 novos campos.
- No dialog de novo/editar veículo, adicionar uma seção **"Galeria de Fotos"** com 6 slots `ImageUpload` (`allowCamera`): Capa, Painel, Frente, Lado Direito, Lado Esquerdo, Traseira. Cada slot grava na sua coluna. Layout em grid responsivo (`grid-cols-2 md:grid-cols-3`).
- Ao clicar em "Visualizar" (ícone Eye) ou na **foto do card do veículo**, abrir o `VeiculoDetalheDialog` (já é o comportamento atual via `setDetalheVeiculo`). Garantir que o clique na imagem do card também dispare isso (adicionar handler na thumbnail).

**`src/components/frota/VeiculoDetalheDialog.tsx`**:
- Estender a prop `veiculo` com os 5 novos campos opcionais.
- Adicionar uma nova aba **"Fotos"** (entre Alertas/TCO/Histórico) que renderiza um grid com as 6 fotos disponíveis (capa + painel + frente + lados + traseira), cada uma com label. Slots vazios mostram um placeholder discreto. Clicar na foto abre em tamanho cheio (lightbox simples via `Dialog`).
- Passar os novos campos no `setDetalheVeiculo(v)` em Veículos.tsx (já passa o objeto inteiro, então só precisa do tipo).

### Fora do escopo
- Nada em `App.tsx`, providers ou outras rotas.
- Nenhuma alteração em RH/Funcionários (já tem os documentos de motorista).
- Nenhuma alteração de RLS além das colunas novas herdarem as políticas existentes da tabela `veiculos`.