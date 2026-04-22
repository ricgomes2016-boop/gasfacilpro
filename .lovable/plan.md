

## Problemas

1. **Coluna Data desalinhada no responsivo**: largura `w-[110px]` aplicada apenas no `<th>`, sem `whitespace-nowrap` consistente, e a tabela não tem `min-width`, causando squeeze em telas pequenas.
2. **Data errada (01/04 em vez de 31/03)**: A NF-e/NFC-e traz `dhEmi` com offset (`2026-03-31T23:15:00-03:00`). A edge function `parse-nfe-xml` converte com `new Date(dhEmi).toISOString()` → vira UTC `2026-04-01T02:15:00Z`. Ao exibir com `parseISO` + `format` no fuso do navegador (que pode ser UTC no preview), aparece `01/04/2026`.

## Correções

### 1. `supabase/functions/parse-nfe-xml/index.ts`
- Preservar a data original do XML sem conversão para UTC.
- Extrair `YYYY-MM-DD` direto da string `dhEmi` (os 10 primeiros caracteres já vêm na hora local do emitente, ex: `2026-03-31T23:15:00-03:00` → `2026-03-31`).
- Salvar `data_emissao` como ISO completo preservando o offset original (`new Date(dhEmi).toISOString()` será substituído por uso direto da string do XML quando ela já estiver no formato ISO com timezone; se for `dEmi` puro `YYYY-MM-DD`, salvar como `${data}T12:00:00-03:00` para evitar shift).

### 2. `src/pages/contador/ContadorXML.tsx`
- **Formatação da data**: criar helper `formatDataEmissao(iso)` que extrai os 10 primeiros caracteres da string ISO (`iso.slice(0,10)`) e formata como `dd/MM/yyyy` sem instanciar `Date` — assim respeita exatamente a data gravada, sem shift de fuso.
- Substituir `safeDateLabel(dia.slice(0,10))` por esse helper na coluna Data.
- Atualizar a coluna do export (`{ key: "data_emissao", format: ... }`) para usar o mesmo helper, evitando que o CSV/PDF mostre data diferente da tela.

### 3. Alinhamento da coluna Data (responsivo)
Em `src/pages/contador/ContadorXML.tsx`:
- Adicionar `min-w-[1100px]` à `<table>` para forçar scroll horizontal limpo em telas pequenas (já existe `overflow-x-auto` no wrapper).
- Coluna Data: `<th className="px-3 py-3 text-left whitespace-nowrap w-[100px]">` e `<td className="px-3 py-2 text-foreground whitespace-nowrap tabular-nums">` para alinhamento consistente com colunas numéricas/datas.

## Backfill (opcional, dependente de aprovação)
- As notas já gravadas com `data_emissao` shiftada para UTC continuarão exibindo o dia errado mesmo após a correção do helper, porque a string salva é `2026-04-01T02:15:00.000Z`.
- Para corrigir o histórico, será criada migration que recompute `data_emissao` para os registros cujo `xml_url` ainda existe — mas isso exige reler o XML do bucket. **Caminho alternativo, mais simples**: ajustar o helper de exibição para subtrair 3h (Brasília) antes de extrair o dia quando a string termina em `Z`. Isso corrige visualmente o histórico sem migração.

Vou aplicar a correção visual + edge function. Para o histórico, o helper de exibição passará a normalizar para fuso de Brasília (UTC-3) antes de extrair `YYYY-MM-DD`, resolvendo retroativamente.

## Arquivos afetados
- `supabase/functions/parse-nfe-xml/index.ts` — preservar data original ao gravar
- `src/pages/contador/ContadorXML.tsx` — helper de data Brasília-aware + ajustes de largura/alinhamento responsivo

Sem migração de banco, sem mudanças em rotas ou providers.

