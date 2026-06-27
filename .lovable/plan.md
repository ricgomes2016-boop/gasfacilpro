# Plano: Padronizar funcionamento da Bia em todos os canais

## Diagnóstico

Há 3 canais da Bia, cada um resolvendo empresa/unidade de um jeito diferente — dois deles caem em unidades sem preço cadastrado.

### 1. Site institucional — `bia-site-chat` (CAUSA do erro relatado)

`SLUG_TO_EMPRESA` no edge function mapeia:
- `centralgascp → centralgascp` → empresa com slug `centralgascp` **não existe** no banco. Quando o widget do site da Central Gas chama, a função retorna 404 OU (quando cai no fallback de outra rota) acaba pegando unidade errada.
- `fortegas → forte-gas` → existe empresa `forte-gas` com unidade Matriz, mas **todos os produtos dela estão com preço 0,00** (cadastro legado/duplicado).
- `japagas` → nem está mapeado.

Os preços reais ficam todos sob a empresa `central-gas` (slug correto), em unidades nomeadas `Central Gas`, `Forte Gás`, `Japa Gás`, `Morumbi Gás`, `Sertaneja`, `Temgas`, etc. — cada uma com seu próprio P13/P20/P45 precificado.

Resultado prático: a Bia do site da Central Gás (e da Forte Gás) sempre cai em unidades sem preço e responde "produto não tem preço cadastrado".

### 2. Voz / ElevenLabs — `elevenlabs-bia-tools`

Usa IDs fixos da unidade Central Gas e lê preços de `configuracoes_empresa.regras_bia.tabela_precos` (não de `produtos`). Funciona apenas para a Central Gas; não há resolução por loja chamada.

### 3. Telefonia Vapi — `vapi-webhook`

Pega a primeira unidade com `tipo='matriz'` do banco inteiro, sem filtrar empresa. Resultado é aleatório (qualquer empresa cadastrada com Matriz) e tende a cair em unidade sem preço.

## Mudanças

### A. `supabase/functions/bia-site-chat/index.ts`

Trocar `SLUG_TO_EMPRESA` por um mapa `SLUG_TO_TENANT` que aponta cada slug público para **empresa + nome da unidade** correto:

```ts
const SLUG_TO_TENANT = {
  centralgascp: { empresaSlug: "central-gas", unidadeNome: "Central Gas" },
  fortegas:     { empresaSlug: "central-gas", unidadeNome: "Forte Gás" },
  japagas:      { empresaSlug: "central-gas", unidadeNome: "Japa Gás" },
};
```

Atualizar resolução: buscar `empresas` por `empresaSlug`, depois `unidades` por `empresa_id + nome` (ativo=true). Se não achar a unidade nomeada, devolver erro claro em vez de pegar "a primeira".

Adicionar fallback de preço: dentro de `consultarProdutos` e `criarPedido`, se `produtos.preco <= 0`, consultar `configuracoes_empresa.regras_bia.tabela_precos` da empresa e usar esse valor (mesma fonte oficial usada pela Bia de voz). Mantém uma fonte única de verdade quando a tabela está configurada.

Ajustar tipagem de `unidadeSlug` no widget (`BiaChatWidget.tsx`) — já aceita `japagas`, só precisa estar registrado no backend.

### B. `supabase/functions/vapi-webhook/index.ts`

Substituir a query `from('unidades').eq('tipo','matriz')` por roteamento real:
1. Tentar resolver por `did_empresa_routing` usando o número discado do payload Vapi (`body.message.call?.toPhoneNumber` / equivalente). Já existe a tabela `did_empresa_routing` no banco.
2. Se não encontrar, cair em unidade fixa da Central Gas (mesma usada por `elevenlabs-bia-tools`) — não a "primeira matriz aleatória".
3. Aplicar o mesmo fallback de preço para `tabela_precos` quando `produtos.preco = 0`.

### C. Saneamento dos dados (sem mexer em código)

Apenas alertar o usuário (não migrar automaticamente neste plano): as empresas legadas `forte-gas`, `japa-gas`, `morumbi-gas`, `sertaneja`, `temgas`, `transfacil` têm unidade "Matriz" com produtos a R$ 0,00 que ninguém usa. Recomendar desativar (`ativo=false`) ou deletar essas Matrizes legadas em um momento separado, para não confundir buscas futuras.

## Verificação após implementação

1. Abrir `/centralgascp` → enviar "qual o preço do P13?" → deve retornar 125,00.
2. Abrir `/fortegas` → mesma pergunta → deve retornar 120,00.
3. Abrir `/japagas` → mesma pergunta → deve retornar 120,00.
4. Logs do edge function `bia-site-chat` sem erros 404 de empresa.
5. Criar pedido teste pelo site → ver pedido aparecer no ERP da unidade correta.

## Fora de escopo

- Mudar o tom/prompt da Bia.
- Migrar/excluir as empresas/unidades legadas duplicadas (recomendado, mas será separado).
- Mudar a Bia de voz (ElevenLabs) — já funciona; só herda o fallback de preço se aplicável.
