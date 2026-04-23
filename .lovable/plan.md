

## Recalcular comissões em RH/Comissão

### Diagnóstico (causas reais do "tudo zerado")

Confirmado via consulta direta no banco:

1. **Duplicatas em `comissao_config`** — existem 8 linhas duplicadas para `Gás P13 / telefone` (R$ 1,00 cada). O save atual deleta+insere por unidade, mas algo deixou lixo histórico. Não causa zeragem, mas polui.
2. **Configurações mais importantes estão com valor 0:**
   - `Gás P13 / Portaria` = **R$ 0** (e Portaria tem pedidos)
   - `Água Mineral 20L` em **todos** os canais = **R$ 0** (8 itens vendidos no mês)
3. **Forte Gás (3 pedidos do mês) não tem nenhuma config** — só Central Gas tem. Como o `lookupComissao` usa `byName` apenas quando `valor > 0`, não há fallback.
4. **Inconsistência maiúsculas/minúsculas resolvida pelo normalize**, então `telefone` (pedido) bate com `Telefone` (config) ✅. **Mas** com 8 linhas duplicadas de `telefone` no banco, o sort + `byId.set` mantém o último — ainda assim bate em R$ 1, OK.
5. **Conclusão**: a lógica do código **funciona** — o que está zerado são, de fato, os valores cadastrados (Portaria, Água, Forte Gás).

### Mudanças

**1. Limpar duplicatas em `comissao_config`** (migration de DELETE)
- Para cada `(unidade_id, produto_id, lower(canal_venda))`, manter apenas 1 linha (a com maior `valor`, depois mais recente).
- Adicionar índice único `UNIQUE (unidade_id, produto_id, lower(canal_venda))` para impedir duplicatas futuras.
- Ajustar `ComissaoConfigEditor.tsx` para fazer **upsert** com `onConflict` em vez de `delete + insert` (mais seguro).

**2. Fallback cross-unit em `lookupComissao`** (`src/pages/rh/ComissaoEntregador.tsx`)
- Hoje a query traz `comissao_config` filtrada por `unidade_id = atual OR null`. Para **Forte Gás** (que não tem config própria), não há linha alguma.
- Mudar a query para **trazer todas as configs da empresa** (todas as unidades + null), e o `comissaoMap.byName` passa a funcionar como fallback automático: se a unidade atual não tem config para `Gás P13 / Portaria`, usa a de Central Gas.
- Prioridade no `byId`: unidade atual > null > outras unidades (ajuste no `sort`).

**3. Botão "Recalcular comissões" no header da página**
- Botão `RefreshCw` ao lado do `ComissaoConfigEditor`.
- Ação: `queryClient.invalidateQueries` para `comissao-config`, `comissao-detalhada`, `entregadores-comissao` → força refetch e recálculo do `useMemo`.
- Toast: "Comissões recalculadas com base na configuração atual".

**4. Card "Diagnóstico de comissões zeradas" mais explícito**
- Já existe a seção `itensSemRegra`. Melhorar:
  - Mostrar chip da **unidade** de cada item zerado (Central Gas / Forte Gás).
  - Botão "Configurar agora" abre o `ComissaoConfigEditor` já no produto/canal correspondente (quando possível).
  - Linha-resumo: "X pedidos do mês estão sem comissão configurada (R$ Y em vendas)".

**5. Aviso quando a unidade atual não tem nenhuma config**
- Banner amarelo: "A unidade **Forte Gás** não tem comissões cadastradas. Usando como fallback a configuração de **Central Gas**. Recomenda-se cadastrar valores específicos."

### Arquivos
- **Migration**: limpar duplicatas + criar índice único em `public.comissao_config`.
- **Editar**: `src/pages/rh/ComissaoEntregador.tsx` (query cross-unit, botão recalcular, banner fallback, melhoria do card de zerados).
- **Editar**: `src/components/rh/ComissaoConfigEditor.tsx` (trocar delete+insert por upsert com `onConflict`).

### Critério de aceite
- Comissões deixam de aparecer R$ 0,00 para produtos/canais que **têm** valor cadastrado em qualquer unidade da empresa (fallback funciona para Forte Gás).
- Botão "Recalcular" força refresh imediato dos dados.
- Card de "itens sem regra" mostra exatamente quais combinações ainda precisam ser configuradas, com link rápido pro editor.
- Sem duplicatas em `comissao_config`; futuras gravações usam upsert idempotente.
- Demais funcionalidades (impressão de recibo, filtros de mês/entregador, gráfico) permanecem intactas.

