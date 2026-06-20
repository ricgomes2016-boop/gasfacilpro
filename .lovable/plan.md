# Correções no app do cliente

## 1. Fotos dos produtos não carregam

**Causa:** Em `src/pages/cliente/ClienteHome.tsx` (linhas 88-106) o fallback consulta `produtos.empresa_id`, mas a tabela `produtos` não possui essa coluna — só tem `unidade_id`. A query falha silenciosamente e nenhum `image_url` é resolvido. Por isso, mesmo com produtos cadastrados em outras unidades da Forte Gás contendo imagem (Gás P13, Gás P20, P45, Água Mineral 20L existem com `image_url` no banco), os cards ficam com o ícone genérico.

**Correção:** Trocar a consulta de fallback por um join via `unidades.empresa_id`:

```ts
const { data } = await supabase
  .from("produtos")
  .select("nome, image_url, unidades!inner(empresa_id)")
  .eq("unidades.empresa_id", empresaInfo.id)
  .in("nome", missing)
  .not("image_url", "is", null);
```

Mantém o mesmo mapeamento `nome → image_url` já existente. Isolamento por empresa é preservado (não vaza entre empresas) e segue as regras de RLS atuais.

## 2. Letras brancas invisíveis nos cards "Indicação" e "Minha Carteira"

**Causa:** Ambos usam `<Card className="bg-gradient-to-br from-primary ... text-primary-foreground">`. O componente `Card` aplica a classe utilitária `app-card`, que em `src/index.css` (linha 645) força `bg-gradient-to-br from-card via-card to-muted/25` no layer `components`. Em alguns navegadores/ordens de cascata o gradiente do componente vence sobre as utilitárias passadas no `className`, deixando o card branco com texto branco.

**Correção:** Em vez de lutar com a cascata, substituir o `<Card>` colorido por um `<div>` estilizado equivalente nos dois lugares:

- `src/pages/cliente/ClienteIndicacao.tsx` (linhas 69-89): banner "Indique e Ganhe" → `<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-md">` mantendo o mesmo conteúdo interno (padding `p-6`, ícone Gift, h1, parágrafos).
- `src/pages/cliente/ClienteCarteira.tsx` (linhas 36-51): card "Saldo disponível" → `<div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 shadow-md">` com o conteúdo atual.

Os demais cards das duas páginas (estatísticas, lista de indicados, etc.) continuam como `<Card>` normal — o problema só ocorre quando se tenta sobrescrever o fundo padrão.

## Fora de escopo

- Não mexer em `App.tsx`, providers, rotas, contexto, RLS, autenticação ou qualquer lógica de negócio.
- Não alterar o componente `Card` global (afetaria todo o ERP).
- Não alterar a Home além do fix de fallback de imagem.

## Arquivos afetados

- `src/pages/cliente/ClienteHome.tsx` (fallback de imagem)
- `src/pages/cliente/ClienteIndicacao.tsx` (banner do topo)
- `src/pages/cliente/ClienteCarteira.tsx` (card de saldo)
