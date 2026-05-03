## Corrigir contraste de Badges "secondary" (texto apagado)

### Diagnóstico

Os "balões" de bairro (Vila Independência, CENTRO, VITOR DANTAS, BELA VISTA, etc.) usam `<Badge variant="secondary">`. A variante atual em `src/components/ui/badge.tsx`:

```
secondary: "border-secondary/20 bg-secondary/10 text-secondary hover:bg-secondary/15"
```

`--secondary` no tema padrão é `hsl(243 100% 69%)` — um lilás claro. Texto lilás claro sobre fundo lilás a 10% gera contraste muito baixo, especialmente em fundo branco. Por isso parece "apagado". Como esse Badge é usado em vários lugares do sistema, a correção propaga.

### Correção

Em `src/components/ui/badge.tsx`, alterar a variante `secondary` para usar texto com contraste forte e fundo levemente mais saturado:

```
secondary: "border-secondary/40 bg-secondary/15 text-foreground hover:bg-secondary/25"
```

- `text-foreground`: usa a cor de texto do tema (preto/quase-preto no claro, claro no escuro), garantindo legibilidade.
- `bg-secondary/15` + `border-secondary/40`: mantém o tom lilás identificando a variante, mas reforça a borda.

### Arquivo alterado
- `src/components/ui/badge.tsx` — apenas a linha 12 (variante `secondary`).
