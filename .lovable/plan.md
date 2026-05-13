## Objetivo

Em **Cadastros → Veículos** (`/cadastros/veiculos`):
1. Adicionar campo **Foto do veículo** no modal de cadastro/edição, exibido **antes da Placa**.
2. Aplicar **máscara Mercosul** no campo Placa (formato `ABC1D23` — 3 letras, 1 número, 1 letra, 2 números).
3. Mostrar a miniatura da foto na **listagem** (coluna nova antes de "Placa", tanto desktop quanto mobile).

## Mudanças

### 1. Banco de dados (migration)
- Adicionar coluna `foto_url TEXT` em `public.veiculos` (nullable).
- Criar bucket público `vehicle-photos` em `storage.buckets` com policies de SELECT público e INSERT/UPDATE/DELETE para usuários autenticados (mesmo padrão de `product-images`).

### 2. `src/pages/cadastros/Veiculos.tsx`
- `emptyForm`: incluir `foto_url: ""`.
- Tipo `Veiculo`: incluir `foto_url?: string | null`.
- Modal (form):
  - Adicionar bloco com `<ImageUpload bucket="vehicle-photos" folder="veiculos" />` **acima** do campo Placa, com label "Foto do veículo".
  - Substituir `onChange` da Placa por uma função que aplica máscara Mercosul: remove caracteres não-alfanuméricos, força uppercase, limita a 7 caracteres e formata como `LLLNLNN` (ex.: `ABC1D23`). Adicionar `maxLength={7}` e `pattern="[A-Z]{3}[0-9][A-Z][0-9]{2}"`.
  - Validação no `handleSave`: se preenchida, deve bater com regex Mercosul `^[A-Z]{3}[0-9][A-Z][0-9]{2}$`. Caso não bata, exibir toast e abortar (mantém compat. com placas antigas que já estão no banco — só aplica regra em novos/edições do campo).
- `payload` salva `foto_url`.
- `startEdit` carrega `foto_url`.
- Tabela desktop:
  - Nova `<TableHead className="w-16">Foto</TableHead>` antes de Placa.
  - Nova `<TableCell>` com `<img>` 40x40 arredondado se `foto_url`, senão ícone placeholder (`Car`).
- Cards mobile: incluir miniatura à esquerda do bloco da placa.

### 3. Helper de máscara
- Função local `formatPlacaMercosul(value: string)` no próprio arquivo (não vale criar util compartilhada para uma única tela).

## Fora do escopo
- Não alterar telas de transportadora/frota (`TranspVeiculos.tsx`, etc.) — usuário pediu só a tela mostrada (`/cadastros/veiculos`). Posso estender depois se desejar.
- Não migrar placas legadas no formato antigo (`ABC1234`) — continuam aceitas em leitura.
