## Nova aba: Documentos Licitação

Adicionar terceira aba em **Configurações → Documentos da Empresa**, ao lado de "Documentos" e "Certidões e Vencimentos", para montar a pasta de uma licitação (pregão) a partir de modelos editáveis.

### Estrutura visual

```text
[ Documentos ] [ Certidões ] [ Documentos Licitação ]
```

Dentro da aba:
1. **Cabeçalho da Licitação** (cartão único no topo)
   - Nº do Pregão (ex: 046/2021)
   - Modalidade (Presencial / Eletrônico)
   - Órgão / Município (ex: Município de Cornélio Procópio - PR)
   - Data do pregão (gera "Cornélio Procópio, em 20 de abril de 2021")
   - Objeto resumido
   - Botão **"Gerar pasta completa (ZIP de PDFs)"**

2. **Três grupos de cards** (acordeões):
   - **Fora do Envelope** → ANEXO 05, ANEXO 06, ANEXO 11
   - **Envelope 1 — Proposta de Preço** → Carta-Proposta (ANEXO 10), Proposta de Preço (tabela de itens)
   - **Envelope 2 — Documentos de Habilitação** → reaproveita as certidões já cadastradas (CND Federal, Estadual, Municipal, Trabalhista, FGTS, ANP, Sintegra) + slots para anexos 07–09 quando o usuário enviar

   Cada card mostra: título do anexo, status (Pronto / Falta dados), botões **Editar**, **Pré-visualizar**, **Baixar PDF**.

### Edição dos modelos

Cada modelo é um template com placeholders. Os dados da empresa vêm de `unidades` (razão social, CNPJ, IE, endereço, telefone, email, banco) — preenchidos automaticamente. Os dados específicos da licitação vêm do cabeçalho. Campos editáveis por modelo:

- **ANEXO 05 — Cumprimento dos requisitos**: somente cabeçalho (auto).
- **ANEXO 06 — ME/EPP**: tipo (ME / EPP) + cabeçalho.
- **ANEXO 11 — Informações contratuais**: representante (nome, CPF, RG, endereço, telefone), conta bancária (banco, agência, conta).
- **ANEXO 10 — Carta-Proposta**: cabeçalho + lista de itens (vem da Proposta de Preço) + validade da proposta (dias).
- **Proposta de Preço**: tabela editável de itens (item, especificação, quantidade, unidade, valor unit., valor total calculado) + data.

Editor inline em modal (`ResponsiveDialog`), com auto-save no banco.

### Saída em PDF

Geração 100% client-side com `jspdf` + `jspdf-autotable` (já compatível com o stack). Cada modelo tem sua função de render. Logo da empresa puxado de `unidades.logo_url`. Botão "Gerar pasta completa" empacota todos em ZIP via `jszip`, nomeando como:
```
Pregao_046-2021/
  Fora do Envelope/ANEXO_05.pdf, ANEXO_06.pdf, ANEXO_11.pdf
  Envelope 1 - Proposta/Carta_Proposta.pdf, Proposta_de_Preco.pdf
  Envelope 2 - Habilitacao/CND_Federal.pdf, ... (reaproveita PDFs já em certidoes_empresa)
```

### Persistência

Nova tabela `licitacoes`:
- `numero_pregao`, `modalidade`, `orgao`, `data_pregao`, `objeto`
- `dados_json` (jsonb) com config dos anexos e itens da proposta
- `unidade_id`, `empresa_id`, `created_by`, timestamps
- RLS por unidade (mesmo padrão de `documentos_empresa`)

Lista de licitações criadas aparece acima dos grupos; usuário seleciona uma para editar/gerar, ou clica em **"Nova Licitação"**.

### Arquivos a criar/editar

- `src/pages/config/DocumentosEmpresa.tsx` — adicionar `<TabsTrigger value="licitacao">` e `<TabsContent>`
- `src/components/config/licitacao/LicitacaoTab.tsx` — container da aba
- `src/components/config/licitacao/LicitacaoHeader.tsx` — cabeçalho do pregão
- `src/components/config/licitacao/AnexoCard.tsx` — card com ações
- `src/components/config/licitacao/editors/` — modais de edição por anexo
- `src/lib/licitacao/templates/` — funções `renderAnexo05Pdf`, `renderAnexo06Pdf`, `renderAnexo11Pdf`, `renderCartaPropostaPdf`, `renderPropostaPrecoPdf`
- `src/lib/licitacao/zip.ts` — empacotador
- Migração: tabela `licitacoes` + RLS

### Perguntas antes de implementar

1. **Itens da proposta**: devo puxar do catálogo de produtos do ERP (tabela `produtos`) deixando o usuário só ajustar quantidade/preço, ou começar com lista vazia para ele digitar? Os modelos enviados têm itens fixos (P-13, P-45, água, mangueiras, registros) — viraria template padrão?
2. **Assinatura**: usar a assinatura digital já cadastrada (vi `useAssinaturaDigital`) para inserir como imagem no PDF, ou manter linha em branco para assinar à mão depois de imprimir?
3. **Anexos 07, 08, 09**: você vai enviar os modelos depois? Por ora deixo placeholders "Em breve" nesses cards?
4. **Múltiplas licitações**: é comum participar de várias ao mesmo tempo (lista histórica) ou só uma por vez (sobrescreve)?