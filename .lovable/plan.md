
## Plano

Adicionar 2 botões + linha de status no topo de `src/pages/transportadora/TranspCompras.tsx` (a tela real de `/transportadora/compras`), sem mexer em layout existente.

### Mudanças

**1. `src/pages/transportadora/TranspCompras.tsx`**
- Importar `Download` e `RefreshCw` do `lucide-react`.
- Importar `useState` (já importado).
- Adicionar estado `const [importing, setImporting] = useState(false)`.
- Adicionar função `importarXmlOutlook()` exatamente como especificado pelo usuário, usando o `toast` do `sonner` (já importado no arquivo). Ajuste mínimo: como o projeto usa `sonner`, chamar `toast.success(...)` / `toast.error(...)` em vez do objeto `{title, description, variant}` (mantém a intenção, respeita o padrão do arquivo). Conteúdo das mensagens igual ao pedido.
- No header, dentro do `<div className="flex gap-3 items-end">` que já contém o seletor de Período e o `<Dialog>` "Nova Compra", inserir **antes** do `<Dialog>`:
  - Botão primário `"Importar XML do Outlook"` (variant default, ícone `Download`) — ao clicar também chama `importarXmlOutlook()` (mesmo handler, conforme regra "ao clicar em Buscar XML agora").
  - Botão secundário `"Buscar XML agora"` (variant `outline`, ícone `RefreshCw` com `animate-spin` quando `importing`) — chama `importarXmlOutlook()`.
  - Ambos com `disabled={importing}`.
- Logo abaixo da linha de botões/header, adicionar um `<p className="text-xs text-muted-foreground w-full">Última importação: --</p>` como placeholder.

Nada mais é tocado: o `<Dialog>` "Nova Compra", o resumo mensal, a lista de compras e toda a lógica de cálculo permanecem intactos.

### O que NÃO vou fazer
- Não criar a edge function `importar_xml_outlook` (o usuário pediu apenas o front; a função pode não existir ainda e retornará erro tratado pelo `try/catch` — comportamento esperado conforme a especificação).
- Não tocar em `src/pages/transportadora/Compras.tsx` (tela legada não usada na rota).
- Não alterar rota, layout, Dialog, ou lógica de negócio.
- Não corrigir os erros de build pré-existentes em `Compras.tsx` e edge functions — não foram solicitados e estão fora do escopo desta tela.

### Arquivos tocados
```text
EDIT  src/pages/transportadora/TranspCompras.tsx
```
