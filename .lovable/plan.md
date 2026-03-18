

# Adicionar Parceiros ao Mapa de Concorrentes

## Contexto
A tabela `vale_gas_parceiros` não possui colunas de coordenadas (`latitude`, `longitude`). Precisamos adicioná-las e criar a lógica para exibir parceiros no mapa com um ícone diferenciado de "revenda".

## Etapas

### 1. Migração de banco de dados
Adicionar colunas `latitude` e `longitude` (numeric, nullable) na tabela `vale_gas_parceiros`.

### 2. Novo ícone de parceiro/revenda
Criar uma variante do `createIcon` com um ícone de revenda (cor verde-azulado `#0ea5e9`, com símbolo de loja/R dentro do pin) para diferenciar visualmente dos concorrentes e das unidades próprias.

### 3. Alterações no `ConcorrentesMap.tsx`
- **Query de parceiros**: Buscar parceiros da mesma `unidade_id` (ou empresa) que tenham latitude/longitude preenchidos.
- **Marcadores no mapa**: Renderizar cada parceiro com o ícone de revenda, popup com nome, telefone, tipo e endereço.
- **Toggle de visibilidade**: Adicionar um checkbox/switch na legenda para mostrar/ocultar parceiros.
- **Legenda**: Incluir entrada "Parceiros/Revendas" com a cor correspondente.
- **Cadastro de localização**: Permitir que, ao clicar no mapa, o usuário escolha se está adicionando um concorrente ou um parceiro. Ou adicionar um botão separado para posicionar parceiros existentes (sem criar novos, apenas atualizar lat/lng de parceiros já cadastrados).

### 4. Dialog de posicionamento de parceiro
Ao invés de criar parceiros novos pelo mapa (já existe tela própria), oferecer um modo "Posicionar Parceiro" onde o usuário:
- Clica no mapa
- Seleciona qual parceiro existente deseja posicionar
- Salva as coordenadas

### Detalhes Técnicos
- **SQL Migration**: `ALTER TABLE vale_gas_parceiros ADD COLUMN latitude numeric, ADD COLUMN longitude numeric;`
- **Icon**: Pin azul-claro (#0ea5e9) com "R" (Revenda) no centro
- **Counter overlay**: Atualizar para mostrar parceiros + concorrentes

