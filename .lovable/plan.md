## Objetivo

Ao escanear/digitar um código de barras (EAN/GTIN) no cadastro de Produtos, buscar automaticamente os dados do produto em uma base externa e pré-preencher: **nome, descrição, categoria** (e marca, quando houver).

## Onde

- Tela: `src/pages/cadastros/Produtos.tsx` (já tem `BarcodeScanner` + handler `handleBarcodeScan`).
- Lógica nova: edge function `lookup-barcode` (server-side, evita CORS e esconde key se necessário).

## Fluxo

```text
[Usuário escaneia / digita EAN]
        │
        ▼
handleBarcodeScan(codigo)
        │
        ├─ já existe em produtos[]? → toast "duplicado" (comportamento atual)
        │
        ├─ não existe → chama edge fn lookup-barcode(codigo)
        │
        ▼
edge fn tenta em ordem:
   1) Open Food Facts  (gratuito, sem key, mundial)
   2) Cosmos Bluesoft  (BR, mais preciso p/ não-alimentos) [se BLUESOFT_TOKEN existir]
        │
        ▼
Retorna { nome, descricao, marca, categoria_sugerida, imagem_url, fonte }
        │
        ▼
UI: preenche somente campos VAZIOS do form
    + mostra toast "Dados encontrados via Open Food Facts ✓"
    + se nada encontrado: toast neutro "Código lido, preencha manualmente"
```

## Fontes

- **Open Food Facts** — `https://world.openfoodfacts.org/api/v2/product/{ean}.json` — sem key, cobre alimentos/bebidas (relevante p/ água mineral).
- **Cosmos Bluesoft** (opcional, se o usuário quiser cobertura BR de não-alimentos como botijão, acessórios) — exige token (cadastro grátis, 25 consultas/dia). Pediremos via `add_secret` somente se o usuário aprovar.

Para o catálogo atual (gás P13/P20/P45, água 20L, acessórios), Open Food Facts cobre bem água; gás raramente tem EAN público. A função degrada com graça quando não encontra.

## Categorização

Mapeamento simples no edge fn:
- contém "água"/"mineral" → `agua`
- contém "gás"/"glp"/"botijão" → `gas`
- caso contrário → `outro` (usuário ajusta)

## Mudanças técnicas

1. **Nova edge function** `supabase/functions/lookup-barcode/index.ts`
   - Input: `{ codigo: string }`
   - Tenta Open Food Facts → Cosmos (se token) → retorna `{ ok, encontrado, dados }`
   - 200 OK sempre (mesmo se não encontrar), conforme regra do projeto.

2. **`Produtos.tsx`** — em `handleBarcodeScan` (e também ao sair do input manual de código com `onBlur`):
   - Após validar duplicidade, chamar `supabase.functions.invoke('lookup-barcode')`.
   - Preencher `form.nome`, `form.descricao`, `form.categoria` **apenas se estiverem vazios** (não sobrescreve o que o usuário já digitou).
   - Loading spinner discreto no campo enquanto consulta.

3. **Sem mudanças** em schema, RLS, ou outras telas.

## Fora de escopo

- Cadastro em massa por scanner.
- Integração com NF-e (já existe `match-produtos-xml`).
- Upload da imagem do produto via URL (pode ser próxima iteração).

## Pergunta antes de implementar

Quer que eu **comece só com Open Food Facts** (sem dependências/keys) e depois, se precisar, adicionamos Cosmos Bluesoft? Recomendo sim — entrega valor imediato sem pedir nada extra.