## Objetivo

Aplicar o mesmo padrão de cores sólidas (verde, azul, violeta, âmbar, vermelho, sky) já usado na Dashboard a **todos os KPIs** do sistema — incluindo Pedidos, Cadastro de Clientes, Fidelidade, Gestão de Crédito, Ranking, Fornecedores, Contas a Pagar, Planejamento e Frota.

## Diagnóstico

As telas afetadas não usam o componente `StatCard` nem `Card variant="kpi"`. Elas usam as classes legadas:

```
kpi-card kpi-card-primary | -success | -warning | -info | -destructive
```

Essas classes hoje renderizam um card branco com gradiente sutil e barra lateral colorida (`src/index.css` linhas ~852-857) — por isso continuam claros.

## Solução

Edição cirúrgica **apenas em CSS** (`src/index.css`), sem tocar em nenhuma página:

1. Reescrever as regras `.kpi-card-primary/-success/-warning/-info/-destructive` para herdarem o mesmo tratamento sólido de `.app-card.kpi`, mapeando:
   - `primary` → violeta
   - `success` → verde
   - `info` → azul
   - `warning` → âmbar
   - `destructive` → vermelho
2. Forçar fundo sólido (`--tile-*`), texto branco, ícones e `.kpi-value/.kpi-label/.status-card-icon` em `currentColor` com opacidade adequada.
3. Neutralizar o gradiente e a borda lateral antiga.
4. Garantir cantos no padrão do tema (`var(--radius)`) e manter o ajuste fino mobile já aplicado.

## Resultado esperado

Todas as telas listadas passam a exibir os KPIs com a mesma identidade visual sólida da Dashboard automaticamente — sem precisar mexer arquivo por arquivo.

## Arquivos afetados

- `src/index.css` (único arquivo editado)
