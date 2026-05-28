## Objetivo

Consolidar os dados de documentos do veículo (CRLV, Seguro, Seguradora e **RENAVAM**) dentro da tela **Gestão de Frota → Veículos**, removendo a duplicação que hoje existe na aba "Veículos" de **Documentos da Frota**. Nenhuma nova aba será criada — as informações entrarão dentro de cada card/linha do veículo. O PDF exportado da lista de veículos passará a incluir o RENAVAM.

## O que muda

### 1. Banco de dados
- Adicionar coluna `renavam` (texto, opcional) na tabela `veiculos`.

### 2. Tela "Veículos" (Gestão de Frota → Veículos)
- **Formulário de cadastro/edição de veículo**: incluir os campos
  - RENAVAM
  - Vencimento do CRLV
  - Vencimento do Seguro
  - Seguradora
  - Botão "Importar CRLV (foto/PDF)" — reaproveita a função `parse-crlv` já usada hoje em Documentos
- **Card do veículo (mobile)** e **linha do veículo (desktop)**: exibir, dentro do próprio card, badges de status do CRLV e do Seguro (Vencido / X dias restantes / OK) e o RENAVAM em texto pequeno. Sem aba nova, apenas mais informação dentro do mesmo card.
- **PDF "Exportar PDF"**: adicionar a coluna **RENAVAM** entre Placa e Modelo, e duas colunas extras de Vencimento CRLV e Vencimento Seguro ao final.

### 3. Tela "Documentos da Frota"
- Remover a aba **Veículos** (CRLV / Seguro), já que esses dados passam a ser editados em Veículos.
- Manter a aba **CNH Motoristas** (dado do entregador, não do veículo) e ajustar o KPI do topo para mostrar somente o que sobrou (Entregadores e CNH vencendo).
- Manter o menu lateral apontando para "Documentos" — a página continua existindo, só fica focada em CNH.

## Detalhes técnicos

- Migração SQL: `ALTER TABLE public.veiculos ADD COLUMN renavam text;` (sem alterar RLS/GRANTs existentes).
- `src/pages/cadastros/Veiculos.tsx`:
  - Estender `interface Veiculo`, `emptyForm`, `handleSave`, `handleEdit` para incluir `renavam`, `crlv_vencimento`, `seguro_vencimento`, `seguro_empresa`.
  - Adicionar `handleImportCrlv` (mesma lógica do arquivo `DocumentosFrota.tsx`) dentro do dialog do formulário.
  - Função `getDocStatus(date)` (igual à existente em DocumentosFrota) para gerar badges de CRLV/Seguro nos cards e linhas.
  - Atualizar `handleExportarPDF` para incluir `RENAVAM`, `CRLV` e `Seguro` no `head`/`body` do `autoTable`.
- `src/pages/frota/DocumentosFrota.tsx`:
  - Remover `<TabsTrigger value="veiculos">` e respectivo `<TabsContent>`, o dialog de edição de veículo, a função `handleImportCrlv` e o KPI "Alertas Veículos".
  - Trocar o `Tabs` por render direto da seção CNH; ajustar título/subtitle para "Documentos — CNH Motoristas".

## Fora de escopo
- Não mexer em `App.tsx`, provider nesting ou rotas.
- Não alterar permissões / RLS.
- Não criar abas novas em lugar nenhum.
