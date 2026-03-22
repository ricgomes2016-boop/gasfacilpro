

# Fix: "Cannot access 'toneGuides' before initialization"

## Problema

Na edge function `marketing-ai/index.ts`, o bloco `video_script` (linha ~60) referencia `toneGuides` antes da variável ser declarada (linha ~100+). JavaScript/TypeScript com `const` não permite acesso antes da inicialização.

## Correção

Mover a declaração de `toneGuides` para **antes** do bloco `if (type === "video_script")`, logo após a extração dos parâmetros do request.

**Arquivo:** `supabase/functions/marketing-ai/index.ts`

1. Mover o objeto `toneGuides` (atualmente dentro do bloco de texto) para logo após a linha `const { type, platform, topic, tone, imagePrompt } = await req.json();`
2. Remover a declaração duplicada que ficará no bloco de texto

Nenhuma outra alteração necessária.

